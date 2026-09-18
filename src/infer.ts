const MAX_DEPTH = 10;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function safeKey(k: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k)) return k;
  return JSON.stringify(k);
}

function needsParens(t: string): boolean {
  return t.includes('|');
}

function inferUnionTs(values: unknown[], depth: number): string {
  if (values.length === 0) return 'unknown';
  if (depth > MAX_DEPTH) return 'unknown';
  const nonNull = values.filter((v) => v !== null && v !== undefined);
  const hasNull = values.some((v) => v === null);
  const hasUndefined = values.some((v) => v === undefined);
  if (nonNull.length === 0) {
    if (hasNull && hasUndefined) return 'null | undefined';
    if (hasNull) return 'null';
    return 'undefined';
  }
  if (nonNull.every(isPlainObject)) {
    const merged = mergedObjectTs(nonNull as Record<string, unknown>[], depth);
    let base = merged;
    if (hasNull) base = `${base} | null`;
    if (hasUndefined) base = `${base} | undefined`;
    return base;
  }
  const parts = [...new Set(nonNull.map((v) => tsType(v, depth)))].sort();
  if (hasNull) parts.push('null');
  if (hasUndefined) parts.push('undefined');
  const uniq = [...new Set(parts)].sort();
  if (uniq.length === 1) {
    const first = uniq[0];
    if (first === undefined) return 'unknown';
    return first;
  }
  return uniq.join(' | ');
}

function mergedObjectTs(objs: Record<string, unknown>[], depth: number): string {
  if (depth > MAX_DEPTH) return 'unknown';
  const allKeys = [...new Set(objs.flatMap((o) => Object.keys(o)))].sort();
  if (allKeys.length === 0) return 'Record<string, unknown>';
  const fields = allKeys.map((k) => {
    const present = objs.filter((o) => k in o);
    const values = present.map((o) => (o as Record<string, unknown>)[k]);
    const optional = present.length < objs.length;
    const t = inferUnionTs(values as unknown[], depth + 1);
    return `${safeKey(k)}${optional ? '?' : ''}: ${t};`;
  });
  return `{ ${fields.join(' ')} }`;
}

function tsType(v: unknown, depth: number): string {
  if (depth > MAX_DEPTH) return 'unknown';
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (Array.isArray(v)) {
    if (v.length === 0) return 'unknown[]';
    if (v.every(isPlainObject)) {
      const merged = mergedObjectTs(v as Record<string, unknown>[], depth + 1);
      return `${merged}[]`;
    }
    const elem = inferUnionTs(v as unknown[], depth + 1);
    return `${needsParens(elem) ? `(${elem})` : elem}[]`;
  }
  if (isPlainObject(v)) {
    const keys = Object.keys(v).sort();
    if (keys.length === 0) return 'Record<string, unknown>';
    const fields = keys.map((k) => {
      const val: unknown = (v as Record<string, unknown>)[k];
      return `${safeKey(k)}: ${tsType(val, depth + 1)};`;
    });
    return `{ ${fields.join(' ')} }`;
  }
  if (typeof v === 'string') return 'string';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  return 'unknown';
}

export function inferType(value: unknown, typeName = 'Root'): string {
  const safe = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(typeName) ? typeName : 'Root';
  return `type ${safe} = ${tsType(value, 0)};`;
}

function inferUnionZod(values: unknown[], depth: number): string {
  if (depth > MAX_DEPTH) return 'z.unknown()';
  if (values.length === 0) return 'z.unknown()';
  const nonNull = values.filter((v) => v !== null && v !== undefined);
  const hasNull = values.some((v) => v === null);
  const hasUndefined = values.some((v) => v === undefined);
  let base: string;
  if (nonNull.length === 0) {
    if (hasNull && hasUndefined) return 'z.union([z.null(), z.undefined()])';
    if (hasNull) return 'z.null()';
    return 'z.undefined()';
  }
  if (nonNull.every(isPlainObject)) {
    base = mergedObjectZod(nonNull as Record<string, unknown>[], depth);
  } else {
    const parts = [...new Set(nonNull.map((v) => zodType(v, depth)))].sort();
    base = parts.length === 1 ? (parts[0] ?? 'z.unknown()') : `z.union([${parts.join(', ')}])`;
  }
  const extras: string[] = [];
  if (hasNull) extras.push('z.null()');
  if (hasUndefined) extras.push('z.undefined()');
  if (extras.length === 0) return base;
  return `z.union([${[base, ...extras].join(', ')}])`;
}

function mergedObjectZod(objs: Record<string, unknown>[], depth: number): string {
  if (depth > MAX_DEPTH) return 'z.unknown()';
  const allKeys = [...new Set(objs.flatMap((o) => Object.keys(o)))].sort();
  if (allKeys.length === 0) return 'z.record(z.unknown())';
  const fields = allKeys.map((k) => {
    const present = objs.filter((o) => k in o);
    const values = present.map((o) => (o as Record<string, unknown>)[k]);
    const optional = present.length < objs.length;
    let t = inferUnionZod(values as unknown[], depth + 1);
    if (optional) t = `${t}.optional()`;
    return `${safeKey(k)}: ${t}`;
  });
  return `z.object({ ${fields.join(', ')} })`;
}

function zodType(v: unknown, depth: number): string {
  if (depth > MAX_DEPTH) return 'z.unknown()';
  if (v === null) return 'z.null()';
  if (v === undefined) return 'z.undefined()';
  if (Array.isArray(v)) {
    if (v.length === 0) return 'z.array(z.unknown())';
    if (v.every(isPlainObject)) {
      return `z.array(${mergedObjectZod(v as Record<string, unknown>[], depth + 1)})`;
    }
    return `z.array(${inferUnionZod(v as unknown[], depth + 1)})`;
  }
  if (isPlainObject(v)) {
    const keys = Object.keys(v).sort();
    if (keys.length === 0) return 'z.record(z.unknown())';
    const fields = keys.map((k) => {
      const val: unknown = (v as Record<string, unknown>)[k];
      return `${safeKey(k)}: ${zodType(val, depth + 1)}`;
    });
    return `z.object({ ${fields.join(', ')} })`;
  }
  if (typeof v === 'string') return 'z.string()';
  if (typeof v === 'number') return 'z.number()';
  if (typeof v === 'boolean') return 'z.boolean()';
  return 'z.unknown()';
}

export function inferZod(value: unknown): string {
  return zodType(value, 0);
}
