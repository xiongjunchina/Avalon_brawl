import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAWL_ROLE_REGISTRY,
  BRAWL_SKILL_PROBS,
  BRAWL_MAX_REJECTIONS_BEFORE_FORCE,
  drawOrdealDeck,
  createGame,
  projectGame,
  transition,
  captain,
  missionSizesFor,
} from '../src/index.js';
import { defaultSettings } from '@avalon/contracts';

const makePlayers = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `仙友${i + 1}`,
    seat: i + 1,
  }));

test('module 0: Bai Longma feedback bug fixed & skill probability copy matches BRAWL_SKILL_PROBS', () => {
  const players = makePlayers(10);
  let game = createGame('fix-bailong', players, { ...defaultSettings, playerCount: 10, brawlModeEnabled: true }, a => a);
  const actorId = 'p1';
  game.brawl!.playerStates[actorId] = {
    userId: actorId,
    seat: 1,
    roleId: 'bai_longma',
    camp: 'blue',
    skillUsed: false,
  };
  game = transition(game, actorId, {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'longma_fuzhong' },
  }, players.map(p => p.id));

  const view = projectGame(game, actorId);
  assert.ok(view.selfBrawl?.generalFeedback?.includes('龙马负重'), 'Bai Longma feedback must trigger properly');

  // Verify probability single source of truth in descriptions
  assert.ok(BRAWL_ROLE_REGISTRY.yutu_jing.skill.description.includes(`${Math.round(BRAWL_SKILL_PROBS.YUTU_DISCARD * 100)}%`));
  assert.ok(BRAWL_ROLE_REGISTRY.jinjiao_dawang.skill.description.includes(`${Math.round(BRAWL_SKILL_PROBS.JINJIAO_ABSORB * 100)}%`));
  assert.ok(BRAWL_ROLE_REGISTRY.baiyan_mojun.skill.description.includes(`大车${Math.round(BRAWL_SKILL_PROBS.BAIYAN_BIG_TEAM * 100)}%/小车${Math.round(BRAWL_SKILL_PROBS.BAIYAN_SMALL_TEAM * 100)}%`));
});

test('module 0: server validates skillId, target requirement, self-target, and anti-deadlock ban limit', () => {
  const players = makePlayers(5);
  const onlineIds = players.map(p => p.id);
  const game = createGame('guard-test', players, { ...defaultSettings, playerCount: 5, brawlModeEnabled: true }, a => a);
  game.phase = 'proposing';
  game.brawl!.playerStates.p1 = { userId: 'p1', seat: 1, roleId: 'rulai_fozu', camp: 'blue', skillUsed: false };

  // Forged skillId rejected
  assert.throws(() => transition(game, 'p1', {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'jingang_zhuo' },
  }, onlineIds), /INVALID_SKILL/);

  // Missing target rejected
  assert.throws(() => transition(game, 'p1', {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'wuxingshan_zhang' },
  }, onlineIds), /TARGET_REQUIRED/);

  // Self target rejected
  assert.throws(() => transition(game, 'p1', {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'wuxingshan_zhang', targetPlayerId: 'p1' },
  }, onlineIds), /CANNOT_TARGET_SELF/);

  // Deadlock guard: 5p mission 4 needs 3 players; if 2 already banned, banning a 3rd would leave only 2 (< 3)
  game.mission = 4;
  game.brawl!.zhizhuBannedTargetId = 'p2';
  game.treasuresState = { humanBag: { used: true, targetId: 'p3', activeBannedMission: 4 } };
  assert.throws(() => transition(game, 'p1', {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'wuxingshan_zhang', targetPlayerId: 'p4' },
  }, onlineIds), /TOO_MANY_BANNED/);
});

