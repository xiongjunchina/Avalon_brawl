import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BrawlPanel } from '../src/BrawlPanel.js';
import { BrawlReplayTimeline } from '../src/BrawlReplayTimeline.js';
import { BattleHistory } from '../src/BattleRound.js';
import type { SelfBrawlView, BrawlBattleEvent, BrawlReplayAction, RoundView, Player } from '@avalon/contracts';

test('BrawlPanel: renders active skill trigger button when skill available', () => {
  const selfBrawl: SelfBrawlView = {
    roleId: 'hong_haier',
    roleName: '红孩儿',
    roleTitle: '圣婴大王',
    camp: 'red',
    skill: {
      skillId: 'sanmei_zhenhuo',
      skillName: '三昧真火',
      triggerPhase: 'assassination',
      actionType: 'single_button',
      maxUses: 1,
      description: '开局见红方同伙；任务3胜后负责辨识并一击刺杀孙悟空。',
    },
    skillAvailable: true,
    skillUsed: false,
  };

  const html = renderToStaticMarkup(createElement(BrawlPanel, { selfBrawl }));

  assert.match(html, /【红孩儿】/);
  assert.match(html, /三昧真火/);
  assert.match(html, /发动法宝/);
});

test('BrawlPanel: does not render neutral choice banner for regular players or already decided', () => {
  const selfBrawl: SelfBrawlView = {
    roleId: 'sun_wukong',
    roleName: '孙悟空',
    roleTitle: '齐天大圣',
    camp: 'blue',
    skill: {
      skillId: 'huoyan_jinjing',
      skillName: '火眼金睛',
      triggerPhase: 'game_start',
      actionType: 'passive',
      maxUses: 1,
      description: '开局见红方妖气。',
    },
    skillAvailable: false,
    skillUsed: false,
  };

  const html = renderToStaticMarkup(createElement(BrawlPanel, { selfBrawl }));

  assert.doesNotMatch(html, /天命抉择/);
  assert.match(html, /【孙悟空】/);
  assert.match(html, /火眼金睛/);
});

test('BrawlPanel: renders peeked intelligence for blind box reconnaissance (Erlang Shen)', () => {
  const selfBrawl: SelfBrawlView = {
    roleId: 'erlang_shen',
    roleName: '二郎神',
    roleTitle: '清源妙道真君',
    camp: 'blue',
    skill: {
      skillId: 'tianyan_zhaoxu',
      skillName: '天眼照虚',
      triggerPhase: 'game_start',
      actionType: 'passive',
      maxUses: 1,
      description: '开局私密得知本局红方随机盲盒中抽中的 1 位妖魔名号。',
    },
    skillAvailable: false,
    skillUsed: false,
    peekedRoles: [{ roleId: 'niu_mowang', roleName: '牛魔王', camp: 'red' }],
  };

  const html = renderToStaticMarkup(createElement(BrawlPanel, { selfBrawl }));

  assert.match(html, /盲盒天机：本局敌对潜伏底牌包含【牛魔王】/);
});

test('BrawlPanel: renders battle events strictly obeying Event Public Player Anonymous', () => {
  const selfBrawl: SelfBrawlView = {
    roleId: 'zhu_bajie',
    roleName: '猪八戒',
    roleTitle: '天蓬元帅',
    camp: 'blue',
    skill: {
      skillId: 'daoda_yipa',
      skillName: '倒打一耙',
      triggerPhase: 'team_voting',
      actionType: 'single_button',
      maxUses: 1,
      description: '倒打一耙反转最后 1 张反对票！',
    },
    skillAvailable: true,
    skillUsed: false,
  };

  const events: BrawlBattleEvent[] = [
    {
      id: 'e1',
      roleId: 'rulai_fozu',
      roleName: '如来佛祖',
      skillName: '五行山掌',
      summary: '如来佛祖降下五行山：3号玩家被镇压一轮，本轮禁止入选车队与参与表决！',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'e2',
      roleId: 'wangmu_niangniang',
      roleName: '王母娘娘',
      skillName: '九转仙桃',
      summary: '王母娘娘赐下瑶池仙桃护体：本次出征任务需【至少 2 张失败牌】方算失败！',
      timestamp: new Date().toISOString(),
    },
  ];

  const html = renderToStaticMarkup(createElement(BrawlPanel, { selfBrawl, events }));

  assert.match(html, /天机战报记录 \(2条\)/);
  assert.doesNotMatch(html, /施法者/);
});

