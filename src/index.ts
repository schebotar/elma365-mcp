#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Discovery tools
import {
  discoverAppsSchema,
  handleDiscoverApps,
} from "./tools/discover.js";

// Search tools
import {
  searchAppItemsSchema,
  handleSearchAppItems,
} from "./tools/search.js";

// CRUD tools
import {
  getAppItemSchema,
  handleGetAppItem,
  createAppItemSchema,
  handleCreateAppItem,
  updateAppItemSchema,
  handleUpdateAppItem,
} from "./tools/items.js";

const TOOL_COUNT = 5;

export function createServer(): McpServer {
  const server = new McpServer({
    name: "elma365-mcp",
    version: "1.0.0",
  });

  // ── Discovery ──────────────────────────────────────────────────

  server.tool(
    "discover_apps",
    "Получить список всех приложений ELMA365 с их кодами и названиями. " +
      "Используется для поиска нужного namespace и code приложения по его названию. " +
      "Можно отфильтровать по разделу (namespace).",
    discoverAppsSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleDiscoverApps(params) }],
    }),
  );

  // ── Search ─────────────────────────────────────────────────────

  server.tool(
    "search_app_items",
    "Поиск элементов приложения через EQL-запрос. Основной инструмент — все фильтры в одном запросе, " +
      "без цепочек вызовов. Кросс-приложенческие подзапросы позволяют ссылаться на другие приложения " +
      "прямо в условии.\n\n" +
      "ПРИМЕРЫ ОДНИМ ЗАПРОСОМ:\n" +
      "- Объекты в городе с оформленными подобъектами:\n" +
      "  [city] like 'Санкт-Петербург' and [__id] in (select [object] from [construction_object.subobject])\n" +
      "- Компании с ответственным сотрудником:\n" +
      "  [responsible_employees_employee_details] in (select [__id] from [_system_catalogs.employee] where [fullName.lastname] like 'Чеботарь')\n" +
      "- Заявки BS за этот год:\n" +
      "  [__name] like 'BS' and [__createdAt] > Datetime(2026, 1, 1)\n\n" +
      "СИНТАКСИС:\n" +
      "- Сравнение: [field] = 'value', [field] > 100, [field] like 'pattern'\n" +
      "- Подзапросы: [field] in (select [__id] from [ns.code] where condition)\n" +
      "- Даты: [__createdAt] > RelativeDatetime('-20d','0d'), [date] = Datetime(2025, 1, 31)\n" +
      "- Логика: and, or, not, скобки\n" +
      "- Системные поля: __id, __createdAt, __createdBy, __updatedAt, __updatedBy, __name",
    searchAppItemsSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleSearchAppItems(params) }],
    }),
  );

  // ── CRUD ───────────────────────────────────────────────────────

  server.tool(
    "get_app_item",
    "Получить один элемент приложения по его UUID.",
    getAppItemSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleGetAppItem(params) }],
    }),
  );

  server.tool(
    "create_app_item",
    "Создать новый элемент в приложении ELMA365. " +
      "Принимает объект data с кодами полей и их значениями.",
    createAppItemSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleCreateAppItem(params) }],
    }),
  );

  server.tool(
    "update_app_item",
    "Обновить существующий элемент приложения по UUID. " +
      "Принимает объект data с кодами полей и новыми значениями. Обновляются только указанные поля.",
    updateAppItemSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleUpdateAppItem(params) }],
    }),
  );

  return server;
}

async function main() {
  const args = process.argv.slice(2);
  const httpFlag = args.includes("--http");
  const portIndex = args.indexOf("--port");
  const port = portIndex !== -1 ? parseInt(args[portIndex + 1], 10) : 3000;

  const server = createServer();

  if (httpFlag) {
    // Динамический импорт HTTP-транспорта
    const { startHttpTransport } = await import("./transport/http.js");
    await startHttpTransport(server, port);
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(
      `[elma365-mcp] Сервер запущен (stdio). ${TOOL_COUNT} инструментов. ELMA365_DOMAIN + ELMA365_TOKEN обязательны.`,
    );
  }
}

main().catch((error) => {
  console.error("[elma365-mcp] Критическая ошибка:", error);
  process.exit(1);
});
