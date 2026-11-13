import type { BrawlReplayAction } from '@avalon/contracts';
import { useState } from 'react';

export function BrawlReplayTimeline({ actions }: { actions: BrawlReplayAction[] }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!actions || actions.length === 0) return null;

  // Group actions by mission/stage
  const groups: { title: string; items: BrawlReplayAction[] }[] = [];

  const initialItems = actions.filter(a => a.roundNumber === 0);
  if (initialItems.length > 0) {
    groups.push({ title: '🔮 初始天机 · 开局窥探', items: initialItems });
  }

  // Group by mission
  const missionNumbers = Array.from(
    new Set(actions.filter(a => a.roundNumber > 0 && a.phase !== 'assassination').map(a => a.mission)),
  ).sort((a, b) => a - b);

  for (const m of missionNumbers) {
    const items = actions.filter(a => a.mission === m && a.roundNumber > 0 && a.phase !== 'assassination');
    if (items.length > 0) {
      groups.push({ title: `🚩 第 ${m} 难 · 取经斗法`, items });
    }
  }

  const assassinationItems = actions.filter(a => a.phase === 'assassination');
  if (assassinationItems.length > 0) {
    groups.push({ title: '🗡️ 终局决战 · 刺杀大圣', items: assassinationItems });
  }

  return (
    <section className="brawl-replay-panel" aria-label="仙魔对决战事全景复盘">
      <div className="brawl-replay-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="brawl-replay-title">
          <span className="brawl-replay-icon" aria-hidden="true">📜</span>
          <strong>仙魔对局全景复盘 <small>· 战事乾坤录（共 {actions.length} 处法宝斗法）</small></strong>
        </div>
        <button
          type="button"
          className="secondary tool-pill brawl-replay-toggle-btn"
          aria-expanded={!collapsed}
        >
          {collapsed ? '展开复盘 ▼' : '收起复盘 ▲'}
        </button>
      </div>

      {!collapsed && (
        <div className="brawl-replay-body">
          {groups.map((group, idx) => (
            <div key={idx} className="brawl-replay-group">
              <h4 className="brawl-replay-group-title">{group.title}</h4>
              <div className="brawl-replay-group-items">
                {group.items.map(item => (
                  <div key={item.id} className={`brawl-replay-card outcome-${item.outcome}`}>
                    <div className="brawl-replay-card-head">
                      <div className="brawl-replay-actor">
                        <span className="brawl-replay-seat-tag">{item.actorSeat > 0 ? `${item.actorSeat}号` : '天机'}</span>
                        <strong className="brawl-replay-name">{item.actorNickname}</strong>
                        <span className="brawl-replay-role-pill">{item.roleName}</span>
                      </div>
                      <div className="brawl-replay-tags">
                        <span className="brawl-replay-skill-tag">【{item.skillName}】</span>
                        <span className={`brawl-replay-status-badge is-${item.outcome}`}>
                          {item.outcome === 'success'
                            ? '✓ 生效'
                            : item.outcome === 'blocked'
                              ? '🛡️ 被化解'
                              : item.outcome === 'info'
                                ? '👁️ 探查'
                                : '× 未触发'}
                        </span>
                      </div>
                    </div>
                    {item.targetNickname && (
                      <div className="brawl-replay-target">
                        <span className="target-label">🎯 锁定目标：</span>
                        <strong className="target-val">
                          {item.targetSeat ? `${item.targetSeat}号 · ` : ''}{item.targetNickname}
                        </strong>
                      </div>
                    )}
                    <p className="brawl-replay-detail">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
