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
  putiDianhuaNotice?: { targetBlueUserId: string; redRoleName: string }; // 菩提祖师点化揭露的红方真名
  jinjiaoHuluTargetId?: string;     // 金角大王紫金葫芦锁定的队员
  yutuMihunTargetId?: string;       // 玉兔精捣药迷魂锁定的队员
  qingshiTuntianTargetId?: string;  // 青毛狮子怪大口吞天锁定的队员
  baiguLijianArmed?: boolean;       // 白骨精画皮离间待命中
  baiguLijianResult?: boolean;      // 白骨精画皮离间是否已生效虚增
  huangmeiDianhuaNotice?: { targetBlueUserId: string; targetSeat: number; targetNickname: string }; // 黄眉老怪假设雷音假传佛旨
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
  putiDianhuaNotice?: string; // 菩提祖师专属私密点化天机（或黄眉老怪假托之天机）
  guanyinGanluResult?: { targetSeat: number; targetNickname: string; success: boolean }; // 观音菩萨专属私密出征探查
  tieshanSecret?: string; // 铁扇公主专属芭蕉神风窥破仙阶天机
  huangmeiNotice?: string; // 黄眉老怪专属假传佛旨状态回执
  baiguLijianStatus?: string; // 白骨精专属画皮离间状态回执
}

export const brawlCommandPayloadSchema = z.object({
  action: z.literal('useSkill'),
  skillId: z.string(),
  targetPlayerId: z.string().optional(),
  targetPlayerId2: z.string().optional(),
});

export type BrawlCommandPayload = z.infer<typeof brawlCommandPayloadSchema>;
