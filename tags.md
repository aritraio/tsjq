# tags.md — Phase-wise Build Tags for tsjq

Use one tag per finished phase. Each tag = runnable state + tests green + docs updated. Commands assume `git init` done in this folder.

```bash
git init && git add . && git commit -m "chore: initial idea + docs"
```

## `phase-0-setup` — repo boots
- [ ] `npm init -y`, deps: `typescript vitest tsx @types/node eslint prettier`
- [ ] `tsconfig`: `strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noEmitOnError, verbatimModuleSyntax, module nodenext, target es2022`
- [ ] `package.json`: `type:module`, `bin`, scripts `dev/build/test/typecheck/lint`
- [ ] Empty `src/*.ts` + `tests/` compile: `tsc --noEmit` clean
- [ ] Done when: `npx tsx src/cli.ts --help` prints stub (exit 0)
```bash
git tag -a phase-0-setup -m "skeleton, strict tsconfig, help stub"
```

## `phase-1-types-errors` — shared vocabulary
- [ ] `src/types.ts`: `JsonValue, Token, ASTNode, Span, EvalOpts`
- [ ] `src/errors.ts`: `QueryError(msg,pos,hint)+render`, `JsonError(msg,line)`, exit-code mapping
- [ ] Tests: caret snapshot, `expected ']' at col 7` shape, exit 1 vs 2 mapping
- [ ] Done when: `vitest run tests/errors.test.ts` green
```bash
git tag -a phase-1-types-errors -m "JsonValue, Token, AST, QueryError spans"
```

## `phase-2-typed-get` — the "Typed" proof (do not skip ahead)
- [ ] Runtime `get()` walk: dot/index/negative/`[]`, missing→`null`
- [ ] Types `SimplePath<T>`, `PathValue<T,P>` (objects → arrays → `[]`; depth cap)
- [ ] `tests/typed.test.ts`: `expectTypeOf` infers `string/number/element`; bad path `@ts-expect-error`
- [ ] Manual: VS Code autocomplete screenshot/check
- [ ] Done when: `tsc --noEmit` + type tests green; demo `get(data,'.users[0].name'): string`
```bash
git tag -a phase-2-typed-get -m "typed get with template-literal paths"
```

## `phase-3-lexer` — query string → tokens
- [ ] `lex()` covers `. ident ."quoted" [n] [-n] [] [a:b] | ( ) , : strings numbers ops`, `pos` on every token
- [ ] Errors: bad char, unterminated `[`/string with col + hint
- [ ] Tests: ~10 exact token+pos cases + 3 error cases
- [ ] Done when: `vitest run tests/lexer.test.ts` green
```bash
git tag -a phase-3-lexer -m "span-accurate lexer"
```

## `phase-4-parser` — tokens → AST
- [ ] Recursive descent `pipe > compare > postfix > primary`; `span` on nodes
- [ ] `select(pred)`, literals, parens; errors `expected X at col N`
- [ ] Tests: AST snapshots for `.a.b`, `.arr[-1]`, `.items[] | select(.price > 20)`, 3 error snapshots
- [ ] Done when: parser snapshots green, no eval code yet
```bash
git tag -a phase-4-parser -m "recursive-descent parser with spans"
```

## `phase-5-evaluator` — AST → outputs
- [ ] `evaluate(): Generator` + `query()` collector; `Pipe` = `yield*` flatMap
- [ ] `select` + comparisons `> < >= <= == !=`; semantics frozen: missing/OOB→`null`, `strict`→throw, depth guard
- [ ] `builtins.ts`: at least `select`; stretch `length/keys/map` flagged separately
- [ ] Tests: 20+ evaluator cases (fan-out, pipe chain, null/OOB/negative/strict)
- [ ] Done when: `query({items:[{price:10},{price:30}]}, '.items[] | select(.price > 20)')` → `[{price:30}]`
```bash
git tag -a phase-5-evaluator -m "generator evaluator + select"
```

## `phase-6-cli` — usable tool
- [ ] `io.ts`: stdin/file/`--from-file`, `isTTY`, `JsonError` lines
- [ ] `formatter.ts`: `--compact/--indent`, multi-output one-per-line
- [ ] `cli.ts`: `tsjq [opts] '<q>' [file]`, `--compact --indent --jsonl --strict --help`, exits 0/1/2
- [ ] Tests: 5 CLI snapshots (stdout/stderr/exit); help text frozen
- [ ] Done when: MVP acceptance list in `docs/mvp.md` all pass
```bash
git tag -a phase-6-cli -m "MVP CLI: file/stdin, format, exit codes"
```

## `phase-7-infer` — differentiator
- [ ] `infer.ts`: `inferType` + `inferZod`, key-union merge, `?` + `| null`, array merge, depth cap, sorted keys
- [ ] CLI `--infer-type [--type-name]`, `--to-zod` wired to query result
- [ ] Tests: snapshots (nested, mixed array shapes, nullables, empty array, deep cap); emitted type compiles
- [ ] Done when: `tsjq '.users[0]' api.json --infer-type` pastes into editor and typechecks
```bash
git tag -a phase-7-infer -m "TS + Zod schema inference"
```

## `phase-8-streaming` — JSONL hardening
- [ ] `--jsonl` / `.jsonl`: `readline` per-line parse→eval→print, O(1 line); per-line errors to stderr with line no, continue
- [ ] Document: single-doc big-array JSON NOT streaming (out of scope)
- [ ] RSS regression test: 100k-line JSONL child-process run under budget; 1M variant behind `TSJQ_BIG=1`
- [ ] Done when: streaming test green, memory flat
```bash
git tag -a phase-8-streaming -m "JSONL constant-memory mode + RSS guard"
```

## `v0.1.0` — release
- [ ] ESLint+Prettier clean, coverage ≥85% on `typed/evaluator/infer`
- [ ] README examples verified, `--help` snapshot, `npm pack` dry-run, CI green
- [ ] Optional `0x` self-profile notes (no jq shootout claims)
- [ ] Done when: fresh-clone `npm ci && npm test && npm run build` passes
```bash
git tag -a v0.1.0 -m "tsjq 0.1: typed get + mini-jq CLI + infer"
```

## Stretch tags (only after v0.1.0)
`stretch-slice` (`.[1:3]`) · `stretch-builtins` (`map/keys/sort_by/group_by`) · `stretch-repl` · `stretch-completions`
