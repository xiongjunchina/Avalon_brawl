import type {
  BrawlGameState,
  BrawlPlayerState,
  BrawlBattleEvent,
  BrawlReplayAction,
  BrawlRoleDef,
  SelfBrawlView,
} from '@avalon/contracts';
import { BRAWL_ROLE_REGISTRY } from './brawl-registry.js';

/**
 * 创建大乱斗初始状态
 */
export function createBrawlGameState(
  playerStates: Record<string, BrawlPlayerState>,
  bluePoolRoles: string[],
  redPoolRoles: string[],
): BrawlGameState {
  return {
    enabled: true,
    blindBox: {
      bluePoolRoles,
      redPoolRoles,
    },
    playerStates,
    events: [],
    replayTimeline: [],
    imprisonedTargetId: undefined,
    taoshouActive: false,
    extraSeatLimit: 0,
    laojunZhuoActive: false,
    zhizhuBannedTargetId: undefined,
    doubleVoteUserId: undefined,
    yishanTargetId: undefined,
    dapengArmed: false,
    dapengExcludedPlayerId: undefined,
    zhaoyaoResult: undefined,
    shawujingBaozhangArmed: false,
    zhubajieDaodaArmed: false,
    tieshanShenfengArmed: false,
    tieshanSecret: undefined,
    huangfengMihuoActive: false,
    yuhuangYuzhiArmed: false,
    guanyinGanluTargetId: undefined,
    guanyinGanluResult: undefined,
    putiDianhuaNotice: undefined,
    jinjiaoHuluTargetId: undefined,
    yutuMihunTargetId: undefined,
    qingshiTuntianTargetId: undefined,
    baiguLijianArmed: false,
    baiguLijianResult: false,
    huangmeiDianhuaNotice: undefined,
    baiyanDuchaTargetId: undefined,
    baiyanDuchaResult: undefined,
  };
}

/**
 * 生成全场天机战报（公法不公人：严格不透露玩家座位和用户ID）
 */
export function appendBattleEvent(
  state: BrawlGameState,
  roleId: string,
  summary: string,
  description?: string,
): BrawlBattleEvent {
  const role = BRAWL_ROLE_REGISTRY[roleId];
  const roleName = role ? role.name : roleId;
  const skillName = role ? role.skill.skillName : '独门法宝';
  const event: BrawlBattleEvent = {
    id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    roleId,
    roleName,
    skillName,
    summary,
    description: description || role?.skill.description,
    timestamp: new Date().toISOString(),
  };
  state.events.push(event);
  return event;
}

/**
 * 记录全景对局复盘动作（服务端权威留存，终局胜负已定时全盘揭晓）
 */
