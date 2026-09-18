# Walkthrough Plan — tsjq (traced examples + demo script)

Use this to learn the code path cold and to demo without fumbling. Three traces + a 3-minute script.

## Trace 1 — `.users[0].name` (dot + index, single output)

Input: `{"users":[{"name":"Ada"},{"name":"Bo"}]}`
1. **Lexer:** `".users[0].name"` → `[{dot,0},{ident users,1},{lbracket,6},{number 0,7},{rbracket,8},{dot,9},{ident name,10},{eof,14}]`. Positions are column offsets.
2. **Parser:** `pipe(postfix(field users → index 0 → field name))`. AST: `Field(users) → Index(0) → Field(name)` chained as nested postfix (or left-assoc pipe-free chain — freeze in code).
3. **Evaluator:** `root` yields whole doc → `field users` yields array → `index 0` yields `{name:Ada}` → `field name` yields `"Ada"`. One `yield` per stage, one final output.
4. **Formatter:** `JSON.stringify("Ada")` → `"Ada"` + newline.
5. **Typed twin:** `get(data, '.users[0].name')` never touches lexer/parser — splits to `['users',0,'name']`, walks, returns `string` (type from `PathValue`).

## Trace 2 — `.items[] | select(.price > 20)` (fan-out + filter)

Input: `{"items":[{"price":10},{"price":30}]}`
1. **Parser:** `Pipe(left=Postfix(field items → wildcard), right=Call(select,[Compare(field price, >, 20)]))`.
2. **Evaluator:** `left` on root yields `10-obj`, then `30-obj` (two yields from `yield* input`). `Pipe` loops: for each, run `right`. `select` runs predicate `evaluate(.price > 20)` per item: `10>20` false → yields nothing; `30>20` true → yields item. Net: one output `{"price":30}` from two intermediate inputs. This is the Cartesian/flatMap behavior: N upstream × M downstream.
3. **CLI:** prints one JSON doc. With `--jsonl` over 1M lines, this loop repeats per line with no cross-line state.

## Trace 3 — `--infer-type` (result → type string)

Command: `echo '{"users":[{"name":"Ada","age":36}]}' | tsjq '.users[0]' --infer-type --type-name User`
1. Evaluator produces `{"name":"Ada","age":36}`.
2. `inferType(value,'User')`: walk — object → keys sorted `[age,name]` → `age: number` (typeof), `name: string` → emit `type User = {\n  age: number;\n  name: string;\n};`.
3. Harder case: `[{a:1},{a:1,b:'x'},null]` → merged keys `{a,b}` → `a: number` (present always), `b?: string` (missing once → optional), top `| null` if nulls present. Arrays merge element shapes; cap depth → `unknown`.
4. `--to-zod` mirrors: `z.object({ age: z.number(), name: z.string() })`.

## 3-Minute Demo Script (memorize)
1. (30s) Editor: `get(data, '.users[0].` → autocomplete pops; complete `.name` → hover shows `string`; type `.email` → red squiggle. "That's the Typed claim — compiler-checked, not `strict:true` theater."
2. (60s) Terminal: `echo '{"a":{"b":1}}' | tsjq '.a.b'` → `1`; `.users[0].name` on fixture; `.items[] | select(.price > 20)` → filtered doc; `.users[` → caret error, `echo $?` → `1`.
3. (60s) Inference loop: `tsjq '.users[0]' api.json --infer-type` → paste output into editor as `type User`, then `get(user,'.')` completes from it. "Unknown API → usable types — that's why this isn't just slower jq."
4. (30s) Limitations slide: "JSONL streams, single-doc JSON doesn't; pipes are untyped; Node boots slower than jq — I compete on types, not throughput."