test('GuideRoles(mode="brawl"): renders all 30 all-star Journey to the West characters', async () => {
  const { GuideRoles, GuideRules, GuidePanel } = await import('../src/GuidePanel.js');
  const rolesHtml = renderToStaticMarkup(createElement(GuideRoles, { mode: 'brawl' }));
  const rulesHtml = renderToStaticMarkup(createElement(GuideRules, { mode: 'brawl' }));
  const panelHtml = renderToStaticMarkup(createElement(GuidePanel, { onBack: () => {} }));

  // Check 30 roles exist in brawl guide
  for (const name of [
    '孙悟空', '唐三藏', '如来佛祖', '玉皇大帝', '王母娘娘', '太上老君', '菩提祖师',
    '观音菩萨', '镇元大仙', '二郎神', '哪吒三太子', '托塔李天王', '猪八戒', '沙悟净', '白龙马',
    '红孩儿', '六耳猕猴', '白骨精', '蜘蛛精', '玉兔精', '老鼠精', '牛魔王', '铁扇公主',
    '黄眉老怪', '金角大王', '银角大王', '黄风怪', '百眼魔君', '青毛狮子怪', '金翅大鹏雕',
  ]) {
    assert.match(rolesHtml, new RegExp(name), `Missing brawl role in guide: ${name}`);
  }

  // Check key brawl mechanics in rules
  assert.match(rulesHtml, /30位全明星神魔/);
  assert.match(rulesHtml, /30位弱技能设计原则/);
  assert.match(rulesHtml, /天机战报“公法不公人”原则/);

  // Check GuidePanel renders brawl guide directly without legacy classic mode switch
  assert.match(panelHtml, /《西游 · 仙魔大乱斗》/);
  assert.doesNotMatch(panelHtml, /经典原版（真假猴王）/);
  assert.match(panelHtml, /如来佛祖/);
  // Check back button uses graphical icon rather than plain text "返回"
  assert.match(panelHtml, /guide-back-icon-btn/);
  assert.doesNotMatch(panelHtml, />返回<\/button>/);
});

test('BrawlPanel: privacyMode hides sensitive role/camp/skills from public board and only shows neutral notice', () => {
  const selfBrawl: SelfBrawlView = {
    roleId: 'hong_hai_er',
    roleName: '红孩儿',
    roleTitle: '圣婴大王',
    camp: 'red',
    skill: {
      skillId: 'sanmei_zhenhuo',
      skillName: '三昧真火',
      triggerPhase: 'assassination',
      actionType: 'single_button',
      maxUses: 1,
      description: '开局见红方同伙；任务3胜后负责辨识并一击刺杀孙悟空。',
    },
    skillAvailable: true,
    skillUsed: false,
  };

  const html = renderToStaticMarkup(createElement(BrawlPanel, { selfBrawl, privacyMode: true }));

  // In privacy mode on public board, sensitive identity must be completely absent!
  assert.doesNotMatch(html, /【红孩儿】/);
  assert.doesNotMatch(html, /三昧真火/);
  assert.doesNotMatch(html, /圣婴大王/);
  assert.doesNotMatch(html, /发动法宝/);
  // It should only show a neutral privacy notice pill
  assert.match(html, /brawl-privacy-notice-pill/);
  assert.match(html, /你有神魔法宝待决，点击「真身」私下查看与发动/);
});

test('IdentityDetails: renders compact brawl identity card with protected avatar button and skill trigger', async () => {
  const { IdentityDetails } = await import('../src/IdentityDetails.js');
  const selfBrawl: SelfBrawlView = {
    roleId: 'hong_hai_er',
    roleName: '红孩儿',
    roleTitle: '圣婴大王',
    camp: 'red',
    artPrefix: 'assassin',
    skill: {
      skillId: 'sanmei_zhenhuo',
      skillName: '三昧真火',
      triggerPhase: 'assassination',
      actionType: 'single_button',
      maxUses: 1,
      description: '开局见红方同伙；任务3胜后负责辨识并一击刺杀孙悟空。',
    },
    skillAvailable: true,
    skillUsed: false,
  };

  const fakeSelf: any = {
    role: 'assassin',
    team: 'red',
    evilIds: ['p2'],
    merlinCandidates: [],
    confirmed: true,
    teamVoted: false,
    missionVoted: false,
    canDecideEarly: false,
  };

  const fakeGame: any = {
    selfBrawl,
    players: [{ id: 'p1', seat: 1, nickname: '老X' }, { id: 'p2', seat: 2, nickname: '豪哥' }],
  };

  const html = renderToStaticMarkup(createElement(IdentityDetails, {
    self: fakeSelf,
    players: fakeGame.players,
    game: fakeGame,
  }));

  // Verifies banner, protected button class, role information and skill action inside private sheet
  assert.match(html, /brawl-identity-banner/);
  assert.match(html, /brawl-identity-avatar-btn/);
  assert.match(html, /【红孩儿】· 圣婴大王/);
  assert.match(html, /绝技 · 三昧真火/);
  assert.match(html, /发动绝技/);
  assert.match(html, /神魔心法/);
  // Strictly verifies that the second classic role card and redundant legacy treasures are NOT rendered in brawl mode
  assert.doesNotMatch(html, /identity-card/);
  assert.doesNotMatch(html, /identity-treasure-row/);
});

