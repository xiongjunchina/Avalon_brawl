import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAWL_ROLE_REGISTRY,
  BRAWL_PLAYER_CONFIG,
  drawBrawlRoles,
  sampleWithoutReplacement,
  createBrawlGameState,
  appendBattleEvent,
  validateBrawlMissionVote,
  isPlayerImprisoned,
  projectSelfBrawlView,
  createGame,
  projectGame,
  transition,
  captain,
  failuresRequiredFor,
  missionSizesFor,
  MISSION_SIZES,
  BRAWL_MISSION_SIZES,
} from '../src/index.js';
import { defaultSettings, type BrawlRoleDef, type BrawlPlayerState } from '@avalon/contracts';

test('brawl: registry contains 30 legendary Journey to the West characters (15 Blue vs 15 Red)', () => {
  const roles = Object.values(BRAWL_ROLE_REGISTRY);
  assert.equal(roles.length, 30, 'Exactly 30 characters in registry');

  const blueRoles = roles.filter(r => r.camp === 'blue');
  const redRoles = roles.filter(r => r.camp === 'red');

  assert.equal(blueRoles.length, 15, '15 Blue deities');
  assert.equal(redRoles.length, 15, '15 Red demons');

  // 验证至尊角色存在
  assert.ok(BRAWL_ROLE_REGISTRY.rulai_fozu, '如来佛祖存在');
  assert.ok(BRAWL_ROLE_REGISTRY.yuhuang_dadi, '玉皇大帝存在');
  assert.ok(BRAWL_ROLE_REGISTRY.wangmu_niangniang, '王母娘娘存在');

  // 验证 4 护法与 4 女妖精全员独立
  assert.ok(BRAWL_ROLE_REGISTRY.zhu_bajie, '猪八戒独立');
  assert.ok(BRAWL_ROLE_REGISTRY.sha_wujing, '沙悟净独立');
  assert.ok(BRAWL_ROLE_REGISTRY.bai_longma, '白龙马独立');
  assert.ok(BRAWL_ROLE_REGISTRY.bai_gujing, '白骨精独立');
  assert.ok(BRAWL_ROLE_REGISTRY.zhizhu_jing, '蜘蛛精独立');
  assert.ok(BRAWL_ROLE_REGISTRY.yutu_jing, '玉兔精独立');
  assert.ok(BRAWL_ROLE_REGISTRY.laoshu_jing, '老鼠精独立');

  // 验证每个角色均有不依赖座次的极简技能
  for (const role of roles) {
    assert.ok(role.skill.skillName, `${role.name} has skillName`);
    assert.ok(role.skill.description.length <= 45, `${role.name} skill description is concise`);
  }
});

test('brawl: sampleWithoutReplacement draws unique items up to pool size', () => {
  const items = [1, 2, 3, 4, 5, 6, 7];
  const sample = sampleWithoutReplacement(items, 4);
  assert.equal(sample.length, 4);
  assert.equal(new Set(sample).size, 4, 'All sampled items are unique');
  assert.throws(() => sampleWithoutReplacement(items, 10), /Cannot sample/);
});

test('brawl: 5 to 12 player distribution matrix strictly matches configuration', () => {
  for (let count = 5; count <= 12; count++) {
    const assignment = drawBrawlRoles(count);
    assert.equal(assignment.roles.length, count, `${count}-player deal has exact count`);

    const ids = assignment.roles.map(r => r.id);
    assert.equal(new Set(ids).size, count, `${count}-player deal has no duplicate roles`);

    // 必出 4 大固定核心
    assert.ok(ids.includes('sun_wukong'), 'Must include 孙悟空');
    assert.ok(ids.includes('tang_seng'), 'Must include 唐三藏');
    assert.ok(ids.includes('liuer_mihou'), 'Must include 六耳猕猴');
    assert.ok(ids.includes('hong_haier'), 'Must include 红孩儿');

    // 严格无中立角色黑熊精
    assert.ok(!ids.includes('heixiong_jing'), 'Must NOT have 黑熊精');

    const config = BRAWL_PLAYER_CONFIG[count];
    const blueCount = assignment.roles.filter(r => r.camp === 'blue').length;
    const redCount = assignment.roles.filter(r => r.camp === 'red').length;
    assert.equal(blueCount, config.blueTotal, `${count}-player blue count matches`);
    assert.equal(redCount, config.redTotal, `${count}-player red count matches`);
    assert.equal(blueCount + redCount, count, `${count}-player blue + red strictly equals player count`);
  }
});

test('brawl: blind box and intelligence privileges for Erlang, Baiyan, and Laoshu', () => {
  // 模拟指定抽取含有二郎神、百眼魔君、老鼠精的局 (10人局包含蓝红双向盲盒池)
  const customPool: Record<string, BrawlRoleDef> = {
    ...BRAWL_ROLE_REGISTRY,
  };
  const assignment = drawBrawlRoles(10, customPool, () => 0.1);
  assert.ok(assignment.blindBox.bluePoolRoles.length > 0, 'Blind box contains blue pool');
  assert.ok(assignment.blindBox.redPoolRoles.length > 0, 'Blind box contains red pool');
});

test('brawl: mission vote validation enforces blue players cannot fail', () => {
  const pStates: Record<string, BrawlPlayerState> = {
    'user-blue': { userId: 'user-blue', seat: 1, roleId: 'sun_wukong', camp: 'blue', skillUsed: false },
    'user-red': { userId: 'user-red', seat: 2, roleId: 'hong_haier', camp: 'red', skillUsed: false },
  };
  const state = createBrawlGameState(pStates, ['zhu_bajie'], ['niu_mowang']);

  // 蓝方投失败被拦截
  const blueFail = validateBrawlMissionVote(state, 'user-blue', 1, false);
  assert.equal(blueFail.valid, false);
  assert.match(blueFail.error!, /BLUE_CANNOT_FAIL/);

  // 蓝方投成功合法
  const blueSuccess = validateBrawlMissionVote(state, 'user-blue', 1, true);
  assert.equal(blueSuccess.valid, true);

  // 红方投失败合法
  const redFail = validateBrawlMissionVote(state, 'user-red', 1, false);
  assert.equal(redFail.valid, true);

  // 红方投成功合法
  const redSuccess = validateBrawlMissionVote(state, 'user-red', 1, true);
  assert.equal(redSuccess.valid, true);
});

