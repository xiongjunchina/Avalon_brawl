import type {
  BrawlCamp,
  BrawlCommandPayload,
  BrawlPeekedRole,
  BrawlPlayerState,
  Command,
  EarlyWindow,
  GameResult,
  GameView,
  Player,
  Role,
  RoleAssignmentAudit,
  RoundView,
  SelfBrawlView,
  Settings,
  Team,
  TeamBallot,
  User,
} from '@avalon/contracts';
import {
  BRAWL_ROLE_REGISTRY,
  BRAWL_SKILL_PROBS,
  drawBrawlRoles,
  sampleWithoutReplacement,
} from './brawl-registry.js';
import {
  appendBattleEvent,
  assignCoreBonusSkills,
  createBrawlGameState,
  ensureBrawlSecrets,
  getEffectiveSkillRole,
  hasBrawlSkillRole,
  projectBrawlGameState,
  projectSelfBrawlView,
  recordBrawlReplayAction,
  resetRoundBrawlEffects,
  setBrawlPrivateReceipt,
  validateBrawlMissionVote,
} from './brawl-engine.js';
import {
  BRAWL_MAX_REJECTIONS_BEFORE_FORCE,
  BRAWL_ORDEAL_REGISTRY,
  advanceMissionOrdeals,
  applyCelestialSwap,
  applyMissionOrdealEffects,
  canCaptainStakeWager,
  canSafelyBanPlayer,
  collectMissionBannedPlayerIds,
  createInitialOrdealState,
  createInitialWagerState,
  drawNextOrdeal,
  getActiveOrdealId,
  isPlayerBannedFromMission,
  pickPhantomEvilTarget,
  shouldHideFailureCountInReport,
  triggerDapengExclude,
  triggerShituolingExclude,
} from './brawl-ordeals.js';
import {
  computeSkillControl,
  executeBrawlSkill,
  refundArmedMissionSkillsOnProposalAbort,
  resolveMissionSkillEffects,
} from './brawl-skills.js';
import {
  BRAWL_BASE_ROLE_CONFIG,
  BRAWL_MISSION_SIZES,
  captain,
  failuresRequired,
  failuresRequiredFor,
  getLiveMissionTeam,
  isEnded,
  MISSION_SIZES,
  missionSizesFor,
  requireRule,
  ROLE_CONFIG,
  RuleError,
  RULESET_VERSION,
  teamOf,
  type GameState,
  type RoleProtectionOptions,
} from './brawl-types.js';
import { randomBigIntBelow } from './random.js';
import {
  assignWeightedRoles,
  ROLE_ASSIGNMENT_VERSION,
  ROLE_WEIGHT_VERSION,
  roleWeight,
} from './role-assignment.js';

export {
  BRAWL_BASE_ROLE_CONFIG,
  BRAWL_MISSION_SIZES,
  BRAWL_ROLE_REGISTRY,
  BRAWL_SKILL_PROBS,
  captain,
  drawBrawlRoles,
  failuresRequired,
  failuresRequiredFor,
  getLiveMissionTeam,
  isEnded,
  MISSION_SIZES,
  missionSizesFor,
  randomBigIntBelow,
  ROLE_ASSIGNMENT_VERSION,
  ROLE_CONFIG,
  ROLE_WEIGHT_VERSION,
  roleWeight,
  RuleError,
  RULESET_VERSION,
  sampleWithoutReplacement,
  teamOf,
};
export type { BrawlRoleDef } from '@avalon/contracts';
export type { GameState, RoleProtectionOptions };

// Legacy stubs kept for backwards compatibility with tests and old references
export const GUANYIN_WINDOW_MS = 5_000;
export const LOYAL_GUARDIAN_POOL = ['bailong', 'zhubajie', 'shawujing', 'jingang'] as const;
export function assignLoyalGuardians(): Record<string, string> { return {}; }
export const FEMALE_DEMON_POOL = ['spider', 'baigu', 'yutu', 'laoshu'] as const;
export function assignFemaleDemons(): Record<string, string> { return {}; }
export function treasuresEnabledFor(): boolean { return false; }
export function hasUnusedGuanyin(): boolean { return false; }

export function roleHistoryAfterDeal(
  game: Pick<GameState, 'roles' | 'roleAssignmentAudit'>,
): Record<string, Role[]> {
  const result: Record<string, Role[]> = {};
  for (const [userId, role] of Object.entries(game.roles)) {
    const previous = game.roleAssignmentAudit?.players[userId]?.recentRoles ?? [];
    result[userId] = [role, ...previous].slice(0, 5);
  }
  return result;
}

