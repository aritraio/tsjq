# Architecture Plan — tsjq

## 1. Design Principles

1. **Library-first, CLI-thin.** `typed.ts` + `evaluator.ts` + `infer.ts` are pure and importable. `cli.ts` only parses args, reads input, calls them, prints.
2. **Two query surfaces, no lying.** `get()` = compile-time paths, direct walk, no parser. `query()` = runtime string language, lexer→parser→evaluator, returns `unknown[]`.
3. **Zero dependencies.** Only `node:*` stdlib so `npx` install stays trivial and boot stays minimal.
4. **Fail loudly with spans.** Every query error carries `pos` → caret rendering. JSON errors carry line. Exit codes are part of the contract.

## 2. System Overview

```
                    ┌──────────────┐
                    │   typed.ts   │  get<T,P>: direct walk, no parsing
                    │ SimplePath<T>│  PathValue<T,P> (type-level only)
                    └──────┬───────┘
                           │ JsonValue
┌─────┐  text   ┌────┐  JSON  ┌───────┐  Token[]  ┌────────┐  AST  ┌───────────┐  unknown[]  ┌───────────┐
│argv │ ──────▶ │io.ts│ ────▶ │lexer.ts│ ───────▶ │parser.ts│ ───▶ │evaluator.ts│ ─────────▶ │formatter.ts│ ──▶ stdout
│stdin│         │     │        │        │          │         │      │+builtins.ts│             │  infer.ts* │
└─────┘         └────┘        └───────┘          └────────┘      └───────────┘             └───────────┘
                           errors.ts (QueryError+span, JsonError) used by all stages
                           *infer.ts is a sink: takes evaluator output → string (TS/Zod)

JSONL mode: io.ts yields one line at a time via readline; the lexer→evaluator
chain runs per line; formatter streams. Memory O(1 line).
Single-doc JSON mode: one JSON.parse; no streaming claim.
```

## 3. Module Contracts

### 3.1 `types.ts` — shared vocabulary

```ts
export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [k: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type TokenKind =
  | 'dot'
  | 'ident'
  | 'lbracket'
  | 'rbracket'
  | 'number'
  | 'star'
  | 'pipe'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'colon'
  | 'string'
  | 'op'
  | 'eof';
export interface Token {
  kind: TokenKind;
  text: string;
  pos: number;
}

export type ASTNode =
  | { kind: 'root' }
  | { kind: 'field'; name: string; span: Span }
  | { kind: 'index'; index: number; span: Span } // negative allowed
  | { kind: 'wildcard' } // []
  | { kind: 'slice'; start?: number; end?: number } // stretch
  | { kind: 'pipe'; left: ASTNode; right: ASTNode }
  | { kind: 'call'; name: string; args: ASTNode[] } // select, map, length, keys
  | { kind: 'literal'; value: JsonValue }
  | { kind: 'compare'; op: '>' | '<' | '>=' | '<=' | '==' | '!='; left: ASTNode; right: ASTNode };
export interface Span {
  start: number;
  end: number;
}
```

Rules: `Token.pos` = column offset in query string. Every fallible node keeps `span` for caret errors. `strict` TS: no `any`, inputs are `unknown` until narrowed.

### 3.2 `lexer.ts` — `string -> Token[]`

Pure function `lex(q: string): Token[]`. Single pass, tracks `pos`. Responsibilities: `.` `|` `[]` `[n]` `[-n]` `[a:b]` identifiers, quoted keys `."a b"`, strings `'..'`/`".."`, numbers, comparison ops, parens/commas. Throws `QueryError(msg, pos, hint)` on bad char / unterminated bracket/string. Tested by exact token arrays including `pos`.

### 3.3 `parser.ts` — `Token[] -> ASTNode`

Recursive descent, precedence: `pipe (lowest) > compare > postfix (.a, [n], []) > primary (call, literal, paren)`.

```ts
parsePipe(): left=parsePostfix(); while peek=='pipe' { consume; right=parsePipe(); left={kind:'pipe',left,right} }
```

`select(.price > 20)` parses as `call('select',[compare(field(price),>,20)])`. Errors: `expected ']' at col 7`, `unexpected token '|'`, unclosed `(`. Every throw includes span. No evaluation here.

### 3.4 `evaluator.ts` — `AST x unknown -> Generator<unknown>`

Core semantic: jq-style 0-to-N fan-out.

```ts
export function* evaluate(node: ASTNode, input: unknown): Generator<unknown, void> {
  switch (node.kind) {
    case 'root': yield input; return;
    case 'field': if (isObj(input) && node.name in input) yield (input as JsonObject)[node.name]!; else yield strict ? throw : null; return;
    case 'index': /* arrays only, negative = len+n, OOB → null/throw */ break;
    case 'wildcard': if (Array.isArray(input)) yield* input; else yield strict ? throw : null; return;
    case 'pipe': for (const v of evaluate(node.left, input)) yield* evaluate(node.right, v); return; // flatMap
    case 'call': yield* builtins(node, input); return;
  }
}
export function query(data: unknown, q: string): unknown[] { return [...evaluate(parse(lex(q)), data)]; }
```

