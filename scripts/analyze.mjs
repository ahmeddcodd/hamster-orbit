// Bundle size report for the production build (run after `vite build`).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let total = 0;
const rows = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else {
      total += st.size;
      rows.push([p.replace(/\\/g, '/'), st.size]);
    }
  }
}
walk(dist);
rows.sort((a, b) => b[1] - a[1]);
for (const [file, size] of rows) {
  console.log(`${(size / 1024).toFixed(1).padStart(9)} KB  ${file}`);
}
console.log(`${'-'.repeat(40)}\n${(total / 1024).toFixed(1).padStart(9)} KB  total`);
const LIMIT = 30 * 1024 * 1024;
if (total > LIMIT) {
  console.error('ERROR: bundle exceeds the 30 MiB YouTube Playables initial limit');
  process.exit(1);
}
console.log(`OK: within the 30 MiB Playables initial-bundle limit (${((total / LIMIT) * 100).toFixed(1)}% used)`);
