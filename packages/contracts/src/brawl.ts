import { z } from 'zod';

export type BrawlCamp = 'blue' | 'red';

export type BrawlRoleId =
  // 蓝方 15 仙佛
  | 'sun_wukong'
  | 'tang_seng'
  | 'rulai_fozu'
  | 'yuhuang_dadi'
  | 'wangmu_niangniang'
  | 'taishang_laojun'
  | 'puti_zhushi'
  | 'guanyin_pusa'
  | 'zhenyuan_daxian'
  | 'erlang_shen'
  | 'nezha'
  | 'li_tianwang'
  | 'zhu_bajie'
  | 'sha_wujing'
  | 'bai_longma'
  // 红方 15 妖魔
  | 'hong_haier'
  | 'liuer_mihou'
  | 'bai_gujing'
  | 'zhizhu_jing'
  | 'yutu_jing'
  | 'laoshu_jing'
  | 'niu_mowang'
  | 'tieshan_gongzhu'
  | 'huangmei_laoguai'
  | 'jinjiao_dawang'
  | 'yinjiao_dawang'
  | 'huangfeng_guai'
  | 'baiyan_mojun'
  | 'qingmao_shizi'
  | 'jinchi_dapeng';

export const brawlRoleIdSchema = z.string().min(1).max(64);

export type BrawlTriggerPhase =
  | 'team_building'
  | 'team_voting'
  | 'mission_exec'
  | 'mission_resolved'
  | 'assassination'
  | 'passive'
  | 'game_start';

export type BrawlActionType =
  | 'passive'
  | 'single_button'
  | 'target_player'
  | 'target_two_players'
  | 'camp_choice';

export interface BrawlSkillDef {
  skillId: string;
  skillName: string;
  triggerPhase: BrawlTriggerPhase;
  actionType: BrawlActionType;
  maxUses: number;
  description: string;
  awakeningChance?: number;
}

export interface BrawlRoleDef {
  id: string;
  name: string;
  fullName: string;
  title: string;
  camp: BrawlCamp;
  isCore: boolean;
  artPrefix: string;
  motto: string;
  skill: BrawlSkillDef;
  awakeningChance?: number;
  weight?: number;
  minPlayers?: number;
}

export type BrawlEventVisibility = 'anonymous_broadcast' | 'silent';

export type BrawlOrdealId =
  | 'chaotic_fog'
  | 'quicksand_ban'
  | 'selfless_captain'
  | 'shituo_bounty'
  | 'celestial_swap';

export interface BrawlOrdealDef {
  id: BrawlOrdealId;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  minMission?: number;
}

export interface BrawlCelestialSwapRecord {
  roundNumber: number;
  mission: number;
  removedId: string;
  removedSeat: number;
  removedNickname: string;
  addedId: string;
  addedSeat: number;
  addedNickname: string;
}

export interface BrawlOrdealState {
  enabled: boolean;
  /** Length 5 deck (index 0..4 => mission 1..5), unique non-repeating ordeals */
  deck: BrawlOrdealId[];
  currentOrdealId?: BrawlOrdealId;
  /** 弱水流沙：本难被困流沙禁止上车的玩家ID */
  quicksandBannedPlayerId?: string;
  /** 天意篡改：最近一次系统公开换人的记录 */
  lastSwap?: BrawlCelestialSwapRecord;
  /** 狮驼死战：蓝方胜出后公屏揭露的在场妖魔名号 */
  shituoRevealedDemonName?: string;
  /** 狮驼死战：红方胜出后终局刺杀额外排除的非大圣席位 */
  shituoRedBountyArmed?: boolean;
  shituoExcludedPlayerId?: string;
}

export interface BrawlWagerState {
  activeRoundNumber?: number;
  activeCaptainId?: string;
  /** 整局已成功兑现次数（最多 1 次） */
  redeemedCount: number;
  /** 成功兑现后待领队执行的私密查验 */
  pendingInspectorId?: string;
  /** 军令状查验私密结果（对局中仅查验者可见） */
  inspectResult?: {
    inspectorId: string;
    targetId: string;
    targetSeat: number;
    targetNickname: string;
    team: BrawlCamp;
  };
  /** 翻车受罚：该玩家在指定难次全程禁止上车 */
  bannedPlayerId?: string;
  bannedMission?: number;
}

