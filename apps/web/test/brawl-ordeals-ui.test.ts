import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultSettings, defaultBrawlSettings, normalizeBrawlSettings, type RoomView } from '@avalon/contracts';
import { createGame, projectGame, transition, BRAWL_ROLE_REGISTRY } from '@avalon/game-core';
import { BrawlPanel } from '../src/BrawlPanel.js';
import { MissionReportDialog } from '../src/MissionReportDialog.js';
import { GamePanel } from '../src/GamePanel.js';
import { GuideRules, GuideRoles } from '../src/GuidePanel.js';
import { ReplayView, StatisticsView } from '../src/AccountPanel.js';
import { SettingsFields, settingsText } from '../src/PresetsPanel.js';

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

test('GamePanel renders real Brawl portraits & role pills on ended seats, and places ordeal/events HUD below the 5-button utility row', () => {
  const players = makePlayers(10);
  const settings = { ...defaultSettings, playerCount: 10, brawlModeEnabled: true, brawlOrdealsEnabled: true };
  let game = createGame('ui-layout-and-reveal', players, settings, a => a);
  game.captainOrder = players.map(p => p.id);
  game.captainIndex = 0;
  game.phase = 'proposing';
  game.brawl!.ordeals!.deck = ['celestial_swap', 'chaotic_fog', 'selfless_captain', 'shituo_bounty', 'quicksand_ban'];
  game.brawl!.ordeals!.currentOrdealId = 'celestial_swap';

  const liveRoom: RoomView = {
    id: 'r-live',
    code: '654321',
    hostId: 'u1',
    version: 1,
    settings,
    members: players.map(p => ({ ...p, ready: true, online: true })),
    phase: 'playing',
    acceptingNewMembers: false,
    game: projectGame(game, 'u1'),
  };

  const liveHtml = renderToStaticMarkup(createElement(GamePanel, {
    room: liveRoom,
    userId: 'u1',
    disabled: false,
    connected: true,
    send: () => {},
  }));
  const seatsIdx = liveHtml.indexOf('table-seats-grid');
  const utilityIdx = liveHtml.indexOf('dock-utility-row');
  const hudIdx = liveHtml.indexOf('brawl-live-hud-stack');
  assert.ok(seatsIdx > 0 && utilityIdx > seatsIdx, 'Player table appears above 5-button utility row');
  assert.ok(hudIdx > utilityIdx, 'Ordeal description and live events strip appear BELOW the 5-button utility row');

  // Verify ended game table displays ACTUAL Brawl portraits & visible role pills (not classic loyal/minion art)
  game.brawl!.playerStates.u1.roleId = 'wangmu_niangniang';
  game.brawl!.playerStates.u1.camp = 'blue';
  game.brawlRoles!.u1 = 'wangmu_niangniang';
  game.roles.u1 = 'loyal';

  game.brawl!.playerStates.u2.roleId = 'tieshan_gongzhu';
  game.brawl!.playerStates.u2.camp = 'red';
  game.brawlRoles!.u2 = 'tieshan_gongzhu';
  game.roles.u2 = 'minion';

  game.phase = 'finished';
  game.result = { winner: 'red', reason: 'three_failures' };

  const endedHtml = renderToStaticMarkup(createElement(GamePanel, {
    room: { ...liveRoom, phase: 'finished', game: projectGame(game, 'u1') },
    userId: 'u1',
    disabled: false,
    connected: true,
    send: () => {},
  }));
  assert.ok(endedHtml.includes('brawl-wangmu-160.webp'), 'Ended seat renders real Wangmu Brawl portrait');
  assert.ok(endedHtml.includes('brawl-tieshan-160.webp'), 'Ended seat renders real Tieshan Brawl portrait');
  assert.ok(endedHtml.includes('ended-seat-role-pill team-blue') && endedHtml.includes('王母娘娘'), 'Ended seat shows visible Wangmu role pill');
  assert.ok(endedHtml.includes('ended-seat-role-pill team-red') && endedHtml.includes('铁扇公主'), 'Ended seat shows visible Tieshan role pill');
  assert.ok(endedHtml.includes('ended-outcome-lead') && !endedHtml.includes('ended-outcome-kicker'), 'Ended result banner uses compact single-row headline without tall kicker');
});

