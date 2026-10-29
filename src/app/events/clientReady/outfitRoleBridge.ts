import type { EventHandler } from "commandkit";
import type { Client } from "discord.js";
import { startOutfitRoleBridge } from "../../../services/outfitRoleBridge";

export const once = true;

const handler: EventHandler<"clientReady"> = (readyClient) => {
  startOutfitRoleBridge(readyClient as Client<true>);
};

export default handler;
