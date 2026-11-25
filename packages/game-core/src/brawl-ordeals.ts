import type {
  BrawlCamp,
  BrawlOrdealDef,
  BrawlOrdealId,
  BrawlOrdealState,
  BrawlWagerState,
  Player,
} from '@avalon/contracts';

/**
 * 乱斗模式固定基础常量：流局 2 次后，第 3 次提案跳过表决强制发车
 */
export const BRAWL_MAX_REJECTIONS_BEFORE_FORCE = 2;

/**
 * 八十一难 · 每难一劫精锐牌库（全部零座次依赖、零出牌协议改动）
 */
export const BRAWL_ORDEAL_REGISTRY: Record<BrawlOrdealId, BrawlOrdealDef> = {
  chaotic_fog: {
    id: 'chaotic_fog',
    name: '混沌迷雾',
    icon: '🌫️',
    tagline: '迷雾遮牌数，成败皆藏雷',
    description: '本难出征无论成败，战报均隐藏具体成功/失败张数（仅公示吉凶结果），终局复盘还原真相。',
  },
  quicksand_ban: {
    id: 'quicksand_ban',
    name: '弱水流沙',
    icon: '🌊',
    tagline: '流沙困旧将，随机禁一人',
    description: '天道从上一难出征仙众中随机选定 1 人陷入流沙，本难禁止入选车队（排除当前队长，人数不足时豁免）。',
    minMission: 2,
  },
  selfless_captain: {
    id: 'selfless_captain',
    name: '舍己为公',
    icon: '🪷',
    tagline: '领队须避嫌，不得自入阵',
    description: '本难领队须避嫌让贤，不可将自己编入出征名单，须从其余仙友中挑选出征阵容。',
  },
  shituo_bounty: {
    id: 'shituo_bounty',
    name: '狮驼死战',
    icon: '🦁',
    tagline: '险关悬重赏，胜者得天机',
    description: '本难仍计 1 分，但赏罚加码：蓝方守住即公屏揭露 1 位在场妖魔名号；红方攻破则终局刺杀额外排除 1 个非大圣席位。',
  },
  celestial_swap: {
    id: 'celestial_swap',
    name: '天意篡改',
    icon: '🌀',
    tagline: '天意乱点将，随机换一人',
    description: '领队提交阵容进入论道时，系统公开从未上车的可选仙友中随机抽 1 人与车上 1 人对调，全员针对篡改阵容表决。',
  },
};

export const ALL_BRAWL_ORDEAL_IDS: BrawlOrdealId[] = [
  'chaotic_fog',
  'quicksand_ban',
  'selfless_captain',
  'shituo_bounty',
  'celestial_swap',
];

/**
 * 为 5 难无放回抽取 5 张不重复奇劫卡：
 * 确保 `quicksand_ban`（依赖上一难出征记录）绝不出现在第 1 难（index 0）。
 */