export function finish(g: GameState, result: GameResult): void {
  g.phase = result.winner ? 'finished' : 'aborted';
  g.result = result;
  delete g.draftTeam;
  delete g.dealEndsAt;
  delete g.abortPoll;
  g.teamVotes = {};
  g.missionVotes = {};

  if (g.brawl) {
    const winnerCamp: BrawlCamp = result.winner === 'blue' ? 'blue' : 'red';
    const isAssassinated = result.reason === 'merlin_found' || result.reason === 'early_merlin_found';
    const summary = isAssassinated
      ? `【红孩儿】祭出三昧真火成功刺杀【孙悟空】！红方妖魔大获全胜！`
      : (result.winner === 'blue'
        ? `取经队伍历经八十一难，成功取得真经！蓝方仙友功德圆满！`
        : `取经队伍历经浩劫，三难受阻！红方妖魔阻断取经！`);

    appendBattleEvent(
      g.brawl,
      winnerCamp === 'blue' ? 'tang_seng' : 'hong_haier',
      summary,
      result.reason,
      'anonymous_broadcast',
    );

    recordBrawlReplayAction(g.brawl, {
      roundNumber: g.rounds.length,
      mission: g.mission,
      phase: 'game_end',
      actorId: '',
      actorSeat: 0,
      actorNickname: '终局天道',
      roleId: winnerCamp === 'blue' ? 'tang_seng' : 'hong_haier',
      roleName: winnerCamp === 'blue' ? '唐三藏' : '红孩儿',
      skillName: '乾坤落定',
      outcome: 'info',
      detail: `${summary}（胜者：${winnerCamp === 'blue' ? '蓝方仙佛' : '红方妖魔'}，原因：${result.reason}）`,
    });
  }
}

function rotate(g: GameState): void {
  g.captainIndex = (g.captainIndex + 1) % g.captainOrder.length;
}

