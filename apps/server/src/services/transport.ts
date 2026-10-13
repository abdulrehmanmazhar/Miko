import {
  createId,
  CHANNEL_EVENT,
  type ChannelMessage,
  isChannelMessage,
} from "../protocol/types.js";
import type { ChannelTransport } from "../protocol/channel.js";

export type NeutralinoAuth = {
  nlPort: string;
  nlToken: string;
  nlConnectToken: string;
  nlExtensionId: string;
};

type IncomingNeutralinoMessage = {
  event?: string;
  data?: unknown;
};

export type NeutralinoTransport = ChannelTransport & {
  socket: WebSocket;
  close: () => void;
};

export const connectNeutralinoTransport = (
  auth: NeutralinoAuth,
  logger: (level: "info" | "warn" | "error", message: string) => void,
  options?: {
    onLifecycleEvent?: (event: string, data: unknown) => void;
  },
): NeutralinoTransport => {
  const socket = new WebSocket(
    `ws://localhost:${auth.nlPort}?extensionId=${auth.nlExtensionId}&connectToken=${auth.nlConnectToken}`,
  );

  const listeners = new Set<(message: ChannelMessage) => void>();

  const transport: NeutralinoTransport = {
    socket,
    send: (message) => {
      if (socket.readyState !== WebSocket.OPEN) {
        throw new Error("Neutralino WebSocket is not open");
      }

      socket.send(
        JSON.stringify({
          id: createId(),
          method: "app.broadcast",
          accessToken: auth.nlToken,
          data: {
            event: CHANNEL_EVENT,
            data: message,
          },
        }),
      );
    },
    subscribe: (handler) => {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
    close: () => {
      listeners.clear();
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    },
  };

  socket.onmessage = (event) => {
    let parsed: IncomingNeutralinoMessage;
    try {
      parsed = JSON.parse(String(event.data)) as IncomingNeutralinoMessage;
    } catch {
      return;
    }

    const { event: eventName, data } = parsed;
    if (!eventName) return;

    if (eventName === CHANNEL_EVENT && isChannelMessage(data)) {
      for (const listener of listeners) {
        listener(data);
      }
      return;
    }

    options?.onLifecycleEvent?.(eventName, data);
  };

  socket.onerror = (event) => {
    logger("error", `WebSocket error: ${event}`);
  };

  return transport;
};
