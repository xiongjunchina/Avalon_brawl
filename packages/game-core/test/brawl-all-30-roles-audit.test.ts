import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BRAWL_ROLE_REGISTRY,
  PUBLIC_BROADCAST_ROLE_IDS,
  createGame,
  projectGame,
  transition,
  captain,
  resetRoundBrawlEffects,
} from '../src/index.js';
import { defaultSettings } from '@avalon/contracts';

const makePlayers = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `仙友${i + 1}`,
    seat: i + 1,
  }));

test('30-role integrity: all 30 Brawl roles have unique IDs/skills/artPrefix and verified webp assets on disk', () => {
  const roles = Object.values(BRAWL_ROLE_REGISTRY);
  assert.equal(roles.length, 30);
  assert.equal(roles.filter(r => r.camp === 'blue').length, 15);
  assert.equal(roles.filter(r => r.camp === 'red').length, 15);

  const skillIds = new Set<string>();
  const artPrefixes = new Set<string>();
  const artDir = path.resolve(process.cwd(), 'apps/web/public/art/roles');

  for (const r of roles) {
    assert.ok(!skillIds.has(r.skill.skillId), `Duplicate skillId: ${r.skill.skillId}`);
    skillIds.add(r.skill.skillId);
    assert.ok(!artPrefixes.has(r.artPrefix), `Duplicate artPrefix: ${r.artPrefix}`);
    artPrefixes.add(r.artPrefix);
    assert.ok(r.skill.description.length <= 45, `${r.id} description exceeds 45 chars: ${r.skill.description}`);

    const smallPath = path.join(artDir, `${r.artPrefix}-160.webp`);
    const largePath = path.join(artDir, `${r.artPrefix}-640.webp`);
    assert.ok(fs.existsSync(smallPath) && fs.statSync(smallPath).size > 1000, `Missing/empty asset: ${smallPath}`);
    assert.ok(fs.existsSync(largePath) && fs.statSync(largePath).size > 5000, `Missing/empty asset: ${largePath}`);
  }
});

test('30-role matrix: all 24 active skills execute cleanly, respect broadcast whitelist, record replay & persistent feedback', () => {
  const roles = Object.values(BRAWL_ROLE_REGISTRY);
  const passiveOrCoreIds = new Set(['sun_wukong', 'tang_seng', 'erlang_shen', 'hong_haier', 'liuer_mihou', 'laoshu_jing']);
  const activeRoles = roles.filter(r => !passiveOrCoreIds.has(r.id));
  assert.equal(activeRoles.length, 24, 'Exactly 24 active brawl skills');

  const players = makePlayers(10);
  const onlineIds = players.map(p => p.id);

  for (const roleDef of activeRoles) {
    let game = createGame(`audit-${roleDef.id}`, players, { ...defaultSettings, playerCount: 10, brawlModeEnabled: true }, a => a);
    game.captainOrder = [...onlineIds];
    game.captainIndex = 0; // p1 is captain
    game.phase = 'discussion';
    game.mission = 2; // satisfies mission >= 2 for puti_zhushi
    game.rounds.push({
      number: 1,
      mission: 2,
      captainId: 'p1',
      team: ['p1', 'p2', 'p3', 'p4'],
      direction: 'clockwise',
    });

    // Place actor at p5 (non-captain) and ensure target p2 (non-captain, non-self, on-team)
    const actorId = 'p5';
    const targetId = 'p2';
    game.roles[actorId] = roleDef.camp === 'blue' ? 'loyal' : 'minion';
    game.brawlRoles![actorId] = roleDef.id;
    game.brawl!.playerStates![actorId] = {
      userId: actorId,
      seat: 5,
      roleId: roleDef.id,
      camp: roleDef.camp,
      skillUsed: false,
    };

    const payload = {
      action: 'useSkill' as const,
      skillId: roleDef.skill.skillId,
      ...(roleDef.skill.actionType === 'target_player' ? { targetPlayerId: targetId } : {}),
    };

    const replayBefore = game.brawl!.replayTimeline!.length;
    game = transition(game, actorId, { type: 'brawlCommand', payload }, onlineIds);

    assert.equal(game.brawl!.playerStates![actorId].skillUsed, true, `${roleDef.id}: skill marked used`);
    assert.ok(game.brawl!.replayTimeline!.length > replayBefore, `${roleDef.id}: replay timeline recorded`);

    // Verify public broadcast whitelist strictly matches
    const bystanderView = projectGame(game, 'p9');
    const expectedPublic = PUBLIC_BROADCAST_ROLE_IDS.has(roleDef.id);
    const hasPublicEvent = (bystanderView.brawl?.events ?? []).some(ev => ev.roleId === roleDef.id);
    assert.equal(
      hasPublicEvent,
      expectedPublic,
      `${roleDef.id}: live public broadcast must be ${expectedPublic}`,
    );

    // Verify caster receives private feedback immediately AND retains feedback after round effect reset
    const checkFeedback = (label: string) => {
      const view = projectGame(game, actorId).selfBrawl!;
      const hasAnyFeedback = Boolean(
        view.generalFeedback ||
        view.zhaoyaoDetail ||
        view.guanyinNotice ||
        view.huangfengSecret ||
        view.tieshanSecret ||
        view.huangmeiNotice ||
        view.baiguLijianStatus ||
        view.baiyanDuchaStatus ||
        view.jinjiaoNotice ||
        view.yutuNotice,
      );
      assert.ok(hasAnyFeedback, `${roleDef.id}: caster must have private feedback (${label})`);
    };
    checkFeedback('immediately after cast');

    // For instant/non-mission-pending roles, verify receipt survives resetRoundBrawlEffects
    if (!['jinjiao_dawang', 'yutu_jing', 'baiyan_mojun', 'bai_gujing'].includes(roleDef.id)) {
      resetRoundBrawlEffects(game.brawl!);
      checkFeedback('after resetRoundBrawlEffects');
    }
  }
});

