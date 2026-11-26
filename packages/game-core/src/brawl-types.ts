import type {
  BrawlGameState,
  EarlyWindow,
  GameResult,
  GameView,
  Player,
  Role,
  RoleAssignmentAudit,
  RoundView,
  Settings,
  Team,
  TeamBallot,
} from '@avalon/contracts';

export const RULESET_VERSION = 'brawl-v2';

export class RuleError extends Error {}

export function requireRule(condition: unknown, code: string): asserts condition {
  if (!condition) throw new RuleError(code);
}

export interface RoleProtectionOptions {
  visionGuaranteedUserIds?: string[];
  blueGuaranteedUserIds?: string[];
  bossCooldownUserIds?: string[];
  /** Newest first, up to five recent dealt roles per player. */
  recentRoles?: Record<string, Role[]>;
  /** Role preference list per player (up to 5 brawl role IDs). */
  rolePreferences?: Record<string, string[]>;
  randomBelow?: (bound: bigint) => bigint;
}

export interface GameState {
  id: string;
  rulesetVersion: string;
  settings: Settings;
  players: Player[];
  roles: Record<string, Role>;
  roleAssignmentAudit?: RoleAssignmentAudit;
  dealEndsAt?: string;
  phase: GameView['phase'];
  mission: number;
  rejectionCount: number;
  captainOrder: string[];
  captainIndex: number;
  confirmed: string[];
  teamVotes: Record<string, TeamBallot>;
  missionVotes: Record<string, boolean>;
  rounds: RoundView[];
  draftTeam?: { playerIds: string[]; direction: RoundView['direction'] };
  teamVoteStartedAt?: string;
  earlyAssassination?: { used: boolean; windows: EarlyWindow[] };
  assassinationMode?: 'normal' | 'early';
  result?: GameResult;
  abortPoll?: { requestedBy: string; electorate: string[]; approvals: string[] };
  brawl?: BrawlGameState;
  brawlRoles?: Record<string, string>;
}

/** 5~12 人大乱斗各难出征人数表 */
export const BRAWL_MISSION_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
  11: [3, 4, 5, 5, 6],
  12: [3, 4, 5, 6, 6],
};

/** 经典模式人数表兼容 */
export const MISSION_SIZES: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
  11: [3, 4, 5, 5, 5],
  12: [3, 4, 5, 6, 6],
};

export const BRAWL_BASE_ROLE_CONFIG: Record<number, Role[]> = {
  5: ['merlin', 'percival', 'loyal', 'morgana', 'assassin'],
  6: ['merlin', 'percival', 'loyal', 'loyal', 'morgana', 'assassin'],
  7: ['merlin', 'percival', 'loyal', 'loyal', 'morgana', 'assassin', 'minion'],
  8: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'morgana', 'assassin', 'minion'],
  9: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'morgana', 'assassin', 'minion', 'minion'],
  10: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'loyal', 'morgana', 'assassin', 'minion', 'minion'],
  11: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'loyal', 'morgana', 'assassin', 'minion', 'minion', 'minion'],
  12: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'loyal', 'loyal', 'morgana', 'assassin', 'minion', 'minion', 'minion'],
};

export const ROLE_CONFIG: Record<number, Role[]> = {
  5: ['merlin', 'percival', 'loyal', 'morgana', 'assassin'],
  6: ['merlin', 'percival', 'loyal', 'loyal', 'morgana', 'assassin'],
  7: ['merlin', 'percival', 'loyal', 'loyal', 'morgana', 'assassin', 'oberon'],
  8: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'morgana', 'assassin', 'mordred'],
  9: ['merlin', 'percival', 'guinevere', 'loyal', 'loyal', 'loyal', 'morgana', 'assassin', 'mordred'],
  10: ['merlin', 'percival', 'guinevere', 'loyal', 'loyal', 'loyal', 'morgana', 'assassin', 'mordred', 'oberon'],
  11: ['merlin', 'percival', 'guinevere', 'loyal', 'loyal', 'loyal', 'morgana', 'assassin', 'mordred', 'minion', 'oberon'],
  12: ['merlin', 'percival', 'guinevere', 'loyal', 'loyal', 'loyal', 'loyal', 'morgana', 'assassin', 'mordred', 'minion', 'oberon'],
};

export const missionSizesFor = (playerCount: number, isBrawl = true): number[] =>
  (isBrawl ? BRAWL_MISSION_SIZES[playerCount] : MISSION_SIZES[playerCount]) ?? [2, 3, 2, 3, 3];

export const teamOf = (role: Role): Team =>
  ['merlin', 'percival', 'guinevere', 'loyal'].includes(role) ? 'blue' : 'red';

export const isEnded = (g: Pick<GameState, 'phase'>) =>
  g.phase === 'finished' || g.phase === 'aborted';

export const captain = (g: Pick<GameState, 'captainOrder' | 'captainIndex'>) =>
  g.captainOrder[g.captainIndex];

export const failuresRequiredFor = (playerCount: number, mission: number, isBrawl = true): number => {
  if (isBrawl) {
    // 11、12人局（6蓝5红 / 7蓝5红）：第3、4、5难均需2败
    if ((playerCount === 11 || playerCount === 12) && mission >= 3) return 2;
    // 9人局（5蓝4红）：第4、5难均需2败
    if (playerCount === 9 && mission >= 4) return 2;
    // 7、8、10人局：第4难需2败
    if (playerCount >= 7 && mission === 4) return 2;
    return 1;
  }
  return (playerCount >= 7 && mission === 4) || ((playerCount === 11 || playerCount === 12) && mission === 3) ? 2 : 1;
};

export const failuresRequired = (g: Pick<GameState, 'players' | 'mission'> & { brawl?: unknown }): number =>
  failuresRequiredFor(g.players.length, g.mission, Boolean(g.brawl));

export function getLiveMissionTeam(g: Pick<GameState, 'phase' | 'mission' | 'draftTeam' | 'rounds'>): string[] {
  if (g.phase === 'proposing' || g.phase === 'role_reveal') {
    return g.draftTeam?.playerIds ?? [];
  }
  const latest = g.rounds.at(-1);
  return latest && latest.mission === g.mission ? latest.team : [];
}
