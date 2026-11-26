import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultSettings } from '@avalon/contracts';
import { createGame, projectGame } from '@avalon/game-core';
import { IdentityDetails } from '../src/IdentityDetails';

test('IdentityDetails renders Brawl role name, skill and server-computed controls', () => {
  const players = Array.from({ length: 6 }, (_, i) => ({ id: `p${i + 1}`, seat: i + 1, nickname: `仙友${i + 1}` }));
  const game = createGame('identity-brawl-ui', players, { ...defaultSettings, playerCount: 6, brawlModeEnabled: true }, a => a);
  game.phase = 'proposing';

  for (const player of players) {
    const view = projectGame(game, player.id);
    const self = view.self!;
    const html = renderToStaticMarkup(createElement(IdentityDetails, { self, players, game: view }));
    assert.ok(view.selfBrawl, 'selfBrawl must exist for brawl mode');
    assert.ok(html.includes(view.selfBrawl.roleName), `HTML must contain roleName ${view.selfBrawl.roleName}`);
    assert.ok(html.includes(view.selfBrawl.skill.skillName), `HTML must contain skillName ${view.selfBrawl.skill.skillName}`);
  }
});
