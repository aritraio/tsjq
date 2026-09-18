import { describe, expect, it } from 'vitest';
import { QueryError } from '../src/errors.js';
import { lex } from '../src/lexer.js';
import type { Token } from '../src/types.js';

function kinds(q: string): string[] {
  return lex(q).map((t) => t.kind);
}

describe('lexer', () => {
  it('lexes dot field chain with positions', () => {
    const toks = lex('.users[0].name');
    const slim = toks.map((t: Token) => [t.kind, t.text, t.pos]);
    expect(slim).toEqual([
      ['dot', '.', 0],
      ['ident', 'users', 1],
      ['lbracket', '[', 6],
      ['number', '0', 7],
      ['rbracket', ']', 8],
      ['dot', '.', 9],
      ['ident', 'name', 10],
      ['eof', '', 14],
    ]);
  });

  it('lexes root dot', () => {
    expect(kinds('.')).toEqual(['dot', 'eof']);
  });

  it('lexes wildcard []', () => {
    const toks = lex('.items[]');
    expect(toks.map((t) => t.kind)).toEqual(['dot', 'ident', 'lbracket', 'rbracket', 'eof']);
    expect(toks[2]?.pos).toBe(6);
    expect(toks[3]?.pos).toBe(7);
  });

  it('lexes negative index', () => {
    const toks = lex('.arr[-1]');
    expect(toks.map((t) => [t.kind, t.text])).toEqual([
      ['dot', '.'],
      ['ident', 'arr'],
      ['lbracket', '['],
      ['number', '-1'],
      ['rbracket', ']'],
      ['eof', ''],
    ]);
  });

  it('lexes pipe', () => {
    expect(kinds('.a | .b')).toEqual(['dot', 'ident', 'pipe', 'dot', 'ident', 'eof']);
  });

  it('lexes select call with comparison', () => {
    const toks = lex('.items[] | select(.price > 20)');
    expect(toks.map((t) => t.kind)).toEqual([
      'dot',
      'ident',
      'lbracket',
      'rbracket',
      'pipe',
      'ident',
      'lparen',
      'dot',
      'ident',
      'op',
      'number',
      'rparen',
      'eof',
    ]);
    const op = toks.find((t) => t.kind === 'op');
    expect(op?.text).toBe('>');
  });

  it('lexes all comparison ops', () => {
    for (const op of ['>', '<', '>=', '<=', '==', '!=']) {
      const toks = lex(`.a ${op} 1`);
      expect(toks.find((t) => t.kind === 'op')?.text).toBe(op);
    }
  });

  it('lexes quoted key and strings', () => {
    const toks = lex('."a b"');
    expect(toks.map((t) => t.kind)).toEqual(['dot', 'string', 'eof']);
    expect(toks[1]?.text).toBe('a b');
    const s = lex(`select(.a == "x")`);
    expect(s.find((t) => t.kind === 'string')?.text).toBe('x');
  });

  it('lexes slice colon', () => {
    expect(kinds('.[1:3]')).toEqual(['dot', 'lbracket', 'number', 'colon', 'number', 'rbracket', 'eof']);
  });

  it('lexes parens comma star', () => {
    expect(kinds('map(., *)')).toContain('star');
    expect(kinds('f(a, b)')).toEqual(['ident', 'lparen', 'ident', 'comma', 'ident', 'rparen', 'eof']);
  });

  it('errors on bad character', () => {
    expect(() => lex('.a @')).toThrowError(QueryError);
    try {
      lex('.a @');
    } catch (e) {
      expect(e).toBeInstanceOf(QueryError);
      expect((e as QueryError).pos).toBe(3);
    }
  });

  it('errors on unterminated string', () => {
    expect(() => lex('."abc')).toThrowError(/unterminated string/);
  });

  it('errors on lone bang', () => {
    expect(() => lex('.a ! 1')).toThrowError(QueryError);
  });
});
