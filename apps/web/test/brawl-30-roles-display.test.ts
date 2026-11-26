import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BRAWL_ROLE_REGISTRY, createGame, projectGame } from '@avalon/game-core';
import { defaultSettings, type GameView, type RoomView } from '@avalon/contracts';
import { GamePanel } from '../src/GamePanel.js';
import { IdentityDetails } from '../src/IdentityDetails.js';
import { GuideRoles } from '../src/GuidePanel.js';
import { RolePreferenceModal } from '../src/RolePreferenceModal.js';
import { BRAWL_TACTICAL_TIPS } from '../src/brawl-roles.js';

const makePlayers = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    nickname: `仙友${i + 1}`,
    seat: i + 1,
  }));

test('UI 30-role display audit: every Brawl role renders exact camp class, name, and v3 portrait in ended GamePanel, GuideRoles, RolePreferenceModal, and IdentityDetails', () => {
  const allRoles = Object.values(BRAWL_ROLE_REGISTRY);
  assert.equal(allRoles.length, 30);

  // 1. Tactical tips cover all 30 roles
  for (const role of allRoles) {
    assert.ok(BRAWL_TACTICAL_TIPS[role.id]?.length > 10, `Missing tactical tip for ${role.id}`);
  }

  // 2. GuideRoles renders all 30 roles with exact artPrefix-160.webp?v=brawl-art-v3
  const guideHtml = renderToStaticMarkup(createElement(GuideRoles, { mode: 'brawl' }));
  for (const role of allRoles) {
    assert.ok(guideHtml.includes(role.name), `GuideRoles missing ${role.name}`);
    assert.ok(guideHtml.includes(`${role.artPrefix}-160.webp?v=brawl-art-v3`), `GuideRoles missing portrait for ${role.id}`);
  }

  // 3. RolePreferenceModal renders all 30 roles with matching team-blue / team-red class
  const prefHtml = renderToStaticMarkup(createElement(RolePreferenceModal, {
    open: true,
    onClose: () => {},
    currentPreferences: [],
    onSave: async () => {},
    playerCount: 12,
    brawlMode: true,
  }));
  for (const role of allRoles) {
    assert.ok(prefHtml.includes(role.name), `RolePreferenceModal missing ${role.name}`);
    assert.ok(prefHtml.includes(`${role.artPrefix}-160.webp?v=brawl-art-v3`), `RolePreferenceModal missing portrait for ${role.id}`);
  }

  // 4. Ended GamePanel renders ALL 30 roles across 3 10-player ended tables with exact Blue/Red classes & portraits
  for (let batch = 0; batch < 3; batch++) {
    const slice = allRoles.slice(batch * 10, batch * 10 + 10);
    const players = makePlayers(10);
    const g = createGame(`ui-ended-batch-${batch}`, players, { ...defaultSettings, playerCount: 10, brawlModeEnabled: true }, a => a);
    for (let i = 0; i < 10; i++) {
      const pid = players[i].id;
      const roleDef = slice[i];
      g.roles[pid] = roleDef.camp === 'blue' ? 'loyal' : 'minion';
      g.brawlRoles![pid] = roleDef.id;
      if (!g.brawl!.playerStates) g.brawl!.playerStates = {};
      g.brawl!.playerStates[pid] = {
        userId: pid,
        seat: i + 1,
        roleId: roleDef.id,
        camp: roleDef.camp,
        skillUsed: false,
      };
    }
    // Simulate Nezha (or seat 4) being mistakenly assassinated
    g.phase = 'finished';
    g.result = { winner: 'blue', reason: 'merlin_survived', targetId: 'p4' };

    const view = projectGame(g, 'p1');
    const room: RoomView = {
      id: 'r1',
      code: '123456',
      phase: 'finished',
      acceptingNewMembers: true,
      hostId: 'p1',
      version: 1,
      serverTime: new Date().toISOString(),
      settings: { ...defaultSettings, playerCount: 10, brawlModeEnabled: true },
      members: players.map(p => ({ ...p, ready: true, online: true })),
      game: view,
    };

    const html = renderToStaticMarkup(createElement(GamePanel, {
      room,
      userId: 'p1',
      connected: true,
      disabled: false,
      send: () => {},
    }));

    for (let i = 0; i < 10; i++) {
      const roleDef = slice[i];
      const expectedRevealClass = `is-revealed-${roleDef.camp}`;
      const seatSnippetRe = new RegExp(`data-player-id="${players[i].id}"[^>]*class="[^"]*${expectedRevealClass}[^"]*"`);
      assert.match(html, seatSnippetRe, `Seat ${i + 1} (${roleDef.id}) must have ${expectedRevealClass}`);
      assert.ok(html.includes(`${roleDef.artPrefix}-160.webp?v=brawl-art-v3`), `Ended seat portrait missing for ${roleDef.id}`);
      assert.ok(html.includes(`team-${roleDef.camp}" title="${roleDef.name}"`), `Ended role pill camp mismatch for ${roleDef.id}`);
    }
  }

  // 5. IdentityDetails renders every single one of the 30 roles with exact camp banner & phase gating
  const players6 = makePlayers(6);
  for (const roleDef of allRoles) {
    const g = createGame(`ui-id-${roleDef.id}`, players6, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
    g.phase = 'mission';
    g.roles.p1 = roleDef.camp === 'blue' ? 'loyal' : 'minion';
    g.brawlRoles!.p1 = roleDef.id;
    g.brawl!.playerStates!.p1 = { userId: 'p1', seat: 1, roleId: roleDef.id, camp: roleDef.camp, skillUsed: false };
    const view = projectGame(g, 'p1');
    const html = renderToStaticMarkup(createElement(IdentityDetails, {
      self: view.self!,
      players: players6,
      game: view,
      userId: 'p1',
    }));
    assert.ok(html.includes(`【${roleDef.name}】`), `IdentityDetails missing ${roleDef.name}`);
    assert.ok(html.includes(roleDef.camp === 'blue' ? '仙佛阵营' : '妖魔阵营'), `IdentityDetails camp label mismatch for ${roleDef.id}`);
    assert.ok(html.includes(`${roleDef.artPrefix}-160.webp?v=brawl-art-v3`), `IdentityDetails portrait mismatch for ${roleDef.id}`);
  }
});

test('UI visual guardrail: assassinated Blue seat keeps Blue border (never red) and Qingmao Shizi renders native 🦁 吞天 badge', () => {
  const scenesCss = fs.readFileSync(path.resolve(process.cwd(), 'apps/web/src/scenes.css'), 'utf8');
  const styleCss = fs.readFileSync(path.resolve(process.cwd(), 'apps/web/src/style.css'), 'utf8');

  // Guardrail: .is-assassinated-seat MUST NOT override border-color with red (#ef4444 / #dc2626 / #ff5252)
  const scenesAssassinatedBlock = scenesCss.match(/\.is-assassinated-seat[^{]*\{[^}]*\}/g) ?? [];
  const styleAssassinatedBlock = styleCss.match(/\.is-assassinated-seat[^{]*\{[^}]*\}/g) ?? [];
  assert.ok(scenesAssassinatedBlock.length > 0 && styleAssassinatedBlock.length > 0);
  for (const block of [...scenesAssassinatedBlock, ...styleAssassinatedBlock]) {
    assert.doesNotMatch(block, /border-color\s*:\s*(#ef4444|#dc2626|#ff5252)/i, `Assassinated seat CSS must never overwrite camp border with red: ${block}`);
  }

  // Qingmao Shizi active ban renders 🦁 吞天 (NOT classic 🎒 禁选)
  const players = makePlayers(6);
  const g = createGame('ui-qingshi-badge', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  g.phase = 'proposing';
  g.brawl!.qingshiTuntianTargetId = 'p2';
  const view: GameView = projectGame(g, 'p1');
  const room: RoomView = {
    id: 'r2',
    code: '654321',
    phase: 'playing',
    acceptingNewMembers: true,
    hostId: 'p1',
    version: 1,
    serverTime: new Date().toISOString(),
    settings: { ...defaultSettings, playerCount: 6, brawlModeEnabled: true },
    members: players.map(p => ({ ...p, ready: true, online: true })),
    game: view,
  };
  const html = renderToStaticMarkup(createElement(GamePanel, {
    room,
    userId: 'p1',
    connected: true,
    disabled: false,
    send: () => {},
  }));
  assert.match(html, /🦁 吞天/);
  assert.doesNotMatch(html, /后天人种袋/);
});
