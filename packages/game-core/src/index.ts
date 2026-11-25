import { assignWeightedRoles, type RoleProtectionOptions } from './role-assignment.js';
export { roleWeight, ROLE_ASSIGNMENT_VERSION, ROLE_WEIGHT_VERSION } from './role-assignment.js';
export type { RoleProtectionOptions } from './role-assignment.js';
export { randomBigIntBelow } from './random.js';
import type { Command, GameResult, GameView, LoyalGuardian, FemaleDemon, Player, Role, RoundView, Settings, Team, PrivateInspection, EarlyWindow, TeamBallot, GuardianClue, SelfTreasures, HeartBellAdvice, RoleAssignmentAudit, BrawlGameState, BrawlPlayerState, BrawlCommandPayload, BrawlCamp, BrawlTriggerPhase } from '@avalon/contracts';
export { drawBrawlRoles, BRAWL_ROLE_REGISTRY, BRAWL_SKILL_PROBS, sampleWithoutReplacement } from './brawl-registry.js';
export type { BrawlRoleDef } from '@avalon/contracts';
import { drawBrawlRoles, BRAWL_ROLE_REGISTRY, BRAWL_SKILL_PROBS, sampleWithoutReplacement } from './brawl-registry.js';
import {
  createBrawlGameState,
  appendBattleEvent,
  recordBrawlReplayAction,
  setBrawlPrivateReceipt,
  projectBrawlGameState,
  validateBrawlMissionVote,
  projectSelfBrawlView,
  resetRoundBrawlEffects,
  getEffectiveSkillRole,
  hasBrawlSkillRole,
  assignCoreBonusSkills,
} from './brawl-engine.js';
import {
  BRAWL_MAX_REJECTIONS_BEFORE_FORCE,
  BRAWL_ORDEAL_REGISTRY,
  createInitialOrdealState,
  createInitialWagerState,
  getActiveOrdealId,
  collectMissionBannedPlayerIds,
  canSafelyBanPlayer,
  advanceMissionOrdeals,
  applyCelestialSwap,
  pickPhantomEvilTarget,
  canCaptainStakeWager,
} from './brawl-ordeals.js';
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
  7: ['merlin','percival','loyal','loyal','morgana','assassin','minion'],
  8: ['merlin','percival','loyal','loyal','loyal','morgana','assassin','minion'],
  9: ['merlin','percival','loyal','loyal','loyal','morgana','assassin','minion','minion'],
  10: ['merlin','percival','loyal','loyal','loyal','loyal','morgana','assassin','minion','minion'],
  11: ['merlin','percival','loyal','loyal','loyal','loyal','morgana','assassin','minion','minion','minion'],
  12: ['merlin','percival','loyal','loyal','loyal','loyal','loyal','morgana','assassin','minion','minion','minion'],
};
export const teamOf = (role: Role): Team => ['merlin','percival','guinevere','loyal'].includes(role) ? 'blue' : 'red';
/** New deals separate guardian clues from blue treasures; saved v1–v5 games retain their original rules. */
export function treasuresEnabledFor(
  settings: Pick<Settings, 'treasuresEnabled' | 'guardianPerksEnabled' | 'brawlModeEnabled'>,
  playerCount: number,
  role: Role,
  rulesetVersion = RULESET_VERSION
): boolean {
  if (settings.brawlModeEnabled) return false;
  const balanceRule = Number(rulesetVersion.match(/-v(\d+)$/)?.[1]) >= 6;
  return Boolean(settings.treasuresEnabled && playerCount >= 8 &&
    !(balanceRule && settings.guardianPerksEnabled && teamOf(role) === 'blue'));
}
export function hasUnusedGuanyin(g: GameState): boolean {
  return Boolean(
    !g.brawl &&
    !g.settings.brawlModeEnabled &&
    treasuresEnabledFor(g.settings, g.players.length, 'guinevere', g.rulesetVersion) &&
    g.players.length >= 9 &&
    g.players.some(p => g.roles[p.id] === 'guinevere') &&
    !g.treasuresState?.guanyinMirror?.used
  );
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

interface AssignCampResult {
  assignedRoles: Record<string, Role>;
  assignedBrawlRoles: Record<string, string>;
  assignedPlayerStates: Record<string, BrawlPlayerState>;
  nonCoreAssignedRoleIds: string[];
}

/**
 * 以人为本的大乱斗阵营角色直发引擎：
 * 1. 优先满足玩家个人心仪志愿（第 1 志愿 -> 第 5 志愿），多名玩家争抢时依志愿权重轮盘抽签；
 * 2. 保证阵营固定核心角色（悟空/唐僧/观音 或 孩儿/六耳/黄眉）100% 必须有人出任；
 * 3. 严格限制非核心盲盒名额，防止角色超额或重复；
 * 4. 完美兼顾首领防连庄 (bossCooldown) 与近期角色防重复 (recentRoles / 9)。
 */
function assignCampRolesDirectly(
  campPlayers: Player[],
  camp: 'blue' | 'red',
  coreDefs: { id: string; role: Role }[],
  defaultNonCoreRole: Role,
  rawPreferences: Record<string, string[]> | undefined,
  rolePreferenceEnabled: boolean,
  protectionOpts: RoleProtectionOptions,
  shuffle: <T>(values: T[]) => T[],
  rng: () => number = Math.random
): AssignCampResult {
  const PREF_WEIGHTS = [8, 4, 2, 1, 1];
  const bossCooldown = new Set(protectionOpts.bossCooldownUserIds ?? []);

  const assignedRoles: Record<string, Role> = {};
  const assignedBrawlRoles: Record<string, string> = {};
  const assignedPlayerStates: Record<string, BrawlPlayerState> = {};
  const nonCoreAssignedRoleIds: string[] = [];

  let unassignedPlayers = [...campPlayers];
  let unassignedCoreDefs = [...coreDefs];
  const nonCoreSlotsTotal = campPlayers.length - coreDefs.length;
  let remainingNonCoreSlots = nonCoreSlotsTotal;
  const takenRoleIds = new Set<string>();

  interface PlayerWish {
    player: Player;
    roleId: string;
    wishRank: number; // 1 to 5
    weight: number;
    isCore: boolean;
    coreDef?: { id: string; role: Role };
  }

  const playerWishesByRank: Record<number, PlayerWish[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };

  if (rolePreferenceEnabled && rawPreferences) {
    for (const p of campPlayers) {
      const prefs = (rawPreferences[p.id] ?? []).slice(0, 5);
      prefs.forEach((roleId, idx) => {
        const def = BRAWL_ROLE_REGISTRY[roleId];
        if (!def || def.camp !== camp) return; // 严格过滤非本阵营角色，杜绝阵营错配

        const coreDef = unassignedCoreDefs.find(c => c.id === roleId);
        const isCore = Boolean(coreDef);

        let w = PREF_WEIGHTS[idx] ?? 1;
        const recent = protectionOpts.recentRoles?.[p.id] ?? [];
        const isBossRole = isCore && (coreDef!.role === 'merlin' || coreDef!.role === 'morgana' || coreDef!.role === 'assassin');
        if (isBossRole && bossCooldown.has(p.id)) {
          w = 0.01;
        } else if (recent.length > 0 && recent[0] === (isCore ? coreDef!.role : defaultNonCoreRole)) {
          w = w / 9;
        }

        playerWishesByRank[idx + 1].push({
          player: p,
          roleId,
          wishRank: idx + 1,
          weight: Math.max(0.01, w),
          isCore,
          coreDef,
        });
      });
    }
  }

  const grantRole = (player: Player, roleId: string, role: Role, wishRank?: number) => {
    assignedRoles[player.id] = role;
    assignedBrawlRoles[player.id] = roleId;
    assignedPlayerStates[player.id] = {
      userId: player.id,
      seat: player.seat,
      roleId,
      camp,
      skillUsed: false,
      ...(wishRank ? { wishRank } : {}),
    };
    takenRoleIds.add(roleId);
    unassignedPlayers = unassignedPlayers.filter(p => p.id !== player.id);
  };

  // 1. 逐级按志愿位次（第1志愿 -> 第2志愿 -> ... -> 第5志愿）以人为本分发
  for (let rank = 1; rank <= 5; rank++) {
    const wishesAtRank = playerWishesByRank[rank] ?? [];
    const activeWishes = wishesAtRank.filter(w =>
      unassignedPlayers.some(p => p.id === w.player.id) &&
      !takenRoleIds.has(w.roleId) &&
      (!w.isCore || unassignedCoreDefs.some(c => c.id === w.roleId)) &&
      (w.isCore || remainingNonCoreSlots > 0)
    );

    if (activeWishes.length === 0) continue;

    // 按角色归集候选愿望
    const wishesByRole = new Map<string, PlayerWish[]>();
    for (const w of activeWishes) {
      const list = wishesByRole.get(w.roleId) ?? [];
      list.push(w);
      wishesByRole.set(w.roleId, list);
    }

    const winnersForCore: PlayerWish[] = [];
    const winnersForNonCore: PlayerWish[] = [];

    for (const [, candidates] of wishesByRole.entries()) {
      let winner = candidates[0];
      if (candidates.length > 1) {
        const totalW = candidates.reduce((sum, c) => sum + c.weight, 0);
        let randTicket = rng() * totalW;
        for (const c of candidates) {
          if (randTicket < c.weight) {
            winner = c;
            break;
          }
          randTicket -= c.weight;
        }
      }
      if (winner.isCore) {
        winnersForCore.push(winner);
      } else {
        winnersForNonCore.push(winner);
      }
    }

    // A. 授予核心角色
    for (const win of winnersForCore) {
      if (!unassignedPlayers.some(p => p.id === win.player.id)) continue;
      if (takenRoleIds.has(win.roleId)) continue;
      const cDef = unassignedCoreDefs.find(c => c.id === win.roleId);
      if (!cDef) continue;

      grantRole(win.player, win.roleId, cDef.role, win.wishRank);
      unassignedCoreDefs = unassignedCoreDefs.filter(c => c.id !== win.roleId);
    }

    // B. 授予非核心盲盒角色
    const validNonCoreWinners = winnersForNonCore.filter(w =>
      unassignedPlayers.some(p => p.id === w.player.id) &&
      !takenRoleIds.has(w.roleId)
    );

    if (validNonCoreWinners.length <= remainingNonCoreSlots) {
      for (const win of validNonCoreWinners) {
        grantRole(win.player, win.roleId, defaultNonCoreRole, win.wishRank);
        nonCoreAssignedRoleIds.push(win.roleId);
        remainingNonCoreSlots--;
      }
    } else if (remainingNonCoreSlots > 0) {
      const lotteryPool = [...validNonCoreWinners];
      while (remainingNonCoreSlots > 0 && lotteryPool.length > 0) {
        const totalW = lotteryPool.reduce((sum, c) => sum + c.weight, 0);
        let randTicket = rng() * totalW;
        let chosenIdx = 0;
        for (let i = 0; i < lotteryPool.length; i++) {
          if (randTicket < lotteryPool[i].weight) {
            chosenIdx = i;
            break;
          }
          randTicket -= lotteryPool[i].weight;
        }
        const win = lotteryPool.splice(chosenIdx, 1)[0];
        grantRole(win.player, win.roleId, defaultNonCoreRole, win.wishRank);
        nonCoreAssignedRoleIds.push(win.roleId);
        remainingNonCoreSlots--;
      }
    }
  }

  // 2. 兜底处理：若仍有必出的核心角色未被任何玩家志愿认领，从剩余队员中委任
  for (const cDef of [...unassignedCoreDefs]) {
    if (unassignedPlayers.length === 0) break;

    const candidates = unassignedPlayers.map(p => {
      let w = 1;
      const recent = protectionOpts.recentRoles?.[p.id] ?? [];
      const isBossRole = cDef.role === 'merlin' || cDef.role === 'morgana' || cDef.role === 'assassin';
      if (isBossRole && bossCooldown.has(p.id)) {
        w = 0.01;
      } else if (recent.length > 0 && recent[0] === cDef.role) {
        w = w / 9;
      }
      return { player: p, weight: Math.max(0.01, w) };
    });

    const totalW = candidates.reduce((sum, c) => sum + c.weight, 0);
    let randTicket = rng() * totalW;
    let chosenPlayer = candidates[0].player;
    for (const c of candidates) {
      if (randTicket < c.weight) {
        chosenPlayer = c.player;
        break;
      }
      randTicket -= c.weight;
    }

    grantRole(chosenPlayer, cDef.id, cDef.role);
    unassignedCoreDefs = unassignedCoreDefs.filter(c => c.id !== cDef.id);
  }

  // 3. 兜底处理：若仍有剩余非核心名额，从本阵营剩余可用池中随机抽取补齐
  if (remainingNonCoreSlots > 0 && unassignedPlayers.length > 0) {
    const availableNonCorePool = Object.values(BRAWL_ROLE_REGISTRY).filter(r =>
      r.camp === camp &&
      !r.isCore &&
      !takenRoleIds.has(r.id) &&
      coreDefs.every(c => c.id !== r.id)
    );

    const neededCount = Math.min(remainingNonCoreSlots, unassignedPlayers.length);
    const drawnRoles = sampleWithoutReplacement(availableNonCorePool, neededCount, rng);

    const shuffledRemaining = shuffle([...unassignedPlayers]);
    for (let i = 0; i < drawnRoles.length; i++) {
      const p = shuffledRemaining[i];
      const roleDef = drawnRoles[i];
      grantRole(p, roleDef.id, defaultNonCoreRole);
      nonCoreAssignedRoleIds.push(roleDef.id);
      remainingNonCoreSlots--;
    }
  }

  return {
    assignedRoles,
    assignedBrawlRoles,
    assignedPlayerStates,
    nonCoreAssignedRoleIds,
  };
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

  let roles: Record<string, Role> = {};
  let audit: RoleAssignmentAudit | undefined;

  let brawlState: BrawlGameState | undefined;
  let brawlRoles: Record<string, string> | undefined;
  let brawlPeekedMap: Record<string, { roleId: string; roleName: string; camp: BrawlCamp }[]> | undefined;

  if (settings.brawlModeEnabled) {
    const rawPreferences = protectionOpts.rolePreferences;
    brawlRoles = {};

    const redRoleCount = BRAWL_BASE_ROLE_CONFIG[players.length].filter(r => teamOf(r) === 'red').length;

    // 1. 计算每个玩家对红方与蓝方的阵营倾向得分，融入自然概率与连庄保护约束
    const PREF_WEIGHTS = [8, 4, 2, 1, 1];
    const blueGuaranteed = new Set(protectionOpts.blueGuaranteedUserIds ?? []);

    const playerScores = sorted.map(p => {
      const prefs = settings.rolePreferenceEnabled ? (rawPreferences?.[p.id] ?? []) : [];
      let redScore = 0;
      let blueScore = 0;
      prefs.slice(0, 5).forEach((roleId, idx) => {
        const w = PREF_WEIGHTS[idx] ?? 1;
        const camp = BRAWL_ROLE_REGISTRY[roleId]?.camp;
        if (camp === 'red') redScore += w;
        else if (camp === 'blue') blueScore += w;
      });

      // 计算历史连续出任阵营的连庄数 (redStreak / blueStreak)
      const userRecentRoles = protectionOpts.recentRoles?.[p.id] ?? [];
      let redStreak = 0;
      let blueStreak = 0;
      for (const r of userRecentRoles) {
        const camp = teamOf(r);
        if (camp === 'red') {
          if (blueStreak === 0) redStreak++;
          else break;
        } else if (camp === 'blue') {
          if (redStreak === 0) blueStreak++;
          else break;
        }
      }

      // 阵营偏好净得分：红方偏好加分，蓝方偏好减分（满心愿最大加减 800 分，绝对主导阵营划分）
      const preferenceDiff = (redScore - blueScore) * 50;

      // 平滑连庄调节分（避免单局 1 连庄即遭遇 500 分断层惩罚导致机械式的红蓝交替）：
      // redStreak === 1: 仅微扣 80 分，保留约 30%~40% 的自然连庄概率
      // redStreak === 2: 明显扣 350 分，有效抑制 3 连红
      // redStreak >= 3: 强制归零 -999999，绝对保底转蓝
      let streakAdjustment = 0;
      if (redStreak === 1) streakAdjustment = -80;
      else if (redStreak === 2) streakAdjustment = -350;
      else if (redStreak >= 3 || blueGuaranteed.has(p.id)) streakAdjustment = -999999;

      if (streakAdjustment > -999999) {
        if (blueStreak === 1) streakAdjustment += 40;
        else if (blueStreak === 2) streakAdjustment += 100;
        else if (blueStreak === 3) streakAdjustment += 200;
        else if (blueStreak >= 4) streakAdjustment += 600;
      }

      // 基础分为 500，加上偏好分、连庄调节分与随机自然微扰 (±120)
      const isHardBlue = blueGuaranteed.has(p.id) || redStreak >= 3;
      const jitter = (Math.random() * 240) - 120;
      const redPropensity = isHardBlue ? -999999 : (500 + preferenceDiff + streakAdjustment + jitter);

      return {
        player: p,
        prefs,
        redStreak,
        blueStreak,
        redScore,
        blueScore,
        redPropensity,
      };
    });

    // 2. 根据倾向得分将玩家分入红蓝两队（高红倾向者优先入红，低者入蓝）
    const sortedByRedPreference = [...playerScores].sort((a, b) => b.redPropensity - a.redPropensity);

    const redPlayers = sortedByRedPreference.slice(0, redRoleCount).map(x => x.player);
    const bluePlayers = sortedByRedPreference.slice(redRoleCount).map(x => x.player);

    const is9Plus = sorted.length >= 9;

    // 3. 执行“以人为本、志愿直达”的阵营角色分配
    const blueCoreDefs: { id: string; role: Role }[] = is9Plus
      ? [
          { id: 'sun_wukong', role: 'merlin' },
          { id: 'tang_seng', role: 'percival' },
          { id: 'guanyin_pusa', role: 'loyal' },
        ]
      : [
          { id: 'sun_wukong', role: 'merlin' },
          { id: 'tang_seng', role: 'percival' },
        ];

    const redCoreDefs: { id: string; role: Role }[] = is9Plus
      ? [
          { id: 'hong_haier', role: 'assassin' },
          { id: 'liuer_mihou', role: 'morgana' },
          { id: 'huangmei_laoguai', role: 'minion' },
        ]
      : [
          { id: 'hong_haier', role: 'assassin' },
          { id: 'liuer_mihou', role: 'morgana' },
        ];

    const blueResult = assignCampRolesDirectly(
      bluePlayers,
      'blue',
      blueCoreDefs,
      'loyal',
      rawPreferences,
      Boolean(settings.rolePreferenceEnabled),
      protectionOpts,
      shuffle,
      Math.random
    );

    const redResult = assignCampRolesDirectly(
      redPlayers,
      'red',
      redCoreDefs,
      'minion',
      rawPreferences,
      Boolean(settings.rolePreferenceEnabled),
      protectionOpts,
      shuffle,
      Math.random
    );

    roles = { ...blueResult.assignedRoles, ...redResult.assignedRoles };
    brawlRoles = { ...blueResult.assignedBrawlRoles, ...redResult.assignedBrawlRoles };
    const playerStates: Record<string, BrawlPlayerState> = {
      ...blueResult.assignedPlayerStates,
      ...redResult.assignedPlayerStates,
    };

    // 5~8 人局乱斗提纯：为 4 位固定核心角色额外配发 1 个未出场同阵营主动副法宝
    const bonusGrants = sorted.length <= 8 ? assignCoreBonusSkills(playerStates, Math.random) : [];

    brawlState = createBrawlGameState(
      playerStates,
      blueResult.nonCoreAssignedRoleIds,
      redResult.nonCoreAssignedRoleIds
    );
    brawlState.ordeals = createInitialOrdealState(Boolean(settings.brawlOrdealsEnabled), Math.random);
    brawlState.wager = createInitialWagerState();

    // 画皮惑眼（高阶可选开关）：孙悟空眼中混入 1 位随机无辜蓝方假红气
    if (settings.brawlPhantomVisionEnabled) {
      const phantomId = pickPhantomEvilTarget(playerStates, Math.random);
      if (phantomId) {
        brawlState.phantomEvilId = phantomId;
        const phantomP = sorted.find(x => x.id === phantomId);
        recordBrawlReplayAction(brawlState, {
          roundNumber: 0,
          mission: 0,
          phase: 'game_start',
          actorId: '',
          actorSeat: 0,
          actorNickname: '天道异相',
          roleId: 'ordeal_system',
          roleName: '画皮惑眼',
          skillName: '虚像灵光',
          targetId: phantomP?.id,
          targetSeat: phantomP?.seat,
          targetNickname: phantomP?.nickname,
          outcome: 'info',
          detail: `本局开启【画皮惑眼】：蓝方仙友【${phantomP?.seat}号 · ${phantomP?.nickname}】身上笼罩虚幻妖气，在孙悟空火眼金睛中误显红光！`,
        });
      }
    }

    // 记录 5~8 人局核心副法宝分配到终局复盘
    for (const grant of bonusGrants) {
      const p = sorted.find(x => x.id === grant.userId);
      const coreDef = BRAWL_ROLE_REGISTRY[grant.coreRoleId];
      const bonusDef = BRAWL_ROLE_REGISTRY[grant.bonusRoleId];
      if (p && coreDef && bonusDef) {
        recordBrawlReplayAction(brawlState, {
          roundNumber: 0,
          mission: 0,
          phase: 'game_start',
          actorId: p.id,
          actorSeat: p.seat,
          actorNickname: p.nickname,
          roleId: coreDef.id,
          roleName: coreDef.name,
          skillName: `附带仙宝 · ${bonusDef.skill.skillName}`,
          outcome: 'info',
          detail: `小局乱斗提纯：核心【${coreDef.name}】额外获赐【${bonusDef.name}】的独门法宝【${bonusDef.skill.skillName}】！`,
        });
      }
    }

    // 若开启八十一难奇劫，首难翻牌并公屏播报
    if (brawlState.ordeals?.currentOrdealId) {
      const firstOrdeal = BRAWL_ORDEAL_REGISTRY[brawlState.ordeals.currentOrdealId];
      appendBattleEvent(
        brawlState,
        'ordeal_system',
        `【第 1 难 · ${firstOrdeal.icon} ${firstOrdeal.name}】${firstOrdeal.description}`,
        firstOrdeal.tagline,
        'anonymous_broadcast',
      );
      recordBrawlReplayAction(brawlState, {
        roundNumber: 0,
        mission: 1,
        phase: 'game_start',
        actorId: '',
        actorSeat: 0,
        actorNickname: '八十一难奇劫',
        roleId: 'ordeal_system',
        roleName: firstOrdeal.name,
        skillName: '第 1 难法则',
        outcome: 'info',
        detail: `第 1 难翻开奇劫【${firstOrdeal.name}】：${firstOrdeal.description}`,
      });
    }

    // 构造特定情报特权（二郎神看 1 妖，百眼魔君看 1 仙，老鼠精看 1 仙）
    brawlPeekedMap = {};
    const allAssignedBlue = Object.values(blueResult.assignedBrawlRoles);
    const allAssignedRed = Object.values(redResult.assignedBrawlRoles);

    // 二郎神：看 1 红
    if (allAssignedBlue.includes('erlang_shen')) {
      const targetRedId = redResult.nonCoreAssignedRoleIds.length > 0
        ? redResult.nonCoreAssignedRoleIds[0]
        : (is9Plus ? 'huangmei_laoguai' : 'hong_haier');
      const targetDef = BRAWL_ROLE_REGISTRY[targetRedId];
      brawlPeekedMap.erlang_shen = [{ roleId: targetRedId, roleName: targetDef ? targetDef.name : targetRedId, camp: 'red' }];
    }

    // 百眼魔君：看 1 蓝
    if (allAssignedRed.includes('baiyan_mojun')) {
      const targetBlueId = blueResult.nonCoreAssignedRoleIds.length > 0
        ? blueResult.nonCoreAssignedRoleIds[0]
        : (is9Plus ? 'guanyin_pusa' : 'sun_wukong');
      const targetDef = BRAWL_ROLE_REGISTRY[targetBlueId];
      brawlPeekedMap.baiyan_mojun = [{ roleId: targetBlueId, roleName: targetDef ? targetDef.name : targetBlueId, camp: 'blue' }];
    }

    // 老鼠精：看 1 蓝
    if (allAssignedRed.includes('laoshu_jing')) {
      const targetBlueId = blueResult.nonCoreAssignedRoleIds.length > 0
        ? blueResult.nonCoreAssignedRoleIds[blueResult.nonCoreAssignedRoleIds.length - 1]
        : (is9Plus ? 'guanyin_pusa' : 'tang_seng');
      const targetDef = BRAWL_ROLE_REGISTRY[targetBlueId];
      brawlPeekedMap.laoshu_jing = [{ roleId: targetBlueId, roleName: targetDef ? targetDef.name : targetBlueId, camp: 'blue' }];
    }

    if (brawlPeekedMap) {
      for (const [roleId, peekedList] of Object.entries(brawlPeekedMap)) {
        const p = sorted.find(x => playerStates[x.id]?.roleId === roleId);
        const ps = p ? playerStates[p.id] : undefined;
        if (p && ps && peekedList.length > 0) {
          const roleDef = BRAWL_ROLE_REGISTRY[ps.roleId];
          const peekedNames = peekedList.map(x => `【${x.roleName}】`).join('、');
          recordBrawlReplayAction(brawlState, {
            roundNumber: 0,
            mission: 0,
            phase: 'game_start',
            actorId: p.id,
            actorSeat: p.seat,
            actorNickname: p.nickname,
            roleId: ps.roleId,
            roleName: roleDef ? roleDef.name : ps.roleId,
            skillName: roleDef ? roleDef.skill.skillName : '独门法宝',
            outcome: 'info',
            detail: `开局天机侦察：通过独门绝技洞悉盲盒抽取情报，探得入局角色：${peekedNames}。`,
          });
        }
      }
    }
  } else {
    const res = assignWeightedRoles(sorted, configRoles, shuffle([...configRoles]), {
      ...protectionOpts,
      rolePreferences: settings.rolePreferenceEnabled ? protectionOpts.rolePreferences : undefined,
    });
    roles = res.roles;
    audit = res.audit;
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
    return pState?.camp === 'blue' && pState?.roleId !== 'sun_wukong' && p.id !== g.brawl?.ordeals?.shituoExcludedPlayerId;
  });
  if (candidateBluePlayers.length > 0) {
    const excluded = candidateBluePlayers[Math.floor(Math.random() * candidateBluePlayers.length)];
    g.brawl.dapengExcludedPlayerId = excluded.id;
    const dapengPlayer = g.players.find(p => hasBrawlSkillRole(g.brawl?.playerStates[p.id], 'jinchi_dapeng'));
    setBrawlPrivateReceipt(
      g.brawl,
      dapengPlayer?.id,
      `🦅 云程万里已生效：终局刺杀已为红孩儿排除【${excluded.seat}号 · ${excluded.nickname}】（此人绝非孙悟空）！`,
    );
    recordBrawlReplayAction(g.brawl, {
      roundNumber: g.rounds.length,
      mission: g.mission,
      phase: 'assassination',
      actorId: dapengPlayer?.id ?? '',
      actorSeat: dapengPlayer?.seat ?? 0,
      actorNickname: dapengPlayer?.nickname ?? '金翅大鹏雕',
      roleId: 'jinchi_dapeng',
      roleName: '金翅大鹏雕',
      skillName: '云程万里',
      targetId: excluded.id,
      targetSeat: excluded.seat,
      targetNickname: excluded.nickname,
      outcome: 'success',
      detail: `大鹏展翅云程万里俯瞰全场，终局刺杀阶段为红孩儿直接排除 1 个绝对不是孙悟空的席位：【${excluded.seat}号 · ${excluded.nickname}】！`,
    });
  }
}
function triggerShituoExclude(g: GameState) {
  if (!g.brawl?.ordeals?.shituoRedBountyArmed || g.brawl.ordeals.shituoExcludedPlayerId) return;
  const candidateBluePlayers = g.players.filter(p => {
    const pState = g.brawl?.playerStates[p.id];
    return pState?.camp === 'blue' && pState?.roleId !== 'sun_wukong' && p.id !== g.brawl?.dapengExcludedPlayerId;
  });
  if (candidateBluePlayers.length > 0) {
    const excluded = candidateBluePlayers[Math.floor(Math.random() * candidateBluePlayers.length)];
    g.brawl.ordeals.shituoExcludedPlayerId = excluded.id;
    recordBrawlReplayAction(g.brawl, {
      roundNumber: g.rounds.length,
      mission: g.mission,
      phase: 'assassination',
      actorId: '',
      actorSeat: 0,
      actorNickname: '狮驼死战',
      roleId: 'ordeal_system',
      roleName: '狮驼死战',
      skillName: '妖魔重赏',
      targetId: excluded.id,
      targetSeat: excluded.seat,
      targetNickname: excluded.nickname,
      outcome: 'success',
      detail: `狮驼死战红方重赏兑现：终局刺杀阶段为红孩儿额外排除 1 个绝对不是孙悟空的席位：【${excluded.seat}号 · ${excluded.nickname}】！`,
    });
  }
}
function refundArmedMissionSkillsOnProposalAbort(g: GameState, reasonLabel: string) {
  if (!g.brawl) return;
  const roundNumber = g.rounds.at(-1)?.number ?? (g.rounds.length || 1);
  const refundOne = (roleId: string, clearFn: () => void) => {
    const actor = g.players.find(p => hasBrawlSkillRole(g.brawl?.playerStates[p.id], roleId));
    clearFn();
    if (!actor || !g.brawl) return;
    const ps = g.brawl.playerStates[actor.id];
    const roleDef = BRAWL_ROLE_REGISTRY[roleId];
    if (ps) ps.skillUsed = false;
    setBrawlPrivateReceipt(
      g.brawl,
      actor.id,
      `♻️ 因${reasonLabel}未发车，你的【${roleDef?.skill.skillName ?? '法宝'}】已自动退还保留，可在后续出征车队确定后再次施展！`,
    );
    recordBrawlReplayAction(g.brawl, {
      roundNumber,
      mission: g.mission,
      phase: 'team_voting',
      actorId: actor.id,
      actorSeat: actor.seat,
      actorNickname: actor.nickname,
      roleId,
      roleName: roleDef?.name ?? roleId,
      skillName: roleDef?.skill.skillName ?? '法宝',
      outcome: 'miss',
      detail: `因${reasonLabel}未发车，先前蓄力的【${roleDef?.skill.skillName ?? '法宝'}】未消耗并已自动退还保留。`,
    });
  };

  if (g.brawl.guanyinGanluTargetId) refundOne('guanyin_pusa', () => { g.brawl!.guanyinGanluTargetId = undefined; });
  if (g.brawl.jinjiaoHuluTargetId) refundOne('jinjiao_dawang', () => { g.brawl!.jinjiaoHuluTargetId = undefined; });
  if (g.brawl.yutuMihunTargetId) refundOne('yutu_jing', () => { g.brawl!.yutuMihunTargetId = undefined; });
  if (g.brawl.baiyanDuchaTargetId) refundOne('baiyan_mojun', () => { g.brawl!.baiyanDuchaTargetId = undefined; });
  if (g.brawl.taoshouActive) refundOne('wangmu_niangniang', () => { g.brawl!.taoshouActive = false; });
  if (g.brawl.baiguLijianArmed) refundOne('bai_gujing', () => { g.brawl!.baiguLijianArmed = false; });
}