test('BrawlPanel: battle events explain exact meaning and tactical effect instead of just skill name', () => {
  const selfBrawl: SelfBrawlView = {
    roleId: 'sun_wukong',
    roleName: '孙悟空',
    roleTitle: '齐天大圣',
    camp: 'blue',
    skill: {
      skillId: 'huoyan_jinjing',
      skillName: '火眼金睛',
      triggerPhase: 'game_start',
      actionType: 'passive',
      maxUses: 1,
      description: '开局见红方妖气。',
    },
    skillAvailable: false,
    skillUsed: false,
  };

  const legacyEvent: BrawlBattleEvent = {
    id: 'e-puti',
    roleId: 'puti_zhushi',
    roleName: '菩提祖师',
    skillName: '道法点化',
    summary: '【菩提祖师】施展【道法点化】！',
    timestamp: new Date().toISOString(),
  };

  const detailedEvent: BrawlBattleEvent = {
    id: 'e-rulai',
    roleId: 'rulai_fozu',
    roleName: '如来佛祖',
    skillName: '五行山掌',
    summary: '【如来佛祖】祭出绝技【五行山掌】对【3号 · 老X】！效用：镇压目标仙友一轮，使其本轮不可入选车队且表决自动弃权。',
    description: '镇压目标仙友一轮，使其本轮不可入选车队且表决自动弃权。',
    timestamp: new Date().toISOString(),
  };

  const html = renderToStaticMarkup(createElement(BrawlPanel, {
    selfBrawl,
    events: [legacyEvent, detailedEvent],
    defaultShowEvents: true,
  }));

  // Both legacy and detailed events must explain tactical effect so players understand what it means
  assert.match(html, /威能效用：/);
  assert.match(html, /第 2 轮任务后，50% 概率让除孙悟空外的 1 名随机蓝方私密得知 1 位红方真名/);
  assert.match(html, /镇压目标仙友一轮/);
});

test('BrawlReplayTimeline: renders grouped post-game actions with actor, skill, target and tactical outcome', () => {
  const actions: BrawlReplayAction[] = [
    {
      id: 'rep-init',
      roundNumber: 0,
      mission: 0,
      phase: 'game_start',
      actorId: 'p1',
      actorSeat: 1,
      actorNickname: '老张',
      roleId: 'erlang_shen',
      roleName: '二郎神',
      skillName: '天眼照虚',
      outcome: 'info',
      detail: '开局天机侦察：探得盲盒角色【百眼魔君】。',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'rep-m1',
      roundNumber: 1,
      mission: 1,
      phase: 'mission_resolved',
      actorId: 'p4',
      actorSeat: 4,
      actorNickname: '老孙',
      roleId: 'baiyan_mojun',
      roleName: '百眼魔君',
      skillName: '黄花毒茶',
      targetId: 'p2',
      targetSeat: 2,
      targetNickname: '老李',
      outcome: 'success',
      detail: '黄花毒茶毒发成功（小车 33% 概率命中）：暗中将【2号 · 老李】投出的【成功牌】静默毒化为【失败牌】！',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'rep-kill',
      roundNumber: 3,
      mission: 3,
      phase: 'assassination',
      actorId: 'p5',
      actorSeat: 5,
      actorNickname: '小红',
      roleId: 'hong_haier',
      roleName: '红孩儿',
      skillName: '三昧真火刺杀',
      targetId: 'p3',
      targetSeat: 3,
      targetNickname: '老王',
      outcome: 'success',
      detail: '喷吐三昧真火绝杀一击，直刺【3号 · 老王】，一举命中齐天大圣孙悟空！红方妖魔绝杀逆转获胜！',
      timestamp: new Date().toISOString(),
    },
  ];

  const html = renderToStaticMarkup(createElement(BrawlReplayTimeline, { actions }));

  assert.match(html, /仙魔对局全景复盘/);
  assert.match(html, /共 3 处法宝斗法/);
  assert.match(html, /初始天机 · 开局窥探/);
  assert.match(html, /第 1 难 · 取经斗法/);
  assert.match(html, /终局决战 · 刺杀大圣/);
  assert.match(html, /老张/);
  assert.match(html, /二郎神/);
  assert.match(html, /【天眼照虚】/);
  assert.match(html, /老孙/);
  assert.match(html, /百眼魔君/);
  assert.match(html, /【黄花毒茶】/);
  assert.match(html, /锁定目标：/);
  assert.match(html, /2号 · 老李/);
  assert.match(html, /黄花毒茶毒发成功/);
  assert.match(html, /小红/);
  assert.match(html, /红孩儿/);
  assert.match(html, /一举命中齐天大圣孙悟空/);
});

