import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultSettings, type RoomView } from '@avalon/contracts';
import { createGame, projectGame, transition, BRAWL_ROLE_REGISTRY } from '@avalon/game-core';
import { BrawlPanel } from '../src/BrawlPanel.js';
import { MissionReportDialog } from '../src/MissionReportDialog.js';
import { GamePanel } from '../src/GamePanel.js';

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
