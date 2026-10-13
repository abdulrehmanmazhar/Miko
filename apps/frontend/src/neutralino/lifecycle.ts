import neutralino from "@neutralinojs/lib";
import { channel } from "./api/channel";
import { EXTENSION_ID } from "./protocol/types";

export type ShutdownReason = "windowClose" | "user" | "fatal" | string;

export type ShutdownOptions = {
  reason?: ShutdownReason;
  /** How long to wait for the extension to acknowledge before forcing app exit. */
  timeoutMs?: number;
  /** Exit code passed to Neutralino `app.exit`. */
  appExitCode?: number;
};

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Coordinates a graceful Neutralino ↔ extension shutdown:
 * 1. App asks the extension to shut down (`app.shutdown` request)
 * 2. Extension finishes cleanup, replies, then `process.exit`
 * 3. App exits only after the acknowledgement (or timeout)
 */
export class ExtensionLifecycle {
  private shuttingDown = false;
  private started = false;

  get isShuttingDown() {
    return this.shuttingDown;
  }

  start() {
    if (this.started) return;
    this.started = true;

    void neutralino.events.on("windowClose", () => {
      void this.shutdown({ reason: "windowClose" });
    });
  }

  async shutdown(options: ShutdownOptions = {}) {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    const reason = options.reason ?? "user";
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const appExitCode = options.appExitCode ?? 0;

    try {
      const connected = await this.isExtensionConnected();
      if (connected) {
        await channel.request<{ accepted: boolean }>(
          "app.shutdown",
          { reason },
          { timeoutMs },
        );
      }
    } catch (error) {
      console.warn(
        "[lifecycle] Extension shutdown acknowledgement failed; forcing app exit.",
        error,
      );
    }

    try {
      await neutralino.app.exit(appExitCode);
    } catch (error) {
      console.error("[lifecycle] app.exit failed", error);
    }
  }

  private async isExtensionConnected() {
    try {
      const stats = await neutralino.extensions.getStats();
      const connected = (stats as { connected?: string[] }).connected ?? [];
      return connected.includes(EXTENSION_ID);
    } catch {
      // Older / restricted runtimes — attempt the request anyway.
      return true;
    }
  }
}

export const extensionLifecycle = new ExtensionLifecycle();