test('module 1: Brawl mode fixed rule [Two Rejections Force Launch] skips vote on 3rd proposal and blocks vote-only skills', () => {
  const players = makePlayers(6);
  const onlineIds = players.map(p => p.id);
  let game = createGame('force-launch', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  game.phase = 'proposing';
  game.captainOrder = onlineIds;
  game.captainIndex = 0;

  // Give p6 Nezha double vote to verify forced launch blocks vote-only skills
  game.brawl!.playerStates.p6 = { userId: 'p6', seat: 6, roleId: 'nezha', camp: 'blue', skillUsed: false };

  const teamSize = missionSizesFor(6, true)[0];

  // Proposal 1 -> Rejected (rejectionCount = 1)
  game = transition(game, captain(game), { type: 'proposeTeam', payload: { playerIds: ['p1', 'p2'].slice(0, teamSize), direction: 'clockwise' } }, onlineIds);
  game = transition(game, captain(game), { type: 'startTeamVote', payload: {} }, onlineIds);
  assert.equal(game.phase, 'team_vote');
  for (const pid of onlineIds) {
    game = transition(game, pid, { type: 'teamVote', payload: { approve: false } }, onlineIds);
  }
  assert.equal(game.rejectionCount, 1);
  assert.equal(game.phase, 'proposing');

  // Proposal 2 -> Rejected (rejectionCount = 2)
  game = transition(game, captain(game), { type: 'proposeTeam', payload: { playerIds: ['p2', 'p3'].slice(0, teamSize), direction: 'clockwise' } }, onlineIds);
  game = transition(game, captain(game), { type: 'startTeamVote', payload: {} }, onlineIds);
  assert.equal(game.phase, 'team_vote');
  for (const pid of onlineIds) {
    game = transition(game, pid, { type: 'teamVote', payload: { approve: false } }, onlineIds);
  }
  assert.equal(game.rejectionCount, BRAWL_MAX_REJECTIONS_BEFORE_FORCE);
  assert.equal(game.phase, 'proposing');

  // On 3rd proposal (forced launch), vote-only skill Nezha is blocked to prevent wasting it
  assert.throws(() => transition(game, 'p6', {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'santou_liubi' },
  }, onlineIds), /FORCED_LAUNCH_NO_VOTE/);

  // Proposal 3 -> discussion -> startTeamVote skips team_vote and goes STRAIGHT to mission!
  game = transition(game, captain(game), { type: 'proposeTeam', payload: { playerIds: ['p3', 'p4'].slice(0, teamSize), direction: 'clockwise' } }, onlineIds);
  assert.equal(game.phase, 'discussion', 'Still pauses in discussion for pre-mission skills');
  game = transition(game, captain(game), { type: 'startTeamVote', payload: {} }, onlineIds);
  assert.equal(game.phase, 'mission', 'Forced launch skips team_vote directly into mission');
  assert.equal(game.rounds.at(-1)?.vote?.forced, true, 'Round vote records forced launch flag');
  assert.equal(game.rounds.at(-1)?.vote?.passed, true);

  // Mission resolves -> rejectionCount resets to 0 for Mission 2 even when rejectionScope is game!
  for (const pid of game.rounds.at(-1)!.team) {
    game = transition(game, pid, { type: 'missionVote', payload: { success: true } }, onlineIds);
  }
  assert.equal(game.mission, 2);
  assert.equal(game.rejectionCount, 0, 'Brawl always resets rejectionCount to 0 on next mission');
});

test('module 2: Public anonymous broadcast whitelist exposes overt skills live while hiding silent skills', () => {
  const players = makePlayers(10);
  const onlineIds = players.map(p => p.id);
  let game = createGame('broadcast-whitelist', players, { ...defaultSettings, playerCount: 10, brawlModeEnabled: true }, a => a);
  game.phase = 'proposing';
  game.brawl!.playerStates.p1 = { userId: 'p1', seat: 1, roleId: 'bai_longma', camp: 'blue', skillUsed: false };
  game.brawl!.playerStates.p2 = { userId: 'p2', seat: 2, roleId: 'bai_gujing', camp: 'red', skillUsed: false };

  // Silent skill (Bai Gujing) produces NO live public event
  game = transition(game, 'p2', { type: 'brawlCommand', payload: { action: 'useSkill', skillId: 'huapi_lijian' } }, onlineIds);
  assert.equal(projectGame(game, 'p5').brawl?.events.length, 0);

  // Overt skill (Bai Longma) appears in live public events anonymously (no actor seat/name)
  game = transition(game, 'p1', { type: 'brawlCommand', payload: { action: 'useSkill', skillId: 'longma_fuzhong' } }, onlineIds);
  const liveEvents = projectGame(game, 'p5').brawl?.events ?? [];
  assert.equal(liveEvents.length, 1);
  assert.equal(liveEvents[0].roleId, 'bai_longma');
  assert.equal(liveEvents[0].visibility, 'anonymous_broadcast');
  assert.ok(!liveEvents[0].summary.includes('仙友1'), 'Must remain anonymous');
});

