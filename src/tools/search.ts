import { z } from "zod";
import { elmaRequest } from "../client.js";

// ─── search_app_items ────────────────────────────────────────────

export const searchAppItemsSchema = z.object({
  namespace: z.string().describe("Код раздела (namespace), например 'crm'"),
  code: z.string().describe("Код приложения, например 'companies'"),
  eql: z
    .string()
    .describe(
      "EQL-запрос для фильтрации элементов. Примеры:\n" +
        "- [company_name] = 'АвтоПром'\n" +
        "- [__createdAt] > RelativeDatetime('-20d','0d')\n" +
        "- [__createdBy] = 'uuid-пользователя' and [status] = 'active'\n" +
        "- [contract] in (select [__id] from [crm.contracts] where [total] > 10000)\n" +
        "Системные поля: __id, __createdAt, __createdBy, __updatedAt, __updatedBy, __name",
    ),
  size: z.number().optional().describe("Количество возвращаемых элементов (по умолчанию 50, макс. 10000)"),
  from: z.number().optional().describe("Смещение для пагинации (по умолчанию 0)"),
  fields: z
    .array(z.string())
    .optional()
    .describe("Список кодов полей для включения в ответ. Если не указан — возвращаются все поля."),
});

export async function handleSearchAppItems(
  params: z.infer<typeof searchAppItemsSchema>,
): Promise<string> {
  const body: Record<string, unknown> = {
    size: params.size ?? 50,
    from: params.from ?? 0,
    filter: {
      eql: {
        query: params.eql,
      },
    },
  };

  if (params.fields) {
    body.fields = params.fields;
  }

  const result = await elmaRequest(
    "POST",
    `app/${params.namespace}/${params.code}/list`,
    body,
  );

  const data = result as Record<string, unknown>;
  const items = data.data ?? data.items ?? data;
  const total = data.total ?? (Array.isArray(items) ? (items as unknown[]).length : "unknown");

  return JSON.stringify(
    {
      total,
      size: params.size ?? 50,
      from: params.from ?? 0,
      items,
    },
    null,
    2,
  );
}
