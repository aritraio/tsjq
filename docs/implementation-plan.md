# Implementation Plan — tsjq (step-by-step)

Order matters: types first (proves the name), then parser, then CLI, then inference. Don't build REPL before `get()` compiles.

## Phase 0 — Setup (0.5 day)

1. `npm init -y; npm i -D typescript vitest tsx @types/node eslint prettier`
2. `tsc --init` then set: `strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noEmitOnError, verbatimModuleSyntax, module nodenext, target es2022`.
3. `package.json`: `type: module`, `bin: {tsjq: dist/cli.js}`, scripts: `dev, build, test, typecheck, lint`.
4. Skeleton `src/*.ts` + `tests/fixtures/` + `tsconfig` green on empty exports.
5. Tag: `phase-0-setup`.

## Phase 1 — `types.ts` + `errors.ts` (0.5 day)

1. `JsonValue`, `Token`, `ASTNode`, `Span`, `EvalOpts { strict, depthLimit }`.
2. `QueryError(msg,pos,hint)` with `render(query)` caret; `JsonError(msg,line)`.
3. Tests: caret rendering snapshot, exit-code mapping.
4. Tag: `phase-1-types-errors`.

## Phase 2 — `typed.ts` (1–2 days, the hard type day)

1. Runtime `get()`: regex walk, `null` on missing, negative index, `[]` flatten. ~30 lines.
2. Types: `SimplePath<T>` then `PathValue<T,P>`. Start with objects only, add arrays, then `[]`, then `noUncheckedIndexedAccess` (`| undefined`) handling. Keep depth cap (e.g. 8 levels) to save compiler.
3. Tests with `expectTypeOf`: valid paths infer, invalid paths `@ts-expect-error`. Manual VS Code autocomplete check.
4. Common trap: infinite type recursion — add base case `''` and test on 3-deep fixture before 6-deep.
5. Tag: `phase-2-typed-get`.

## Phase 3 — `lexer.ts` (0.5–1 day)

1. `lex(q): Token[]` with `pos` tracking. Cover: `. ident ."quoted" [n] [-n] [] [a:b]* | ( ) , : 'str' "str" ops`.
2. Tests: exact token+pos arrays for ~10 queries + 3 error cases (unterminated `[`, string, bad char).
3. Tag: `phase-3-lexer`.

## Phase 4 — `parser.ts` (1 day)

1. Recursive descent: `parsePipe > parseCompare > parsePostfix > parsePrimary`. Build `span`s.
2. `select(...)` as `call` with one predicate arg; literals `null/true/false/number/string`.
3. Tests: AST snapshots for `.a.b`, `.arr[-1]`, `.items[] | select(.price > 20)`, error `expected ']' at col 7`.
4. Tag: `phase-4-parser`.

## Phase 5 — `evaluator.ts` + `builtins.ts` (1–2 days)

1. `evaluate(node,input): Generator` per architecture §3.4. `query()` collector.
2. `select` first (unblocks MVP pipes), then `length/keys/map` as stretch.
3. Edge semantics to freeze: missing → `null` (or throw if `strict`); OOB index → `null`; `[]` on non-array → `null`; depth guard; `==` uses `JSON.stringify` equality for objects (document).
4. Tests: 20+ cases — dot chain, indexes, negative, `[]` fan-out, pipe chaining, select all six ops, null propagation, strict-throw mode.
5. Tag: `phase-5-evaluator`.

## Phase 6 — `io.ts` + `formatter.ts` + `cli.ts` (1 day)

1. `io`: stdin/file/`--from-file`, `readJsonLines` via `readline`, `isTTY` check, `JsonError` line numbers.
2. `formatter`: `compact` vs `indent`, multi-output as one-JSON-per-line.
3. `cli`: manual arg parse, `--compact --indent --jsonl --strict --help`, error→stderr+exit code. Freeze help text early (snapshot it).
4. Tests: 5 CLI snapshots (stdout, stderr, exit codes) + Windows-quote note.
5. Tag: `phase-6-cli`.

## Phase 7 — `infer.ts` (1 day)

1. `inferType` + `inferZod` per architecture §3.7. Key set union, optional detection, `| null`, array merge, depth cap, sorted keys.
2. Wire `--infer-type [--type-name]` / `--to-zod` in CLI (operate on query result, not raw input).
3. Tests: snapshots for nested object, array-of-mixed-shapes, nullables, empty array, deep cap.
4. Tag: `phase-7-infer`.

## Phase 8 — JSONL + hardening (0.5–1 day)

1. `--jsonl` end-to-end streaming: per-line parse→eval→print, no array buffering. Per-line errors go to stderr with line number, continue (document).
2. RSS regression test: generate 100k-line JSONL, run CLI as child, assert RSS under budget; 1M-line variant behind `TSJQ_BIG=1`.
3. Tag: `phase-8-streaming`.

## Phase 9 — Polish & release (0.5–1 day)

ESLint+Prettier clean, README examples verified by script, `--help` snapshot, `npm pack` dry-run, CI (typecheck+test+lint), coverage ≥85% on `typed/evaluator/infer`. Optional `0x` self-profile (no jq shootout). Tag `v0.1.0`.

## Build Commands (used every phase)

`npx tsx src/cli.ts '<q>' data.json` · `vitest run` · `tsc --noEmit` · `eslint .` · `node --inspect` for generator bugs.
