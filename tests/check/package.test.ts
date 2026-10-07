import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, serverVersion } from "../helpers/tool-inventory.js";

describe("метаданные пакета и версия сервера", () => {
  it("serverInfo.version совпадает с версией package.json", async () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8"),
    ) as { version: string };
    expect(await serverVersion()).toBe(pkg.version);
  });

  it("package.json готов к публикации", () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8"),
    ) as {
      files?: string[];
      engines?: { node?: string };
      bin?: Record<string, string>;
      repository?: { url?: string };
      scripts?: Record<string, string>;
    };
    expect(pkg.files).toContain("dist");
    expect(pkg.engines?.node).toBeTruthy();
    expect(Object.keys(pkg.bin ?? {})).toContain("elma365-mcp");
    expect(pkg.repository?.url).toContain("github.com");
    expect(pkg.scripts?.prepublishOnly).toBeTruthy();
  });
});
