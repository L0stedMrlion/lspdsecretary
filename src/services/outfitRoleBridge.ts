import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { Client } from "discord.js";
import { TARGET_GUILD_ID } from "../config/roleSyncConfig";

const secret = process.env.OUTFIT_BRIDGE_SECRET ?? "";
const host = process.env.OUTFIT_BRIDGE_HOST || "127.0.0.1";
const port = Number(process.env.OUTFIT_BRIDGE_PORT || "3987");
const fivemUrl = process.env.OUTFIT_BRIDGE_FIVEM_URL ||
  "http://127.0.0.1:30120/illenium-appearance/discord-role-update";

function authorized(request: IncomingMessage): boolean {
  const supplied = request.headers["x-outfit-bridge-key"];
  if (!secret || typeof supplied !== "string") return false;
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function respond(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

export function startOutfitRoleBridge(client: Client<true>): void {
  if (secret.length < 24 || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.warn("[OutfitBridge] Disabled: configure OUTFIT_BRIDGE_SECRET and a valid port");
    return;
  }

  const server = createServer(async (request, response) => {
    if (!authorized(request)) {
      respond(response, 401, { error: "Unauthorized" });
      return;
    }
    const match = request.method === "GET" &&
      /^\/roles\/(\d{15,22})$/.exec(request.url || "");
    if (!match) {
      respond(response, 404, { error: "Not found" });
      return;
    }
    try {
      const guild = await client.guilds.fetch(TARGET_GUILD_ID);
      const member = await guild.members.fetch({ user: match[1], force: true }).catch((error: unknown) => {
        if (error && typeof error === "object" && "code" in error && error.code === 10007) {
          return null;
        }
        throw error;
      });
      respond(response, 200, {
        guildId: TARGET_GUILD_ID,
        discordId: match[1],
        roles: member ? [...member.roles.cache.keys()] : [],
      });
    } catch (error) {
      console.error("[OutfitBridge] Role lookup failed:", error);
      respond(response, 503, { error: "Discord roles unavailable" });
    }
  });

  server.on("error", (error) => console.error("[OutfitBridge] HTTP server failed:", error));
  server.listen(port, host, () => {
    console.log(`[OutfitBridge] Listening on ${host}:${port} for guild ${TARGET_GUILD_ID}`);
  });
}

export async function pushOutfitRoleUpdate(discordId: string, roles: string[]): Promise<void> {
  if (!secret) return;
  try {
    const response = await fetch(fivemUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-outfit-bridge-key": secret,
      },
      body: JSON.stringify({
        guildId: TARGET_GUILD_ID,
        discordId,
        roles,
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      console.warn(`[OutfitBridge] FiveM push returned HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn("[OutfitBridge] FiveM push unavailable; next lookup will refresh roles:", error);
  }
}