function validateTeamMemberBans(g: GameState, playerIds: string[]) {
  if (g.treasuresState?.humanBag?.activeBannedMission === g.mission && g.treasuresState.humanBag.targetId) {
    requireRule(!playerIds.includes(g.treasuresState.humanBag.targetId), 'PLAYER_BANNED_BY_HUMAN_BAG');
  }
  if (g.brawl?.imprisonedTargetId) {
    requireRule(!playerIds.includes(g.brawl.imprisonedTargetId), 'PLAYER_IMPRISONED_BY_WUXINGSHAN');
  }
  if (g.brawl?.zhizhuBannedTargetId) {
    requireRule(!playerIds.includes(g.brawl.zhizhuBannedTargetId), 'PLAYER_BANNED_BY_ZHIZHU_JING');
  }
  if (g.brawl?.ordeals?.quicksandBannedPlayerId) {
    requireRule(!playerIds.includes(g.brawl.ordeals.quicksandBannedPlayerId), 'PLAYER_BANNED_BY_QUICKSAND');
  }
  if (g.brawl?.wager?.bannedMission === g.mission && g.brawl.wager.bannedPlayerId) {
    requireRule(!playerIds.includes(g.brawl.wager.bannedPlayerId), 'PLAYER_BANNED_BY_WAGER');
  }
  if (getActiveOrdealId(g.brawl?.ordeals, g.mission) === 'selfless_captain') {
    requireRule(!playerIds.includes(captain(g)), 'CAPTAIN_CANNOT_PICK_SELF_SELFLESS');
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
      if (g.phase === 'discussion' && g.brawl?.ordeals?.lastSwap?.roundNumber === g.rounds.at(-1)?.number) {
        throw new RuleError('CANNOT_EDIT_AFTER_CELESTIAL_SWAP');
      }
      const { playerIds, direction } = action.payload as { playerIds: string[]; direction: RoundView['direction'] };
      const maxTeamSize = missionSizesFor(g.players.length, Boolean(g.brawl))[g.mission-1] + (g.brawl?.extraSeatLimit ?? 0);
      requireRule(playerIds.length <= maxTeamSize && new Set(playerIds).size === playerIds.length && playerIds.every(id => g.players.some(p => p.id === id)), 'INVALID_TEAM');
      validateTeamMemberBans(g, playerIds);
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
      const { playerIds, direction, militaryWager } = action.payload as { playerIds: string[]; direction: RoundView['direction']; militaryWager?: boolean };
      const baseTeamSize = missionSizesFor(g.players.length, Boolean(g.brawl))[g.mission-1];
      const maxTeamSize = baseTeamSize + (g.brawl?.extraSeatLimit ?? 0);
      requireRule(playerIds.length <= maxTeamSize && new Set(playerIds).size === playerIds.length && playerIds.every(id => g.players.some(p => p.id === id)), 'INVALID_TEAM');
      validateTeamMemberBans(g, playerIds);

      if (militaryWager) {
        requireRule(canCaptainStakeWager({ brawlEnabled: Boolean(g.brawl), mission: g.mission, ordeals: g.brawl?.ordeals, wager: g.brawl?.wager }), 'WAGER_UNAVAILABLE');
        requireRule(playerIds.includes(userId), 'WAGER_REQUIRES_CAPTAIN_ON_TEAM');
      }

      const roundNumber = g.rounds.length + 1;
      let finalTeam = g.players.filter(p => playerIds.includes(p.id)).map(p => p.id);

      // 八十一难 · 天意篡改：队长提交名单进入论道时，系统公开从未上车的可选玩家中随机抽 1 人与车上 1 人对调
      if (g.brawl && getActiveOrdealId(g.brawl.ordeals, g.mission) === 'celestial_swap' && finalTeam.length >= baseTeamSize) {
        const bannedIds = collectMissionBannedPlayerIds({
          mission: g.mission,
          captainId: userId,
          humanBagBanned: g.treasuresState?.humanBag,
          imprisonedTargetId: g.brawl.imprisonedTargetId,
          zhizhuBannedTargetId: g.brawl.zhizhuBannedTargetId,
          ordeals: g.brawl.ordeals,
          wager: g.brawl.wager,
        });
        const swapped = applyCelestialSwap({
          roundNumber,
          mission: g.mission,
          team: finalTeam,
          players: g.players,
          bannedIds,
          rng: Math.random,
        });
        finalTeam = swapped.newTeam;
        if (swapped.swapRecord && g.brawl.ordeals) {
          g.brawl.ordeals.lastSwap = swapped.swapRecord;
          const sw = swapped.swapRecord;
          appendBattleEvent(
            g.brawl,
            'ordeal_system',
            `【🌀 天意篡改】风云骤变！天道将【${sw.removedSeat}号 · ${sw.removedNickname}】移出队伍，随机换入【${sw.addedSeat}号 · ${sw.addedNickname}】出征！`,
            BRAWL_ORDEAL_REGISTRY.celestial_swap.description,
            'anonymous_broadcast',
          );
          recordBrawlReplayAction(g.brawl, {
            roundNumber,
            mission: g.mission,
            phase: 'team_building',
            actorId: '',
            actorSeat: 0,
            actorNickname: '八十一难奇劫',
            roleId: 'ordeal_system',
            roleName: '天意篡改',
            skillName: '随机对调',
            targetId: sw.addedId,
            targetSeat: sw.addedSeat,
            targetNickname: sw.addedNickname,
            outcome: 'success',
            detail: `天意篡改生效：系统公开将【${sw.removedSeat}号 · ${sw.removedNickname}】移出名单，随机换入【${sw.addedSeat}号 · ${sw.addedNickname}】进入论道！`,
          });
        }
      }

      g.rounds.push({
        number: roundNumber,
        mission: g.mission,
        captainId: userId,
        team: finalTeam,
        direction,
        ...(militaryWager ? { militaryWager: true } : {}),
      });

      if (militaryWager && g.brawl) {
        if (!g.brawl.wager) g.brawl.wager = createInitialWagerState();
        g.brawl.wager.activeRoundNumber = roundNumber;
        g.brawl.wager.activeCaptainId = userId;
        const capP = g.players.find(p => p.id === userId);
        appendBattleEvent(
          g.brawl,
          'wager_system',
          `【📜 立军令状】领队【${capP?.seat}号 · ${capP?.nickname}】立下军令状亲征担保此车！成功将获天眼查验，翻车下难禁选上车！`,
          '领队亲征立下军令状：护经成功获一次私密查验，失败则下一难全程禁选上车。',
          'anonymous_broadcast',
        );
        recordBrawlReplayAction(g.brawl, {
          roundNumber,
          mission: g.mission,
          phase: 'team_building',
          actorId: userId,
          actorSeat: capP?.seat ?? 0,
          actorNickname: capP?.nickname ?? '领队',
          roleId: 'wager_system',
          roleName: '取经军令状',
          skillName: '立军令状',
          outcome: 'info',
          detail: `领队【${capP?.seat}号 · ${capP?.nickname}】立下军令状亲征担保第 ${g.mission} 难出征阵容！`,
        });
      }

      delete g.draftTeam;
      g.phase = 'discussion'; g.teamVotes = {}; g.missionVotes = {};
      break;
    }
    case 'startTeamVote': {
      requireRule(g.phase === 'discussion', 'WRONG_PHASE');
      requireRule(userId === captain(g), 'NOT_CAPTAIN');
      const baseTeamSize = missionSizesFor(g.players.length, Boolean(g.brawl))[g.mission-1];
      const maxTeamSize = baseTeamSize + (g.brawl?.extraSeatLimit ?? 0);
      const currentRound = g.rounds.at(-1)!;
      const teamLen = currentRound.team.length;
      requireRule(teamLen >= baseTeamSize && teamLen <= maxTeamSize, 'INVALID_TEAM');
      delete g.draftTeam;

      // 乱斗固定底盘规则【两流必发】：流局 2 次后，第 3 轮跳过表决强制发车直接出征！
      if (g.brawl && g.rejectionCount >= BRAWL_MAX_REJECTIONS_BEFORE_FORCE) {
        currentRound.vote = { approvals: 0, rejections: 0, abstentions: 0, passed: true, forced: true };
        g.teamVotes = {};
        g.brawl.doubleVoteUserId = undefined;
        g.brawl.yishanTargetId = undefined;
        delete g.bananaFanNotice;
        appendBattleEvent(
          g.brawl,
          'ordeal_system',
          `【🔥 两流必发】本难已流局 ${BRAWL_MAX_REJECTIONS_BEFORE_FORCE} 次，第 3 轮跳过组队表决，强制发车直接出征！`,
          '大乱斗基础规则：每难流局 2 次后，第 3 轮跳过表决直接发车出征。',
          'anonymous_broadcast',
        );
        g.phase = 'mission';
        break;
      }

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
          const shaPassed = Math.random() < BRAWL_SKILL_PROBS.SHA_PASS;
          const shaPlayer = g.players.find(p => hasBrawlSkillRole(g.brawl?.playerStates[p.id], 'sha_wujing'));
          if (shaPassed) {
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
          setBrawlPrivateReceipt(
            g.brawl,
            shaPlayer?.id,
            shaPassed
              ? `🌊 第 ${g.mission} 难降妖宝杖定海显圣（50% 命中）：已强行将流局反转为发车通过！`
              : `🌊 第 ${g.mission} 难降妖宝杖定海触发（50% 未命中）：风波势大未能平息，仍旧流局。`,
          );
          recordBrawlReplayAction(g.brawl, {
            roundNumber: g.rounds.at(-1)?.number ?? g.rounds.length,
            mission: g.mission,
            phase: 'team_voting',
            actorId: shaPlayer?.id ?? '',
            actorSeat: shaPlayer?.seat ?? 0,
            actorNickname: shaPlayer?.nickname ?? '沙悟净',
            roleId: 'sha_wujing',
            roleName: '沙悟净',
            skillName: '降妖宝杖',
            outcome: shaPassed ? 'success' : 'miss',
            detail: shaPassed
              ? '表决流局时祭起降妖宝杖定海神威（50% 概率命中）：强行镇压反转为发车通过！'
              : '表决流局时祭起降妖宝杖定海（50% 概率未命中）：未能逆转流局。',
          });
        }

        // 猪八戒【倒打一耙】：组队表决未通过时倒打一耙，强制将全场最后 1 张反对票反转为赞成票！
        if (!passed && rejections > 0 && g.brawl?.zhubajieDaodaArmed) {
          g.brawl.zhubajieDaodaArmed = false;
          rejections -= 1;
          approvals += 1;
          const zhuPlayer = g.players.find(p => hasBrawlSkillRole(g.brawl?.playerStates[p.id], 'zhu_bajie'));
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
          setBrawlPrivateReceipt(
            g.brawl,
            zhuPlayer?.id,
            passed
              ? `🌾 第 ${g.mission} 难倒打一耙逆风翻盘：已反转 1 张反对票为赞成票（${approvals}:${rejections}），护送车队发车！`
              : `🌾 第 ${g.mission} 难倒打一耙已触发：反转 1 张反对票后票数为 ${approvals}:${rejections}，赞成仍未过半维持流局。`,
          );
          recordBrawlReplayAction(g.brawl, {
            roundNumber: g.rounds.at(-1)?.number ?? g.rounds.length,
            mission: g.mission,
            phase: 'team_voting',
            actorId: zhuPlayer?.id ?? '',
            actorSeat: zhuPlayer?.seat ?? 0,
            actorNickname: zhuPlayer?.nickname ?? '猪八戒',
            roleId: 'zhu_bajie',
            roleName: '猪八戒',
            skillName: '倒打一耙',
            outcome: 'success',
            detail: `组队表决未通过时倒打一耙，强制将 1 张反对票反转为赞成票（反转后赞成 ${approvals} / 反对 ${rejections}）！最终结果：${passed ? '逆风翻盘组队通过！' : '赞成仍未过半，维持流局。'}`,
          });
        }

        g.rounds.at(-1)!.vote = { approvals, rejections, abstentions, passed,
          ...(!g.settings.anonymousTeamVote ? { ballots: { ...g.teamVotes } } : {}) };
        if (g.brawl) {
          if (g.brawl.doubleVoteUserId) {
            const dvId = g.brawl.doubleVoteUserId;
            const dvP = g.players.find(p => p.id === dvId);
            const dvBallot = g.teamVotes[dvId];
            const dvLabel = dvBallot === true ? '赞成 ×2' : dvBallot === false ? '反对 ×2' : '弃权 ×2';
            const dvRole = getEffectiveSkillRole(g.brawl.playerStates[dvId]);
            setBrawlPrivateReceipt(
              g.brawl,
              dvId,
              `🔥 第 ${g.mission} 难双倍表决已结算：你投出【${dvLabel}】，最终票型赞成 ${approvals} / 反对 ${rejections}（${passed ? '组队通过' : '表决流局'}）。`,
            );
            recordBrawlReplayAction(g.brawl, {
              roundNumber: g.rounds.at(-1)?.number ?? g.rounds.length,
              mission: g.mission,
              phase: 'team_voting',
              actorId: dvId,
              actorSeat: dvP?.seat ?? 0,
              actorNickname: dvP?.nickname ?? dvRole?.name ?? '神魔',
              roleId: dvRole?.id ?? 'nezha',
              roleName: dvRole?.name ?? '双票神通',
              skillName: dvRole?.skill.skillName ?? '双倍表决',
              outcome: 'success',
              detail: `双倍表决权生效：投出【${dvLabel}】，本轮表决最终赞成 ${approvals} / 反对 ${rejections}（${passed ? '组队通过' : '表决流局'}）。`,
            });
          }
          g.brawl.doubleVoteUserId = undefined;
          g.brawl.yishanTargetId = undefined;
        }
        g.teamVotes = {};
        if (passed) {
          if (g.treasuresState?.bananaFan?.armed) {
            g.treasuresState.bananaFan.used = true;
            g.treasuresState.bananaFan.armed = false;
            g.bananaFanNotice = `第 ${g.rounds.at(-1)!.number} 轮组队投票通过，但牛魔王祭起【芭蕉神扇】狂风呼啸！本次发车被强行吹散，由下一任队长重新组队！`;
            rotate(g);
            openEarlyWindowOrPropose(g);
          } else {
            delete g.bananaFanNotice;
            if (hasUnusedGuanyin(g)) {
              g.phase = 'guanyin_window';
              g.guanyinEndsAt = new Date(context.now + GUANYIN_WINDOW_MS).toISOString();
            } else {
              g.phase = 'mission';
            }
          }
        } else {
          delete g.bananaFanNotice;
          if (g.brawl?.wager && g.brawl.wager.activeRoundNumber === g.rounds.at(-1)?.number) {
            g.brawl.wager.activeRoundNumber = undefined;
            g.brawl.wager.activeCaptainId = undefined;
          }
          refundArmedMissionSkillsOnProposalAbort(g, '组队表决流局');
          g.rejectionCount++;
          if (!g.brawl && g.rejectionCount >= 5) finish(g, { winner: 'red', reason: 'five_rejections' });
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

        // 金角大王【紫金葫芦】：若选定队员在车上并投了成功，60% 概率被宝葫芦化解吸收为失败
        if (g.brawl?.jinjiaoHuluTargetId) {
          const targetId = g.brawl.jinjiaoHuluTargetId;
          const targetP = g.players.find(p => p.id === targetId);
          const jinjiaoPlayer = g.players.find(p => hasBrawlSkillRole(g.brawl?.playerStates[p.id], 'jinjiao_dawang'));

          if (!round.team.includes(targetId)) {
            // 目标不在车上：技能直接落空，绝不转嫁给其他好人
            if (targetP) {
              g.brawl.jinjiaoResult = {
                targetSeat: targetP.seat,
                targetNickname: targetP.nickname,
                absorbed: false,
                notOnTeam: true,
              };
            }
            recordBrawlReplayAction(g.brawl, {
              roundNumber: round.number,
              mission: g.mission,
              phase: 'mission_resolved',
              actorId: jinjiaoPlayer?.id ?? '',
              actorSeat: jinjiaoPlayer?.seat ?? 0,
              actorNickname: jinjiaoPlayer?.nickname ?? '金角大王',
              roleId: 'jinjiao_dawang',
              roleName: '金角大王',
              skillName: '紫金葫芦',
              targetId: targetP?.id,
              targetSeat: targetP?.seat,
              targetNickname: targetP?.nickname,
              outcome: 'miss',
              detail: `所选目标【${targetP?.seat}号 · ${targetP?.nickname}】未随队出征，紫金红葫芦吸空未能生效。`,
            });
          } else {
            const targetVotedSuccess = g.missionVotes[targetId];
            const absorbed = targetVotedSuccess && Math.random() < BRAWL_SKILL_PROBS.JINJIAO_ABSORB;
            if (absorbed) {
              failures += 1;
              successes = Math.max(0, successes - 1);
              appendBattleEvent(
                g.brawl,
                'jinjiao_dawang',
                `【金角大王】紫金红葫芦灵光大盛！出征队伍中 1 名仙友的浩然正气被宝葫芦暗中化解吸收！`,
                '手机私密选定出征队员 1 人，若其投成功，60% 概率被葫芦化解吸收。',
              );
            }
            if (targetP) {
              g.brawl.jinjiaoResult = {
                targetSeat: targetP.seat,
                targetNickname: targetP.nickname,
                absorbed: Boolean(absorbed),
              };
            }
            recordBrawlReplayAction(g.brawl, {
              roundNumber: round.number,
              mission: g.mission,
              phase: 'mission_resolved',
              actorId: jinjiaoPlayer?.id ?? '',
              actorSeat: jinjiaoPlayer?.seat ?? 0,
              actorNickname: jinjiaoPlayer?.nickname ?? '金角大王',
              roleId: 'jinjiao_dawang',
              roleName: '金角大王',
              skillName: '紫金葫芦',
              targetId: targetP?.id,
              targetSeat: targetP?.seat,
              targetNickname: targetP?.nickname,
              outcome: absorbed ? 'success' : 'miss',
              detail: absorbed
                ? `紫金红葫芦神威显圣（60% 概率命中）：暗中化解吸收了【${targetP?.seat}号 · ${targetP?.nickname}】投出的 1 张成功牌！`
                : (targetVotedSuccess
                  ? `紫金红葫芦判定未命中（60% 概率未生效）：未能化解【${targetP?.seat}号 · ${targetP?.nickname}】的成功牌。`
                  : `所选目标【${targetP?.seat}号 · ${targetP?.nickname}】未投出成功牌，紫金红葫芦未能化解吸收。`),
            });
          }
          g.brawl.jinjiaoHuluTargetId = undefined;
        }

        // 玉兔精【捣药迷魂】：若选定队员在车上并投了成功，50% 概率成功牌被封印弃权
        if (g.brawl?.yutuMihunTargetId) {
          const targetId = g.brawl.yutuMihunTargetId;
          const targetP = g.players.find(p => p.id === targetId);
          const yutuPlayer = g.players.find(p => hasBrawlSkillRole(g.brawl?.playerStates[p.id], 'yutu_jing'));

          if (!round.team.includes(targetId)) {
            // 目标不在车上：技能直接落空，绝不转嫁给其他好人
            if (targetP) {
              g.brawl.yutuResult = {
                targetSeat: targetP.seat,
                targetNickname: targetP.nickname,
                discarded: false,
                notOnTeam: true,
              };
            }
            recordBrawlReplayAction(g.brawl, {
              roundNumber: round.number,
              mission: g.mission,
              phase: 'mission_resolved',
              actorId: yutuPlayer?.id ?? '',
              actorSeat: yutuPlayer?.seat ?? 0,
              actorNickname: yutuPlayer?.nickname ?? '玉兔精',
              roleId: 'yutu_jing',
              roleName: '玉兔精',
              skillName: '捣药迷魂',
              targetId: targetP?.id,
              targetSeat: targetP?.seat,
              targetNickname: targetP?.nickname,
              outcome: 'miss',
              detail: `所选目标【${targetP?.seat}号 · ${targetP?.nickname}】未随队出征，捣药迷魂未能生效。`,
            });
          } else {
            const targetVotedSuccess = g.missionVotes[targetId];
            const discarded = targetVotedSuccess && Math.random() < BRAWL_SKILL_PROBS.YUTU_DISCARD;
            if (discarded) {
              failures += 1;
              successes = Math.max(0, successes - 1);
              appendBattleEvent(
                g.brawl,
                'yutu_jing',
                `【玉兔精】广寒仙药捣药迷魂！出征队伍中受迷香干扰，1 名仙友的成功神力被封印化解！`,
                '队伍敲定后暗中迷魂车上 1 名好人，其出征时 50% 概率成功牌被封印弃权。',
              );
            }
            if (targetP) {
              g.brawl.yutuResult = {
                targetSeat: targetP.seat,
                targetNickname: targetP.nickname,
                discarded: Boolean(discarded),
              };
            }
            recordBrawlReplayAction(g.brawl, {
              roundNumber: round.number,
              mission: g.mission,
              phase: 'mission_resolved',
              actorId: yutuPlayer?.id ?? '',
              actorSeat: yutuPlayer?.seat ?? 0,
              actorNickname: yutuPlayer?.nickname ?? '玉兔精',
              roleId: 'yutu_jing',
              roleName: '玉兔精',
              skillName: '捣药迷魂',
              targetId: targetP?.id,
              targetSeat: targetP?.seat,
              targetNickname: targetP?.nickname,
              outcome: discarded ? 'success' : 'miss',
              detail: discarded
                ? `捣药迷魂生效（50% 概率命中）：迷魂封印了【${targetP?.seat}号 · ${targetP?.nickname}】投出的成功牌（强制弃权作废）！`
                : (targetVotedSuccess
                  ? `捣药迷魂判定未命中（50% 概率未生效）：未能迷魂封印【${targetP?.seat}号 · ${targetP?.nickname}】。`
                  : `所选目标【${targetP?.seat}号 · ${targetP?.nickname}】未投出成功牌，捣药迷魂未能封印。`),
            });
          }
          g.brawl.yutuMihunTargetId = undefined;
        }

        // 百眼魔君【黄花毒茶】：若选定队员在车上并投了成功，大车(>=4人)60%/小车(<=3人)50%概率被毒化反转为失败牌！
        if (g.brawl?.baiyanDuchaTargetId) {
          const targetId = g.brawl.baiyanDuchaTargetId;
          const targetP = g.players.find(p => p.id === targetId);
          const baiyanPlayer = g.players.find(p => hasBrawlSkillRole(g.brawl?.playerStates[p.id], 'baiyan_mojun'));

          if (!round.team.includes(targetId)) {
            // 目标不在车上：技能直接落空，绝不转嫁给其他好人
            g.brawl.baiyanDuchaResult = false;
            g.brawl.baiyanDuchaNotOnTeam = true;
            recordBrawlReplayAction(g.brawl, {
              roundNumber: round.number,
              mission: g.mission,
              phase: 'mission_resolved',
              actorId: baiyanPlayer?.id ?? '',
              actorSeat: baiyanPlayer?.seat ?? 0,
              actorNickname: baiyanPlayer?.nickname ?? '百眼魔君',
              roleId: 'baiyan_mojun',
              roleName: '百眼魔君',
              skillName: '黄花毒茶',
              targetId: targetP?.id,
              targetSeat: targetP?.seat,
              targetNickname: targetP?.nickname,
              outcome: 'miss',
              detail: `下毒目标【${targetP?.seat}号 · ${targetP?.nickname}】未随队出征，黄花毒茶未能生效。`,
            });
          } else {
            const targetVotedSuccess = g.missionVotes[targetId];
            const isBig = round.team.length >= 4;
            const chance = isBig ? BRAWL_SKILL_PROBS.BAIYAN_BIG_TEAM : BRAWL_SKILL_PROBS.BAIYAN_SMALL_TEAM;
            const poisoned = targetVotedSuccess && Math.random() < chance;
            if (poisoned) {
              failures += 1;
              successes = Math.max(0, successes - 1);
              g.brawl.baiyanDuchaResult = true;
            } else {
              g.brawl.baiyanDuchaResult = false;
            }
            recordBrawlReplayAction(g.brawl, {
              roundNumber: round.number,
              mission: g.mission,
              phase: 'mission_resolved',
              actorId: baiyanPlayer?.id ?? '',
              actorSeat: baiyanPlayer?.seat ?? 0,
              actorNickname: baiyanPlayer?.nickname ?? '百眼魔君',
              roleId: 'baiyan_mojun',
              roleName: '百眼魔君',
              skillName: '黄花毒茶',
              targetId: targetP?.id,
              targetSeat: targetP?.seat,
              targetNickname: targetP?.nickname,
              outcome: poisoned ? 'success' : 'miss',
              detail: poisoned
                ? `黄花毒茶毒发成功（${isBig ? '大车 60%' : '小车 50%'} 概率命中）：暗中将【${targetP?.seat}号 · ${targetP?.nickname}】投出的【成功牌】静默毒化为【失败牌】！导致本轮出征翻车！`
                : (targetVotedSuccess
                  ? `黄花毒茶未能毒发（${isBig ? '大车 60%' : '小车 50%'} 概率未命中）：【${targetP?.seat}号 · ${targetP?.nickname}】未受毒化影响。`
                  : `下毒目标【${targetP?.seat}号 · ${targetP?.nickname}】未投出成功牌，黄花毒茶未生效。`),
            });
          }
          g.brawl.baiyanDuchaTargetId = undefined;
        }

        // 白骨精【画皮离间】：本轮任务出征若失败，静默虚增 1 张失败牌引车内好人自相残杀！
        if (g.brawl?.baiguLijianArmed) {
          g.brawl.baiguLijianArmed = false;
          const baiguPlayer = g.players.find(p => hasBrawlSkillRole(g.brawl?.playerStates[p.id], 'bai_gujing'));
          if (failures > 0) {
            failures += 1;
            successes = Math.max(0, successes - 1);
            g.brawl.baiguLijianResult = true;
            setBrawlPrivateReceipt(
              g.brawl,
              baiguPlayer?.id,
              `💀 第 ${g.mission} 难画皮离间得逞：战报已静默虚增 1 张失败牌（实 ${failures - 1} 败 → 显 ${failures} 败）！`,
            );
            recordBrawlReplayAction(g.brawl, {
              roundNumber: round.number,
              mission: g.mission,
              phase: 'mission_resolved',
              actorId: baiguPlayer?.id ?? '',
              actorSeat: baiguPlayer?.seat ?? 0,
              actorNickname: baiguPlayer?.nickname ?? '白骨精',
              roleId: 'bai_gujing',
              roleName: '白骨精',
              skillName: '画皮离间',
              outcome: 'success',
              detail: `画皮离间魔功得逞：出征战报静默虚增 1 张失败牌（实际失败牌数 ${failures - 1}，虚增后展示为 ${failures} 张），成功引车内好人同室操戈！`,
            });
          } else {
            setBrawlPrivateReceipt(
              g.brawl,
              baiguPlayer?.id,
              `💀 第 ${g.mission} 难全员投出成功牌，离间魔骨无失败牌可借势，本次未能触发虚增。`,
            );
            recordBrawlReplayAction(g.brawl, {
              roundNumber: round.number,
              mission: g.mission,
              phase: 'mission_resolved',
              actorId: baiguPlayer?.id ?? '',
              actorSeat: baiguPlayer?.seat ?? 0,
              actorNickname: baiguPlayer?.nickname ?? '白骨精',
              roleId: 'bai_gujing',
              roleName: '白骨精',
              skillName: '画皮离间',
              outcome: 'miss',
              detail: '本难出征全员投出成功牌（0 张失败牌），离间魔骨未能借势虚增。',
            });
          }
          // 静默生效，绝不生成公屏战报，彻底避免自爆！
        }

        // 王母娘娘【九转仙桃】：出征前赐仙桃护体，本轮任务若出现失败牌，50% 概率当场化解赦免 1 张失败牌！
        if (g.brawl?.taoshouActive) {
          g.brawl.taoshouActive = false;
          const wangmuPlayer = g.players.find(p => hasBrawlSkillRole(g.brawl?.playerStates[p.id], 'wangmu_niangniang'));
          if (failures > 0) {
            const taoSuccess = Math.random() < BRAWL_SKILL_PROBS.WANGMU_PARDON;
            if (taoSuccess) {
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
            setBrawlPrivateReceipt(
              g.brawl,
              wangmuPlayer?.id,
              taoSuccess
                ? `🍑 第 ${g.mission} 难九转仙桃显圣（50% 命中）：已当场化解赦免 1 张失败牌！`
                : `🍑 第 ${g.mission} 难九转仙桃触发（50% 未命中）：未能抵消队伍中的失败牌。`,
            );
            recordBrawlReplayAction(g.brawl, {
              roundNumber: round.number,
              mission: g.mission,
              phase: 'mission_resolved',
              actorId: wangmuPlayer?.id ?? '',
              actorSeat: wangmuPlayer?.seat ?? 0,
              actorNickname: wangmuPlayer?.nickname ?? '王母娘娘',
              roleId: 'wangmu_niangniang',
              roleName: '王母娘娘',
              skillName: '九转仙桃',
              outcome: taoSuccess ? 'success' : 'miss',
              detail: taoSuccess
                ? '九转仙桃仙气护体（50% 概率命中）：出征战报当场化解赦免了队伍中的 1 张失败牌！'
                : '九转仙桃护体判定未命中（50% 概率）：劫数深重未能抵消失败牌。',
            });
          } else {
            setBrawlPrivateReceipt(
              g.brawl,
              wangmuPlayer?.id,
              `🍑 第 ${g.mission} 难全员投出成功牌，九转仙桃平安护体无需化解失败牌。`,
            );
            recordBrawlReplayAction(g.brawl, {
              roundNumber: round.number,
              mission: g.mission,
              phase: 'mission_resolved',
              actorId: wangmuPlayer?.id ?? '',
              actorSeat: wangmuPlayer?.seat ?? 0,
              actorNickname: wangmuPlayer?.nickname ?? '王母娘娘',
              roleId: 'wangmu_niangniang',
              roleName: '王母娘娘',
              skillName: '九转仙桃',
              outcome: 'miss',
              detail: '本难出征全员投出成功牌（0 张失败牌），九转仙桃护体未遇败牌无需触发。',
            });
          }
        }

        let passed = failures < failuresRequired(g);

        // 玉皇大帝【天尊玉旨】：任务失败时降旨赦免（1败 60% 概率逆转，2败 30% 概率逆转）
        if (!passed && failures > 0 && g.brawl?.yuhuangYuzhiArmed) {
          g.brawl.yuhuangYuzhiArmed = false;
          const failuresBefore = failures;
          const pardonChance = failures === 1 ? BRAWL_SKILL_PROBS.YUHUANG_ONE_FAIL : (failures === 2 ? BRAWL_SKILL_PROBS.YUHUANG_TWO_FAIL : 0);
          const yuhuangSuccess = pardonChance > 0 && Math.random() < pardonChance;
          const yuhuangPlayer = g.players.find(p => hasBrawlSkillRole(g.brawl?.playerStates[p.id], 'yuhuang_dadi'));
          if (yuhuangSuccess) {
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
          setBrawlPrivateReceipt(
            g.brawl,
            yuhuangPlayer?.id,
            yuhuangSuccess
              ? `📜 第 ${g.mission} 难天尊玉旨显圣（${failuresBefore}败 · ${Math.round(pardonChance * 100)}%命中）：已将本次溃败绝境逆转为大获全胜！`
              : `📜 第 ${g.mission} 难天尊玉旨触发（${failuresBefore}败 · ${Math.round(pardonChance * 100)}%概率未命中）：未能化解此次失败。`,
          );
          recordBrawlReplayAction(g.brawl, {
            roundNumber: round.number,
            mission: g.mission,
            phase: 'mission_resolved',
            actorId: yuhuangPlayer?.id ?? '',
            actorSeat: yuhuangPlayer?.seat ?? 0,
            actorNickname: yuhuangPlayer?.nickname ?? '玉皇大帝',
            roleId: 'yuhuang_dadi',
            roleName: '玉皇大帝',
            skillName: '天尊玉旨',
            outcome: yuhuangSuccess ? 'success' : 'miss',
            detail: yuhuangSuccess
              ? `天尊降旨赦免此难劫数（${failuresBefore}败 · ${Math.round(pardonChance * 100)}%命中）：三界至尊金口御言，将本次出征溃败绝境逆转为【大获全胜】！`
              : `天尊降旨（${failuresBefore}败 · ${Math.round(pardonChance * 100)}%未命中）：群妖势大劫数难消，未能化解此次失败。`,
          });
        }

        // 观音菩萨【净瓶甘露】：若洒甘露者随队出征，100% 私密获知该人是否投了成功（未出征则反馈未生效）
        if (g.brawl?.guanyinGanluTargetId) {
          const targetId = g.brawl.guanyinGanluTargetId;
          const targetP = g.players.find(p => p.id === targetId);
          const guanyinPlayer = g.players.find(p => hasBrawlSkillRole(g.brawl?.playerStates[p.id], 'guanyin_pusa'));
          if (round.team.includes(targetId)) {
            const targetVote = g.missionVotes[targetId];
            g.brawl.guanyinGanluResult = {
              targetId,
              targetSuccess: Boolean(targetVote),
            };
            setBrawlPrivateReceipt(
              g.brawl,
              guanyinPlayer?.id,
              `🪷 第 ${g.mission} 难净瓶甘露显圣：目标【${targetP?.seat}号 · ${targetP?.nickname}】真实投出了【${targetVote ? '成功牌 🟢' : '失败牌 🔴'}】！`,
            );
            recordBrawlReplayAction(g.brawl, {
              roundNumber: round.number,
              mission: g.mission,
              phase: 'mission_resolved',
              actorId: guanyinPlayer?.id ?? '',
              actorSeat: guanyinPlayer?.seat ?? 0,
              actorNickname: guanyinPlayer?.nickname ?? '观音菩萨',
              roleId: 'guanyin_pusa',
              roleName: '观音菩萨',
              skillName: '净瓶甘露',
              targetId: targetP?.id,
              targetSeat: targetP?.seat,
              targetNickname: targetP?.nickname,
              outcome: 'info',
              detail: `净瓶甘露显圣验人：私密探查【${targetP?.seat}号 · ${targetP?.nickname}】的出征票，得悉其真实投票为【${targetVote ? '成功牌' : '失败牌'}】！`,
            });
          } else {
            g.brawl.guanyinGanluNotOnTeam = targetId;
            setBrawlPrivateReceipt(
              g.brawl,
              guanyinPlayer?.id,
              `🪷 第 ${g.mission} 难净瓶甘露未能显圣：目标【${targetP?.seat}号 · ${targetP?.nickname}】未随队出征，甘露未被饮用。`,
            );
            recordBrawlReplayAction(g.brawl, {
              roundNumber: round.number,
              mission: g.mission,
              phase: 'mission_resolved',
              actorId: guanyinPlayer?.id ?? '',
              actorSeat: guanyinPlayer?.seat ?? 0,
              actorNickname: guanyinPlayer?.nickname ?? '观音菩萨',
              roleId: 'guanyin_pusa',
              roleName: '观音菩萨',
              skillName: '净瓶甘露',
              targetId: targetP?.id,
              targetSeat: targetP?.seat,
              targetNickname: targetP?.nickname,
              outcome: 'miss',
              detail: `洒甘露目标【${targetP?.seat}号 · ${targetP?.nickname}】未随队出征，净瓶甘露未能显圣。`,
            });
          }
          g.brawl.guanyinGanluTargetId = undefined;
        }

        const activeOrdealId = getActiveOrdealId(g.brawl?.ordeals, g.mission);
        const isChaoticFog = activeOrdealId === 'chaotic_fog';
        round.result = { successes, failures, passed, ...(isChaoticFog ? { masked: true } : {}) };
        g.missionVotes = {};

        // 结算【军令状】：成功兑现私密查验（全局限量 1 次）；翻车下难全程禁选上车
        if (g.brawl?.wager?.activeRoundNumber === round.number && g.brawl.wager.activeCaptainId) {
          const capId = g.brawl.wager.activeCaptainId;
          const capP = g.players.find(p => p.id === capId);
          if (passed) {
            g.brawl.wager.redeemedCount += 1;
            g.brawl.wager.pendingInspectorId = capId;
            appendBattleEvent(
              g.brawl,
              'wager_system',
              `【📜 军令状兑现】领队【${capP?.seat}号 · ${capP?.nickname}】不负众望护经成功，获赐 1 次私密天眼查验特权！`,
              '军令状成功兑现：领队可在真身面板私密查验任意 1 名仙友阵营（整局限量 1 次）。',
              'anonymous_broadcast',
            );
            recordBrawlReplayAction(g.brawl, {
              roundNumber: round.number,
              mission: g.mission,
              phase: 'mission_resolved',
              actorId: capId,
              actorSeat: capP?.seat ?? 0,
              actorNickname: capP?.nickname ?? '领队',
              roleId: 'wager_system',
              roleName: '取经军令状',
              skillName: '军令状兑现',
              outcome: 'success',
              detail: `领队【${capP?.seat}号 · ${capP?.nickname}】立军令状护经成功，获得 1 次私密天眼查验特权！`,
            });
          } else {
            g.brawl.wager.bannedPlayerId = capId;
            g.brawl.wager.bannedMission = g.mission + 1;
            appendBattleEvent(
              g.brawl,
              'wager_system',
              `【📜 军令状受罚】此车翻覆！领队【${capP?.seat}号 · ${capP?.nickname}】识人不明受罚，下一难全程禁止入选出征队伍！`,
              '军令状翻车受罚：领队下一难强制禁选上车（即使为好人亦须受罚）。',
              'anonymous_broadcast',
            );
            recordBrawlReplayAction(g.brawl, {
              roundNumber: round.number,
              mission: g.mission,
              phase: 'mission_resolved',
              actorId: capId,
              actorSeat: capP?.seat ?? 0,
              actorNickname: capP?.nickname ?? '领队',
              roleId: 'wager_system',
              roleName: '取经军令状',
              skillName: '军令状受罚',
              outcome: 'miss',
              detail: `领队【${capP?.seat}号 · ${capP?.nickname}】军令状翻车，第 ${g.mission + 1} 难全程禁止入选出征阵容！`,
            });
          }
          g.brawl.wager.activeRoundNumber = undefined;
          g.brawl.wager.activeCaptainId = undefined;
        }

        // 结算【八十一难 · 狮驼死战】：保持 1 分计分，胜方斩获高价值赏罚
        if (g.brawl?.ordeals && activeOrdealId === 'shituo_bounty') {
          if (passed) {
            const redStates = Object.values(g.brawl.playerStates).filter(ps => ps.camp === 'red');
            const nonCoreReds = redStates.filter(ps => !BRAWL_ROLE_REGISTRY[ps.roleId]?.isCore);
            let revealedName: string | undefined;
            if (nonCoreReds.length > 0) {
              const chosen = nonCoreReds[Math.floor(Math.random() * nonCoreReds.length)];
              revealedName = BRAWL_ROLE_REGISTRY[chosen.roleId]?.name;
            } else {
              const bonusRedIds = redStates.map(ps => ps.bonusRoleId).filter((id): id is string => Boolean(id));
              if (bonusRedIds.length > 0) {
                const chosenId = bonusRedIds[Math.floor(Math.random() * bonusRedIds.length)];
                revealedName = `${BRAWL_ROLE_REGISTRY[chosenId]?.name}（附带妖宝）`;
              } else if (redStates.length > 0) {
                revealedName = BRAWL_ROLE_REGISTRY[redStates[0].roleId]?.name;
              }
            }
            if (revealedName) {
              g.brawl.ordeals.shituoRevealedDemonName = revealedName;
              appendBattleEvent(
                g.brawl,
                'ordeal_system',
                `【🦁 狮驼死战 · 仙家重赏】蓝方守住险关！天机洞开：本局红方妖魔阵营暗藏【${revealedName}】！`,
                BRAWL_ORDEAL_REGISTRY.shituo_bounty.description,
                'anonymous_broadcast',
              );
              recordBrawlReplayAction(g.brawl, {
                roundNumber: round.number,
                mission: g.mission,
                phase: 'mission_resolved',
                actorId: '',
                actorSeat: 0,
                actorNickname: '狮驼死战',
                roleId: 'ordeal_system',
                roleName: '狮驼死战',
                skillName: '仙家重赏',
                outcome: 'success',
                detail: `蓝方攻克狮驼死战，系统公屏揭露本局在场妖魔名号：【${revealedName}】！`,
              });
            }
          } else {
            g.brawl.ordeals.shituoRedBountyArmed = true;
            appendBattleEvent(
              g.brawl,
              'ordeal_system',
              `【🦁 狮驼死战 · 妖魔重赏】红方攻破险关！若进入终局刺杀，红孩儿将额外自动排除 1 名非孙悟空席位！`,
              BRAWL_ORDEAL_REGISTRY.shituo_bounty.description,
              'anonymous_broadcast',
            );
            recordBrawlReplayAction(g.brawl, {
              roundNumber: round.number,
              mission: g.mission,
              phase: 'mission_resolved',
              actorId: '',
              actorSeat: 0,
              actorNickname: '狮驼死战',
              roleId: 'ordeal_system',
              roleName: '狮驼死战',
              skillName: '妖魔重赏',
              outcome: 'success',
              detail: '红方攻破狮驼死战，终局刺杀自动排除 1 名非大圣席位的重赏已蓄力待命！',
            });
          }
        }

        const completed = g.rounds.filter(r => r.result), passedMissions = completed.filter(r => r.result!.passed).length;
        if (completed.length-passedMissions >= 3) finish(g, { winner: 'red', reason: 'three_failures' });
        else if (passedMissions >= 3) {
          g.phase = 'assassination';
          g.assassinationMode = 'normal';
          if (g.brawl?.dapengArmed) triggerDapengExclude(g);
          if (g.brawl?.ordeals?.shituoRedBountyArmed) triggerShituoExclude(g);
        }
        else {
          g.mission++; rotate(g);
          if (g.brawl) {
            resetRoundBrawlEffects(g.brawl);
            // 乱斗模式每难必重置流局计数（两流必发按单难独立计算）
            g.rejectionCount = 0;
            const nextBaseSize = missionSizesFor(g.players.length, true)[g.mission - 1];
            const ordealAdvance = advanceMissionOrdeals({
              mission: g.mission,
              captainId: captain(g),
              players: g.players,
              previousMissionTeam: round.team,
              baseTeamSize: nextBaseSize,
              ordeals: g.brawl.ordeals,
              wager: g.brawl.wager,
              rng: Math.random,
            });
            if (ordealAdvance.ordealId) {
              const def = BRAWL_ORDEAL_REGISTRY[ordealAdvance.ordealId];
              const extraNote = ordealAdvance.quicksandBanned
                ? `【${ordealAdvance.quicksandBanned.seat}号 · ${ordealAdvance.quicksandBanned.nickname}】不幸陷入流沙，本难禁止入选车队！`
                : '';
              appendBattleEvent(
                g.brawl,
                'ordeal_system',
                `【第 ${g.mission} 难 · ${def.icon} ${def.name}】${extraNote || def.description}`,
                def.tagline,
                'anonymous_broadcast',
              );
              recordBrawlReplayAction(g.brawl, {
                roundNumber: g.rounds.length + 1,
                mission: g.mission,
                phase: 'team_building',
                actorId: '',
                actorSeat: 0,
                actorNickname: '八十一难奇劫',
                roleId: 'ordeal_system',
                roleName: def.name,
                skillName: `第 ${g.mission} 难法则`,
                targetId: ordealAdvance.quicksandBanned?.id,
                targetSeat: ordealAdvance.quicksandBanned?.seat,
                targetNickname: ordealAdvance.quicksandBanned?.nickname,
                outcome: 'info',
                detail: `第 ${g.mission} 难翻开奇劫【${def.name}】：${extraNote || def.description}`,
              });
            }
          } else if (g.settings.rejectionScope === 'mission') {
            g.rejectionCount = 0;
          }
          openEarlyWindowOrPropose(g);
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
        if (g.brawl?.ordeals?.shituoRedBountyArmed) triggerShituoExclude(g);
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
      if (g.brawl) {
        const assassinPlayer = g.players.find(p => p.id === userId);
        const targetPlayer = g.players.find(p => p.id === targetId);
        const targetBrawlRole = g.brawlRoles?.[targetId]
          ? BRAWL_ROLE_REGISTRY[g.brawlRoles[targetId]]?.name
          : undefined;
        recordBrawlReplayAction(g.brawl, {
          roundNumber: g.rounds.length,
          mission: g.mission,
          phase: 'assassination',
          actorId: userId,
          actorSeat: assassinPlayer?.seat ?? 0,
          actorNickname: assassinPlayer?.nickname ?? '红孩儿',
          roleId: 'hong_haier',
          roleName: '红孩儿',
          skillName: '三昧真火刺杀',
          targetId,
          targetSeat: targetPlayer?.seat,
          targetNickname: targetPlayer?.nickname,
          outcome: hit ? 'success' : 'miss',
          detail: hit
            ? `喷吐三昧真火绝杀一击，直刺【${targetPlayer?.seat}号 · ${targetPlayer?.nickname}】，一举命中齐天大圣孙悟空！红方妖魔绝杀逆转获胜！`
            : `喷吐三昧真火绝杀一击，直刺【${targetPlayer?.seat}号 · ${targetPlayer?.nickname}】（真实身份为${targetBrawlRole || '非大圣'}），刺杀落空！齐天大圣真身保全，蓝方取经阵营获胜！`,
        });
      }
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
      if (payload.action === 'wagerInspect') {
        requireRule(g.brawl.wager?.pendingInspectorId === userId, 'NO_WAGER_INSPECT');
        const targetPlayer = g.players.find(p => p.id === payload.targetPlayerId);
        requireRule(targetPlayer && targetPlayer.id !== userId, 'INVALID_TARGET');
        const targetPs = g.brawl.playerStates[targetPlayer.id];
        requireRule(targetPs, 'INVALID_TARGET');
        // 尊重黄眉老怪假佛隐身法则：验到黄眉老怪仍显示仙佛清光（蓝方）
        const apparentTeam: BrawlCamp = targetPs.roleId === 'huangmei_laoguai' ? 'blue' : targetPs.camp;
        g.brawl.wager.inspectResult = {
          inspectorId: userId,
          targetId: targetPlayer.id,
          targetSeat: targetPlayer.seat,
          targetNickname: targetPlayer.nickname,
          team: apparentTeam,
        };
        g.brawl.wager.pendingInspectorId = undefined;
        const actorP = g.players.find(p => p.id === userId);
        recordBrawlReplayAction(g.brawl, {
          roundNumber: g.rounds.length || 1,
          mission: g.mission,
          phase: 'team_building',
          actorId: userId,
          actorSeat: actorP?.seat ?? 0,
          actorNickname: actorP?.nickname ?? '领队',
          roleId: 'wager_system',
          roleName: '取经军令状',
          skillName: '天眼查验',
          targetId: targetPlayer.id,
          targetSeat: targetPlayer.seat,
          targetNickname: targetPlayer.nickname,
          outcome: 'info',
          detail: `领队【${actorP?.seat}号 · ${actorP?.nickname}】行使军令状特权私密查验【${targetPlayer.seat}号 · ${targetPlayer.nickname}】，天眼显现为【${apparentTeam === 'blue' ? '仙佛清光（蓝方）' : '妖魔邪气（红方）'}】${targetPs.roleId === 'huangmei_laoguai' ? '（黄眉老怪假佛匿形）' : ''}！`,
        });
        break;
      }
      if (payload.action === 'useSkill') {
        const playerState = g.brawl.playerStates[userId];
        requireRule(playerState, 'PLAYER_NOT_FOUND');
        requireRule(!playerState.skillUsed, 'SKILL_ALREADY_USED');
        const role = getEffectiveSkillRole(playerState);
        requireRule(role, 'ROLE_NOT_FOUND');
        requireRule(payload.skillId === role.skill.skillId, 'INVALID_SKILL');

        // 阶段校验护栏：禁止在刺杀阶段释放非刺杀技能；禁止在强制发车轮浪费纯表决类技能
        const isVoteOnlySkill = ['santou_liubi', 'pingtian_handi', 'yishan_yading', 'xiangyao_baozhang', 'daoda_yipa'].includes(role.skill.skillId);
        if (isVoteOnlySkill) {
          requireRule(!['mission', 'assassination'].includes(g.phase), 'WRONG_PHASE');
          requireRule(g.rejectionCount < BRAWL_MAX_REJECTIONS_BEFORE_FORCE, 'FORCED_LAUNCH_NO_VOTE');
        } else if (role.skill.skillId !== 'yuncheng_wanli') {
          requireRule(g.phase !== 'assassination', 'WRONG_PHASE');
        }

        const currentRoundNumber = g.phase === 'proposing'
          ? g.rounds.length + 1
          : (g.rounds.at(-1)?.number ?? (g.rounds.length || 1));

        // 预先校验目标合法性与防死锁护栏（避免老君拦截前就消耗掉非法调用）
        let targetText = '';
        let targetPlayer: Player | undefined;
        if (payload.targetPlayerId) {
          targetPlayer = g.players.find(p => p.id === payload.targetPlayerId);
          if (targetPlayer) {
            targetText = `对【${targetPlayer.seat}号 · ${targetPlayer.nickname}】`;
          }
        }
        if (role.skill.actionType === 'target_player' && role.skill.skillId !== 'sanmei_zhenhuo') {
          requireRule(targetPlayer, 'TARGET_REQUIRED');
        }
        if (role.skill.skillId === 'wuxingshan_zhang' && targetPlayer) {
          requireRule(targetPlayer.id !== userId, 'CANNOT_TARGET_SELF');
        }
        if (role.skill.skillId === 'zhaoyao_baojing') {
          const liveTeam = ['proposing', 'role_reveal'].includes(g.phase)
            ? (g.draftTeam?.playerIds ?? [])
            : (g.rounds.at(-1)?.mission === g.mission ? (g.rounds.at(-1)?.team ?? []) : []);
          requireRule(liveTeam.length > 0, 'TEAM_NOT_READY');
        }
        if (role.skill.skillId === 'daofa_dianhua') {
          requireRule(g.mission >= 2, 'MISSION_NOT_REACHED');
        }
        if (['wuxingshan_zhang', 'pansi_jiejian', 'dakou_tuntian'].includes(role.skill.skillId) && targetPlayer) {
          const baseSize = missionSizesFor(g.players.length, true)[g.mission - 1];
          const curBanned = collectMissionBannedPlayerIds({
            mission: g.mission,
            captainId: captain(g),
            humanBagBanned: g.treasuresState?.humanBag,
            imprisonedTargetId: g.brawl.imprisonedTargetId,
            zhizhuBannedTargetId: g.brawl.zhizhuBannedTargetId,
            ordeals: g.brawl.ordeals,
            wager: g.brawl.wager,
          });
          requireRule(canSafelyBanPlayer(g.players.length, curBanned, targetPlayer.id, baseSize), 'TOO_MANY_BANNED');
        }

        // 太上老君金刚琢拦截红方主动法宝
        if (playerState.camp === 'red' && g.brawl.laojunZhuoActive) {
          g.brawl.laojunZhuoActive = false;
          playerState.skillUsed = true;
          const interceptSummary = `【太上老君】金刚琢凌空显圣，半空中一道金光当场将【${role.name}】祭出的【${role.skill.skillName}】套走收缴，妖法作废失效！`;
          appendBattleEvent(g.brawl, 'taishang_laojun', interceptSummary, '金刚琢套走妖魔绝技，收缴其法宝效果使其失效。', 'anonymous_broadcast');
          const actorP = g.players.find(p => p.id === userId);
          const laojunP = g.players.find(p => hasBrawlSkillRole(g.brawl?.playerStates[p.id], 'taishang_laojun'));
          setBrawlPrivateReceipt(
            g.brawl,
            userId,
            `⭕ 你的法宝【${role.skill.skillName}】在第 ${g.mission} 难发动瞬间被太上老君【金刚琢】凌空套走收缴，妖法作废未能生效！`,
          );
          setBrawlPrivateReceipt(
            g.brawl,
            laojunP?.id,
            `⭕ 金刚琢大显神威！第 ${g.mission} 难已凌空套走收缴【${role.name}】的【${role.skill.skillName}】，使其妖法作废！`,
          );
          recordBrawlReplayAction(g.brawl, {
            roundNumber: currentRoundNumber,
            mission: g.mission,
            phase: 'team_building',
            actorId: userId,
            actorSeat: actorP?.seat ?? 0,
            actorNickname: actorP?.nickname ?? role.name,
            roleId: role.id,
            roleName: role.name,
            skillName: role.skill.skillName,
            outcome: 'blocked',
            detail: `祭出绝技【${role.skill.skillName}】，被太上老君金刚琢当场套走收缴，妖法作废失效！`,
          });
          recordBrawlReplayAction(g.brawl, {
            roundNumber: currentRoundNumber,
            mission: g.mission,
            phase: 'team_building',
            actorId: laojunP?.id ?? '',
            actorSeat: laojunP?.seat ?? 0,
            actorNickname: laojunP?.nickname ?? '太上老君',
            roleId: 'taishang_laojun',
            roleName: '太上老君',
            skillName: '金刚琢',
            targetId: userId,
            targetSeat: actorP?.seat,
            targetNickname: actorP?.nickname,
            outcome: 'success',
            detail: `金刚琢凌空显圣，成功收缴套走【${actorP?.seat}号 · ${actorP?.nickname}】（${role.name}）的【${role.skill.skillName}】！`,
          });
          break;
        }

        playerState.skillUsed = true;

        let customSummary: string | undefined;

        if (role.skill.skillId === 'jingang_zhuo') {
          // 太上老君【金刚琢】
          g.brawl.laojunZhuoActive = true;
        } else if (role.skill.skillId === 'dakou_tuntian') {
          // 青毛狮子怪【大口吞天】
          requireRule(targetPlayer, 'TARGET_REQUIRED');
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
          g.brawl.qingshiTuntianTargetId = targetPlayer.id;

          // 强制将目标从当前挑人队伍中吸走剔除
          if (g.draftTeam?.playerIds.includes(targetPlayer.id)) {
            g.draftTeam.playerIds = g.draftTeam.playerIds.filter(id => id !== targetPlayer.id);
          }
          const currentRound = g.rounds.at(-1);
          if (currentRound && currentRound.team.includes(targetPlayer.id)) {
            currentRound.team = currentRound.team.filter(id => id !== targetPlayer.id);
            if (g.phase === 'discussion' || g.phase === 'team_vote') {
              g.phase = 'proposing';
              g.teamVotes = {};
            }
          }
        } else if (role.skill.skillId === 'jiashe_leiyin') {
          // 黄眉老怪【假设雷音】（假传佛旨：私密点化 1 名随机蓝方）
          let detail = '施展假设雷音佛音暗传';
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
              detail = `假托菩提祖师名义向蓝方【${randomBlue.seat}号 · ${randomBlue.nickname}】私发密信，栽赃诬陷【${targetPlayer.seat}号 · ${targetPlayer.nickname}】身上妖氛缠绕！`;
            }
          }
          const actorP = g.players.find(p => p.id === userId);
          recordBrawlReplayAction(g.brawl, {
            roundNumber: currentRoundNumber,
            mission: g.mission,
            phase: 'team_building',
            actorId: userId,
            actorSeat: actorP?.seat ?? 0,
            actorNickname: actorP?.nickname ?? role.name,
            roleId: role.id,
            roleName: role.name,
            skillName: role.skill.skillName,
            targetId: targetPlayer?.id,
            targetSeat: targetPlayer?.seat,
            targetNickname: targetPlayer?.nickname,
            outcome: 'success',
            detail,
          });
          // 静默生效，绝不生成公屏战报，彻底避免自爆！
          break;
        } else if (role.skill.skillId === 'huapi_lijian') {
          // 白骨精【画皮离间】（静默在出征队伍中埋下离间魔骨）
          g.brawl.baiguLijianArmed = true;
          const actorP = g.players.find(p => p.id === userId);
          recordBrawlReplayAction(g.brawl, {
            roundNumber: currentRoundNumber,
            mission: g.mission,
            phase: 'team_building',
            actorId: userId,
            actorSeat: actorP?.seat ?? 0,
            actorNickname: actorP?.nickname ?? role.name,
            roleId: role.id,
            roleName: role.name,
            skillName: role.skill.skillName,
            outcome: 'info',
            detail: '暗中埋下离间魔骨：待命若本轮出征任务失败，将静默虚增 1 张失败牌引车内好人自相残杀！',
          });
          // 静默生效，绝不生成公屏战报，彻底避免自爆！
          break;
        } else if (role.skill.skillId === 'huanghua_ducha') {
          // 百眼魔君【黄花毒茶】（静默在出征队伍杯中下毒）
          if (targetPlayer) {
            g.brawl.baiyanDuchaTargetId = targetPlayer.id;
          }
          const actorP = g.players.find(p => p.id === userId);
          recordBrawlReplayAction(g.brawl, {
            roundNumber: currentRoundNumber,
            mission: g.mission,
            phase: 'team_building',
            actorId: userId,
            actorSeat: actorP?.seat ?? 0,
            actorNickname: actorP?.nickname ?? role.name,
            roleId: role.id,
            roleName: role.name,
            skillName: role.skill.skillName,
            targetId: targetPlayer?.id,
            targetSeat: targetPlayer?.seat,
            targetNickname: targetPlayer?.nickname,
            outcome: 'info',
            detail: `暗中向出征队员【${targetPlayer?.seat}号 · ${targetPlayer?.nickname}】的茶杯中下黄花毒茶，待命出征结算！`,
          });
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
          if (g.brawl.wager && g.brawl.wager.activeRoundNumber === g.rounds.at(-1)?.number) {
            g.brawl.wager.activeRoundNumber = undefined;
            g.brawl.wager.activeCaptainId = undefined;
          }
          refundArmedMissionSkillsOnProposalAbort(g, '镇元大仙袖里乾坤收队');
          rotate(g);
          g.phase = 'proposing';
          setBrawlPrivateReceipt(g.brawl, userId, `🌀 第 ${g.mission} 难袖里乾坤已生效：已收走争议车队并轮换下任队长重选，不增加本难流局计数！`);
        } else if (role.skill.skillId === 'zhaoyao_baojing') {
          // 托塔李天王【照妖宝镜】
          const currentTeam = ['proposing', 'role_reveal'].includes(g.phase)
            ? (g.draftTeam?.playerIds ?? [])
            : (g.rounds.at(-1)?.mission === g.mission ? (g.rounds.at(-1)?.team ?? []) : []);
          requireRule(currentTeam.length > 0, 'TEAM_NOT_READY');
          const hasDemon = currentTeam.some(id => g.brawl?.playerStates[id]?.camp === 'red');
          const teamSummary = currentTeam
            .map(id => {
              const tp = g.players.find(p => p.id === id);
              return tp ? `${tp.seat}号${tp.nickname}` : '';
            })
            .filter(Boolean)
            .join('、');
          g.brawl.zhaoyaoResult = {
            hasDemon,
            teamPlayerIds: [...currentTeam],
            mission: g.mission,
            roundNumber: currentRoundNumber,
            teamSummary,
          };
          setBrawlPrivateReceipt(
            g.brawl,
            userId,
            `🪞 第 ${g.mission} 难照妖宝镜探查【${teamSummary}】：车队中【${hasDemon ? '有妖魔潜伏！' : '无妖魔，皆是正道仙友！'}】`,
          );
        } else if (role.skill.skillId === 'yuncheng_wanli') {
          // 金翅大鹏雕【云程万里】：任意时刻均可提前蓄力，刺杀阶段自动排除非大圣目标
          g.brawl.dapengArmed = true;
          setBrawlPrivateReceipt(
            g.brawl,
            userId,
            '🦅 云程万里已蓄力待命：进入刺杀阶段将自动为红孩儿排除 1 个绝非孙悟空的席位！',
          );
          if (g.phase === 'assassination') {
            triggerDapengExclude(g);
          }
        } else if (role.skill.skillId === 'santou_liubi' || role.skill.skillId === 'pingtian_handi') {
          // 哪吒三太子【三头六臂】/ 牛魔王【平天撼地】
          requireRule(['proposing', 'discussion', 'team_vote'].includes(g.phase), 'WRONG_PHASE');
          g.brawl.doubleVoteUserId = userId;
          setBrawlPrivateReceipt(g.brawl, userId, `🔥 第 ${g.mission} 难双倍表决权已激活：本次组队表决你的选票将计为 2 票！`);
        } else if (role.skill.skillId === 'yishan_yading') {
          // 银角大王【移山压顶】
          if (targetPlayer) {
            requireRule(targetPlayer.id !== userId, 'CANNOT_TARGET_SELF');
            requireRule(['proposing', 'discussion', 'team_vote'].includes(g.phase), 'WRONG_PHASE');
            g.brawl.yishanTargetId = targetPlayer.id;
            if (g.phase === 'team_vote') {
              g.teamVotes[targetPlayer.id] = 'abstain';
            }
            setBrawlPrivateReceipt(g.brawl, userId, `⛰️ 第 ${g.mission} 难移山压顶已生效：已将【${targetPlayer.seat}号 · ${targetPlayer.nickname}】本次表决票强制压制为弃权！`);
          }
        } else if (role.skill.skillId === 'tianzun_yuzhi') {
          // 玉皇大帝【天尊玉旨】
          g.brawl.yuhuangYuzhiArmed = true;
          setBrawlPrivateReceipt(g.brawl, userId, '📜 天尊玉旨已降旨蓄力：后续任一难出征溃败时将自动降旨尝试赦免逆转（1败60%/2败30%）！');
        } else if (role.skill.skillId === 'xiangyao_baozhang') {
          // 沙悟净【降妖宝杖】
          g.brawl.shawujingBaozhangArmed = true;
          setBrawlPrivateReceipt(g.brawl, userId, '🌊 降妖宝杖定海已蓄势：后续组队表决若流局，将有 50% 概率强行镇压反转为发车通过！');
        } else if (role.skill.skillId === 'daoda_yipa') {
          // 猪八戒【倒打一耙】
          g.brawl.zhubajieDaodaArmed = true;
          setBrawlPrivateReceipt(g.brawl, userId, '🌾 倒打一耙已蓄势：后续组队表决若流局，将强制反转 1 张反对票为赞成票！');
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
          if (Math.random() < BRAWL_SKILL_PROBS.TIESHAN_BONUS_ROLE) {
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
          if (Math.random() < BRAWL_SKILL_PROBS.HUANGFENG_PEEK) {
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
          g.brawl.huangfengSecret = customSummary;
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
          if (candidateBlues.length > 0 && candidateReds.length > 0 && Math.random() < BRAWL_SKILL_PROBS.PUTI_REVEAL) {
            const targetBlue = candidateBlues[Math.floor(Math.random() * candidateBlues.length)];
            const targetRed = candidateReds[Math.floor(Math.random() * candidateReds.length)];
            const redDef = BRAWL_ROLE_REGISTRY[g.brawl.playerStates[targetRed.id].roleId];
            g.brawl.putiDianhuaNotice = {
              targetBlueUserId: targetBlue.id,
              redRoleName: redDef ? redDef.name : '未知妖魔',
            };
            setBrawlPrivateReceipt(
              g.brawl,
              userId,
              `🔮 第 ${g.mission} 难道法点化显灵（50% 命中）：已将潜伏妖魔【${g.brawl.putiDianhuaNotice.redRoleName}】真名密授给 1 位蓝方同修！`,
            );
          } else {
            setBrawlPrivateReceipt(
              g.brawl,
              userId,
              `🔮 第 ${g.mission} 难道法点化未显灵（50% 概率未命中）：本次天机未现，未能点化传信。`,
            );
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

        const actorP = g.players.find(p => p.id === userId);
        let actionPhase: BrawlTriggerPhase = 'team_building';
        if (['santou_liubi', 'pingtian_handi', 'yishan_yading', 'xiuli_qiankun', 'xiangyao_baozhang', 'daoda_yipa'].includes(role.skill.skillId) || g.phase === 'team_vote') {
          actionPhase = 'team_voting';
        } else if (['jingping_ganlu', 'zijin_hulu', 'daoyao_mihun', 'jiuzhuan_xiantao', 'tianzun_yuzhi'].includes(role.skill.skillId)) {
          actionPhase = 'mission_exec';
        }
        let replayDetail = summaryText;
        let replayOutcome: 'success' | 'blocked' | 'miss' | 'info' = 'success';
        if (role.skill.skillId === 'bajiao_shenfeng' && g.brawl.tieshanSecret) {
          replayDetail = g.brawl.tieshanSecret;
          replayOutcome = 'info';
        } else if (role.skill.skillId === 'sanmei_shenfeng') {
          replayOutcome = g.brawl.huangfengSecret?.includes('暗藏【') ? 'info' : 'miss';
        } else if (role.skill.skillId === 'daofa_dianhua') {
          if (g.brawl.putiDianhuaNotice) {
            const recvP = g.players.find(p => p.id === g.brawl?.putiDianhuaNotice?.targetBlueUserId);
            replayDetail = `施展道法点化真传（50% 命中），向蓝方【${recvP?.seat}号 · ${recvP?.nickname}】暗授天机：场上潜伏群妖之一为【${g.brawl.putiDianhuaNotice.redRoleName}】！`;
            replayOutcome = 'success';
          } else {
            replayDetail = '施展道法点化真传（50% 概率未命中）：天机未显，未能向蓝方同修传信。';
            replayOutcome = 'miss';
          }
        } else if (role.skill.skillId === 'zhaoyao_baojing' && g.brawl.zhaoyaoResult) {
          const teamStr = g.brawl.zhaoyaoResult.teamSummary ? `【${g.brawl.zhaoyaoResult.teamSummary}】` : '当前车队';
          replayDetail = `举起照妖宝镜密照${teamStr}：探查结果显示车内【${g.brawl.zhaoyaoResult.hasDemon ? '妖氛弥漫（有妖魔）' : '清光纯正（无妖魔）'}】。`;
          replayOutcome = 'info';
        } else if (['jingping_ganlu', 'zijin_hulu', 'daoyao_mihun', 'jiuzhuan_xiantao', 'tianzun_yuzhi', 'xiangyao_baozhang', 'daoda_yipa', 'jingang_zhuo', 'yuncheng_wanli', 'santou_liubi', 'pingtian_handi'].includes(role.skill.skillId)) {
          replayOutcome = 'info';
        }
        recordBrawlReplayAction(g.brawl, {
          roundNumber: currentRoundNumber,
          mission: g.mission,
          phase: actionPhase,
          actorId: userId,
          actorSeat: actorP?.seat ?? 0,
          actorNickname: actorP?.nickname ?? role.name,
          roleId: role.id,
          roleName: role.name,
          skillName: role.skill.skillName,
          targetId: targetPlayer?.id,
          targetSeat: targetPlayer?.seat,
          targetNickname: targetPlayer?.nickname,
          outcome: replayOutcome,
          detail: replayDetail,
        });
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
        if (g.brawl?.phantomEvilId && p.id === g.brawl.phantomEvilId) return true;
        if (teamOf(g.roles[p.id]) !== 'red') return false;
        if (g.brawl) {
          const brawlRoleId = g.brawl.playerStates[p.id]?.roleId;
          return brawlRoleId !== 'huangmei_laoguai';
        }
        return g.roles[p.id] !== 'mordred';
      }).map(p => p.id)
    : role && teamOf(role) === 'red'
      ? (
          g.brawl
            ? (
                // 乱斗模式下：若自己是牛魔王，独霸一方，看不见其他红方队友
                g.brawl.playerStates[userId!]?.roleId === 'niu_mowang'
                  ? []
                  // 其他红方队友互认，但看不见孤狼牛魔王
                  : g.players.filter(p => p.id !== userId && teamOf(g.roles[p.id]) === 'red' && g.brawl!.playerStates[p.id]?.roleId !== 'niu_mowang').map(p => p.id)
              )
            : (role !== 'oberon' ? g.players.filter(p => p.id !== userId && teamOf(g.roles[p.id]) === 'red' && g.roles[p.id] !== 'oberon').map(p => p.id) : [])
        )
      : [];
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

  // 对局未结束时，对混沌迷雾难次的真实牌数执行物理脱敏（防止客户端抓包看牌数）
  const projectedRounds = structuredClone(g.rounds).map(r => {
    if (!g.result && r.result?.masked) {
      return {
        ...r,
        result: { successes: -1, failures: -1, passed: r.result.passed, masked: true },
      };
    }
    return r;
  });

  return { id: g.id, rulesetVersion: g.rulesetVersion, phase: g.phase, players: structuredClone(g.players), mission: g.mission,
    ...(g.phase === 'dealing' ? { dealEndsAt: g.dealEndsAt } : {}),
    ...(g.phase === 'guanyin_window' ? { guanyinEndsAt: g.guanyinEndsAt } : {}),
    missionSizes: [...missionSizesFor(g.players.length, Boolean(g.brawl))], failuresRequired: failuresRequired(g), rejectionCount: g.rejectionCount,
    captainId: captain(g), captainOrder: [...g.captainOrder], rounds: projectedRounds,
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
    ...(g.brawl ? { brawl: projectBrawlGameState(g.brawl, Boolean(g.result)) } : {}),
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
export * from './brawl-ordeals.js';

