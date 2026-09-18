import { createInterface } from 'node:readline';
import { JsonError } from './errors.js';

export async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function readInputFile(path: string): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  try {
    return await readFile(path, 'utf8');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new JsonError(`cannot read file '${path}': ${msg}`, 0);
  }
}

export async function readQueryFromFile(path: string): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  try {
    const text = await readFile(path, 'utf8');
    return text.trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new JsonError(`cannot read query file '${path}': ${msg}`, 0);
  }
}

export function parseJsonDocument(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new JsonError(msg, 1);
  }
}

export interface JsonLine {
  value: unknown;
  lineNo: number;
}

export async function* readJsonLinesFromText(text: string): AsyncGenerator<JsonLine, void> {
  const lines = text.split('\n');
  let lineNo = 0;
  for (const raw of lines) {
    lineNo += 1;
    if (raw.trim() === '') continue;
    try {
      const value: unknown = JSON.parse(raw);
      yield { value, lineNo };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new JsonError(msg, lineNo);
    }
  }
}

export async function* readJsonLinesStreaming(
  stream: NodeJS.ReadableStream,
): AsyncGenerator<JsonLine, void> {
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let lineNo = 0;
  for await (const raw of rl) {
    lineNo += 1;
    if (raw.trim() === '') continue;
    try {
      const value: unknown = JSON.parse(raw);
      yield { value, lineNo };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new JsonError(msg, lineNo);
    }
  }
}

export interface RawLine {
  raw: string;
  lineNo: number;
}

export async function* readRawLinesStreaming(
  stream: NodeJS.ReadableStream,
): AsyncGenerator<RawLine, void> {
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let lineNo = 0;
  for await (const raw of rl) {
    lineNo += 1;
    if (raw.trim() === '') continue;
    yield { raw, lineNo };
  }
}
