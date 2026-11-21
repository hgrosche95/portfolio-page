import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * The videos are cached for a week (staticwebapp.config.json) under a fixed
 * file name, so a re-recorded clip would keep playing the old version for
 * returning visitors. A short content hash in the query string gives every
 * new recording its own URL; unchanged files keep theirs and stay cached.
 * Build time only: reads the file from public/.
 */
export const versioned = (path: string) =>
	`${path}?v=${createHash('sha256').update(readFileSync(join(process.cwd(), 'public', path))).digest('hex').slice(0, 10)}`;
