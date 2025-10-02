// pages/_app.tsx
import Head from "next/head";
import type { AppProps } from "next/app";
import "../styles/globals.css";
import { AuthProvider } from "../src/context/AuthContext";
import { Toaster } from "sonner";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { NextPageWithAnimation, PageAnimation } from "../src/types/next";

type AppPropsWithAnimation = AppProps & {
  Component: NextPageWithAnimation;
};

export default function MoneyMap({
  Component,
  pageProps,
}: AppPropsWithAnimation) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const onComplete = () =>
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "instant" as ScrollBehavior,
      });
    router.events.on("routeChangeComplete", onComplete);
    return () => router.events.off("routeChangeComplete", onComplete);
  }, [router.events]);

  const pageAnim: PageAnimation = Component.pageAnimation ?? {
    variants: {
      initial: { opacity: 0 },
      enter: { opacity: 1 },
      exit: { opacity: 0 },
    },
    initial: "initial",
    animate: "enter",
    exit: "exit",
    transition: { duration: 0.28, ease: "easeInOut" },
  };

  const motionProps = reduceMotion
    ? {}
    : {
        initial: pageAnim.initial,
        animate: pageAnim.animate,
        exit: pageAnim.exit,
        variants: pageAnim.variants,
        transition: pageAnim.transition,
      };

  return (
    <>
      <Head>
        <link rel="icon" type="image/png" href="/logo.png" />
      </Head>

      <AuthProvider>
        <Toaster position="top-center" richColors />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={router.asPath}
            {...motionProps}
            style={{ minHeight: "100vh" }}>
            <Component {...pageProps} />
          </motion.div>
        </AnimatePresence>
      </AuthProvider>
    </>
  );
}
