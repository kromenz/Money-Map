"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Check, Loader2, Mail, User } from "lucide-react";
import { AuthField } from "./AuthField";
import { PasswordField } from "./PasswordField";
import { cn } from "@/lib/utils";
import type { SignUpPayload } from "@/types/auth";

const CRITERIA = [
  { label: "At least 8 characters", test: (pw: string) => pw.length >= 8 },
  { label: "One uppercase letter", test: (pw: string) => /[A-Z]/.test(pw) },
  { label: "One number", test: (pw: string) => /\d/.test(pw) },
  {
    label: "One special character",
    test: (pw: string) => /[!@#$%^&*]/.test(pw),
  },
] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

function Criterion({ label, passed }: { label: string; passed: boolean }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      {/*
        A cor troca por classe, nao por animate: o framer-motion nao interpola
        custom properties do CSS, so as escreve, portanto animar para
        var(--chart-savings) daria um salto na mesma.
      */}
      <span
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
          passed
            ? "border-transparent bg-[var(--chart-savings)]"
            : "border-input"
        )}>
        <AnimatePresence>
          {passed && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}>
              <Check className="size-2.5 text-white" aria-hidden />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className={passed ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </li>
  );
}

export function SignUpForm({
  onSubmit,
  loading,
}: {
  onSubmit: (payload: SignUpPayload) => Promise<void>;
  loading: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const checks = useMemo(
    () => CRITERIA.map((c) => ({ label: c.label, passed: c.test(password) })),
    [password]
  );
  const passwordsMatch = password !== "" && password === confirm;
  const canSubmit =
    checks.every((c) => c.passed) &&
    passwordsMatch &&
    email.trim().length > 0 &&
    !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    await onSubmit({
      name: name.trim() || undefined,
      email: email.trim(),
      password,
    });
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
          label="Name"
          icon={User}
          name="name"
          autoComplete="name"
          placeholder="Optional"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </motion.div>

      <motion.div variants={item}>
        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </motion.div>

      <motion.div variants={item}>
        <PasswordField
          name="newPassword"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </motion.div>

      <motion.div variants={item}>
        <PasswordField
          label="Repeat password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirm}
          error={
            confirm.length > 0 && !passwordsMatch
              ? "Passwords do not match."
              : undefined
          }
          onChange={(e) => setConfirm(e.target.value)}
        />
      </motion.div>

      <motion.ul variants={item} className="grid gap-1.5 sm:grid-cols-2">
        {checks.map((c) => (
          <Criterion key={c.label} label={c.label} passed={c.passed} />
        ))}
      </motion.ul>

      <motion.button
        variants={item}
        type="submit"
        disabled={!canSubmit}
        whileHover={canSubmit ? { scale: 1.01 } : undefined}
        whileTap={canSubmit ? { scale: 0.99 } : undefined}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Creating account…
          </>
        ) : (
          "Create account"
        )}
      </motion.button>
    </motion.form>
  );
}
