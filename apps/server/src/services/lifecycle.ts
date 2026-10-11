import { readFileSync } from "node:fs";
import type { Channel } from "../protocol/channel.js";
import type { NeutralinoAuth, NeutralinoTransport } from "./transport.js";

export type ShutdownHandler = (reason: string) => void | Promise<void>;

type ShutdownParams = {
  reason?: unknown;
};

/**
 * Registers `app.shutdown` on the channel.
 * After acknowledging the app, runs optional cleanup and exits the process.
 */
export const registerExtensionLifecycle = (
  channel: Channel,
  transport: NeutralinoTransport,
  options?: {
    /** Defaults to 1 as requested for extension process termination. */
    exitCode?: number;
    onShutdown?: ShutdownHandler;
    log?: (message: string, type?: "INFO" | "ERROR") => void;
  },
) => {
  const exitCode = options?.exitCode ?? 1;
  const log = options?.log ?? (() => undefined);
  let shuttingDown = false;

  channel.handle("app.shutdown", async (params) => {
    if (shuttingDown) {
      return { accepted: true, alreadyShuttingDown: true };
    }
    shuttingDown = true;

    const reason =
      params &&
      typeof params === "object" &&
      typeof (params as ShutdownParams).reason === "string"
        ? ((params as ShutdownParams).reason as string)
        : "unknown";

    log(`Shutdown requested (${reason})`);

    // Acknowledge first so the app can proceed to exit.
    queueMicrotask(() => {
      void (async () => {
        try {
          await options?.onShutdown?.(reason);
        } catch (error) {
          log(
            `Shutdown hook failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
            "ERROR",
          );
        } finally {
          channel.stop();
          transport.close();
          log(`Exiting extension with code ${exitCode}`);
          process.exit(exitCode);
        }
      })();
    });

    return { accepted: true, reason };
  });
};

export const readAuth = (): NeutralinoAuth => {
  const authData = readFileSync(process.stdin.fd, "utf-8");
  if (!authData) throw new Error("No auth data found");
  return JSON.parse(authData) as NeutralinoAuth;
};
