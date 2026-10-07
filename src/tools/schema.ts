import { z } from "zod";
import { elmaRequest } from "../client.js";
import { getCached, setCached } from "../cache.js";

// ─── get_app_schema ──────────────────────────────────────────────

export const getAppSchemaSchema = z.object({
  namespace: z.string().describe("Код раздела (namespace), например 'crm'"),
  code: z.string().describe("Код приложения, например 'companies'"),
});

interface FieldInfo {
  code: string;
  type: string;
  required: boolean;
  array: boolean;
  single: boolean;
  indexed: boolean;
  searchable: boolean;
  title: string;
}

interface FormFieldInfo {
  code: string;
  title: string;
  required: boolean;
  readonly: boolean;
}

interface SchemaResult {
  name: string;
  namespace: string;
  code: string;
  type: string;
  fields: FieldInfo[];
  forms: {
    create?: FormFieldInfo[];
    view?: FormFieldInfo[];
    edit?: FormFieldInfo[];
    detail?: FormFieldInfo[];
    tile?: FormFieldInfo[];
  };
}

export async function handleGetAppSchema(
  params: z.infer<typeof getAppSchemaSchema>,
): Promise<string> {
  const cacheKey = `${params.namespace}/${params.code}`;

  const cached = getCached<SchemaResult>(cacheKey);
  if (cached) {
    return JSON.stringify({ ...cached, _cached: true }, null, 2);
  }

  const result = (await elmaRequest(
    "GET",
    `scheme/namespaces/${params.namespace}/apps/${params.code}`,
  )) as Record<string, unknown>;

  const app = (result.application ?? result) as Record<string, unknown>;
  const rawFields = (app.fields as Array<Record<string, unknown>>) ?? [];
  const rawForms = (app.forms ?? {}) as Record<string, unknown>;

  const fields: FieldInfo[] = rawFields
    .filter((f) => !f.deleted)
    .map((f) => ({
      code: String(f.code ?? ""),
      type: String(f.type ?? ""),
      required: Boolean(f.required),
      array: Boolean(f.array),
      single: Boolean(f.single),
      indexed: Boolean(f.indexed),
      searchable: Boolean(f.searchable),
      title: String(((f.view as Record<string, unknown>)?.name ?? f.code) ?? ""),
    }));

  const mapFormFields = (
    formObj: Record<string, unknown> | undefined,
  ): FormFieldInfo[] => {
    if (!formObj) return [];
    const formFields = (formObj.fields as Array<Record<string, unknown>>) ?? [];
    return formFields.map((ff) => ({
      code: String(ff.code ?? ""),
      title: String(ff.display ?? ff.code ?? ""),
      required: Boolean(ff.required),
      readonly: Boolean(ff.readonly),
    }));
  };

  const schema: SchemaResult = {
    name: String(app.name ?? ""),
    namespace: String(app.namespace ?? params.namespace),
    code: String(app.code ?? params.code),
    type: String(app.type ?? ""),
    fields,
    forms: {
      create: mapFormFields(rawForms.create as Record<string, unknown> | undefined),
      view: mapFormFields(rawForms.view as Record<string, unknown> | undefined),
      edit: mapFormFields(rawForms.edit as Record<string, unknown> | undefined),
      detail: mapFormFields(rawForms.detail as Record<string, unknown> | undefined),
      tile: mapFormFields(rawForms.tile as Record<string, unknown> | undefined),
    },
  };

  setCached(cacheKey, schema);

  return JSON.stringify(schema, null, 2);
}

// ─── get_app_statuses ────────────────────────────────────────────

export const getAppStatusesSchema = z.object({
  namespace: z.string().describe("Код раздела (namespace)"),
  code: z.string().describe("Код приложения"),
});

interface StatusGroup {
  id: string;
  code: string;
  name: string;
}

interface StatusItem {
  id: number;
  code: string;
  name: string;
  groupId: string;
}

interface StatusesResult {
  groups: StatusGroup[];
  statuses: StatusItem[];
}

