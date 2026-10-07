# ELMA365 MCP Server

MCP-сервер для [ELMA365](https://elma365.com) API с поддержкой **EQL-поиска** — поиск элементов приложений по произвольным запросам, включая естественный язык через LLM.

**22 инструмента**: чтение схем и элементов, поиск (EQL), пользователи и сотрудники, CRUD элементов (создание, изменение, статус, удаление, восстановление, массовое сохранение) и работа с процессами (запуск, поиск экземпляров, чтение, прерывание, контекст, пропуск шага).

## Возможности

### Один запрос — полный ответ

Сервер строит сложные EQL-запросы с кросс-приложенческими подзапросами. Вместо цепочки
«найди ID в одном приложении → подставь в другое» — один вызов `search_app_items`.

**Объекты в Санкт-Петербурге с оформленными подобъектами:**
```eql
[city] like 'Санкт-Петербург'
  and [__id] in (select [object] from [construction_object.subobject])
```

**Компании, где ответственный — конкретный сотрудник:**
```eql
[responsible_employees_employee_details]
  in (select [__id] from [_system_catalogs.employee]
      where [fullName.lastname] like 'Чеботарь')
```

**Заявки на проектирование направления BS за этот год:**
```eql
[__name] like 'BS' and [__createdAt] > Datetime(2026, 1, 1)
```

**Заявки BS, привязанные к объектам конкретного офиса продаж:**
```eql
[__name] like 'BS'
  and [subobject_app] in (
    select [__id] from [construction_object.subobject]
    where [object] in (
      select [__id] from [construction_object.construction_object]
      where [sales_office] in (
        select [__id] from [crm.salesoffice]
        where [__name] like 'BS'
      )
    )
  )
```

**Не начатые задачи CRM для исполнителя:**
```eql
[performer_user] = 'uuid-исполнителя' and [in_progress] = false
```

## Инструменты

| Группа | Инструменты |
|---|---|
| Обнаружение и схема | `discover_apps`, `get_app_schema`, `get_app_statuses`, `get_app_fields`, `get_process_templates` |
| Поиск и чтение | `search_app_items`, `get_app_item` |
| Пользователи | `search_users`, `get_user`, `search_employees` |
| CRUD элементов | `create_app_item`, `update_app_item`, `set_app_item_status`, `delete_app_item`, `restore_app_item`, `save_app_items_batch` |
| Процессы (BPM) | `run_process`, `search_process_instances`, `get_process_instance`, `interrupt_process_instance`, `update_process_instance_context`, `skip_process_instance_step` |

Примечание: удаление и восстановление элементов выполняются через `update` с полем `__deletedAt`
(мягкое удаление) — отдельного эндпоинта удаления в `/pub/v1` нет.

## Установка

### Claude Desktop

```json
{
  "mcpServers": {
    "elma365": {
      "command": "npx",
      "args": ["-y", "@chebser/elma365-mcp"],
      "env": {
        "ELMA365_DOMAIN": "mycompany",
        "ELMA365_TOKEN": "your-bearer-token"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add elma365 \
  -e ELMA365_DOMAIN=mycompany \
  -e ELMA365_TOKEN=your-token \
  -- npx -y @chebser/elma365-mcp
```

### Локальная разработка

```bash
git clone <repo>
cd elma365-mcp
npm install
npm run build

# Запуск (stdio)
ELMA365_DOMAIN=mycompany ELMA365_TOKEN=token node dist/index.js

# Dev-режим с tsx
ELMA365_DOMAIN=mycompany ELMA365_TOKEN=token npm run dev
```

### HTTP-транспорт (SSE)

```bash
ELMA365_DOMAIN=mycompany ELMA365_TOKEN=token npx @chebser/elma365-mcp --http --port 3000
```

MCP endpoint (Streamable HTTP / SSE): `http://localhost:3000/mcp`
Health check: `http://localhost:3000/health`

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `ELMA365_DOMAIN` | Домен ELMA365: `mycompany` (для `mycompany.elma365.ru`) или полный `mycompany.elma365.ru` |
| `ELMA365_TOKEN` | Bearer-токен ELMA365 API (получить в настройках профиля → API-ключи) |

## Инструменты

### Discovery

| Инструмент | Параметры | Описание |
|------------|-----------|----------|
| `discover_apps` | `namespace?` | Список всех приложений с namespace, code и названиями |

### Поиск

| Инструмент | Параметры | Описание |
|------------|-----------|----------|
| `search_app_items` | `namespace`, `code`, `eql`, `size?`, `from?` | Поиск элементов через EQL-запрос |

### Чтение

| Инструмент | Параметры | Описание |
|------------|-----------|----------|
| `get_app_item` | `namespace`, `code`, `id` | Получить элемент по UUID |

## EQL-синтаксис (краткая справка)

```
// Сравнения
[field] = 'value'
[field] > 100
[field] like 'pattern'
[field] in ('val1', 'val2')

// Даты
[__createdAt] > Datetime(2025, 1, 31)
[__createdAt] > RelativeDatetime('-20d', '0d')

// Пользователи
[__createdBy] = 'uuid'
[__createdBy] = CurrentUser()

// Логика
[field1] = 'a' and [field2] > 10
[field1] = 'a' or [field1] = 'b'
not ([field] = 'x')
// NOT всегда перед условием: not [field] is null (НЕ [field] is not null!)
// not [field] in ('a','b'), not [field] like 'text'

// Подзапросы
[field] in (select [__id] from [ns.code] where condition)

// Системные поля
__id, __createdAt, __createdBy, __updatedAt, __updatedBy, __name
```

## Лицензия

MIT