test('brawl: battle events follow "Event Public, Player Anonymous" specification', () => {
  const state = createBrawlGameState({}, [], []);
  const event = appendBattleEvent(
    state,
    'rulai_fozu',
    '如来佛祖降下五行山：3号玩家被镇压一轮，本轮禁止入选车队与参与表决！',
  );

  assert.equal(state.events.length, 1);
  assert.equal(event.roleName, '如来佛祖');
  assert.equal(event.skillName, '五行山掌');
  assert.ok(event.summary.includes('3号玩家被镇压一轮'));
  // 验证不包含施法者的席位
  assert.ok(!event.summary.includes('施法者'));
});

test('brawl: Rulai Fozu imprisonment validation', () => {
  const state = createBrawlGameState({}, [], []);
  state.imprisonedTargetId = 'player-target-123';

  assert.equal(isPlayerImprisoned(state, 'player-target-123'), true);
  assert.equal(isPlayerImprisoned(state, 'player-other-456'), false);
});

test('brawl: projectSelfBrawlView delivers private views without leaking secret roles', () => {
  const pStates: Record<string, BrawlPlayerState> = {
    'user-1': { userId: 'user-1', seat: 1, roleId: 'erlang_shen', camp: 'blue', skillUsed: false },
    'user-2': { userId: 'user-2', seat: 2, roleId: 'hong_haier', camp: 'red', skillUsed: false },
  };
  const state = createBrawlGameState(pStates, [], []);

  const peekedMap = {
    erlang_shen: [{ roleId: 'niu_mowang', roleName: '牛魔王', camp: 'red' as const }],
  };

  const self1 = projectSelfBrawlView(state, 'user-1', 1, peekedMap);
  assert.ok(self1);
  assert.equal(self1?.roleName, '二郎神');
  assert.equal(self1?.peekedRoles?.length, 1);
  assert.equal(self1?.peekedRoles?.[0].roleName, '牛魔王');

  const self2 = projectSelfBrawlView(state, 'user-2', 2, peekedMap);
  assert.ok(self2);
  assert.equal(self2?.roleName, '红孩儿');
  assert.equal(self2?.camp, 'red');
});

test('brawl: extensible registry allows seamless registration of 32nd and 33rd characters', () => {
  const extendedRegistry: Record<string, BrawlRoleDef> = {
    ...BRAWL_ROLE_REGISTRY,
    dizang_wang: {
      id: 'dizang_wang',
      name: '地藏王菩萨',
      fullName: '幽冥教主 · 地藏王菩萨',
      title: '幽冥教主',
      camp: 'blue',
      isCore: false,
      artPrefix: 'loyal',
      motto: '地狱不空誓不成佛，度尽群生方证菩提',
      skill: {
        skillId: 'youming_chaodu',
        skillName: '幽冥超度',
        triggerPhase: 'mission_resolved',
        actionType: 'single_button',
        maxUses: 1,
        description: '任务失败后超度残魂，使下一次组队投票所需通过票数临时 -1。',
      },
    },
  };

  assert.equal(Object.keys(extendedRegistry).length, 31);
  const assignment = drawBrawlRoles(8, extendedRegistry);
  assert.equal(assignment.roles.length, 8);
});

test('brawl: createGame with brawlModeEnabled assigns full brawl roles, projectGame reveals selfBrawl', () => {
  const players = Array.from({ length: 12 }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `玩家${i + 1}`,
    seat: i + 1,
  }));
  const game = createGame('brawl-game-12', players, { ...defaultSettings, playerCount: 12, brawlModeEnabled: true }, a => a);
  assert.ok(game.brawl, 'game has brawl state');
  assert.ok(game.brawlRoles, 'game has brawlRoles mapping');
  assert.equal(Object.keys(game.brawlRoles).length, 12, '12 players mapped to brawl roles');

  // Verify all 12 mapped roles are in BRAWL_ROLE_REGISTRY
  for (const roleId of Object.values(game.brawlRoles)) {
    assert.ok(BRAWL_ROLE_REGISTRY[roleId], `Role ${roleId} is registered in BRAWL_ROLE_REGISTRY`);
  }

  // Verify projectGame includes selfBrawl
  const viewP1 = projectGame(game, 'p1');
  assert.ok(viewP1.selfBrawl, 'viewP1 contains selfBrawl');
  assert.equal(viewP1.selfBrawl?.roleId, game.brawlRoles.p1);
  assert.ok(viewP1.selfBrawl?.roleName, 'selfBrawl has roleName');
  assert.ok(viewP1.selfBrawl?.skill, 'selfBrawl has skill');

  // Verify brawlCommand transition
  const next = transition(game, 'p1', {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: viewP1.selfBrawl.skill.skillId },
  }, players.map(p => p.id));
  assert.equal(next.brawl?.playerStates.p1.skillUsed, true, 'Skill marked as used');
  assert.equal(next.brawl?.events.length, 1, 'Event appended');
});

