import { z } from "zod";
import { elmaRequest } from "../client.js";

// ─── search_users ────────────────────────────────────────────────

export const searchUsersSchema = z.object({
  filter: z
    .record(z.unknown())
    .optional()
    .describe(
      "Фильтр пользователей. Примеры полей фильтра:\n" +
        '- {"fullname.lastname": "Иванов"} — поиск по фамилии\n' +
        '- {"email": "user@example.com"} — поиск по email\n' +
        '- {"login": "i.ivanov"} — поиск по логину\n' +
        '- {"__id": "uuid"} — поиск по идентификатору',
    ),
  size: z.number().optional().describe("Количество возвращаемых элементов (по умолчанию 20, макс. 10000)"),
  from: z.number().optional().describe("Смещение для пагинации (по умолчанию 0)"),
});

interface UserInfo {
  id: string;
  name: string;
  email: string;
  login: string;
  fullName: {
    lastname: string;
    firstname: string;
    middlename: string;
  };
  position: string | null;
}

export async function handleSearchUsers(
  params: z.infer<typeof searchUsersSchema>,
): Promise<string> {
  const body: Record<string, unknown> = {
    size: params.size ?? 20,
    from: params.from ?? 0,
  };
  if (params.filter) {
    body.filter = params.filter;
  }

  const result = (await elmaRequest("POST", "user/list", body)) as Record<string, unknown>;

  const inner = result.result as Record<string, unknown> | undefined;
  const data = (inner?.result as Array<Record<string, unknown>>) ?? [];
  const total = (inner?.total as number) ?? data.length;

  const users: UserInfo[] = data.map((u) => {
    const fn = (u.fullname as Record<string, unknown>) ?? {};
    return {
      id: String(u.__id ?? ""),
      name: String(u.__name ?? ""),
      email: String(u.email ?? ""),
      login: String(u.login ?? ""),
      fullName: {
        lastname: String(fn.lastname ?? ""),
        firstname: String(fn.firstname ?? ""),
        middlename: String(fn.middlename ?? ""),
      },
      position: u.displayedPosition != null ? String(u.displayedPosition) : null,
    };
  });

  return JSON.stringify({ total, users }, null, 2);
}

// ─── get_user ────────────────────────────────────────────────────

export const getUserSchema = z.object({
  id: z.string().describe("UUID пользователя"),
});

export async function handleGetUser(
  params: z.infer<typeof getUserSchema>,
): Promise<string> {
  const body: Record<string, unknown> = {
    size: 1,
    from: 0,
    ids: [params.id],
  };

  const result = (await elmaRequest("POST", "user/list", body)) as Record<string, unknown>;

  const inner = result.result as Record<string, unknown> | undefined;
  const data = (inner?.result as Array<Record<string, unknown>>) ?? [];

  if (data.length === 0) {
    return JSON.stringify({ error: `Пользователь с id ${params.id} не найден` }, null, 2);
  }

  const u = data[0];
  const fn = (u.fullname as Record<string, unknown>) ?? {};

  const user = {
    id: String(u.__id ?? ""),
    name: String(u.__name ?? ""),
    email: String(u.email ?? ""),
    login: String(u.login ?? ""),
    fullName: {
      lastname: String(fn.lastname ?? ""),
      firstname: String(fn.firstname ?? ""),
      middlename: String(fn.middlename ?? ""),
    },
    position: u.displayedPosition != null ? String(u.displayedPosition) : null,
    birthDate: u.birthDate != null ? String(u.birthDate) : null,
    hireDate: u.hireDate != null ? String(u.hireDate) : null,
    mobilePhone: u.mobilePhone ?? null,
    workPhone: u.workPhone ?? null,
    groupIds: u.groupIds ?? [],
    osIds: u.osIds ?? [],
  };

  return JSON.stringify(user, null, 2);
}

// ─── search_employees ────────────────────────────────────────────

export const searchEmployeesSchema = z.object({
  filter: z
    .record(z.unknown())
    .optional()
    .describe(
      "Структурный фильтр (как в app/list). Примеры:\n" +
        '- {"and": [{"like": [{"field": "email"}, {"const": "user@example.com"}]}, {"eq": [{"field": "__deletedAt"}, null]}]} — по email среди неудалённых\n' +
        '- {"eq": [{"field": "__id"}, {"const": "uuid"}]} — по идентификатору\n' +
        "ВАЖНО: list возвращает и удалённых сотрудников — для «живых» добавляйте условие eq __deletedAt = null.",
    ),
  size: z.number().optional().describe("Количество элементов (по умолчанию 50, макс. 10000)"),
  from: z.number().optional().describe("Смещение для пагинации (по умолчанию 0)"),
});

function firstRefId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const list = Array.isArray(value) ? value : [value];
  for (const entry of list) {
    if (typeof entry === "string") return entry;
    if (entry && typeof entry === "object") {
      const id =
        (entry as Record<string, unknown>).__id ??
        (entry as Record<string, unknown>).id;
      if (id) return String(id);
    }
  }
  return null;
}

export async function handleSearchEmployees(
  params: z.infer<typeof searchEmployeesSchema>,
): Promise<string> {
  const body: Record<string, unknown> = {
    size: params.size ?? 50,
    from: params.from ?? 0,
  };
  if (params.filter) {
    body.filter = params.filter;
  }

  const result = (await elmaRequest(
    "POST",
    "app/_system_catalogs/employee/list",
    body,
  )) as Record<string, unknown>;

  if (result.success === false) {
    return JSON.stringify(
      { error: String(result.error ?? "Неизвестная ошибка API") },
      null,
      2,
    );
  }

  const inner = result.result as Record<string, unknown> | undefined;
  const data = (inner?.result as Array<Record<string, unknown>>) ?? [];
  const total = (inner?.total as number) ?? data.length;

  const employees = data.map((e) => ({
    id: String(e.__id ?? ""),
    name: String(e.__name ?? ""),
    email: String(e.email ?? ""),
    userId: firstRefId(e.user),
    position: e.position != null ? String(e.position) : null,
    mobilePhone: e.mobilePhone ?? null,
    workPhone: e.workPhone ?? null,
    deleted: e.__deletedAt != null,
  }));

  return JSON.stringify({ total, employees }, null, 2);
}
