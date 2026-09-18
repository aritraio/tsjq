# tsjq — Typed JSON Query Library + CLI

A zero-dependency TypeScript library + CLI for querying JSON. Think "mini-jq with types".

- **Typed library:** `get(data, '.users[0].name')` is compile-time checked with autocomplete and infers `string`.
- **Untyped CLI:** `tsjq '.users[] | select(.age > 20)' data.json` for logs, API responses, configs.
- **Schema inference:** `tsjq '.users[0]' --infer-type` → TS `type`; `--to-zod` → Zod schema.

> Honest scope: the CLI itself is **not** typesafe (runtime strings can't be — TS types are erased). The word "Typed" refers only to the `get()` library API. Streaming is **JSONL only**. This is an **intermediate** project, not beginner. We do not try to beat C `jq` on speed.

## Why not just use jq?

| If you need... | Use |
|---|---|
| Fastest text-stream filtering in shell loops | `jq` / `gojq` (C/Go, no V8 boot cost) |
| Interactive exploration | `fx`, `jless` |
| Typed access + inference inside a TS codebase | `tsjq` — `get()` + `--infer-type` / `--to-zod` |

Node costs 30–80 ms boot. `cat urls.txt | xargs -n1 tsjq` will always lose to `jq`. `tsjq` wins when you consume unknown JSON in TypeScript and want compiler-checked paths and generated types.

## Install & Run

```bash
npm i -g tsjq        # after publish; during dev use npx tsx
# dev:
npx tsx src/cli.ts '.users[0].name' data.json
# build:
tsc -p tsconfig.json && node dist/cli.js '.a' data.json
```

## Usage

```bash
# file or stdin, pretty by default
tsjq '.users[0].name' data.json
echo '{"a":{"b":1}}' | tsjq '.a.b'
cat logs.jsonl | tsjq '.level' --jsonl
cat logs.jsonl | tsjq 'select(.level == "error")' --jsonl

# formatting
tsjq '.a' data.json --compact
tsjq '.a' data.json --indent 2

# query from file, strict null handling
tsjq --from-file query.txt data.json
tsjq '.a.b' data.json --strict   # throw on null/undefined instead of null

# schema inference (the differentiator)
cat api.json | tsjq '.users[0]' --infer-type --type-name User
cat api.json | tsjq '.users[0]' --to-zod

# errors + exit codes: 0 ok, 1 query error, 2 IO/JSON error
tsjq '.users[' data.json  # stderr: QueryError at col 7: expected ']' + caret, exit 1
```

Query subset (v1):

```
.  .a  .a.b  .arr[0]  .arr[-1]  .items[]  expr | expr
select(.price > 20)  map(.)  length  keys  .[1:3] (stretch)
```

Anything with `|` / `select` / `map` is **untyped** — use `query()`, not `get()`.

## Library

```ts
import { get, query } from 'tsjq';

type Data = { users: { name: string; age: number }[] };
declare const data: Data;

const name = get(data, '.users[0].name'); // string, autocomplete
// @ts-expect-error
get(data, '.users[0].email'); // compile error

// full language: runtime strings, returns unknown[]
const adults = query(data, '.users[] | select(.age > 20)');
```

`get()` supports only `.a.b`, `[n]`, `[-n]`, `[]`. It does a direct property walk — no lexer/parser at runtime.

## Project Layout

```
src/
  index.ts typed.ts evaluator.ts lexer.ts parser.ts builtins.ts
  infer.ts cli.ts io.ts formatter.ts errors.ts types.ts
tests/
  typed.test.ts lexer.test.ts parser.test.ts evaluator.test.ts
  infer.test.ts cli.test.ts fixtures/
docs/
  architecture.md implementation-plan.md mvp.md walkthrough.md
tasks.md explanation.md idea.md
```

See `docs/architecture.md` for module contracts, `docs/mvp.md` for the minimal slice, `docs/implementation-plan.md` for build order, `docs/walkthrough.md` for traced examples, `tasks.md` for phase checklists, `explanation.md` for interview prep.

## Limitations (by design)

1. No single-doc JSON streaming. A 2 GB `[{...}]` needs a SAX parser — out of scope. Use JSONL for big data.
2. No full jq backtracking. `Pipe` is `yield*` flatMap over the documented subset.
3. No typed pipes. Template-literal types cannot type `select`/`map`/comparisons.
4. Depth-capped inference. Recursive/circular payloads emit `unknown` past the cap.
