"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { toast } from "sonner";
import DarkVeil from "../styles/DarkVeil/DarkVeil";
import { BrandPanel } from "../src/components/auth/BrandPanel";
import { SignInForm } from "../src/components/auth/SignInForm";
import { SignUpForm } from "../src/components/auth/SignUpForm";
import { ThemeToggle } from "../src/components/ThemeToggle";
import { useAuthContext } from "../src/context/AuthContext";
import * as authService from "../src/services/auth.service";
import type { SignUpPayload } from "../src/types/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";
const POPUP_W = 600;
const POPUP_H = 700;

type Mode = "signin" | "signup";

export default function HomePage() {
  const router = useRouter();
  const { login, user, loading } = useAuthContext();

  const [mode, setMode] = useState<Mode>("signin");
  // O email vive aqui em cima para o registo poder pre-preencher o login.
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const popupTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    return () => {
      if (popupTimer.current) clearInterval(popupTimer.current);
    };
  }, []);

  async function handleSignIn(payload: { email: string; password: string }) {
    setSubmitting(true);
    try {
      await login(payload);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUp(payload: SignUpPayload) {
    setSubmitting(true);
    try {
      await authService.register(payload);
      toast.success("Account created — sign in to continue.");
      setEmail(payload.email);
      setMode("signin");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error || err?.message || "Sign up failed"
      );
    } finally {
      setSubmitting(false);
    }
  }

  function openGithubPopup() {
    const left = window.screenX + (window.outerWidth - POPUP_W) / 2;
    const top = window.screenY + (window.outerHeight - POPUP_H) / 2;
    const popup = window.open(
      `${API_BASE}/auth/github`,
      "github_oauth",
      `width=${POPUP_W},height=${POPUP_H},left=${left},top=${top}`
    );

    if (popupTimer.current) clearInterval(popupTimer.current);
    popupTimer.current = setInterval(() => {
      if (!popup || popup.closed) {
        if (popupTimer.current) clearInterval(popupTimer.current);
        window.location.reload();
      }
    }, 500);
  }

  const isSignup = mode === "signup";

  return (
    /*
      reducedMotion="user" desliga as animacoes a nivel do provider em vez de
      ramificar no render. Um branch com useReducedMotion partiria a hidratacao,
      porque no servidor devolve sempre null.
    */
    <MotionConfig reducedMotion="user">
      <main className="relative min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
        {/*
          Em mobile o DarkVeil cobre o ecra todo por tras do cartao; a partir de
          lg passa a ocupar so a coluna da esquerda, com o painel de marca por
          cima. O canvas precisa de um pai com altura, dai o inset-0/h-full.
        */}
        <div className="absolute inset-0 overflow-hidden lg:relative lg:inset-auto lg:h-dvh">
          <div className="absolute inset-0">
            <DarkVeil hueShift={360} warpAmount={5} speed={1.5} />
          </div>
          <div className="absolute inset-0 bg-black/25 lg:bg-transparent" />
          <div className="hidden h-full lg:block">
            <BrandPanel />
          </div>
        </div>

        <div className="relative z-10 flex min-h-dvh flex-col lg:bg-background">
          <div className="flex justify-end p-4">
            <ThemeToggle />
          </div>

          <div className="flex flex-1 items-center justify-center px-4 pb-6">
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 220, damping: 28 }}
              className="w-full max-w-sm rounded-2xl border border-white/25 bg-background/85 p-6 shadow-2xl backdrop-blur-xl lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
              <div className="mb-6 space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {isSignup ? "Create your account" : "Welcome back"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isSignup
                    ? "A few details and you are in."
                    : "Sign in to pick up where you left off."}
                </p>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, x: isSignup ? 16 : -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isSignup ? -16 : 16 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}>
                  {isSignup ? (
                    <SignUpForm onSubmit={handleSignUp} loading={submitting} />
                  ) : (
                    <SignInForm
                      email={email}
                      onEmailChange={setEmail}
                      onSubmit={handleSignIn}
                      onGithub={openGithubPopup}
                      loading={submitting}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {isSignup ? "Already have an account?" : "New to Money Map?"}{" "}
                <button
                  type="button"
                  onClick={() => setMode(isSignup ? "signin" : "signup")}
                  className="rounded font-semibold text-foreground underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {isSignup ? "Sign in" : "Create an account"}
                </button>
              </p>
            </motion.div>
          </div>

          <footer className="p-4 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Money Map. All rights reserved.
          </footer>
        </div>
      </main>
    </MotionConfig>
  );
}
