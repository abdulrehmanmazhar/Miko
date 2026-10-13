export const CHANNEL_EVENT = "channel";

export const EXTENSION_ID = "js.neutralino.binaryextension";

export type ChannelError = {
  message: string;
  code?: string;
};

export type EventMessage = {
  type: "event";
  name: string;
  payload?: unknown;
};

export type RequestMessage = {
  type: "request";
  id: string;
  method: string;
  params?: unknown;
};

export type ResponseMessage =
  | {
      type: "response";
      id: string;
      ok: true;
      result?: unknown;
    }
  | {
      type: "response";
      id: string;
      ok: false;
      error: ChannelError;
    };

export type ChannelMessage = EventMessage | RequestMessage | ResponseMessage;

export const isChannelMessage = (value: unknown): value is ChannelMessage => {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return type === "event" || type === "request" || type === "response";
};

export const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