export interface BrawlBattleEvent {
  id: string;
  roleId: string;
  roleName: string;
  skillName: string;
  summary: string;
  description?: string;
  visibility?: BrawlEventVisibility;
  timestamp: string;
}

export interface BrawlReplayAction {
  id: string;
  roundNumber: number; // 0: 开局天机, 1..N: 轮次提案
  mission: number;     // 0: 开局, 1..5: 取经关卡/难次
  phase: BrawlTriggerPhase;
  actorId: string;
  actorSeat: number;
  actorNickname: string;
  roleId: string;
  roleName: string;
  skillName: string;
  targetId?: string;
  targetSeat?: number;
  targetNickname?: string;
  outcome: 'success' | 'blocked' | 'miss' | 'info';
  detail: string;
  timestamp: string;
}

export interface BrawlBlindBox {
  bluePoolRoles: string[];
  redPoolRoles: string[];
}

export interface BrawlPlayerState {
  userId: string;
  seat: number;
  roleId: string;
  camp: BrawlCamp;
  skillUsed: boolean;
  isAwakened?: boolean;
  wishRank?: number; // 命中心愿的志愿序号 (1 ~ 5)
  bonusRoleId?: string; // 5~8人局核心角色额外配发的同阵营随机副法宝来源角色 ID
}

export interface BrawlGameState {
  enabled: boolean;
  blindBox: BrawlBlindBox;
  playerStates: Record<string, BrawlPlayerState>;
  events: BrawlBattleEvent[];
  replayTimeline?: BrawlReplayAction[]; // 对局全景复盘记录（局中对客户端物理保密，终局胜负已定时解密下发）
  imprisonedTargetId?: string; // 如来佛祖五指山禁锢的玩家（本轮禁止出征与表决）
  taoshouActive?: boolean;     // 王母娘娘九转仙桃庇佑（本轮需至少2张失败才算失败）
  extraSeatLimit?: number;     // 白龙马负重增加的人数上限
  laojunZhuoActive?: boolean;  // 太上老君金刚琢法宝生效中（拦截下一个妖魔主动技能）
  zhizhuBannedTargetId?: string; // 蜘蛛精盘丝结茧禁锢的玩家（本轮禁止出征）
  doubleVoteUserId?: string;   // 哪吒三太子/牛魔王激活的双倍表决票用户
  yishanTargetId?: string;     // 银角大王移山压顶目标（表决票强制被压制为弃权）
  dapengArmed?: boolean;       // 金翅大鹏雕云程万里是否已发动待命
  dapengExcludedPlayerId?: string; // 金翅大鹏雕云程万里排除的非大圣席位
  zhaoyaoResult?: { hasDemon: boolean; teamPlayerIds: string[] }; // 托塔李天王照妖镜探查私密结果
  shawujingBaozhangArmed?: boolean; // 沙悟净降妖宝杖平票定海待命
  zhubajieDaodaArmed?: boolean;     // 猪八戒倒打一耙反转票待命
  tieshanShenfengArmed?: boolean;   // 铁扇公主芭蕉神风待命
  tieshanSecret?: string;           // 铁扇公主芭蕉神风窥破仙阶私密情报
  huangfengMihuoActive?: boolean;   // 黄风怪三昧神风生效中
  yuhuangYuzhiArmed?: boolean;      // 玉皇大帝天尊玉旨赦免待命
  guanyinGanluTargetId?: string;    // 观音菩萨净瓶甘露标记目标
  guanyinGanluResult?: { targetId: string; targetSuccess: boolean }; // 观音菩萨净瓶甘露探查结果
  guanyinGanluNotOnTeam?: string;   // 观音菩萨甘露目标未随队出征
  putiDianhuaNotice?: { targetBlueUserId: string; redRoleName: string }; // 菩提祖师点化揭露的红方真名
  jinjiaoHuluTargetId?: string;     // 金角大王紫金葫芦锁定的队员
  jinjiaoResult?: { targetSeat: number; targetNickname: string; absorbed: boolean; notOnTeam?: boolean }; // 金角大王紫金葫芦结算结果
  yutuMihunTargetId?: string;       // 玉兔精捣药迷魂锁定的队员
  yutuResult?: { targetSeat: number; targetNickname: string; discarded: boolean; notOnTeam?: boolean }; // 玉兔精捣药迷魂结算结果
  qingshiTuntianTargetId?: string;  // 青毛狮子怪大口吞天锁定的队员
  baiguLijianArmed?: boolean;       // 白骨精画皮离间待命中
  baiguLijianResult?: boolean;      // 白骨精画皮离间是否已生效虚增
  huangfengSecret?: string;         // 黄风怪三昧神风刺探出的神仙真名
  huangmeiDianhuaNotice?: { targetBlueUserId: string; targetSeat: number; targetNickname: string }; // 黄眉老怪假设雷音假传佛旨
  baiyanDuchaTargetId?: string;     // 百眼魔君黄花毒茶锁定的队员
  baiyanDuchaResult?: boolean;      // 百眼魔君黄花毒茶是否成功毒化出失败
  baiyanDuchaNotOnTeam?: boolean;   // 百眼魔君黄花毒茶目标是否未在出征车队中
  ordeals?: BrawlOrdealState;       // 八十一难 · 每难一劫状态
  wager?: BrawlWagerState;          // 队长自愿立军令状状态
  phantomEvilId?: string;           // 画皮惑眼：孙悟空视野混入的无辜蓝方假红 ID（局中物理脱敏，终局揭晓）
}

