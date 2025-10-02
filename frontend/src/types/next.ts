import type { NextPage } from "next";
import type { Variants, Transition } from "framer-motion";

export type PageAnimation = {
  variants?: Variants;
  initial?: string;
  animate?: string;
  exit?: string;
  transition?: Transition;
};

export type NextPageWithAnimation<P = {}, IP = P> = NextPage<P, IP> & {
  pageAnimation?: PageAnimation;
};