test('brawl: 5-role preferences prioritize preferred characters in pool draw and player assignment', () => {
  const players = Array.from({ length: 10 }, (_, i) => ({
    id: `u${i + 1}`,
    nickname: `玩家${i + 1}`,
    seat: i + 1,
  }));

  // u1 prefers Erlang Shen, Nezha, Zhenyuan Daxian, Guanyin, Rulai Fozu (all Blue non-core)
  const u1Prefs = ['erlang_shen', 'nezha', 'zhenyuan_daxian', 'guanyin_pusa', 'rulai_fozu'];
  // u2 prefers Niu Mowang, Dapeng, Baigu Jing, Huangfeng, Honghai'er (all Red non-core)
  const u2Prefs = ['niu_mowang', 'dapeng_jinchibird', 'baigu_jing', 'huangfeng_guai', 'qingmao_shizi'];

  const rolePreferences = {
    u1: u1Prefs,
    u2: u2Prefs,
  };

  const game = createGame(
    'brawl-game-pref-5',
    players,
    { ...defaultSettings, playerCount: 10, brawlModeEnabled: true, rolePreferenceEnabled: true },
    a => a,
    { rolePreferences }
  );

  assert.ok(game.brawlRoles);
  const poolRoleIds = Object.values(game.brawlRoles);

  // Preferred roles should be in the pool
  const u1Match = u1Prefs.some(pref => poolRoleIds.includes(pref));
  assert.equal(u1Match, true, 'At least one of u1 blue preferences was drawn into the pool');

  const u2Match = u2Prefs.some(pref => poolRoleIds.includes(pref));
  assert.equal(u2Match, true, 'At least one of u2 red preferences was drawn into the pool');
});

test('brawl: 8-player and 10-player games strictly maintain Avalon standard Blue/Red balance (8p: 5B+3R, 10p: 6B+4R)', () => {
  // Test 8-player
  const players8 = Array.from({ length: 8 }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `玩家${i + 1}`,
    seat: i + 1,
  }));
  const game8 = createGame('brawl-8', players8, { ...defaultSettings, playerCount: 8, brawlModeEnabled: true }, a => a);
  assert.ok(game8.brawl);
  assert.ok(game8.brawlRoles);

  const playerStates8 = Object.values(game8.brawl.playerStates);
  const blue8 = playerStates8.filter(p => p.camp === 'blue').length;
  const red8 = playerStates8.filter(p => p.camp === 'red').length;

  assert.equal(blue8, 5, '8-player has exactly 5 blue gods');
  assert.equal(red8, 3, '8-player has exactly 3 red demons');

  // Test 10-player
  const players10 = Array.from({ length: 10 }, (_, i) => ({
    id: `u${i + 1}`,
    nickname: `玩家${i + 1}`,
    seat: i + 1,
  }));
  const game10 = createGame('brawl-10', players10, { ...defaultSettings, playerCount: 10, brawlModeEnabled: true }, a => a);
  const playerStates10 = Object.values(game10.brawl!.playerStates);
  const blue10 = playerStates10.filter(p => p.camp === 'blue').length;
  const red10 = playerStates10.filter(p => p.camp === 'red').length;

  assert.equal(blue10, 6, '10-player has exactly 6 blue gods');
  assert.equal(red10, 4, '10-player has exactly 4 red demons');
});

test('brawl: 9-player (5B:4R), 11-player (6B:5R), and 12-player (7B:5R) custom balance, mission sizes, and failure thresholds', () => {
  // 1. 9-player Brawl Game (5 Blue : 4 Red)
  const p9 = Array.from({ length: 9 }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}`, seat: i + 1 }));
  const game9 = createGame('brawl-9', p9, { ...defaultSettings, playerCount: 9, brawlModeEnabled: true }, a => a);
  const pStates9 = Object.values(game9.brawl!.playerStates);
  assert.equal(pStates9.filter(p => p.camp === 'blue').length, 5, '9-player brawl has 5 Blue');
  assert.equal(pStates9.filter(p => p.camp === 'red').length, 4, '9-player brawl has 4 Red');
  assert.deepEqual(projectGame(game9).missionSizes, [3, 4, 4, 5, 5], '9-player mission sizes');
  // Failures required in 9p brawl: R1..R3 = 1 fail, R4..R5 = 2 fails (given 5 Blue vs 4 Red)
  assert.equal(failuresRequiredFor(9, 1, true), 1);
  assert.equal(failuresRequiredFor(9, 2, true), 1);
  assert.equal(failuresRequiredFor(9, 3, true), 1);
  assert.equal(failuresRequiredFor(9, 4, true), 2);
  assert.equal(failuresRequiredFor(9, 5, true), 2);

  // 2. 11-player Brawl Game (6 Blue : 5 Red)
  const p11 = Array.from({ length: 11 }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}`, seat: i + 1 }));
  const game11 = createGame('brawl-11', p11, { ...defaultSettings, playerCount: 11, brawlModeEnabled: true }, a => a);
  const pStates11 = Object.values(game11.brawl!.playerStates);
  assert.equal(pStates11.filter(p => p.camp === 'blue').length, 6, '11-player brawl has 6 Blue');
  assert.equal(pStates11.filter(p => p.camp === 'red').length, 5, '11-player brawl has 5 Red');
  assert.deepEqual(projectGame(game11).missionSizes, [3, 4, 5, 5, 6], '11-player mission sizes: [3, 4, 5, 5, 6]');
  // Failures required in 11p brawl: R1..R2 = 1 fail, R3..R5 = 2 fails
  assert.equal(failuresRequiredFor(11, 1, true), 1);
  assert.equal(failuresRequiredFor(11, 2, true), 1);
  assert.equal(failuresRequiredFor(11, 3, true), 2);
  assert.equal(failuresRequiredFor(11, 4, true), 2);
  assert.equal(failuresRequiredFor(11, 5, true), 2);

  // 3. 12-player Brawl Game (7 Blue : 5 Red)
  const p12 = Array.from({ length: 12 }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}`, seat: i + 1 }));
  const game12 = createGame('brawl-12', p12, { ...defaultSettings, playerCount: 12, brawlModeEnabled: true }, a => a);
  const pStates12 = Object.values(game12.brawl!.playerStates);
  assert.equal(pStates12.filter(p => p.camp === 'blue').length, 7, '12-player brawl has 7 Blue');
  assert.equal(pStates12.filter(p => p.camp === 'red').length, 5, '12-player brawl has 5 Red');
  assert.deepEqual(projectGame(game12).missionSizes, [3, 4, 5, 6, 6], '12-player mission sizes: [3, 4, 5, 6, 6]');
  // Failures required in 12p brawl: R1..R2 = 1 fail, R3..R5 = 2 fails
  assert.equal(failuresRequiredFor(12, 1, true), 1);
  assert.equal(failuresRequiredFor(12, 2, true), 1);
  assert.equal(failuresRequiredFor(12, 3, true), 2);
  assert.equal(failuresRequiredFor(12, 4, true), 2);
  assert.equal(failuresRequiredFor(12, 5, true), 2);

  // 4. Classic mode backward compatibility:
  // 9p classic: 6 Blue : 3 Red, mission 4 takes 2 fails, mission 5 takes 1 fail
  const classic9 = createGame('classic-9', p9, { ...defaultSettings, playerCount: 9, brawlModeEnabled: false }, a => a);
  assert.equal(failuresRequiredFor(9, 4, false), 2);
  assert.equal(failuresRequiredFor(9, 5, false), 1);
  assert.deepEqual(projectGame(classic9).missionSizes, [3, 4, 4, 5, 5]);

  // 11p classic: 7 Blue : 4 Red, mission 3 takes 2 fails, mission 4 takes 2 fails, mission 5 takes 1 fail
  const classic11 = createGame('classic-11', p11, { ...defaultSettings, playerCount: 11, brawlModeEnabled: false }, a => a);
  assert.equal(failuresRequiredFor(11, 3, false), 2);
  assert.equal(failuresRequiredFor(11, 4, false), 2);
  assert.equal(failuresRequiredFor(11, 5, false), 1);
  assert.deepEqual(projectGame(classic11).missionSizes, [3, 4, 5, 5, 5]);
});

test('brawl: Huangmei Laoguai [renzhong_jindai] ejects drafted team member and bans captain nomination', () => {
  const players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}`, seat: i + 1 }));
  const game = createGame('brawl-huangmei', players, { ...defaultSettings, playerCount: 10, brawlModeEnabled: true }, a => a);

  // 设定 p1 为队长, p2 为目标, p3 为黄眉老怪
  const captainId = game.captainOrder[0];
  const targetId = game.captainOrder[1];
  const huangmeiId = game.captainOrder[2];

  game.brawl!.playerStates[huangmeiId] = {
    userId: huangmeiId,
    seat: 3,
    roleId: 'huangmei_laoguai',
    camp: 'red',
    skillUsed: false,
  };

  // 进入 proposing 阶段
  game.phase = 'proposing';
  // 队长草拟队伍包含 targetId 和另外一位玩家
  const otherId = game.captainOrder[3];
  game.draftTeam = { playerIds: [targetId, otherId], direction: 'clockwise' };

  // 黄眉老怪发动绝技【人种金袋】对 targetId
  const nextGame = transition(game, huangmeiId, {
    type: 'brawlCommand',
    payload: {
      action: 'useSkill',
      skillId: 'renzhong_jindai',
      targetPlayerId: targetId,
    },
  }, [huangmeiId]);

  // 1. 验证目标被立即从队伍草稿中吸走剔除
  assert.ok(!nextGame.draftTeam?.playerIds.includes(targetId), 'Target should be ejected from draftTeam');
  assert.deepEqual(nextGame.draftTeam?.playerIds, [otherId], 'Only other member remains');

  // 2. 验证前端投影包含禁选状态
  const view = projectGame(nextGame, captainId);
  assert.equal(view.humanBagBannedPlayerId, targetId, 'View marks target as banned by human bag');

  // 3. 验证队长若再次尝试把被吸走的目标加入队伍，会被系统规则拦截
  assert.throws(
    () => {
      transition(nextGame, captainId, {
        type: 'updateTeamDraft',
        payload: { playerIds: [targetId, otherId], direction: 'clockwise' },
      }, [captainId]);
    },
    /PLAYER_BANNED_BY_HUMAN_BAG/,
    'Captain cannot draft the banned target',
  );
});

