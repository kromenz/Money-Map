import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../utils/tokens", () => ({
  verifyAccessToken: vi.fn(),
}));

import { verifyAccessToken } from "../utils/tokens";
import { authMiddleware } from "./auth.middleware";

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    sendCount: 0,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.sendCount += 1;
      this.body = payload;
      return this;
    },
    clearCookie() {
      return this;
    },
  };
  return res as unknown as Response & { sendCount: number; statusCode: number };
}

function makeReq(token?: string) {
  return {
    cookies: token ? { access_token: token } : {},
    headers: {},
  } as unknown as Request;
}

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.mocked(verifyAccessToken).mockReset();
  });

  it("responde 401 uma unica vez quando nao ha token e nao chama next", () => {
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    authMiddleware(makeReq(), res, next);

    expect(res.statusCode).toBe(401);
    expect(res.sendCount).toBe(1);
    expect(next).not.toHaveBeenCalled();
  });

  it("nao chama next quando o payload nao tem sub", () => {
    vi.mocked(verifyAccessToken).mockReturnValue({} as never);
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    authMiddleware(makeReq("tok"), res, next);

    expect(res.statusCode).toBe(401);
    expect(res.sendCount).toBe(1);
    expect(next).not.toHaveBeenCalled();
  });

  it("responde 401 uma unica vez quando o token expirou", () => {
    const expired = Object.assign(new Error("jwt expired"), {
      name: "TokenExpiredError",
    });
    vi.mocked(verifyAccessToken).mockImplementation(() => {
      throw expired;
    });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    authMiddleware(makeReq("tok"), res, next);

    expect(res.statusCode).toBe(401);
    expect(res.sendCount).toBe(1);
    expect(res.body).toEqual({ error: "Token expired" });
    expect(next).not.toHaveBeenCalled();
  });

  it("chama next e injecta userId quando o token e valido", () => {
    vi.mocked(verifyAccessToken).mockReturnValue({ sub: "user-1" } as never);
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    const req = makeReq("tok");

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.sendCount).toBe(0);
    expect((req as unknown as { userId: string }).userId).toBe("user-1");
  });
});
