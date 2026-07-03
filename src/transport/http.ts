import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as http from "node:http";

/**
 * Запуск HTTP-транспорта для MCP-сервера (Streamable HTTP).
 * Используется для веб-клиентов и удалённого доступа.
 */
export async function startHttpTransport(
  server: McpServer,
  port: number,
): Promise<void> {
  const requestListener: http.RequestListener = async (req, res) => {
    // Health check
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", tools: 7 }));
      return;
    }

    // MCP endpoint — Streamable HTTP
    if (req.url === "/mcp" && req.method === "POST") {
      try {
        const body = await readBody(req);

        // Handle JSON-RPC request through the MCP server
        const response = await handleMcpRequest(server, body, req.headers);
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify(response));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  };

  const httpServer = http.createServer(requestListener);
  httpServer.listen(port, () => {
    console.error(
      `[elma365-mcp] HTTP-сервер запущен на http://localhost:${port}`,
    );
    console.error(`[elma365-mcp] MCP endpoint: http://localhost:${port}/mcp`);
    console.error(`[elma365-mcp] Health: http://localhost:${port}/health`);
  });

  // Keep alive
  await new Promise(() => {});
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function handleMcpRequest(
  server: McpServer,
  rawBody: string,
  headers: import("node:http").IncomingHttpHeaders,
): Promise<unknown> {
  const request = JSON.parse(rawBody);

  // В будущем здесь будет полноценная обработка JSON-RPC через MCP SDK
  // Пока возвращаем информацию о доступных инструментах
  if (request.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        tools: [
          {
            name: "discover_apps",
            description: "Получить список всех приложений ELMA365 с их кодами и названиями.",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "get_app_schema",
            description: "Получить схему приложения: все поля, их коды, типы и связи.",
            inputSchema: {
              type: "object",
              properties: {
                namespace: { type: "string" },
                code: { type: "string" },
              },
              required: ["namespace", "code"],
            },
          },
          {
            name: "search_app_items",
            description: "Поиск элементов приложения с использованием EQL-запроса.",
            inputSchema: {
              type: "object",
              properties: {
                namespace: { type: "string" },
                code: { type: "string" },
                eql: { type: "string" },
              },
              required: ["namespace", "code", "eql"],
            },
          },
          {
            name: "search_users",
            description: "Поиск пользователей по имени, фамилии, логину или email.",
            inputSchema: {
              type: "object",
              properties: {
                query: { type: "string" },
              },
              required: ["query"],
            },
          },
          {
            name: "get_app_item",
            description: "Получить один элемент приложения по UUID.",
            inputSchema: {
              type: "object",
              properties: {
                namespace: { type: "string" },
                code: { type: "string" },
                id: { type: "string" },
              },
              required: ["namespace", "code", "id"],
            },
          },
          {
            name: "create_app_item",
            description: "Создать новый элемент в приложении.",
            inputSchema: {
              type: "object",
              properties: {
                namespace: { type: "string" },
                code: { type: "string" },
                data: { type: "object" },
              },
              required: ["namespace", "code", "data"],
            },
          },
          {
            name: "update_app_item",
            description: "Обновить существующий элемент приложения.",
            inputSchema: {
              type: "object",
              properties: {
                namespace: { type: "string" },
                code: { type: "string" },
                id: { type: "string" },
                data: { type: "object" },
              },
              required: ["namespace", "code", "id", "data"],
            },
          },
        ],
      },
    };
  }

  return {
    jsonrpc: "2.0",
    id: request.id ?? null,
    error: {
      code: -32601,
      message: `Method not implemented: ${request.method}`,
    },
  };
}
