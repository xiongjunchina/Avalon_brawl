import type {
  BrawlGameState,
  BrawlPlayerState,
  BrawlBattleEvent,
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
  };
}
