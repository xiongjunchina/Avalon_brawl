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
  neutralRole?: string,
): BrawlGameState {
  return {
    enabled: true,
    blindBox: {
      bluePoolRoles,
      redPoolRoles,
      neutralRole,
    },
    playerStates,
    events: [],
    imprisonedTargetId: undefined,
    taoshouActive: false,
    extraSeatLimit: 0,
  };
}

/**
 * 生成全场天机战报（公法不公人：严格不透露玩家座位和用户ID）
 */
export function appendBattleEvent(
  state: BrawlGameState,
  roleId: string,
  summary: string,
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
    timestamp: new Date().toISOString(),
  };
  state.events.push(event);
  return event;
}

/**
 * 黑熊精首轮出牌校验（只能且必须出成功）
 */
export function validateBrawlMissionVote(
  state: BrawlGameState,
  userId: string,
  mission: number,
  success: boolean,
): { valid: boolean; error?: string } {
  const player = state.playerStates[userId];
  if (!player) return { valid: true };

  // 黑熊精在首轮未抉择前只能出成功牌
  if (player.roleId === 'heixiong_jing' && mission === 1 && !success) {
    return {
      valid: false,
      error: 'HEIXIONG_MUST_VOTE_SUCCESS_IN_ROUND_1: 黑熊精在首轮天命抉择前只能投成功牌',
    };
  }

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
 * 黑熊精异步非阻塞私密抉择
 * 零全场广播、零队友通知，纯个人意愿绑定
 */
export function processNeutralChoice(
  state: BrawlGameState,
  userId: string,
  chosenCamp: 'blue' | 'red',
  currentRound: number = 2,
  autoAssigned: boolean = false,
): { success: boolean; error?: string } {
  const player = state.playerStates[userId];
  if (!player || player.roleId !== 'heixiong_jing') {
    return { success: false, error: 'NOT_NEUTRAL_PLAYER: 仅黑熊精可进行阵营抉择' };
  }

  if (state.neutralChoice) {
    return { success: false, error: 'ALREADY_CHOSEN: 黑熊精已完成天命抉择' };
  }

  // 更新阵营绑定
  player.camp = chosenCamp;
  state.neutralChoice = {
    chosenCamp,
    chosenAtRound: currentRound,
    autoAssigned,
  };

  return { success: true };
}

/**
 * Round 2 投票发起时的截止保护：若黑熊精未手动选定，系统 0.1 秒内自动摇骰保底
 */
export function ensureNeutralResolvedBeforeVote(
  state: BrawlGameState,
  rng: () => number = Math.random,
): void {
  if (state.neutralChoice) return;

  const neutralEntry = Object.entries(state.playerStates).find(
    ([_, p]) => p.roleId === 'heixiong_jing',
  );
  if (!neutralEntry) return;

  const [userId] = neutralEntry;
  const autoCamp: 'blue' | 'red' = rng() < 0.5 ? 'blue' : 'red';
  processNeutralChoice(state, userId, autoCamp, 2, true);
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
}

/**
 * 生成玩家个人的乱斗私密视图
 */
export function projectSelfBrawlView(
  state: BrawlGameState,
  userId: string,
  mission: number,
  peekedMap: Record<string, { roleId: string; roleName: string; camp: 'blue' | 'red' | 'neutral' }[]> = {},
): SelfBrawlView | undefined {
  const playerState = state.playerStates[userId];
  if (!playerState) return undefined;

  const roleDef = BRAWL_ROLE_REGISTRY[playerState.roleId];
  if (!roleDef) return undefined;

  const isHeixiong = playerState.roleId === 'heixiong_jing';
  const neutralDecisionPending = isHeixiong && mission >= 2 && !state.neutralChoice;

  return {
    roleId: playerState.roleId,
    roleName: roleDef.name,
    roleTitle: roleDef.title,
    camp: playerState.camp,
    skill: roleDef.skill,
    skillAvailable: !playerState.skillUsed,
    skillUsed: playerState.skillUsed,
    isAwakened: playerState.isAwakened,
    peekedRoles: peekedMap[playerState.roleId] || [],
    neutralDecisionPending,
  };
}
