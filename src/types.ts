export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type TokenKind =
  | 'dot'
  | 'ident'
  | 'lbracket'
  | 'rbracket'
  | 'number'
  | 'star'
  | 'pipe'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'colon'
  | 'string'
  | 'op'
  | 'eof';

export interface Token {
  kind: TokenKind;
  text: string;
  pos: number;
}

export interface Span {
  start: number;
  end: number;
}

export type CompareOp = '>' | '<' | '>=' | '<=' | '==' | '!=';

export type ASTNode =
  | { kind: 'root'; span: Span }
  | { kind: 'field'; name: string; span: Span }
  | { kind: 'index'; index: number; span: Span }
  | { kind: 'wildcard'; span: Span }
  | { kind: 'slice'; start: number | undefined; end: number | undefined; span: Span }
  | { kind: 'pipe'; left: ASTNode; right: ASTNode; span: Span }
  | { kind: 'call'; name: string; args: ASTNode[]; span: Span }
  | { kind: 'literal'; value: JsonValue; span: Span }
  | { kind: 'compare'; op: CompareOp; left: ASTNode; right: ASTNode; span: Span };

export interface EvalOpts {
  strict?: boolean;
  depthLimit?: number;
}

export function defaultEvalOpts(): Required<EvalOpts> {
  return { strict: false, depthLimit: 100 };
}

export function resolveEvalOpts(opts: EvalOpts | undefined): Required<EvalOpts> {
  const base = defaultEvalOpts();
  if (opts === undefined) return base;
  const strict = opts.strict ?? false;
  const depthLimit = opts.depthLimit ?? 100;
  return { strict, depthLimit };
}