test('ReplayView renders complete Brawl skill timeline, per-round chronicle, and 5-8p bonus roles', () => {
  const players = makePlayers(6);
  const html = renderToStaticMarkup(createElement(ReplayView, {
    replay: {
      id: 'g-replay-1',
      startedAt: '2026-11-25T12:00:00.000Z',
      endedAt: '2026-11-25T12:20:00.000Z',
      rulesetVersion: 'standard-no-lancelot-v6',
      playerCount: 6,
      self: { nickname: '仙友1', seat: 1, role: 'merlin', team: 'blue', brawlRoleId: 'sun_wukong', brawlRoleName: '孙悟空' },
      result: { winner: 'blue', reason: 'merlin_survived', targetId: 'u2' },
      favorite: false,
      settings: { ...defaultSettings, playerCount: 6, brawlModeEnabled: true, brawlOrdealsEnabled: true },
      players,
      roles: { u1: 'merlin', u2: 'percival', u3: 'loyal', u4: 'loyal', u5: 'assassin', u6: 'morgana' },
      brawlRoles: { u1: 'sun_wukong', u2: 'tang_seng', u3: 'li_tianwang', u4: 'wangmu_niangniang', u5: 'hong_haier', u6: 'liuer_mihou' },
      brawlBonusRoles: { u1: 'rulai_fozu' },
      brawlReplayTimeline: [
        {
          id: 'act-1',
          roundNumber: 1,
          mission: 1,
          phase: 'team_building',
          actorId: 'u3',
          actorSeat: 3,
          actorNickname: '仙友3',
          roleId: 'li_tianwang',
          roleName: '托塔李天王',
          skillName: '照妖宝镜',
          outcome: 'info',
          detail: '举起照妖宝镜密照【1号仙友1、5号仙友5】：探查结果显示车内【妖氛弥漫（有妖魔）】。',
          timestamp: '2026-11-25T12:05:00.000Z',
        },
      ],
      rounds: [
        {
          number: 1,
          mission: 1,
          captainId: 'u1',
          team: ['u1', 'u5'],
          direction: 'clockwise',
          vote: { approvals: 4, rejections: 2, abstentions: 0, passed: true },
          result: { successes: 1, failures: 1, passed: false, masked: true },
        },
      ],
      inspections: [],
      earlyWindows: [],
    },
  }));
  assert.ok(html.includes('仙魔对局全景复盘'), 'ReplayView embeds full BrawlReplayTimeline');
  assert.ok(html.includes('仙妖斗法实录'), 'ReplayView embeds per-round skill chronicle in BattleHistory');
  assert.ok(html.includes('托塔李天王') && html.includes('妖氛弥漫（有妖魔）'), 'Shows exact actor, skill and outcome');
  assert.ok(html.includes('附带仙宝：如来佛祖·五行山掌'), 'Shows 5-8p bonus role in HistoryRoster');
  assert.ok(html.includes('复盘已还原真实成功/失败牌数'), 'Notes chaotic fog revealed counts in replay');
});

