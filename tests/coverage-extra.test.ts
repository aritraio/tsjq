import { describe, expect, it } from 'vitest';
import { lex } from '../src/lexer.js';
import { parse } from '../src/parser.js';
import { query } from '../src/evaluator.js';

describe('coverage-extra', () => {
  it('lexer single quotes and escapes', () => {
    expect(lex(`'a\\'b'`).find((t) => t.kind === 'string')?.text).toContain('a');
    expect(() => lex('.a = 1')).toThrowError();
    expect(lex('.a *').map((t) => t.kind)).toContain('star');
  });

  it('parser empty and slice and length', () => {
    expect(() => parse('')).toThrowError(/empty/);
    expect(parse('.[1:2]').kind).toBe('pipe');
    expect(parse('.a | length').kind).toBe('pipe');
    expect(query([1, 2], '.[0:1]')).toEqual([[1]]);
  });
});
