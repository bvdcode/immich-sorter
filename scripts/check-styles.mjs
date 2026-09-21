import { readdir, readFile } from 'node:fs/promises';
const files = await readdir('src', { recursive: true });
for (const file of files.filter((name) => /\.(css|tsx?|jsx?)$/.test(name))) {
  if (/\b\d+(?:\.\d+)?(?:[dls]?v[wh]|vmin|vmax)\b/i.test(await readFile(`src/${file}`, 'utf8'))) {
    throw new Error(`Viewport sizing is forbidden: ${file}`);
  }
}
