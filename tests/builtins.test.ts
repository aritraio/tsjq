import { describe, expect, it } from 'vitest';
import { compareValues, deepEqualValues, isTruthyValue } from '../src/builtins.js';

describe('builtins', () => {
  it('truthiness matches jq (only false/null falsy)', () => {
    expect(isTruthyValue(false)).toBe(false);
    expect(isTruthyValue(null)).toBe(false);
    expect(isTruthyValue(0)).toBe(true);
    expect(isTruthyValue('')).toBe(true);
    expect(isTruthyValue([])).toBe(true);
    expect(isTruthyValue(undefined)).toBe(true);
  });

  it('deepEqual handles primitives and objects', () => {
    expect(deepEqualValues(1, 1)).toBe(true);
    expect(deepEqualValues(1, '1')).toBe(false);
    expect(deepEqualValues(null, null)).toBe(true);
    expect(deepEqualValues(null, {})).toBe(false);
    expect(deepEqualValues({ a: 1 }, { a: 1 })).toBe(true);
    expect(deepEqualValues({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqualValues([1], [1])).toBe(true);
  });

  it('compare numbers and strings', () => {
    expect(compareValues('>', 3, 2)).toBe(true);
    expect(compareValues('<', 1, 2)).toBe(true);
    expect(compareValues('>=', 2, 2)).toBe(true);
    expect(compareValues('<=', 1, 2)).toBe(true);
    expect(compareValues('>', 'b', 'a')).toBe(true);
    expect(compareValues('<', 'a', 'b')).toBe(true);
    expect(compareValues('==', 1, 1)).toBe(true);
    expect(compareValues('!=', 1, 2)).toBe(true);
    expect(compareValues('>', 1, 'a')).toBe(false);
    expect(compareValues('>', 1, 2)).toBe(false);
  });
});
