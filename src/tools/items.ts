import { z } from "zod";
import { elmaRequest } from "../client.js";

// ─── get_app_item ─────────────────────────────────────────────────

export const getAppItemSchema = z.object({
  namespace: z.string().describe("Код раздела (namespace), например 'crm'"),
  code: z.string().describe("Код приложения, например 'companies'"),
  id: z.string().describe("UUID элемента приложения"),
});

export async function handleGetAppItem(
  params: z.infer<typeof getAppItemSchema>,
): Promise<string> {
  const result = await elmaRequest(
    "GET",
    `app/${params.namespace}/${params.code}/${params.id}/get`,
  );

  return JSON.stringify(result, null, 2);
}


