import { z } from "zod";

export const importQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export const gridQuerySchema = importQuerySchema;
