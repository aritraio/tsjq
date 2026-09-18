import { describe, expect, it } from 'vitest';
import { evaluate, query } from '../src/evaluator.js';
import { parse } from '../src/parser.js';

describe('evaluator-extra', () => {
  it('slice arrays and strings', () => {
    expect(query([1, 2, 3, 4], '.[1:3]')).toEqual([[2, 3]]);
    expect(query([1, 2, 3], '.[1:]')).toEqual([[2, 3]]);
    expect(query([1, 2, 3], '.[:2]')).toEqual([[1, 2]]);
    expect(query('hello', '.[1:3]')).toEqual(['el']);
    expect(query({ a: 1 }, '.[0:1]')).toEqual([null]);
  });

  it('strict slice throws on non-array', () => {
    expect(() => query({ a: 1 }, '.[0:1]', { strict: true })).toThrowError(/slice/);
  });

  it('depth guard triggers', () => {
    expect(() => query({ a: { b: 1 } }, '.a.b', { depthLimit: 0 })).toThrowError(/depth/);
  });

  it('unknown function errors', () => {
    expect(() => query({ a: 1 }, 'nosuchfn(.a)')).toThrowError(/unknown function/);
  });

  it('select arity errors', () => {
    expect(() => query({ a: 1 }, 'select()')).toThrowError(/exactly one/);
    expect(() => query({ a: 1 }, 'select(.a, .b)')).toThrowError(/exactly one/);
  });

  it('string comparisons', () => {
    expect(query({ a: 'b' }, 'select(.a > "a")')).toEqual([{ a: 'b' }]);
    expect(query({ a: 'a' }, 'select(.a < "b")')).toEqual([{ a: 'a' }]);
  });

  it('mismatched compare returns false', () => {
    expect(query({ a: 1 }, 'select(.a > "x")')).toEqual([]);
  });

  it('literals true/false/null', () => {
    expect(query(null, 'select(. == null)')).toEqual([null]);
    expect(query(true, 'select(. == true)')).toEqual([true]);
  });
});