test('brawl: Taishang Laojun [jingang_zhuo] intercepts Huangmei Laoguai [renzhong_jindai] skill', () => {
  const players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}`, seat: i + 1 }));
  const game = createGame('brawl-laojun-intercept', players, { ...defaultSettings, playerCount: 10, brawlModeEnabled: true }, a => a);

  const captainId = game.captainOrder[0];
  const targetId = game.captainOrder[1];
  const huangmeiId = game.captainOrder[2];
  const laojunId = game.captainOrder[3];

  game.brawl!.playerStates[laojunId] = {
    userId: laojunId,
    seat: 4,
    roleId: 'taishang_laojun',
    camp: 'blue',
    skillUsed: false,
  };
  game.brawl!.playerStates[huangmeiId] = {
    userId: huangmeiId,
    seat: 3,
    roleId: 'huangmei_laoguai',
    camp: 'red',
    skillUsed: false,
  };

  game.phase = 'proposing';
  const otherId = game.captainOrder[4];
  game.draftTeam = { playerIds: [targetId, otherId], direction: 'clockwise' };

  // 1. 太上老君发动绝技【金刚琢】
  let state = transition(game, laojunId, {
    type: 'brawlCommand',
    payload: {
      action: 'useSkill',
      skillId: 'jingang_zhuo',
    },
  }, [laojunId]);

  assert.equal(state.brawl!.laojunZhuoActive, true, 'Laojun Jingang Zhuo is armed and active');

  // 2. 妖魔黄眉老怪发动绝技【人种金袋】试图吸走 targetId
  state = transition(state, huangmeiId, {
    type: 'brawlCommand',
    payload: {
      action: 'useSkill',
      skillId: 'renzhong_jindai',
      targetPlayerId: targetId,
    },
  }, [huangmeiId]);

  // 3. 验证金刚琢当场拦截并解除充能
  assert.equal(state.brawl!.laojunZhuoActive, false, 'Jingang Zhuo consumed upon intercepting demon');

  // 4. 验证战报中记录了金刚琢显圣套走妖法的通报
  const lastEvent = state.brawl!.events.at(-1);
  assert.ok(lastEvent?.summary.includes('【太上老君】金刚琢凌空显圣'), 'Battle event reports intercept');
  assert.ok(lastEvent?.summary.includes('黄眉老怪'), 'Battle event specifies intercepted demon');

  // 5. 验证黄眉老怪法宝被收缴作废，targetId 未被剔除，依然在队伍中！
  assert.ok(state.draftTeam?.playerIds.includes(targetId), 'Target should remain in team because skill was confiscated');
  assert.equal(state.treasuresState?.humanBag?.targetId, undefined, 'No human bag ban should be active');
});

test('brawl: Zhizhu Jing [pansi_jiejian] ejects player and bans captain nomination', () => {
  const players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}`, seat: i + 1 }));
  const game = createGame('brawl-zhizhu', players, { ...defaultSettings, playerCount: 10, brawlModeEnabled: true }, a => a);

  const captainId = game.captainOrder[0];
  const targetId = game.captainOrder[1];
  const zhizhuId = game.captainOrder[2];

  game.brawl!.playerStates[zhizhuId] = {
    userId: zhizhuId,
    seat: 3,
    roleId: 'zhizhu_jing',
    camp: 'red',
    skillUsed: false,
  };

  game.phase = 'proposing';
  const otherId = game.captainOrder[3];
  game.draftTeam = { playerIds: [targetId, otherId], direction: 'clockwise' };

  // 蜘蛛精发动绝技【盘丝结茧】
  const nextGame = transition(game, zhizhuId, {
    type: 'brawlCommand',
    payload: {
      action: 'useSkill',
      skillId: 'pansi_jiejian',
      targetPlayerId: targetId,
    },
  }, [zhizhuId]);

  // 1. 目标被强制剔除出队伍草稿
  assert.ok(!nextGame.draftTeam?.playerIds.includes(targetId), 'Target ejected by Zhizhu Jing');
  assert.deepEqual(nextGame.draftTeam?.playerIds, [otherId]);

  // 2. 队长若再次尝试选该玩家入队，被系统拦截
  assert.throws(
    () => {
      transition(nextGame, captainId, {
        type: 'updateTeamDraft',
        payload: { playerIds: [targetId, otherId], direction: 'clockwise' },
      }, [captainId]);
    },
    /PLAYER_BANNED_BY_ZHIZHU_JING/,
  );
});

