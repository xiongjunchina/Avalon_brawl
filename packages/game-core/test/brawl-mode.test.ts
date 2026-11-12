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
  processNeutralChoice,
  ensureNeutralResolvedBeforeVote,
  isPlayerImprisoned,
  projectSelfBrawlView,
  createGame,
  projectGame,
  transition,
} from '../src/index.js';
import { defaultSettings, type BrawlRoleDef, type BrawlPlayerState } from '@avalon/contracts';

test('brawl: registry contains 31 legendary Journey to the West characters', () => {
  const roles = Object.values(BRAWL_ROLE_REGISTRY);
  assert.equal(roles.length, 31, 'Exactly 31 characters in registry');

  const blueRoles = roles.filter(r => r.camp === 'blue');
  const redRoles = roles.filter(r => r.camp === 'red');
  const neutralRoles = roles.filter(r => r.camp === 'neutral');

  assert.equal(blueRoles.length, 15, '15 Blue deities');
  assert.equal(redRoles.length, 15, '15 Red demons');
  assert.equal(neutralRoles.length, 1, '1 Neutral (Heixiong Jing)');

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

    // 8 人以上必须有黑熊精；5~7 人严禁黑熊精
    if (count >= 8) {
      assert.ok(ids.includes('heixiong_jing'), `${count}-player must have 黑熊精`);
    } else {
      assert.ok(!ids.includes('heixiong_jing'), `${count}-player must NOT have 黑熊精`);
    }

    const config = BRAWL_PLAYER_CONFIG[count];
    const blueCount = assignment.roles.filter(r => r.camp === 'blue').length;
    const redCount = assignment.roles.filter(r => r.camp === 'red').length;
    assert.equal(blueCount, config.blueTotal, `${count}-player blue count matches`);
    assert.equal(redCount, config.redTotal, `${count}-player red count matches`);
  }
});

test('brawl: blind box and intelligence privileges for Erlang, Baiyan, and Laoshu', () => {
  // 模拟指定抽取含有二郎神、百眼魔君、老鼠精的局
  const customPool: Record<string, BrawlRoleDef> = {
    ...BRAWL_ROLE_REGISTRY,
  };
  const assignment = drawBrawlRoles(8, customPool, () => 0.1);
  assert.ok(assignment.blindBox.bluePoolRoles.length > 0, 'Blind box contains blue pool');
  assert.ok(assignment.blindBox.redPoolRoles.length > 0, 'Blind box contains red pool');
  assert.equal(assignment.blindBox.neutralRole, 'heixiong_jing', 'Blind box records neutral role');
});

test('brawl: Heixiong Jing must vote success in round 1', () => {
  const pStates: Record<string, BrawlPlayerState> = {
    'user-heixiong': { userId: 'user-heixiong', seat: 1, roleId: 'heixiong_jing', camp: 'neutral', skillUsed: false },
    'user-blue': { userId: 'user-blue', seat: 2, roleId: 'sun_wukong', camp: 'blue', skillUsed: false },
    'user-red': { userId: 'user-red', seat: 3, roleId: 'hong_haier', camp: 'red', skillUsed: false },
  };
  const state = createBrawlGameState(pStates, ['zhu_bajie'], ['niu_mowang'], 'heixiong_jing');

  // 首轮投失败被拦截
  const failCheck = validateBrawlMissionVote(state, 'user-heixiong', 1, false);
  assert.equal(failCheck.valid, false);
  assert.match(failCheck.error!, /HEIXIONG_MUST_VOTE_SUCCESS_IN_ROUND_1/);

  // 首轮投成功合法
  const successCheck = validateBrawlMissionVote(state, 'user-heixiong', 1, true);
  assert.equal(successCheck.valid, true);

  // 蓝方任何轮次投失败均被拦截
  const blueFail = validateBrawlMissionVote(state, 'user-blue', 2, false);
  assert.equal(blueFail.valid, false);
  assert.match(blueFail.error!, /BLUE_CANNOT_FAIL/);

  // 红方投失败合法
  const redFail = validateBrawlMissionVote(state, 'user-red', 1, false);
  assert.equal(redFail.valid, true);
});

test('brawl: Heixiong Jing asynchronous non-blocking choice and auto-fallback', () => {
  const pStates: Record<string, BrawlPlayerState> = {
    'user-heixiong': { userId: 'user-heixiong', seat: 1, roleId: 'heixiong_jing', camp: 'neutral', skillUsed: false },
  };
  const state = createBrawlGameState(pStates, [], [], 'heixiong_jing');

  // 初始为中立
  assert.equal(state.playerStates['user-heixiong'].camp, 'neutral');

  // 自主选择加入红方
  const choiceResult = processNeutralChoice(state, 'user-heixiong', 'red', 2, false);
  assert.equal(choiceResult.success, true);
  assert.equal(state.playerStates['user-heixiong'].camp, 'red');
  assert.equal(state.neutralChoice?.chosenCamp, 'red');
  assert.equal(state.neutralChoice?.autoAssigned, false);

  // 重复选择报错
  const duplicate = processNeutralChoice(state, 'user-heixiong', 'blue', 2, false);
  assert.equal(duplicate.success, false);
  assert.match(duplicate.error!, /ALREADY_CHOSEN/);
});

test('brawl: Round 2 vote deadline auto-assigns Heixiong Jing if still undecided', () => {
  const pStates: Record<string, BrawlPlayerState> = {
    'user-heixiong': { userId: 'user-heixiong', seat: 1, roleId: 'heixiong_jing', camp: 'neutral', skillUsed: false },
  };
  const state = createBrawlGameState(pStates, [], [], 'heixiong_jing');

  // 未选择时，发起投票触发超时自动摇骰
  ensureNeutralResolvedBeforeVote(state, () => 0.2); // 0.2 < 0.5 -> 'blue'
  assert.ok(state.neutralChoice, 'Neutral choice resolved automatically');
  assert.equal(state.neutralChoice?.chosenCamp, 'blue');
  assert.equal(state.neutralChoice?.autoAssigned, true);
  assert.equal(state.playerStates['user-heixiong'].camp, 'blue');
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
    'user-2': { userId: 'user-2', seat: 2, roleId: 'heixiong_jing', camp: 'neutral', skillUsed: false },
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

  // 第 2 轮黑熊精提示天命抉择
  const self2R2 = projectSelfBrawlView(state, 'user-2', 2, peekedMap);
  assert.equal(self2R2?.neutralDecisionPending, true);
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

  assert.equal(Object.keys(extendedRegistry).length, 32);
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