test('module 2: 5-8 player brawl assigns unique compatible bonus skills to all 4 core roles and executes them cleanly', () => {
  for (const count of [5, 6, 7, 8]) {
    const players = makePlayers(count);
    const game = createGame(`bonus-${count}p`, players, { ...defaultSettings, playerCount: count, brawlModeEnabled: true }, a => a);
    const states = Object.values(game.brawl!.playerStates);
    const assignedRoles = new Set(states.map(s => s.roleId));
    const coreStates = states.filter(s => ['sun_wukong', 'tang_seng', 'hong_haier', 'liuer_mihou'].includes(s.roleId));
    assert.equal(coreStates.length, 4);

    const bonusIds = new Set<string>();
    for (const cs of coreStates) {
      assert.ok(cs.bonusRoleId, `${count}p core ${cs.roleId} must receive a bonus skill role`);
      assert.ok(!assignedRoles.has(cs.bonusRoleId!), 'Bonus role must not duplicate an already-in-play role');
      assert.equal(BRAWL_ROLE_REGISTRY[cs.bonusRoleId!].camp, cs.camp, 'Bonus role must match core camp');
      assert.notEqual(BRAWL_ROLE_REGISTRY[cs.bonusRoleId!].skill.actionType, 'passive', 'Bonus skill must be active');
      assert.notEqual(cs.bonusRoleId, 'niu_mowang', 'Bonus role excludes Niu Mowang lone-wolf copy');
      bonusIds.add(cs.bonusRoleId!);

      const view = projectGame(game, cs.userId);
      assert.equal(view.selfBrawl?.bonusRoleId, cs.bonusRoleId);
      assert.equal(view.selfBrawl?.skill.skillId, BRAWL_ROLE_REGISTRY[cs.bonusRoleId!].skill.skillId);
    }
    assert.equal(bonusIds.size, 4, 'All 4 core bonus roles are distinct');
  }

  // 9-12 player games do NOT assign bonus skills
  const game9 = createGame('no-bonus-9p', makePlayers(9), { ...defaultSettings, playerCount: 9, brawlModeEnabled: true }, a => a);
  assert.equal(Object.values(game9.brawl!.playerStates).some(s => s.bonusRoleId), false);
});

test('module 3: Ordeal deck draws 5 unique cards and never puts quicksand_ban on Mission 1; future deck scrubbed in projectGame', () => {
  for (let i = 0; i < 100; i++) {
    const deck = drawOrdealDeck();
    assert.equal(deck.length, 5);
    assert.equal(new Set(deck).size, 5);
    assert.notEqual(deck[0], 'quicksand_ban', 'quicksand_ban must never be Mission 1');
  }

  const players = makePlayers(6);
  const game = createGame('ordeal-scrub', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true, brawlOrdealsEnabled: true }, a => a);
  assert.equal(game.brawl?.ordeals?.deck.length, 5);
  const liveView = projectGame(game, 'p1');
  assert.equal(liveView.brawl?.ordeals?.deck.length, 1, 'Future missions ordeal deck must be scrubbed during active game');
});

test('module 3: Ordeal [chaotic_fog] physically masks card counts during game and decrypts on game end', () => {
  const players = makePlayers(6);
  const onlineIds = players.map(p => p.id);
  let game = createGame('fog-test', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true, brawlOrdealsEnabled: true }, a => a);
  game.brawl!.ordeals!.deck = ['chaotic_fog', 'selfless_captain', 'shituo_bounty', 'quicksand_ban', 'celestial_swap'];
  game.brawl!.ordeals!.currentOrdealId = 'chaotic_fog';
  game.phase = 'mission';
  game.rounds.push({ number: 1, mission: 1, captainId: 'p1', team: ['p1', 'p2'], direction: 'clockwise' });

  game = transition(game, 'p1', { type: 'missionVote', payload: { success: true } }, onlineIds);
  game = transition(game, 'p2', { type: 'missionVote', payload: { success: true } }, onlineIds);

  // Authoritative state retains true counts
  assert.equal(game.rounds[0].result?.successes, 2);
  assert.equal(game.rounds[0].result?.failures, 0);
  assert.equal(game.rounds[0].result?.masked, true);

  // Live projected view scrubs counts to -1
  const liveView = projectGame(game, 'p1');
  assert.equal(liveView.rounds[0].result?.masked, true);
  assert.equal(liveView.rounds[0].result?.successes, -1);
  assert.equal(liveView.rounds[0].result?.failures, -1);
  assert.equal(liveView.rounds[0].result?.passed, true);

  // End game -> counts decrypted!
  game = transition(game, 'p1', { type: 'endGame', payload: {} }, onlineIds, { hostId: 'p1', now: Date.now() });
  const endedView = projectGame(game, 'p1');
  assert.equal(endedView.rounds[0].result?.successes, 2);
  assert.equal(endedView.rounds[0].result?.failures, 0);
});

