import { useState } from 'react';
import type { SelfBrawlView, BrawlBattleEvent } from '@avalon/contracts';

interface BrawlPanelProps {
  selfBrawl?: SelfBrawlView;
  events?: BrawlBattleEvent[];
  onChooseCamp?: (camp: 'blue' | 'red') => void;
  onUseSkill?: (skillId: string, targetId?: string) => void;
  players?: { id: string; nickname: string; seat: number }[];
}

export function BrawlPanel({
  selfBrawl,
  events = [],
  onChooseCamp,
  onUseSkill,
  players = [],
}: BrawlPanelProps) {
  const [showEvents, setShowEvents] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string>('');

  if (!selfBrawl) return null;

  const isHeixiong = selfBrawl.roleId === 'heixiong_jing';
  const showNeutralChoice = isHeixiong && selfBrawl.neutralDecisionPending;

  return (
    <div className="brawl-container" style={{ margin: '8px 0' }}>
      {/* 1. 黑熊精非阻塞异步天命抉择卡片 */}
      {showNeutralChoice && (
        <div
          className="brawl-neutral-choice-banner"
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '2px solid #f59e0b',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#fff',
            marginBottom: '10px',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#fbbf24' }}>
              🐻 黑熊精 · 天命抉择（纯私下决定，全场不通报）
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>第2轮投票前随时可定</span>
          </div>
          <p style={{ fontSize: '13px', color: '#cbd5e1', margin: '0 0 10px 0' }}>
            观照三界胜负，选择你即将暗中支持的阵营。胜负与出牌权限将随之转变：
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => onChooseCamp?.('blue')}
              style={{
                flex: 1,
                background: 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              🌟 皈依佛门 · 守山大神 (蓝方)
            </button>
            <button
              type="button"
              onClick={() => onChooseCamp?.('red')}
              style={{
                flex: 1,
                background: 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              🔥 啸聚为妖 · 黑风大王 (红方)
            </button>
          </div>
        </div>
      )}

      {/* 2. 个人乱斗真身与弱技能胶囊卡 */}
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
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 12px',
                marginTop: '4px',
                maxHeight: '120px',
                overflowY: 'auto',
              }}
            >
              {events.map(ev => (
                <div key={ev.id} style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                  <span style={{ color: '#f59e0b' }}>[{ev.roleName} · {ev.skillName}]</span> {ev.summary}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
