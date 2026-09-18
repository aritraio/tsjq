import { describe, expect, it } from 'vitest';
import { inferType, inferZod } from '../src/infer.js';

describe('infer-coverage', () => {
  it('covers undefined-only and boolean/unknown', () => {
    expect(inferZod({ a: undefined })).toContain('z.undefined()');
    expect(inferZod(true)).toBe('z.boolean()');
    expect(inferType(true)).toContain('boolean');
    const fn = (): void => {};
    expect(inferZod(fn)).toBe('z.unknown()');
    expect(inferType(fn)).toContain('unknown');
  });

  it('merges nested objects in zod unions', () => {
    const s = inferZod([{ a: { x: 1 } }, { a: { y: 2 } }]);
    expect(s).toContain('z.object');
  });

  it('unions null with number in zod', () => {
    const s = inferZod([{ a: 1 }, { a: null }]);
    expect(s).toContain('z.null()');
  });
});
