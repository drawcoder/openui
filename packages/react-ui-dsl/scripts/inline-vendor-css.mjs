import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const TARGETS = [
  {
    src: require.resolve('highlight.js/styles/github.css'),
    dest: path.join(PKG_ROOT, 'src/components/MarkdownView/vendor/hljs-github.css'),
  },
  {
    src: require.resolve('github-markdown-css/github-markdown.css'),
    dest: path.join(PKG_ROOT, 'src/components/MarkdownView/vendor/github-markdown.css'),
  },
];

for (const { src, dest } of TARGETS) {
  const css = fs.readFileSync(src, 'utf8');
  const banner = `/* AUTO-GENERATED from ${path.basename(src)} — do not edit. */\n`;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, banner + css, 'utf8');
  console.log(`✓ ${path.relative(PKG_ROOT, dest)}`);
}
