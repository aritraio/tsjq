import { describe, expect, it } from 'vitest';
import { query } from '../src/evaluator.js';
import { evaluate } from '../src/evaluator.js';
import { parse } from '../src/parser.js';

function q(data: unknown, queryStr: string, opts?: { strict?: boolean }): unknown[] {
  return query(data, queryStr, opts);
}

describe('evaluator', () => {
  it('dot chain', () => {
    expect(q({ a: { b: 1 } }, '.a.b')).toEqual([1]);
  });

  it('root identity', () => {
    expect(q({ a: 1 }, '.')).toEqual([{ a: 1 }]);
  });

  it('index positive', () => {
    expect(q({ arr: [10, 20, 30] }, '.arr[1]')).toEqual([20]);
  });

  it('index negative', () => {
    expect(q({ arr: [10, 20, 30] }, '.arr[-1]')).toEqual([30]);
  });

  it('index OOB returns null', () => {
    expect(q({ arr: [1] }, '.arr[5]')).toEqual([null]);
  });

  it('index on non-array returns null', () => {
    expect(q({ a: 1 }, '.a[0]')).toEqual([null]);
  });

  it('wildcard fan-out', () => {
    expect(q({ items: [1, 2, 3] }, '.items[]')).toEqual([1, 2, 3]);
  });

  it('wildcard on non-array returns null', () => {
    expect(q({ a: 1 }, '.a[]')).toEqual([null]);
  });

  it('pipe chaining', () => {
    expect(q({ a: { b: { c: 42 } } }, '.a | .b | .c')).toEqual([42]);
  });

  it('pipe with fan-out', () => {
    expect(q({ items: [{ price: 10 }, { price: 30 }] }, '.items[] | .price')).toEqual([10, 30]);
  });

  it('canonical select >', () => {
    const data = { items: [{ price: 10 }, { price: 30 }] };
    expect(q(data, '.items[] | select(.price > 20)')).toEqual([{ price: 30 }]);
  });

  it('select <', () => {
    expect(q({ items: [{ price: 10 }, { price: 30 }] }, '.items[] | select(.price < 20)')).toEqual([
      { price: 10 },
    ]);
  });

  it('select >= and <=', () => {
    expect(q([1, 2, 3], '.[] | select(. >= 2)')).toEqual([2, 3]);
    expect(q([1, 2, 3], '.[] | select(. <= 2)')).toEqual([1, 2]);
  });

  it('select == and !=', () => {
    expect(q({ a: 1 }, 'select(.a == 1)')).toEqual([{ a: 1 }]);
    expect(q({ a: 1 }, 'select(.a != 1)')).toEqual([]);
    expect(q({ a: 'x' }, 'select(.a == "x")')).toEqual([{ a: 'x' }]);
  });

  it('select with deep equality', () => {
    expect(q({ a: { x: 1 } }, 'select(.a == .a)')).toEqual([{ a: { x: 1 } }]);
  });

  it('missing field returns null', () => {
    expect(q({ a: 1 }, '.b')).toEqual([null]);
    expect(q({ a: null }, '.a.b')).toEqual([null]);
  });

  it('null propagation through pipe', () => {
    expect(q({ a: null }, '.a | .b')).toEqual([null]);
  });

  it('strict throws on missing', () => {
    expect(() => q({ a: 1 }, '.b', { strict: true })).toThrowError(/missing field/);
    expect(() => q({ arr: [1] }, '.arr[5]', { strict: true })).toThrowError(/out of bounds/);
    expect(() => q({ a: 1 }, '.a[]', { strict: true })).toThrowError(/non-array/);
  });

  it('literals and parens', () => {
    expect(q({}, 'select(1 == 1)')).toEqual([{}]);
    expect(q({ a: 1 }, '(.a)')).toEqual([1]);
  });

  it('generator laziness', () => {
    const gen = evaluate(parse('.items[]'), { items: [1, 2] });
    expect(gen.next().value).toBe(1);
    expect(gen.next().value).toBe(2);
  });

  it('truthiness: only false/null are falsy', () => {
    expect(q(0, 'select(. == 0)')).toEqual([0]);
    expect(q(false, 'select(.)')).toEqual([]);
    expect(q(null, 'select(.)')).toEqual([]);
  });
});
