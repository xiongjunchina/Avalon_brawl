import { useState } from 'react';
import type { Player, Role } from '@avalon/contracts';
import { assignFemaleDemons, assignLoyalGuardians, BRAWL_ROLE_REGISTRY } from '@avalon/game-core';
import { Modal } from './Modal';
import { formatRoleName } from './roles';

/** A compact trigger avoids making the whole practice toolbar a large form field. */
export function PracticeSeatPicker({ gameId = 'practice', rulesetVersion, players, roles, brawlRoles, value, onChange }: {
  gameId?: string; rulesetVersion?: string; players: Player[]; roles: Record<string, Role>; brawlRoles?: Record<string, string>; value: string; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const player = players.find(p => p.id === value);
  const currentBrawlRole = player && brawlRoles?.[player.id] ? BRAWL_ROLE_REGISTRY[brawlRoles[player.id]] : undefined;
  const loyalGuardians = assignLoyalGuardians(gameId, players, roles, rulesetVersion);
  const femaleDemons = assignFemaleDemons(gameId, players, roles);
  return <>
    <button type="button" className="practice-view-trigger" aria-label="切换试玩视角" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <span className="practice-view-seat"><span className="practice-view-label">视角 · </span>{player?.seat}号</span>
      <span className="practice-view-name">{player?.nickname}</span>
      {currentBrawlRole && (
        <span className="practice-view-brawl-tag" style={{ marginLeft: 4, color: '#fbbf24', fontSize: '13px', fontWeight: 600 }}>
          【{currentBrawlRole.name}】
        </span>
      )}
      <span className="practice-view-arrow" aria-hidden="true">⌄</span>
    </button>
    {open && <Modal label="切换试玩视角" scene="sword" onClose={() => setOpen(false)}>
      <section className="table-modal-sheet practice-view-sheet">
        <div className="table-modal-head"><strong>选择演练视角</strong><button className="secondary tool-pill" onClick={() => setOpen(false)}>返回</button></div>
        <div className="practice-view-options">{players.map(p => {
          const brawlRole = brawlRoles?.[p.id] ? BRAWL_ROLE_REGISTRY[brawlRoles[p.id]] : undefined;
          const displayRole = brawlRole ? brawlRole.fullName : formatRoleName(roles[p.id], loyalGuardians[p.id], femaleDemons[p.id]);
          const campColor = brawlRole ? (brawlRole.camp === 'blue' ? '#60a5fa' : brawlRole.camp === 'red' ? '#f87171' : '#fbbf24') : undefined;
          return (
            <button key={p.id} type="button" className="secondary" aria-pressed={p.id === value} data-player-id={p.id} onClick={() => { onChange(p.id); setOpen(false); }}>
              <span>{p.seat}号 · {p.nickname}</span>
              <small style={campColor ? { color: campColor, fontWeight: 500 } : undefined}>{displayRole}</small>
            </button>
          );
        })}</div>
      </section>
    </Modal>}
  </>;
}
