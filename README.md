# ELMA365 MCP Server

MCP-сервер для [ELMA365](https://elma365.com) API с поддержкой **EQL-поиска** — поиск элементов приложений по произвольным запросам, включая естественный язык через LLM.

**5 инструментов**: discovery приложений, поиск элементов (EQL), CRUD элементов.

## Возможности

### Кросс-приложенческие запросы

```
«Компании, у которых сумма договоров больше 10000»
```

EQL: `[contracts] in (select [__id] from [crm.contracts] where [total] > 10000)`

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

### HTTP-транспорт

```bash
ELMA365_DOMAIN=mycompany ELMA365_TOKEN=token npx @chebser/elma365-mcp --http --port 3000
```

Endpoint: `http://localhost:3000/mcp`
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
| `search_app_items` | `namespace`, `code`, `eql`, `size?`, `from?`, `fields?` | Поиск элементов через EQL-запрос |

### CRUD

| Инструмент | Параметры | Описание |
|------------|-----------|----------|
| `get_app_item` | `namespace`, `code`, `id` | Получить элемент по UUID |
| `create_app_item` | `namespace`, `code`, `data` | Создать элемент |
| `update_app_item` | `namespace`, `code`, `id`, `data` | Обновить элемент |

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

// Подзапросы
[field] in (select [__id] from [ns.code] where condition)

// Системные поля
__id, __createdAt, __createdBy, __updatedAt, __updatedBy, __name
```

## Лицензия

MIT