test('module 3: Ordeal [selfless_captain] forbids captain from picking self; [quicksand_ban] bans 1 random prior member', () => {
  const players = makePlayers(6);
  const onlineIds = players.map(p => p.id);
  let game = createGame('selfless-quicksand', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true, brawlOrdealsEnabled: true }, a => a);
  game.captainOrder = onlineIds;
  game.captainIndex = 0; // p1 is captain
  game.brawl!.ordeals!.deck = ['selfless_captain', 'quicksand_ban', 'chaotic_fog', 'shituo_bounty', 'celestial_swap'];
  game.brawl!.ordeals!.currentOrdealId = 'selfless_captain';
  game.phase = 'proposing';

  // Captain p1 picking self rejected
  assert.throws(() => transition(game, 'p1', {
    type: 'proposeTeam',
    payload: { playerIds: ['p1', 'p2'], direction: 'clockwise' },
  }, onlineIds), /CAPTAIN_CANNOT_PICK_SELF_SELFLESS/);

  // Captain p1 picking p3 & p4 succeeds -> approve -> pass mission 1 -> enter mission 2 (quicksand_ban)
  game = transition(game, 'p1', { type: 'proposeTeam', payload: { playerIds: ['p3', 'p4'], direction: 'clockwise' } }, onlineIds);
  game = transition(game, 'p1', { type: 'startTeamVote', payload: {} }, onlineIds);
  for (const pid of onlineIds) {
    game = transition(game, pid, { type: 'teamVote', payload: { approve: true } }, onlineIds);
  }
  game = transition(game, 'p3', { type: 'missionVote', payload: { success: true } }, onlineIds);
  game = transition(game, 'p4', { type: 'missionVote', payload: { success: true } }, onlineIds);

  assert.equal(game.mission, 2);
  assert.equal(game.brawl?.ordeals?.currentOrdealId, 'quicksand_ban');
  const bannedId = game.brawl?.ordeals?.quicksandBannedPlayerId;
  assert.ok(bannedId === 'p3' || bannedId === 'p4', 'Quicksand bans 1 player from previous mission team');
  assert.notEqual(bannedId, captain(game), 'Quicksand excludes current captain');

  // Captain p2 trying to pick bannedId rejected
  assert.throws(() => transition(game, captain(game), {
    type: 'proposeTeam',
    payload: { playerIds: [bannedId!, 'p5', 'p6'], direction: 'clockwise' },
  }, onlineIds), /PLAYER_BANNED_BY_QUICKSAND/);
});

test('module 3: Ordeal [celestial_swap] swaps 1 on-team with 1 off-team publicly and locks discussion edits', () => {
  const players = makePlayers(6);
  const onlineIds = players.map(p => p.id);
  let game = createGame('celestial-swap', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true, brawlOrdealsEnabled: true }, a => a);
  game.captainOrder = onlineIds;
  game.captainIndex = 0;
  game.brawl!.ordeals!.deck = ['celestial_swap', 'chaotic_fog', 'selfless_captain', 'shituo_bounty', 'quicksand_ban'];
  game.brawl!.ordeals!.currentOrdealId = 'celestial_swap';
  game.phase = 'proposing';

  game = transition(game, 'p1', { type: 'proposeTeam', payload: { playerIds: ['p1', 'p2'], direction: 'clockwise' } }, onlineIds);
  assert.equal(game.phase, 'discussion');
  const swap = game.brawl?.ordeals?.lastSwap;
  assert.ok(swap, 'Swap record generated');
  assert.ok(['p1', 'p2'].includes(swap!.removedId), 'Removed player came from proposed team');
  assert.ok(!['p1', 'p2'].includes(swap!.addedId), 'Added player came from off-team players');
  assert.equal(game.rounds[0].team.length, 2);
  assert.ok(game.rounds[0].team.includes(swap!.addedId));
  assert.ok(!game.rounds[0].team.includes(swap!.removedId));

  // Captain CANNOT undo swap via updateTeamDraft in discussion!
  assert.throws(() => transition(game, 'p1', {
    type: 'updateTeamDraft',
    payload: { playerIds: ['p1', 'p2'], direction: 'clockwise' },
  }, onlineIds), /CANNOT_EDIT_AFTER_CELESTIAL_SWAP/);
});

