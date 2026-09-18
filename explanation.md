# explanation.md — Interview Guide for tsjq

Read this once, then speak from memory. Never claim what the project doesn't do. Interviewers probe honesty about limits more than features.

## 1. The 30-Second Pitch (memorize)

> "tsjq is a zero-dependency TypeScript library plus CLI for querying JSON. The library gives you `get(data, '.users[0].name')` where the path autocompletes and the return type infers as `string` — bad paths fail at compile time. The CLI is a small jq-subset — dot access, indexes, `[]` fan-out, pipes, `select` — for logs and API responses. And `tsjq '.users[0]' --infer-type` turns any result into a TypeScript type or Zod schema. So the loop is: unknown API payload in, usable types out. I explicitly don't compete with C jq on speed — Node boots slower — I compete on types."

## 2. The 2-Minute Version (add after pitch if asked "tell me more")

1. **Problem:** I kept writing throwaway scripts to inspect JSON logs and API responses, then hand-writing TS interfaces for the same payloads. jq solves the first half but knows nothing about my types.
2. **Two surfaces:** `get()` for safe paths inside code (template-literal types, direct walk, no parser at runtime), `query()` + CLI for ad-hoc runtime strings (lexer → parser → generator evaluator, returns `unknown[]`).
3. **Inference closes the loop:** query a sample, emit `type Root = {...}` or `z.object(...)`, paste it back, now `get()` autocompletes against it.
4. **Honest limits:** CLI strings can't be typesafe — types are erased at runtime. Pipes and `select` are untyped by design. Streaming is JSONL-only; a 2 GB single-array JSON still needs a SAX parser, which I scoped out. Node loses to jq in `xargs -n1` loops due to 30–80 ms boot.

## 3. Architecture in Plain Words

- **types.ts:** shared dictionary — `JsonValue`, `Token {kind,text,pos}`, `ASTNode` union, `Span`. Everything imports it; nothing clever in it.
- **typed.ts:** runtime is 30 lines (split path, walk object). Types are the product: `SimplePath<T>` builds the union of legal path strings recursively; `PathValue<T,P>` strips the path piece by piece with `infer` to compute the return type. Only handles dot/index/`[]`.
- **lexer → parser → evaluator:** `lex('.a[0]')` makes tokens with column numbers. `parse()` builds an AST with precedence `| < comparison < postfix`. `evaluate()` is a generator: each node `yield`s 0-to-N values. A pipe is just a loop — for every left output, `yield*` all right outputs. That's how `.items[] | select(...)` fans out then filters with no intermediate arrays.
- **infer.ts:** merges shapes — collect keys across array elements, mark missing keys optional, add `| null` if nulls seen, union element types, cap depth to `unknown`, sort keys for stable output.
- **cli/io/formatter/errors:** thin shell — read stdin or file (or line-by-line with `readline` for JSONL), parse JSON, run query, print. Errors carry columns and render with a caret; exit 0/1/2.

## 4. Demo Cheat Sheet (run in this order)

```bash
echo '{"a":{"b":1}}' | npx tsx src/cli.ts '.a.b'   # 1 — basic
npx tsx src/cli.ts '.users[0].name' data.json      # index
npx tsx src/cli.ts '.items[] | select(.price > 20)' data.json  # pipe+filter
npx tsx src/cli.ts '.users[' data.json; echo $?    # caret error, exit 1
npx tsx src/cli.ts '.users[0]' api.json --infer-type --type-name User
```

## 5. Tough Q&A (short answers to memorize)

**"If the CLI takes runtime strings, why call it TypeSafe?"**
> "Good catch — calling the CLI typesafe would be wrong, types are erased at runtime. Only `get()` with literal paths is checked. The CLI is intentionally untyped and returns `unknown[]`. I renamed the project to reflect that."

**"How do template-literal path types actually work?"**
> "`SimplePath<T>`: if T is an array, allow `[n]`/`[]` plus recursion into the element; if an object, map each key to `.key` plus recursion into the value. `PathValue<T,P>`: peel the first segment with `infer`, index into T, recurse on the rest. Depth-capped so the compiler terminates. Same family as lodash `Get`."

**"Why two APIs, `get` and `query`?"**
> "Because pipes and predicates aren't typeable — `select(.age > 20)` needs value-level logic the type system can't see. Forcing one API would mean lying about safety. `get` = safe subset, `query` = full power, honest types."

**"Why generators for evaluation?"**
> "jq semantics are 0-to-N: `.items[]` yields many values downstream. Generators give lazy fan-out — `yield*` chains without building arrays, and downstream `select` short-circuits naturally. A pipe is literally `for (v of left) yield* right(v)`."

**"Cartesian products / backtracking?"**
> "Nested `yield*` gives the Cartesian behavior for free on the subset I support. Full jq backtracking with variables and closures is out of scope — I document the subset instead of half-cloning jq."

**"Why does big JSON still OOM if you claim streaming?"**
> "I only claim JSONL streaming — one `JSON.parse` per line via `readline`, O(1 line). A single 2 GB `[{...}]` document can't stream with `JSON.parse`; that needs a SAX parser like `stream-json`, which I explicitly scoped out."

**"Node vs jq performance?"**
> "jq wins. V8 boot alone is 30–80 ms, so shell-loop micro-invocations look sluggish next to C/Go binaries. I don't benchmark against jq as a goal — my RSS test is a regression guard, and my value prop is types + inference + npm reuse, not throughput."

**"Why `unknown` instead of `any`?"**
> "Evaluator input is `unknown`, so every access narrows first (`typeof`, `Array.isArray`, `in`). With `strict` + `noUncheckedIndexedAccess`, indexing yields `T | undefined`, forcing the null path. `any` would silence exactly the bugs the project teaches."

**"How do span errors work?"**
> "Lexer records `pos` per token; parser keeps `Span{start,end}` per node; `QueryError` renders the query string plus a `^^^` caret line with a hint. JSON errors carry line numbers from the JSONL reader. Mapped to exit codes 1 and 2."

**"How does inference handle messy arrays?"**
> "Union the keys, optional-ize missing ones, `| null` if nulls appear, union element types, `unknown[]` for empty, `unknown` past the depth cap. Deterministic key sorting so snapshots are stable."

**"What's the hardest bug you hit?"**
> Pick one real one after building: (a) infinite type recursion fixed with `''` base case + depth cap; (b) negative-index typing under `noUncheckedIndexedAccess`; (c) pipe `yield*` swallowing errors — fixed by threading `EvalOpts.strict` through every `yield*` call. Tell it as STAR: situation, fix, test added.

**"What would you do with one more week?"**
> "`--to-zod` polish, slicing, `sort_by`, REPL history, `node --compile-cache`/single-executable packaging to cut boot, and a VS Code extension reusing `SimplePath` for JSON-path completion."

## 6. What NOT to Say
- Don't say "faster than jq", "streams any JSON", "fully typesafe queries", or "beginner project". All four fail follow-ups.
- Don't bluff on `clinic.js/0x` — say "optional self-profiling, not a jq shootout."
- If you don't know: "I scoped that out — here's how I'd approach it…" beats inventing.

## 7. One-Paragraph Resume Blurb (copy-paste)
> Built tsjq, a zero-dependency TypeScript JSON-query library + CLI: template-literal `get()` API with compile-time path checking and inferred returns, mini-jq runtime (lexer, recursive-descent parser, generator evaluator) for dot/index/`[]`/pipe/`select`, and `--infer-type`/`--to-zod` schema generation; JSONL constant-memory mode with RSS regression test; strict TS (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Vitest type + snapshot coverage.
