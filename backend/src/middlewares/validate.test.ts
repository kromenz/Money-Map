import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { validateBody } from "./validate";

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: any };
}

const schema = z.object({ password: z.string().min(8) });

describe("validateBody", () => {
  it("responde 400 com a lista de problemas quando o corpo e invalido", () => {
    const req = { body: { password: "curta" } } as Request;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    validateBody(schema)(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.issues.length).toBeGreaterThan(0);
    expect(next).not.toHaveBeenCalled();
  });

  it("responde 400 quando o corpo esta em falta", () => {
    const req = {} as Request;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    validateBody(schema)(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("chama next e substitui req.body pelo valor validado", () => {
    const req = { body: { password: "abcdefgh", lixo: 1 } } as Request;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    validateBody(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({ password: "abcdefgh" });
  });
});
