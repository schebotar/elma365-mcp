#!/usr/bin/env node
// Живые пробы собранного сервера (вне CI).
//   npm run probe -- --list
//   npm run probe -- --tool discover_apps --args '{"namespace":"example_namespace"}'
// Нужны ELMA365_DOMAIN и ELMA365_TOKEN — из окружения или .env в корне пакета.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile() {
  const file = join(ROOT, ".env");
  const env = {};
  if (!existsSync(file)) return env;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

function parseArgs(argv) {
  const result = { list: false, tool: null, args: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list") result.list = true;
    else if (arg === "--tool") result.tool = argv[++i] ?? null;
    else if (arg === "--args") {
      const raw = argv[++i] ?? "{}";
      try {
        result.args = JSON.parse(raw);
      } catch {
        console.error(`--args: не разобрать JSON: ${raw}`);
        process.exit(2);
      }
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Использование:",
          "  npm run probe -- --list",
          "  npm run probe -- --tool <имя> [--args '<json>']",
        ].join("\n"),
      );
      process.exit(0);
    }
  }
  return result;
}

const options = parseArgs(process.argv.slice(2));
if (!options.list && !options.tool) {
  console.error("Укажи --list или --tool <имя>. Пример: npm run probe -- --list");
  process.exit(2);
}

const env = { ...loadEnvFile(), ...process.env };
if (!env.ELMA365_DOMAIN || !env.ELMA365_TOKEN) {
  console.error(
    "Нужны ELMA365_DOMAIN и ELMA365_TOKEN (окружение или .env в корне пакета).",
  );
  process.exit(2);
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [join(ROOT, "dist", "index.js")],
  cwd: ROOT,
  env,
});
const client = new Client({ name: "elma365-mcp-probe", version: "0.0.0" });
await client.connect(transport);

try {
  if (options.list) {
    const { tools } = await client.listTools();
    console.log(`Инструментов: ${tools.length}`);
    for (const tool of tools) {
      console.log(`  ${tool.name} — ${tool.description?.split("\n")[0] ?? ""}`);
    }
  } else {
    const result = await client.callTool({
      name: options.tool,
      arguments: options.args,
    });
    for (const item of result.content ?? []) {
      if (item.type === "text") console.log(item.text);
    }
    if (result.isError) {
      console.error("\nИнструмент вернул ошибку.");
      process.exitCode = 1;
    }
  }
} finally {
  await client.close();
}
