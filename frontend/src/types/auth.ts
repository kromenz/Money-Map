export interface User {
  id: string;
  email: string;
  name?: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  ok?: boolean;
  user?: User;
  error?: string;
}
