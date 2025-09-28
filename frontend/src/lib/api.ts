const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function login(email: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include".
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}