export function drawOrdealDeck(rng: () => number = Math.random): BrawlOrdealId[] {
  const pool = [...ALL_BRAWL_ORDEAL_IDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  if (pool[0] === 'quicksand_ban') {
    const swapIdx = 1 + Math.floor(rng() * (pool.length - 1));
    [pool[0], pool[swapIdx]] = [pool[swapIdx], pool[0]];
  }
  return pool;
}

export function createInitialOrdealState(
  enabled: boolean,
  rng: () => number = Math.random,
): BrawlOrdealState | undefined {
  if (!enabled) return undefined;
  const deck = drawOrdealDeck(rng);
  return {
    enabled: true,
    deck,
    currentOrdealId: deck[0],
  };
}

export function createInitialWagerState(): BrawlWagerState {
  return {
    redeemedCount: 0,
  };
}

/**
 * 获取当前难次激活的奇劫卡 ID
 */
export function getActiveOrdealId(ordeals: BrawlOrdealState | undefined, mission: number): BrawlOrdealId | undefined {
  if (!ordeals?.enabled) return undefined;
  return ordeals.currentOrdealId ?? ordeals.deck[mission - 1];
}

/**
 * 收集本难禁止上车的所有玩家 ID（聚合现存法宝、神通与新劫数/军令状受罚）
 */
export function collectMissionBannedPlayerIds(params: {
  mission: number;
  captainId: string;
  humanBagBanned?: { activeBannedMission?: number; targetId?: string };
  imprisonedTargetId?: string;
  zhizhuBannedTargetId?: string;
  qingshiTuntianTargetId?: string;
  ordeals?: BrawlOrdealState;
  wager?: BrawlWagerState;
}): Set<string> {
  const banned = new Set<string>();
  if (params.humanBagBanned?.activeBannedMission === params.mission && params.humanBagBanned.targetId) {
    banned.add(params.humanBagBanned.targetId);
  }
  if (params.imprisonedTargetId) {
    banned.add(params.imprisonedTargetId);
  }
  if (params.zhizhuBannedTargetId) {
    banned.add(params.zhizhuBannedTargetId);
  }
  if (params.qingshiTuntianTargetId) {
    banned.add(params.qingshiTuntianTargetId);
  }
  if (params.ordeals?.quicksandBannedPlayerId) {
    banned.add(params.ordeals.quicksandBannedPlayerId);
  }
  if (params.wager?.bannedMission === params.mission && params.wager.bannedPlayerId) {
    banned.add(params.wager.bannedPlayerId);
  }
  const ordealId = getActiveOrdealId(params.ordeals, params.mission);
  if (ordealId === 'selfless_captain' && params.captainId) {
    banned.add(params.captainId);
  }
  return banned;
}

/**
 * 防死锁护栏：校验再禁用 targetId 后，剩余可用人数是否仍 >= baseTeamSize
 */
export function canSafelyBanPlayer(
  totalPlayers: number,
  currentBanned: Set<string>,
  targetId: string,
  baseTeamSize: number,
): boolean {
  const nextBanned = new Set(currentBanned);
  nextBanned.add(targetId);
  return totalPlayers - nextBanned.size >= baseTeamSize;
}

/**
 * 进入新一难时刷新奇劫卡与弱水流沙/军令状受罚防死锁校验
 */
export function advanceMissionOrdeals(params: {
  mission: number;
  captainId: string;
  players: Player[];
  previousMissionTeam: string[];
  baseTeamSize: number;
  ordeals?: BrawlOrdealState;
  wager?: BrawlWagerState;
  rng?: () => number;
}): {
  ordealId?: BrawlOrdealId;
  quicksandBanned?: Player;
  wagerBanWaived?: boolean;
} {
  const rng = params.rng ?? Math.random;
  let wagerBanWaived = false;

  // 1. 校验军令状受罚禁选是否会导致死锁；如死锁则安全豁免
  if (params.wager?.bannedMission === params.mission && params.wager.bannedPlayerId) {
    const preBanned = collectMissionBannedPlayerIds({
      mission: params.mission,
      captainId: params.captainId,
      ordeals: params.ordeals ? { ...params.ordeals, currentOrdealId: params.ordeals.deck[params.mission - 1], quicksandBannedPlayerId: undefined } : undefined,
      wager: undefined,
    });
    if (!canSafelyBanPlayer(params.players.length, preBanned, params.wager.bannedPlayerId, params.baseTeamSize)) {
      params.wager.bannedPlayerId = undefined;
      params.wager.bannedMission = undefined;
      wagerBanWaived = true;
    }
  } else if (params.wager && params.wager.bannedMission && params.wager.bannedMission < params.mission) {
    params.wager.bannedPlayerId = undefined;
    params.wager.bannedMission = undefined;
  }

  if (!params.ordeals?.enabled) {
    return { wagerBanWaived };
  }

  const nextOrdealId = params.ordeals.deck[params.mission - 1];
  params.ordeals.currentOrdealId = nextOrdealId;
  params.ordeals.quicksandBannedPlayerId = undefined;
  params.ordeals.lastSwap = undefined;

  let quicksandBanned: Player | undefined;
  if (nextOrdealId === 'quicksand_ban' && params.mission >= 2 && params.previousMissionTeam.length > 0) {
    const existingBanned = collectMissionBannedPlayerIds({
      mission: params.mission,
      captainId: params.captainId,
      ordeals: params.ordeals,
      wager: params.wager,
    });
    const candidates = params.previousMissionTeam.filter(
      id => id !== params.captainId && !existingBanned.has(id) && canSafelyBanPlayer(params.players.length, existingBanned, id, params.baseTeamSize),
    );
    if (candidates.length > 0) {
      const pickedId = candidates[Math.floor(rng() * candidates.length)];
      params.ordeals.quicksandBannedPlayerId = pickedId;
      quicksandBanned = params.players.find(p => p.id === pickedId);
    }
  }

  return { ordealId: nextOrdealId, quicksandBanned, wagerBanWaived };
}

/**
 * 天意篡改：从未上车的可选玩家中随机抽 1 人，与车上随机 1 人公开对调
 */
export function applyCelestialSwap(params: {
  roundNumber: number;
  mission: number;
  team: string[];
  players: Player[];
  bannedIds: Set<string>;
  rng?: () => number;
}): {
  newTeam: string[];
  swapRecord?: {
    roundNumber: number;
    mission: number;
    removedId: string;
    removedSeat: number;
    removedNickname: string;
    addedId: string;
    addedSeat: number;
    addedNickname: string;
  };
} {
  const rng = params.rng ?? Math.random;
  if (params.team.length === 0) {
    return { newTeam: [...params.team] };
  }
  const offTeamEligible = params.players.filter(
    p => !params.team.includes(p.id) && !params.bannedIds.has(p.id),
  );
  if (offTeamEligible.length === 0) {
    return { newTeam: [...params.team] };
  }
  const removedId = params.team[Math.floor(rng() * params.team.length)];
  const addedPlayer = offTeamEligible[Math.floor(rng() * offTeamEligible.length)];
  const removedPlayer = params.players.find(p => p.id === removedId);
  if (!removedPlayer) {
    return { newTeam: [...params.team] };
  }

  const nextSet = new Set(params.team.filter(id => id !== removedId));
  nextSet.add(addedPlayer.id);
  const newTeam = params.players.filter(p => nextSet.has(p.id)).map(p => p.id);

  return {
    newTeam,
    swapRecord: {
      roundNumber: params.roundNumber,
      mission: params.mission,
      removedId: removedPlayer.id,
      removedSeat: removedPlayer.seat,
      removedNickname: removedPlayer.nickname,
      addedId: addedPlayer.id,
      addedSeat: addedPlayer.seat,
      addedNickname: addedPlayer.nickname,
    },
  };
}

/**
 * 画皮惑眼：从除孙悟空、唐三藏外的蓝方仙友中随机抽 1 人作为孙悟空眼中的假红妖气
 */
export function pickPhantomEvilTarget(
  playerStates: Record<string, { userId: string; roleId: string; camp: BrawlCamp }>,
  rng: () => number = Math.random,
): string | undefined {
  const candidates = Object.values(playerStates).filter(
    ps => ps.camp === 'blue' && ps.roleId !== 'sun_wukong' && ps.roleId !== 'tang_seng',
  );
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(rng() * candidates.length)].userId;
}

/**
 * 校验当前军令状是否允许立状
 */
export function canCaptainStakeWager(params: {
  brawlEnabled: boolean;
  mission: number;
  ordeals?: BrawlOrdealState;
  wager?: BrawlWagerState;
}): boolean {
  if (!params.brawlEnabled) return false;
  if (params.mission < 2 || params.mission > 4) return false;
  if ((params.wager?.redeemedCount ?? 0) >= 1) return false;
  if (params.wager?.pendingInspectorId) return false;
  if (getActiveOrdealId(params.ordeals, params.mission) === 'selfless_captain') return false;
  return true;
}