test('30-role matrix: passive/core 6 roles project exact vision, blind-box peeks, and disabled active button in 9-12p', () => {
  const players = makePlayers(10);
  const game = createGame('audit-passive-6', players, { ...defaultSettings, playerCount: 10, brawlModeEnabled: true }, a => a);

  // Assign all 6 passive/core roles explicitly
  const layout: Array<[string, string, 'merlin' | 'percival' | 'loyal' | 'assassin' | 'morgana' | 'minion', 'blue' | 'red']> = [
    ['p1', 'sun_wukong', 'merlin', 'blue'],
    ['p2', 'tang_seng', 'percival', 'blue'],
    ['p3', 'erlang_shen', 'loyal', 'blue'],
    ['p4', 'guanyin_pusa', 'loyal', 'blue'],
    ['p5', 'nezha', 'loyal', 'blue'],
    ['p6', 'bai_longma', 'loyal', 'blue'],
    ['p7', 'hong_haier', 'assassin', 'red'],
    ['p8', 'liuer_mihou', 'morgana', 'red'],
    ['p9', 'huangmei_laoguai', 'minion', 'red'],
    ['p10', 'laoshu_jing', 'minion', 'red'],
  ];
  for (const [id, brawlId, baseRole, camp] of layout) {
    game.roles[id] = baseRole;
    game.brawlRoles![id] = brawlId;
    game.brawl!.playerStates![id] = {
      userId: id,
      seat: Number(id.slice(1)),
      roleId: brawlId,
      camp,
      skillUsed: false,
    };
  }
  game.brawl!.secrets = {
    ...(game.brawl!.secrets ?? { privateReceipts: {} }),
    peekedMap: {
      erlang_shen: [{ roleId: 'laoshu_jing', roleName: '老鼠精', camp: 'red' }],
      laoshu_jing: [{ roleId: 'nezha', roleName: '哪吒三太子', camp: 'blue' }],
    },
  };

  // Sun Wukong sees p7, p8, p10 — NOT p9 (Huangmei)
  const wukongView = projectGame(game, 'p1');
  assert.deepEqual(wukongView.self?.evilIds, ['p7', 'p8', 'p10']);
  assert.equal(wukongView.selfBrawl?.skillAvailable, false);

  // Tang Seng sees p1 (Sun Wukong) & p8 (Liuer Mihou)
  const tangView = projectGame(game, 'p2');
  assert.deepEqual(tangView.self?.merlinCandidates, ['p1', 'p8']);
  assert.equal(tangView.selfBrawl?.skillAvailable, false);

  // Erlang Shen peeks 1 red role privately
  const erlangView = projectGame(game, 'p3');
  assert.equal(erlangView.selfBrawl?.peekedRoles?.[0]?.roleId, 'laoshu_jing');
  assert.equal(erlangView.selfBrawl?.skillAvailable, false);

  // Hong Haier sees p8, p9, p10; active brawl skill button is hidden (assassination uses dedicated flow)
  const hongView = projectGame(game, 'p7');
  assert.deepEqual(hongView.self?.evilIds, ['p8', 'p9', 'p10']);
  assert.equal(hongView.selfBrawl?.skillAvailable, false);

  // Liuer Mihou sees p7, p9, p10
  const liuerView = projectGame(game, 'p8');
  assert.deepEqual(liuerView.self?.evilIds, ['p7', 'p9', 'p10']);
  assert.equal(liuerView.selfBrawl?.skillAvailable, false);

  // Laoshu Jing peeks 1 blue role privately & sees red teammates
  const laoshuView = projectGame(game, 'p10');
  assert.equal(laoshuView.selfBrawl?.peekedRoles?.[0]?.roleId, 'nezha');
  assert.deepEqual(laoshuView.self?.evilIds, ['p7', 'p8', 'p9']);
  assert.equal(laoshuView.selfBrawl?.skillAvailable, false);
});