/**
 * 纯乱斗阵营角色分配算法
 */
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
  camp: BrawlCamp,
  coreDefs: { id: string; role: Role }[],
  defaultNonCoreRole: Role,
  rawPreferences: Record<string, string[]> | undefined,
  rolePreferenceEnabled: boolean,
  protectionOpts: RoleProtectionOptions,
  shuffle: <T>(values: T[]) => T[],
  rng: () => number = Math.random,
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
  protection: string[] | RoleProtectionOptions = [],
): GameState {
  requireRule(players.length === settings.playerCount && BRAWL_MISSION_SIZES[players.length], 'NOT_READY');
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const protectionOpts: RoleProtectionOptions = Array.isArray(protection)
    ? { visionGuaranteedUserIds: protection }
    : protection;

  if (!settings.brawlModeEnabled) {
    const configRoles = [...ROLE_CONFIG[players.length]];
    const res = assignWeightedRoles(sorted, configRoles, shuffle([...configRoles]), {
      ...protectionOpts,
      rolePreferences: settings.rolePreferenceEnabled ? protectionOpts.rolePreferences : undefined,
    });
    const seats = sorted.map(p => p.id);
    const captainOrder = settings.captainMode === 'random_order' ? shuffle(seats) : seats;
    return {
      id,
      rulesetVersion: RULESET_VERSION,
      settings: { ...settings },
      players: sorted,
      roles: res.roles,
      roleAssignmentAudit: res.audit,
      phase: 'role_reveal',
      mission: 1,
      rejectionCount: 0,
      captainOrder,
      captainIndex: 0,
      confirmed: [],
      teamVotes: {},
      missionVotes: {},
      rounds: [],
      draftTeam: undefined,
      earlyAssassination: settings.earlyAssassinationEnabled ? { used: false, windows: [] } : undefined,
      assassinationMode: undefined,
    };
  }

  const rawPreferences = protectionOpts.rolePreferences;
  const redRoleCount = BRAWL_BASE_ROLE_CONFIG[players.length].filter(r => teamOf(r) === 'red').length;

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

    const preferenceDiff = (redScore - blueScore) * 50;
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

  const sortedByRedPreference = [...playerScores].sort((a, b) => b.redPropensity - a.redPropensity);
  const redPlayers = sortedByRedPreference.slice(0, redRoleCount).map(x => x.player);
  const bluePlayers = sortedByRedPreference.slice(redRoleCount).map(x => x.player);

  const is9Plus = sorted.length >= 9;
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
    Math.random,
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
    Math.random,
  );

  const roles = { ...blueResult.assignedRoles, ...redResult.assignedRoles };
  const brawlRoles = { ...blueResult.assignedBrawlRoles, ...redResult.assignedBrawlRoles };
  const playerStates: Record<string, BrawlPlayerState> = {
    ...blueResult.assignedPlayerStates,
    ...redResult.assignedPlayerStates,
  };

  const bonusGrants = sorted.length <= 8 ? assignCoreBonusSkills(playerStates, Math.random) : [];

  const brawlState = createBrawlGameState(
    playerStates,
    blueResult.nonCoreAssignedRoleIds,
    redResult.nonCoreAssignedRoleIds,
  );
  brawlState.ordeals = createInitialOrdealState(Boolean(settings.brawlOrdealsEnabled), Math.random);
  brawlState.wager = createInitialWagerState();
  const secrets = ensureBrawlSecrets(brawlState);

  // 画皮惑眼（高阶可选开关）：孙悟空眼中混入 1 位随机无辜蓝方假红气
  if (settings.brawlPhantomVisionEnabled) {
    const phantomId = pickPhantomEvilTarget(playerStates, Math.random);
    if (phantomId) {
      secrets.phantomEvilId = phantomId;
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

  // 开局盲盒情报特权（二郎神看 1 妖，百眼魔君看 1 仙，老鼠精看 1 仙）
  const brawlPeekedMap: Record<string, BrawlPeekedRole[]> = {};
  const allRedBrawlRoles = Object.values(playerStates)
    .filter(ps => ps.camp === 'red')
    .map(ps => ({ roleId: ps.roleId, roleName: BRAWL_ROLE_REGISTRY[ps.roleId]?.name ?? ps.roleId, camp: 'red' as BrawlCamp }));
  const allBlueBrawlRoles = Object.values(playerStates)
    .filter(ps => ps.camp === 'blue')
    .map(ps => ({ roleId: ps.roleId, roleName: BRAWL_ROLE_REGISTRY[ps.roleId]?.name ?? ps.roleId, camp: 'blue' as BrawlCamp }));

  if (allRedBrawlRoles.length > 0) {
    brawlPeekedMap.erlang_shen = [allRedBrawlRoles[Math.floor(Math.random() * allRedBrawlRoles.length)]];
  }
  if (allBlueBrawlRoles.length > 0) {
    brawlPeekedMap.baiyan_mojun = [allBlueBrawlRoles[Math.floor(Math.random() * allBlueBrawlRoles.length)]];
    brawlPeekedMap.laoshu_jing = [allBlueBrawlRoles[Math.floor(Math.random() * allBlueBrawlRoles.length)]];
  }
  secrets.peekedMap = brawlPeekedMap;

  // 队长顺时针初始顺序
  const seats = sorted.map(p => p.id);
  const captainOrder = settings.captainMode === 'random_order' ? shuffle(seats) : seats;

  return {
    id,
    rulesetVersion: RULESET_VERSION,
    settings,
    players: sorted,
    roles,
    brawlRoles,
    brawl: brawlState,
    phase: 'role_reveal',
    mission: 1,
    rejectionCount: 0,
    captainOrder,
    captainIndex: 0,
    confirmed: [],
    teamVotes: {},
    missionVotes: {},
    rounds: [],
    draftTeam: undefined,
    earlyAssassination: settings.earlyAssassinationEnabled ? { used: false, windows: [] } : undefined,
    assassinationMode: undefined,
  };
}

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

function validateTeamMemberBans(g: GameState, playerIds: string[]) {
  if (g.brawl?.imprisonedTargetId) {
    requireRule(!playerIds.includes(g.brawl.imprisonedTargetId), 'PLAYER_IMPRISONED_BY_WUXINGSHAN');
  }
  if (g.brawl?.zhizhuBannedTargetId) {
    requireRule(!playerIds.includes(g.brawl.zhizhuBannedTargetId), 'PLAYER_BANNED_BY_ZHIZHU_JING');
  }
  if (g.brawl?.qingshiTuntianTargetId) {
    requireRule(!playerIds.includes(g.brawl.qingshiTuntianTargetId), 'PLAYER_BANNED_BY_QINGMAO_SHIZI');
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

function resolveTeamVoteIfComplete(g: GameState, _context: { hostId: string; now: number }) {
  if (g.phase !== 'team_vote' || Object.keys(g.teamVotes).length !== g.players.length) return;
  const round = g.rounds.at(-1)!;
  let approves = 0;
  let rejects = 0;
  let abstentions = 0;

  for (const [pid, ballot] of Object.entries(g.teamVotes)) {
    const weight = g.brawl?.doubleVoteUserId === pid ? 2 : 1;
    if (ballot === true) approves += weight;
    else if (ballot === false) rejects += weight;
    else abstentions += 1;
  }

  let approved = approves > rejects;

  // 沙悟净【降妖宝杖 · 平票定海】：若流局且已蓄势，50% 概率反转为通过
  if (!approved && g.brawl?.shawujingBaozhangArmed) {
    g.brawl.shawujingBaozhangArmed = false;
    if (Math.random() < BRAWL_SKILL_PROBS.SHA_PASS) {
      approved = true;
      appendBattleEvent(
        g.brawl,
        'sha_wujing',
        '【沙悟净】降妖宝杖定海神威！流沙河浩然仙威强行压制反对喧嚣，队伍破浪发车出征！',
        '组队表决若流局，50% 概率强行平定反转为发车出征！',
        'anonymous_broadcast',
      );
    }
  }

  // 猪八戒【倒打一耙】：若仍未通过且已蓄势，强制反转 1 张反对票为赞成
  if (!approved && g.brawl?.zhubajieDaodaArmed) {
    g.brawl.zhubajieDaodaArmed = false;
    approves += 1;
    rejects = Math.max(0, rejects - 1);
    if (approves > rejects) {
      approved = true;
      appendBattleEvent(
        g.brawl,
        'zhu_bajie',
        '【猪八戒】倒打一耙九齿神威！暗中将 1 张反对票反转为赞成票，队伍惊险发车出征！',
        '组队表决流局时，强制将 1 张反对票反转为赞成票！',
        'anonymous_broadcast',
      );
    }
  }

  round.vote = {
    passed: approved,
    approvals: approves,
    rejections: rejects,
    abstentions,
    ballots: { ...g.teamVotes },
  };

  if (approved) {
    g.phase = 'mission';
    if (g.brawl || g.settings.rejectionScope === 'mission') {
      g.rejectionCount = 0;
    }
    g.missionVotes = {};
  } else {
    g.rejectionCount += 1;
    if (!g.brawl && g.rejectionCount >= 5) {
      finish(g, { winner: 'red', reason: 'five_rejections' });
      return;
    }
    refundArmedMissionSkillsOnProposalAbort(g, '表决未过流局');
    rotate(g);
    g.phase = 'proposing';
    g.teamVotes = {};
  }
}

export function transition(
  state: GameState,
  userId: string,
  action: Pick<Command, 'type' | 'payload'>,
  onlineIds: string[],
  context = { hostId: state.players[0].id, now: Date.now() },
): GameState {
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

  switch (action.type) {
    case 'confirmRole': {
      requireRule(g.phase === 'dealing' || g.phase === 'role_reveal', 'WRONG_PHASE');
      requireRule(g.players.some(p => p.id === userId), 'NOT_A_PLAYER');
      if (!g.confirmed.includes(userId)) {
        g.confirmed.push(userId);
      }
      if (g.confirmed.length === g.players.length) {
        g.phase = 'proposing';
        delete g.dealEndsAt;
      }
      break;
    }

    case 'updateTeamDraft': {
      requireRule(['role_reveal', 'proposing', 'discussion'].includes(g.phase), 'WRONG_PHASE');
      requireRule(userId === captain(g), 'NOT_CAPTAIN');
      if (g.phase === 'discussion' && g.brawl?.ordeals?.lastSwap?.roundNumber === g.rounds.at(-1)?.number) {
        throw new RuleError('CANNOT_EDIT_AFTER_CELESTIAL_SWAP');
      }
      const { playerIds, direction } = action.payload as { playerIds: string[]; direction?: RoundView['direction'] };
      const baseReq = missionSizesFor(g.players.length, Boolean(g.brawl))[g.mission - 1];
      const maxDraft = baseReq + (g.brawl?.extraSeatLimit ?? 0);
      requireRule(
        playerIds.length <= maxDraft &&
        new Set(playerIds).size === playerIds.length &&
        playerIds.every(id => g.players.some(p => p.id === id)),
        'INVALID_TEAM',
      );
      validateTeamMemberBans(g, playerIds);
      const dir: RoundView['direction'] = direction ?? 'clockwise';
      g.draftTeam = { playerIds: [...playerIds], direction: dir };
      if (g.phase === 'discussion' && g.rounds.length > 0) {
        g.rounds.at(-1)!.team = [...playerIds];
        g.rounds.at(-1)!.direction = dir;
      }
      break;
    }

    case 'proposeTeam': {
      requireRule(['role_reveal', 'proposing'].includes(g.phase), 'WRONG_PHASE');
      requireRule(userId === captain(g), 'NOT_CAPTAIN');
      const { playerIds, direction, militaryWager } = action.payload as { playerIds: string[]; direction?: RoundView['direction']; militaryWager?: boolean };
      const curCaptainId = captain(g);
      const baseReq = missionSizesFor(g.players.length, Boolean(g.brawl))[g.mission - 1];
      const reqSize = baseReq + (g.brawl?.extraSeatLimit ?? 0);
      requireRule(
        playerIds.length === reqSize && new Set(playerIds).size === playerIds.length,
        'INVALID_TEAM',
      );

      if (militaryWager) {
        requireRule(canCaptainStakeWager({ brawlEnabled: Boolean(g.brawl), mission: g.mission, ordeals: g.brawl?.ordeals, wager: g.brawl?.wager }), 'WAGER_UNAVAILABLE');
        requireRule(playerIds.includes(userId), 'WAGER_REQUIRES_CAPTAIN_ON_TEAM');
      }

      const isCaptainBanned = isPlayerBannedFromMission(curCaptainId, {
        mission: g.mission,
        captainId: curCaptainId,
        imprisonedTargetId: g.brawl?.imprisonedTargetId,
        zhizhuBannedTargetId: g.brawl?.zhizhuBannedTargetId,
        qingshiTuntianTargetId: g.brawl?.qingshiTuntianTargetId,
        ordeals: g.brawl?.ordeals,
        wager: g.brawl?.wager,
      });
      const curRoundNum = g.rounds.length + 1;
      const isWagerActive = g.brawl?.wager?.activeRoundNumber === curRoundNum || g.brawl?.wager?.activeCaptainId === curCaptainId;
      if (isWagerActive && !isCaptainBanned) {
        requireRule(playerIds.includes(curCaptainId), 'CAPTAIN_MUST_BE_ON_TEAM');
      }

      for (const pid of playerIds) {
        requireRule(g.players.some(p => p.id === pid), 'INVALID_PLAYER');
      }
      validateTeamMemberBans(g, playerIds);

      const nextRoundNumber = g.rounds.length + 1;
      let finalTeam = [...playerIds];

      // 八十一难 · 天意篡改：队长提交名单进入论道时，系统公开从未上车的可选玩家中随机抽 1 人与车上 1 人对调
      if (g.brawl && getActiveOrdealId(g.brawl.ordeals, g.mission) === 'celestial_swap' && finalTeam.length >= baseReq) {
        const bannedIds = collectMissionBannedPlayerIds({
          mission: g.mission,
          captainId: userId,
          imprisonedTargetId: g.brawl.imprisonedTargetId,
          zhizhuBannedTargetId: g.brawl.zhizhuBannedTargetId,
          qingshiTuntianTargetId: g.brawl.qingshiTuntianTargetId,
          ordeals: g.brawl.ordeals,
          wager: g.brawl.wager,
        });
        const swapped = applyCelestialSwap({
          roundNumber: nextRoundNumber,
          mission: g.mission,
          team: finalTeam,
          players: g.players,
          bannedIds,
          rng: Math.random,
        });
        if (swapped.swapRecord) {
          finalTeam = swapped.newTeam;
          g.brawl.ordeals!.lastSwap = swapped.swapRecord;
          const sw = swapped.swapRecord;
          appendBattleEvent(
            g.brawl,
            'ordeal_system',
            `【🌀 天意篡改】天机无常！系统公开将【${sw.removedSeat}号 · ${sw.removedNickname}】移出名单，换入【${sw.addedSeat}号 · ${sw.addedNickname}】！`,
            BRAWL_ORDEAL_REGISTRY.celestial_swap.description,
            'anonymous_broadcast',
          );
          recordBrawlReplayAction(g.brawl, {
            roundNumber: nextRoundNumber,
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

      const dir: RoundView['direction'] = direction ?? 'clockwise';
      const round: RoundView = {
        number: nextRoundNumber,
        mission: g.mission,
        captainId: curCaptainId,
        team: [...finalTeam],
        direction: dir,
        ...(militaryWager ? { militaryWager: true } : {}),
      };
      g.rounds.push(round);
      g.draftTeam = { playerIds: [...finalTeam], direction: dir };

      if (militaryWager && g.brawl) {
        if (!g.brawl.wager) g.brawl.wager = createInitialWagerState();
        g.brawl.wager.activeRoundNumber = nextRoundNumber;
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
          roundNumber: nextRoundNumber,
          mission: g.mission,
          phase: 'team_building',
          actorId: userId,
          actorSeat: capP?.seat ?? 0,
          actorNickname: capP?.nickname ?? '领队',
          roleId: 'wager_system',
          roleName: '取经军令状',
          skillName: '立军令状',
          outcome: 'info',
          detail: `领队【${capP?.seat}号 · ${capP?.nickname}】立下取经军令状亲征担保出征！`,
        });
      }

      g.phase = 'discussion';
      break;
    }

    case 'startTeamVote': {
      requireRule(g.phase === 'discussion' || g.phase === 'proposing', 'WRONG_PHASE');
      requireRule(userId === captain(g), 'NOT_CAPTAIN');
      const round = g.rounds.at(-1);
      requireRule(round && round.mission === g.mission, 'NO_PROPOSED_TEAM');
      const baseTeamSize = missionSizesFor(g.players.length, Boolean(g.brawl))[g.mission - 1];
      const maxTeamSize = baseTeamSize + (g.brawl?.extraSeatLimit ?? 0);
      const teamLen = round?.team?.length ?? 0;
      requireRule(teamLen >= baseTeamSize && teamLen <= maxTeamSize, 'INVALID_TEAM');

      // 乱斗固定底盘规则【两流必发】：流局 2 次后，第 3 轮跳过表决强制发车直接出征！
      if (g.brawl && g.rejectionCount >= BRAWL_MAX_REJECTIONS_BEFORE_FORCE) {
        round.vote = { approvals: 0, rejections: 0, abstentions: 0, passed: true, forced: true };
        g.teamVotes = {};
        g.brawl.doubleVoteUserId = undefined;
        g.brawl.yishanTargetId = undefined;
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

      g.phase = 'team_vote';
      g.teamVoteStartedAt = new Date().toISOString();
      g.teamVotes = {};

      // 若有人被五行山禁锢，直接按弃权处理
      if (g.brawl?.imprisonedTargetId) {
        g.teamVotes[g.brawl.imprisonedTargetId] = 'abstain';
      }
      // 若有人被移山压顶，直接按弃权处理
      if (g.brawl?.yishanTargetId) {
        g.teamVotes[g.brawl.yishanTargetId] = 'abstain';
      }
      break;
    }

    case 'teamVote': {
      requireRule(g.phase === 'team_vote', 'WRONG_PHASE');
      requireRule(g.players.some(p => p.id === userId), 'NOT_A_PLAYER');
      requireRule(g.brawl?.imprisonedTargetId !== userId, 'PLAYER_IMPRISONED');
      requireRule(g.brawl?.yishanTargetId !== userId, 'PLAYER_YISHAN_SUPPRESSED');
      requireRule(!(userId in g.teamVotes), 'ALREADY_SUBMITTED');

      const { approve } = action.payload as { approve: boolean };
      g.teamVotes[userId] = approve;

      if (Object.keys(g.teamVotes).length === g.players.length) {
        resolveTeamVoteIfComplete(g, context);
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
        const initialFailures = Object.values(g.missionVotes).filter(v => !v).length;
        const initialSuccesses = round.team.length - initialFailures;

        const { failures, successes, passed } = resolveMissionSkillEffects(
          g,
          round,
          g.missionVotes,
          initialFailures,
          initialSuccesses,
        );

        const ordealResult = applyMissionOrdealEffects(g, round, failures, successes, passed);

        round.result = {
          passed: ordealResult.passed,
          failures: ordealResult.failures,
          successes: ordealResult.successes,
          masked: shouldHideFailureCountInReport(g.brawl?.ordeals),
          cards: { ...g.missionVotes },
        };

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

        // 结算【八十一难 · 狮驼死战】
        const activeOrdealId = getActiveOrdealId(g.brawl?.ordeals, g.mission);
        if (g.brawl?.ordeals && activeOrdealId === 'shituo_bounty') {
          if (passed) {
            const redStates = Object.values(g.brawl.playerStates ?? {}).filter(ps => ps.camp === 'red');
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
              outcome: 'info',
              detail: `红方攻克狮驼死战，若进入终局刺杀，红孩儿将额外自动排除 1 名非孙悟空席位！`,
            });
          }
        }

        if (g.settings.rejectionScope === 'mission') {
          g.rejectionCount = 0;
        }
        g.missionVotes = {};

        const failedMissions = g.rounds.filter(r => r.result && !r.result.passed).length;
        const passedMissions = g.rounds.filter(r => r.result && r.result.passed).length;

        if (failedMissions >= 3) {
          finish(g, {
            winner: 'red',
            reason: 'three_failures',
          });
        } else if (passedMissions >= 3) {
          g.phase = 'assassination';
          g.assassinationMode = 'normal';
          const redAssassin = g.players.find(p => g.roles[p.id] === 'assassin' || g.brawl?.playerStates?.[p.id]?.roleId === 'hong_haier');
          if (redAssassin) {
            triggerDapengExclude(g);
            triggerShituolingExclude(g);
          }
        } else {
          g.mission += 1;
          rotate(g);
          if (g.brawl) {
            resetRoundBrawlEffects(g.brawl);
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
                `【第 ${g.mission} 难 · ${def.icon} ${def.name}】${def.description}${extraNote}`,
                def.tagline,
                'anonymous_broadcast',
              );
            }
          }
          g.phase = 'proposing';
          delete g.draftTeam;
        }
      }
      break;
    }

    case 'earlyAssassinationDecision': {
      requireRule(canUseEarlyAssassination(g) && g.earlyAssassination, 'WRONG_PHASE');
      requireRule(g.roles[userId] === 'assassin', 'NOT_ASSASSIN');
      const { attempt } = action.payload as { attempt: boolean };
      g.earlyAssassination.windows.push({
        afterMission: g.rounds.filter(r => r.result).length,
        afterProposal: g.rounds.length,
        decision: attempt ? 'attempt' : 'skip',
      });
      if (attempt) {
        g.earlyAssassination.used = true;
        g.phase = 'assassination';
        g.assassinationMode = 'early';
      }
      break;
    }

    case 'assassinate': {
      requireRule(g.phase === 'assassination', 'WRONG_PHASE');
      const assassin = g.players.find(p => g.roles[p.id] === 'assassin' || g.brawl?.playerStates?.[p.id]?.roleId === 'hong_haier');
      requireRule(assassin && assassin.id === userId, 'NOT_ASSASSIN');

      const { targetId } = action.payload as { targetId: string };
      const targetP = g.players.find(p => p.id === targetId);
      requireRule(targetP && targetP.id !== userId, 'INVALID_TARGET');

      const isMerlin = g.roles[targetId] === 'merlin' || g.brawl?.playerStates?.[targetId]?.roleId === 'sun_wukong';

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
          outcome: isMerlin ? 'success' : 'miss',
          detail: isMerlin
            ? `喷吐三昧真火绝杀一击，直刺【${targetPlayer?.seat}号 · ${targetPlayer?.nickname}】，一举命中齐天大圣孙悟空！红方妖魔绝杀逆转获胜！`
            : `喷吐三昧真火绝杀一击，直刺【${targetPlayer?.seat}号 · ${targetPlayer?.nickname}】（真实身份为${targetBrawlRole || '非大圣'}），刺杀落空！齐天大圣真身保全，蓝方取经阵营获胜！`,
        });
      }

      if (isMerlin) {
        finish(g, {
          winner: 'red',
          reason: g.assassinationMode === 'early' ? 'early_merlin_found' : 'merlin_found',
          targetId,
        });
      } else {
        finish(g, {
          winner: 'blue',
          reason: g.assassinationMode === 'early' ? 'early_merlin_survived' : 'merlin_survived',
          targetId,
        });
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
        const targetPs = g.brawl.playerStates?.[targetPlayer.id];
        requireRule(targetPs, 'INVALID_TARGET');

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
          detail: `领队【${actorP?.seat}号 · ${actorP?.nickname}】行使军令状特权私密查验【${targetPlayer.seat}号 · ${targetPlayer.nickname}】，天眼显现为【${apparentTeam === 'blue' ? '仙佛清光（蓝方）' : '妖魔邪气（红方）'}】！`,
        });
        break;
      }

      if (payload.action === 'useSkill') {
        const { shouldCheckTeamVoteComplete } = executeBrawlSkill(
          g,
          userId,
          payload.skillId,
          payload.targetPlayerId,
          rotate,
        );
        if (shouldCheckTeamVoteComplete && g.phase === 'team_vote') {
          if (Object.keys(g.teamVotes).length === g.players.length) {
            resolveTeamVoteIfComplete(g, context);
          }
        }
        break;
      }
      break;
    }

    default:
      throw new RuleError('UNKNOWN_COMMAND');
  }

  return g;
}

