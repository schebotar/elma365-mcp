import { z } from "zod";
import { elmaRequest } from "../client.js";

// ─── search_users ─────────────────────────────────────────────────

export const searchUsersSchema = z.object({
  query: z.string().describe("Поисковый запрос: имя, фамилия, логин или email пользователя"),
  size: z.number().optional().describe("Количество результатов (по умолчанию 10)"),
});

interface UserInfo {
  id: string;
  fullname: string;
  login?: string;
  email?: string;
  position?: string;
}

export async function handleSearchUsers(
  params: z.infer<typeof searchUsersSchema>,
): Promise<string> {
  // Формируем фильтр для поиска пользователей
  const body: Record<string, unknown> = {
    size: params.size ?? 10,
    filter: {
      tf: {
        fullname: params.query,
        login: params.query,
        email: params.query,
      },
    },
  };

  // Пробуем несколько эндпоинтов
  const endpoints = ["user/list", "users/list"];

  let result: Record<string, unknown> | null = null;
  let lastError: string = "";

  for (const ep of endpoints) {
    try {
      result = (await elmaRequest("POST", ep, body)) as Record<string, unknown>;
      break;
    } catch (e) {
      lastError = String(e);
      try {
        result = (await elmaRequest("GET", ep, undefined, {
          query: params.query,
          size: String(params.size ?? 10),
        })) as Record<string, unknown>;
        break;
      } catch (e2) {
        lastError = `${lastError} | ${String(e2)}`;
      }
    }
  }

  if (!result) {
    throw new Error(
      `Не удалось найти пользователей. Проверьте права доступа токена.\nОшибки: ${lastError}`,
    );
  }

  const data = Array.isArray(result) ? result : (result.data ?? result.items ?? []);
  if (!Array.isArray(data)) {
    return JSON.stringify(result, null, 2);
  }

  const users: UserInfo[] = (data as Array<Record<string, unknown>>).map((u) => ({
    id: String(u.__id ?? u.id ?? ""),
    fullname:
      String(u.fullname ?? u.__fullname ?? u.name ?? ""),
    login: u.login ?? u.__login != null ? String(u.login ?? u.__login) : undefined,
    email: u.email ?? u.__email != null ? String(u.email ?? u.__email) : undefined,
    position: u.position ?? u.__position != null ? String(u.position ?? u.__position) : undefined,
  }));

  return JSON.stringify({ users, total: users.length }, null, 2);
}
