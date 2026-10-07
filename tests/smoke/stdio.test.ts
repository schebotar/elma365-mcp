// Smoke: собранный сервер поднимается по stdio из чужой рабочей папки
// и отдаёт тот же состав инструментов и версию, что и in-memory сервер.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";
import { ROOT, listServerTools } from "../helpers/tool-inventory.js";

describe("smoke: старт собранного сервера по stdio", () => {
  it("отдаёт tools/list и версию из package.json", async () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8"),
    ) as { version: string };
    const expected = (await listServerTools()).map((tool) => tool.name).sort();

    // Чужая рабочая папка: сервер обязан найти package.json относительно себя.
    const workdir = mkdtempSync(join(tmpdir(), "elma-smoke-"));

    const client = new Client({ name: "elma365-mcp-smoke", version: "0.0.0" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [join(ROOT, "dist", "index.js")],
      cwd: workdir,
      env: {
        ...process.env,
        ELMA365_DOMAIN: "example.invalid",
        ELMA365_TOKEN: "dummy",
      },
      stderr: "pipe",
    });

    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name).sort();
      expect(names).toEqual(expected);
      expect(client.getServerVersion()?.version).toBe(pkg.version);
    } finally {
      await client.close();
    }
  });
});