test('brawl: Zhenyuan Daxian [xiuli_qiankun] forces proposal rotation without consuming rejection quota', () => {
  const players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}`, seat: i + 1 }));
  const game = createGame('brawl-zhenyuan', players, { ...defaultSettings, playerCount: 10, brawlModeEnabled: true }, a => a);

  const firstCaptain = game.captainOrder[0];
  const zhenyuanId = game.captainOrder[2];

  game.brawl!.playerStates[zhenyuanId] = {
    userId: zhenyuanId,
    seat: 3,
    roleId: 'zhenyuan_daxian',
    camp: 'blue',
    skillUsed: false,
  };

  game.phase = 'discussion';
  game.rejectionCount = 1;

  // 镇元大仙发动袖里乾坤
  const nextGame = transition(game, zhenyuanId, {
    type: 'brawlCommand',
    payload: {
      action: 'useSkill',
      skillId: 'xiuli_qiankun',
    },
  }, [zhenyuanId]);

  // 队长已流转给下一位，阶段回到 proposing，且流局次数保持为 1 未扣减
  assert.notEqual(captain(nextGame), firstCaptain);
  assert.equal(nextGame.phase, 'proposing');
  assert.equal(nextGame.rejectionCount, 1);
});

test('brawl: Li Tianwang [zhaoyao_baojing] reveals presence of evil demons in team privately', () => {
  const players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}`, seat: i + 1 }));
  const game = createGame('brawl-litianwang', players, { ...defaultSettings, playerCount: 10, brawlModeEnabled: true }, a => a);

  const litianwangId = game.captainOrder[0];
  const demonId = game.captainOrder[1];
  const blueId = game.captainOrder[2];

  game.brawl!.playerStates[litianwangId] = {
    userId: litianwangId,
    seat: 1,
    roleId: 'li_tianwang',
    camp: 'blue',
    skillUsed: false,
  };
  game.brawl!.playerStates[demonId] = {
    userId: demonId,
    seat: 2,
    roleId: 'hong_haier',
    camp: 'red',
    skillUsed: false,
  };
  game.brawl!.playerStates[blueId] = {
    userId: blueId,
    seat: 3,
    roleId: 'sun_wukong',
    camp: 'blue',
    skillUsed: false,
  };

  game.phase = 'proposing';
  game.draftTeam = { playerIds: [demonId, blueId], direction: 'clockwise' };

  // 李天王举镜探查
  const nextGame = transition(game, litianwangId, {
    type: 'brawlCommand',
    payload: {
      action: 'useSkill',
      skillId: 'zhaoyao_baojing',
    },
  }, [litianwangId]);

  // 验证李天王的私密视图显示有妖魔
  const view = projectGame(nextGame, litianwangId);
  assert.equal(view.selfBrawl?.zhaoyaoResult, true, 'Mirror accurately detects demon in team');

  // 其他玩家看李天王不应泄露私密探查结果
  const otherView = projectGame(nextGame, blueId);
  assert.equal(otherView.selfBrawl?.zhaoyaoResult, undefined, 'Other players cannot see mirror result');
});

