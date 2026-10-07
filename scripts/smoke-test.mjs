#!/usr/bin/env node
/**
 * Smoke-тест инструментов elma365-mcp против стенда из .env.
 * Читает .env, вызывает скомпилированные обработчики из dist/ напрямую.
 * Создаёт тестовый элемент с маркером [TEST MCP] (удаление через API не поддерживается — уборка вручную).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function loadEnv() {
  const env = {};
  const text = readFileSync(join(root, '.env'), 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
process.env.ELMA365_DOMAIN = env.ELMA365_DOMAIN;
process.env.ELMA365_TOKEN = env.ELMA365_TOKEN;

const NS = env.ELMA365_NAMESPACE || 'contract_management';
const APP = env.ELMA365_APP || 'contract';
const MARKER = `[TEST MCP] smoke ${Date.now()}`;

const log = (s) => console.log(s);
const trunc = (s, n = 700) => (typeof s === 'string' && s.length > n ? s.slice(0, n) + '…' : s);

async function step(name, fn) {
  try {
    const out = await fn();
    log(`\n=== ${name} ===`);
    log(typeof out === 'string' ? trunc(out, 900) : JSON.stringify(out, null, 2).slice(0, 900));
    return out;
  } catch (e) {
    log(`\n=== ${name} (ОШИБКА) ===`);
    log(String(e && e.message ? e.message : e));
    return undefined;
  }
}

const { handleDiscoverApps } = await import('../dist/tools/discover.js');
const { handleGetAppStatuses, handleGetProcessTemplates } = await import('../dist/tools/schema.js');
const { handleSearchEmployees } = await import('../dist/tools/users.js');
const {
  handleCreateAppItem,
  handleUpdateAppItem,
  handleSetAppItemStatus,
  handleGetAppItem,
} = await import('../dist/tools/items.js');
const { handleSearchProcessInstances, handleGetProcessInstance } = await import('../dist/tools/processes.js');

log(`Стенд: ${env.ELMA365_DOMAIN} | раздел ${NS}, приложение ${APP}`);

// ── Чтение ────────────────────────────────────────────────────────
await step('discover_apps', () => handleDiscoverApps({ namespace: NS }));

const statuses = await step('get_app_statuses', () =>
  handleGetAppStatuses({ namespace: NS, code: APP }),
);

const templates = await step('get_process_templates (НОВЫЙ)', () =>
  handleGetProcessTemplates({ namespace: NS, code: APP }),
);

await step('search_employees (НОВЫЙ)', () => handleSearchEmployees({ size: 3 }));

// ── Процессы (новые инструменты, только чтение) ──────────────────
let templateCode = null;
try {
  const t = JSON.parse(templates ?? '{}');
  templateCode = t && t.processes && t.processes[0] ? t.processes[0].code : null;
} catch {}

if (templateCode) {
  const instances = await step(`search_process_instances (${templateCode}, НОВЫЙ)`, () =>
    handleSearchProcessInstances({ namespace: `${NS}.${APP}`, code: templateCode, active: true, size: 2 }),
  );
  let instanceId = null;
  try {
    const ins = JSON.parse(instances ?? '{}');
    instanceId = ins && ins.instances && ins.instances[0] ? ins.instances[0].__id : null;
  } catch {}
  if (instanceId) {
    await step('get_process_instance (НОВЫЙ)', () => handleGetProcessInstance({ id: instanceId }));
  }
}

// ── Жизненный цикл элемента (новые write-инструменты) ────────────
const created = await step('create_app_item (НОВЫЙ)', () =>
  handleCreateAppItem({ namespace: NS, code: APP, context: { __name: MARKER, contract_end_date: '2027-12-31T00:00:00Z' } }),
);

let itemId = null;
try {
  const c = JSON.parse(created ?? '{}');
  itemId = (c && c.item && (c.item.__id ?? c.item.id)) || null;
} catch {}

if (itemId) {
  await step('get_app_item (после создания)', () => handleGetAppItem({ namespace: NS, code: APP, id: itemId }));

  await step('update_app_item (НОВЫЙ)', () =>
    handleUpdateAppItem({ namespace: NS, code: APP, id: itemId, context: { contract_end_date: '2028-01-31T00:00:00Z' } }),
  );

  let statusCode = 'valid';
  try {
    const s = JSON.parse(statuses ?? '{}');
    const codes = (s && s.statuses ? s.statuses : []).map((x) => x.code);
    if (codes.length && !codes.includes('valid')) statusCode = codes[0];
  } catch {}
  await step(`set_app_item_status (${statusCode}, НОВЫЙ)`, () =>
    handleSetAppItemStatus({ namespace: NS, code: APP, id: itemId, status: statusCode }),
  );

  await step('get_app_item (финальное состояние)', () => handleGetAppItem({ namespace: NS, code: APP, id: itemId }));
}

log(`\nГотово. Тестовый элемент: ${MARKER} (${itemId ?? 'не создан'})`);
log('Внимание: удаление через /pub/v1 не поддерживается — уберите элемент вручную (поиск "TEST MCP").');
