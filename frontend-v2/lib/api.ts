const API_BASE_URL = "/api";

type ApiResponse<T> = {
  status: "success" | "error";
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const result: ApiResponse<T> = await response.json();

  if (!response.ok || result.status === "error") {
    throw new Error(
      result.error?.message ?? "Terjadi kesalahan pada server",
    );
  }

  return result.data as T;
}


export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: "admin" | "owner" | "visitor";
  created_at: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await fetch("/api/auth/me", {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();

    return result.data as CurrentUser;
  } catch {
    return null;
  }
}
