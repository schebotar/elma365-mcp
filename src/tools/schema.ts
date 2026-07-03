import { z } from "zod";
import { elmaRequest } from "../client.js";

// ─── get_app_schema ──────────────────────────────────────────────

export const getAppSchemaSchema = z.object({
  namespace: z.string().describe("Код раздела (namespace), например 'crm'"),
  code: z.string().describe("Код приложения, например 'companies'"),
});

interface FieldInfo {
  code: string;
  name: string;
  type: string;
  required?: boolean;
  multiple?: boolean;
  refApp?: string; // для полей типа «Приложение» — связанное приложение
  enumValues?: string[]; // для полей типа «Категория»
}

interface AppSchema {
  namespace: string;
  code: string;
  name: string;
  fields: FieldInfo[];
  statuses?: unknown[];
}

export async function handleGetAppSchema(
  params: z.infer<typeof getAppSchemaSchema>,
): Promise<string> {
  // Пробуем несколько возможных путей для получения схемы
  const endpoints = [
    `scheme/app/${params.namespace}/${params.code}`,
    `app/${params.namespace}/${params.code}`,
    `app/${params.namespace}/${params.code}/status`,
  ];

  let result: Record<string, unknown> | null = null;
  let lastError: string = "";

  for (const ep of endpoints) {
    try {
      result = (await elmaRequest("GET", ep)) as Record<string, unknown>;
      break;
    } catch (e) {
      lastError = String(e);
      try {
        result = (await elmaRequest("POST", ep)) as Record<string, unknown>;
        break;
      } catch (e2) {
        lastError = `${lastError} | ${String(e2)}`;
      }
    }
  }

  if (!result) {
    throw new Error(
      `Не удалось получить схему приложения ${params.namespace}/${params.code}.\nОшибки: ${lastError}`,
    );
  }

  // Извлекаем поля из разных возможных форматов ответа
  const rawFields: Array<Record<string, unknown>> =
    (result.fields as Array<Record<string, unknown>>) ??
    (result.scheme as Array<Record<string, unknown>>) ??
    (result.properties as Array<Record<string, unknown>>) ??
    [];

  const fields: FieldInfo[] = rawFields.map((f) => {
    const type = String(f.type ?? f.fieldType ?? "string");
    const refApp = f.refApp ?? f.appCode ?? f.linkApp;
    return {
      code: String(f.code ?? f.__code ?? f.name ?? ""),
      name: String(f.title ?? f.label ?? f.name ?? f.code ?? ""),
      type,
      required: Boolean(f.required ?? false),
      multiple: Boolean(f.multiple ?? f.array ?? false),
      refApp: refApp != null ? String(refApp) : undefined,
      enumValues: Array.isArray(f.enumValues ?? f.values) ? (f.enumValues ?? f.values) as string[] : undefined,
    };
  });

  const schema: AppSchema = {
    namespace: params.namespace,
    code: params.code,
    name: String(result.name ?? result.title ?? result.__name ?? `${params.namespace}/${params.code}`),
    fields,
    statuses: (result.statuses ?? result.statusList) as unknown[] | undefined,
  };

  return JSON.stringify(schema, null, 2);
}
