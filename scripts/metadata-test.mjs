#!/usr/bin/env node
/** Быстрая проверка инструментов метаданных против стенда из .env. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const env = {};
for (const raw of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq < 0) continue;
  env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}
process.env.ELMA365_DOMAIN = env.ELMA365_DOMAIN;
process.env.ELMA365_TOKEN = env.ELMA365_TOKEN;

const NS = env.ELMA365_NAMESPACE || 'example_namespace';

const { metadataTools } = await import('../dist/tools/metadata.js');
const byName = Object.fromEntries(metadataTools.map((t) => [t.name, t]));

const trunc = (s, n = 400) => (typeof s === 'string' && s.length > n ? s.slice(0, n) + '…' : s);

async function run(name, params) {
  try {
    const out = await byName[name].handler(params ?? {});
    console.log(`\n=== ${name} ===`);
    console.log(trunc(out, 500));
    return out;
  } catch (e) {
    console.log(`\n=== ${name} (ОШИБКА) ===`);
    console.log(String(e && e.message ? e.message : e));
    return undefined;
  }
}

await run('get_namespaces');
await run('get_namespace_apps', { namespace: NS });
await run('get_process_schema', { namespace: `${NS}.example_app`, code: 'example_process' });
await run('get_modules');
await run('get_groups', { namespace: NS });