test('BattleHistory: renders brawl chronicle with opening, round, assassination, and empty state', () => {
  const dummyPlayers: Player[] = [
    { id: 'p1', seat: 1, nickname: '玩家1' },
    { id: 'p2', seat: 2, nickname: '玩家2' },
    { id: 'p3', seat: 3, nickname: '玩家3' },
  ];
  const dummyRounds: RoundView[] = [
    {
      number: 1,
      mission: 1,
      captainId: 'p1',
      team: ['p1', 'p2'],
      direction: 'clockwise',
      vote: { approvals: 2, rejections: 1, passed: true },
      result: { successes: 2, failures: 0, passed: true },
    },
  ];

  // 1. When brawlActions is [] (empty)
  const emptyHtml = renderToStaticMarkup(
    createElement(BattleHistory, {
      rounds: dummyRounds,
      players: dummyPlayers,
      anonymous: false,
      userId: 'p1',
      brawlActions: [],
    })
  );
  assert.match(emptyHtml, /本局全场玩家均未施展主动法宝或触发暗算/);

  // 2. When brawlActions has opening (0), round 1, and assassination
  const actions: BrawlReplayAction[] = [
    {
      id: 'rep-0',
      roundNumber: 0,
      mission: 0,
      phase: 'game_start',
      actorId: 'p1',
      actorSeat: 1,
      actorNickname: '老张',
      roleId: 'zhenyuan_daxian',
      roleName: '镇元大仙',
      skillName: '袖里乾坤',
      outcome: 'info',
      detail: '开局天机侦察：探得盲盒角色【百眼魔君】。',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'rep-1',
      roundNumber: 1,
      mission: 1,
      phase: 'mission_resolved',
      actorId: 'p2',
      actorSeat: 2,
      actorNickname: '老李',
      roleId: 'baiyan_mojun',
      roleName: '百眼魔君',
      skillName: '黄花毒茶',
      targetId: 'p1',
      targetSeat: 1,
      targetNickname: '老张',
      outcome: 'success',
      detail: '黄花毒茶毒发成功：将老张的成功牌毒化为失败牌！',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'rep-kill',
      roundNumber: 1,
      mission: 1,
      phase: 'assassination',
      actorId: 'p3',
      actorSeat: 3,
      actorNickname: '小红',
      roleId: 'hong_haier',
      roleName: '红孩儿',
      skillName: '三昧真火刺杀',
      outcome: 'success',
      detail: '喷吐三昧真火一击命中孙悟空！',
      timestamp: new Date().toISOString(),
    },
  ];

  const fullHtml = renderToStaticMarkup(
    createElement(BattleHistory, {
      rounds: dummyRounds,
      players: dummyPlayers,
      anonymous: false,
      userId: 'p1',
      brawlActions: actions,
    })
  );

  assert.match(fullHtml, /初始天机 · 开局窥探实录/);
  assert.match(fullHtml, /镇元大仙/);
  assert.match(fullHtml, /仙妖斗法实录/);
  assert.match(fullHtml, /百眼魔君/);
  assert.match(fullHtml, /终局决战 · 刺杀大圣实录/);
  assert.match(fullHtml, /红孩儿/);
});
