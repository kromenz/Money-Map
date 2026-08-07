"use client";

import { motion, type Variants } from "framer-motion";
import { LineChart, PiggyBank, Sparkles } from "lucide-react";

const POINTS = [
  { icon: LineChart, text: "See a whole year at a glance." },
  { icon: PiggyBank, text: "Track what you save, not just what you spend." },
  { icon: Sparkles, text: "Import your spreadsheet and you are done." },
];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export function BrandPanel() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="relative z-10 flex h-full flex-col justify-center gap-10 p-12 text-white">
      <motion.div variants={item} className="space-y-5">
        <img src="/logo_wtit.png" alt="Money Map" className="h-16 w-auto" />
        <p className="max-w-sm text-2xl leading-snug font-medium text-balance">
          Organize your finances quickly and effortlessly.
        </p>
      </motion.div>

      <motion.ul variants={container} className="space-y-4">
        {POINTS.map(({ icon: Icon, text }) => (
          <motion.li
            key={text}
            variants={item}
            className="flex items-center gap-3 text-sm text-white/80">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/25 bg-white/10 backdrop-blur-sm">
              <Icon className="size-4" aria-hidden />
            </span>
            {text}
          </motion.li>
        ))}
      </motion.ul>
    </motion.div>
  );
}