test('module 3: Ordeal [shituo_bounty] reveals demon on Blue win and excludes extra non-Wukong seat on Red win', () => {
  const players = makePlayers(8);
  const onlineIds = players.map(p => p.id);
  let gameBlue = createGame('shituo-blue', players, { ...defaultSettings, playerCount: 8, brawlModeEnabled: true, brawlOrdealsEnabled: true }, a => a);
  gameBlue.brawl!.ordeals!.deck = ['shituo_bounty', 'chaotic_fog', 'selfless_captain', 'quicksand_ban', 'celestial_swap'];
  gameBlue.brawl!.ordeals!.currentOrdealId = 'shituo_bounty';
  gameBlue.phase = 'mission';
  gameBlue.rounds.push({ number: 1, mission: 1, captainId: 'p1', team: ['p1', 'p2', 'p3'], direction: 'clockwise' });
  for (const pid of ['p1', 'p2', 'p3']) {
    gameBlue = transition(gameBlue, pid, { type: 'missionVote', payload: { success: true } }, onlineIds);
  }
  assert.ok(gameBlue.brawl?.ordeals?.shituoRevealedDemonName, 'Blue victory reveals a demon name publicly');

  // Red win arms assassination exclude
  let gameRed = createGame('shituo-red', players, { ...defaultSettings, playerCount: 8, brawlModeEnabled: true, brawlOrdealsEnabled: true }, a => a);
  gameRed.brawl!.ordeals!.deck = ['shituo_bounty', 'chaotic_fog', 'selfless_captain', 'quicksand_ban', 'celestial_swap'];
  gameRed.brawl!.ordeals!.currentOrdealId = 'shituo_bounty';
  const redP = players.find(p => gameRed.brawl!.playerStates[p.id].camp === 'red')!;
  const bluePs = players.filter(p => gameRed.brawl!.playerStates[p.id].camp === 'blue');
  gameRed.phase = 'mission';
  gameRed.rounds.push({ number: 1, mission: 1, captainId: redP.id, team: [redP.id, bluePs[0].id, bluePs[1].id], direction: 'clockwise' });
  gameRed = transition(gameRed, redP.id, { type: 'missionVote', payload: { success: false } }, onlineIds);
  gameRed = transition(gameRed, bluePs[0].id, { type: 'missionVote', payload: { success: true } }, onlineIds);
  gameRed = transition(gameRed, bluePs[1].id, { type: 'missionVote', payload: { success: true } }, onlineIds);
  assert.equal(gameRed.brawl?.ordeals?.shituoRedBountyArmed, true);

  // Trigger assassination -> shituoExcludedPlayerId is populated for Hong Haier, never Sun Wukong, scrubbed for Blue
  const wukongId = players.find(p => gameRed.brawl!.playerStates[p.id].roleId === 'sun_wukong')!.id;
  const honghaierId = players.find(p => gameRed.brawl!.playerStates[p.id].roleId === 'hong_haier')!.id;
  gameRed.rounds.push(
    { number: 2, mission: 2, captainId: 'p1', team: ['p1', 'p2'], direction: 'clockwise', result: { successes: 2, failures: 0, passed: true } },
    { number: 3, mission: 3, captainId: 'p1', team: ['p1', 'p2'], direction: 'clockwise', result: { successes: 2, failures: 0, passed: true } },
    { number: 4, mission: 4, captainId: 'p1', team: [bluePs[0].id, bluePs[1].id], direction: 'clockwise' },
  );
  gameRed.phase = 'mission';
  gameRed = transition(gameRed, bluePs[0].id, { type: 'missionVote', payload: { success: true } }, onlineIds);
  gameRed = transition(gameRed, bluePs[1].id, { type: 'missionVote', payload: { success: true } }, onlineIds);
  assert.equal(gameRed.phase, 'assassination');
  const exId = gameRed.brawl?.ordeals?.shituoExcludedPlayerId;
  assert.ok(exId && exId !== wukongId, 'Shituo exclude picks a non-Wukong seat');
  assert.equal(projectGame(gameRed, honghaierId).selfBrawl?.shituoExcludedPlayerId, exId);
  assert.equal(projectGame(gameRed, wukongId).selfBrawl?.shituoExcludedPlayerId, undefined);
});

