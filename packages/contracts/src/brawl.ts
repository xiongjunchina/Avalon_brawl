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
  | 'game_start'
  | 'game_end';

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

export interface BrawlPeekedRole {
  roleId: string;
  roleName: string;
  camp: BrawlCamp;
}

/**
 * 服务端权威私密状态容器：
 * 对局进行中由 `projectBrawlGameState` 整块物理剔除，绝不向任何公共快照泄露；
 * 仅在 `projectSelfBrawlView` 按权限精准投影给本人，或在终局后解密供复盘使用。
 */
export interface BrawlSecretState {
  /** 玩家本局法宝施展/结算私密永久回执（跨难次永久保留） */
  privateReceipts: Record<string, string>;
  /** 开局盲盒情报特权（二郎神看 1 红、百眼魔君看 1 蓝、老鼠精看 1 蓝） */
  peekedMap?: Record<string, BrawlPeekedRole[]>;
  /** 画皮惑眼：孙悟空眼中混入的无辜蓝方假红玩家 ID */
  phantomEvilId?: string;
  /** 托塔李天王照妖宝镜私密结果 */
  zhaoyaoResult?: {
    hasDemon: boolean;
    teamPlayerIds: string[];
    mission?: number;
    roundNumber?: number;
    teamSummary?: string;
  };
  /** 金翅大鹏雕云程万里蓄力及排除席位 */
  dapengArmed?: boolean;
  dapengExcludedPlayerId?: string;
  /** 观音菩萨净瓶甘露 */
  guanyinGanluTargetId?: string;
  guanyinGanluResult?: { targetId: string; targetSuccess: boolean };
  guanyinGanluNotOnTeam?: string;
  /** 菩提祖师道法点化 */
  putiDianhuaNotice?: { targetBlueUserId: string; redRoleName: string };
  /** 黄眉老怪假设雷音假传佛旨 */
  huangmeiDianhuaNotice?: { targetBlueUserId: string; targetSeat: number; targetNickname: string };
  /** 金角大王紫金葫芦 */
  jinjiaoHuluTargetId?: string;
  jinjiaoResult?: { targetSeat: number; targetNickname: string; absorbed: boolean; notOnTeam?: boolean };
  /** 玉兔精捣药迷魂 */
  yutuMihunTargetId?: string;
  yutuResult?: { targetSeat: number; targetNickname: string; discarded: boolean; notOnTeam?: boolean };
  /** 百眼魔君黄花毒茶 */
  baiyanDuchaTargetId?: string;
  baiyanDuchaResult?: boolean;
  baiyanDuchaNotOnTeam?: boolean;
  /** 白骨精画皮离间 */
  baiguLijianArmed?: boolean;
  baiguLijianResult?: boolean;
  /** 铁扇公主芭蕉神风 */
  tieshanSecret?: string;
  /** 黄风怪三昧神风 */
  huangfengSecret?: string;
}

export interface BrawlGameState {
  enabled: boolean;
  /** 仅服务端内部及终局解密态包含；局中公共快照物理剔除 */
  blindBox?: BrawlBlindBox;
  /** 仅服务端内部及终局解密态包含；局中公共快照物理剔除 */
  playerStates?: Record<string, BrawlPlayerState>;
  /** 局中仅保留 anonymous_broadcast 显性播报；终局含全部事件 */
  events: BrawlBattleEvent[];
  /** 对局全景复盘记录（局中物理剔除，终局解密） */
  replayTimeline?: BrawlReplayAction[];
  /** 服务端私密状态容器（局中整块物理剔除） */
  secrets?: BrawlSecretState;

  // ==================== 局中公开生效的显性状态 ====================
  imprisonedTargetId?: string;     // 如来佛祖五行山掌禁锢的玩家（禁选禁投）
  zhizhuBannedTargetId?: string;   // 蜘蛛精盘丝结茧禁选的玩家
  qingshiTuntianTargetId?: string; // 青毛狮子怪大口吞天禁选的玩家
  extraSeatLimit?: number;         // 白龙马龙马负重增加的本难人数上限
  laojunZhuoActive?: boolean;      // 太上老君金刚琢悬空拦截待命
  doubleVoteUserId?: string;       // 哪吒三太子/牛魔王激活的双倍表决票用户
  yishanTargetId?: string;         // 银角大王移山压顶强制弃权目标
  taoshouActive?: boolean;         // 王母娘娘九转仙桃护体待命
  yuhuangYuzhiArmed?: boolean;     // 玉皇大帝天尊玉旨赦免待命
  shawujingBaozhangArmed?: boolean;// 沙悟净降妖宝杖定海待命
  zhubajieDaodaArmed?: boolean;    // 猪八戒倒打一耙反转票待命
  ordeals?: BrawlOrdealState;      // 八十一难 · 每难一劫状态
  wager?: BrawlWagerState;         // 队长自愿立军令状状态
}

/** 服务端单一数据源计算的技能可选目标项 */
export interface BrawlSkillTargetOption {
  playerId: string;
  seat: number;
  nickname: string;
  disabled: boolean;
  /** 目标附加状态标签（如「出征队员」「未入队」「队长·不可选」「你自己·不可选」） */
  tag?: string;
  /** 排序权重（车上队员=0 排前，其余=1 按座号排） */
  priority?: number;
}

/** 服务端单一数据源计算的技能操作态（前端零规则分支，直接渲染） */
export interface BrawlSkillControlState {
  visible: boolean;
  canCast: boolean;
  blockedReason?: string;
  requiresTarget: boolean;
  targetOptions?: BrawlSkillTargetOption[];
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
  /** 服务端权威计算的技能发动控制态与合法目标列表 */
  skillControl?: BrawlSkillControlState;
  bonusRoleId?: string;
  bonusRoleName?: string;
  isAwakened?: boolean;
  wishRank?: number;
  peekedRoles?: BrawlPeekedRole[];
  zhaoyaoResult?: boolean;
  zhaoyaoDetail?: string;
  dapengExcludedPlayerId?: string;
  shituoExcludedPlayerId?: string;
  phantomVisionActive?: boolean;
  canWagerInspect?: boolean;
  wagerInspectResult?: { targetSeat: number; targetNickname: string; team: BrawlCamp };
  putiDianhuaNotice?: string;
  guanyinGanluResult?: { targetSeat: number; targetNickname: string; success: boolean };
  guanyinNotice?: string;
  tieshanSecret?: string;
  huangfengSecret?: string;
  huangmeiNotice?: string;
  baiguLijianStatus?: string;
  baiyanDuchaStatus?: string;
  jinjiaoNotice?: string;
  yutuNotice?: string;
  generalFeedback?: string;
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
