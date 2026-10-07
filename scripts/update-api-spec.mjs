#!/usr/bin/env node
// Обновляет снимок списка операций публичного API ELMA365 (/pub/v1).
// Источник: https://api.elma365.com/ru/api-v1-doc.json (Swagger 2.0).
// Запуск: node scripts/update-api-spec.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "https://api.elma365.com/ru/api-v1-doc.json";
const METHODS = ["get", "post", "put", "patch", "delete"];

const response = await fetch(SOURCE);
if (!response.ok) {
  throw new Error(`Не удалось скачать спецификацию: HTTP ${response.status}`);
}
const spec = await response.json();

const operations = [];
for (const [path, item] of Object.entries(spec.paths ?? {})) {
  for (const method of METHODS) {
    if (item[method]) {
      operations.push({
        method: method.toUpperCase(),
        path,
        operationId: item[method].operationId ?? null,
      });
    }
  }
}
operations.sort((a, b) =>
  `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`),
);

const snapshot = {
  source: SOURCE,
  fetchedAt: new Date().toISOString().slice(0, 10),
  apiVersion: spec.info?.version ?? null,
  total: operations.length,
  operations,
};

const target = join(ROOT, "scripts", "lib", "elma-api-operations.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Операций: ${operations.length}. Записано: ${target}`);
