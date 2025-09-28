import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  maxWorkers: 1,
  detectOpenHandles: true,
};

export default config;