export async function handleGetAppStatuses(
  params: z.infer<typeof getAppStatusesSchema>,
): Promise<string> {
  const cacheKey = `statuses/${params.namespace}/${params.code}`;

  const cached = getCached<StatusesResult>(cacheKey);
  if (cached) {
    return JSON.stringify({ ...cached, _cached: true }, null, 2);
  }

  const result = (await elmaRequest(
    "GET",
    `app/${params.namespace}/${params.code}/settings/status`,
  )) as Record<string, unknown>;

  const groups: StatusGroup[] = (
    (result.groupItems as Array<Record<string, unknown>>) ?? []
  ).map((g) => ({
    id: String(g.id ?? ""),
    code: String(g.code ?? ""),
    name: String(g.name ?? ""),
  }));

  const statuses: StatusItem[] = (
    (result.statusItems as Array<Record<string, unknown>>) ?? []
  ).map((s) => ({
    id: Number(s.id),
    code: String(s.code ?? ""),
    name: String(s.name ?? ""),
    groupId: String(s.groupId ?? ""),
  }));

  const data: StatusesResult = { groups, statuses };
  setCached(cacheKey, data);

  return JSON.stringify(data, null, 2);
}

// ─── get_app_fields ──────────────────────────────────────────────

export const getAppFieldsSchema = z.object({
  namespace: z.string().describe("Код раздела (namespace)"),
  code: z.string().describe("Код приложения"),
});

export async function handleGetAppFields(
  params: z.infer<typeof getAppFieldsSchema>,
): Promise<string> {
  const cacheKey = `${params.namespace}/${params.code}`;

  // Пробуем взять из кэша схемы
  const cached = getCached<SchemaResult>(cacheKey);
  if (cached) {
    const compact = cached.fields.map((f) => ({
      code: f.code,
      type: f.type,
      required: f.required,
      array: f.array,
      title: f.title,
    }));
    return JSON.stringify({ fields: compact, _cached: true }, null, 2);
  }

  // Кэша нет — идём в API и попутно кэшируем
  const schemaJson = await handleGetAppSchema(params);
  const schema = JSON.parse(schemaJson) as SchemaResult;

  const compact = schema.fields.map((f) => ({
    code: f.code,
    type: f.type,
    required: f.required,
    array: f.array,
    title: f.title,
  }));

  return JSON.stringify({ fields: compact }, null, 2);
}

// ─── get_process_templates ───────────────────────────────────────

export const getProcessTemplatesSchema = z.object({
  namespace: z
    .string()
    .describe("Код раздела (namespace), например 'contract_management'"),
  code: z
    .string()
    .optional()
    .describe("Код приложения. Если указан — только шаблоны процессов этого приложения."),
});

export async function handleGetProcessTemplates(
  params: z.infer<typeof getProcessTemplatesSchema>,
): Promise<string> {
  const endpoint = params.code
    ? `scheme/namespaces/${params.namespace}/apps/${params.code}/processes`
    : `scheme/namespaces/${params.namespace}/processes`;

  const result = (await elmaRequest("GET", endpoint)) as Record<string, unknown>;

  if (result.success === false) {
    return JSON.stringify(
      { error: String(result.error ?? "Неизвестная ошибка API") },
      null,
      2,
    );
  }

  const root = (result.result ?? result) as unknown;
  let list: unknown[] = [];
  if (Array.isArray(root)) {
    list = root;
  } else if (
    root &&
    typeof root === "object" &&
    Array.isArray((root as Record<string, unknown>).result)
  ) {
    list = (root as Record<string, unknown>).result as unknown[];
  }

  const processes = (list as Array<Record<string, unknown>>).map((p) => ({
    code: String(p.code ?? p.__code ?? ""),
    name: String(p.name ?? p.__name ?? p.title ?? ""),
    type: String(p.type ?? p.__type ?? ""),
  }));

  return JSON.stringify({ total: processes.length, processes }, null, 2);
}
