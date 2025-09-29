// pages/dashboard.tsx
import type { NextPageWithAnimation } from "../../src/types/next";
import type { Variants } from "framer-motion";

const slideLeftVariants: Variants = {
  initial: { opacity: 0, x: 40, scale: 0.995 },
  enter: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -40, scale: 0.995 },
};

const Dashboard: NextPageWithAnimation = () => {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p>Your protected content here.</p>
    </div>
  );
};

Dashboard.pageAnimation = {
  variants: slideLeftVariants,
  initial: "initial",
  animate: "enter",
  exit: "exit",
  transition: { duration: 0.36, ease: "easeInOut" },
};

export default Dashboard;
