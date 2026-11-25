import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
/** A folder under the system temp folder that `t` removes after its test. */
export function muirTempRoot(
  t: { after(fn: () => void): unknown },
  prefix: string,
): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  t.after(() => rmSync(root, { recursive: true }));

  return root;
}

export function muirWriteTree(
  dir: string,
  files: Readonly<Record<string, string>>,
): void {
  Object.entries(files).forEach(([file, content]) => {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  });
}
