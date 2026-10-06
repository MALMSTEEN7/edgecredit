// Genera dist/app.bundle.js: una versión en un solo archivo (script clásico) de
// los módulos de js/ + app.js. Se usa automáticamente cuando index.html se abre
// con doble clic (file://), donde el navegador bloquea los módulos ES.
//
// Uso (desde la carpeta del proyecto, requiere Node 18+):  node tools/bundle.mjs
// Ejecútalo cada vez que modifiques un archivo dentro de js/ o app.js.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
const alias = file => basename(file, '.js').replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + 'Module';
const stripImports = src => src.replace(/^import\s[^;]*?from\s+'[^']+';\s*$/gm, '');

const parts = [];
const declared = new Map(); // nombre top-level -> archivo (todo comparte un único scope en el paquete)
for (const file of walk(join(root, 'js')).sort()) {
  const src = stripImports(readFileSync(file, 'utf8'))
    .replace(/^export function mount\(/m, `function __mount_${alias(file)}(`)
    .replace(/^export (async function|function|const|let)/gm, '$1');
  if (/^\s*export\s/m.test(src)) throw new Error(`Export no soportado en ${relative(root, file)}`);
  for (const [, name] of src.matchAll(/^(?:async\s+)?(?:function\s+|const\s+|let\s+|class\s+)([\w$]+)/gm)) {
    if (declared.has(name)) throw new Error(`Nombre top-level duplicado "${name}" en ${relative(root, file)} y ${declared.get(name)}: renómbralo, el paquete comparte un solo scope.`);
    declared.set(name, relative(root, file));
  }
  parts.push(`// ── ${relative(root, file).replaceAll('\\', '/')}\n${src.trim()}`);
}
const app = readFileSync(join(root, 'app.js'), 'utf8');
const mounts = [...app.matchAll(/^import \* as (\w+) from '[^']+';$/gm)].map(m => m[1]);
parts.push(`// ── app.js\n${mounts.map(m => `const ${m} = { mount: __mount_${m} };`).join('\n')}\n${stripImports(app).trim()}`);

const out = `/* ARCHIVO GENERADO por tools/bundle.mjs: no lo edites a mano. */\n(() => {\n'use strict';\n${parts.join('\n\n')}\n})();\n`;
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'app.bundle.js'), out);
console.log(`dist/app.bundle.js generado (${parts.length} módulos, ${(out.length / 1024).toFixed(0)} KB)`);

// Hoja de estilos en un solo archivo: resuelve los @import de styles.css en orden.
const css = readFileSync(join(root, 'styles.css'), 'utf8').replace(/^@import url\("([^"]+)"\);\s*$/gm, (_, file) =>
  `/* ── ${file} */\n${readFileSync(join(root, file), 'utf8').trim()}\n`);
writeFileSync(join(root, 'dist', 'styles.bundle.css'), `/* ARCHIVO GENERADO por tools/bundle.mjs: no lo edites a mano. */\n${css}`);

// Sello de versión: cambia con cada build, así el navegador nunca usa JS o CSS viejos de su caché.
const version = createHash('sha256').update(out).update(css).digest('hex').slice(0, 10);
const indexPath = join(root, 'index.html');
const html = readFileSync(indexPath, 'utf8').replace(/const APP_VERSION = '[^']*';/, `const APP_VERSION = '${version}';`)
  .replace(/href="dist\/styles\.bundle\.css(\?v=[^"]*)?"/, `href="dist/styles.bundle.css?v=${version}"`);
writeFileSync(indexPath, html);
console.log(`dist/styles.bundle.css generado · versión ${version} aplicada en index.html`);