export function recordBrawlReplayAction(
  state: BrawlGameState,
  action: Omit<BrawlReplayAction, 'id' | 'timestamp'>,
): BrawlReplayAction {
  if (!state.replayTimeline) {
    state.replayTimeline = [];
  }
  const entry: BrawlReplayAction = {
    ...action,
    id: `replay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  state.replayTimeline.push(entry);
  return entry;
}

/**
 * 投影大乱斗状态：
 * 对局中物理级剔除所有对局复盘记录和暗中技能目标，彻底杜绝抓包看底牌；
 * 终局揭晓（isEnded 为 true）时完整解密下发 replayTimeline。
 */
export function projectBrawlGameState(
  brawl: BrawlGameState,
  isEnded: boolean,
): BrawlGameState {
  if (isEnded) {
    return structuredClone(brawl);
  }
  const sanitized = structuredClone(brawl);
  // 对局中严格删除复盘时间线
  delete sanitized.replayTimeline;

  // 对局中清理私密目标，防止通过客户端全局状态窥探暗中施法
  delete sanitized.baiyanDuchaTargetId;
  delete sanitized.baiyanDuchaResult;
  delete sanitized.huangmeiDianhuaNotice;
  delete sanitized.guanyinGanluTargetId;
  delete sanitized.guanyinGanluResult;
  delete sanitized.putiDianhuaNotice;
  delete sanitized.jinjiaoHuluTargetId;
  delete sanitized.yutuMihunTargetId;
  delete sanitized.baiguLijianArmed;
  delete sanitized.baiguLijianResult;
  delete sanitized.tieshanSecret;
  delete sanitized.dapengArmed;
  delete sanitized.dapengExcludedPlayerId;
  delete sanitized.zhaoyaoResult;

  return sanitized;
}

/**
 * 任务出牌合法性校验（蓝方仙友只能出成功）
 */
export function validateBrawlMissionVote(
  state: BrawlGameState,
  userId: string,
  mission: number,
  success: boolean,
): { valid: boolean; error?: string } {
  const player = state.playerStates[userId];
  if (!player) return { valid: true };

  // 蓝方不能出失败牌
  if (player.camp === 'blue' && !success) {
    return {
      valid: false,
      error: 'BLUE_CANNOT_FAIL: 蓝方仙友只能出成功牌',
    };
  }

  return { valid: true };
}

/**
 * 校验如来佛祖五指山禁锢（不可上车、不可参与表决）
 */
export function isPlayerImprisoned(state: BrawlGameState, playerId: string): boolean {
  return state.imprisonedTargetId === playerId;
}

/**
 * 重置单轮生效的临时技能状态
 */
export function resetRoundBrawlEffects(state: BrawlGameState): void {
  state.imprisonedTargetId = undefined;
  state.taoshouActive = false;
  state.extraSeatLimit = 0;
  state.zhizhuBannedTargetId = undefined;
  state.doubleVoteUserId = undefined;
  state.yishanTargetId = undefined;
  state.zhaoyaoResult = undefined;
  state.guanyinGanluTargetId = undefined;
  state.jinjiaoHuluTargetId = undefined;
  state.yutuMihunTargetId = undefined;
  state.qingshiTuntianTargetId = undefined;
  state.baiguLijianArmed = false;
  state.baiyanDuchaTargetId = undefined;
}

/**
 * 生成玩家个人的乱斗私密视图
 */
export function projectSelfBrawlView(
  state: BrawlGameState,
  userId: string,
  mission: number,
  peekedMap: Record<string, { roleId: string; roleName: string; camp: 'blue' | 'red' }[]> = {},
  players: { id: string; seat: number; nickname: string }[] = [],
): SelfBrawlView | undefined {
  const playerState = state.playerStates[userId];
  if (!playerState) return undefined;

  const roleDef = BRAWL_ROLE_REGISTRY[playerState.roleId];
  if (!roleDef) return undefined;

  const isLiTianwang = playerState.roleId === 'li_tianwang';
  const isGuanyin = playerState.roleId === 'guanyin_pusa';
  const isAssassinOrDapeng = playerState.roleId === 'hong_haier' || playerState.roleId === 'jinchi_dapeng';

  let guanyinNotice: { targetSeat: number; targetNickname: string; success: boolean } | undefined;
  if (isGuanyin && state.guanyinGanluResult) {
    const targetPlayer = players.find(p => p.id === state.guanyinGanluResult?.targetId);
    if (targetPlayer) {
      guanyinNotice = {
        targetSeat: targetPlayer.seat,
        targetNickname: targetPlayer.nickname,
        success: state.guanyinGanluResult.targetSuccess,
      };
    }
  }

  let dianhuaNoticeText: string | undefined;
  if (state.putiDianhuaNotice?.targetBlueUserId === userId) {
    dianhuaNoticeText = `🔮 菩提祖师道法点化真传：天机暗授，场上潜伏群妖之一的真名为【${state.putiDianhuaNotice.redRoleName}】！`;
  } else if (state.huangmeiDianhuaNotice?.targetBlueUserId === userId) {
    dianhuaNoticeText = `🔮 菩提祖师道法点化真传：天机暗授，暗查【${state.huangmeiDianhuaNotice.targetSeat}号 · ${state.huangmeiDianhuaNotice.targetNickname}】身上妖氛缠绕！`;
  }

  let huangmeiNotice: string | undefined;
  if (playerState.roleId === 'huangmei_laoguai' && state.huangmeiDianhuaNotice) {
    huangmeiNotice = `🪷 假设雷音佛音已发：已假借菩提祖师真传之名，将【${state.huangmeiDianhuaNotice.targetSeat}号 · ${state.huangmeiDianhuaNotice.targetNickname}】是妖魔的假天机私密投递给了 1 名蓝方仙友！`;
  }

  let baiguLijianStatus: string | undefined;
  if (playerState.roleId === 'bai_gujing') {
    if (state.baiguLijianResult) {
      baiguLijianStatus = '💀 离间魔功已得逞：本轮出征战报已静默虚增 1 张失败牌，好人同乘已自相猜忌！';
    } else if (state.baiguLijianArmed) {
      baiguLijianStatus = '💀 离间魔骨已就绪：本轮任务出征若出现失败牌，将静默虚增 1 败制造冤案！';
    }
  }

  let baiyanDuchaStatus: string | undefined;
  if (playerState.roleId === 'baiyan_mojun') {
    if (state.baiyanDuchaResult === true) {
      baiyanDuchaStatus = '🍵 黄花毒茶毒发：车上仙友的成功牌已静默被剧毒反转为失败牌！';
    } else if (state.baiyanDuchaResult === false) {
      baiyanDuchaStatus = '🍵 黄花毒茶未奏效：车上仙友浩然正气护体，毒性未能侵蚀。';
    } else if (state.baiyanDuchaTargetId) {
      baiyanDuchaStatus = '🍵 黄花毒茶已暗中下入出征车队杯中，待出征结算生效...';
    }
  }

  return {
    roleId: playerState.roleId,
    roleName: roleDef.name,
    roleTitle: roleDef.title,
    camp: playerState.camp,
    artPrefix: roleDef.artPrefix,
    motto: roleDef.motto,
    skill: roleDef.skill,
    skillAvailable: !playerState.skillUsed,
    skillUsed: playerState.skillUsed,
    isAwakened: playerState.isAwakened,
    peekedRoles: peekedMap[playerState.roleId]?.length ? peekedMap[playerState.roleId] : undefined,
    ...(isLiTianwang && state.zhaoyaoResult ? { zhaoyaoResult: state.zhaoyaoResult.hasDemon } : {}),
    ...(isAssassinOrDapeng && state.dapengExcludedPlayerId ? { dapengExcludedPlayerId: state.dapengExcludedPlayerId } : {}),
    ...(guanyinNotice ? { guanyinGanluResult: guanyinNotice } : {}),
    ...(dianhuaNoticeText ? { putiDianhuaNotice: dianhuaNoticeText } : {}),
    ...(playerState.roleId === 'tieshan_gongzhu' && state.tieshanSecret ? { tieshanSecret: state.tieshanSecret } : {}),
    ...(huangmeiNotice ? { huangmeiNotice } : {}),
    ...(baiguLijianStatus ? { baiguLijianStatus } : {}),
    ...(baiyanDuchaStatus ? { baiyanDuchaStatus } : {}),
  };
}
