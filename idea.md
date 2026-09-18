# Project Name: tsjq — Typed JSON Query Library + CLI (mini-jq in TypeScript)

> Rename note: the old title "TypeSafe JSON Query CLI" was a misnomer.
> A CLI takes `string` queries at runtime where TS types are erased, so
> `strict: true` internals do not make the CLI "typesafe". This project earns
> the "Typed" label only via its library export with template-literal path
> types. The CLI itself is an untyped thin wrapper. Level: **intermediate**
> (was incorrectly listed under `01-beginner`).

## 1. Overview & Objective
- A zero-dependency TypeScript **library-first** tool with two surfaces:
  1. **Typed library** `get<T, P>(data, path)` — compile-time checked paths
     with autocomplete + inferred return type for the simple path subset
     (dot access, numeric index, `[]` iteration). This is the actual value
     prop vs `jq`/`fx`.
  2. **CLI** `tsjq '<query>' [file]` — a small untyped jq-subset interpreter
     for inspecting logs, API responses, configs without throwaway scripts.
- Additional differentiator: `--infer-type` / `--to-zod` turns any query
  result into a `type`/`interface` or Zod schema. This makes it a
  TypeScript-engineer tool (unknown API payload → usable types), not a
  slower `jq` clone.
- Non-goal (explicit): beating C `jq` / Go `gojq` on latency or RSS. Node has
  30–80 ms V8 boot overhead, so `xargs -n1 tsjq` loops will always lose to
  native binaries. Compete on typing + schema inference + npm integrability,
  not raw throughput.

## 2. Key Language Concepts Practiced
- Core TypeScript: `strict` + `noUncheckedIndexedAccess` +
  `exactOptionalPropertyTypes`, discriminated unions for `Token`/`ASTNode`,
  narrowing, `unknown` vs `any` discipline, generics.
- Type-level programming (library only): template literal types, recursive
  conditional types, `infer`, mapped types for `SimplePath<T>` /
  `PathValue<T, P>` (same family as lodash `Get`). Scoped to paths only —
  pipes/`select()`/`map()` are **not** typeable and fall back to `unknown[]`.
- Node.js + TS tooling: ESM, `node:fs/promises`, `node:readline`,
  `node:stream`, `tsconfig.json`, `tsx` dev, `npm` `bin` entry.
- Parsing fundamentals: lexer → recursive-descent parser → generator
  evaluator, span-tracked errors.
- Functional patterns: pure evaluators, `Generator<unknown>` for jq-style
  0-to-N fan-out (`yield*` flatMap chaining), immutable transforms.

## 3. Functional Requirements
- **Core library (Must-Have):**
  ```ts
  import { get, query } from 'tsjq';
  type Data = { users: { name: string; age: number }[] };
  declare const data: Data;
  const name = get(data, '.users[0].name'); // string, autocomplete-checked
  // @ts-expect-error — unknown key
  get(data, '.users[0].email');
  const out = query(data, '.users[] | select(.age > 20)'); // unknown[] — full language, untyped
  ```
  `get` supports only `.a.b`, `[n]`, `[-n]`, `[]`. Anything with `|`,
  `select`, `map`, `keys`, slices, comparisons must go through untyped
  `query()`. Two overloads, no pretending the full language is typed.
- **Core CLI (Must-Have):** JSON from file arg or stdin; query subset: dot
  access, `[n]`/`[-n]`, `[]`, `|`; `--compact` / `--indent 2`; field picking;
  span errors (`QueryError at col 7: expected ']'` + caret); exit codes
  `0` ok / `1` query error / `2` IO or JSON parse error; safe access on
  `null` → `null` (opt-in `--strict` throws).
- **Schema inference (Must-Have, the differentiator):**
  `--infer-type [--type-name Root]` emits a TS `type`; `--to-zod` emits a
  Zod schema. Inference merges object shapes across arrays/JSONL lines,
  widens `null`-able fields to `| null`, caps depth. Example:
  `cat api.json | tsjq '.users[0]' --infer-type` → `type Root = { name: string; age: number }`.
- **Stretch (Nice-to-Have):** builtins (`select`, `map`, `length`, `keys`,
  `sort_by`, slicing `.[1:3]`); `--from-file`; REPL; shell completions.
- **Streaming (scoped honestly):** streaming = **JSONL/NDJSON only**
  (`readline` + `JSON.parse` per line, constant memory). A single large
  standard-JSON document (e.g. 2 GB `[{...},...]`) can **not** stream with
  `JSON.parse` — that needs a SAX parser (`stream-json`/`clarinet`) and is
  explicitly out of scope. Document this; do not claim "JSON streaming".