test('bugfix audit: illegal Red skill clicks NEVER consume Taishang Laojun Jingang Zhuo', () => {
  const players = makePlayers(10);
  const onlineIds = players.map(p => p.id);
  let game = createGame('audit-laojun-order', players, { ...defaultSettings, playerCount: 10, brawlModeEnabled: true }, a => a);
  game.captainOrder = [...onlineIds];
  game.captainIndex = 0; // p1 is captain
  game.phase = 'proposing';

  game.brawl!.playerStates!.p2 = { userId: 'p2', seat: 2, roleId: 'taishang_laojun', camp: 'blue', skillUsed: false };
  game.brawl!.playerStates!.p3 = { userId: 'p3', seat: 3, roleId: 'qingmao_shizi', camp: 'red', skillUsed: false };
  game.brawl!.playerStates!.p4 = { userId: 'p4', seat: 4, roleId: 'zhizhu_jing', camp: 'red', skillUsed: false };
  game.brawl!.playerStates!.p5 = { userId: 'p5', seat: 5, roleId: 'yinjiao_dawang', camp: 'red', skillUsed: false };

  // Arm Laojun
  game = transition(game, 'p2', { type: 'brawlCommand', payload: { action: 'useSkill', skillId: 'jingang_zhuo' } }, onlineIds);
  assert.equal(game.brawl!.laojunZhuoActive, true);

  // 1. Qingmao tries to ban captain p1 -> rejected, Laojun stays armed!
  assert.throws(() => transition(game, 'p3', {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'dakou_tuntian', targetPlayerId: 'p1' },
  }, onlineIds), /CANNOT_BAN_CAPTAIN/);
  assert.equal(game.brawl!.laojunZhuoActive, true);
  assert.equal(game.brawl!.playerStates!.p3.skillUsed, false);

  // 2. Zhizhu tries to ban self -> rejected, Laojun stays armed!
  assert.throws(() => transition(game, 'p4', {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'pansi_jiejian', targetPlayerId: 'p4' },
  }, onlineIds), /CANNOT_BAN_SELF/);
  assert.equal(game.brawl!.laojunZhuoActive, true);
  assert.equal(game.brawl!.playerStates!.p4.skillUsed, false);

  // 3. Yinjiao tries to target self -> rejected, Laojun stays armed!
  assert.throws(() => transition(game, 'p5', {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'yishan_yading', targetPlayerId: 'p5' },
  }, onlineIds), /CANNOT_TARGET_SELF/);
  assert.equal(game.brawl!.laojunZhuoActive, true);
  assert.equal(game.brawl!.playerStates!.p5.skillUsed, false);

  // 4. Legal Red skill IS intercepted by Laojun!
  game = transition(game, 'p5', {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'yishan_yading', targetPlayerId: 'p6' },
  }, onlineIds);
  assert.equal(game.brawl!.laojunZhuoActive, false);
  assert.equal(game.brawl!.playerStates!.p5.skillUsed, true);
  assert.equal(game.brawl!.yishanTargetId, undefined);
});