export function projectGame(g: GameState, userId?: string): GameView {
  const role = userId && g.phase !== 'dealing' ? g.roles[userId] : undefined;

  let evilIds: string[] = [];
  if (role === 'merlin') {
    const secrets = g.brawl?.secrets;
    evilIds = g.players
      .filter(p => {
        if (secrets?.phantomEvilId && p.id === secrets.phantomEvilId) return true;
        if (teamOf(g.roles[p.id]) !== 'red') return false;
        const brawlRoleId = g.brawl?.playerStates?.[p.id]?.roleId;
        return g.brawl ? brawlRoleId !== 'huangmei_laoguai' : g.roles[p.id] !== 'mordred';
      })
      .map(p => p.id);
  } else if (role && teamOf(role) === 'red') {
    if (g.brawl) {
      const selfPs = userId ? g.brawl?.playerStates?.[userId] : undefined;
      if (selfPs?.roleId === 'niu_mowang') {
        evilIds = [];
      } else {
        evilIds = g.players
          .filter(p => p.id !== userId && teamOf(g.roles[p.id]) === 'red' && g.brawl?.playerStates?.[p.id]?.roleId !== 'niu_mowang')
          .map(p => p.id);
      }
    } else {
      evilIds = role !== 'oberon'
        ? g.players.filter(p => p.id !== userId && teamOf(g.roles[p.id]) === 'red' && g.roles[p.id] !== 'oberon').map(p => p.id)
        : [];
    }
  }

  const redAssassin = g.players.find(p => g.roles[p.id] === 'assassin' || g.brawl?.playerStates?.[p.id]?.roleId === 'hong_haier');
  const brawlSanitized = g.brawl ? projectBrawlGameState(g.brawl, isEnded(g)) : undefined;

  let selfBrawl: SelfBrawlView | undefined;
  if (userId && g.brawl) {
    const skillControl = computeSkillControl(g, userId);
    selfBrawl = projectSelfBrawlView(
      g.brawl,
      userId,
      g.mission,
      undefined,
      g.players,
      skillControl,
    );
  }

  const latestRound = g.rounds.at(-1);
  const canRevealVoteBallots = !g.settings.anonymousTeamVote || isEnded(g);
  const currentTeamVote = g.phase === 'team_vote'
    ? {
        startedAt: g.teamVoteStartedAt,
        votedIds: Object.keys(g.teamVotes),
        ballots: !g.settings.anonymousTeamVote ? { ...g.teamVotes } : undefined,
      }
    : (latestRound?.vote
      ? {
          votedIds: Object.keys(latestRound.vote.ballots ?? {}),
          ballots: canRevealVoteBallots && latestRound.vote.ballots ? { ...latestRound.vote.ballots } : undefined,
        }
      : undefined);

  return {
    id: g.id,
    rulesetVersion: g.rulesetVersion,
    phase: g.phase,
    players: g.players,
    dealEndsAt: g.dealEndsAt,
    mission: g.mission,
    missionSizes: missionSizesFor(g.players.length, Boolean(g.brawl)),
    failuresRequired: failuresRequired(g),
    rejectionCount: g.rejectionCount,
    captainId: captain(g),
    captainOrder: g.captainOrder,
    rounds: g.rounds.map(r => {
      let res = r.result ? { ...r.result } : undefined;
      if (res && !isEnded(g)) {
        if (res.masked) {
          res = { ...res, successes: -1, failures: -1 };
        }
        const { cards, ...rest } = res;
        res = rest;
      }
      const vote = r.vote
        ? {
            ...r.vote,
            ballots: canRevealVoteBallots && r.vote.ballots ? { ...r.vote.ballots } : undefined,
          }
        : undefined;
      return {
        ...r,
        ...(vote ? { vote } : {}),
        ...(res ? { result: res } : {}),
      };
    }),
    draftTeam: g.draftTeam,
    teamVote: currentTeamVote,
    progress: {
      confirmed: g.confirmed.length,
      teamVotes: Object.keys(g.teamVotes).length,
      missionVotes: Object.keys(g.missionVotes).length,
    },
    earlyAssassination: g.earlyAssassination,
    assassinationMode: g.assassinationMode,
    assassinId: redAssassin?.id,
    result: g.result,
    revealedRoles: isEnded(g) ? g.roles : undefined,
    revealedBrawlRoles: isEnded(g)
      ? (g.brawlRoles ?? (g.brawl?.playerStates
          ? Object.fromEntries(Object.entries(g.brawl.playerStates).map(([id, ps]) => [id, ps.roleId]))
          : undefined))
      : undefined,
    abortPoll: g.abortPoll
      ? {
          requestedBy: g.abortPoll.requestedBy,
          approvals: g.abortPoll.approvals.length,
          required: Math.floor(g.players.length / 2) + 1,
          voted: userId ? g.abortPoll.approvals.includes(userId) : false,
        }
      : undefined,
    brawl: brawlSanitized,
    selfBrawl,
    self: userId && role
      ? {
          role,
          team: teamOf(role),
          evilIds,
          merlinCandidates: role === 'percival' ? g.players.filter(p => ['merlin', 'morgana'].includes(g.roles[p.id])).map(p => p.id) : [],
          confirmed: g.confirmed.includes(userId),
          teamVoted: userId in g.teamVotes,
          missionVoted: userId in g.missionVotes,
          canDecideEarly: role === 'assassin' && canUseEarlyAssassination(g),
        }
      : undefined,
  };
}

export * from './brawl-registry.js';
export * from './brawl-engine.js';
export * from './brawl-ordeals.js';
export * from './brawl-skills.js';
export * from './brawl-types.js';
