import { z } from "zod";
import { elmaRequest } from "../client.js";

/**
 * Инструменты метаданных ELMA365 (scheme) — только чтение.
 * Списки и схемы разделов, решений, приложений, процессов, модулей, виджетов,
 * контрактов, отчётов, страниц, шаблонов документов и групп оргструктуры.
 */

export interface MetadataToolDef {
  name: string;
  description: string;
  shape: Record<string, z.ZodTypeAny>;
  handler: (params: any) => Promise<string>;
}

function apiError(obj: Record<string, unknown>): string {
  return JSON.stringify(
    { success: false, error: String(obj.error ?? "Неизвестная ошибка API") },
    null,
    2,
  );
}

function normalizeList(result: unknown): string {
  const obj = (result ?? {}) as Record<string, unknown>;
  if (obj.success === false) return apiError(obj);
  const root = obj.result ?? obj;
  if (Array.isArray(root)) {
    return JSON.stringify({ total: root.length, items: root }, null, 2);
  }
  if (root && typeof root === "object") {
    const inner = root as Record<string, unknown>;
    if (Array.isArray(inner.result)) {
      return JSON.stringify(
        { total: inner.total ?? inner.result.length, items: inner.result },
        null,
        2,
      );
    }
  }
  return JSON.stringify(result, null, 2);
}

function normalizeGet(result: unknown): string {
  const obj = (result ?? {}) as Record<string, unknown>;
  if (obj.success === false) return apiError(obj);
  return JSON.stringify(obj.result ?? obj, null, 2);
}

const list = async (endpoint: string) => normalizeList(await elmaRequest("GET", endpoint));
const get = async (endpoint: string) => normalizeGet(await elmaRequest("GET", endpoint));

const PROCESS_NAMESPACE_DESCRIPTION =
  "Код раздела или модуля. Для процесса приложения — 'раздел.приложение' " +
  "(напр. 'contract_management.contract'); для модульного процесса — код модуля.";

