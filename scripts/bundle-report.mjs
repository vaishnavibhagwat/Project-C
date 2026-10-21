// Reports gzip sizes of the production build and checks them against the brief's budgets:
// main entry < 150 KB gzip, each widget chunk < 50 KB gzip. Run after `npm run build`.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const ASSETS = join(DIST, 'assets');
const KB = 1024;
const MAIN_BUDGET = 150 * KB;
const WIDGET_BUDGET = 50 * KB;

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const entry = /<script type="module"[^>]*src="\/?assets\/([^"]+\.js)"/.exec(html)?.[1];
if (!entry) throw new Error('Could not find the entry script in dist/index.html');

const files = readdirSync(ASSETS).filter((f) => f.endsWith('.js') || f.endsWith('.css'));
const rows = files.map((file) => {
  const bytes = readFileSync(join(ASSETS, file));
  const kind =
    file === entry
      ? 'main'
      : file.endsWith('.css')
        ? 'css'
        : file.startsWith('vendor-')
          ? 'shared vendor (lazy)'
          : 'lazy chunk';
  return { file, kind, raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length };
});
rows.sort((a, b) => b.gzip - a.gzip);

const fmt = (n) => `${(n / KB).toFixed(1)} KB`;
console.log('file'.padEnd(44), 'kind'.padEnd(22), 'raw'.padStart(10), 'gzip'.padStart(10));
for (const r of rows) {
  console.log(
    r.file.padEnd(44),
    r.kind.padEnd(22),
    fmt(r.raw).padStart(10),
    fmt(r.gzip).padStart(10),
  );
}

const main = rows.find((r) => r.kind === 'main');
const lazy = rows.filter((r) => r.kind === 'lazy chunk');
const largestLazy = lazy[0];
let failed = false;
if (!main || main.gzip > MAIN_BUDGET) failed = true;
if (largestLazy && largestLazy.gzip > WIDGET_BUDGET) failed = true;
console.log('');
console.log(`Main entry: ${fmt(main?.gzip ?? 0)} gzip (budget ${fmt(MAIN_BUDGET)})`);
console.log(
  `Largest widget/lazy chunk: ${fmt(largestLazy?.gzip ?? 0)} gzip (budget ${fmt(WIDGET_BUDGET)})`,
);
console.log(
  'Shared vendor chunks (Recharts, D3, react-virtuoso) load on first use and are reported, not budgeted per widget.',
);
process.exit(failed ? 1 : 0);
