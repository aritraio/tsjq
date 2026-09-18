#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { JsonError, QueryError, exitCodeFor } from './errors.js';
import { evaluate } from './evaluator.js';
import { formatValue } from './formatter.js';
import { inferType, inferZod } from './infer.js';
import { parseJsonDocument, readAllStdin, readInputFile, readQueryFromFile } from './io.js';
import { parse } from './parser.js';
import { readJsonLinesStreaming } from './io.js';

const HELP = `tsjq — Typed JSON Query Library + CLI
Usage: tsjq [opts] '<query>' [file]
  --compact          compact output
  --indent <n>       indent spaces (default 2)
  --jsonl            treat input as JSONL
  --strict           throw on null/undefined instead of null
  --from-file <f>    read query from file
  --infer-type       emit TypeScript type
  --to-zod           emit Zod schema
  --type-name <n>    type name for --infer-type (default Root)
  --help             show this help`;

interface CliOpts {
  query: string | undefined;
  file: string | undefined;
  compact: boolean;
  indent: number;
  jsonl: boolean;
  strict: boolean;
  fromFile: string | undefined;
  inferType: boolean;
  toZod: boolean;
  typeName: string;
  help: boolean;
}

function parseArgs(argv: string[]): CliOpts {
  let compact = false;
  let indent = 2;
  let jsonl = false;
  let strict = false;
  let fromFile: string | undefined;
  let inferTypeFlag = false;
  let toZod = false;
  let typeName = 'Root';
  let help = false;
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === '--compact') {
      compact = true;
      continue;
    }
    if (a === '--jsonl') {
      jsonl = true;
      continue;
    }
    if (a === '--strict') {
      strict = true;
      continue;
    }
    if (a === '--help' || a === '-h') {
      help = true;
      continue;
    }
    if (a === '--indent') {
      const v = argv[i + 1];
      if (v === undefined) throw new JsonError('--indent requires a number', 0);
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 8) throw new JsonError('--indent must be integer 0..8', 0);
      indent = n;
      i += 1;
      continue;
    }
    if (a === '--from-file') {
      const v = argv[i + 1];
      if (v === undefined) throw new JsonError('--from-file requires a path', 0);
      fromFile = v;
      i += 1;
      continue;
    }
    if (a === '--infer-type') {
      inferTypeFlag = true;
      continue;
    }
    if (a === '--to-zod') {
      toZod = true;
      continue;
    }
    if (a === '--type-name') {
      const v = argv[i + 1];
      if (v === undefined) throw new JsonError('--type-name requires a name', 0);
      typeName = v;
      i += 1;
      continue;
    }
    if (a.startsWith('--')) {
      throw new JsonError(`unknown option '${a}'`, 0);
    }
    positionals.push(a);
  }
  let query: string | undefined;
  let file: string | undefined;
  if (fromFile !== undefined) {
    if (positionals.length > 1) throw new JsonError('too many arguments', 0);
    const f = positionals[0];
    if (f !== undefined) file = f;
  } else {
    const q = positionals[0];
    const f = positionals[1];
    if (positionals.length > 2) throw new JsonError('too many arguments', 0);
    query = q;
    if (f !== undefined) file = f;
  }
  if (inferTypeFlag && toZod) throw new JsonError('cannot use --infer-type and --to-zod together', 0);
  return { query, file, compact, indent, jsonl, strict, fromFile, inferType: inferTypeFlag, toZod, typeName, help };
}

