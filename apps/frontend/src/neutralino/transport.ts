import neutralino from "@neutralinojs/lib";
import {
  CHANNEL_EVENT,
  EXTENSION_ID,
  isChannelMessage,
  type ChannelMessage,
} from "./protocol/types";
import type { ChannelTransport } from "./protocol/channel";

type CustomEventDetail = {
  detail?: unknown;
};

const readDetail = (event: CustomEventDetail): unknown => {
  const detail = event.detail;
  if (detail && typeof detail === "object" && "detail" in detail) {
    return (detail as { detail?: unknown }).detail;
  }
  return detail;
};

export const isNeutralinoRuntime = () =>
  typeof window !== "undefined" && "NL_TOKEN" in window;

export const createNeutralinoTransport = (): ChannelTransport => {
  const listeners = new Set<(message: ChannelMessage) => void>();

  void neutralino.events.on(CHANNEL_EVENT, (event: CustomEventDetail) => {
    const data = readDetail(event);
    if (!isChannelMessage(data)) return;
    for (const listener of listeners) {
      listener(data);
    }
  });

  return {
    send: async (message) => {
      await neutralino.extensions.dispatch(EXTENSION_ID, CHANNEL_EVENT, message);
    },
    subscribe: (handler) => {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
  };
};

/** In-memory backend so the UI works outside Neutralino (plain Vite). */
export const createMemoryTransport = (): ChannelTransport & {
  attachHandler: (
    handler: (message: ChannelMessage, reply: (message: ChannelMessage) => void) => void,
  ) => void;
} => {
  const listeners = new Set<(message: ChannelMessage) => void>();
  let backend:
    | ((message: ChannelMessage, reply: (message: ChannelMessage) => void) => void)
    | null = null;

  const deliver = (message: ChannelMessage) => {
    for (const listener of listeners) {
      listener(message);
    }
  };

  return {
    attachHandler: (handler) => {
      backend = handler;
    },
    send: async (message) => {
      if (!backend) {
        throw new Error("Memory transport has no backend handler");
      }
      backend(message, deliver);
    },
    subscribe: (handler) => {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
  };
};
