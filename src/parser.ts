import { QueryError } from './errors.js';
import { lex } from './lexer.js';
import type { ASTNode, CompareOp, Span, Token } from './types.js';

class Cursor {
  private idx = 0;
  constructor(private readonly tokens: Token[]) {}

  peek(): Token {
    const t = this.tokens[this.idx];
    if (t === undefined) {
      const last = this.tokens[this.tokens.length - 1];
      return { kind: 'eof', text: '', pos: last !== undefined ? last.pos : 0 };
    }
    return t;
  }

  next(): Token {
    const t = this.peek();
    if (this.idx < this.tokens.length) this.idx += 1;
    return t;
  }

  expect(kind: Token['kind'], what: string): Token {
    const t = this.peek();
    if (t.kind !== kind) {
      throw new QueryError(`expected ${what}`, t.pos, `expected ${what}`);
    }
    return this.next();
  }
}

function spanOf(start: number, end: number): Span {
  return { start, end };
}

function tokenEnd(t: Token): number {
  return t.pos + t.text.length;
}

function combine(a: Span, b: Span): Span {
  return { start: a.start, end: b.end };
}

function parsePipe(cur: Cursor): ASTNode {
  let left = parseCompare(cur);
  while (cur.peek().kind === 'pipe') {
    cur.next();
    const right = parseCompare(cur);
    if (right.kind === 'root') {
      throw new QueryError('unexpected token after pipe', cur.peek().pos, 'expected filter after pipe');
    }
    const span: Span = combine(left.span, right.span);
    left = { kind: 'pipe', left, right, span };
  }
  return left;
}

function isCompareOp(text: string): text is CompareOp {
  return text === '>' || text === '<' || text === '>=' || text === '<=' || text === '==' || text === '!=';
}

function parseCompare(cur: Cursor): ASTNode {
  const left = parsePostfix(cur);
  const t = cur.peek();
  if (t.kind === 'op' && isCompareOp(t.text)) {
    cur.next();
    const right = parsePostfix(cur);
    return { kind: 'compare', op: t.text, left, right, span: combine(left.span, right.span) };
  }
  return left;
}

function parsePostfix(cur: Cursor): ASTNode {
  if (cur.peek().kind === 'dot') {
    const dot = cur.next();
    let node: ASTNode = { kind: 'root', span: spanOf(dot.pos, dot.pos + 1) };
    for (;;) {
      const t = cur.peek();
      if (t.kind === 'ident' || t.kind === 'string') {
        cur.next();
        const field: ASTNode = {
          kind: 'field',
          name: t.text,
          span: spanOf(t.pos, t.pos + t.text.length),
        };
        node = { kind: 'pipe', left: node, right: field, span: combine(node.span, field.span) };
        continue;
      }
      if (t.kind === 'dot') {
        const dot2 = cur.next();
        const after = cur.peek();
        if (after.kind === 'ident' || after.kind === 'string') {
          cur.next();
          const field: ASTNode = {
            kind: 'field',
            name: after.text,
            span: spanOf(dot2.pos, after.pos + after.text.length),
          };
          node = { kind: 'pipe', left: node, right: field, span: combine(node.span, field.span) };
          continue;
        }
        if (after.kind === 'lbracket') {
          continue;
        }
        throw new QueryError("expected field name after '.'", after.pos, 'expected field name');
      }
      if (t.kind === 'lbracket') {
        const lb = cur.next();
        const nxt = cur.peek();
        if (nxt.kind === 'rbracket') {
          cur.next();
          const w: ASTNode = { kind: 'wildcard', span: spanOf(lb.pos, nxt.pos + 1) };
          node = { kind: 'pipe', left: node, right: w, span: combine(node.span, w.span) };
          continue;
        }
        if (nxt.kind === 'number' || nxt.kind === 'colon') {
          const sliceOrIndex = parseBracketContent(cur, lb.pos);
          node = { kind: 'pipe', left: node, right: sliceOrIndex, span: combine(node.span, sliceOrIndex.span) };
          continue;
        }
        throw new QueryError("expected number, ':', or ']'", nxt.pos, "expected ']'");
      }
      break;
    }
    return node;
  }
  return parsePrimary(cur);
}

