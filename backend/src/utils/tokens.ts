import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import config from "../config";

if (!config.accessSecret) {
  throw new Error("❌ ACCESS_SECRET not defined in config");
}
if (!config.refreshSecret) {
  throw new Error("❌ REFRESH_SECRET not defined in config");
}

export function signAccessToken(payload: object) {
  const options: SignOptions = {
    expiresIn: config.accessExpiry || "15m",
  };

  return jwt.sign(payload, config.accessSecret as string, options);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, config.accessSecret as string);
}

export function signRefreshToken(payload: object) {
  const options: SignOptions = {
    expiresIn: `${config.refreshExpiryDays || 7}d`,
    /**
     * Um identificador unico por token, e nao enfeite.
     *
     * O iat e o exp de um JWT contam-se em segundos inteiros: sem o jti, dois
     * refresh tokens assinados para o mesmo sub dentro do mesmo segundo saem
     * byte a byte iguais, e portanto com o mesmo tokenHash. A rotacao cria a
     * linha nova antes de apagar a velha, por isso batia na restricao de
     * unicidade e a rota devolvia 500 -- e o browser, a apanhar o erro,
     * deslogava. Um F5 provocava-o de cada vez: o efeito de montagem do
     * AuthProvider corre duas vezes com 1ms de intervalo.
     *
     * So no refresh token. O de acesso nunca e guardado nem rodado, portanto
     * nao ha unicidade nenhuma a proteger.
     */
    jwtid: crypto.randomUUID(),
  };

  return jwt.sign(payload, config.refreshSecret as string, options);
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, config.refreshSecret as string);
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
