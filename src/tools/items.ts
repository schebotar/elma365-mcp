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

// ─── create_app_item ──────────────────────────────────────────────

export const createAppItemSchema = z.object({
  namespace: z.string().describe("Код раздела (namespace)"),
  code: z.string().describe("Код приложения"),
  data: z.record(z.unknown()).describe("Данные нового элемента: { 'field_code': value, ... }"),
});

export async function handleCreateAppItem(
  params: z.infer<typeof createAppItemSchema>,
): Promise<string> {
  const result = await elmaRequest(
    "POST",
    `app/${params.namespace}/${params.code}/create`,
    { context: params.data },
  );

  return JSON.stringify(result, null, 2);
}

// ─── update_app_item ──────────────────────────────────────────────

export const updateAppItemSchema = z.object({
  namespace: z.string().describe("Код раздела (namespace)"),
  code: z.string().describe("Код приложения"),
  id: z.string().describe("UUID элемента приложения"),
  data: z.record(z.unknown()).describe("Обновляемые поля: { 'field_code': newValue, ... }"),
});

export async function handleUpdateAppItem(
  params: z.infer<typeof updateAppItemSchema>,
): Promise<string> {
  const result = await elmaRequest(
    "POST",
    `app/${params.namespace}/${params.code}/${params.id}/update`,
    { context: params.data },
  );

  return JSON.stringify(result, null, 2);
}
