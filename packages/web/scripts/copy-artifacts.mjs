// Copy circuit artifacts into public/ so the browser can fetch them for proving.
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const build = join(here, '../../circuits/build');
const out = join(here, '../public/circuits');

const files = [
    ['withdraw_js/withdraw.wasm', 'withdraw.wasm'],
    ['withdraw_final.zkey', 'withdraw_final.zkey'],
];

mkdirSync(out, { recursive: true });
let copied = 0;
for (const [src, dst] of files) {
    const from = join(build, src);
    if (!existsSync(from)) {
        console.warn(`! missing ${from} — run "npm run build" in packages/circuits`);
        continue;
    }
    copyFileSync(from, join(out, dst));
    console.log(`✓ ${dst}`);
    copied++;
}
if (copied < files.length) process.exitCode = 0; // don't fail dev if artifacts aren't built yet
