import { Channel } from "../protocol/channel";
import type { ChannelMessage } from "../protocol/types";
import {
  createMemoryTransport,
  createNeutralinoTransport,
  isNeutralinoRuntime,
} from "../transport";

const transport = isNeutralinoRuntime()
  ? createNeutralinoTransport()
  : createMemoryTransport();

export const channel = new Channel(transport);
channel.start();

export const attachMemoryHandler = (
  handler: (
    message: ChannelMessage,
    reply: (message: ChannelMessage) => void,
  ) => void,
) => {
  if (
    "attachHandler" in transport &&
    typeof transport.attachHandler === "function"
  ) {
    transport.attachHandler(handler);
  }
};
