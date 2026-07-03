import { z } from "zod";
import { elmaRequest } from "../client.js";

// ─── discover_apps ───────────────────────────────────────────────

export const discoverAppsSchema = z.object({
  namespace: z
    .string()
    .optional()
    .describe("Код раздела (namespace) для фильтрации. Если не указан — возвращаются приложения всех разделов."),
});

interface AppInfo {
  namespace: string;
  code: string;
  name: string;
  sectionName?: string;
  status?: string;
}

function buildQueryParam(namespace?: string): string {
  const query: Record<string, unknown> = { size: 10000 };
  if (namespace) {
    query.filter = { tf: { namespace } };
  }
  return JSON.stringify(query);
}

export async function handleDiscoverApps(
  params: z.infer<typeof discoverAppsSchema>,
): Promise<string> {
  let result: unknown = null;
  let lastError: string = "";

  const queryValue = buildQueryParam(params.namespace);

  // Пробуем GET /app/list?query=... (основной способ)
  try {
    result = await elmaRequest("GET", "app/list", undefined, { query: queryValue });
  } catch (e) {
    lastError = String(e);

    // Фолбэк: POST /app/list с фильтром в теле
    try {
      const body: Record<string, unknown> = {};
      if (params.namespace) {
        body.filter = { tf: { namespace: params.namespace } };
      }
      result = await elmaRequest("POST", "app/list", body);
    } catch (e2) {
      lastError = `${lastError} | ${String(e2)}`;

      // Фолбэк 2: GET /scheme/app
      try {
        result = await elmaRequest("GET", "scheme/app", undefined, { query: queryValue });
      } catch (e3) {
        lastError = `${lastError} | ${String(e3)}`;
      }
    }
  }

  if (!result) {
    throw new Error(
      `Не удалось получить список приложений. Проверьте права доступа токена.\nОшибки: ${lastError}`,
    );
  }

  // Нормализуем ответ: возможные форматы:
  // 1. { success: true, result: { result: [...], total: N } }
  // 2. { data: [...], total: N }
  // 3. Просто массив
  const obj = result as Record<string, unknown>;
  let data: unknown;

  if (Array.isArray(result)) {
    data = result;
  } else if (obj.result != null && typeof obj.result === "object") {
    const inner = obj.result as Record<string, unknown>;
    data = inner.result ?? inner.data ?? inner;
  } else {
    data = obj.data ?? obj.items ?? result;
  }

  if (!Array.isArray(data)) {
    return JSON.stringify(result, null, 2);
  }

  const apps: AppInfo[] = (data as Array<Record<string, unknown>>).map((item) => ({
    namespace: String(item.namespace ?? item.__namespace ?? ""),
    code: String(item.code ?? item.__code ?? ""),
    name: String(item.name ?? item.__name ?? item.title ?? ""),
    sectionName: item.sectionName != null ? String(item.sectionName) : undefined,
    status: item.status != null ? String(item.status) : undefined,
  }));

  // Фильтруем по namespace если указан (на случай если API не отфильтровал)
  const filtered = params.namespace
    ? apps.filter((a) => a.namespace === params.namespace)
    : apps;

  return JSON.stringify({ apps: filtered, total: filtered.length }, null, 2);
}
