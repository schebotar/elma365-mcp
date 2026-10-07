import { z } from "zod";
import { elmaRequest } from "../client.js";

/**
 * Инструменты для работы с процессами (BPM) ELMA365.
 * namespace для процессов приложения — "раздел.приложение" (напр. "example_namespace.example_app"),
 * для процессов модуля — код модуля.
 */

const NAMESPACE_DESCRIPTION =
  "Код раздела или модуля. Для процесса приложения — 'раздел.приложение' " +
  "(напр. 'example_namespace.example_app'); для модульного процесса — код модуля.";

function apiError(result: Record<string, unknown>): string {
  return JSON.stringify(
    { success: false, error: String(result.error ?? "Неизвестная ошибка API") },
    null,
    2,
  );
}

// ─── run_process ─────────────────────────────────────────────────

export const runProcessSchema = z.object({
  namespace: z.string().describe(NAMESPACE_DESCRIPTION),
  code: z
    .string()
    .describe("Код процесса (шаблона), напр. 'example_process'"),
  context: z
    .record(z.unknown())
    .optional()
    .describe(
      "Контекст запуска. Ссылочные поля — массивами: SYS_COLLECTION — [\"uuid\"], " +
        "REF_ITEM — [{\"id\":\"uuid\",\"code\":\"...\",\"namespace\":\"...\"}]. " +
        'Даты — "YYYY-MM-DDT00:00:00Z".',
    ),
});

export async function handleRunProcess(
  params: z.infer<typeof runProcessSchema>,
): Promise<string> {
  const result = await elmaRequest(
    "POST",
    `bpm/template/${params.namespace}/${params.code}/run`,
    { context: params.context ?? {} },
  );

  const obj = (result ?? {}) as Record<string, unknown>;
  if (obj.success === false) {
    return apiError(obj);
  }

  const instance = obj.context ?? obj.data ?? obj.result ?? obj;
  return JSON.stringify({ started: true, instance }, null, 2);
}

// ─── search_process_instances ────────────────────────────────────

export const searchProcessInstancesSchema = z.object({
  namespace: z.string().describe(NAMESPACE_DESCRIPTION),
  code: z.string().describe("Код процесса (шаблона)"),
  active: z
    .boolean()
    .optional()
    .describe("Только активные (не завершённые) экземпляры"),
  size: z.number().optional().describe("Количество (по умолчанию 50, макс. 10000)"),
  from: z.number().optional().describe("Смещение (по умолчанию 0)"),
  sortExpressions: z
    .array(z.object({ field: z.string(), ascending: z.boolean() }))
    .optional()
    .describe('Сортировка, напр. [{"field": "__createdAt", "ascending": false}]'),
  filter: z
    .record(z.unknown())
    .optional()
    .describe(
      "Структурный фильтр (eq/and/or, как в app/list). Ловушки: фильтр по __createdAt не применяется — " +
        "используйте __updatedAt; поле __item требует RefItem-значение.",
    ),
});

export async function handleSearchProcessInstances(
  params: z.infer<typeof searchProcessInstancesSchema>,
): Promise<string> {
  const body: Record<string, unknown> = {
    from: params.from ?? 0,
    size: params.size ?? 50,
  };
  if (params.active !== undefined) body.active = params.active;
  if (params.sortExpressions) body.sortExpressions = params.sortExpressions;
  if (params.filter) body.filter = params.filter;

  const result = await elmaRequest(
    "POST",
    `bpm/instance/bytemplate/${params.namespace}/${params.code}/list`,
    body,
  );

  const obj = (result ?? {}) as Record<string, unknown>;
  if (obj.success === false) {
    return apiError(obj);
  }

  const inner = obj.result as Record<string, unknown> | undefined;
  const instances = (inner?.result as unknown[]) ?? [];
  const total = (inner?.total as number) ?? instances.length;

  return JSON.stringify(
    { total, from: params.from ?? 0, size: params.size ?? 50, instances },
    null,
    2,
  );
}

// ─── get_process_instance ────────────────────────────────────────

export const getProcessInstanceSchema = z.object({
  id: z.string().describe("UUID экземпляра процесса"),
});

export async function handleGetProcessInstance(
  params: z.infer<typeof getProcessInstanceSchema>,
): Promise<string> {
  const result = await elmaRequest("POST", `bpm/instance/${params.id}/get`, {});

  const obj = (result ?? {}) as Record<string, unknown>;
  if (obj.success === false) {
    return apiError(obj);
  }

  const instance = obj.data ?? obj.context ?? obj.result ?? obj;
  return JSON.stringify(instance, null, 2);
}

// ─── interrupt_process_instance ──────────────────────────────────

export const interruptProcessInstanceSchema = z.object({
  id: z.string().describe("UUID экземпляра процесса"),
  comment: z.string().optional().describe("Причина прерывания (комментарий)"),
});

export async function handleInterruptProcessInstance(
  params: z.infer<typeof interruptProcessInstanceSchema>,
): Promise<string> {
  const body: Record<string, unknown> = {};
  if (params.comment) body.comment = params.comment;

  const result = await elmaRequest(
    "POST",
    `bpm/instance/${params.id}/interrupt`,
    body,
  );

  const obj = (result ?? {}) as Record<string, unknown>;
  if (obj.success === false) {
    return apiError(obj);
  }

  return JSON.stringify({ interrupted: true, result: obj }, null, 2);
}

// ─── update_process_instance_context ─────────────────────────────

export const updateProcessInstanceContextSchema = z.object({
  id: z.string().describe("UUID экземпляра процесса"),
  comment: z.string().describe("Причина изменения контекста (обязательное поле)"),
  context: z.record(z.unknown()).describe("Новый контекст бизнес-процесса"),
});

export async function handleUpdateProcessInstanceContext(
  params: z.infer<typeof updateProcessInstanceContextSchema>,
): Promise<string> {
  const result = await elmaRequest("PUT", `bpm/instance/${params.id}/context`, {
    comment: params.comment,
    context: params.context,
  });

  const obj = (result ?? {}) as Record<string, unknown>;
  if (obj.success === false) {
    return apiError(obj);
  }

  return JSON.stringify({ updated: true, result: obj }, null, 2);
}

// ─── skip_process_instance_step ──────────────────────────────────

export const skipProcessInstanceStepSchema = z.object({
  id: z.string().describe("UUID экземпляра процесса"),
});

export async function handleSkipProcessInstanceStep(
  params: z.infer<typeof skipProcessInstanceStepSchema>,
): Promise<string> {
  const result = await elmaRequest(
    "POST",
    `bpm/instance/${params.id}/skip-step`,
    {},
  );

  const obj = (result ?? {}) as Record<string, unknown>;
  if (obj.success === false) {
    return apiError(obj);
  }

  return JSON.stringify({ skipped: true, result: obj }, null, 2);
}
