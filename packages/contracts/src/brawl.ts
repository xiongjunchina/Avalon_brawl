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

export interface BrawlBattleEvent {
  id: string;
  roleId: string;
  roleName: string;
  skillName: string;
  summary: string;
  description?: string;
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
}

export interface BrawlGameState {
  enabled: boolean;
  blindBox: BrawlBlindBox;
  playerStates: Record<string, BrawlPlayerState>;
  events: BrawlBattleEvent[];
  imprisonedTargetId?: string; // 如来佛祖五指山禁锢的玩家（本轮禁止出征与表决）
  taoshouActive?: boolean;     // 王母娘娘九转仙桃庇佑（本轮需至少2张失败才算失败）
  extraSeatLimit?: number;     // 白龙马负重增加的人数上限
  laojunZhuoActive?: boolean;  // 太上老君金刚琢法宝生效中（拦截下一个妖魔主动技能）
  zhizhuBannedTargetId?: string; // 蜘蛛精盘丝结茧禁锢的玩家（本轮禁止出征）
  doubleVoteUserId?: string;   // 哪吒三太子/牛魔王激活的双倍表决票用户
  yishanTargetId?: string;     // 银角大王移山压顶目标（表决票强制被压制为弃权）
  dapengExcludedPlayerId?: string; // 金翅大鹏雕云程万里排除的非大圣席位
  zhaoyaoResult?: { hasDemon: boolean; teamPlayerIds: string[] }; // 托塔李天王照妖镜探查私密结果
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
  isAwakened?: boolean;
  peekedRoles?: { roleId: string; roleName: string; camp: BrawlCamp }[];
  zhaoyaoResult?: boolean; // 李天王专属：当前车队是否有妖魔
  dapengExcludedPlayerId?: string; // 终局刺杀阶段排除的非孙悟空席位
}

export const brawlCommandPayloadSchema = z.object({
  action: z.literal('useSkill'),
  skillId: z.string(),
  targetPlayerId: z.string().uuid().optional(),
  targetPlayerId2: z.string().uuid().optional(),
});

export type BrawlCommandPayload = z.infer<typeof brawlCommandPayloadSchema>;
