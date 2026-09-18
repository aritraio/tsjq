import { describe, expect, it } from 'vitest';
import { inferType, inferZod } from '../src/infer.js';

describe('infer-extra', () => {
  it('handles undefined and mixed unions', () => {
    expect(inferType(undefined)).toContain('undefined');
    expect(inferType([1, 'x', null])).toContain('null');
    expect(inferType([])).toContain('unknown[]');
    expect(inferType({})).toContain('Record');
  });

  it('handles nested arrays and empty objects', () => {
    expect(inferType([[1, 2], [3]])).toContain('number');
    expect(inferType([{}, {}])).toContain('Record');
  });

  it('zod covers arrays, unions, optional, null', () => {
    expect(inferZod([])).toContain('z.array');
    expect(inferZod([1, 'x'])).toContain('z.union');
    expect(inferZod([{ a: 1 }, {}])).toContain('.optional()');
    expect(inferZod(null)).toBe('z.null()');
    expect(inferZod({ a: null })).toContain('z.null()');
    expect(inferZod({})).toContain('z.record');
  });

  it('uses custom type name safely', () => {
    expect(inferType({ a: 1 }, 'MyType')).toContain('type MyType =');
    expect(inferType({ a: 1 }, 'bad-name!')).toContain('type Root =');
  });
});
