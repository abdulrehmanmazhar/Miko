import pino, { type LoggerOptions } from "pino";
import { logsPath } from "../utils/paths/index.js";
import env from "../config/env.js";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";
export type LogExtras = Record<string, unknown>;

const isProduction = env.NODE_ENV === "PRODUCTION";

const loggerOptions: LoggerOptions = {
  level: isProduction ? "info" : "debug",
  base: {
    app: env.APP_NAME,
    environment: env.NODE_ENV,
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

const logger = isProduction
  ? pino(
      loggerOptions,
      pino.transport({
        target: "pino-roll",
        options: {
          file: logsPath,
          mkdir: true,
          frequency: "daily",
          limit: { count: 29 },
        },
      }),
    )
  : pino(loggerOptions);

export function log(
  level: LogLevel,
  message: string,
  extras: LogExtras = {},
): void {
  logger[level](extras, message);
}
