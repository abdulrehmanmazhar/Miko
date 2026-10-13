import { Channel } from "../protocol/channel.js";
import type { NeutralinoTransport } from "./transport.js";

export let channel: Channel | null = null;

export const createChannel = (transport: NeutralinoTransport) => {
  if (channel) {
    throw new Error("Channel already created");
  }
  channel = new Channel(transport);

  return channel;
};