test('bugfix audit: Yinjiao and Rulai suppressing last unvoted player in team_vote resolves vote without deadlock', () => {
  const players = makePlayers(6);
  const onlineIds = players.map(p => p.id);

  // Case A: Yinjiao suppresses final unvoted player p6 -> vote immediately resolves
  let g1 = createGame('audit-yinjiao-deadlock', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  g1.captainOrder = [...onlineIds];
  g1.captainIndex = 0;
  g1.phase = 'proposing';
  g1.brawl!.playerStates!.p5 = { userId: 'p5', seat: 5, roleId: 'yinjiao_dawang', camp: 'red', skillUsed: false };

  g1 = transition(g1, 'p1', { type: 'proposeTeam', payload: { playerIds: ['p1', 'p2'], direction: 'clockwise' } }, onlineIds);
  g1 = transition(g1, 'p1', { type: 'startTeamVote', payload: {} }, onlineIds);
  for (const pid of ['p1', 'p2', 'p3', 'p4', 'p5']) {
    g1 = transition(g1, pid, { type: 'teamVote', payload: { approve: true } }, onlineIds);
  }
  assert.equal(g1.phase, 'team_vote');
  g1 = transition(g1, 'p5', {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'yishan_yading', targetPlayerId: 'p6' },
  }, onlineIds);
  assert.equal(g1.phase, 'mission', 'Yinjiao suppressing last voter must resolve team_vote immediately');
  assert.equal(g1.rounds.at(-1)?.vote?.passed, true);
  assert.equal(g1.rounds.at(-1)?.vote?.abstentions, 1);

  // Case B: Rulai imprisons off-team final unvoted player p6 -> vote immediately resolves
  let g2 = createGame('audit-rulai-deadlock', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  g2.captainOrder = [...onlineIds];
  g2.captainIndex = 0;
  g2.phase = 'proposing';
  g2.brawl!.playerStates!.p5 = { userId: 'p5', seat: 5, roleId: 'rulai_fozu', camp: 'blue', skillUsed: false };

  g2 = transition(g2, 'p1', { type: 'proposeTeam', payload: { playerIds: ['p1', 'p2'], direction: 'clockwise' } }, onlineIds);
  g2 = transition(g2, 'p1', { type: 'startTeamVote', payload: {} }, onlineIds);
  for (const pid of ['p1', 'p2', 'p3', 'p4', 'p5']) {
    g2 = transition(g2, pid, { type: 'teamVote', payload: { approve: true } }, onlineIds);
  }
  g2 = transition(g2, 'p5', {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'wuxingshan_zhang', targetPlayerId: 'p6' },
  }, onlineIds);
  assert.equal(g2.phase, 'mission', 'Rulai imprisoning last off-team voter must resolve team_vote immediately');

  // Case C: Rulai or Zhizhu targeting an ON-TEAM member during team_vote ejects them and rolls back to proposing
  let g3 = createGame('audit-zhizhu-eject-vote', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  g3.captainOrder = [...onlineIds];
  g3.captainIndex = 0;
  g3.phase = 'proposing';
  g3.brawl!.playerStates!.p5 = { userId: 'p5', seat: 5, roleId: 'zhizhu_jing', camp: 'red', skillUsed: false };
  g3 = transition(g3, 'p1', { type: 'proposeTeam', payload: { playerIds: ['p1', 'p2'], direction: 'clockwise' } }, onlineIds);
  g3 = transition(g3, 'p1', { type: 'startTeamVote', payload: {} }, onlineIds);
  g3 = transition(g3, 'p1', { type: 'teamVote', payload: { approve: true } }, onlineIds);
  g3 = transition(g3, 'p5', {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'pansi_jiejian', targetPlayerId: 'p2' },
  }, onlineIds);
  assert.equal(g3.phase, 'proposing', 'Cocooning on-team member mid-vote rolls back to proposing');
  assert.equal(g3.rounds.at(-1)?.team.includes('p2'), false);
  assert.deepEqual(g3.teamVotes, {});
});

