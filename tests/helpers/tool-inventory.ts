// Общий инвентарь инструментов: собирается из собранного сервера (dist/server.js)
// через in-memory транспорт — то есть ровно так, как его видят MCP-клиенты.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "../../dist/server.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export interface ToolProperty {
  description?: string;
  [key: string]: unknown;
}

export interface ToolInputSchema {
  type?: string;
  properties?: Record<string, ToolProperty>;
  required?: string[];
}

export interface ServerTool {
  name: string;
  description?: string;
  inputSchema: ToolInputSchema;
}

/** Префиксы имён инструментов сервера — отсекают прочие backtick-токены в README. */
const TOOL_NAME_RE =
  /^(discover|get|search|count|create|update|set|save|run|interrupt|skip|link|unlink|list)_[a-z0-9_]+$/;

async function withServer<T>(
  fn: (client: Client, server: McpServer) => Promise<T>,
): Promise<T> {
  const server = createServer();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "elma365-mcp-check", version: "0.0.0" });
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);
  try {
    return await fn(client, server);
  } finally {
    await client.close();
    await server.close();
  }
}

/** Инструменты, как их отдаёт сам сервер (tools/list). */
export function listServerTools(): Promise<ServerTool[]> {
  return withServer(async (client) => {
    const { tools } = await client.listTools();
    return tools as unknown as ServerTool[];
  });
}

/** Версия, заявленная сервером в serverInfo (из package.json). */
export function serverVersion(): Promise<string | undefined> {
  return withServer(async (client) => client.getServerVersion()?.version);
}

/** Имена инструментов, упомянутые в README в обратных кавычках. */
export function readmeToolNames(): Set<string> {
  const text = readFileSync(join(ROOT, "README.md"), "utf8");
  const names = new Set<string>();
  for (const match of text.matchAll(/`([a-z][a-z0-9_]*)`/g)) {
    if (TOOL_NAME_RE.test(match[1])) names.add(match[1]);
  }
  return names;
}

/** Число инструментов, заявленное в README («**N инструментов**»). */
export function readmeDeclaredCount(): number | null {
  const text = readFileSync(join(ROOT, "README.md"), "utf8");
  const match = text.match(/\*\*(\d+)\s+инструментов\*\*/);
  return match ? Number(match[1]) : null;
}

/** Число инструментов, заявленное в CHANGELOG («Всего **N** инструментов»). */
export function changelogDeclaredCount(): number | null {
  const text = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
  const match = text.match(/Всего \*\*(\d+)\*\*\s+инструментов/);
  return match ? Number(match[1]) : null;
}
