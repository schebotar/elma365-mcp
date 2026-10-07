#!/usr/bin/env node
// Покрытие публичного API ELMA365 (/pub/v1): сколько операций оборачивает сервер.
// Список операций — снимок scripts/lib/elma-api-operations.json
// (обновляется: node scripts/update-api-spec.mjs).
// Запуск: npm run coverage
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const snapshot = JSON.parse(
  readFileSync(join(ROOT, "scripts", "lib", "elma-api-operations.json"), "utf8"),
);

const API_ROOT =
  /^(app|bpm|scheme|user|contracts|disk|reports|tasks|storage|marketing|nomenclature|docflow|registration|feed|channel|integration|help)(\/|$)/;

/** Приводит путь API и путь из кода к общему виду: {namespace} и ${x} → {}. */
function normalize(path) {
  return path
    .replace(/^\/+/, "")
    .replace(/\$\{[^}]*\}/g, "{}")
    .replace(/\{[^}]*\}/g, "{}")
    .replace(/\/+$/, "");
}

function readSources() {
  const files = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts")) files.push(full);
    }
  })(join(ROOT, "src"));
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

const source = readSources();

// 1) Явные вызовы elmaRequest("<METHOD>", <литерал>) — метод известен.
const explicit = new Set();
const explicitRe =
  /elmaRequest\(\s*["'](GET|POST|PUT|PATCH|DELETE)["']\s*,\s*([`'"])([\s\S]*?)\2/g;
for (const match of source.matchAll(explicitRe)) {
  explicit.add(`${match[1]} ${normalize(match[3])}`);
}

// 2) Прочие path-литералы (scheme/schema и хелперы list/get) — читающие, GET.
//    Литералы, которые уже разобраны как аргумент elmaRequest, пропускаем.
const literalRe = /([`'"])([^`'"]*?)\1/g;
const readPaths = new Set();
for (const match of source.matchAll(literalRe)) {
  const raw = match[2];
  if (!raw.includes("/")) continue;
  const normalized = normalize(raw);
  if (!API_ROOT.test(normalized)) continue;
  const before = source.slice(Math.max(0, match.index - 64), match.index);
  if (/elmaRequest\(\s*["'](GET|POST|PUT|PATCH|DELETE)["']\s*,\s*$/.test(before)) {
    continue;
  }
  readPaths.add(normalized);
}

// Сопоставление со операциями API.
const covered = [];
const uncovered = [];
for (const op of snapshot.operations) {
  const path = normalize(op.path);
  const isExplicit = explicit.has(`${op.method} ${path}`);
  const isRead = op.method === "GET" && readPaths.has(path);
  (isExplicit || isRead ? covered : uncovered).push(op);
}

const total = snapshot.operations.length;
const share = total ? (covered.length / total) * 100 : 0;

console.log("Покрытие публичного API ELMA365 (/pub/v1)");
console.log(`Источник: ${snapshot.source}`);
console.log(`Снимок: ${snapshot.fetchedAt}, версия API ${snapshot.apiVersion}`);
console.log(`Операций в API: ${total}`);
console.log(`Покрыто сервером: ${covered.length}`);
console.log(`Покрытие: ${share.toFixed(1)}%`);

// Группы, которых сервер не касается вовсе — подсказка, что расширять.
const groups = new Map();
for (const op of uncovered) {
  const group = normalize(op.path).split("/")[0];
  groups.set(group, (groups.get(group) ?? 0) + 1);
}
const untouched = [...groups.entries()].sort((a, b) => b[1] - a[1]);
if (untouched.length) {
  console.log("\nНе покрыто по группам:");
  for (const [group, count] of untouched) console.log(`  ${group}: ${count}`);
}
