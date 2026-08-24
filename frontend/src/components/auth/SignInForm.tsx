"use client";

import { useState } from "react";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { AuthField } from "./AuthField";
import { PasswordField } from "./PasswordField";
import { SocialButtons } from "./SocialButtons";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export function SignInForm({
  email,
  onEmailChange,
  onSubmit,
  onGithub,
  loading,
}: {
  email: string;
  onEmailChange: (value: string) => void;
  onSubmit: (payload: { email: string; password: string }) => Promise<void>;
  onGithub: () => void;
  loading: boolean;
}) {
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);

  const emailError =
    touched && email.trim().length === 0 ? "Enter your email." : undefined;
  const passwordError =
    touched && password.length === 0 ? "Enter your password." : undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!email.trim() || !password) return;
    await onSubmit({ email: email.trim(), password });
  }

  return (
    <motion.form
      variants={container}
      initial="hidden"
      animate="show"
      onSubmit={handleSubmit}
      className="space-y-4"
      noValidate>
      <motion.div variants={item}>
        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          error={emailError}
          onChange={(e) => onEmailChange(e.target.value)}
        />
      </motion.div>

      <motion.div variants={item}>
        <PasswordField
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          error={passwordError}
          onChange={(e) => setPassword(e.target.value)}
        />
      </motion.div>

      <motion.div variants={item} className="flex justify-end">
        <a
          href="#"
          className="rounded text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Forgot password?
        </a>
      </motion.div>

      <motion.button
        variants={item}
        type="submit"
        disabled={loading}
        whileHover={loading ? undefined : { scale: 1.01 }}
        whileTap={loading ? undefined : { scale: 0.99 }}
        className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Signing in…
          </>
        ) : (
          <>
            Sign in
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </>
        )}
      </motion.button>

      <motion.div variants={item} className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or continue with</span>
        <span className="h-px flex-1 bg-border" />
      </motion.div>

      <motion.div variants={item}>
        <SocialButtons onGithub={onGithub} />
      </motion.div>
    </motion.form>
  );
}