## 4. Suggested Architecture & Modules
- File breakdown:
  ```
  src/
    cli.ts          # arg parsing, stdin/file resolution, exit codes
    lexer.ts        # query string -> Token[]
    parser.ts       # Token[] -> QueryAST
    evaluator.ts    # QueryAST + unknown -> Generator<unknown, void> (yield* pipeline)
    builtins.ts     # select, map, length, keys, sort_by
    typed.ts        # get<T,P> + SimplePath<T> + PathValue<T,P> (path subset only)
    infer.ts        # JsonValue -> TS type string / Zod string
    io.ts           # readStdin(), readFileStream(), writeOutput()
    formatter.ts    # serialize with colors, compact/pretty
    errors.ts       # QueryError with span, JsonError
    types.ts        # JsonValue, Token, AST nodes
  tests/
    lexer.test.ts / parser.test.ts / evaluator.test.ts / typed.test.ts (type tests via expectTypeOf) / infer.test.ts / cli.test.ts
    fixtures/nested.json, large.jsonl
  ```
- Key types:
  ```ts
  type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
  type Token = { kind: 'dot'|'ident'|'index'|'pipe'|..., text: string, pos: number };
  type ASTNode = FieldAccess | Index | Wildcard | Pipe | Call | Literal | Compare;
  // Typed subset only — full language stays unknown[]:
  type SimplePath<T> = ...; // template-literal union, e.g. ".users[0].name" | ".users[]"
  type PathValue<T, P extends string> = ...;
  export function get<T, P extends SimplePath<T>>(data: T, path: P): PathValue<T, P>;
  export function query(data: unknown, q: string): unknown[];
  function evaluate(node: ASTNode, input: unknown): Generator<unknown, void>;
  class QueryError extends Error { constructor(msg: string, pos: number, hint?: string) }
  ```
- Data flow: `argv/stdin -> text -> JSON.parse (or per-line parse for .jsonl) -> lexer -> parser -> evaluator (lazy generator, pipe = flatMap via yield*) -> formatter -> stdout`. `typed.ts` bypasses lexer/parser entirely (direct property walk) — no runtime query parsing for `get()`.

## 5. Step-by-Step Implementation Roadmap
- **Milestone 1 — Typed `get` + dot-only CLI (the honest MVP):** `npm init`,
  `tsc --init --strict`, `vitest` + `tsx`; implement `types.ts` + `typed.ts`
  (`SimplePath`/`PathValue` for `.a.b` + `[n]` only) with `expectTypeOf`
  tests; implement `io.ts` + `formatter.ts` + dot-only CLI path.
  `echo '{"a":{"b":1}}' | tsjq '.a.b'` → `1`. Proves the "Typed" claim first.
- **Milestone 2 — Core query language:** lexer/parser for `[]`, negative
  index, pipes; generator evaluator (`Pipe` = `yield*` over upstream
  outputs — document Cartesian behavior, cap to this subset, no full jq
  backtracking); `--compact`, file arg, `isTTY` detection; 20+ evaluator tests.
- **Milestone 3 — Inference + errors + JSONL:** `infer.ts` (TS + Zod output);
  `unknown` validation, `--strict` flag, depth guard, JSONL streaming via
  `readline` with per-line budget, caret errors, exit codes, Windows quoting.
  Explicitly skip single-doc JSON streaming.
- **Milestone 4 — Testing & polish (no fake perf war):** `vitest --coverage`
  ≥85% for `typed`/`evaluator`/`infer`; snapshot CLI tests; RSS regression
  test (1 M JSONL lines <80 MB — regression guard, not a `jq` shootout);
  optional `0x`/clinic flamegraph for self-profiling only; `--help`,
  completions, README (with "Why not just use jq?" section), `npm pack`
  dry-run, ESLint + Prettier + CI.

## 6. Testing, Verification & Tooling
- Commands: strictest `tsc`: `tsc --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --noEmitOnError`. Dev: `npx tsx src/cli.ts '.users[0].name' data.json`. Build: `tsc -p tsconfig.json && node dist/cli.js '.a' data.json`. Type tests: `vitest --typecheck` + `expectTypeOf`.
- Debug/perf: `vitest`, `node --inspect`, `process.memoryUsage()` RSS guard in JSONL test. `clinic.js`/`0x` optional for own hotspots only — do not publish "vs jq" benchmarks as a goal; if measured, report Node boot cost honestly.
- Sample cases:
  - `{"user":{"name":"Ada"}}` + `.user.name` → `"Ada"`; `get()` infers `string`.
  - `{"items":[{"price":10},{"price":30}]}` + `.items[] | select(.price > 20)` → `{"price": 30}` via untyped `query()` only.
  - `[1,2,3,4]` + `.[1:3]` (stretch) → `[2,3]`.
  - `.users[` → stderr `QueryError at col 7: expected ']'`, exit `1`.
  - `{bad}` → stderr `JSON parse error at line 1`, exit `2`.
  - `ApiResponse` + `--infer-type` → `type ApiResponse = {...}`; `--to-zod` → `z.object({...})`.
  - JSONL: 1 M lines via stdin stays <80 MB RSS (JSONL only; single-doc big-array JSON is out of scope by design).
