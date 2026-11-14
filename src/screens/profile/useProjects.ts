// Projects under ~/projects (src/fs), loaded once per mount. Used by Profile and Settings.
import { useEffect, useState } from 'react';
import { listProjects } from '../../fs';
import { projects as bookProjects } from '../../content';

export type ProjectInfo = { name: string; files: string[]; bytes: number };

export function useProjects() {
  const [list, setList] = useState<ProjectInfo[] | null>(null);
  useEffect(() => {
    let live = true;
    listProjects().then((l) => { if (live) setList(l); }).catch(() => { if (live) setList([]); });
    return () => { live = false; };
  }, []);
  return list;
}

/** Book projects (guessing_game, minigrep, hello…) that exist on disk. `hello` is made as hello_world / hello_cargo. */
export function bookProjectsMade(list: ProjectInfo[] | null) {
  const names = new Set((list ?? []).map((p) => p.name));
  const made = bookProjects.filter((p) => names.has(p.name) || (p.name === 'hello' && (names.has('hello_world') || names.has('hello_cargo')))).length;
  return { made, total: bookProjects.length };
}
