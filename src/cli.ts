#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(`tsjq — Typed JSON Query Library + CLI
Usage: tsjq [opts] '<query>' [file]
  --compact          compact output
  --indent <n>       indent spaces (default 2)
  --jsonl            treat input as JSONL
  --strict           throw on null/undefined instead of null
  --from-file <f>    read query from file
  --infer-type       emit TypeScript type
  --to-zod           emit Zod schema
  --type-name <n>    type name for --infer-type (default Root)
  --help             show this help`);
  process.exit(0);
}
console.error('tsjq: not yet implemented (phase-0 stub)');
process.exit(2);
