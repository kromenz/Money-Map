import { z } from "zod";

export const setPasswordSchema = z.object({
  password: z.string().min(8, "A password tem de ter pelo menos 8 caracteres"),
  currentPassword: z.string().optional(),
});

export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
