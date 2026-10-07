import { beforeAll, describe, expect, it } from "vitest";
import {
  changelogDeclaredCount,
  listServerTools,
  readmeDeclaredCount,
  readmeToolNames,
  type ServerTool,
} from "../helpers/tool-inventory.js";

let tools: ServerTool[] = [];

beforeAll(async () => {
  tools = await listServerTools();
});

describe("инвентарь инструментов", () => {
  it("сервер отдаёт хотя бы один инструмент", () => {
    expect(tools.length).toBeGreaterThan(0);
  });

  it("имена инструментов уникальны", () => {
    const names = tools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("у каждого инструмента непустое описание", () => {
    const empty = tools
      .filter((tool) => !tool.description?.trim())
      .map((tool) => tool.name);
    expect(empty).toEqual([]);
  });

  it("required — подмножество properties, у каждого параметра есть описание", () => {
    const problems: string[] = [];
    for (const tool of tools) {
      const properties = tool.inputSchema.properties ?? {};
      for (const key of tool.inputSchema.required ?? []) {
        if (!(key in properties)) {
          problems.push(`${tool.name}: required "${key}" отсутствует в properties`);
        }
      }
      for (const [key, value] of Object.entries(properties)) {
        if (!value?.description?.trim()) {
          problems.push(`${tool.name}: у параметра "${key}" нет description`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("документация и инвентарь согласованы", () => {
  it("README описывает ровно те инструменты, что отдаёт сервер", () => {
    const actual = new Set(tools.map((tool) => tool.name));
    const documented = readmeToolNames();
    const missing = [...actual].filter((name) => !documented.has(name)).sort();
    const extra = [...documented].filter((name) => !actual.has(name)).sort();
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it("заявленное число инструментов совпадает с фактическим", () => {
    expect(readmeDeclaredCount()).toBe(tools.length);
    expect(changelogDeclaredCount()).toBe(tools.length);
  });
});