function parseBracketContent(cur: Cursor, lbPos: number): ASTNode {
  const t = cur.peek();
  if (t.kind === 'colon') {
    cur.next();
    const after = cur.peek();
    let end: number | undefined;
    if (after.kind === 'number') {
      cur.next();
      end = Number(after.text);
      if (!Number.isInteger(end)) throw new QueryError('slice index must be integer', after.pos);
    } else if (after.kind === 'rbracket') {
      end = undefined;
    } else {
      throw new QueryError("expected number or ']'", after.pos, "expected ']'");
    }
    const rb = cur.expect('rbracket', "']'");
    return { kind: 'slice', start: undefined, end, span: spanOf(lbPos, rb.pos + 1) };
  }
  if (t.kind === 'number') {
    cur.next();
    const num = Number(t.text);
    if (!Number.isInteger(num)) throw new QueryError('index must be integer', t.pos);
    const nxt = cur.peek();
    if (nxt.kind === 'colon') {
      cur.next();
      const after = cur.peek();
      let end: number | undefined;
      if (after.kind === 'number') {
        cur.next();
        end = Number(after.text);
        if (!Number.isInteger(end)) throw new QueryError('slice index must be integer', after.pos);
      } else if (after.kind === 'rbracket') {
        end = undefined;
      } else {
        throw new QueryError("expected number or ']'", after.pos, "expected ']'");
      }
      const rb = cur.expect('rbracket', "']'");
      return { kind: 'slice', start: num, end, span: spanOf(lbPos, rb.pos + 1) };
    }
    if (nxt.kind === 'rbracket') {
      cur.next();
      return { kind: 'index', index: num, span: spanOf(lbPos, nxt.pos + 1) };
    }
    throw new QueryError("expected ']' or ':'", nxt.pos, "expected ']'");
  }
  throw new QueryError("expected number, ':', or ']'", t.pos, "expected ']'");
}

function parsePrimary(cur: Cursor): ASTNode {
  const t = cur.peek();
  if (t.kind === 'ident') {
    if (t.text === 'true' || t.text === 'false') {
      cur.next();
      return { kind: 'literal', value: t.text === 'true', span: spanOf(t.pos, t.pos + t.text.length) };
    }
    if (t.text === 'null') {
      cur.next();
      return { kind: 'literal', value: null, span: spanOf(t.pos, t.pos + 4) };
    }
    const nxtIdx = curTokensAhead(cur, 1);
    if (nxtIdx?.kind === 'lparen') {
      cur.next();
      cur.next();
      const args: ASTNode[] = [];
      if (cur.peek().kind !== 'rparen') {
        for (;;) {
          args.push(parsePipe(cur));
          if (cur.peek().kind === 'comma') {
            cur.next();
            continue;
          }
          break;
        }
      }
      const rp = cur.expect('rparen', "')'");
      return { kind: 'call', name: t.text, args, span: spanOf(t.pos, rp.pos + 1) };
    }
    if (t.text === 'length' || t.text === 'keys') {
      cur.next();
      return { kind: 'call', name: t.text, args: [], span: spanOf(t.pos, t.pos + t.text.length) };
    }
    throw new QueryError(`unexpected identifier '${t.text}'`, t.pos, 'expected filter');
  }
  if (t.kind === 'number') {
    cur.next();
    return { kind: 'literal', value: Number(t.text), span: spanOf(t.pos, t.pos + t.text.length) };
  }
  if (t.kind === 'string') {
    cur.next();
    return { kind: 'literal', value: t.text, span: spanOf(t.pos, t.pos + t.text.length + 2) };
  }
  if (t.kind === 'lparen') {
    cur.next();
    const inner = parsePipe(cur);
    const rp = cur.expect('rparen', "')'");
    void rp;
    return inner;
  }
  if (t.kind === 'eof') {
    throw new QueryError('unexpected end of query', t.pos, 'expected filter');
  }
  throw new QueryError(`unexpected token '${t.text}'`, t.pos, 'expected filter');
}

// Helper to look ahead without consuming (access private via peek emulation).
// We implement by temporarily checking next token via cursor internals through public API:
// Cursor doesn't expose lookahead, so we approximate by peeking twice using a hack:
// instead, we re-lex? Simpler: add method to Cursor. For now, implement inline lookahead
// by reaching into (cur as unknown as { tokens: Token[]; idx: number }).
function curTokensAhead(cur: Cursor, k: number): Token | undefined {
  const anyCur = cur as unknown as { tokens: Token[]; idx: number };
  const arr = anyCur.tokens;
  const idx = anyCur.idx + k;
  if (idx < 0 || idx >= arr.length) return undefined;
  return arr[idx];
}

export function parseTokens(tokens: Token[]): ASTNode {
  const cur = new Cursor(tokens);
  if (cur.peek().kind === 'eof') {
    throw new QueryError('empty query', 0, 'expected filter');
  }
  const node = parsePipe(cur);
  const rest = cur.peek();
  if (rest.kind !== 'eof') {
    throw new QueryError(`unexpected token '${rest.text}'`, rest.pos, 'unexpected token');
  }
  return node;
}

export function parse(query: string): ASTNode {
  return parseTokens(lex(query));
}
