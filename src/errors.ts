export class QueryError extends Error {
  readonly pos: number;
  readonly hint: string | undefined;
  readonly exitCode = 1 as const;

  constructor(message: string, pos: number, hint?: string) {
    super(message);
    this.name = 'QueryError';
    this.pos = pos;
    if (hint !== undefined) {
      this.hint = hint;
    }
  }

  render(query: string): string {
    const header = `QueryError at col ${this.pos}: ${this.message}`;
    const caret = `${' '.repeat(this.pos)}^${this.hint !== undefined ? ` ${this.hint}` : ''}`;
    return `${header}\n${query}\n${caret}`;
  }
}

export class JsonError extends Error {
  readonly line: number;
  readonly exitCode = 2 as const;

  constructor(message: string, line: number) {
    super(message);
    this.name = 'JsonError';
    this.line = line;
  }

  render(): string {
    return `JSON parse error at line ${this.line}: ${this.message}`;
  }
}

export function exitCodeFor(err: unknown): number {
  if (err instanceof QueryError) return err.exitCode;
  if (err instanceof JsonError) return err.exitCode;
  if (err instanceof Error && 'exitCode' in err) {
    const code = (err as { exitCode: unknown }).exitCode;
    if (code === 1 || code === 2) return code;
  }
  return 2;
}
