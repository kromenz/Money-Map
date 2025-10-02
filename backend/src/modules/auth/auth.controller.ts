import { RequestHandler } from "express";
import * as service from "./auth.service";
import config from "../../config";

export const register: RequestHandler = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const user = await service.registerUser(email, password, name);
    res.status(201).json(user);
    return;
  } catch (err) {
    return next(err);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await service.loginUser(
      email,
      password
    );

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: config.cookieOptions.secure,
      sameSite: config.cookieOptions.sameSite,
      path: "/",
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: config.cookieOptions.secure,
      sameSite: config.cookieOptions.sameSite,
      path: "/",
      maxAge: config.refreshExpiryDays * 24 * 60 * 60 * 1000,
    });

    res.json({ user });
    return;
  } catch (err) {
    return next(err);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const refreshToken = req.cookies["refresh_token"];
    if (!refreshToken) {
      res.status(401).json({ error: "No token" });
      return;
    }

    const {
      accessToken,
      refreshToken: newRefresh,
      user,
    } = await service.refreshTokens(refreshToken);

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: config.cookieOptions.secure,
      sameSite: config.cookieOptions.sameSite,
      path: "/",
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refresh_token", newRefresh, {
      httpOnly: true,
      secure: config.cookieOptions.secure,
      sameSite: config.cookieOptions.sameSite,
      path: "/",
      maxAge: config.refreshExpiryDays * 24 * 60 * 60 * 1000,
    });

    res.json({ user });
    return;
  } catch (err) {
    return next(err);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const refreshToken = req.cookies["refresh_token"];
    await service.logout(refreshToken);
    res.clearCookie("access_token", { path: "/" });
    res.clearCookie("refresh_token", { path: "/" });
    res.json({ ok: true });
    return;
  } catch (err) {
    return next(err);
  }
};

export const github: RequestHandler = async (req, res, next) => {
  const redirectUrl = "http://localhost:5000/auth/github/callback";
  const clientId = process.env.GITHUB_CLIENT_ID;

  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUrl}&scope=user:email`;
  res.redirect(url);
};

export const githubCallback: RequestHandler = async (req, res, next) => {
  try {
    const code = req.query.code as string;
    const debug = req.query.debug === "1"; // se quiseres testar sem redirect
    const result = await service.githubCallback(code);

    console.log("GITHUB CALLBACK RESULT:", result);

    if (debug) {
      res.json(result);
      return;
    }

    return res.redirect(
      `http://localhost:3000/auth/github?accessToken=${encodeURIComponent(
        result.token
      )}`
    );
  } catch (err) {
    return next(err);
  }
};
