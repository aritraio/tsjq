export interface FormatOpts {
  compact: boolean;
  indent: number;
}

export function formatValue(value: unknown, opts: FormatOpts): string {
  if (opts.compact) {
    return JSON.stringify(value) ?? 'null';
  }
  return JSON.stringify(value, null, opts.indent) ?? 'null';
}

export function formatOutputs(values: unknown[], opts: FormatOpts): string {
  return values.map((v) => formatValue(v, opts)).join('\n');
}
