export function isTruthyValue(v: unknown): boolean {
  return v !== false && v !== null;
}

export function deepEqualValues(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a === 'object' && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

export function compareValues(op: string, left: unknown, right: unknown): boolean {
  if (op === '==') return deepEqualValues(left, right);
  if (op === '!=') return !deepEqualValues(left, right);
  if (typeof left === 'number' && typeof right === 'number') {
    if (op === '>') return left > right;
    if (op === '<') return left < right;
    if (op === '>=') return left >= right;
    if (op === '<=') return left <= right;
    return false;
  }
  if (typeof left === 'string' && typeof right === 'string') {
    if (op === '>') return left > right;
    if (op === '<') return left < right;
    if (op === '>=') return left >= right;
    if (op === '<=') return left <= right;
    return false;
  }
  return false;
}
