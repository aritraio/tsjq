import { describe, expect, it } from 'vitest';
import { inferType, inferZod } from '../src/infer.js';

describe('infer', () => {
  it('infers nested object', () => {
    const s = inferType({ name: 'Ada', age: 36 }, 'User');
    expect(s).toContain('type User =');
    expect(s).toContain('name: string');
    expect(s).toContain('age: number');
    expect(s).toMatchSnapshot();
  });

  it('merges array of mixed shapes with optional', () => {
    const s = inferType([{ a: 1 }, { a: 1, b: 'x' }]);
    expect(s).toContain('a: number');
    expect(s).toContain('b?: string');
    expect(s).toMatchSnapshot();
  });

  it('widens nullables', () => {
    const s = inferType({ a: 1, b: null });
    expect(s).toContain('b: null');
    const s2 = inferType([{ a: 1 }, { a: null }]);
    expect(s2).toContain('null');
  });

  it('handles empty array', () => {
    expect(inferType([])).toContain('unknown[]');
  });

  it('caps depth', () => {
    let deep: unknown = 1;
    for (let i = 0; i < 20; i += 1) deep = { v: deep };
    const s = inferType(deep);
    expect(s).toContain('unknown');
  });

  it('emits zod', () => {
    const s = inferZod({ name: 'Ada', age: 36 });
    expect(s).toContain('z.object');
    expect(s).toContain('z.string()');
    expect(s).toContain('z.number()');
    expect(s).toMatchSnapshot();
  });

  it('emitted type is deterministic (sorted keys)', () => {
    const a = inferType({ z: 1, a: 2 });
    const b = inferType({ a: 2, z: 1 });
    expect(a).toBe(b);
  });
});