test('bugfix audit: team-building control skills cannot be wasted in mission phase and Yuhuang refunds on proposal abort', () => {
  const players = makePlayers(6);
  const onlineIds = players.map(p => p.id);
  let game = createGame('audit-phase-and-yuhuang', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  game.captainOrder = [...onlineIds];
  game.captainIndex = 0;
  game.phase = 'proposing';

  game.brawl!.playerStates!.p1 = { userId: 'p1', seat: 1, roleId: 'yuhuang_dadi', camp: 'blue', skillUsed: false };
  game.brawl!.playerStates!.p2 = { userId: 'p2', seat: 2, roleId: 'bai_longma', camp: 'blue', skillUsed: false };
  game.brawl!.playerStates!.p3 = { userId: 'p3', seat: 3, roleId: 'rulai_fozu', camp: 'blue', skillUsed: false };
  game.brawl!.playerStates!.p4 = { userId: 'p4', seat: 4, roleId: 'qingmao_shizi', camp: 'red', skillUsed: false };
  game.brawl!.playerStates!.p5 = { userId: 'p5', seat: 5, roleId: 'zhizhu_jing', camp: 'red', skillUsed: false };

  // Arm Yuhuang -> rejected vote MUST refund Yuhuang!
  game = transition(game, 'p1', { type: 'brawlCommand', payload: { action: 'useSkill', skillId: 'tianzun_yuzhi' } }, onlineIds);
  assert.equal(game.brawl!.yuhuangYuzhiArmed, true);
  assert.equal(game.brawl!.playerStates!.p1.skillUsed, true);

  game = transition(game, 'p1', { type: 'proposeTeam', payload: { playerIds: ['p1', 'p2'], direction: 'clockwise' } }, onlineIds);
  game = transition(game, 'p1', { type: 'startTeamVote', payload: {} }, onlineIds);

  // Bai Longma blocked in team_vote (cannot expand locked team)
  assert.throws(() => transition(game, 'p2', {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'longma_fuzhong' },
  }, onlineIds), /WRONG_PHASE/);
  assert.equal(game.brawl!.playerStates!.p2.skillUsed, false);

  for (const pid of onlineIds) {
    game = transition(game, pid, { type: 'teamVote', payload: { approve: false } }, onlineIds);
  }
  assert.equal(game.brawl!.yuhuangYuzhiArmed, false, 'Yuhuang disarmed on rejected vote');
  assert.equal(game.brawl!.playerStates!.p1.skillUsed, false, 'Yuhuang skill refunded on rejected vote');
  assert.ok(projectGame(game, 'p1').selfBrawl?.generalFeedback?.includes('自动退还'));

  // Enter mission phase -> control skills rejected without consuming skillUsed
  game.phase = 'mission';
  game.rounds.push({ number: 2, mission: 1, captainId: 'p2', team: ['p1', 'p2'], direction: 'clockwise' });

  for (const [uid, sid, target] of [
    ['p2', 'longma_fuzhong', undefined],
    ['p3', 'wuxingshan_zhang', 'p6'],
    ['p4', 'dakou_tuntian', 'p6'],
    ['p5', 'pansi_jiejian', 'p6'],
  ] as const) {
    assert.throws(() => transition(game, uid, {
      type: 'brawlCommand',
      payload: { action: 'useSkill', skillId: sid, ...(target ? { targetPlayerId: target } : {}) },
    }, onlineIds), /WRONG_PHASE/, `${sid} must be blocked in mission phase`);
    assert.equal(game.brawl!.playerStates![uid].skillUsed, false, `${sid} must not be consumed on WRONG_PHASE`);
  }
});

test('bugfix audit: Puti + Huangmei hitting same blue player preserves both notices, and Baiyan miss state is scrubbed live', () => {
  const players = makePlayers(6);
  const game = createGame('audit-notice-and-scrub', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);

  if (!game.brawl!.secrets) game.brawl!.secrets = { privateReceipts: {} };
  game.brawl!.secrets.putiDianhuaNotice = { targetBlueUserId: 'p2', redRoleName: '白骨精' };
  game.brawl!.secrets.huangmeiDianhuaNotice = { targetBlueUserId: 'p2', targetSeat: 3, targetNickname: '仙友3' };
  game.brawl!.secrets.baiyanDuchaNotOnTeam = true;

  const p2View = projectGame(game, 'p2');
  assert.ok(p2View.selfBrawl?.putiDianhuaNotice?.includes('白骨精'), 'Preserves Puti notice');
  assert.ok(p2View.selfBrawl?.putiDianhuaNotice?.includes('3号 · 仙友3'), 'Preserves Huangmei fake notice too');
  assert.equal(p2View.brawl?.secrets, undefined, "secrets scrubbed during active game");
});
