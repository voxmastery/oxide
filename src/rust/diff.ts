// Line diff (LCS) for the Solution tab and HINT 3: the official solution against the original file.

export type DiffLine = { op: '-' | '+' | ' '; n: number; t: string };

export function lineDiff(a: string, b: string): DiffLine[] {
  const A = a.split('\n');
  const B = b.split('\n');
  const n = A.length;
  const m = B.length;
  // dp[i][j] = LCS length of A[i..] and B[j..]
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { out.push({ op: ' ', n: j + 1, t: B[j] }); i++; j++; }
    else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) { out.push({ op: '+', n: j + 1, t: B[j] }); j++; }
    else { out.push({ op: '-', n: i + 1, t: A[i] }); i++; }
  }
  // Within a change block show removals before additions, like the prototype.
  const res: DiffLine[] = [];
  let k = 0;
  while (k < out.length) {
    if (out[k].op === ' ') { res.push(out[k]); k++; continue; }
    const block: DiffLine[] = [];
    while (k < out.length && out[k].op !== ' ') block.push(out[k++]);
    res.push(...block.filter((d) => d.op === '-'), ...block.filter((d) => d.op === '+'));
  }
  return res;
}

/** Only the changed lines (the prototype's compact solution diff). */
export const changedLines = (a: string, b: string) => lineDiff(a, b).filter((d) => d.op !== ' ');
