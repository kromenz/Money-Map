import { z } from "zod";

export const dividendsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const ordersQuerySchema = z.object({
  ticker: z.string().optional(),
  side: z.enum(["BUY", "SELL"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
