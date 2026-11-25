import { muirMoiraStorybookFileNameOf } from './node-field.ts';

/** What `read` gives; an error it throws comes back naming the story file `path` belongs to, with the error as its cause. */
export function muirMoiraStorybookReadNamingStoryFile<T>(
  packageName: string,
  path: unknown,
  read: () => T,
): T {
  try {
    return read();
  } catch (error) {
    const fileName = muirMoiraStorybookFileNameOf(path);
    const file =
      fileName === undefined ? 'a story file' : `the story file ${fileName}`;

    throw new Error(
      `${packageName}: could not read ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
