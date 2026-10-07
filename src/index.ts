#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

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
      "[elma365-mcp] Сервер запущен (stdio). ELMA365_DOMAIN + ELMA365_TOKEN обязательны.",
    );
  }
}

main().catch((error) => {
  console.error("[elma365-mcp] Критическая ошибка:", error);
  process.exit(1);
});
