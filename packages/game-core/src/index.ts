import { assignWeightedRoles, type RoleProtectionOptions } from './role-assignment.js';
export { roleWeight, ROLE_ASSIGNMENT_VERSION, ROLE_WEIGHT_VERSION } from './role-assignment.js';
export type { RoleProtectionOptions } from './role-assignment.js';
export { randomBigIntBelow } from './random.js';
import type { Command, GameResult, GameView, LoyalGuardian, FemaleDemon, Player, Role, RoundView, Settings, Team, PrivateInspection, EarlyWindow, TeamBallot, GuardianClue, SelfTreasures, HeartBellAdvice, RoleAssignmentAudit, BrawlGameState, BrawlPlayerState, BrawlCommandPayload, BrawlCamp } from '@avalon/contracts';
export { drawBrawlRoles, BRAWL_ROLE_REGISTRY } from './brawl-registry.js';
export type { BrawlRoleDef } from '@avalon/contracts';
import { drawBrawlRoles, BRAWL_ROLE_REGISTRY } from './brawl-registry.js';
import {
  createBrawlGameState,
  appendBattleEvent,
  validateBrawlMissionVote,
  projectSelfBrawlView,
  resetRoundBrawlEffects,
} from './brawl-engine.js';
export const RULESET_VERSION = 'standard-no-lancelot-v6';
export const GUANYIN_WINDOW_MS = 5_000;
export const LOYAL_GUARDIAN_POOL: readonly LoyalGuardian[] = ['bailong', 'zhubajie', 'shawujing', 'jingang'];
const LEGACY_LOYAL_GUARDIAN_POOL: readonly LoyalGuardian[] = ['zhubajie', 'shawujing', 'bailong', 'jingang'];
export function assignLoyalGuardians(gameId: string, players: Player[], roles: Record<string, Role>, rulesetVersion = RULESET_VERSION): Record<string, LoyalGuardian> {
  let seed = 2166136261;
  for (let i = 0; i < gameId.length; i++) {
    seed = Math.imul(seed ^ gameId.charCodeAt(i), 16777619) >>> 0;
  }
  const sortedLoyal = [...players].sort((a, b) => a.seat - b.seat).filter(p => roles[p.id] === 'loyal');
  // Select the priority roster before shuffling recipients. Preserve v1–v3 games and replays.
  const priorityEnabled = Number(rulesetVersion.match(/-v(\d+)$/)?.[1]) >= 4;
  const pool = priorityEnabled ? LOYAL_GUARDIAN_POOL.slice(0, sortedLoyal.length) : [...LEGACY_LOYAL_GUARDIAN_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Object.fromEntries(sortedLoyal.map((p, idx) => [p.id, pool[idx % pool.length]]));
}
export const FEMALE_DEMON_POOL: readonly FemaleDemon[] = ['spider', 'baigu', 'yutu', 'laoshu'];
export function assignFemaleDemons(gameId: string, players: Player[], roles: Record<string, Role>): Record<string, FemaleDemon> {
  let seed = 2166136261;
  for (let i = 0; i < gameId.length; i++) {
    seed = Math.imul(seed ^ gameId.charCodeAt(i), 16777619) >>> 0;
  }
  // Reverse gameId hash pass so seed differs from loyal guardians
  for (let i = gameId.length - 1; i >= 0; i--) {
    seed = Math.imul(seed ^ (gameId.charCodeAt(i) + 17), 16777619) >>> 0;
  }
  const pool = [...FEMALE_DEMON_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const sortedMinions = [...players].sort((a, b) => a.seat - b.seat).filter(p => roles[p.id] === 'minion');
  return Object.fromEntries(sortedMinions.map((p, idx) => [p.id, pool[idx % pool.length]]));
}
export const MISSION_SIZES: Record<number, number[]> = {
  5: [2,3,2,3,3], 6: [2,3,4,3,4], 7: [2,3,3,4,4],
  8: [3,4,4,5,5], 9: [3,4,4,5,5], 10: [3,4,4,5,5],
  11: [3,4,5,5,5], 12: [3,4,5,6,6],
};
export const BRAWL_MISSION_SIZES: Record<number, number[]> = {
  5: [2,3,2,3,3], 6: [2,3,4,3,4], 7: [2,3,3,4,4],
  8: [3,4,4,5,5], 9: [3,4,4,5,5], 10: [3,4,4,5,5],
  11: [3,4,5,5,6], 12: [3,4,5,6,6],
};
export const missionSizesFor = (playerCount: number, isBrawl = false): number[] =>
  (isBrawl ? BRAWL_MISSION_SIZES[playerCount] : MISSION_SIZES[playerCount]) ?? MISSION_SIZES[playerCount] ?? [2,3,2,3,3];

export const ROLE_CONFIG: Record<number, Role[]> = {
  5: ['merlin','percival','loyal','morgana','assassin'],
  6: ['merlin','percival','loyal','loyal','morgana','assassin'],
  7: ['merlin','percival','loyal','loyal','morgana','assassin','oberon'],
  8: ['merlin','percival','loyal','loyal','loyal','morgana','assassin','mordred'],
  9: ['merlin','percival','guinevere','loyal','loyal','loyal','morgana','assassin','mordred'],
  10: ['merlin','percival','guinevere','loyal','loyal','loyal','morgana','assassin','mordred','oberon'],
  11: ['merlin','percival','guinevere','loyal','loyal','loyal','morgana','assassin','mordred','minion','oberon'],
  12: ['merlin','percival','guinevere','loyal','loyal','loyal','loyal','morgana','assassin','mordred','minion','oberon'],
};
export const BRAWL_BASE_ROLE_CONFIG: Record<number, Role[]> = {
  5: ['merlin','percival','loyal','morgana','assassin'],
  6: ['merlin','percival','loyal','loyal','morgana','assassin'],
  7: ['merlin','percival','loyal','loyal','morgana','assassin','oberon'],
  8: ['merlin','percival','loyal','loyal','loyal','morgana','assassin','mordred'],
  9: ['merlin','percival','guinevere','loyal','loyal','morgana','assassin','mordred','oberon'],
  10: ['merlin','percival','guinevere','loyal','loyal','loyal','morgana','assassin','mordred','oberon'],
  11: ['merlin','percival','guinevere','loyal','loyal','loyal','morgana','assassin','mordred','minion','oberon'],
  12: ['merlin','percival','guinevere','loyal','loyal','loyal','loyal','morgana','assassin','mordred','minion','oberon'],
};
export const teamOf = (role: Role): Team => ['merlin','percival','guinevere','loyal'].includes(role) ? 'blue' : 'red';
/** New deals separate guardian clues from blue treasures; saved v1–v5 games retain their original rules. */
export function treasuresEnabledFor(
  settings: Pick<Settings, 'treasuresEnabled' | 'guardianPerksEnabled'>,
  playerCount: number,
  role: Role,
  rulesetVersion = RULESET_VERSION
): boolean {
  const balanceRule = Number(rulesetVersion.match(/-v(\d+)$/)?.[1]) >= 6;
  return Boolean(settings.treasuresEnabled && playerCount >= 8 &&
    !(balanceRule && settings.guardianPerksEnabled && teamOf(role) === 'blue'));
}
export class RuleError extends Error {}
function requireRule(condition: unknown, code: string): asserts condition { if (!condition) throw new RuleError(code); }
export interface GameState {
  id: string; rulesetVersion: string; settings: Settings; players: Player[]; roles: Record<string, Role>;
  roleAssignmentAudit?: RoleAssignmentAudit;
  dealEndsAt?: string;
  guanyinEndsAt?: string;
  phase: GameView['phase']; mission: number; rejectionCount: number; captainOrder: string[]; captainIndex: number;
  confirmed: string[]; teamVotes: Record<string, TeamBallot>; missionVotes: Record<string, boolean>; rounds: RoundView[];
  draftTeam?: { playerIds: string[]; direction: RoundView['direction'] };
  teamVoteStartedAt?: string;
  guinevereCandidates?: string[];
  guardianClues?: Record<string, GuardianClue>;
  earlyAssassination?: { used: boolean; windows: EarlyWindow[] };
  assassinationMode?: 'normal' | 'early';
  treasuresState?: {
    tinStaff?: { used: boolean; result?: { targetId: string; team: Team } };
    guanyinMirror?: { used: boolean; result?: { targetId: string; alignment: 'pure' | 'evil' } };
    humanBag?: { used: boolean; targetId?: string; activeBannedMission?: number };
    jinguSeal?: { used: boolean; activatedBy?: string };
    bananaFan?: { used: boolean; armed: boolean };
    heartBell?: { used: true; senderId: string; targetId: string; mission: number; roundNumber: number; advice: HeartBellAdvice };
  };
  bananaFanNotice?: string;
  result?: GameResult; abortPoll?: { requestedBy: string; electorate: string[]; approvals: string[] };
  brawl?: BrawlGameState;
  brawlRoles?: Record<string, string>;
  brawlPeekedMap?: Record<string, { roleId: string; roleName: string; camp: BrawlCamp }[]>;
}
/** Local practice carries the same recent-deal inputs across rematches, without storing real accounts. */
export function roleHistoryAfterDeal(game: Pick<GameState, 'roles' | 'roleAssignmentAudit'>): Record<string, Role[]> {
  return Object.fromEntries(Object.entries(game.roles).map(([id, role]) =>
    [id, [role, ...(game.roleAssignmentAudit?.players[id]?.recentRoles ?? [])].slice(0, 5)]));
}

export function createGame(
  id: string,
  players: Player[],
  settings: Settings,
  shuffle: <T>(values: T[]) => T[],
  protection: string[] | RoleProtectionOptions = []
): GameState {
  requireRule(players.length === settings.playerCount && ROLE_CONFIG[players.length], 'NOT_READY');
  const sorted = [...players].sort((a,b) => a.seat-b.seat);
  const configRoles = settings.brawlModeEnabled
    ? [...BRAWL_BASE_ROLE_CONFIG[players.length]]
    : [...ROLE_CONFIG[players.length]];
  const protectionOpts: RoleProtectionOptions = Array.isArray(protection)
    ? { visionGuaranteedUserIds: protection }
    : protection;

  const { roles, audit } = assignWeightedRoles(sorted, configRoles, shuffle([...configRoles]), {
    ...protectionOpts,
    rolePreferences: settings.rolePreferenceEnabled ? protectionOpts.rolePreferences : undefined,
  });

  let brawlState: BrawlGameState | undefined;
  let brawlRoles: Record<string, string> | undefined;
  let brawlPeekedMap: Record<string, { roleId: string; roleName: string; camp: BrawlCamp }[]> | undefined;

  if (settings.brawlModeEnabled) {
    const rawPreferences = protectionOpts.rolePreferences;
    const assignment = drawBrawlRoles(sorted.length, undefined, Math.random, rawPreferences);
    brawlRoles = {};
    const playerStates: Record<string, BrawlPlayerState> = {};

    const bluePool = shuffle(assignment.roles.filter(r => r.camp === 'blue' && !r.isCore));
    const redPool = shuffle(assignment.roles.filter(r => r.camp === 'red' && !r.isCore));

    // 辅助函数：根据玩家心仪偏好优先匹配出战角色
    const popPreferred = (pool: typeof bluePool, prefs?: string[]) => {
      if (prefs && prefs.length > 0) {
        for (const prefId of prefs) {
          const idx = pool.findIndex(r => r.id === prefId);
          if (idx !== -1) {
            return pool.splice(idx, 1)[0];
          }
        }
      }
      return pool.pop();
    };

    for (const p of sorted) {
      const r = roles[p.id];
      const playerPrefs = rawPreferences?.[p.id];
      let br: typeof assignment.roles[number] | undefined;
      if (r === 'merlin') {
        br = assignment.roles.find(x => x.id === 'sun_wukong');
      } else if (r === 'percival') {
        br = assignment.roles.find(x => x.id === 'tang_seng');
      } else if (r === 'morgana') {
        br = assignment.roles.find(x => x.id === 'liuer_mihou');
      } else if (r === 'assassin') {
        br = assignment.roles.find(x => x.id === 'hong_haier');
      } else if (teamOf(r) === 'blue') {
        br = popPreferred(bluePool, playerPrefs);
      } else {
        br = popPreferred(redPool, playerPrefs);
      }

      if (!br) {
        br = teamOf(r) === 'blue'
          ? (bluePool.pop() || BRAWL_ROLE_REGISTRY.sun_wukong)
          : (redPool.pop() || BRAWL_ROLE_REGISTRY.hong_haier);
      }

      brawlRoles[p.id] = br.id;
      playerStates[p.id] = {
        userId: p.id,
        seat: p.seat,
        roleId: br.id,
        camp: br.camp,
        skillUsed: false,
      };
    }

    brawlState = createBrawlGameState(
      playerStates,
      assignment.blindBox.bluePoolRoles,
      assignment.blindBox.redPoolRoles,
    );
    brawlPeekedMap = assignment.peekedMap;
  }

  let guinevereCandidates: string[] | undefined;
  if (Object.values(roles).includes('guinevere')) {
    const mordredId = sorted.find(p => roles[p.id] === 'mordred')?.id;
    const blueDecoys = sorted.filter(p => ['percival', 'loyal'].includes(roles[p.id])).map(p => p.id);
    const decoyId = shuffle(blueDecoys)[0];
    guinevereCandidates = sorted
      .filter(p => p.id === mordredId || p.id === decoyId)
      .map(p => p.id);
  }
  let guardianClues: Record<string, GuardianClue> | undefined;
  if (settings.guardianPerksEnabled) {
    guardianClues = {};
    const loyalGuardians = assignLoyalGuardians(id, sorted, roles);
    const loyalPlayers = sorted.filter(p => roles[p.id] === 'loyal');
    for (const p of loyalPlayers) {
      const gKind = loyalGuardians[p.id];
      if (gKind === 'zhubajie') {
        const nonMorganas = sorted.filter(q => q.id !== p.id && roles[q.id] !== 'morgana');
        const target = shuffle(nonMorganas)[0];
        guardianClues[p.id] = {
          kind: 'zhubajie',
          title: '【八戒巡山】天机灵觉',
          description: '你巡山探路获知：此仙友绝非混世魔猴六耳猕猴（假猴王）。',
          targetIds: target ? [target.id] : [],
        };
      } else if (gKind === 'shawujing') {
        const otherLoyals = sorted.filter(q => q.id !== p.id && roles[q.id] === 'loyal');
        const target = shuffle(otherLoyals)[0];
        guardianClues[p.id] = {
          kind: 'shawujing',
          title: '【同修感应】天机灵觉',
          description: target ? '你感应到同门佛光：此仙友亦是取经护法同修，可互为倚仗。' : '你感应天地流沙：其余护法皆在天庭未下凡，此局取经唯君独守。',
          targetIds: target ? [target.id] : [],
        };
      } else if (gKind === 'bailong') {
        const percivalPlayer = sorted.find(q => roles[q.id] === 'percival');
        const redPool = sorted.filter(q => teamOf(roles[q.id]) === 'red');
        const redDecoy = shuffle(redPool)[0];
        const targetIds = percivalPlayer && redDecoy
          ? sorted.filter(q => q.id === percivalPlayer.id || q.id === redDecoy.id).map(q => q.id)
          : [];
        guardianClues[p.id] = {
          kind: 'bailong',
          title: '【龙驹护圣】天机灵觉',
          description: '你隐闻圣僧佛光：两位仙友之中，必有一位是大唐圣僧（唐三藏）。',
          targetIds,
        };
      } else if (gKind === 'jingang') {
        const redPool = sorted.filter(q => teamOf(roles[q.id]) === 'red');
        const bluePool = sorted.filter(q => teamOf(roles[q.id]) === 'blue' && roles[q.id] !== 'merlin' && q.id !== p.id);
        const chosenRed = shuffle(redPool)[0];
        const chosenBlue = shuffle(bluePool)[0];
        const targetIds = chosenRed && chosenBlue
          ? sorted.filter(q => q.id === chosenRed.id || q.id === chosenBlue.id).map(q => q.id)
          : [];
        guardianClues[p.id] = {
          kind: 'jingang',
          title: '【金刚怒目】天机灵觉',
          description: '你目运金光察得：两位仙友之中，至少潜藏一位混世妖魔。',
          targetIds,
        };
      }
    }
  }
  const seats = sorted.map(p => p.id);
  const captainOrder = settings.captainMode === 'random_order' ? shuffle(seats) : seats;
  return { id, rulesetVersion: RULESET_VERSION, settings: { ...settings }, players: sorted,
    roles, ...(audit ? { roleAssignmentAudit: audit } : {}), phase: 'role_reveal', mission: 1,
    rejectionCount: 0, captainOrder,
    ...(guinevereCandidates ? { guinevereCandidates } : {}),
    ...(guardianClues ? { guardianClues } : {}),
    ...(settings.earlyAssassinationEnabled ? { earlyAssassination: { used: false, windows: [] } } : {}),
    ...(settings.treasuresEnabled && sorted.length >= 8 ? { treasuresState: {} } : {}),
    ...(brawlState ? { brawl: brawlState } : {}),
    ...(brawlRoles ? { brawlRoles } : {}),
    ...(brawlPeekedMap ? { brawlPeekedMap } : {}),
    captainIndex: 0, confirmed: [], teamVotes: {}, missionVotes: {}, rounds: [] };
}
export const isEnded = (g: GameState) => g.phase === 'finished' || g.phase === 'aborted';
export const captain = (g: GameState) => g.captainOrder[g.captainIndex];
export const failuresRequiredFor = (playerCount: number, mission: number, isBrawl = false): number => {
  if (isBrawl) {
    // 大乱斗模式数值平衡：
    // 11、12人局（6蓝5红 / 7蓝5红）：第3难、第4难、第5难均需2败
    if ((playerCount === 11 || playerCount === 12) && mission >= 3) return 2;
    // 9人局（5蓝4红）：第4难、第5难均需2败
    if (playerCount === 9 && mission >= 4) return 2;
    // 7、8、10人局：第4难需2败
    if (playerCount >= 7 && mission === 4) return 2;
    return 1;
  }
  return (playerCount >= 7 && mission === 4) || ((playerCount === 11 || playerCount === 12) && mission === 3) ? 2 : 1;
};
export const failuresRequired = (g: GameState) => {
  return failuresRequiredFor(g.players.length, g.mission, Boolean(g.brawl));
};
function heartBellTargets(g: GameState, userId: string): string[] {
  const round = g.rounds.at(-1);
  if (!treasuresEnabledFor(g.settings, g.players.length, g.roles[userId], g.rulesetVersion) || g.roles[userId] !== 'minion' ||
      g.treasuresState?.heartBell?.used || g.phase !== 'mission' || g.result || failuresRequired(g) !== 1 ||
      !round?.team.includes(userId) || userId in g.missionVotes) return [];
  return round.team.filter(id => id !== userId && g.roles[id] && teamOf(g.roles[id]) === 'red' &&
    g.roles[id] !== 'oberon' && !(id in g.missionVotes));
}
export function finish(g: GameState, result: GameResult) {
  g.result = result; g.phase = result.winner ? 'finished' : 'aborted';
  // Individual mission cards are ephemeral private state, never part of the replay.
  g.teamVotes = {}; g.missionVotes = {}; delete g.abortPoll;
}
function rotate(g: GameState) { g.captainIndex = (g.captainIndex+1)%g.players.length; }
function canUseEarlyAssassination(g: GameState): boolean {
  const completed = g.rounds.filter(r => r.result).length;
  return Boolean(
    g.earlyAssassination &&
    !g.earlyAssassination.used &&
    completed >= 2 &&
    !isEnded(g) &&
    !['dealing', 'role_reveal', 'assassination'].includes(g.phase)
  );
}
function triggerDapengExclude(g: GameState) {
  if (!g.brawl || g.brawl.dapengExcludedPlayerId) return;
  const candidateBluePlayers = g.players.filter(p => {
    const pState = g.brawl?.playerStates[p.id];
    return pState?.camp === 'blue' && pState?.roleId !== 'sun_wukong';
  });
  if (candidateBluePlayers.length > 0) {
    const excluded = candidateBluePlayers[Math.floor(Math.random() * candidateBluePlayers.length)];
    g.brawl.dapengExcludedPlayerId = excluded.id;
  }
}
function openEarlyWindowOrPropose(g: GameState) {
  g.phase = 'proposing';
}
// Room ownership, not presence or unanimous voting, controls interruption.
export function transition(state: GameState, userId: string, action: Pick<Command, 'type' | 'payload'>, onlineIds: string[], context = { hostId: state.players[0].id, now: Date.now() }): GameState {
  const g = structuredClone(state);
  requireRule(g.players.some(p => p.id === userId), 'FORBIDDEN');
  requireRule(!isEnded(g), 'GAME_ENDED');
  if (action.type === 'endGame' || action.type === 'requestAbort' || action.type === 'voteAbort') {
    if (action.type === 'endGame' || (action.type === 'requestAbort' && userId === context.hostId)) {
      requireRule(userId === context.hostId, 'FORBIDDEN');
      finish(g, { winner: null, reason: 'host_ended' });
    } else if (action.type === 'requestAbort') {
      requireRule(onlineIds.includes(userId), 'FORBIDDEN');
      requireRule(!g.abortPoll, 'ABORT_PENDING');
      g.abortPoll = { requestedBy: userId, electorate: [context.hostId], approvals: [] };
    } else {
      requireRule(userId === context.hostId, 'FORBIDDEN');
      requireRule(g.abortPoll, 'NO_ABORT_POLL');
      if ((action.payload as { approve: boolean }).approve) finish(g, { winner: null, reason: 'host_ended' });
      else delete g.abortPoll;
    }
    return g;
  }
  requireRule(g.phase !== 'dealing', 'DEAL_PENDING');
  switch (action.type) {
    case 'confirmRole':
      requireRule(g.phase === 'role_reveal', 'WRONG_PHASE');
      requireRule(!g.confirmed.includes(userId), 'ALREADY_SUBMITTED');
      g.confirmed.push(userId);
      if (g.confirmed.length === g.players.length) g.phase = 'proposing';
      break;
    case 'updateTeamDraft': {
      requireRule(['role_reveal','proposing','discussion'].includes(g.phase), 'WRONG_PHASE');
      requireRule(userId === captain(g), 'NOT_CAPTAIN');
      const { playerIds, direction } = action.payload as { playerIds: string[]; direction: RoundView['direction'] };
      const maxTeamSize = missionSizesFor(g.players.length, Boolean(g.brawl))[g.mission-1] + (g.brawl?.extraSeatLimit ?? 0);
      requireRule(playerIds.length <= maxTeamSize && new Set(playerIds).size === playerIds.length && playerIds.every(id => g.players.some(p => p.id === id)), 'INVALID_TEAM');
      if (g.treasuresState?.humanBag?.activeBannedMission === g.mission && g.treasuresState.humanBag.targetId) {
        requireRule(!playerIds.includes(g.treasuresState.humanBag.targetId), 'PLAYER_BANNED_BY_HUMAN_BAG');
      }
      if (g.brawl?.imprisonedTargetId) {
        requireRule(!playerIds.includes(g.brawl.imprisonedTargetId), 'PLAYER_IMPRISONED_BY_WUXINGSHAN');
      }
      if (g.brawl?.zhizhuBannedTargetId) {
        requireRule(!playerIds.includes(g.brawl.zhizhuBannedTargetId), 'PLAYER_BANNED_BY_ZHIZHU_JING');
      }
      g.draftTeam = { playerIds: [...playerIds], direction };
      if (g.phase === 'discussion') {
        g.rounds.at(-1)!.team = [...playerIds];
        g.rounds.at(-1)!.direction = direction;
      }
      break;
    }
    case 'proposeTeam': {
      requireRule(g.phase === 'proposing' || g.phase === 'role_reveal', 'WRONG_PHASE');
      requireRule(userId === captain(g), 'NOT_CAPTAIN');
      const { playerIds, direction } = action.payload as { playerIds: string[]; direction: RoundView['direction'] };
      const maxTeamSize = missionSizesFor(g.players.length, Boolean(g.brawl))[g.mission-1] + (g.brawl?.extraSeatLimit ?? 0);
      requireRule(playerIds.length <= maxTeamSize && new Set(playerIds).size === playerIds.length && playerIds.every(id => g.players.some(p => p.id === id)), 'INVALID_TEAM');
      if (g.treasuresState?.humanBag?.activeBannedMission === g.mission && g.treasuresState.humanBag.targetId) {
        requireRule(!playerIds.includes(g.treasuresState.humanBag.targetId), 'PLAYER_BANNED_BY_HUMAN_BAG');
      }
      if (g.brawl?.imprisonedTargetId) {
        requireRule(!playerIds.includes(g.brawl.imprisonedTargetId), 'PLAYER_IMPRISONED_BY_WUXINGSHAN');
      }
      if (g.brawl?.zhizhuBannedTargetId) {
        requireRule(!playerIds.includes(g.brawl.zhizhuBannedTargetId), 'PLAYER_BANNED_BY_ZHIZHU_JING');
      }
      g.rounds.push({ number: g.rounds.length+1, mission: g.mission, captainId: userId,
        team: g.players.filter(p => playerIds.includes(p.id)).map(p => p.id), direction });
      delete g.draftTeam;
      g.phase = 'discussion'; g.teamVotes = {}; g.missionVotes = {};
      break;
    }
    case 'startTeamVote': {
      requireRule(g.phase === 'discussion', 'WRONG_PHASE');
      requireRule(userId === captain(g), 'NOT_CAPTAIN');
      const baseTeamSize = missionSizesFor(g.players.length, Boolean(g.brawl))[g.mission-1];
      const maxTeamSize = baseTeamSize + (g.brawl?.extraSeatLimit ?? 0);
      const teamLen = g.rounds.at(-1)!.team.length;
      requireRule(teamLen >= baseTeamSize && teamLen <= maxTeamSize, 'INVALID_TEAM');
      delete g.draftTeam;
      g.teamVoteStartedAt = new Date(context.now).toISOString();
      g.phase = 'team_vote';
      if (g.brawl?.imprisonedTargetId) {
        g.teamVotes[g.brawl.imprisonedTargetId] = 'abstain';
      }
      if (g.brawl?.yishanTargetId) {
        g.teamVotes[g.brawl.yishanTargetId] = 'abstain';
      }
      break;
    }
    case 'teamVote': {
      requireRule(g.phase === 'team_vote', 'WRONG_PHASE');
      if (g.brawl?.imprisonedTargetId === userId) {
        throw new RuleError('PLAYER_IMPRISONED_BY_WUXINGSHAN');
      }
      if (g.brawl?.yishanTargetId === userId) {
        throw new RuleError('BALLOT_SUPPRESSED_BY_YISHAN');
      }
      requireRule(!(userId in g.teamVotes), 'ALREADY_SUBMITTED');
      g.teamVotes[userId] = (action.payload as { approve: TeamBallot }).approve;
      if (Object.keys(g.teamVotes).length === g.players.length) {
        let approvals = 0;
        let rejections = 0;
        let abstentions = 0;
        for (const [pId, ballot] of Object.entries(g.teamVotes)) {
          const weight = g.brawl?.doubleVoteUserId === pId ? 2 : 1;
          if (ballot === true) approvals += weight;
          else if (ballot === false) rejections += weight;
          else if (ballot === 'abstain') abstentions += weight;
        }
        let passed = approvals > rejections;

        // 沙悟净【降妖宝杖】：任意一轮组队表决未通过流局时，沙僧祭起降妖宝杖定风波，50% 概率将流局强行镇压反转为发车通过！
        if (!passed && g.brawl?.shawujingBaozhangArmed) {
          g.brawl.shawujingBaozhangArmed = false;
          if (Math.random() < 0.5) {
            passed = true;
            appendBattleEvent(
              g.brawl,
              'sha_wujing',
              `【沙悟净】降妖宝杖定海神威！队伍表决本已流局，沙僧祭起降妖宝杖定风波，神威显圣强行判定队伍通过发车！`,
              '任意一轮组队表决未通过流局时，沙僧祭起降妖宝杖定风波，50% 概率将流局强行镇压反转为发车通过！',
            );
          } else {
            appendBattleEvent(
              g.brawl,
              'sha_wujing',
              `【沙悟净】降妖宝杖定海，风波势大未能平息，仍旧流局。`,
              '任意一轮组队表决未通过流局时，沙僧祭起降妖宝杖定风波，50% 概率将流局强行镇压反转为发车通过！',
            );
          }
        }

        // 猪八戒【倒打一耙】：组队表决未通过时倒打一耙，强制将全场最后 1 张反对票反转为赞成票！
        if (!passed && rejections > 0 && g.brawl?.zhubajieDaodaArmed) {
          g.brawl.zhubajieDaodaArmed = false;
          rejections -= 1;
          approvals += 1;
          if (approvals > rejections) {
            passed = true;
            appendBattleEvent(
              g.brawl,
              'zhu_bajie',
              `【猪八戒】倒打一耙逆风翻盘！强行将 1 张反对票反转为赞成票（反转后赞成 ${approvals} / 反对 ${rejections}），队伍惊险发车！`,
              '组队表决未通过时倒打一耙，强制将全场最后 1 张反对票反转为赞成票！',
            );
          } else {
            appendBattleEvent(
              g.brawl,
              'zhu_bajie',
              `【猪八戒】倒打一耙发力！反转 1 张反对票为赞成票（赞成 ${approvals} / 反对 ${rejections}），仍未能扭转局势。`,
              '组队表决未通过时倒打一耙，强制将全场最后 1 张反对票反转为赞成票！',
            );
          }
        }

        g.rounds.at(-1)!.vote = { approvals, rejections, abstentions, passed,
          ...(!g.settings.anonymousTeamVote ? { ballots: { ...g.teamVotes } } : {}) };
        g.teamVotes = {};
        if (g.brawl) {
          g.brawl.doubleVoteUserId = undefined;
          g.brawl.yishanTargetId = undefined;
        }
        if (passed) {
          if (g.treasuresState?.bananaFan?.armed) {
            g.treasuresState.bananaFan.used = true;
            g.treasuresState.bananaFan.armed = false;
            g.bananaFanNotice = `第 ${g.rounds.at(-1)!.number} 轮组队投票通过，但牛魔王祭起【芭蕉神扇】狂风呼啸！本次发车被强行吹散，由下一任队长重新组队！`;
            rotate(g);
            openEarlyWindowOrPropose(g);
          } else {
            delete g.bananaFanNotice;
            const hasUnusedGuanyin = Boolean(
              treasuresEnabledFor(g.settings, g.players.length, 'guinevere', g.rulesetVersion) &&
              g.players.length >= 9 &&
              g.players.some(p => g.roles[p.id] === 'guinevere') &&
              !g.treasuresState?.guanyinMirror?.used
            );
            if (hasUnusedGuanyin) {
              g.phase = 'guanyin_window';
              g.guanyinEndsAt = new Date(context.now + GUANYIN_WINDOW_MS).toISOString();
            } else {
              g.phase = 'mission';
            }
          }
        } else {
          delete g.bananaFanNotice;
          g.rejectionCount++;
          if (g.rejectionCount >= 5) finish(g, { winner: 'red', reason: 'five_rejections' });
          else { rotate(g); openEarlyWindowOrPropose(g); }
        }
      }
      break;
    }
    case 'missionVote': {
      requireRule(g.phase === 'mission', 'WRONG_PHASE');
      const round = g.rounds.at(-1)!;
      requireRule(round.team.includes(userId), 'NOT_ON_TEAM');
      requireRule(!(userId in g.missionVotes), 'ALREADY_SUBMITTED');
      const { success } = action.payload as { success: boolean };
      requireRule(success || teamOf(g.roles[userId]) === 'red', 'BLUE_MUST_SUCCEED');
      if (g.brawl) {
        const check = validateBrawlMissionVote(g.brawl, userId, g.mission, success);
        requireRule(check.valid, check.error || 'INVALID_BRAWL_VOTE');
      }
      g.missionVotes[userId] = success;
      if (Object.keys(g.missionVotes).length === round.team.length) {
        let failures = Object.values(g.missionVotes).filter(v => !v).length;
        let successes = round.team.length - failures;

        // 金角大王【紫金葫芦】：若选定队员投了成功，50% 概率被宝葫芦化解吸收为失败
        if (g.brawl?.jinjiaoHuluTargetId && round.team.includes(g.brawl.jinjiaoHuluTargetId)) {
          const targetVotedSuccess = g.missionVotes[g.brawl.jinjiaoHuluTargetId];
          if (targetVotedSuccess && Math.random() < 0.5) {
            failures += 1;
            successes = Math.max(0, successes - 1);
            appendBattleEvent(
              g.brawl,
              'jinjiao_dawang',
              `【金角大王】紫金红葫芦灵光大盛！出征队伍中 1 名仙友的浩然正气被宝葫芦暗中化解吸收！`,
              '手机私密选定出征队员 1 人，若其投成功，50% 概率被葫芦化解吸收。',
            );
          }
          g.brawl.jinjiaoHuluTargetId = undefined;
        }

        // 玉兔精【捣药迷魂】：若选定队员投了成功，33% 概率成功牌被封印弃权
        if (g.brawl?.yutuMihunTargetId && round.team.includes(g.brawl.yutuMihunTargetId)) {
          const targetVotedSuccess = g.missionVotes[g.brawl.yutuMihunTargetId];
          if (targetVotedSuccess && Math.random() < 0.33) {
            failures += 1;
            successes = Math.max(0, successes - 1);
            appendBattleEvent(
              g.brawl,
              'yutu_jing',
              `【玉兔精】广寒仙药捣药迷魂！出征队伍中受迷香干扰，1 名仙友的成功神力被封印化解！`,
              '队伍敲定后暗中迷魂车上 1 名好人，其出征时 33% 概率成功牌被封印弃权。',
            );
          }
          g.brawl.yutuMihunTargetId = undefined;
        }

        // 百眼魔君【黄花毒茶】：若选定队员投了成功，大车(>=4人)50%/小车(<=3人)33%概率被毒化反转为失败牌！
        if (g.brawl?.baiyanDuchaTargetId && round.team.includes(g.brawl.baiyanDuchaTargetId)) {
          const targetVotedSuccess = g.missionVotes[g.brawl.baiyanDuchaTargetId];
          if (targetVotedSuccess) {
            const chance = round.team.length >= 4 ? 0.5 : 1 / 3;
            if (Math.random() < chance) {
              failures += 1;
              successes = Math.max(0, successes - 1);
              g.brawl.baiyanDuchaResult = true;
            } else {
              g.brawl.baiyanDuchaResult = false;
            }
          }
          g.brawl.baiyanDuchaTargetId = undefined;
        }

        // 白骨精【画皮离间】：本轮任务出征若失败，静默虚增 1 张失败牌引车内好人自相残杀！
        if (g.brawl?.baiguLijianArmed && failures > 0) {
          g.brawl.baiguLijianArmed = false;
          failures += 1;
          successes = Math.max(0, successes - 1);
          g.brawl.baiguLijianResult = true;
          // 静默生效，绝不生成公屏战报，彻底避免自爆！
        }

        // 王母娘娘【九转仙桃】：出征前赐仙桃护体，本轮任务若出现失败牌，50% 概率当场化解赦免 1 张失败牌！
        if (g.brawl?.taoshouActive && failures > 0) {
          g.brawl.taoshouActive = false;
          if (Math.random() < 0.5) {
            failures = Math.max(0, failures - 1);
            successes = round.team.length - failures;
            appendBattleEvent(
              g.brawl,
              'wangmu_niangniang',
              `【王母娘娘】瑶池九转仙桃神力显圣！仙桃延寿护体，当场化解吸收了队伍中的 1 张失败牌！`,
              '出征前赐九转仙桃护体：本轮任务若出现失败牌，仙桃有 50% 概率当场化解赦免 1 张失败牌！',
            );
          } else {
            appendBattleEvent(
              g.brawl,
              'wangmu_niangniang',
              `【王母娘娘】九转仙桃护体，劫数深重未能抵消失败牌。`,
              '出征前赐九转仙桃护体：本轮任务若出现失败牌，仙桃有 50% 概率当场化解赦免 1 张失败牌！',
            );
          }
        }

        let passed = failures < failuresRequired(g);

        // 玉皇大帝【天尊玉旨】：任务失败时降旨赦免（1败 60% 概率逆转，2败 30% 概率逆转）
        if (!passed && failures > 0 && g.brawl?.yuhuangYuzhiArmed) {
          g.brawl.yuhuangYuzhiArmed = false;
          const pardonChance = failures === 1 ? 0.6 : (failures === 2 ? 0.3 : 0);
          if (pardonChance > 0 && Math.random() < pardonChance) {
            passed = true;
            failures = 0;
            successes = round.team.length;
            appendBattleEvent(
              g.brawl,
              'yuhuang_dadi',
              `【玉皇大帝】昊天金阙降下天尊玉旨！三界至尊金口御言赦免此难劫数，任务绝境逆转为大获全胜！`,
              '任一轮任务失败时降旨赦免（若为 1 败则 60% 概率逆转为胜，若为 2 败则 30% 概率逆转为胜）！',
            );
          } else {
            appendBattleEvent(
              g.brawl,
              'yuhuang_dadi',
              `【玉皇大帝】天尊降旨，群魔势大劫数难消，未能化解此次失败。`,
              '任一轮任务失败时降旨赦免（若为 1 败则 60% 概率逆转为胜，若为 2 败则 30% 概率逆转为胜）！',
            );
          }
        }

        // 观音菩萨【净瓶甘露】：若洒甘露者出征且任务失败，100% 私密获知该人是否投了成功
        if (g.brawl?.guanyinGanluTargetId && round.team.includes(g.brawl.guanyinGanluTargetId)) {
          const targetVote = g.missionVotes[g.brawl.guanyinGanluTargetId];
          if (failures > 0) {
            g.brawl.guanyinGanluResult = {
              targetId: g.brawl.guanyinGanluTargetId,
              targetSuccess: Boolean(targetVote),
            };
          }
        }

        round.result = { successes, failures, passed };
        g.missionVotes = {};
        const completed = g.rounds.filter(r => r.result), passedMissions = completed.filter(r => r.result!.passed).length;
        if (completed.length-passedMissions >= 3) finish(g, { winner: 'red', reason: 'three_failures' });
        else if (passedMissions >= 3) {
          g.phase = 'assassination';
          g.assassinationMode = 'normal';
          if (g.brawl?.dapengArmed) triggerDapengExclude(g);
        }
        else {
          g.mission++; rotate(g);
          if (g.brawl) resetRoundBrawlEffects(g.brawl);
          openEarlyWindowOrPropose(g);
          if (g.settings.rejectionScope === 'mission') g.rejectionCount = 0;
        }
      }
      break;
    }
    case 'earlyAssassinationDecision': {
      requireRule(canUseEarlyAssassination(g) && g.earlyAssassination, 'WRONG_PHASE');
      requireRule(g.roles[userId] === 'assassin', 'NOT_ASSASSIN');
      const { attempt } = action.payload as { attempt: boolean };
      g.earlyAssassination.windows.push({ afterMission: g.rounds.filter(r => r.result).length,
        afterProposal: g.rounds.length, decision: attempt ? 'attempt' : 'skip' });
      if (attempt) {
        g.earlyAssassination.used = true;
        g.assassinationMode = 'early';
        g.teamVotes = {};
        g.missionVotes = {};
        g.phase = 'assassination';
        if (g.brawl?.dapengArmed) triggerDapengExclude(g);
      } else if (g.phase === 'early_window') {
        g.phase = 'proposing';
      }
      break;
    }
    case 'assassinate': {
      requireRule(g.phase === 'assassination', 'WRONG_PHASE');
      requireRule(g.roles[userId] === 'assassin', 'NOT_ASSASSIN');
      const { targetId } = action.payload as { targetId: string };
      requireRule(g.players.some(p => p.id === targetId) && targetId !== userId, 'INVALID_TARGET');
      const hit = g.roles[targetId] === 'merlin';
      const reason = g.assassinationMode === 'early'
        ? hit ? 'early_merlin_found' : 'early_merlin_survived'
        : hit ? 'merlin_found' : 'merlin_survived';
      finish(g, { winner: hit ? 'red' : 'blue', reason, targetId });
      break;
    }
    case 'useTreasure': {
      requireRule(g.settings.treasuresEnabled && g.players.length >= 8, 'TREASURES_DISABLED');
      requireRule(treasuresEnabledFor(g.settings, g.players.length, g.roles[userId], g.rulesetVersion), 'BLUE_TREASURES_DISABLED');
      if (!g.treasuresState) g.treasuresState = {};
      const payload = action.payload as Extract<Command, { type: 'useTreasure' }>['payload'];
      switch (payload.action) {
        case 'heartBell': {
          requireRule(g.roles[userId] === 'minion', 'NOT_MINION');
          requireRule(!g.treasuresState.heartBell?.used, 'ALREADY_USED');
          requireRule(g.phase === 'mission', 'WRONG_PHASE');
          requireRule(failuresRequired(g) === 1, 'HEART_BELL_TWO_FAILURES');
          requireRule(payload.advice === 'protect' || payload.advice === 'sabotage', 'INVALID_INPUT');
          requireRule(heartBellTargets(g, userId).includes(payload.targetId), 'HEART_BELL_UNAVAILABLE');
          g.treasuresState.heartBell = { used: true, senderId: userId, targetId: payload.targetId,
            mission: g.mission, roundNumber: g.rounds.at(-1)!.number, advice: payload.advice };
          break;
        }
        case 'tinStaff': {
          requireRule(g.roles[userId] === 'percival', 'NOT_PERCIVAL');
          requireRule(!g.treasuresState.tinStaff?.used, 'ALREADY_USED');
          const completedMissions = g.rounds.filter(r => r.result).length;
          requireRule(completedMissions >= 2, 'CANNOT_USE_YET');
          const { targetId } = payload;
          requireRule(targetId && g.players.some(p => p.id === targetId), 'INVALID_TARGET');
          requireRule(targetId !== userId, 'CANNOT_INSPECT_SELF');
          const candidateIds = g.players.filter(p => ['merlin', 'morgana'].includes(g.roles[p.id])).map(p => p.id);
          requireRule(!candidateIds.includes(targetId), 'CANNOT_INSPECT_CANDIDATE');
          const targetRole = g.roles[targetId];
          const inspectedTeam = targetRole === 'mordred' ? 'blue' : teamOf(targetRole);
          g.treasuresState.tinStaff = { used: true, result: { targetId, team: inspectedTeam } };
          break;
        }
        case 'guanyinMirror': {
          requireRule(g.roles[userId] === 'guinevere', 'NOT_GUINEVERE');
          requireRule(!g.treasuresState.guanyinMirror?.used, 'ALREADY_USED');
          requireRule(g.phase === 'guanyin_window', 'WRONG_PHASE');
          const round = g.rounds.at(-1);
          requireRule(round, 'WRONG_PHASE');
          const guanyinPayload = payload as { action: 'guanyinMirror'; targetId?: string; skip?: boolean };
          if (guanyinPayload.skip) {
            g.phase = 'mission';
            delete g.guanyinEndsAt;
            break;
          }
          const { targetId } = guanyinPayload;
          requireRule(targetId && round.team.includes(targetId), 'TARGET_NOT_ON_TEAM');
          requireRule(targetId !== userId, 'CANNOT_INSPECT_SELF');
          const targetRole = g.roles[targetId];
          const alignment = teamOf(targetRole) === 'red' ? 'evil' : 'pure';
          g.treasuresState.guanyinMirror = { used: true, result: { targetId, alignment } };
          g.phase = 'mission';
          delete g.guanyinEndsAt;
          break;
        }
        case 'humanBag': {
          requireRule(g.roles[userId] === 'mordred', 'NOT_MORDRED');
          requireRule(!g.treasuresState.humanBag?.used, 'ALREADY_USED');
          requireRule(g.mission >= 3, 'CANNOT_USE_YET');
          requireRule(g.phase === 'proposing', 'WRONG_PHASE');
          const { targetId } = payload;
          requireRule(targetId && g.players.some(p => p.id === targetId), 'INVALID_TARGET');
          requireRule(targetId !== captain(g), 'CANNOT_BAN_CAPTAIN');
          g.treasuresState.humanBag = { used: true, targetId, activeBannedMission: g.mission };
          break;
        }
        case 'jinguSeal': {
          requireRule(g.roles[userId] === 'loyal', 'NOT_LOYAL');
          requireRule(!g.treasuresState.jinguSeal?.used, 'ALREADY_USED');
          const failedMissions = g.rounds.filter(r => r.result && !r.result.passed).length;
          requireRule(failedMissions >= 2, 'NOT_IN_PERIL');
          g.treasuresState.jinguSeal = { used: true, activatedBy: userId };
          break;
        }
        case 'bananaFan': {
          requireRule(g.roles[userId] === 'oberon', 'NOT_OBERON');
          requireRule(!g.treasuresState.bananaFan?.used, 'ALREADY_USED');
          if (!g.treasuresState.bananaFan) g.treasuresState.bananaFan = { used: false, armed: false };
          g.treasuresState.bananaFan.armed = Boolean(payload.armed);
          break;
        }
        default:
          throw new RuleError('INVALID_TREASURE_ACTION');
      }
      break;
    }
    case 'brawlCommand': {
      requireRule(g.brawl, 'BRAWL_NOT_ENABLED');
      const payload = action.payload as BrawlCommandPayload;
      if (payload.action === 'useSkill') {
        const playerState = g.brawl.playerStates[userId];
        requireRule(playerState, 'PLAYER_NOT_FOUND');
        requireRule(!playerState.skillUsed, 'SKILL_ALREADY_USED');
        const role = BRAWL_ROLE_REGISTRY[playerState.roleId];
        requireRule(role, 'ROLE_NOT_FOUND');

        // 太上老君金刚琢拦截红方主动法宝
        if (playerState.camp === 'red' && g.brawl.laojunZhuoActive) {
          g.brawl.laojunZhuoActive = false;
          playerState.skillUsed = true;
          const interceptSummary = `【太上老君】金刚琢凌空显圣，半空中一道金光当场将【${role.name}】祭出的【${role.skill.skillName}】套走收缴，妖法作废失效！`;
          appendBattleEvent(g.brawl, 'taishang_laojun', interceptSummary, '金刚琢套走妖魔绝技，收缴其法宝效果使其失效。');
          break;
        }

        playerState.skillUsed = true;

        let targetText = '';
        let targetPlayer: Player | undefined;
        if (payload.targetPlayerId) {
          targetPlayer = g.players.find(p => p.id === payload.targetPlayerId);
          if (targetPlayer) {
            targetText = `对【${targetPlayer.seat}号 · ${targetPlayer.nickname}】`;
          }
        }

        let customSummary: string | undefined;

        if (role.skill.skillId === 'jingang_zhuo') {
          // 太上老君【金刚琢】
          g.brawl.laojunZhuoActive = true;
        } else if (role.skill.skillId === 'dakou_tuntian') {
          // 青毛狮子怪【大口吞天】
          if (targetPlayer) {
            requireRule(targetPlayer.id !== captain(g), 'CANNOT_BAN_CAPTAIN');
            requireRule(targetPlayer.id !== userId, 'CANNOT_BAN_SELF');

            if (!g.treasuresState) {
              g.treasuresState = {};
            }
            g.treasuresState.humanBag = {
              used: true,
              targetId: targetPlayer.id,
              activeBannedMission: g.mission,
            };

            // 强制将目标从当前挑人队伍中吸走剔除
            if (g.draftTeam?.playerIds.includes(targetPlayer.id)) {
              g.draftTeam.playerIds = g.draftTeam.playerIds.filter(id => id !== targetPlayer.id);
            }
            const currentRound = g.rounds.at(-1);
            if (currentRound && g.phase === 'discussion' && currentRound.team.includes(targetPlayer.id)) {
              currentRound.team = currentRound.team.filter(id => id !== targetPlayer.id);
              g.phase = 'proposing';
            }
          }
        } else if (role.skill.skillId === 'jiashe_leiyin') {
          // 黄眉老怪【假设雷音】（假传佛旨：私密点化 1 名随机蓝方）
          if (targetPlayer) {
            const candidateBlues = g.players.filter(p => {
              const ps = g.brawl?.playerStates[p.id];
              return ps?.camp === 'blue' && ps?.roleId !== 'sun_wukong';
            });
            if (candidateBlues.length > 0) {
              const randomBlue = candidateBlues[Math.floor(Math.random() * candidateBlues.length)];
              g.brawl.huangmeiDianhuaNotice = {
                targetBlueUserId: randomBlue.id,
                targetSeat: targetPlayer.seat,
                targetNickname: targetPlayer.nickname,
              };
            }
          }
          // 静默生效，绝不生成公屏战报，彻底避免自爆！
          break;
        } else if (role.skill.skillId === 'huapi_lijian') {
          // 白骨精【画皮离间】（静默在出征队伍中埋下离间魔骨）
          g.brawl.baiguLijianArmed = true;
          // 静默生效，绝不生成公屏战报，彻底避免自爆！
          break;
        } else if (role.skill.skillId === 'huanghua_ducha') {
          // 百眼魔君【黄花毒茶】（静默在出征队伍杯中下毒）
          if (targetPlayer) {
            g.brawl.baiyanDuchaTargetId = targetPlayer.id;
          }
          // 静默生效，绝不生成公屏战报，彻底避免自爆！
          break;
        } else if (role.skill.skillId === 'wuxingshan_zhang') {
          // 如来佛祖【五行山掌】
          if (targetPlayer) {
            g.brawl.imprisonedTargetId = targetPlayer.id;

            if (g.draftTeam?.playerIds.includes(targetPlayer.id)) {
              g.draftTeam.playerIds = g.draftTeam.playerIds.filter(id => id !== targetPlayer.id);
            }
            const currentRound = g.rounds.at(-1);
            if (currentRound && g.phase === 'discussion' && currentRound.team.includes(targetPlayer.id)) {
              currentRound.team = currentRound.team.filter(id => id !== targetPlayer.id);
              g.phase = 'proposing';
            }
          }
        } else if (role.skill.skillId === 'jiuzhuan_xiantao') {
          // 王母娘娘【九转仙桃】
          g.brawl.taoshouActive = true;
        } else if (role.skill.skillId === 'longma_fuzhong') {
          // 白龙马【龙马负重】
          g.brawl.extraSeatLimit = 1;
        } else if (role.skill.skillId === 'pansi_jiejian') {
          // 蜘蛛精【盘丝结茧】
          if (targetPlayer) {
            requireRule(targetPlayer.id !== captain(g), 'CANNOT_BAN_CAPTAIN');
            requireRule(targetPlayer.id !== userId, 'CANNOT_BAN_SELF');
            g.brawl.zhizhuBannedTargetId = targetPlayer.id;

            if (g.draftTeam?.playerIds.includes(targetPlayer.id)) {
              g.draftTeam.playerIds = g.draftTeam.playerIds.filter(id => id !== targetPlayer.id);
            }
            const currentRound = g.rounds.at(-1);
            if (currentRound && g.phase === 'discussion' && currentRound.team.includes(targetPlayer.id)) {
              currentRound.team = currentRound.team.filter(id => id !== targetPlayer.id);
              g.phase = 'proposing';
            }
          }
        } else if (role.skill.skillId === 'xiuli_qiankun') {
          // 镇元大仙【袖里乾坤】
          requireRule(['proposing', 'discussion', 'team_vote'].includes(g.phase), 'WRONG_PHASE');
          delete g.draftTeam;
          g.teamVotes = {};
          g.missionVotes = {};
          rotate(g);
          g.phase = 'proposing';
        } else if (role.skill.skillId === 'zhaoyao_baojing') {
          // 托塔李天王【照妖宝镜】
          const currentTeam = g.draftTeam?.playerIds ?? g.rounds.at(-1)?.team ?? [];
          const hasDemon = currentTeam.some(id => g.brawl?.playerStates[id]?.camp === 'red');
          g.brawl.zhaoyaoResult = { hasDemon, teamPlayerIds: [...currentTeam] };
        } else if (role.skill.skillId === 'yuncheng_wanli') {
          // 金翅大鹏雕【云程万里】：任意时刻均可提前蓄力，刺杀阶段自动排除非大圣目标
          g.brawl.dapengArmed = true;
          if (g.phase === 'assassination') {
            triggerDapengExclude(g);
          }
        } else if (role.skill.skillId === 'santou_liubi' || role.skill.skillId === 'pingtian_handi') {
          // 哪吒三太子【三头六臂】/ 牛魔王【平天撼地】
          requireRule(['proposing', 'discussion', 'team_vote'].includes(g.phase), 'WRONG_PHASE');
          g.brawl.doubleVoteUserId = userId;
        } else if (role.skill.skillId === 'yishan_yading') {
          // 银角大王【移山压顶】
          if (targetPlayer) {
            requireRule(targetPlayer.id !== userId, 'CANNOT_TARGET_SELF');
            requireRule(['proposing', 'discussion', 'team_vote'].includes(g.phase), 'WRONG_PHASE');
            g.brawl.yishanTargetId = targetPlayer.id;
            if (g.phase === 'team_vote') {
              g.teamVotes[targetPlayer.id] = 'abstain';
            }
          }
        } else if (role.skill.skillId === 'tianzun_yuzhi') {
          // 玉皇大帝【天尊玉旨】
          g.brawl.yuhuangYuzhiArmed = true;
        } else if (role.skill.skillId === 'xiangyao_baozhang') {
          // 沙悟净【降妖宝杖】
          g.brawl.shawujingBaozhangArmed = true;
        } else if (role.skill.skillId === 'daoda_yipa') {
          // 猪八戒【倒打一耙】
          g.brawl.zhubajieDaodaArmed = true;
        } else if (role.skill.skillId === 'bajiao_shenfeng') {
          // 铁扇公主【芭蕉神风 · 窥破仙阶】
          // 刺探蓝方入局阵容是天庭灵山至尊大能还是散仙护法，且 50% 概率获知 1 位具体仙佛法号
          const supremeRoleIds = ['rulai_fozu', 'yuhuang_dadi', 'guanyin_pusa', 'taishang_laojun', 'wangmu_niangniang', 'zhenyuan_daxian', 'puti_zhushi'];
          const blueInPlay = g.players.map(p => g.brawl?.playerStates[p.id]).filter(ps => ps?.camp === 'blue').map(ps => ps!.roleId);
          const inPlaySupreme = blueInPlay.filter(id => supremeRoleIds.includes(id));
          const hasSupreme = inPlaySupreme.length > 0;
          let tierText = hasSupreme
            ? '🍃 芭蕉神风窥得天机：本局蓝方入局阵容包含【天庭至尊/灵山大能】（如来/玉帝/王母/老君/观音/镇元/菩提等顶级神仙）！'
            : '🍃 芭蕉神风窥得天机：本局蓝方无大能坐镇，全员皆为【散仙护法】（八戒/沙僧/白龙/哪吒等，无五行山或金刚琢威胁）！';
          if (Math.random() < 0.5) {
            const nonCoreBlues = blueInPlay.filter(id => id !== 'sun_wukong' && id !== 'tang_seng');
            const targetId = nonCoreBlues.length > 0 ? nonCoreBlues[Math.floor(Math.random() * nonCoreBlues.length)] : blueInPlay[0];
            const def = BRAWL_ROLE_REGISTRY[targetId];
            if (def) {
              tierText += ` 且灵光乍现探得仙班之一为【${def.name}】！`;
            }
          }
          g.brawl.tieshanSecret = tierText;
        } else if (role.skill.skillId === 'sanmei_shenfeng') {
          // 黄风怪【三昧神风】
          if (Math.random() < 0.5) {
            const blueRoles = g.players.map(p => g.brawl?.playerStates[p.id]).filter(ps => ps?.camp === 'blue' && ps?.roleId !== 'sun_wukong').map(ps => ps!.roleId);
            if (blueRoles.length > 0) {
              const targetRole = BRAWL_ROLE_REGISTRY[blueRoles[Math.floor(Math.random() * blueRoles.length)]];
              if (targetRole) {
                customSummary = `【黄风怪】祭起【三昧神风】黄风蔽日！狂风大作吹探出蓝方盲盒中暗藏【${targetRole.name}】气机！`;
              }
            }
          }
          if (!customSummary) {
            customSummary = `【黄风怪】祭起【三昧神风】黄风蔽日，但神佛宝相庄严，未能吹探出仙佛名号。`;
          }
        } else if (role.skill.skillId === 'jingping_ganlu') {
          // 观音菩萨【净瓶甘露】
          if (targetPlayer) {
            g.brawl.guanyinGanluTargetId = targetPlayer.id;
          }
        } else if (role.skill.skillId === 'daofa_dianhua') {
          // 菩提祖师【道法点化】
          requireRule(g.mission >= 2, 'MISSION_NOT_REACHED');
          const candidateBlues = g.players.filter(p => {
            const ps = g.brawl?.playerStates[p.id];
            return ps?.camp === 'blue' && ps?.roleId !== 'sun_wukong';
          });
          const candidateReds = g.players.filter(p => {
            const ps = g.brawl?.playerStates[p.id];
            return ps?.camp === 'red';
          });
          if (candidateBlues.length > 0 && candidateReds.length > 0 && Math.random() < 0.5) {
            const targetBlue = candidateBlues[Math.floor(Math.random() * candidateBlues.length)];
            const targetRed = candidateReds[Math.floor(Math.random() * candidateReds.length)];
            const redDef = BRAWL_ROLE_REGISTRY[g.brawl.playerStates[targetRed.id].roleId];
            g.brawl.putiDianhuaNotice = {
              targetBlueUserId: targetBlue.id,
              redRoleName: redDef ? redDef.name : '未知妖魔',
            };
          }
        } else if (role.skill.skillId === 'zijin_hulu') {
          // 金角大王【紫金葫芦】
          if (targetPlayer) {
            g.brawl.jinjiaoHuluTargetId = targetPlayer.id;
          }
        } else if (role.skill.skillId === 'daoyao_mihun') {
          // 玉兔精【捣药迷魂】
          if (targetPlayer) {
            g.brawl.yutuMihunTargetId = targetPlayer.id;
          }
        }

        const summaryText = customSummary || `【${role.name}】祭出绝技【${role.skill.skillName}】${targetText}！效用：${role.skill.description}`;
        appendBattleEvent(g.brawl, role.id, summaryText, role.skill.description);
      }
      break;
    }
    default: throw new RuleError('WRONG_PHASE');
  }
  return g;
}
export function projectGame(g: GameState, userId?: string): GameView {
  const role = userId && g.phase !== 'dealing' ? g.roles[userId] : undefined;
  const evilIds = role === 'merlin'
    ? g.players.filter(p => {
        if (teamOf(g.roles[p.id]) !== 'red') return false;
        if (g.brawl) {
          const brawlRoleId = g.brawl.playerStates[p.id]?.roleId;
          return brawlRoleId !== 'huangmei_laoguai';
        }
        return g.roles[p.id] !== 'mordred';
      }).map(p => p.id)
    : role && teamOf(role) === 'red' && role !== 'oberon'
      ? g.players.filter(p => p.id !== userId && teamOf(g.roles[p.id]) === 'red' && g.roles[p.id] !== 'oberon').map(p => p.id) : [];
  const treasureModeActive = Boolean(g.settings.treasuresEnabled && g.players.length >= 8);
  const treasuresEnabled = Boolean(role && treasuresEnabledFor(g.settings, g.players.length, role, g.rulesetVersion));
  const completedMissions = g.rounds.filter(r => r.result).length;
  const failedMissions = g.rounds.filter(r => r.result && !r.result.passed).length;
  const currentRound = g.rounds.at(-1);
  const bell = g.treasuresState?.heartBell;
  const bellMessage = bell ? { mission: bell.mission, roundNumber: bell.roundNumber, advice: bell.advice,
    active: g.phase === 'mission' && !isEnded(g) && currentRound?.number === bell.roundNumber &&
      g.mission === bell.mission && !(bell.targetId in g.missionVotes) } : undefined;
  const bellTargets = role === 'minion' && userId ? heartBellTargets(g, userId) : [];

  return { id: g.id, rulesetVersion: g.rulesetVersion, phase: g.phase, players: structuredClone(g.players), mission: g.mission,
    ...(g.phase === 'dealing' ? { dealEndsAt: g.dealEndsAt } : {}),
    ...(g.phase === 'guanyin_window' ? { guanyinEndsAt: g.guanyinEndsAt } : {}),
    missionSizes: [...missionSizesFor(g.players.length, Boolean(g.brawl))], failuresRequired: failuresRequired(g), rejectionCount: g.rejectionCount,
    captainId: captain(g), captainOrder: [...g.captainOrder], rounds: structuredClone(g.rounds),
    ...(['role_reveal','proposing','discussion'].includes(g.phase) && g.draftTeam ? { draftTeam: structuredClone(g.draftTeam) } : {}),
    ...(g.phase === 'team_vote' ? { teamVote: { startedAt: g.teamVoteStartedAt, votedIds: Object.keys(g.teamVotes), ...(!g.settings.anonymousTeamVote ? { ballots: { ...g.teamVotes } } : {}) } } : {}),
    progress: { confirmed: g.confirmed.length, teamVotes: Object.keys(g.teamVotes).length, missionVotes: Object.keys(g.missionVotes).length },
    ...(g.earlyAssassination ? { earlyAssassination: structuredClone(g.earlyAssassination) } : {}),
    ...(g.assassinationMode || g.phase === 'assassination' ? { assassinationMode: g.assassinationMode ?? 'normal' } : {}),
    ...(g.phase === 'assassination' ? { assassinId: g.players.find(p => g.roles[p.id] === 'assassin')?.id } : {}),
    ...(g.treasuresState?.humanBag?.activeBannedMission === g.mission && g.treasuresState.humanBag.targetId
      ? { humanBagBannedPlayerId: g.treasuresState.humanBag.targetId } : {}),
    ...(g.bananaFanNotice ? { bananaFanNotice: g.bananaFanNotice } : {}),
    ...(g.result ? {
      result: { ...g.result },
      revealedRoles: { ...g.roles },
      ...(g.brawlRoles ? { revealedBrawlRoles: { ...g.brawlRoles } } : {}),
    } : {}),
    ...(g.brawl ? { brawl: structuredClone(g.brawl) } : {}),
    ...(g.brawl && userId ? { selfBrawl: projectSelfBrawlView(g.brawl, userId, g.mission, g.brawlPeekedMap, g.players) } : {}),
    ...(g.abortPoll ? { abortPoll: { requestedBy: g.abortPoll.requestedBy, approvals: g.abortPoll.approvals.length,
      required: g.abortPoll.electorate.length, voted: !!userId && g.abortPoll.approvals.includes(userId) } } : {}),
    ...(role && userId ? { self: { role, ...(role === 'loyal' ? { loyalGuardian: assignLoyalGuardians(g.id, g.players, g.roles, g.rulesetVersion)[userId] } : {}), ...(role === 'minion' ? { femaleDemon: assignFemaleDemons(g.id, g.players, g.roles)[userId] } : {}), team: teamOf(role), evilIds,
      merlinCandidates: role === 'percival' ? g.players.filter(p => ['merlin','morgana'].includes(g.roles[p.id])).map(p => p.id) : [],
      guinevereCandidates: role === 'guinevere' ? [...(g.guinevereCandidates ?? [])] : [],
      guardianClue: role === 'loyal' && g.guardianClues ? g.guardianClues[userId] : undefined,
      confirmed: g.confirmed.includes(userId), teamVoted: userId in g.teamVotes, missionVoted: userId in g.missionVotes,
      canDecideEarly: role === 'assassin' && canUseEarlyAssassination(g),
      treasures: {
        enabled: treasuresEnabled,
        ...(treasureModeActive && !treasuresEnabled ? { disabledReason: 'guardian_perks' as const } : {}),
        ...(role === 'minion' && treasuresEnabled ? {
          heartBell: { used: Boolean(bell?.used), available: bellTargets.length > 0, targetIds: bellTargets,
            ...(bell && bellMessage && bell.senderId === userId ? { sent: { ...bellMessage, targetId: bell.targetId } } : {}) },
        } : {}),
        ...(treasuresEnabled && bell && bellMessage && bell.targetId === userId ? { incomingHeartBell: { ...bellMessage } } : {}),
        ...(role === 'percival' && treasuresEnabled ? {
          tinStaff: {
            used: Boolean(g.treasuresState?.tinStaff?.used),
            available: !g.treasuresState?.tinStaff?.used && completedMissions >= 2 && !isEnded(g),
            result: g.treasuresState?.tinStaff?.result,
          },
          ...(g.treasuresState?.jinguSeal?.activatedBy ? { jinguAllyId: g.treasuresState.jinguSeal.activatedBy } : {}),
        } : {}),
        ...(role === 'guinevere' && treasuresEnabled ? {
          guanyinMirror: {
            used: Boolean(g.treasuresState?.guanyinMirror?.used),
            available: !g.treasuresState?.guanyinMirror?.used && Boolean(currentRound && g.phase === 'guanyin_window' && !isEnded(g)),
            result: g.treasuresState?.guanyinMirror?.result,
          },
        } : {}),
        ...(role === 'mordred' && treasuresEnabled ? {
          humanBag: {
            used: Boolean(g.treasuresState?.humanBag?.used),
            available: !g.treasuresState?.humanBag?.used && g.mission >= 3 && g.phase === 'proposing' && !isEnded(g),
            targetId: g.treasuresState?.humanBag?.targetId,
          },
        } : {}),
        ...(role === 'loyal' && treasuresEnabled ? {
          jinguSeal: {
            used: Boolean(g.treasuresState?.jinguSeal?.used),
            available: !g.treasuresState?.jinguSeal?.used && failedMissions >= 2 && !isEnded(g),
            activatedBy: g.treasuresState?.jinguSeal?.activatedBy,
          },
        } : {}),
        ...(role === 'oberon' && treasuresEnabled ? {
          bananaFan: {
            used: Boolean(g.treasuresState?.bananaFan?.used),
            armed: Boolean(g.treasuresState?.bananaFan?.armed),
            available: !g.treasuresState?.bananaFan?.used && !isEnded(g),
          },
        } : {}),
      },
    } } : {}),
  };
}

export * from './brawl-registry.js';
export * from './brawl-engine.js';

