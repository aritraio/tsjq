import { describe, expect, it } from 'vitest';
import { expectTypeOf } from 'vitest';
import { get } from '../src/typed.js';

type Data = {
  users: { name: string; age: number; tags: string[] }[];
  config: { db: { host: string; port: number } };
};

const data: Data = {
  users: [
    { name: 'Ada', age: 36, tags: ['admin'] },
    { name: 'Bo', age: 28, tags: [] },
  ],
  config: { db: { host: 'localhost', port: 5432 } },
};

describe('get types', () => {
  it('infers string for .users[0].name', () => {
    const v = get(data, '.users[0].name');
    expectTypeOf(v).toEqualTypeOf<string>();
    expect(v).toBe('Ada');
  });

  it('infers number for nested config', () => {
    const v = get(data, '.config.db.port');
    expectTypeOf(v).toEqualTypeOf<number>();
    expect(v).toBe(5432);
  });

  it('infers element and wildcard arrays', () => {
    const el = get(data, '.users[0]');
    expectTypeOf(el).toEqualTypeOf<{ name: string; age: number; tags: string[] }>();
    const names = get(data, '.users[].name');
    expectTypeOf(names).toEqualTypeOf<string[]>();
    expect(names).toEqual(['Ada', 'Bo']);
    const all = get(data, '.users[]');
    expect(all).toHaveLength(2);
  });

  it('handles negative index at runtime', () => {
    const v = get(data, '.users[-1].name');
    expect(v).toBe('Bo');
  });

  it('returns null on missing', () => {
    const v = get(data, '.users[99].name');
    expect(v).toBeNull();
  });

  it('rejects bad paths', () => {
    // @ts-expect-error — unknown key
    get(data, '.users[0].email');
    // @ts-expect-error — unknown top-level
    get(data, '.nope');
  });
});