test('module 4: Military Wager enforces mission 2-4, captain-on-team, 1x redemption inspection (respecting Huangmei stealth), and failure ban', () => {
  const players = makePlayers(9);
  const onlineIds = players.map(p => p.id);
  let game = createGame('wager-test', players, { ...defaultSettings, playerCount: 9, brawlModeEnabled: true }, a => a);
  game.captainOrder = onlineIds;
  game.captainIndex = 0;
  game.phase = 'proposing';

  // Mission 1: Wager unavailable
  assert.throws(() => transition(game, 'p1', {
    type: 'proposeTeam',
    payload: { playerIds: ['p1', 'p2', 'p3'], direction: 'clockwise', militaryWager: true },
  }, onlineIds), /WAGER_UNAVAILABLE/);

  // Mission 2: Must include captain
  game.mission = 2;
  assert.throws(() => transition(game, 'p1', {
    type: 'proposeTeam',
    payload: { playerIds: ['p2', 'p3', 'p4', 'p5'], direction: 'clockwise', militaryWager: true },
  }, onlineIds), /WAGER_REQUIRES_CAPTAIN_ON_TEAM/);

  // Mission 2: Captain p1 stakes wager with self on team -> succeeds -> unlocks 1 inspection
  game = transition(game, 'p1', {
    type: 'proposeTeam',
    payload: { playerIds: ['p1', 'p2', 'p3', 'p4'], direction: 'clockwise', militaryWager: true },
  }, onlineIds);
  assert.equal(game.rounds.at(-1)?.militaryWager, true);
  game = transition(game, 'p1', { type: 'startTeamVote', payload: {} }, onlineIds);
  for (const pid of onlineIds) {
    game = transition(game, pid, { type: 'teamVote', payload: { approve: true } }, onlineIds);
  }
  for (const pid of ['p1', 'p2', 'p3', 'p4']) {
    game = transition(game, pid, { type: 'missionVote', payload: { success: true } }, onlineIds);
  }

  assert.equal(game.brawl?.wager?.redeemedCount, 1);
  assert.equal(game.brawl?.wager?.pendingInspectorId, 'p1');
  assert.equal(projectGame(game, 'p1').selfBrawl?.canWagerInspect, true);
  assert.equal(projectGame(game, 'p2').selfBrawl?.canWagerInspect, undefined);

  // Inspect Huangmei Laoguai -> appears blue (stealth respected!)
  const huangmeiId = players.find(p => game.brawl!.playerStates[p.id].roleId === 'huangmei_laoguai' && p.id !== 'p1')?.id;
  const targetInspectId = huangmeiId ?? players.find(p => p.id !== 'p1')!.id;
  game = transition(game, 'p1', {
    type: 'brawlCommand',
    payload: { action: 'wagerInspect', targetPlayerId: targetInspectId },
  }, onlineIds);

  const p1View = projectGame(game, 'p1');
  assert.equal(p1View.selfBrawl?.canWagerInspect, undefined);
  assert.ok(p1View.selfBrawl?.wagerInspectResult);
  if (huangmeiId) {
    assert.equal(p1View.selfBrawl?.wagerInspectResult?.team, 'blue', 'Huangmei stealth shows blue to wager inspect');
  }
  // Scrubbed for other players
  assert.equal(projectGame(game, 'p2').brawl?.wager?.inspectResult, undefined);

  // Already redeemed once -> cannot stake wager again on Mission 3!
  assert.throws(() => transition(game, captain(game), {
    type: 'proposeTeam',
    payload: { playerIds: [captain(game), 'p3', 'p4', 'p5'], direction: 'clockwise', militaryWager: true },
  }, onlineIds), /WAGER_UNAVAILABLE/);

  // Test failure penalty in a separate game
  let failGame = createGame('wager-fail', players, { ...defaultSettings, playerCount: 9, brawlModeEnabled: true }, a => a);
  const redCap = players.find(p => failGame.brawl!.playerStates[p.id].camp === 'red')!;
  failGame.captainOrder = [redCap.id, ...onlineIds.filter(id => id !== redCap.id)];
  failGame.captainIndex = 0;
  failGame.mission = 2;
  failGame.phase = 'proposing';
  const others = onlineIds.filter(id => id !== redCap.id).slice(0, 3);
  failGame = transition(failGame, redCap.id, {
    type: 'proposeTeam',
    payload: { playerIds: [redCap.id, ...others], direction: 'clockwise', militaryWager: true },
  }, onlineIds);
  failGame = transition(failGame, redCap.id, { type: 'startTeamVote', payload: {} }, onlineIds);
  for (const pid of onlineIds) {
    failGame = transition(failGame, pid, { type: 'teamVote', payload: { approve: true } }, onlineIds);
  }
  failGame = transition(failGame, redCap.id, { type: 'missionVote', payload: { success: false } }, onlineIds);
  for (const pid of others) {
    failGame = transition(failGame, pid, { type: 'missionVote', payload: { success: true } }, onlineIds);
  }

  assert.equal(failGame.mission, 3);
  assert.equal(failGame.brawl?.wager?.bannedPlayerId, redCap.id);
  assert.equal(failGame.brawl?.wager?.bannedMission, 3);
  assert.throws(() => transition(failGame, captain(failGame), {
    type: 'proposeTeam',
    payload: { playerIds: [redCap.id, ...others], direction: 'clockwise' },
  }, onlineIds), /PLAYER_BANNED_BY_WAGER/);
});

