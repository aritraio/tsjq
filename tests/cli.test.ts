import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], stdin?: string): RunResult {
  const r = spawnSync('npx', ['tsx', 'src/cli.ts', ...args], {
    input: stdin,
    encoding: 'utf8',
  });
  return {
    status: r.status,
    stdout: r.stdout?.toString() ?? '',
    stderr: r.stderr?.toString() ?? '',
  };
}

describe('cli', () => {
  it('--help prints and exits 0', () => {
    const r = runCli(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Usage: tsjq [opts] '<query>' [file]");
    expect(r.stdout).toMatchSnapshot();
  });

  it('queries stdin dot path', () => {
    const r = runCli(['.user.name'], '{"user":{"name":"Ada"}}');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('"Ada"');
  });

  it('queries file arg', () => {
    const r = runCli(['.users[0].name', 'tests/fixtures/nested.json']);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('"Ada"');
  });

  it('pipe + select', () => {
    const r = runCli(['.items[] | select(.price > 20)', 'tests/fixtures/nested.json']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('"price": 30');
  });

  it('query error exits 1 with caret col 7', () => {
    const r = runCli(['.users[', 'tests/fixtures/nested.json']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('QueryError at col 7');
    expect(r.stderr).toContain('^');
  });

  it('invalid JSON exits 2', () => {
    const r = runCli(['.a'], '{bad}');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('JSON parse error');
  });

  it('missing file exits 2', () => {
    const r = runCli(['.a', 'tests/fixtures/does-not-exist.json']);
    expect(r.status).toBe(2);
  });

  it('--compact outputs single line', () => {
    const r = runCli(['.config', 'tests/fixtures/nested.json', '--compact']);
    expect(r.status).toBe(0);
    expect(r.stdout.trim().split('\n')).toHaveLength(1);
  });
});
