// Measures which production React components are rendered by at least one Storybook story.
// A component counts as covered when its name appears in a *.stories.tsx file (imported or
// rendered). Widgets are covered when their folder is imported by a story.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const SCAN = ['components', 'grid', 'layout', 'theme', 'widgets'];
// Context providers and internal wrappers are infrastructure, not visual components.
const IGNORE = new Set(['MotionProvider', 'ToastProvider', 'FieldShell']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : walk(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

const components = new Map();
for (const area of SCAN) {
  for (const file of walk(join(SRC, area))) {
    const rel = relative(SRC, file).split(sep).join('/');
    const text = readFileSync(file, 'utf8');
    if (area === 'widgets' && rel.endsWith('/index.tsx')) {
      const folder = rel.split('/')[1];
      components.set(`widget:${folder}`, { file: rel, needle: `@/widgets/${folder}/index` });
      continue;
    }
    // PascalCase names only (skips SCREAMING_CASE constants such as GRID_COLS).
    const re = /export (?:const|function|class|default function) ([A-Z][a-z][A-Za-z0-9]*)\b/g;
    for (const m of text.matchAll(re)) {
      const name = m[1];
      if (name.startsWith('Icon') || IGNORE.has(name)) continue;
      if (!/\(|extends Component|memo|forwardRef/.test(text)) continue;
      components.set(name, { file: rel, needle: name });
    }
  }
}
// Icons are covered as a set by the icon gallery story.
components.set('Icons', { file: 'components/Icons.tsx', needle: '@/components/Icons' });

const stories = walk(join(SRC, 'stories'))
  .filter((f) => f.endsWith('.stories.tsx'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

const isCovered = (needle) =>
  needle.includes('/')
    ? stories.includes(needle)
    : new RegExp(String.raw`\b${needle}\b`).test(stories);
const rows = [...components.entries()].map(([name, c]) => ({
  name,
  file: c.file,
  covered: isCovered(c.needle),
}));
const covered = rows.filter((r) => r.covered).length;
for (const r of rows.filter((x) => !x.covered)) console.log(`missing  ${r.name}  (${r.file})`);
console.log(
  `Storybook coverage: ${covered}/${rows.length} production components (${((covered / rows.length) * 100).toFixed(1)}%)`,
);
if (
  process.argv.includes('--min') &&
  covered / rows.length < Number(process.argv[process.argv.indexOf('--min') + 1])
) {
  process.exit(1);
}