test('module 4: Phantom Vision [画皮惑眼] mixes 1 innocent blue into Sun Wukong evilIds and scrubs phantomEvilId mid-game', () => {
  const players = makePlayers(8);
  const game = createGame('phantom-vision', players, {
    ...defaultSettings,
    playerCount: 8,
    brawlModeEnabled: true,
    brawlPhantomVisionEnabled: true,
  }, a => a);

  const phantomId = game.brawl?.phantomEvilId;
  assert.ok(phantomId, 'Phantom evil target assigned');
  assert.equal(game.brawl!.playerStates[phantomId!].camp, 'blue');
  assert.notEqual(game.brawl!.playerStates[phantomId!].roleId, 'sun_wukong');
  assert.notEqual(game.brawl!.playerStates[phantomId!].roleId, 'tang_seng');

  const wukongId = players.find(p => game.brawl!.playerStates[p.id].roleId === 'sun_wukong')!.id;
  const wukongView = projectGame(game, wukongId);
  assert.equal(wukongView.selfBrawl?.phantomVisionActive, true);
  assert.ok(wukongView.self?.evilIds.includes(phantomId!), 'Sun Wukong sees phantom evil blue player in evilIds');
  assert.equal(wukongView.brawl?.phantomEvilId, undefined, 'phantomEvilId is scrubbed mid-game');

  // Red players do NOT see the innocent blue player as a red teammate
  const honghaierId = players.find(p => game.brawl!.playerStates[p.id].roleId === 'hong_haier')!.id;
  const redView = projectGame(game, honghaierId);
  assert.ok(!redView.self?.evilIds.includes(phantomId!), 'Red players do not see phantom blue as teammate');
});

test('skill feedback & guards: Li Tianwang requires non-empty current team and retains result across mission transitions', () => {
  const players = makePlayers(6);
  const onlineIds = players.map(p => p.id);
  let game = createGame('li-tianwang-persist', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  game.captainOrder = onlineIds;
  game.captainIndex = 0;
  game.phase = 'proposing';

  // Force p1=li_tianwang (blue), p2=blue, p3=red
  game.roles.p1 = 'loyal';
  game.brawlRoles!.p1 = 'li_tianwang';
  game.brawl!.playerStates.p1 = { userId: 'p1', seat: 1, roleId: 'li_tianwang', camp: 'blue', skillUsed: false };
  game.roles.p2 = 'loyal';
  game.brawl!.playerStates.p2 = { userId: 'p2', seat: 2, roleId: 'bai_longma', camp: 'blue', skillUsed: false };
  game.roles.p3 = 'assassin';
  game.brawl!.playerStates.p3 = { userId: 'p3', seat: 3, roleId: 'hong_haier', camp: 'red', skillUsed: false };

  // Empty team rejected with TEAM_NOT_READY without consuming skill!
  assert.throws(() => transition(game, 'p1', {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'zhaoyao_baojing' },
  }, onlineIds), /TEAM_NOT_READY/);
  assert.equal(game.brawl!.playerStates.p1.skillUsed, false, 'Skill NOT consumed when team is empty');

  // Propose team [p2, p3] -> Li Tianwang inspects during discussion -> sees demon
  game = transition(game, 'p1', { type: 'proposeTeam', payload: { playerIds: ['p2', 'p3'], direction: 'clockwise' } }, onlineIds);
  game = transition(game, 'p1', { type: 'brawlCommand', payload: { action: 'useSkill', skillId: 'zhaoyao_baojing' } }, onlineIds);
  const viewDuringM1 = projectGame(game, 'p1');
  assert.equal(viewDuringM1.selfBrawl?.zhaoyaoResult, true);
  assert.ok(viewDuringM1.selfBrawl?.zhaoyaoDetail?.includes('2号仙友2、3号仙友3'));
  assert.ok(viewDuringM1.selfBrawl?.zhaoyaoDetail?.includes('有妖魔潜伏'));
  // Scrubbed for other players
  assert.equal(projectGame(game, 'p2').selfBrawl?.zhaoyaoResult, undefined);
  assert.equal(projectGame(game, 'p2').brawl?.privateReceipts, undefined);

  // Advance through vote & Mission 1 into Mission 2 -> Li Tianwang's result MUST persist!
  game = transition(game, 'p1', { type: 'startTeamVote', payload: {} }, onlineIds);
  for (const pid of onlineIds) {
    game = transition(game, pid, { type: 'teamVote', payload: { approve: true } }, onlineIds);
  }
  game = transition(game, 'p2', { type: 'missionVote', payload: { success: true } }, onlineIds);
  game = transition(game, 'p3', { type: 'missionVote', payload: { success: true } }, onlineIds);

  assert.equal(game.mission, 2);
  const viewInM2 = projectGame(game, 'p1');
  assert.equal(viewInM2.selfBrawl?.zhaoyaoResult, true, 'Li Tianwang zhaoyaoResult survives resetRoundBrawlEffects into Mission 2');
  assert.ok(viewInM2.selfBrawl?.zhaoyaoDetail?.includes('第 1 难'), 'Retains exact inspected mission & team detail');
});

