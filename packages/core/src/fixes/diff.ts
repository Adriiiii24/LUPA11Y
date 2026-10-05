/** Diff unificado por líneas (LCS). Pensado para fragmentos cortos: un nodo o una regla CSS. */

type Op = readonly [' ' | '-' | '+', string];

const MAX_CELLS = 250_000;

const splitLines = (text: string): string[] => (text === '' ? [] : text.replace(/\r\n?/g, '\n').split('\n'));

function diffLines(a: readonly string[], b: readonly string[]): Op[] {
  if (a.length * b.length > MAX_CELLS) {
    return [...a.map((line): Op => ['-', line]), ...b.map((line): Op => ['+', line])];
  }
  // lcs[i][j] = longitud de la subsecuencia común más larga de a[i..] y b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    const row = lcs[i]!;
    const next = lcs[i + 1]!;
    for (let j = b.length - 1; j >= 0; j -= 1) {
      row[j] = a[i] === b[j] ? next[j + 1]! + 1 : Math.max(next[j]!, row[j + 1]!);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push([' ', a[i]!]);
      i += 1;
      j += 1;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      ops.push(['-', a[i]!]);
      i += 1;
    } else {
      ops.push(['+', b[j]!]);
      j += 1;
    }
  }
  while (i < a.length) ops.push(['-', a[i++]!]);
  while (j < b.length) ops.push(['+', b[j++]!]);
  return ops;
}

export function unifiedDiff(before: string, after: string, path: string): string {
  const a = splitLines(before);
  const b = splitLines(after);
  const ops = diffLines(a, b);
  const range = (length: number) => `${length === 0 ? 0 : 1},${length}`;
  return [`--- a/${path}`, `+++ b/${path}`, `@@ -${range(a.length)} +${range(b.length)} @@`, ...ops.map(([tag, line]) => tag + line)].join(
    '\n',
  );
}
