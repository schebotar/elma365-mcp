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
}

export async function handleDiscoverApps(
  params: z.infer<typeof discoverAppsSchema>,
): Promise<string> {
  const queryObj: Record<string, unknown> = { size: 10000 };
  if (params.namespace) {
    queryObj.filter = { tf: { namespace: params.namespace } };
  }
  const query = JSON.stringify(queryObj);

  const result = await elmaRequest("GET", "app/list", undefined, { query });

  // Ответ всегда: { success: true, result: { result: [...], total: N } }
  const obj = result as Record<string, unknown>;
  const inner = obj.result as Record<string, unknown> | undefined;
  const data = (inner?.result as Array<Record<string, unknown>>) ?? [];

  const apps: AppInfo[] = data.map((item) => ({
    namespace: String(item.namespace ?? item.__namespace ?? ""),
    code: String(item.code ?? item.__code ?? ""),
    name: String(item.name ?? item.__name ?? item.title ?? ""),
  }));

  return JSON.stringify({ apps, total: apps.length }, null, 2);
}
