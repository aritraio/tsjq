type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8];

export type Tail<T, D extends number = 8> = D extends 0
  ? ''
  : '' | TailNonEmpty<T, D>;

type TailNonEmpty<T, D extends number> = NonNullable<T> extends readonly (infer E)[]
  ? `[${number}]${Tail<E, Prev[D] & number>}` | `[]${Tail<E, Prev[D] & number>}`
  : NonNullable<T> extends object
    ? {
        [K in keyof NonNullable<T> & string]: `.${K}${Tail<NonNullable<T>[K], Prev[D] & number>}`;
      }[keyof NonNullable<T> & string]
    : never;

export type SimplePath<T, D extends number = 8> = D extends 0
  ? '.'
  :
      | '.'
      | (NonNullable<T> extends readonly (infer E)[]
          ? `.[${number}]${Tail<E, Prev[D] & number>}` | `.[]${Tail<E, Prev[D] & number>}`
          : NonNullable<T> extends object
            ? {
                [K in keyof NonNullable<T> & string]: `.${K}${Tail<NonNullable<T>[K], Prev[D] & number>}`;
              }[keyof NonNullable<T> & string]
            : never);

type BracketValue<T, Inside extends string, After extends string> = NonNullable<T> extends readonly (infer E)[]
  ? Inside extends ''
    ? After extends ''
      ? E[]
      : Array<PathValue<E, After>>
    : Inside extends `${number}`
      ? After extends ''
        ? E
        : PathValue<E, After>
      : never
  : never;

type FieldValue<T, F extends string, Rest extends string> = F extends keyof NonNullable<T>
  ? PathValue<NonNullable<T>[F], Rest>
  : never;

type PathValueAfterDot<T, Rest extends string> = Rest extends `[${infer Inside}]${infer After}`
  ? BracketValue<T, Inside, After>
  : Rest extends `${infer F}[${infer R}`
    ? F extends `${string}.${string}`
      ? Rest extends `${infer F2}.${infer R2}`
        ? FieldValue<T, F2, `.${R2}`>
        : never
      : FieldValue<T, F, `[${R}`>
    : Rest extends `${infer F}.${infer R}`
      ? FieldValue<T, F, `.${R}`>
      : FieldValue<T, Rest, ''>;

type PathValueNonNull<T, P extends string> = P extends ''
  ? T
  : P extends '.'
    ? T
    : P extends `.${infer Rest}`
      ? PathValueAfterDot<T, Rest>
      : P extends `[${infer Inside}]${infer After}`
        ? BracketValue<T, Inside, After>
        : never;

export type PathValue<T, P extends string> = Extract<T, null | undefined> extends never
  ? PathValueNonNull<T, P>
  : P extends '.'
    ? T
    : P extends ''
      ? T
      : PathValueNonNull<NonNullable<T>, P> | Extract<T, null | undefined>;

type PathSegment =
  | { type: 'field'; name: string }
  | { type: 'index'; index: number }
  | { type: 'wildcard' };

function parseTypedPath(path: string): PathSegment[] {
  if (path === '.' || path === '') return [];
  if (!path.startsWith('.')) {
    throw new Error(`Invalid path "${path}": must start with '.'`);
  }
  const segs: PathSegment[] = [];
  let i = 1;
  const n = path.length;
  const isIdentStart = (c: string): boolean => /[A-Za-z_$]/.test(c);
  const isIdentPart = (c: string): boolean => /[A-Za-z0-9_$]/.test(c);
  while (i < n) {
    const ch = path[i];
    if (ch === undefined) break;
    if (ch === '.') {
      i += 1;
      continue;
    }
    if (ch === '[') {
      const close = path.indexOf(']', i);
      if (close === -1) throw new Error(`Invalid path "${path}": missing ']'`);
      const inside = path.slice(i + 1, close);
      if (inside === '') {
        segs.push({ type: 'wildcard' });
      } else {
        if (!/^-?\d+$/.test(inside)) {
          throw new Error(`Invalid path "${path}": bad index [${inside}]`);
        }
        segs.push({ type: 'index', index: Number(inside) });
      }
      i = close + 1;
      continue;
    }
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < n) {
        const c = path[j];
        if (c === undefined || !isIdentPart(c)) break;
        j += 1;
      }
      segs.push({ type: 'field', name: path.slice(i, j) });
      i = j;
      continue;
    }
    throw new Error(`Invalid path "${path}": unexpected '${ch}' at col ${i}`);
  }
  return segs;
}

function walk(current: unknown, segs: PathSegment[]): unknown {
  if (segs.length === 0) return current;
  const first = segs[0];
  if (first === undefined) return current;
  const rest = segs.slice(1);
  if (current === null || current === undefined) return null;
  if (first.type === 'field') {
    if (typeof current === 'object' && !Array.isArray(current)) {
      const obj = current as Record<string, unknown>;
      if (!(first.name in obj)) return null;
      const v = obj[first.name];
      if (v === undefined) return null;
      return walk(v, rest);
    }
    return null;
  }
  if (first.type === 'index') {
    if (Array.isArray(current)) {
      let idx = first.index;
      if (idx < 0) idx = current.length + idx;
      if (idx < 0 || idx >= current.length) return null;
      const v: unknown = current[idx];
      if (v === undefined) return null;
      return walk(v, rest);
    }
    return null;
  }
  if (Array.isArray(current)) {
    if (rest.length === 0) return [...current];
    const out: unknown[] = [];
    for (const el of current) {
      out.push(walk(el, rest));
    }
    return out;
  }
  return null;
}

export function get<T, P extends SimplePath<T>>(data: T, path: P): PathValue<T, P> {
  const segs = parseTypedPath(path);
  const result = walk(data as unknown, segs);
  return result as PathValue<T, P>;
}
