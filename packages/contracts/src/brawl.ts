import { z } from 'zod';

export type BrawlCamp = 'blue' | 'red' | 'neutral';

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
  | 'jinchi_dapeng'
  // 初始中立 1 位
  | 'heixiong_jing';

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
  timestamp: string;
}

export interface BrawlBlindBox {
  bluePoolRoles: string[];
  redPoolRoles: string[];
  neutralRole?: string;
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
  neutralChoice?: {
    chosenCamp: 'blue' | 'red';
    chosenAtRound: number;
    autoAssigned: boolean;
  };
  imprisonedTargetId?: string; // 如来佛祖五指山禁锢的玩家（本轮禁止出征与表决）
  taoshouActive?: boolean;     // 王母娘娘九转仙桃庇佑（本轮需至少2张失败才算失败）
  extraSeatLimit?: number;     // 白龙马负重增加的人数上限
}

export interface SelfBrawlView {
  roleId: string;
  roleName: string;
  roleTitle: string;
  camp: BrawlCamp;
  artPrefix?: string;
  skill: BrawlSkillDef;
  skillAvailable: boolean;
  skillUsed: boolean;
  isAwakened?: boolean;
  peekedRoles?: { roleId: string; roleName: string; camp: BrawlCamp }[];
  neutralDecisionPending?: boolean;
}

export const brawlCommandPayloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('chooseCamp'),
    camp: z.enum(['blue', 'red']),
  }),
  z.object({
    action: z.literal('useSkill'),
    skillId: z.string(),
    targetPlayerId: z.string().uuid().optional(),
    targetPlayerId2: z.string().uuid().optional(),
  }),
]);

export type BrawlCommandPayload = z.infer<typeof brawlCommandPayloadSchema>;
