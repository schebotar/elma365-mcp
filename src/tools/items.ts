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

// ─── helpers ─────────────────────────────────────────────────────

function writeResult(result: unknown): string {
  const obj = (result ?? {}) as Record<string, unknown>;
  if (obj.success === false) {
    return JSON.stringify(
      { success: false, error: String(obj.error ?? "Неизвестная ошибка API") },
      null,
      2,
    );
  }
  const item = obj.item ?? obj.result ?? obj;
  return JSON.stringify({ success: true, item }, null, 2);
}

const CONTEXT_DESCRIPTION =
  "Поля элемента. Ссылочные поля передаются только массивами: " +
  'SYS_COLLECTION — ["uuid"], REF_ITEM («Произвольное приложение») — ' +
  '[{"id":"uuid","code":"...","namespace":"..."}]. ' +
  'Поле-перечисление — [{"code":"..."}]. ' +
  'Дата — "YYYY-MM-DDT00:00:00Z" (без сдвига часового пояса). ' +
  "Поле «Пользователи» (SYS_USER) — массив id пользователей (не сотрудников).";

// ─── create_app_item ─────────────────────────────────────────────

export const createAppItemSchema = z.object({
  namespace: z.string().describe("Код раздела (namespace), например 'crm'"),
  code: z.string().describe("Код приложения, например 'companies'"),
  context: z
    .record(z.unknown())
    .describe("Поля создаваемого элемента. " + CONTEXT_DESCRIPTION),
});

export async function handleCreateAppItem(
  params: z.infer<typeof createAppItemSchema>,
): Promise<string> {
  const result = await elmaRequest(
    "POST",
    `app/${params.namespace}/${params.code}/create`,
    { context: params.context },
  );

  return writeResult(result);
}

// ─── update_app_item ─────────────────────────────────────────────

export const updateAppItemSchema = z.object({
  namespace: z.string().describe("Код раздела (namespace)"),
  code: z.string().describe("Код приложения"),
  id: z.string().describe("UUID элемента приложения"),
  context: z
    .record(z.unknown())
    .describe("Изменяемые поля элемента. " + CONTEXT_DESCRIPTION),
});

export async function handleUpdateAppItem(
  params: z.infer<typeof updateAppItemSchema>,
): Promise<string> {
  const result = await elmaRequest(
    "POST",
    `app/${params.namespace}/${params.code}/${params.id}/update`,
    { context: params.context },
  );

  return writeResult(result);
}

// ─── set_app_item_status ─────────────────────────────────────────

export const setAppItemStatusSchema = z.object({
  namespace: z.string().describe("Код раздела (namespace)"),
  code: z.string().describe("Код приложения"),
  id: z.string().describe("UUID элемента приложения"),
  status: z
    .string()
    .describe("Код статуса, например 'valid' или 'closed'. Узнай коды через get_app_statuses."),
});

export async function handleSetAppItemStatus(
  params: z.infer<typeof setAppItemStatusSchema>,
): Promise<string> {
  const result = await elmaRequest(
    "POST",
    `app/${params.namespace}/${params.code}/${params.id}/set-status`,
    { status: { code: params.status } },
  );

  return writeResult(result);
}

// ─── delete_app_item ─────────────────────────────────────────────

export const deleteAppItemSchema = z.object({
  namespace: z.string().describe("Код раздела (namespace)"),
  code: z.string().describe("Код приложения"),
  id: z.string().describe("UUID элемента приложения"),
  deletedAt: z
    .string()
    .optional()
    .describe("ISO-время удаления. По умолчанию — текущее время."),
});

export async function handleDeleteAppItem(
  params: z.infer<typeof deleteAppItemSchema>,
): Promise<string> {
  const result = await elmaRequest(
    "POST",
    `app/${params.namespace}/${params.code}/${params.id}/update`,
    { context: { __deletedAt: params.deletedAt ?? new Date().toISOString() } },
  );

  return writeResult(result);
}

// ─── restore_app_item ────────────────────────────────────────────

export const restoreAppItemSchema = z.object({
  namespace: z.string().describe("Код раздела (namespace)"),
  code: z.string().describe("Код приложения"),
  id: z.string().describe("UUID элемента приложения"),
});

export async function handleRestoreAppItem(
  params: z.infer<typeof restoreAppItemSchema>,
): Promise<string> {
  const result = await elmaRequest(
    "POST",
    `app/${params.namespace}/${params.code}/${params.id}/update`,
    { context: { __deletedAt: null } },
  );

  return writeResult(result);
}