Why generators: `.items[] | select(...)` naturally fans out without intermediate arrays; downstream short-circuits. Cartesian behavior falls out of nested `yield*` — document it, don't fight it. Guards: `opts.strict`, `opts.depthLimit` (default ~100), circular-reference guard via ancestor `Set` for pathological inputs.

### 3.5 `builtins.ts`

`select(pred)`: filters — evaluates pred per input, keeps truthy. `map(f)`: collects `f` over array or single into array. `length`: string/array/object/number semantics. `keys`: sorted object keys. `sort_by(path)`: stable sort (stretch). All take `EvalOpts`, all pure.

### 3.6 `typed.ts` — the only "TypeSafe" part

Runtime is trivial (split path, walk); types do the work:

```ts
export type SimplePath<T> =
  T extends readonly (infer E)[] ? `[${number}]${SimplePath<E>}` | `[]${SimplePath<E>}` | ''
  : T extends object ? { [K in keyof T & string]: `.${K}${SimplePath<T[K]>}` | `.${K}` }[keyof T & string]
  : '';
export type PathValue<T, P extends string> = /* recursive strip of `.k`, `[n]`, `[]` with infer */;
export function get<T, P extends SimplePath<T>>(data: T, path: P): PathValue<T, P> {
  // runtime: tokenize /\.([A-Za-z_$][\w$]*)|\[(-?\d+)?\]/g, walk with null → null
}
```

Scope: dot + index + `[]` only. `[]` over `E[]` yields `E` (if downstream continues) — decide and freeze: `get(data,'.users[]')` returns `User` union flattened? Document choice. Negative index resolved at runtime, typed as `E | undefined` under `noUncheckedIndexedAccess`. Anything else is a compile error directing users to `query()`.

### 3.7 `infer.ts` — `unknown -> string`

```ts
export function inferType(value: unknown, name?: string): string; // "type Root = {...}"
export function inferZod(value: unknown): string; // "z.object({...})"
```

Algorithm: `merge(shapes[])` over array elements / JSONL sample (cap e.g. 100 lines). Objects: union key set; missing keys → optional `?`; `null` present → `| null`. Arrays: element union; empty → `unknown[]`. Primitives: `typeof` mapping, `number` → `number` (do not overfit to literal unless `as const` requested). Depth cap (default 10) → `unknown`. Sort keys for determinism. Snapshot-test outputs.

### 3.8 `io.ts` / `formatter.ts` / `cli.ts` / `errors.ts`

- `io.ts`: `readAllStdin(): Promise<string>`, `readFile(p)`, `async *readJsonLines(stream)` via `node:readline`. Detects `--jsonl` or `.jsonl` extension; per-line `JSON.parse` with `JsonError(lineNo)`. Never buffers whole JSONL.
- `formatter.ts`: `format(v, {compact, indent, color})` → `JSON.stringify(v,null,indent)`; multi-output (from `[]`) prints one doc per line in compact-JSONL style or pretty-separated — freeze choice early.
- `cli.ts`: manual arg parse (no deps): `tsjq [opts] '<query>' [file]`. Flags: `--compact --indent n --jsonl --from-file f --strict --infer-type --to-zod --type-name X --help`. Resolves stdin-vs-file via `process.stdin.isTTY`. Maps errors → exit codes.
- `errors.ts`: `QueryError(msg,pos,hint)` renders `query\n  ^^^ hint`; `JsonError(msg,line)`. Both carry `exitCode`.

## 4. Key Decisions & Tradeoffs

| Decision             | Why                                  | Cost                                               |
| -------------------- | ------------------------------------ | -------------------------------------------------- |
| No deps              | Easy install, minimal boot           | Hand-rolled args, no colors lib                    |
| Generators for eval  | Lazy fan-out, jq fidelity for subset | Callers must remember `query()` collects; document |
| Typed subset only    | Full language untypeable             | Two APIs to teach (`get` vs `query`)               |
| JSONL-only streaming | Honest; SAX parser out of scope      | Big single-array JSON still OOMs — documented      |
| No jq benchmark goal | Node boot 30–80 ms unwinnable        | Portfolio story is typing+inference, not speed     |

## 5. Testing Strategy

`vitest --typecheck`: unit (lexer exact tokens, parser AST shapes, evaluator 20+ cases incl. `null`/OOB/negative), type tests (`expectTypeOf(get(data,'.a'))` + `@ts-expect-error`), infer snapshots, CLI snapshots (stdout/stderr/exit code), RSS regression (spawn CLI on generated 100k-line JSONL, assert RSS < threshold; 1M-line variant behind env flag).
