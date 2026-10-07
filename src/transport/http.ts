import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as http from "node:http";
import { randomUUID } from "node:crypto";
import { createServer } from "../server.js";

/**
 * Сессии MCP: один сервер + транспорт на каждую сессию.
 * Streamable HTTP требует изоляции — нельзя шарить один McpServer между сессиями.
 */
const sessions = new Map<string, StreamableHTTPServerTransport>();

/**
 * Запуск HTTP-транспорта для MCP-сервера (Streamable HTTP / SSE).
 */
export async function startHttpTransport(
  _server: ReturnType<typeof createServer>,
  port: number,
): Promise<void> {
  const requestListener: http.RequestListener = async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "POST, GET, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Mcp-Session-Id, Accept",
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // Существующая сессия — делегируем
    if (sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId)!;
      if (req.method === "DELETE") {
        await transport.handleRequest(req, res);
        sessions.delete(sessionId);
      } else {
        await transport.handleRequest(req, res);
      }
      return;
    }

    // Новая сессия (initialize — без Mcp-Session-Id, POST)
    if (!sessionId && req.method === "POST") {
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };

      await server.connect(transport);
      await transport.handleRequest(req, res);

      // После handleRequest transport.sessionId уже установлен
      if (transport.sessionId) {
        sessions.set(transport.sessionId, transport);
      }
      return;
    }

    // GET без сессии — невалидный запрос
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "No session" },
        id: null,
      }),
    );
  };

  const httpServer = http.createServer(requestListener);
  httpServer.listen(port, () => {
    console.error(
      `[elma365-mcp] HTTP-сервер запущен на http://localhost:${port}`,
    );
    console.error(`[elma365-mcp] MCP endpoint: http://localhost:${port}/mcp`);
    console.error(`[elma365-mcp] Health: http://localhost:${port}/health`);
  });

  await new Promise(() => {});
}
