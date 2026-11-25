import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultSettings, type RoomView } from '@avalon/contracts';
import { createGame, projectGame, transition, BRAWL_ROLE_REGISTRY } from '@avalon/game-core';
import { BrawlPanel } from '../src/BrawlPanel.js';
import { MissionReportDialog } from '../src/MissionReportDialog.js';
import { GamePanel } from '../src/GamePanel.js';
import { GuideRules, GuideRoles } from '../src/GuidePanel.js';

const makePlayers = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `u${i + 1}`, nickname: `仙友${i + 1}`, seat: i + 1 }));

test('BrawlPanel disables current userId properly for self-restricted target skills', () => {
  const players = makePlayers(6);
  const html = renderToStaticMarkup(createElement(BrawlPanel, {
    userId: 'u2',
    players,
    selfBrawl: {
      roleId: 'rulai_fozu',
      roleName: '如来佛祖',
      roleTitle: '万佛之祖',
      camp: 'blue',
      skill: BRAWL_ROLE_REGISTRY.rulai_fozu.skill,
      skillAvailable: true,
      skillUsed: false,
    },
  }));
  assert.ok(html.includes('2号 仙友2 (自己)'), 'Self option labeled properly via userId match');
  assert.match(html, /value="u2"[^>]*disabled/);
});

test('MissionReportDialog renders masked chaotic_fog counts and forced launch banner cleanly', () => {
  const players = makePlayers(6);
  const html = renderToStaticMarkup(createElement(MissionReportDialog, {
    players,
    anonymous: true,
    userId: 'u1',
    isBrawl: true,
    onClose: () => {},
    round: {
      number: 3,
      mission: 2,
      captainId: 'u3',
      team: ['u1', 'u2', 'u3'],
      direction: 'clockwise',
      militaryWager: true,
      vote: { approvals: 0, rejections: 0, abstentions: 0, passed: true, forced: true },
      result: { successes: -1, failures: -1, passed: true, masked: true },
    },
  }));
  assert.ok(html.includes('混沌迷雾遮蔽'));
  assert.ok(html.includes('具体张数隐藏'));
  assert.ok(html.includes('两流必发 · 强制启程'));
  assert.ok(html.includes('立军令状亲征'));
});

test('GamePanel renders ordeal banner, 2-rejection track, and military wager toggle on Mission 2', () => {
  const players = makePlayers(6);
  const settings = { ...defaultSettings, playerCount: 6, brawlModeEnabled: true, brawlOrdealsEnabled: true };
  let game = createGame('ui-ordeal-game', players, settings, a => a);
  game.captainOrder = players.map(p => p.id);
  game.captainIndex = 0;
  game.mission = 2;
  game.phase = 'proposing';
  game.brawl!.ordeals!.deck = ['chaotic_fog', 'celestial_swap', 'selfless_captain', 'shituo_bounty', 'quicksand_ban'];
  game.brawl!.ordeals!.currentOrdealId = 'celestial_swap';

  const projected = projectGame(game, 'u1');
  const room: RoomView = {
    id: 'r1',
    code: '123456',
    hostId: 'u1',
    version: 1,
    settings,
    members: players.map(p => ({ ...p, ready: true, online: true })),
    phase: 'playing',
    acceptingNewMembers: false,
    game: projected,
  };

  const html = renderToStaticMarkup(createElement(GamePanel, {
    room,
    userId: 'u1',
    disabled: false,
    connected: true,
    send: () => {},
  }));
  assert.ok(html.includes('第 2 难奇劫 · 天意篡改'), 'Displays active ordeal banner');
  assert.ok(html.includes('立军令状'), 'Displays military wager toggle for captain on Mission 2');
  assert.ok(html.includes('流局') && html.includes('0/2'), 'Displays 2-rejection cap in Brawl mode');

  // Verify live public event strip renders when overt skill fires
  game.brawl!.playerStates.u2 = { userId: 'u2', seat: 2, roleId: 'bai_longma', camp: 'blue', skillUsed: false };
  game = transition(game, 'u2', { type: 'brawlCommand', payload: { action: 'useSkill', skillId: 'longma_fuzhong' } }, players.map(p => p.id));
  const htmlAfterSkill = renderToStaticMarkup(createElement(GamePanel, {
    room: { ...room, game: projectGame(game, 'u1') },
    userId: 'u1',
    disabled: false,
    connected: true,
    send: () => {},
  }));
  assert.ok(htmlAfterSkill.includes('天机播报'), 'Renders live anonymous broadcast strip');
});