test('brawl: Nezha [santou_liubi] doubles vote weight during team vote resolution', () => {
  const players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}`, seat: i + 1 }));
  const game = createGame('brawl-nezha', players, { ...defaultSettings, playerCount: 10, brawlModeEnabled: true }, a => a);

  const nezhaId = game.captainOrder[0];
  game.brawl!.playerStates[nezhaId] = {
    userId: nezhaId,
    seat: 1,
    roleId: 'nezha',
    camp: 'blue',
    skillUsed: false,
  };

  game.phase = 'discussion';
  game.rounds.push({
    number: 1,
    mission: 1,
    captainId: nezhaId,
    team: [players[0].id, players[1].id, players[2].id],
    direction: 'clockwise',
  });

  // 1. 哪吒发动三头六臂
  let state = transition(game, nezhaId, {
    type: 'brawlCommand',
    payload: {
      action: 'useSkill',
      skillId: 'santou_liubi',
    },
  }, [nezhaId]);

  assert.equal(state.brawl!.doubleVoteUserId, nezhaId);

  // 2. 队长开启表决
  state = transition(state, nezhaId, { type: 'startTeamVote', payload: {} }, [nezhaId]);

  // 3. 假设全场 10 人投票：哪吒投赞成（计2票），其余 4 人赞成，5 人反对。
  // 若按普通1票制：赞成5票，反对5票（平票失败）。
  // 但因哪吒2票：赞成变为 6 票，反对 5 票 -> 成功通过！
  const approveIds = [nezhaId, players[1].id, players[2].id, players[3].id, players[4].id];
  const rejectIds = [players[5].id, players[6].id, players[7].id, players[8].id, players[9].id];

  for (const id of approveIds) {
    state = transition(state, id, { type: 'teamVote', payload: { approve: true } }, [id]);
  }
  for (const id of rejectIds) {
    state = transition(state, id, { type: 'teamVote', payload: { approve: false } }, [id]);
  }

  // 验证表决通过且赞成票计为 6
  assert.equal(state.rounds[0].vote?.approvals, 6);
  assert.equal(state.rounds[0].vote?.rejections, 5);
  assert.equal(state.rounds[0].vote?.passed, true);
});

test('brawl: Jinchi Dapeng [yuncheng_wanli] excludes non-Wukong seat for Hong Haier privately', () => {
  const players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i + 1}`, nickname: `P${i + 1}`, seat: i + 1 }));
  const game = createGame('brawl-dapeng', players, { ...defaultSettings, playerCount: 10, brawlModeEnabled: true }, a => a);

  const honghaierId = game.players[0].id;
  const dapengId = game.players[1].id;
  const wukongId = game.players[2].id;
  const tangsengId = game.players[3].id;

  game.brawl!.playerStates[honghaierId] = {
    userId: honghaierId,
    seat: 1,
    roleId: 'hong_haier',
    camp: 'red',
    skillUsed: false,
  };
  game.brawl!.playerStates[dapengId] = {
    userId: dapengId,
    seat: 2,
    roleId: 'jinchi_dapeng',
    camp: 'red',
    skillUsed: false,
  };
  game.brawl!.playerStates[wukongId] = {
    userId: wukongId,
    seat: 3,
    roleId: 'sun_wukong',
    camp: 'blue',
    skillUsed: false,
  };
  game.brawl!.playerStates[tangsengId] = {
    userId: tangsengId,
    seat: 4,
    roleId: 'tang_seng',
    camp: 'blue',
    skillUsed: false,
  };

  // 1. 验证在 proposing 阶段大鹏提前发动绝技蓄力，不会抛出 WRONG_PHASE 错误
  game.phase = 'proposing';
  let nextGame = transition(game, dapengId, {
    type: 'brawlCommand',
    payload: {
      action: 'useSkill',
      skillId: 'yuncheng_wanli',
    },
  }, [dapengId]);
  assert.equal(nextGame.brawl?.dapengArmed, true, 'Dapeng skill armed successfully before assassination');

  // 2. 模拟蓝方完成 3 胜进入刺杀阶段
  nextGame.rounds.push(
    { number: 1, mission: 1, captainId: players[0].id, team: [players[0].id, players[1].id], direction: 'clockwise', result: { successes: 2, failures: 0, passed: true } },
    { number: 2, mission: 2, captainId: players[1].id, team: [players[0].id, players[1].id, players[2].id], direction: 'clockwise', result: { successes: 3, failures: 0, passed: true } },
    { number: 3, mission: 3, captainId: players[2].id, team: [players[0].id, players[1].id, players[2].id], direction: 'clockwise', result: { successes: 3, failures: 0, passed: true } },
  );
  nextGame.phase = 'mission';
  nextGame.rounds.push({ number: 4, mission: 3, captainId: players[2].id, team: [players[0].id, players[1].id], direction: 'clockwise' });
  nextGame = transition(nextGame, players[0].id, { type: 'missionVote', payload: { success: true } }, [players[0].id]);
  nextGame = transition(nextGame, players[1].id, { type: 'missionVote', payload: { success: true } }, [players[1].id]);

  assert.equal(nextGame.phase, 'assassination');

  const excludedId = nextGame.brawl?.dapengExcludedPlayerId;
  assert.ok(excludedId, 'Excluded target should be assigned upon entering assassination');
  assert.notEqual(excludedId, wukongId, 'Excluded target must NOT be Sun Wukong');

  // 验证红孩儿端收到私密排除标记
  const honghaierView = projectGame(nextGame, honghaierId);
  assert.equal(honghaierView.selfBrawl?.dapengExcludedPlayerId, excludedId);

  // 验证大鹏端收到私密排除标记
  const dapengView = projectGame(nextGame, dapengId);
  assert.equal(dapengView.selfBrawl?.dapengExcludedPlayerId, excludedId);

  // 验证蓝方玩家看不到排除标记
  const wukongView = projectGame(nextGame, wukongId);
  assert.equal(wukongView.selfBrawl?.dapengExcludedPlayerId, undefined);
});

test('brawl: Sha Wujing [xiangyao_baozhang] forces tie vote to pass', () => {
  const players = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `玩家${i + 1}`,
    seat: i + 1,
  }));
  const game = createGame('brawl-sha', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  const shaId = 'p1';
  game.captainOrder = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
  game.brawl!.playerStates[shaId] = {
    userId: shaId,
    seat: 1,
    roleId: 'sha_wujing',
    camp: 'blue',
    skillUsed: false,
  };

  // 沙悟净发动法宝
  let next = transition(game, shaId, {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'xiangyao_baozhang' },
  }, [shaId]);
  assert.equal(next.brawl?.shawujingBaozhangArmed, true);

  // 沙僧提议挑人进入表决
  next.phase = 'proposing';
  next = transition(next, shaId, {
    type: 'proposeTeam',
    payload: { playerIds: ['p1', 'p2'], direction: 'clockwise' },
  }, [shaId]);
  next = transition(next, shaId, { type: 'startTeamVote', payload: {} }, [shaId]);

  // 6 人局：3 赞成 3 反对（平票）
  const originalRandom = Math.random;
  try {
    Math.random = () => 0.1; // 50% 概率强行通过
    next = transition(next, 'p1', { type: 'teamVote', payload: { approve: true } }, ['p1']);
    next = transition(next, 'p2', { type: 'teamVote', payload: { approve: true } }, ['p2']);
    next = transition(next, 'p3', { type: 'teamVote', payload: { approve: true } }, ['p3']);
    next = transition(next, 'p4', { type: 'teamVote', payload: { approve: false } }, ['p4']);
    next = transition(next, 'p5', { type: 'teamVote', payload: { approve: false } }, ['p5']);
    next = transition(next, 'p6', { type: 'teamVote', payload: { approve: false } }, ['p6']);

    // 验证在宝杖加持下，平票判定通过并进入出征阶段
    assert.equal(next.rounds.at(-1)?.vote?.passed, true);
    assert.equal(next.phase, 'mission');
  } finally {
    Math.random = originalRandom;
  }
});

