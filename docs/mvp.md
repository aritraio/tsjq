# MVP Definition — tsjq

## Goal
Prove the two claims in one demo: (1) `get()` is compile-time safe, (2) CLI answers real queries without scripts. Everything else is stretch.

## In Scope (must work for v1 demo)

1. **Typed `get()`** for `.a.b` + `[n]` + `[-n]` + `[]`.
   - `SimplePath<T>` autocomplete works in VS Code.
   - `PathValue<T,P>` infers correctly (`string`, `number`, element types).
   - Bad path = compile error. Runtime walk returns `null` on missing (or throws with `--strict` equivalent option).
2. **Untyped `query()` + CLI** for `.a.b`, `[n]`, `[-n]`, `[]`, `|`.
   - `echo '{"a":{"b":1}}' | tsjq '.a.b'` → `1`
   - `.users[0].name`, `.items[]`, `.items[] | .price`
   - `select(.price > 20)` with `> < >= <= == !=` (minimum predicate to make pipes meaningful).
   - `--compact` / `--indent`, file-or-stdin, exit codes 0/1/2, caret errors.
3. **`--infer-type`** (TS output). `--to-zod` may slip to v1.1 if time-pressed, but keep the flag stub with "not yet" error.
4. **JSONL read path**: `--jsonl` reads line-by-line, constant memory. Single-doc JSON uses plain `JSON.parse`.

## Out of Scope for MVP
`map`/`keys`/`length`/`sort_by`/`group_by`, slicing `.[1:3]`, arithmetic, string interpolation, `--from-file`, REPL, completions, colors, single-doc JSON streaming, perf flamegraphs, publish to npm (use `npx tsx`).

## Acceptance Checklist (demo script must pass)
- [ ] `npx tsx src/cli.ts '.user.name' <<< '{"user":{"name":"Ada"}}'` → `"Ada"`
- [ ] `query({items:[{price:10},{price:30}]}, '.items[] | select(.price > 20)')` → `[{price:30}]`
- [ ] `get(data, '.users[0].email')` fails `tsc` with readable error
- [ ] Hovering `get(data, '.users[0].…')` autocompletes in editor
- [ ] `.users[` → `QueryError at col 7` + caret on stderr, exit 1
- [ ] `{bad}` → `JSON parse error`, exit 2
- [ ] `tsc --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes` clean
- [ ] `vitest` green: ≥20 evaluator tests + type tests + 3 CLI snapshots
- [ ] `... | tsjq '.x' --infer-type` emits compilable `type Root = ...`

## What "Done" Looks Like
A 3-minute demo: show `get()` autocomplete + error in editor, run 4 CLI queries (dot, index, `[]`, pipe+select), pipe one result into `--infer-type`, paste the emitted type back into code and show `get()` completing against it. That loop is the whole portfolio story.