async function main(): Promise<void> {
  let opts: CliOpts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    if (e instanceof JsonError) {
      process.stderr.write(`${e.message}\n`);
      process.exitCode = 2;
      return;
    }
    throw e;
  }
  if (opts.help || (opts.query === undefined && opts.fromFile === undefined)) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  let queryStr = '';
  try {
    if (opts.fromFile !== undefined) {
      queryStr = await readQueryFromFile(opts.fromFile);
    } else {
      queryStr = opts.query ?? '';
    }
    if (queryStr === '') throw new QueryError('empty query', 0, 'expected filter');
  } catch (e) {
    if (e instanceof QueryError) {
      const q = opts.fromFile !== undefined ? queryStr : (opts.query ?? queryStr);
      process.stderr.write(`${e.render(q)}\n`);
      process.exitCode = 1;
      return;
    }
    if (e instanceof JsonError) {
      process.stderr.write(`${e.message}\n`);
      process.exitCode = 2;
      return;
    }
    throw e;
  }

  let ast;
  try {
    ast = parse(queryStr);
  } catch (e) {
    if (e instanceof QueryError) {
      process.stderr.write(`${e.render(queryStr)}\n`);
      process.exitCode = 1;
      return;
    }
    throw e;
  }

  const isJsonl = opts.jsonl || (opts.file !== undefined && opts.file.endsWith('.jsonl'));
  const evalOpts = { strict: opts.strict };
  const fmt = { compact: opts.compact, indent: opts.indent };

  if (isJsonl) {
    const inputStream = opts.file !== undefined ? createReadStream(opts.file) : process.stdin;
    if (opts.file === undefined && process.stdin.isTTY) {
      process.stderr.write('no input: provide a file or pipe JSONL via stdin\n');
      process.exitCode = 2;
      return;
    }
    const wantInfer = opts.inferType || opts.toZod;
    const collected: unknown[] = [];
    try {
      for await (const { value, lineNo } of readJsonLinesStreaming(inputStream)) {
        let outputs: unknown[];
        try {
          outputs = [...evaluate(ast, value, evalOpts)];
        } catch (e) {
          if (e instanceof QueryError) {
            process.stderr.write(`row ${lineNo}: ${e.render(queryStr)}\n`);
            continue;
          }
          throw e;
        }
        if (wantInfer) {
          collected.push(...outputs);
          if (collected.length > 100) break;
          continue;
        }
        for (const out of outputs) {
          process.stdout.write(`${formatValue(out, fmt)}\n`);
        }
      }
    } catch (e) {
      if (e instanceof JsonError) {
        process.stderr.write(`${e.render()}\n`);
        process.exitCode = 2;
        return;
      }
      const code = exitCodeFor(e);
      if (e instanceof Error) process.stderr.write(`${e.message}\n`);
      process.exitCode = code;
      return;
    }
    if (wantInfer) {
      const target: unknown = collected.length === 1 ? collected[0] : collected;
      if (opts.inferType) process.stdout.write(`${inferType(target, opts.typeName)}\n`);
      else process.stdout.write(`${inferZod(target)}\n`);
    }
    return;
  }

  let text: string;
  try {
    if (opts.file !== undefined) {
      text = await readInputFile(opts.file);
    } else {
      if (process.stdin.isTTY) {
        process.stderr.write('no input: provide a file or pipe JSON via stdin\n');
        process.exitCode = 2;
        return;
      }
      text = await readAllStdin();
    }
  } catch (e) {
    if (e instanceof JsonError) {
      process.stderr.write(`${e.message}\n`);
      process.exitCode = 2;
      return;
    }
    throw e;
  }

  let data: unknown;
  try {
    data = parseJsonDocument(text);
  } catch (e) {
    if (e instanceof JsonError) {
      process.stderr.write(`${e.render()}\n`);
      process.exitCode = 2;
      return;
    }
    throw e;
  }

  let outputs: unknown[];
  try {
    outputs = [...evaluate(ast, data, evalOpts)];
  } catch (e) {
    if (e instanceof QueryError) {
      process.stderr.write(`${e.render(queryStr)}\n`);
      process.exitCode = 1;
      return;
    }
    throw e;
  }
  if (opts.inferType || opts.toZod) {
    const target: unknown = outputs.length === 1 ? outputs[0] : outputs;
    if (opts.inferType) process.stdout.write(`${inferType(target, opts.typeName)}\n`);
    else process.stdout.write(`${inferZod(target)}\n`);
    return;
  }
  for (const out of outputs) {
    process.stdout.write(`${formatValue(out, fmt)}\n`);
  }
}

await main();
