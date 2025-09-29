import api from "../lib/api";
import type { LoginPayload, LoginResponse, User } from "../types/auth";

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>("/auth/login", payload);
  return res.data;
}

export async function register(payload: {
  name?: string;
  email: string;
  password: string;
}): Promise<{ ok?: boolean; user?: User; error?: string }> {
  const res = await api.post("/auth/register", payload);
  return res.data;
}

export async function refresh(): Promise<any> {
  const res = await api.post("/auth/refresh");
  return res.data;
}

export async function logout(): Promise<any> {
  const res = await api.post("/auth/logout");
  return res.data;
}
