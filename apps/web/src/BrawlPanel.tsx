import { useState } from 'react';
import type { SelfBrawlView, BrawlBattleEvent } from '@avalon/contracts';
import { BRAWL_ROLE_REGISTRY } from '@avalon/game-core';

interface BrawlPanelProps {
  selfBrawl?: SelfBrawlView;
  events?: BrawlBattleEvent[];
  onUseSkill?: (skillId: string, targetId?: string) => void;
  players?: { id: string; nickname: string; seat: number }[];
  privacyMode?: boolean;
  onOpenIdentity?: () => void;
  defaultShowEvents?: boolean;
}

export function BrawlPanel({
  selfBrawl,
  events = [],
  onUseSkill,
  players = [],
  privacyMode = false,
  onOpenIdentity,
  defaultShowEvents = false,
}: BrawlPanelProps) {
  const [showEvents, setShowEvents] = useState(defaultShowEvents);
  const [selectedTarget, setSelectedTarget] = useState<string>('');

  if (!selfBrawl) return null;

  const hasPendingAction = Boolean(
    selfBrawl.skillAvailable && !selfBrawl.skillUsed && selfBrawl.skill.actionType !== 'passive'
  );

  return (
    <div className="brawl-container" style={{ margin: '6px 0' }}>
      {/* 隐私防偷看模式（用于对局大盘公屏）：隐藏敏感神魔底牌、阵营色与技能，仅提供不泄密的中性提示，在「真身」私密面板内操作 */}
      {privacyMode ? (
        hasPendingAction && (
          <div
            className="brawl-privacy-notice-pill"
            onClick={onOpenIdentity}
            title="点击打开真身面板私密发动"
          >
            <span>✦ 你有神魔法宝待决，点击「真身」私下查看与发动 ❯</span>
          </div>
        )
      ) : (
        <>
          {/* 个人乱斗真身与弱技能胶囊卡 */}
          <div
            className="brawl-skill-card"
            style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 'bold', color: selfBrawl.camp === 'blue' ? '#60a5fa' : selfBrawl.camp === 'red' ? '#f87171' : '#fbbf24' }}>
                  【{selfBrawl.roleName}】
                </span>
                <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{selfBrawl.skill.skillName}</span>
                {selfBrawl.skillUsed && (
                  <span style={{ fontSize: '11px', background: '#475569', color: '#94a3b8', padding: '2px 6px', borderRadius: '4px' }}>
                    已消耗
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                {selfBrawl.skill.description}
              </div>

              {/* 盲盒窥视情报（二郎神、百眼魔君、老鼠精） */}
              {selfBrawl.peekedRoles && selfBrawl.peekedRoles.length > 0 && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#38bdf8' }}>
                  🔍 盲盒天机：本局敌对潜伏底牌包含【{selfBrawl.peekedRoles.map(r => r.roleName).join('、')}】
                </div>
              )}
            </div>

            {/* 技能发动交互 */}
            {selfBrawl.skillAvailable && !selfBrawl.skillUsed && selfBrawl.skill.actionType !== 'passive' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {selfBrawl.skill.actionType === 'target_player' && (
                  <select
                    value={selectedTarget}
                    onChange={e => setSelectedTarget(e.target.value)}
                    style={{
                      background: '#0f172a',
                      color: '#fff',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      fontSize: '12px',
                    }}
                  >
                    <option value="">选目标</option>
                    {players.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.seat}号 {p.nickname}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  disabled={selfBrawl.skill.actionType === 'target_player' && !selectedTarget}
                  onClick={() => onUseSkill?.(selfBrawl.skill.skillId, selectedTarget || undefined)}
                  style={{
                    background: '#f59e0b',
                    color: '#000',
                    fontWeight: 'bold',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  发动法宝
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* 3. 天机战报收折抽屉（公法不公人） */}
      {events.length > 0 && (
        <div style={{ marginTop: '6px' }}>
          <button
            type="button"
            onClick={() => setShowEvents(!showEvents)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '2px 4px',
            }}
          >
            📜 天机战报记录 ({events.length}条) {showEvents ? '▲' : '▼'}
          </button>
          {showEvents && (
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 12px',
                marginTop: '4px',
                maxHeight: '160px',
                overflowY: 'auto',
              }}
            >
              {events.map(ev => {
                const roleDef = BRAWL_ROLE_REGISTRY[ev.roleId];
                const detail = ev.description || roleDef?.skill.description;
                const hasDetailedSummary = ev.summary.includes('效用：') || ev.summary.includes('：');
                return (
                  <div
                    key={ev.id}
                    style={{
                      fontSize: '12px',
                      color: '#cbd5e1',
                      marginBottom: '6px',
                      lineHeight: 1.5,
                      borderBottom: '1px dashed rgba(148, 163, 184, 0.2)',
                      paddingBottom: '4px',
                    }}
                  >
                    <div>
                      <span style={{ color: '#f59e0b', fontWeight: 700 }}>
                        [{ev.roleName} · {ev.skillName}]
                      </span>{' '}
                      {ev.summary}
                    </div>
                    {!hasDetailedSummary && detail && (
                      <div style={{ fontSize: '11px', color: '#93c5fd', marginTop: '2px' }}>
                        ✦ 威能效用：{detail}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
