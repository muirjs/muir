import { fileNameOf } from './node-field.ts';

/** What `read` gives; an error it throws comes back naming the story file `path` belongs to, with the error as its cause. */
export function readNamingStoryFile<T>(
  packageName: string,
  path: unknown,
  read: () => T,
): T {
  try {
    return read();
  } catch (error) {
    const fileName = fileNameOf(path);
    const file =
      fileName === undefined ? 'a story file' : `the story file ${fileName}`;

    throw new Error(
      `${packageName}: could not read ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
