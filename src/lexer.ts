import { QueryError } from './errors.js';
import type { Token } from './types.js';

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_$]/.test(ch);
}

function isIdentPart(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch);
}

function isDigit(ch: string): boolean {
  return /[0-9]/.test(ch);
}

export function lex(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  const peek = (k = 0): string | undefined => {
    const idx = i + k;
    if (idx < 0 || idx >= n) return undefined;
    return input[idx];
  };

  while (i < n) {
    const ch = peek();
    if (ch === undefined) break;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1;
      continue;
    }
    const pos = i;
    if (ch === '.') {
      tokens.push({ kind: 'dot', text: '.', pos });
      i += 1;
      continue;
    }
    if (ch === '|') {
      tokens.push({ kind: 'pipe', text: '|', pos });
      i += 1;
      continue;
    }
    if (ch === '[') {
      tokens.push({ kind: 'lbracket', text: '[', pos });
      i += 1;
      continue;
    }
    if (ch === ']') {
      tokens.push({ kind: 'rbracket', text: ']', pos });
      i += 1;
      continue;
    }
    if (ch === '(') {
      tokens.push({ kind: 'lparen', text: '(', pos });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen', text: ')', pos });
      i += 1;
      continue;
    }
    if (ch === ',') {
      tokens.push({ kind: 'comma', text: ',', pos });
      i += 1;
      continue;
    }
    if (ch === ':') {
      tokens.push({ kind: 'colon', text: ':', pos });
      i += 1;
      continue;
    }
    if (ch === '*') {
      tokens.push({ kind: 'star', text: '*', pos });
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let out = '';
      let closed = false;
      while (j < n) {
        const c = input[j];
        if (c === undefined) break;
        if (c === '\\') {
          const nxt = input[j + 1];
          if (nxt === undefined) break;
          if (nxt === 'n') out += '\n';
          else if (nxt === 't') out += '\t';
          else if (nxt === 'r') out += '\r';
          else out += nxt;
          j += 2;
          continue;
        }
        if (c === quote) {
          closed = true;
          j += 1;
          break;
        }
        out += c;
        j += 1;
      }
      if (!closed) {
        throw new QueryError('unterminated string', pos, `expected closing ${quote}`);
      }
      tokens.push({ kind: 'string', text: out, pos });
      i = j;
      continue;
    }
    if (ch === '-' && isDigit(peek(1) ?? '')) {
      let j = i + 1;
      while (j < n && isDigit(input[j] ?? '')) j += 1;
      if ((input[j] ?? '') === '.' && isDigit(input[j + 1] ?? '')) {
        j += 1;
        while (j < n && isDigit(input[j] ?? '')) j += 1;
      }
      tokens.push({ kind: 'number', text: input.slice(i, j), pos });
      i = j;
      continue;
    }
    if (isDigit(ch)) {
      let j = i;
      while (j < n && isDigit(input[j] ?? '')) j += 1;
      if ((input[j] ?? '') === '.' && isDigit(input[j + 1] ?? '')) {
        j += 1;
        while (j < n && isDigit(input[j] ?? '')) j += 1;
      }
      tokens.push({ kind: 'number', text: input.slice(i, j), pos });
      i = j;
      continue;
    }
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < n && isIdentPart(input[j] ?? '')) j += 1;
      tokens.push({ kind: 'ident', text: input.slice(i, j), pos });
      i = j;
      continue;
    }
    if (ch === '>' || ch === '<' || ch === '=' || ch === '!') {
      const two = input.slice(i, i + 2);
      if (two === '>=' || two === '<=' || two === '==' || two === '!=') {
        tokens.push({ kind: 'op', text: two, pos });
        i += 2;
        continue;
      }
      if (ch === '>' || ch === '<') {
        tokens.push({ kind: 'op', text: ch, pos });
        i += 1;
        continue;
      }
      throw new QueryError(`unexpected character '${ch}'`, pos, 'expected comparison operator');
    }
    throw new QueryError(`unexpected character '${ch}'`, pos, 'unexpected character');
  }
  tokens.push({ kind: 'eof', text: '', pos: n });
  return tokens;
}
