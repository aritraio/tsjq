import { compareValues, isTruthyValue } from './builtins.js';
import { QueryError } from './errors.js';
import { parse } from './parser.js';
import type { ASTNode, EvalOpts } from './types.js';
import { resolveEvalOpts } from './types.js';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function firstValue(gen: Generator<unknown, void>): unknown {
  for (const v of gen) return v;
  return undefined;
}

export function query(data: unknown, q: string, opts?: EvalOpts): unknown[] {
  const ast = parse(q);
  return [...evaluate(ast, data, opts)];
}

export function* evaluate(
  node: ASTNode,
  input: unknown,
  opts?: EvalOpts,
  depth = 0,
): Generator<unknown, void> {
  const resolved = resolveEvalOpts(opts);
  if (depth > resolved.depthLimit) {
    throw new QueryError('depth limit exceeded', node.span.start, 'query too deep');
  }
  const child = depth + 1;

  switch (node.kind) {
    case 'root': {
      yield input;
      return;
    }
    case 'field': {
      if (isObject(input) && node.name in input) {
        const v: unknown = (input as Record<string, unknown>)[node.name];
        if (v === undefined) {
          if (resolved.strict) throw new QueryError(`missing field '${node.name}'`, node.span.start);
          yield null;
          return;
        }
        yield v;
        return;
      }
      if (resolved.strict) {
        throw new QueryError(`missing field '${node.name}'`, node.span.start);
      }
      yield null;
      return;
    }
    case 'index': {
      if (Array.isArray(input)) {
        let idx = node.index;
        if (idx < 0) idx = input.length + idx;
        if (idx < 0 || idx >= input.length) {
          if (resolved.strict) throw new QueryError(`index ${node.index} out of bounds`, node.span.start);
          yield null;
          return;
        }
        const v: unknown = input[idx];
        if (v === undefined) {
          if (resolved.strict) throw new QueryError(`index ${node.index} out of bounds`, node.span.start);
          yield null;
          return;
        }
        yield v;
        return;
      }
      if (resolved.strict) throw new QueryError('cannot index non-array', node.span.start);
      yield null;
      return;
    }
    case 'wildcard': {
      if (Array.isArray(input)) {
        yield* input;
        return;
      }
      if (resolved.strict) throw new QueryError('cannot iterate non-array', node.span.start);
      yield null;
      return;
    }
    case 'slice': {
      if (Array.isArray(input)) {
        const len = input.length;
        let start = node.start ?? 0;
        let end = node.end ?? len;
        if (start < 0) start = len + start;
        if (end < 0) end = len + end;
        start = Math.max(0, Math.min(len, start));
        end = Math.max(0, Math.min(len, end));
        yield input.slice(start, Math.max(start, end));
        return;
      }
      if (typeof input === 'string') {
        const len = input.length;
        let start = node.start ?? 0;
        let end = node.end ?? len;
        if (start < 0) start = len + start;
        if (end < 0) end = len + end;
        start = Math.max(0, Math.min(len, start));
        end = Math.max(0, Math.min(len, end));
        yield input.slice(start, Math.max(start, end));
        return;
      }
      if (resolved.strict) throw new QueryError('cannot slice non-array', node.span.start);
      yield null;
      return;
    }
    case 'pipe': {
      for (const v of evaluate(node.left, input, resolved, child)) {
        yield* evaluate(node.right, v, resolved, child);
      }
      return;
    }
    case 'compare': {
      const l = firstValue(evaluate(node.left, input, resolved, child));
      const r = firstValue(evaluate(node.right, input, resolved, child));
      yield compareValues(node.op, l, r);
      return;
    }
    case 'literal': {
      yield node.value;
      return;
    }
    case 'call': {
      yield* evalCall(node.name, node.args, node, input, resolved, child);
      return;
    }
  }
}

function* evalCall(
  name: string,
  args: ASTNode[],
  node: ASTNode,
  input: unknown,
  opts: { strict: boolean; depthLimit: number },
  depth: number,
): Generator<unknown, void> {
  if (name === 'select') {
    if (args.length !== 1) {
      throw new QueryError('select() expects exactly one argument', node.span.start);
    }
    const pred = args[0];
    if (pred === undefined) throw new QueryError('select() expects exactly one argument', node.span.start);
    const result = firstValue(evaluate(pred, input, opts, depth + 1));
    if (isTruthyValue(result)) yield input;
    return;
  }
  throw new QueryError(`unknown function '${name}'`, node.span.start, 'unknown function');
}
