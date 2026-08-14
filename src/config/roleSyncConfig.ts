export interface SyncRule {
  sourceGuildId: string;
  sourceRoleId: string;
  targetRoleId: string;
}

/**
 * Role sync table.
 *
 * | Source Guild     | Source Role      | → Target Role     |
 */
export const TARGET_GUILD_ID = "1348336228411375729";

export const SYNC_RULES: SyncRule[] = [
  {
    sourceGuildId: "1350602855798669382",
    sourceRoleId: "1350608439805608037",
    targetRoleId: "1350411653690294382",
  },
  {
    sourceGuildId: "1313589265195864074",
    sourceRoleId: "1320317608494370846",
    targetRoleId: "1350412592346300488",
  },
  {
    sourceGuildId: "1297571085528596552",
    sourceRoleId: "1297582035950370816",
    targetRoleId: "1350413172435320873",
  },
  {
    sourceGuildId: "1370049967023980594",
    sourceRoleId: "1370095967017369700",
    targetRoleId: "1350412973973180417",
  },
  {
    sourceGuildId: "1469636829732016306",
    sourceRoleId: "1517863169224085626",
    targetRoleId: "1350412720599732295",
  },
  {
    sourceGuildId: "1508904336342909088",
    sourceRoleId: "1508904336527458361",
    targetRoleId: "1517079569641898055",
  },
];
