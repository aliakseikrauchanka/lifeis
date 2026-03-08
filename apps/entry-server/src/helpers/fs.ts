import { unlinkSync } from 'fs';

export function safeUnlink(path: string): void {
  try {
    unlinkSync(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to delete file:', path, err);
    }
  }
}
