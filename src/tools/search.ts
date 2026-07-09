import { z } from "zod";
import { elmaRequest } from "../client.js";

// ─── search_app_items ────────────────────────────────────────────

export const searchAppItemsSchema = z.object({
  namespace: z.string().describe("Код раздела (namespace), например 'crm'"),
  code: z.string().describe("Код приложения, например 'companies'"),
  eql: z
    .string()
    .describe(
      "EQL-запрос для фильтрации элементов. Предварительно вызови get_app_schema или get_app_fields чтобы узнать имена полей.\n" +
        "Для полей с array:true используй IN вместо = (операция = неприменима к подтипу «Несколько»).\n" +
        "Примеры:\n" +
        "- [company_name] = 'АвтоПром'\n" +
        "- [company_name] likef 'Авто%' — LIKEF + wildcard: % (любое кол-во символов), _ (один символ)\n" +
        "  LIKEF ищет ТОЧНОЕ совпадение с шаблоном (в отличие от LIKE — подстрока в любом месте).\n" +
        "  Примеры: likef 'Иван' (только Иван), likef 'Иван%' (начинается с), likef '_x%' (второй символ x),\n" +
        "    likef '%@example.com' (оканчивается на), likef '\\%буквально%' (экранирование \\% \\_).\n" +
        "  LIKE vs LIKEF: like 'Иван' найдёт Иванов/Иванович; likef 'Иван' — только Иван.\n" +
        "- [status] in ('active', 'draft') — множество значений, без пробелов внутри скобок\n" +
        "- [__createdAt] >= Datetime(2025, 1, 31) — не используй = для дат, точное совпадение маловероятно\n" +
        "- [__createdAt] > RelativeDatetime('-20d','0d')\n" +
        "- [__createdBy] = 'uuid-пользователя' and [__status] = 1 — статус задаётся числовым ID\n" +
        "- [contract] in (select [__id] from [crm.contracts] where [total] > 10000)\n" +
        "- [contract] in (from [crm.contracts] select [__id] where [total] > 10000) — вариант FROM_SELECT_WHERE\n" +
        "Подзапросы и PARENT/ROOT:\n" +
        "  PARENT — ссылка на приложение уровнем выше. ROOT — ссылка на корневое (самое внешнее) приложение.\n" +
        "  Примеры с PARENT:\n" +
        "    count(from [orders.products] where parent.[product_number] = [product_number]) > 1 — дубликаты артикулов\n" +
        "    count(from [docs.contracts] where parent.[__id] in [client] and [total] > 10000) > 2 — >2 договоров >10000\n" +
        "Логические операторы:\n" +
        "  AND — все условия: [field1] = 1 and [field2] = 2\n" +
        "  OR — любое из условий: [field1] = 1 or [field2] = 2\n" +
        "  NOT — отрицание (ставится ПЕРЕД условием).\n" +
        "    ЗАПРЕЩЕНО: [field] is not null, [field] not in (...), [field] not like '...'\n" +
        "    ПРАВИЛЬНО: not [field] is null, not [field] in ('a','b'),\n" +
        "    not ([a] like 'x' or [b] like 'y') — отрицание группы в скобках.\n" +
        "    (not [a] = 'x') and [a] like 'y' — НЕ равно x, но содержит y.\n" +
        "Для поиска пользователей используй search_users вместо кросс-подзапроса к _system_catalogs.\n" +
        "Функции:\n" +
        "  Datetime(год[,месяц,день,час,мин,сек,'часовой_пояс']) — дата, обязателен только год. Строки: 'Today','Now'.\n" +
        "  Time(час[,мин,сек]) — время, обязателен только час.\n" +
        "  RelativeDatetime('start','end') — период от тек. даты. Только с = или IN. Формат: '-7d','+1m','0w','0y' и т.д.\n" +
        "    Разряды: y(год), q(квартал), m(месяц), w(неделя), d(день), h(час). start < end.\n" +
        "    Примеры: [d] IN RelativeDatetime('0d','0d') — сегодня; ('-7d','-1d') — прошлые 7 дней; ('0y','0y') — тек. год.\n" +
        "  Count(свойство|подзапрос) — количество. count([orders]) > 3.\n" +
        "  Refitem('ns','code'[,'uuid']) — поиск по полю «Произвольное приложение». Или строкой: 'ns:code:uuid'.",
    ),
  size: z.number().optional().describe("Количество возвращаемых элементов (по умолчанию 50, макс. 10000)"),
  from: z.number().optional().describe("Смещение для пагинации (по умолчанию 0)"),
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

  const result = await elmaRequest(
    "POST",
    `app/${params.namespace}/${params.code}/list`,
    body,
  );

  const data = result as Record<string, unknown>;

  // Проверяем наличие ошибки от API
  if (data.success === false) {
    return JSON.stringify(
      {
        error: String(data.error ?? "Неизвестная ошибка API"),
        eql: params.eql,
      },
      null,
      2,
    );
  }

  const innerResult = data.result as Record<string, unknown> | undefined;
  const items = (innerResult?.result as unknown[]) ?? [];
  const total = (innerResult?.total as number) ?? items.length;

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