test('GamePanel 12-player true ellipse coordinates curve smoothly around oval table with zero overlap on 360x340 mobile', () => {
  const players = makePlayers(12);
  const settings = { ...defaultSettings, playerCount: 12, brawlModeEnabled: true, brawlOrdealsEnabled: true };
  const game = createGame('ui-12p-no-overlap', players, settings, a => a);
  const html = renderToStaticMarkup(createElement(GamePanel, {
    room: {
      id: 'r-12p',
      code: '121212',
      hostId: 'u1',
      version: 1,
      settings,
      members: players.map(p => ({ ...p, ready: true, online: true })),
      phase: 'playing',
      acceptingNewMembers: false,
      game: projectGame(game, 'u1'),
    },
    userId: 'u1',
    disabled: false,
    connected: true,
    send: () => {},
  }));
  const pcts = Array.from(html.matchAll(/style="left:([0-9.]+)%;top:([0-9.]+)%"/g)).map(m => ({
    xPct: parseFloat(m[1]),
    yPct: parseFloat(m[2]),
  }));
  assert.equal(pcts.length, 12, 'Renders all 12 seat coordinates');
  // 1. True elliptical curve: all 12 points lie on (x-50)^2/39.2^2 + (y-51)^2/41.2^2 ≈ 1
  for (let i = 0; i < 12; i++) {
    const e = ((pcts[i].xPct - 50) / 39.2) ** 2 + ((pcts[i].yPct - 51.0) / 41.2) ** 2;
    assert.ok(Math.abs(e - 1) < 0.02, `Seat ${i + 1} deviates from smooth ellipse (e=${e.toFixed(3)})`);
  }
  // 2. No ugly wide gap beside Seat 1 / Seat 7 and no flat straight side rails
  assert.ok(pcts[1].xPct <= 73 && pcts[11].xPct >= 27, 'Seats 2 and 12 stay snug beside Seat 1');
  assert.ok(pcts[3].xPct > pcts[2].xPct + 2.5, 'Seat 4 curves outward past Seat 3 instead of flat vertical rail');

  // 3. Exact 2D bounding box check on 360x340 mobile arena (avatar 32px, nameplate 74x16px, badge +6px above avatar)
  const W = 360, H = 340, halfH = 24.75, npW = 74, npH = 16, badgeExtra = 6;
  const coords = pcts.map(p => ({ x: (p.xPct / 100) * W, y: (p.yPct / 100) * H }));
  for (let i = 0; i < 12; i++) {
    assert.ok(coords[i].x - npW / 2 >= 0 && coords[i].x + npW / 2 <= W, `Seat ${i + 1} fits horizontally inside 360px`);
    assert.ok(coords[i].y - halfH - badgeExtra >= 0 && coords[i].y + halfH <= H, `Seat ${i + 1} fits vertically inside 340px`);
    for (let j = i + 1; j < 12; j++) {
      const hi = coords[i].y <= coords[j].y ? coords[i] : coords[j];
      const lo = coords[i].y <= coords[j].y ? coords[j] : coords[i];
      const sepNameVsBadge = Math.max(Math.abs(hi.x - lo.x) - (npW / 2 + 24), (lo.y - halfH - badgeExtra) - (hi.y + halfH));
      const sepNameVsName = Math.max(Math.abs(hi.x - lo.x) - npW, (lo.y + halfH - npH) - (hi.y + halfH));
      assert.ok(
        sepNameVsBadge >= 0 && sepNameVsName >= 0,
        `Seat ${i + 1} and Seat ${j + 1} overlap on 360x340 mobile (nameVsBadge=${sepNameVsBadge.toFixed(1)}, nameVsName=${sepNameVsName.toFixed(1)})`,
      );
    }
  }
});

test('StatisticsView renders 30 Brawl role stats with real portraits instead of collapsing Brawl games into classic loyal/minion', () => {
  const zero = { completed: 0, wins: 0, losses: 0, aborted: 0, winRate: null as number | null };
  const byRole = {
    merlin: { ...zero }, percival: { ...zero }, guinevere: { ...zero }, loyal: { ...zero },
    morgana: { ...zero }, assassin: { ...zero }, mordred: { ...zero }, oberon: { ...zero }, minion: { ...zero },
  };
  const byBrawlRole = Object.fromEntries(Object.keys(BRAWL_ROLE_REGISTRY).map(id => [id, { ...zero }]));
  byBrawlRole.wangmu_niangniang = { completed: 3, wins: 2, losses: 1, aborted: 0, winRate: 2 / 3 };
  byBrawlRole.tieshan_gongzhu = { completed: 2, wins: 1, losses: 1, aborted: 0, winRate: 0.5 };

  const html = renderToStaticMarkup(createElement(StatisticsView, {
    stats: {
      completed: 5, wins: 3, losses: 2, aborted: 0, winRate: 0.6,
      byRole,
      byBrawlRole,
      byTeam: {
        blue: { completed: 3, wins: 2, losses: 1, aborted: 0, winRate: 2 / 3 },
        red: { completed: 2, wins: 1, losses: 1, aborted: 0, winRate: 0.5 },
      },
    },
  }));
  assert.ok(html.includes('30 位神魔角色战绩'), 'Displays 30 Brawl role statistics heading');
  assert.ok(html.includes('王母娘娘') && html.includes('brawl-wangmu-160.webp'), 'Renders Wangmu Brawl stats and portrait');
  assert.ok(html.includes('铁扇公主') && html.includes('brawl-tieshan-160.webp'), 'Renders Tieshan Brawl stats and portrait');
  assert.ok(html.includes('托塔李天王') && html.includes('如来佛祖'), 'Includes other 30 Brawl roles');
  assert.ok(!html.includes('经典模式历史角色战绩'), 'Hides classic collapse section when user has no classic games');
  assert.ok(!html.includes('取经护法战绩') && !html.includes('女妖精战绩'), 'Does not render classic loyal/minion cards for pure Brawl user');
});

