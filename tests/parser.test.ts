import { describe, expect, it } from 'vitest';
import { QueryError } from '../src/errors.js';
import { parse } from '../src/parser.js';

describe('parser', () => {
  it('parses .a.b as pipe chain', () => {
    expect(parse('.a.b')).toMatchSnapshot();
    const ast = parse('.a.b');
    expect(ast.kind).toBe('pipe');
  });

  it('parses .arr[-1]', () => {
    expect(parse('.arr[-1]')).toMatchSnapshot();
  });

  it('parses .items[] | select(.price > 20)', () => {
    const ast = parse('.items[] | select(.price > 20)');
    expect(ast).toMatchSnapshot();
    expect(ast.kind).toBe('pipe');
  });

  it('parses literals and parens', () => {
    expect(parse('.a == "x"').kind).toBe('compare');
    expect(parse('select(.a)').kind).toBe('call');
  });

  it("errors on missing ']'", () => {
    try {
      parse('.users[');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(QueryError);
      const qe = e as QueryError;
      expect(qe.message).toContain("expected");
      expect(qe.render('.users[')).toContain('col 7');
      expect(qe.render('.users[')).toMatchSnapshot();
    }
  });

  it('errors on trailing pipe', () => {
    expect(() => parse('.a |')).toThrowError(QueryError);
  });

  it('errors on unclosed paren', () => {
    expect(() => parse('select(.a')).toThrowError(/expected '\)'/);
  });
});