export const metadataTools: MetadataToolDef[] = [
  {
    name: "get_namespaces",
    description: "Список разделов (namespace) ELMA365 с их кодами и названиями.",
    shape: {},
    handler: async () => list("scheme/namespaces"),
  },
  {
    name: "get_namespace",
    description: "Схема раздела по коду.",
    shape: { code: z.string().describe("Код раздела (namespace)") },
    handler: async (p) => get(`scheme/namespaces/${p.code}`),
  },
  {
    name: "get_solutions",
    description: "Список решений ELMA365.",
    shape: {},
    handler: async () => list("scheme/solutions"),
  },
  {
    name: "get_solution",
    description: "Схема решения по коду.",
    shape: { code: z.string().describe("Код решения") },
    handler: async (p) => get(`scheme/solutions/${p.code}`),
  },
  {
    name: "get_namespace_apps",
    description: "Список приложений раздела (полные схемы).",
    shape: { namespace: z.string().describe("Код раздела (namespace)") },
    handler: async (p) => list(`scheme/namespaces/${p.namespace}/apps`),
  },
  {
    name: "get_process_schema",
    description:
      "Полная схема шаблона процесса: контекст, блоки и переходы. " +
      "Используй перед run_process, чтобы узнать поля контекста. " +
      "Для процесса приложения передай namespace как 'раздел.приложение'.",
    shape: {
      namespace: z.string().describe(PROCESS_NAMESPACE_DESCRIPTION),
      code: z.string().describe("Код процесса (шаблона)"),
    },
    handler: async (p) => get(`scheme/namespaces/${p.namespace}/processes/${p.code}`),
  },
  {
    name: "get_process_forms",
    description: "Формы бизнес-процесса (задачи, стартовая форма и т.п.).",
    shape: {
      namespace: z.string().describe(PROCESS_NAMESPACE_DESCRIPTION),
      code: z.string().describe("Код процесса (шаблона)"),
    },
    handler: async (p) => get(`scheme/namespaces/${p.namespace}/processes/${p.code}/forms`),
  },
  {
    name: "get_modules",
    description: "Список модулей ELMA365.",
    shape: {},
    handler: async () => list("scheme/modules"),
  },
  {
    name: "get_module",
    description: "Схема модуля по идентификатору.",
    shape: { id: z.string().describe("Идентификатор модуля") },
    handler: async (p) => get(`scheme/modules/${p.id}`),
  },
  {
    name: "get_widgets",
    description: "Список виджетов раздела.",
    shape: { namespace: z.string().describe("Код раздела (namespace)") },
    handler: async (p) => list(`scheme/namespaces/${p.namespace}/widgets`),
  },
  {
    name: "get_widget",
    description: "Схема виджета по коду и разделу.",
    shape: {
      namespace: z.string().describe("Код раздела (namespace)"),
      code: z.string().describe("Код виджета"),
    },
    handler: async (p) => get(`scheme/namespaces/${p.namespace}/widgets/${p.code}`),
  },
  {
    name: "get_contract_schemas",
    description: "Список схем контрактов раздела.",
    shape: { namespace: z.string().describe("Код раздела (namespace)") },
    handler: async (p) => list(`scheme/namespaces/${p.namespace}/contracts`),
  },
  {
    name: "get_contract_schema",
    description: "Схема контракта по коду.",
    shape: {
      namespace: z.string().describe("Код раздела (namespace)"),
      code: z.string().describe("Код контракта"),
    },
    handler: async (p) => get(`scheme/namespaces/${p.namespace}/contracts/${p.code}`),
  },
  {
    name: "get_report_schemas",
    description: "Список схем отчётов раздела.",
    shape: { namespace: z.string().describe("Код раздела (namespace)") },
    handler: async (p) => list(`scheme/namespaces/${p.namespace}/reports`),
  },
  {
    name: "get_report_schema",
    description: "Схема отчёта по коду.",
    shape: {
      namespace: z.string().describe("Код раздела (namespace)"),
      code: z.string().describe("Код отчёта"),
    },
    handler: async (p) => get(`scheme/namespaces/${p.namespace}/reports/${p.code}`),
  },
  {
    name: "get_pages",
    description: "Список страниц раздела.",
    shape: { namespace: z.string().describe("Код раздела (namespace)") },
    handler: async (p) => list(`scheme/namespaces/${p.namespace}/pages`),
  },
  {
    name: "get_page",
    description: "Схема страницы по идентификатору.",
    shape: { id: z.string().describe("Идентификатор страницы") },
    handler: async (p) => get(`scheme/pages/${p.id}`),
  },
  {
    name: "get_document_templates",
    description: "Список шаблонов документов раздела или приложения.",
    shape: {
      namespace: z.string().describe("Код раздела (namespace)"),
      code: z.string().optional().describe("Код приложения (опционально)"),
    },
    handler: async (p) =>
      list(
        p.code
          ? `scheme/namespaces/${p.namespace}/apps/${p.code}/doctemplates`
          : `scheme/namespaces/${p.namespace}/doctemplates`,
      ),
  },
  {
    name: "get_document_template",
    description: "Схема шаблона документа по идентификатору.",
    shape: { id: z.string().describe("Идентификатор шаблона документа") },
    handler: async (p) => get(`scheme/doctemplates/${p.id}`),
  },
  {
    name: "get_groups",
    description: "Список групп оргструктуры раздела.",
    shape: { namespace: z.string().describe("Код раздела (namespace)") },
    handler: async (p) => list(`scheme/namespaces/${p.namespace}/groups`),
  },
  {
    name: "get_group",
    description: "Схема группы оргструктуры по идентификатору.",
    shape: { id: z.string().describe("Идентификатор группы") },
    handler: async (p) => get(`scheme/groups/${p.id}`),
  },
  {
    name: "get_group_users",
    description: "Пользователи, включённые в состав группы.",
    shape: { id: z.string().describe("Идентификатор группы") },
    handler: async (p) => list(`scheme/groups/${p.id}/users`),
  },
  {
    name: "get_group_positions",
    description: "Должности, включённые в состав группы.",
    shape: { id: z.string().describe("Идентификатор группы") },
    handler: async (p) => list(`scheme/groups/${p.id}/positions`),
  },
  {
    name: "get_group_subgroups",
    description: "Подгруппы выбранной группы.",
    shape: { id: z.string().describe("Идентификатор группы") },
    handler: async (p) => list(`scheme/groups/${p.id}/sub-groups`),
  },
  {
    name: "get_group_parent_groups",
    description: "Группы, в которые входит выбранная группа.",
    shape: { id: z.string().describe("Идентификатор группы") },
    handler: async (p) => list(`scheme/groups/${p.id}/parent-groups`),
  },
];