test('Brawl-only room settings remove classic options, normalize presets/dedicated defaults, and sync rules & role guides', () => {
  assert.equal(defaultBrawlSettings.brawlModeEnabled, true);
  assert.equal(defaultBrawlSettings.brawlOrdealsEnabled, true);
  assert.equal(defaultBrawlSettings.guardianPerksEnabled, false);
  assert.equal(defaultBrawlSettings.treasuresEnabled, false);

  const normalized = normalizeBrawlSettings({
    ...defaultSettings,
    brawlModeEnabled: false,
    guardianPerksEnabled: true,
    treasuresEnabled: true,
  });
  assert.equal(normalized.brawlModeEnabled, true);
  assert.equal(normalized.guardianPerksEnabled, false);
  assert.equal(normalized.treasuresEnabled, false);

  const fieldsHtml = renderToStaticMarkup(createElement(SettingsFields, {
    settings: defaultBrawlSettings,
    onChange: () => {},
  }));
  assert.ok(!fieldsHtml.includes('护法天机'), 'Removed guardianPerksEnabled from SettingsFields');
  assert.ok(!fieldsHtml.includes('专属法宝'), 'Removed treasuresEnabled from SettingsFields');
  assert.ok(!fieldsHtml.includes('流局计数') && !fieldsHtml.includes('5 次判负'), 'Removed classic 5-rejection scope from SettingsFields');
  assert.ok(!fieldsHtml.includes('room-brawlModeEnabled'), 'Removed classic/brawl mode switch from SettingsFields');
  for (const label of ['匿名组队投票', '提前刺杀', '倒计时后亮明真身', '心仪选角', '八十一难奇劫', '画皮惑眼']) {
    assert.ok(fieldsHtml.includes(label), `Keeps active Brawl option: ${label}`);
  }

  const summary = settingsText({
    ...defaultBrawlSettings,
    guardianPerksEnabled: true,
    treasuresEnabled: true,
    rolePreferenceEnabled: true,
    brawlPhantomVisionEnabled: true,
  });
  assert.ok(summary.includes('两流必发') && summary.includes('八十一难奇劫') && summary.includes('画皮惑眼') && summary.includes('心仪选角'));
  assert.ok(!summary.includes('护法天机') && !summary.includes('专属法宝') && !summary.includes('全局流局') && !summary.includes('任务流局'));

  const rulesHtml = renderToStaticMarkup(createElement(GuideRules, { mode: 'brawl' }));
  const rolesHtml = renderToStaticMarkup(createElement(GuideRoles, { mode: 'brawl' }));
  assert.ok(rulesHtml.includes('流局自动退还') && rulesHtml.includes('永久保留在【真身】底牌'), 'Rules guide documents refund & persistent private receipts');
  assert.ok(rulesHtml.includes('30 位神魔独立建档战绩') && rulesHtml.includes('仙妖斗法实录'), 'Rules guide documents 30-role stats and per-round skill replay');
  assert.ok(rulesHtml.includes('传统经典版的“护法天机”“8–12 人经典法宝”“五次流局判负”均已移除'), 'Rules guide reflects cleaned Brawl room settings');
  assert.ok(rolesHtml.includes('队伍为空时触发不扣次数') && rolesHtml.includes('结果永久保留在真身底牌'), 'Role guide documents updated Li Tianwang behavior');
  assert.ok(rolesHtml.includes('流局自动退还'), 'Role guide documents mission-skill refund on rejected votes');
});
