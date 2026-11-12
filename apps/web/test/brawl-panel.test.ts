import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BrawlPanel } from '../src/BrawlPanel.js';
import type { SelfBrawlView, BrawlBattleEvent } from '@avalon/contracts';

test('BrawlPanel: renders Heixiong Jing non-blocking choice banner when decision pending', () => {
  const selfBrawl: SelfBrawlView = {
    roleId: 'heixiong_jing',
    roleName: '黑熊精',
    roleTitle: '黑风大王 / 守山大神',
    camp: 'neutral',
    skill: {
      skillId: 'shenmo_yinian',
      skillName: '神魔一念',
      triggerPhase: 'team_building',
      actionType: 'camp_choice',
      maxUses: 1,
      description: '首轮必投成功；R1 结算后私下抉择加入蓝方或红方。',
    },
    skillAvailable: true,
    skillUsed: false,
    neutralDecisionPending: true,
  };

  const html = renderToStaticMarkup(createElement(BrawlPanel, { selfBrawl }));

  assert.match(html, /黑熊精 · 天命抉择（纯私下决定，全场不通报）/);
  assert.match(html, /皈依佛门 · 守山大神/);
  assert.match(html, /啸聚为妖 · 黑风大王/);
  assert.match(html, /第2轮投票前随时可定/);
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
    neutralDecisionPending: false,
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

test('GuideRoles(mode="brawl"): renders all 31 all-star Journey to the West characters', async () => {
  const { GuideRoles, GuideRules, GuidePanel } = await import('../src/GuidePanel.js');
  const rolesHtml = renderToStaticMarkup(createElement(GuideRoles, { mode: 'brawl' }));
  const rulesHtml = renderToStaticMarkup(createElement(GuideRules, { mode: 'brawl' }));
  const panelHtml = renderToStaticMarkup(createElement(GuidePanel, { onBack: () => {} }));

  // Check 31 roles exist in brawl guide
  for (const name of [
    '孙悟空', '唐三藏', '如来佛祖', '玉皇大帝', '王母娘娘', '太上老君', '菩提祖师',
    '观音菩萨', '镇元大仙', '二郎神', '哪吒三太子', '托塔李天王', '猪八戒', '沙悟净', '白龙马',
    '红孩儿', '六耳猕猴', '白骨精', '蜘蛛精', '玉兔精', '老鼠精', '牛魔王', '铁扇公主',
    '黄眉老怪', '金角大王', '银角大王', '黄风怪', '百眼魔君', '青毛狮子怪', '金翅大鹏雕',
    '黑熊精',
  ]) {
    assert.match(rolesHtml, new RegExp(name), `Missing brawl role in guide: ${name}`);
  }

  // Check key brawl mechanics in rules
  assert.match(rulesHtml, /31位全明星神魔/);
  assert.match(rulesHtml, /黑熊精专属暗身中立机制/);
  assert.match(rulesHtml, /天机战报“公法不公人”原则/);

  // Check GuidePanel includes mode switch and defaults to brawl
  assert.match(panelHtml, /仙魔大乱斗（31位全明星）/);
  assert.match(panelHtml, /经典原版（真假猴王）/);
  assert.match(panelHtml, /如来佛祖/);
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