export interface SelfBrawlView {
  roleId: string;
  roleName: string;
  roleTitle: string;
  camp: BrawlCamp;
  artPrefix?: string;
  motto?: string;
  skill: BrawlSkillDef;
  skillAvailable: boolean;
  skillUsed: boolean;
  bonusRoleId?: string;
  bonusRoleName?: string;
  isAwakened?: boolean;
  wishRank?: number; // 命中心愿的志愿序号 (1 ~ 5)
  peekedRoles?: { roleId: string; roleName: string; camp: BrawlCamp }[];
  zhaoyaoResult?: boolean; // 李天王专属：当前车队是否有妖魔
  dapengExcludedPlayerId?: string; // 终局刺杀阶段排除的非孙悟空席位
  shituoExcludedPlayerId?: string; // 狮驼死战红方胜出终局额外排除的非孙悟空席位
  phantomVisionActive?: boolean; // 孙悟空专属：本局开启画皮惑眼（视野含1名假红）
  canWagerInspect?: boolean; // 军令状：当前玩家有待执行的私密查验特权
  wagerInspectResult?: { targetSeat: number; targetNickname: string; team: BrawlCamp }; // 军令状查验私密结果
  putiDianhuaNotice?: string; // 菩提祖师专属私密点化天机（或黄眉老怪假托之天机）
  guanyinGanluResult?: { targetSeat: number; targetNickname: string; success: boolean }; // 观音菩萨专属私密出征探查
  guanyinNotice?: string; // 观音菩萨专属净瓶甘露显圣状态/结果回执
  tieshanSecret?: string; // 铁扇公主专属芭蕉神风窥破仙阶天机
  huangfengSecret?: string; // 黄风怪专属三昧神风吹探天机
  huangmeiNotice?: string; // 黄眉老怪专属假传佛旨状态回执
  baiguLijianStatus?: string; // 白骨精专属画皮离间状态回执
  baiyanDuchaStatus?: string; // 百眼魔君专属黄花毒茶状态回执
  jinjiaoNotice?: string; // 金角大王专属紫金葫芦吸收回执
  yutuNotice?: string; // 玉兔精专属捣药迷魂封印回执
  generalFeedback?: string; // 通用法宝施法/生效私密回执（保证所有角色均有明确私密结果告知）
}

export const brawlCommandPayloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('useSkill'),
    skillId: z.string(),
    targetPlayerId: z.string().optional(),
    targetPlayerId2: z.string().optional(),
  }).strict(),
  z.object({
    action: z.literal('wagerInspect'),
    targetPlayerId: z.string().min(1),
  }).strict(),
]);

export type BrawlCommandPayload = z.infer<typeof brawlCommandPayloadSchema>;
