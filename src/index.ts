#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Discovery tools
import {
  discoverAppsSchema,
  handleDiscoverApps,
} from "./tools/discover.js";

// Schema tools
import {
  getAppSchemaSchema,
  handleGetAppSchema,
  getAppStatusesSchema,
  handleGetAppStatuses,
  getAppFieldsSchema,
  handleGetAppFields,
} from "./tools/schema.js";

// Search tools
import {
  searchAppItemsSchema,
  handleSearchAppItems,
} from "./tools/search.js";

// Read tools
import {
  getAppItemSchema,
  handleGetAppItem,
} from "./tools/items.js";

// User tools
import {
  searchUsersSchema,
  handleSearchUsers,
  getUserSchema,
  handleGetUser,
} from "./tools/users.js";

const TOOL_COUNT = 8;

export function createServer(): McpServer {
  const server = new McpServer({
    name: "elma365-mcp",
    version: "1.0.0",
  });

  // ── Discovery ──────────────────────────────────────────────────

  server.tool(
    "discover_apps",
    "Получить список всех приложений ELMA365 с их кодами и названиями. " +
      "Используется для поиска нужного namespace и code приложения по его названию. " +
      "Можно отфильтровать по разделу (namespace).",
    discoverAppsSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleDiscoverApps(params) }],
    }),
  );

  // ── Schema ─────────────────────────────────────────────────────

  server.tool(
    "get_app_schema",
    "Получить полную схему приложения: поля с типами, обязательностью, признаками; " +
      "формы создания/просмотра/редактирования с наборами полей. " +
      "Используй перед построением EQL-запроса, чтобы узнать доступные поля и их типы.",
    getAppSchemaSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleGetAppSchema(params) }],
    }),
  );

  server.tool(
    "get_app_statuses",
    "Получить группы статусов и варианты статусов приложения. " +
      "Полезно для фильтрации элементов по статусу или для смены статуса.",
    getAppStatusesSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleGetAppStatuses(params) }],
    }),
  );

  server.tool(
    "get_app_fields",
    "Получить компактный список полей приложения (только code, type, required, array, title). " +
      "Облегчённая версия get_app_schema — используй когда нужны только имена и типы полей для EQL. " +
      "Работает быстро (кэш).",
    getAppFieldsSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleGetAppFields(params) }],
    }),
  );

  // ── Users ──────────────────────────────────────────────────────

  // ── Users ──────────────────────────────────────────────────────

  server.tool(
    "search_users",
    "Поиск пользователей ELMA365. Поддерживает фильтрацию по фамилии (fullname.lastname), " +
      "email, логину, идентификатору и другим полям. " +
      "Используй этот инструмент вместо кросс-подзапроса к _system_catalogs.employee в EQL.",
    searchUsersSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleSearchUsers(params) }],
    }),
  );

  server.tool(
    "get_user",
    "Получить данные одного пользователя по его UUID. " +
      "Возвращает ФИО, email, логин, должность, телефон, даты приёма/рождения.",
    getUserSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleGetUser(params) }],
    }),
  );

  // ── Search ─────────────────────────────────────────────────────

  server.tool(
    "search_app_items",
    "Поиск элементов приложения через EQL-запрос. Основной инструмент — все фильтры в одном запросе, " +
      "без цепочек вызовов. Кросс-приложенческие подзапросы позволяют ссылаться на другие приложения " +
      "прямо в условии.\n\n" +
      "ВАЖНО: перед построением EQL вызови get_app_schema или get_app_fields чтобы узнать имена полей приложения.\n" +
      "Для поиска пользователей используй search_users вместо подзапроса к _system_catalogs.\n" +
      "Для полей с array:true используй IN вместо = (операция = неприменима к подтипу «Несколько»).\n\n" +
      "ПРИМЕРЫ ОДНИМ ЗАПРОСОМ:\n" +
      "- Объекты в городе с оформленными подобъектами:\n" +
      "  [city] like 'Санкт-Петербург' and [__id] in (select [object] from [construction_object.subobject])\n" +
      "- Компании с ответственным сотрудником (найди пользователя через search_users, затем используй его id):\n" +
      "  [responsible_user] = 'uuid-сотрудника'\n" +
      "- Заявки BS за этот год:\n" +
      "  [__name] like 'BS' and [__createdAt] > Datetime(2026, 1, 1)\n" +
      "- Элементы в одном из нескольких статусов (числовой ID):\n" +
      "  [__status] in (1, 2, 3)\n\n" +
      "СИНТАКСИС:\n" +
      "- Сравнение: [field] = 'value', [field] > 100, [field] like 'pattern'\n" +
      "LIKEF — ТОЧНОЕ СОВПАДЕНИЕ С WILDCARD:\n" +
      "  В отличие от LIKE (поиск подстроки в любом месте), LIKEF ищет точное совпадение с шаблоном.\n" +
      "  Доступен для типов: Строка, Категория, Учетная запись, Номер телефона, Эл. почта, Ф.И.О., Ссылка.\n" +
      "  Wildcard-символы:\n" +
      "    % — любое количество любых символов (включая ноль). Аналог * в glob.\n" +
      "    _ — ровно один любой символ. Аналог ? в glob.\n" +
      "  Символы можно комбинировать и использовать многократно в одном шаблоне.\n" +
      "  Экранирование: если искомое значение содержит % или _, их нужно экранировать \\% или \\_.\n" +
      "  Примеры:\n" +
      "    [client] likef 'Иван' — поле точно равно 'Иван' (найдёт Иван, но не Иванов)\n" +
      "    [client] likef 'Иван%' — начинается с 'Иван' (Иванов, Иванчук и т.д.)\n" +
      "    [phone] likef '7912%' — все номера, начинающиеся на 7912\n" +
      "    [string] likef '_010203' — начинается с любого символа, затем '010203' (a010203, b010203...)\n" +
      "    [order_name] likef 'Продукты%10_2024' — 'Продукты'...'10' + любой символ + '2024'\n" +
      "    [email] likef '_petrov\\%@example%' — один символ перед 'petrov%@example', \\% экранирует %\n" +
      "  Сравнение LIKE vs LIKEF:\n" +
      "    [name] like 'Иван' — найдёт Иван, Иванов, Иванович (подстрока в любом месте)\n" +
      "    [name] likef 'Иван' — найдёт ТОЛЬКО точное 'Иван'\n" +
      "    [name] likef '%Иван%' — аналог like 'Иван' (подстрока в любом месте через LIKEF)\n" +
      "- Множество значений (без пробелов!): [field] in ('Алексей', 'Андрей'), [field] in (6,7,8,9)\n" +
      "ПОДЗАПРОСЫ И ОПЕРАТОРЫ PARENT / ROOT:\n" +
      "  Подзапросы — вложенные EQL внутри основного запроса. Используются с операторами IN или Count().\n" +
      "  Два синтаксиса выборки:\n" +
      "    SELECT_FROM_WHERE: [field] in (select [__id] from [ns.code] where condition)\n" +
      "    FROM_SELECT_WHERE: [field] in (from [ns.code] select [__id] where condition)\n" +
      "  Также есть FROM_WHERE (без SELECT) — используется с Count() и PARENT/ROOT.\n" +
      "  Операторы связи между уровнями вложенности:\n" +
      "    PARENT — ссылается на приложение на ОДИН уровень выше (родительский подзапрос).\n" +
      "      Используется внутри WHERE вложенного подзапроса, чтобы обратиться к полям внешнего приложения.\n" +
      "    ROOT — ссылается на САМОЕ ВНЕШНЕЕ (корневое) приложение, с которого начался весь запрос.\n" +
      "      Полезно при глубине вложенности 2+ для обращения к самым верхним полям.\n" +
      "  Примеры с PARENT:\n" +
      "    -- Поиск товаров с одинаковым артикулом (дубликаты):\n" +
      "    count(from [orders.products] where parent.[product_number] = [product_number]) > 1\n" +
      "    parent.[product_number] — артикул из внешнего приложения Товары,\n" +
      "    [product_number] — артикул из вложенного подзапроса orders.products.\n" +
      "    -- Поиск авторов, у которых есть хотя бы одна книга:\n" +
      "    count(from [bookstore.book] where parent.[__id] in [authors]) > 0\n" +
      "    parent.[__id] — ID автора из внешнего приложения, [authors] — поле внутри bookstore.book.\n" +
      "    -- Компании, у которых больше 2 договоров на сумму >10000:\n" +
      "    count(from [docs.contracts] where parent.[__id] in [client] and [total] > 10000) > 2\n" +
      "  Примеры с ROOT (глубина 2+):\n" +
      "    -- ROOT позволяет обратиться к полям самого первого приложения в цепочке,\n" +
      "    -- когда PARENT указал бы на непосредственного родителя на уровень выше.\n" +
      "- Даты: [__createdAt] > RelativeDatetime('-20d','0d'), [__createdAt] >= Datetime(2025, 1, 31)\n" +
      "  ВАЖНО: не используй = для дат — точное совпадение маловероятно, используй >=, >, <, <= или RelativeDatetime\n" +
      "ЛОГИЧЕСКИЕ ОПЕРАТОРЫ:\n" +
      "- AND — все условия должны выполняться.\n" +
      "  Пример: [prepayment] = 1000 and [budget] > 3000\n" +
      "- OR — хотя бы одно условие должно выполняться.\n" +
      "  Пример: [order_number] in (6,7) or [client] is null\n" +
      "- NOT — отрицание одного условия (ставится ПЕРЕД условием).\n" +
      "  Примеры:\n" +
      "    not [payment] is null — поле заполнено (не пустое)\n" +
      "    not [client_name] in ('Петров', 'Иванов') — имя НЕ совпадает ни с одним из списка\n" +
      "    not [client_name] like 'Алекс' — имя НЕ содержит указанное значение\n" +
      "  NOT со скобками — отрицание целой группы условий:\n" +
      "    not ([client_name] like 'Алексей' or [client_name] like 'Андрей') — имя НЕ содержит ни первого, ни второго\n" +
      "    not ([__name] like 'Алекс' or [__name] like 'Ан') — название НЕ содержит ни одного из значений\n" +
      "  Комбинация NOT с AND (приоритет через скобки):\n" +
      "    (not [client_name] = 'Алексей') and [client_name] like 'Ал' — имя НЕ равно первому, НО содержит второе\n" +
      "- Приоритет: выражения в скобках выполняются первыми. Без скобок NOT имеет приоритет перед AND/OR.\n" +
      "ФУНКЦИИ:\n" +
      "- Datetime(год [, месяц, день, час, минута, секунда, 'часовой_пояс'])\n" +
      "  Задаёт конкретную дату/время. Обязателен только год. Также принимает строки 'Today' и 'Now'.\n" +
      "  Примеры: Datetime(2025), Datetime(2025, 1, 31), Datetime(2025, 2, 1, 12), Datetime('Today'), Datetime('Now')\n" +
      "- Time(час [, минута, секунда])\n" +
      "  Задаёт время. Обязателен только час.\n" +
      "  Примеры: Time(17), Time(12, 30), Time(9, 0, 0)\n" +
      "- RelativeDatetime('start', 'end')\n" +
      "  Временной промежуток относительно текущей даты. Используется ТОЛЬКО с операторами = или IN.\n" +
      "  Формат параметров: цифробуквенное выражение, например '-7d' (минус 7 дней), '+1m' (плюс 1 месяц),\n" +
      "  '0w' (текущая неделя), '-1y' (минус 1 год), '0y+3q' (третий квартал текущего года).\n" +
      "  Разряды: y (год), q (квартал), m (месяц), w (неделя), d (день), h (час).\n" +
      "  start НЕ должно быть >= end.\n" +
      "  Примеры:\n" +
      "    [date] IN RelativeDatetime('0d', '0d') — за сегодня\n" +
      "    [date] IN RelativeDatetime('-1d', '-1d') — за вчера\n" +
      "    [date] IN RelativeDatetime('0w', '0w') — за текущую неделю\n" +
      "    [date] IN RelativeDatetime('-7d', '-1d') — за предыдущие 7 дней\n" +
      "    [date] IN RelativeDatetime('-1m', '+1m') — с начала прошлого до конца следующего месяца\n" +
      "    [date] IN RelativeDatetime('0y', '0y') — за текущий год\n" +
      "- Count(свойство_или_подзапрос)\n" +
      "  Количество элементов в множественном поле или результатов подзапроса.\n" +
      "  Примеры:\n" +
      "    count([orders]) > 3 — компании, у которых больше 3 заказов\n" +
      "    count(from [docs.contracts] where parent.[__id] in [client] and [total] > 10000) > 2 — компании с >2 договоров на >10000\n" +
      "- Refitem('раздел', 'приложение' [, 'uuid'])\n" +
      "  Поиск по полю типа «Произвольное приложение».\n" +
      "  Без UUID — любой элемент из указанного приложения. С UUID — конкретный элемент.\n" +
      "  Также можно использовать строковой путь: 'раздел:приложение' или 'раздел:приложение:uuid'.\n" +
      "  Примеры:\n" +
      "    [contract] = Refitem('clients', 'contracts') — любой договор из Клиенты > Договоры\n" +
      "    [bill] = Refitem('documents', 'bills', '018a8dbb-04cd-7798-a363-aae245148b10') — конкретный счёт\n" +
      "    [contract] = 'clients:contracts:018a8dbb-...' — альтернативная строковая запись\n" +
      "- Системные поля: __id, __createdAt, __createdBy, __updatedAt, __updatedBy, __name, __status (числовой ID статуса)",
    searchAppItemsSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleSearchAppItems(params) }],
    }),
  );

  // ── CRUD ───────────────────────────────────────────────────────

  server.tool(
    "get_app_item",
    "Получить один элемент приложения по его UUID.",
    getAppItemSchema.shape,
    async (params) => ({
      content: [{ type: "text", text: await handleGetAppItem(params) }],
    }),
  );

  return server;
}

async function main() {
  const args = process.argv.slice(2);
  const httpFlag = args.includes("--http");
  const portIndex = args.indexOf("--port");
  const port = portIndex !== -1 ? parseInt(args[portIndex + 1], 10) : 3000;

  const server = createServer();

  if (httpFlag) {
    // Динамический импорт HTTP-транспорта
    const { startHttpTransport } = await import("./transport/http.js");
    await startHttpTransport(server, port);
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(
      `[elma365-mcp] Сервер запущен (stdio). ${TOOL_COUNT} инструментов. ELMA365_DOMAIN + ELMA365_TOKEN обязательны.`,
    );
  }
}

main().catch((error) => {
  console.error("[elma365-mcp] Критическая ошибка:", error);
  process.exit(1);
});
