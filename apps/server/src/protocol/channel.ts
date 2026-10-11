import {
  createId,
  isChannelMessage,
  type ChannelMessage,
  type ChannelError,
  type EventMessage,
  type RequestMessage,
  type ResponseMessage,
} from "./types.js";

export type EventHandler = (payload: unknown) => void | Promise<void>;

export type RequestHandler = (params: unknown) => unknown | Promise<unknown>;

export type ChannelTransport = {
  send: (message: ChannelMessage) => void | Promise<void>;
  subscribe: (handler: (message: ChannelMessage) => void) => () => void;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class ChannelErrorException extends Error {
  readonly code?: string;

  constructor(error: ChannelError) {
    super(error.message);
    this.name = "ChannelError";
    if (error.code !== undefined) {
      this.code = error.code;
    }
  }
}

export class Channel {
  private readonly pending = new Map<string, PendingRequest>();
  private readonly eventHandlers = new Map<string, Set<EventHandler>>();
  private readonly requestHandlers = new Map<string, RequestHandler>();
  private unsubscribe: (() => void) | null = null;
  private readonly defaultTimeoutMs: number;
  private readonly transport: ChannelTransport;

  constructor(
    transport: ChannelTransport,
    options?: { requestTimeoutMs?: number },
  ) {
    this.transport = transport;
    this.defaultTimeoutMs = options?.requestTimeoutMs ?? 15_000;
  }

  start() {
    if (this.unsubscribe) return;
    this.unsubscribe = this.transport.subscribe((message) => {
      void this.onMessage(message);
    });
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;

    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`Channel closed before response for ${id}`));
    }
    this.pending.clear();
  }

  on(event: string, handler: EventHandler) {
    const handlers = this.eventHandlers.get(event) ?? new Set();
    handlers.add(handler);
    this.eventHandlers.set(event, handlers);

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    };
  }

  handle(method: string, handler: RequestHandler) {
    this.requestHandlers.set(method, handler);
    return () => {
      if (this.requestHandlers.get(method) === handler) {
        this.requestHandlers.delete(method);
      }
    };
  }

  async emit(name: string, payload?: unknown) {
    const message: EventMessage = { type: "event", name };
    if (payload !== undefined) {
      message.payload = payload;
    }
    await this.transport.send(message);
  }

  async request<T = unknown>(
    method: string,
    params?: unknown,
    options?: { timeoutMs?: number },
  ): Promise<T> {
    const id = createId();
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;

    const message: RequestMessage = { type: "request", id, method };
    if (params !== undefined) {
      message.params = params;
    }

    const result = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timed out: ${method}`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
    });

    await this.transport.send(message);
    return (await result) as T;
  }

  private async onMessage(message: ChannelMessage) {
    if (!isChannelMessage(message)) return;

    switch (message.type) {
      case "event":
        await this.dispatchEvent(message.name, message.payload);
        break;
      case "request":
        await this.dispatchRequest(message);
        break;
      case "response":
        this.dispatchResponse(message);
        break;
    }
  }

  private async dispatchEvent(name: string, payload: unknown) {
    const handlers = this.eventHandlers.get(name);
    if (!handlers) return;
    for (const handler of handlers) {
      await handler(payload);
    }
  }

  private async dispatchRequest(message: RequestMessage) {
    const handler = this.requestHandlers.get(message.method);
    let response: ResponseMessage;

    if (!handler) {
      response = {
        type: "response",
        id: message.id,
        ok: false,
        error: {
          message: `Unknown method: ${message.method}`,
          code: "METHOD_NOT_FOUND",
        },
      };
    } else {
      try {
        const result = await handler(message.params);
        response =
          result === undefined
            ? { type: "response", id: message.id, ok: true }
            : { type: "response", id: message.id, ok: true, result };
      } catch (error) {
        response = {
          type: "response",
          id: message.id,
          ok: false,
          error: {
            message: error instanceof Error ? error.message : "Request failed",
            code: "HANDLER_ERROR",
          },
        };
      }
    }

    await this.transport.send(response);
  }

  private dispatchResponse(message: ResponseMessage) {
    const pending = this.pending.get(message.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(message.id);

    if (message.ok) {
      pending.resolve(message.result);
      return;
    }

    pending.reject(new ChannelErrorException(message.error));
  }
}
