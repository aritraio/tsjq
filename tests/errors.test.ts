import { describe, expect, it } from 'vitest';
import { JsonError, QueryError, exitCodeFor } from '../src/errors.js';

describe('QueryError', () => {
  it('renders caret at expected column', () => {
    const q = '.users[';
    const err = new QueryError("expected ']'", 7, "did you mean ']'?");
    const rendered = err.render(q);
    expect(rendered).toContain('QueryError at col 7');
    expect(rendered).toContain(q);
    const lines = rendered.split('\n');
    expect(lines[2]).toBe(`       ^ did you mean ']'?`);
  });

  it('shapes the canonical missing-bracket error', () => {
    const err = new QueryError("expected ']'", 7, "expected ']'");
    expect(err.pos).toBe(7);
    expect(err.exitCode).toBe(1);
    expect(err.render('.users[')).toMatchSnapshot();
  });

  it('renders without hint', () => {
    const err = new QueryError('unexpected end of query', 3);
    expect(err.hint).toBeUndefined();
    expect(err.render('.a')).toContain('^');
  });
});

describe('JsonError', () => {
  it('carries line number and exit code 2', () => {
    const err = new JsonError('Unexpected token', 4);
    expect(err.line).toBe(4);
    expect(err.exitCode).toBe(2);
    expect(err.render()).toBe('JSON parse error at line 4: Unexpected token');
  });
});

describe('exitCodeFor', () => {
  it('maps QueryError -> 1 and JsonError -> 2', () => {
    expect(exitCodeFor(new QueryError('x', 0))).toBe(1);
    expect(exitCodeFor(new JsonError('y', 1))).toBe(2);
    expect(exitCodeFor(new Error('boom'))).toBe(2);
  });
});
