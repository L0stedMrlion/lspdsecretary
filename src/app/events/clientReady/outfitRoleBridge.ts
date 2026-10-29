import type { EventHandler } from "commandkit";
import { TARGET_GUILD_ID } from "../../../config/roleSyncConfig";
import { startOutfitRoleBridge } from "../../../services/outfitRoleBridge";

export const once = true;

const handler: EventHandler<"clientReady"> = (readyClient) => {
  startOutfitRoleBridge(async (discordId) => {
    const guild = await readyClient.guilds.fetch(TARGET_GUILD_ID);
    const member = await guild.members.fetch({ user: discordId, force: true }).catch((error: unknown) => {
      if (error && typeof error === "object" && "code" in error && error.code === 10007) {
        return null;
      }
      throw error;
    });
    return member ? [...member.roles.cache.keys()] : [];
  });
};

export default handler;