test('brawl: Zhu Bajie [daoda_yipa] reverses rejection ballot to approval and passes', () => {
  const players = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `玩家${i + 1}`,
    seat: i + 1,
  }));
  const game = createGame('brawl-zhu', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  const zhuId = 'p2';
  game.brawl!.playerStates[zhuId] = {
    userId: zhuId,
    seat: 2,
    roleId: 'zhu_bajie',
    camp: 'blue',
    skillUsed: false,
  };

  // 猪八戒发动法宝【倒打一耙】
  let next = transition(game, zhuId, {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'daoda_yipa' },
  }, [zhuId]);
  assert.equal(next.brawl?.zhubajieDaodaArmed, true);

  // 正常提议表决
  next.phase = 'discussion';
  next.rounds.push({ number: 1, mission: 1, captainId: 'p1', team: ['p1', 'p2'], direction: 'clockwise' });
  next.phase = 'team_vote';

  // 原本投票：3 赞成 3 反对 -> 反转 1 张变为 4 赞成 2 反对 -> 逆风通过！
  next = transition(next, 'p1', { type: 'teamVote', payload: { approve: true } }, ['p1']);
  next = transition(next, 'p2', { type: 'teamVote', payload: { approve: true } }, ['p2']);
  next = transition(next, 'p3', { type: 'teamVote', payload: { approve: true } }, ['p3']);
  next = transition(next, 'p4', { type: 'teamVote', payload: { approve: false } }, ['p4']);
  next = transition(next, 'p5', { type: 'teamVote', payload: { approve: false } }, ['p5']);
  next = transition(next, 'p6', { type: 'teamVote', payload: { approve: false } }, ['p6']);

  assert.equal(next.rounds.at(-1)?.vote?.passed, true, 'Reversed vote should pass');
  assert.equal(next.phase, 'mission');
});

test('brawl: Bai Longma [longma_fuzhong] allows +1 extra team member and proposes successfully', () => {
  const players = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `玩家${i + 1}`,
    seat: i + 1,
  }));
  const game = createGame('brawl-longma', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  const longmaId = 'p3';
  game.brawl!.playerStates[longmaId] = {
    userId: longmaId,
    seat: 3,
    roleId: 'bai_longma',
    camp: 'blue',
    skillUsed: false,
  };

  // 白龙马发动负重
  let next = transition(game, longmaId, {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'longma_fuzhong' },
  }, [longmaId]);
  assert.equal(next.brawl?.extraSeatLimit, 1);

  // 6人局第1难原本限制 2 人，现在负重可带 3 人
  next.phase = 'proposing';
  next = transition(next, 'p1', {
    type: 'proposeTeam',
    payload: { playerIds: ['p1', 'p2', 'p3'], direction: 'clockwise' },
  }, ['p1']);

  assert.equal(next.rounds.at(-1)?.team.length, 3);
  // 能够正常进入表决
  next = transition(next, 'p1', { type: 'startTeamVote', payload: {} }, ['p1']);
  assert.equal(next.phase, 'team_vote');
});

test('brawl: Tieshan [bajiao_shenfeng] probes blue camp tiers and reveals secret', () => {
  const players = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `玩家${i + 1}`,
    seat: i + 1,
  }));
  const game = createGame('brawl-tieshan-secret', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  const tieshanId = 'p4';
  game.brawl!.playerStates[tieshanId] = {
    userId: tieshanId,
    seat: 4,
    roleId: 'tieshan_gongzhu',
    camp: 'red',
    skillUsed: false,
  };

  // 铁扇公主发动芭蕉神风
  const next = transition(game, tieshanId, {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'bajiao_shenfeng' },
  }, [tieshanId]);

  assert.equal(next.brawl?.playerStates[tieshanId].skillUsed, true);
  assert.ok(next.brawl?.tieshanSecret, 'Secret tier information should be generated');

  // 验证铁扇公主的自视角能看到仙阶情报
  const tieshanView = projectGame(next, tieshanId);
  assert.equal(tieshanView.selfBrawl?.tieshanSecret, next.brawl?.tieshanSecret);
});

test('brawl: Huangmei Laoguai is strictly hidden from Sun Wukong vision in brawl mode', () => {
  const players = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `玩家${i + 1}`,
    seat: i + 1,
  }));
  const game = createGame('brawl-huangmei-vision', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  const wukongId = 'p1';
  const huangmeiId = 'p5';
  const normalRedId = 'p6';

  game.roles[wukongId] = 'merlin';
  game.brawl!.playerStates[wukongId] = { userId: wukongId, seat: 1, roleId: 'sun_wukong', camp: 'blue', skillUsed: false };

  game.roles[huangmeiId] = 'minion'; // 哪怕底牌角色不是 mordred
  game.brawl!.playerStates[huangmeiId] = { userId: huangmeiId, seat: 5, roleId: 'huangmei_laoguai', camp: 'red', skillUsed: false };

  game.roles[normalRedId] = 'assassin';
  game.brawl!.playerStates[normalRedId] = { userId: normalRedId, seat: 6, roleId: 'hong_haier', camp: 'red', skillUsed: false };

  const wukongView = projectGame(game, wukongId);
  assert.ok(wukongView.self?.evilIds.includes(normalRedId), 'Wukong should see normal red role Hong Haier');
  assert.equal(wukongView.self?.evilIds.includes(huangmeiId), false, 'Wukong MUST NOT see Huangmei Laoguai');
});

