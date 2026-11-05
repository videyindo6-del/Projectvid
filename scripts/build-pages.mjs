import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(projectRoot, 'public');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const entries = await readdir(projectRoot, { withFileTypes: true });
const htmlFiles = entries
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
  .map((entry) => entry.name);

for (const file of htmlFiles) {
  await cp(path.join(projectRoot, file), path.join(output, file));
}

for (const directory of ['css', 'js', 'components']) {
  await cp(path.join(projectRoot, directory), path.join(output, directory), { recursive: true });
}

for (const file of ['components.js', '_headers', '_redirects', '_routes.json']) {
  await cp(path.join(projectRoot, file), path.join(output, file));
}

console.log(`Cloudflare Pages build complete: ${htmlFiles.length} HTML pages copied to public/.`);