test('skill feedback & refund: armed mission skills auto-refund on rejected vote and log 0-failure outcomes cleanly', () => {
  const players = makePlayers(6);
  const onlineIds = players.map(p => p.id);
  let game = createGame('skill-refund-test', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  game.captainOrder = onlineIds;
  game.captainIndex = 0;
  game.phase = 'proposing';

  game.roles.p1 = 'loyal';
  game.brawl!.playerStates.p1 = { userId: 'p1', seat: 1, roleId: 'wangmu_niangniang', camp: 'blue', skillUsed: false };
  game.roles.p2 = 'loyal';
  game.brawl!.playerStates.p2 = { userId: 'p2', seat: 2, roleId: 'guanyin_pusa', camp: 'blue', skillUsed: false };
  game.roles.p3 = 'minion';
  game.brawl!.playerStates.p3 = { userId: 'p3', seat: 3, roleId: 'bai_gujing', camp: 'red', skillUsed: false };

  game = transition(game, 'p1', { type: 'proposeTeam', payload: { playerIds: ['p1', 'p2'], direction: 'clockwise' } }, onlineIds);
  // Arm Wangmu, Guanyin, and Baigujing during discussion
  game = transition(game, 'p1', { type: 'brawlCommand', payload: { action: 'useSkill', skillId: 'jiuzhuan_xiantao' } }, onlineIds);
  game = transition(game, 'p2', { type: 'brawlCommand', payload: { action: 'useSkill', skillId: 'jingping_ganlu', targetPlayerId: 'p1' } }, onlineIds);
  game = transition(game, 'p3', { type: 'brawlCommand', payload: { action: 'useSkill', skillId: 'huapi_lijian' } }, onlineIds);
  assert.equal(game.brawl!.playerStates.p1.skillUsed, true);
  assert.equal(game.brawl!.playerStates.p2.skillUsed, true);
  assert.equal(game.brawl!.playerStates.p3.skillUsed, true);

  // Proposal gets REJECTED in teamVote -> all 3 skills auto-refund!
  game = transition(game, 'p1', { type: 'startTeamVote', payload: {} }, onlineIds);
  for (const pid of onlineIds) {
    game = transition(game, pid, { type: 'teamVote', payload: { approve: false } }, onlineIds);
  }
  assert.equal(game.brawl!.playerStates.p1.skillUsed, false, 'Wangmu refunded after rejected vote');
  assert.equal(game.brawl!.playerStates.p2.skillUsed, false, 'Guanyin refunded after rejected vote');
  assert.equal(game.brawl!.playerStates.p3.skillUsed, false, 'Baigujing refunded after rejected vote');
  assert.ok(projectGame(game, 'p1').selfBrawl?.generalFeedback?.includes('自动退还'), 'Wangmu gets refund receipt');

  // Re-arm Wangmu & Baigujing on passing 0-failure mission -> both get explicit no-failure receipts & replay entries
  const cap2 = captain(game);
  game = transition(game, cap2, { type: 'proposeTeam', payload: { playerIds: ['p1', 'p2'], direction: 'clockwise' } }, onlineIds);
  game = transition(game, 'p1', { type: 'brawlCommand', payload: { action: 'useSkill', skillId: 'jiuzhuan_xiantao' } }, onlineIds);
  game = transition(game, 'p3', { type: 'brawlCommand', payload: { action: 'useSkill', skillId: 'huapi_lijian' } }, onlineIds);
  game = transition(game, cap2, { type: 'startTeamVote', payload: {} }, onlineIds);
  for (const pid of onlineIds) {
    game = transition(game, pid, { type: 'teamVote', payload: { approve: true } }, onlineIds);
  }
  game = transition(game, 'p1', { type: 'missionVote', payload: { success: true } }, onlineIds);
  game = transition(game, 'p2', { type: 'missionVote', payload: { success: true } }, onlineIds);

  assert.ok(projectGame(game, 'p1').selfBrawl?.generalFeedback?.includes('无需化解'), 'Wangmu gets explicit 0-failure receipt');
  assert.ok(projectGame(game, 'p3').selfBrawl?.generalFeedback?.includes('未能触发'), 'Baigujing gets explicit 0-failure receipt');
  assert.ok(game.brawl!.replayTimeline!.some(a => a.roleId === 'wangmu_niangniang' && a.outcome === 'miss' && a.detail.includes('0 张失败牌')));
  assert.ok(game.brawl!.replayTimeline!.some(a => a.roleId === 'bai_gujing' && a.outcome === 'miss' && a.detail.includes('0 张失败牌')));
});