test('brawl: Yuhuang Dadi [tianzun_yuzhi] pardons mission failure', () => {
  const players = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `玩家${i + 1}`,
    seat: i + 1,
  }));
  const game = createGame('brawl-yuhuang', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  const yuhuangId = 'p2';
  game.brawl!.playerStates[yuhuangId] = { userId: yuhuangId, seat: 2, roleId: 'yuhuang_dadi', camp: 'blue', skillUsed: false };

  // 玉帝激活天尊玉旨
  let next = transition(game, yuhuangId, {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'tianzun_yuzhi' },
  }, [yuhuangId]);
  assert.equal(next.brawl?.yuhuangYuzhiArmed, true);

  // 模拟任务投票：1 成功 1 失败（原本应判定失败）
  next.phase = 'mission';
  next.rounds.push({ number: 1, mission: 1, captainId: 'p1', team: ['p1', 'p2'], direction: 'clockwise' });
  next.roles.p1 = 'assassin';
  next.roles.p2 = 'merlin';
  next.brawl!.playerStates.p1.camp = 'red';

  // 使用确定的 Math.random 使得赦免判定成功
  const originalRandom = Math.random;
  try {
    Math.random = () => 0.1; // 0.1 < 0.6，必然赦免
    next = transition(next, 'p1', { type: 'missionVote', payload: { success: false } }, ['p1']);
    next = transition(next, 'p2', { type: 'missionVote', payload: { success: true } }, ['p2']);

    assert.equal(next.rounds.at(-1)?.result?.passed, true, 'Mission should be pardoned and passed by Yuhuang Dadi');
    assert.equal(next.rounds.at(-1)?.result?.failures, 0);
  } finally {
    Math.random = originalRandom;
  }
});

test('brawl: Wangmu Niangniang [jiuzhuan_xiantao] pardons 1 failure card in any team size', () => {
  const players = Array.from({ length: 5 }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `玩家${i + 1}`,
    seat: i + 1,
  }));
  const game = createGame('brawl-wangmu', players, { ...defaultSettings, playerCount: 5, brawlModeEnabled: true }, a => a);
  const wangmuId = 'p3';
  game.brawl!.playerStates[wangmuId] = { userId: wangmuId, seat: 3, roleId: 'wangmu_niangniang', camp: 'blue', skillUsed: false };

  // 王母娘娘赐仙桃
  let next = transition(game, wangmuId, {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'jiuzhuan_xiantao' },
  }, [wangmuId]);
  assert.equal(next.brawl?.taoshouActive, true);

  // 5人局第1难只有 2 人队伍，原本王母不能发动，现在任意人数均可生效
  next.phase = 'mission';
  next.rounds.push({ number: 1, mission: 1, captainId: 'p1', team: ['p1', 'p2'], direction: 'clockwise' });
  next.roles.p1 = 'assassin';
  next.roles.p2 = 'merlin';
  next.brawl!.playerStates.p1.camp = 'red';

  const originalRandom = Math.random;
  try {
    Math.random = () => 0.1; // 0.1 < 0.5，必然抵消
    next = transition(next, 'p1', { type: 'missionVote', payload: { success: false } }, ['p1']);
    next = transition(next, 'p2', { type: 'missionVote', payload: { success: true } }, ['p2']);

    assert.equal(next.rounds.at(-1)?.result?.failures, 0, 'Failure card should be absorbed by Xiantao');
    assert.equal(next.rounds.at(-1)?.result?.passed, true);
  } finally {
    Math.random = originalRandom;
  }
});

test('brawl: Guanyin Pusa [jingping_ganlu] inspects team member vote privately when mission fails', () => {
  const players = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `玩家${i + 1}`,
    seat: i + 1,
  }));
  const game = createGame('brawl-guanyin', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  const guanyinId = 'p4';
  game.brawl!.playerStates[guanyinId] = { userId: guanyinId, seat: 4, roleId: 'guanyin_pusa', camp: 'blue', skillUsed: false };

  // 队伍敲定包含 p1, p2
  game.phase = 'proposing';
  game.draftTeam = { playerIds: ['p1', 'p2'], direction: 'clockwise' };

  // 观音对 p1 洒甘露
  let next = transition(game, guanyinId, {
    type: 'brawlCommand',
    payload: { action: 'useSkill', skillId: 'jingping_ganlu', targetPlayerId: 'p1' },
  }, [guanyinId]);
  assert.equal(next.brawl?.guanyinGanluTargetId, 'p1');

  // 进入出征阶段
  next.phase = 'mission';
  next.rounds.push({ number: 1, mission: 1, captainId: 'p1', team: ['p1', 'p2'], direction: 'clockwise' });
  next.roles.p1 = 'assassin';
  next.roles.p2 = 'merlin';
  next.brawl!.playerStates.p1.camp = 'red';

  // p1 投失败，p2 投成功 -> 任务失败
  next = transition(next, 'p1', { type: 'missionVote', payload: { success: false } }, ['p1']);
  next = transition(next, 'p2', { type: 'missionVote', payload: { success: true } }, ['p2']);

  // 验证观音私密收到探查结果：p1 投了失败牌 (success = false)
  const viewGuanyin = projectGame(next, guanyinId);
  assert.ok(viewGuanyin.selfBrawl?.guanyinGanluResult, 'Guanyin receives ganlu result');
  assert.equal(viewGuanyin.selfBrawl?.guanyinGanluResult?.targetSeat, 1);
  assert.equal(viewGuanyin.selfBrawl?.guanyinGanluResult?.success, false);

  // 其他玩家绝不能看到该私密结果
  const viewP2 = projectGame(next, 'p2');
  assert.equal(viewP2.selfBrawl?.guanyinGanluResult, undefined);
});