test('GuideRules & GuideRoles (brawl) match current engine rules: 6 leaders for 9+, two-reject force, ordeals, wager, accurate probs', () => {
  const rulesHtml = renderToStaticMarkup(createElement(GuideRules, { mode: 'brawl' }));
  const rolesHtml = renderToStaticMarkup(createElement(GuideRoles, { mode: 'brawl' }));

  // 1. 9–12p fixed 6 leaders + 5–8p fixed 4 leaders with bonus skill + 5–12p matrix
  assert.ok(rulesHtml.includes('固定必出 6 位领军'), 'Documents 9–12p fixed 6 leaders');
  assert.ok(rulesHtml.includes('观音菩萨') && rulesHtml.includes('黄眉老怪'), 'Lists Guanyin & Huangmei in 9–12p fixed leaders');
  assert.ok(rulesHtml.includes('固定必出 4 位领军') && rulesHtml.includes('同阵营主动副法宝'), 'Documents 5–8p core bonus skill');
  for (let n = 5; n <= 12; n++) {
    assert.ok(rulesHtml.includes(`${n} 人局`), `Renders ${n}-player brawl config card`);
  }

  // 2. Two-rejection forced launch replaces legacy 5-rejection auto-loss
  assert.ok(rulesHtml.includes('两流必发'), 'Documents two-rejection forced launch');
  assert.ok(!rulesHtml.includes('让流局次数达到五次'), 'Removed stale 5-rejection red win condition');

  // 3. All 5 Ordeal cards, Military Wager, and Phantom Vision
  for (const name of ['混沌迷雾', '弱水流沙', '舍己为公', '狮驼死战', '天意篡改']) {
    assert.ok(rulesHtml.includes(name), `Documents ordeal card: ${name}`);
  }
  assert.ok(rulesHtml.includes('立军令状'), 'Documents military wager');
  assert.ok(rulesHtml.includes('画皮惑眼'), 'Documents phantom vision');

  // 4. Accurate skill probabilities & dual-track battle event policy
  assert.ok(rulesHtml.includes('1 败 60%') && rulesHtml.includes('2 败 30%'), 'Accurate Yuhuang pardon odds');
  assert.ok(!rulesHtml.includes('仅对 4 人及以上车队有效'), 'Removed stale Wangmu 4+ restriction');
  assert.ok(rulesHtml.includes('显性公法白名单') && rulesHtml.includes('暗算密探静默执行'), 'Documents dual-track broadcast policy');

  // 5. Role encyclopedia accuracy, badges, passive labels & contrast
  assert.ok(rolesHtml.includes('全人数必出') && rolesHtml.includes('9人+必出'), 'Badges core & 9+ fixed leaders');
  assert.ok(rolesHtml.includes('常驻被动'), 'Passive roles labeled properly instead of 整局限用 1 次');
  assert.ok(!rolesHtml.includes('开局50%概率隐身'), 'Removed false Baigujing stealth claim');
  assert.ok(!rolesHtml.includes('大车50%、小车33%'), 'Removed stale Baiyan odds');
  assert.ok(!rolesHtml.includes('不扣全局流局上限'), 'Removed stale 5-rejection wording on Zhenyuan');
  assert.ok(!rolesHtml.includes('#ffd54f'), 'Removed low-contrast pale yellow on light card');
  assert.ok(rolesHtml.includes('大车 60%') && rolesHtml.includes('小车 50%'), 'Accurate Baiyan odds');
  assert.ok(rolesHtml.includes('60% 概率被紫金葫芦'), 'Accurate Jinjiao odds');
  assert.ok(rolesHtml.includes('无论任务成败均 100% 私密得知'), 'Accurate Guanyin unconditional probe');
});
