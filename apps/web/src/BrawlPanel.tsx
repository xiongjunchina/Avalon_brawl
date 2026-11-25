import { useState } from 'react';
import type { SelfBrawlView, BrawlBattleEvent } from '@avalon/contracts';
import { BRAWL_ROLE_REGISTRY } from '@avalon/game-core';

interface BrawlPanelProps {
  selfBrawl?: SelfBrawlView;
  events?: BrawlBattleEvent[];
  onUseSkill?: (skillId: string, targetId?: string) => void;
  players?: { id: string; nickname: string; seat: number }[];
  userId?: string;
  privacyMode?: boolean;
  onOpenIdentity?: () => void;
  defaultShowEvents?: boolean;
}

export function BrawlPanel({
  selfBrawl,
  events = [],
  onUseSkill,
  players = [],
  userId,
  privacyMode = false,
  onOpenIdentity,
  defaultShowEvents = false,
}: BrawlPanelProps) {
  const [showEvents, setShowEvents] = useState(defaultShowEvents);
  const [selectedTarget, setSelectedTarget] = useState<string>('');

  if (!selfBrawl) return null;

  const isClickableSkill = selfBrawl.skill.actionType !== 'passive';
  const hasPendingAction = Boolean(
    (selfBrawl.skillAvailable && !selfBrawl.skillUsed && isClickableSkill) ||
    selfBrawl.canWagerInspect
  );

  const hasFeedbackNotice = Boolean(
    selfBrawl.wagerInspectResult ||
    selfBrawl.shituoExcludedPlayerId ||
    (selfBrawl.skillUsed && (
      selfBrawl.jinjiaoNotice ||
      selfBrawl.yutuNotice ||
      selfBrawl.baiyanDuchaStatus ||
      selfBrawl.guanyinGanluResult ||
      selfBrawl.baiguLijianStatus ||
      selfBrawl.tieshanSecret ||
      selfBrawl.huangmeiNotice ||
      selfBrawl.putiDianhuaNotice ||
      selfBrawl.zhaoyaoResult !== undefined ||
      selfBrawl.dapengExcludedPlayerId ||
      selfBrawl.generalFeedback
    ))
  );

  return (
    <div className="brawl-container" style={{ margin: privacyMode ? 0 : '6px 0' }}>
      {/* 隐私防偷看模式（用于对局大盘公屏）：隐藏敏感神魔底牌、阵营色与技能，仅提供不泄密的中性提示，在「真身」私密面板内操作 */}
      {privacyMode ? (
        hasPendingAction ? (
          <div
            className="brawl-privacy-notice-pill"
            onClick={onOpenIdentity}
            title="点击打开真身面板私密发动"
          >
            <span>
              {selfBrawl.canWagerInspect
                ? '📜 军令状兑现！点击「真身」行使天眼查验特权 ❯'
                : '✦ 你有神魔法宝待决，点击「真身」私下查看与发动 ❯'}
            </span>
          </div>
        ) : hasFeedbackNotice ? (
          <div
            className="brawl-privacy-notice-pill"
            onClick={onOpenIdentity}
            title="点击打开真身面板查看法宝私密反馈"
            style={{
              background: 'linear-gradient(135deg, #fefcf5 0%, #fef3c7 100%)',
              borderColor: '#d4af37',
              boxShadow: '0 2px 8px rgba(212, 175, 55, 0.25)',
            }}
          >
            <span style={{ color: '#831843', fontWeight: 700 }}>
              ✦ 法宝/天眼私密结果已出，点击「真身」私密查阅 ❯
            </span>
          </div>
        ) : null
      ) : (
        <>
          {/* 个人乱斗真身与弱技能胶囊卡 */}
          <div
            className="brawl-skill-card"
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #fefcf5 100%)',
              border: '1.5px solid rgba(212, 175, 55, 0.55)',
              borderRadius: '10px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#241208',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 'bold', color: selfBrawl.camp === 'blue' ? '#0369a1' : '#991b1b' }}>
                  【{selfBrawl.roleName}】
                </span>
                <span style={{ fontSize: '13px', color: '#78350f', fontWeight: 700 }}>
                  {selfBrawl.bonusRoleName ? `附带仙宝(${selfBrawl.bonusRoleName}) · ` : ''}{selfBrawl.skill.skillName}
                </span>
                {selfBrawl.skillUsed && (
                  <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px' }}>
                    已消耗
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                {selfBrawl.skill.description}
              </div>

              {/* 盲盒窥视情报（二郎神、百眼魔君、老鼠精） */}
              {selfBrawl.peekedRoles && selfBrawl.peekedRoles.length > 0 && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#38bdf8' }}>
                  🔍 盲盒天机：本局敌对潜伏底牌包含【{selfBrawl.peekedRoles.map(r => r.roleName).join('、')}】
                </div>
              )}

              {/* 托塔李天王专属：照妖宝镜探查结果 */}
              {selfBrawl.zhaoyaoResult !== undefined && (
                <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 'bold', color: selfBrawl.zhaoyaoResult ? '#f87171' : '#4ade80' }}>
                  {selfBrawl.zhaoyaoResult ? '🪞 照妖镜探照天机：当前车队中【有妖魔潜伏！】' : '🪞 照妖镜探照天机：当前车队中【无妖魔，皆是正道仙友！】'}
                </div>
              )}

              {/* 金翅大鹏雕/红孩儿专属：云程万里排除反馈（兼容 5~8 人局附带副法宝） */}
              {selfBrawl.dapengExcludedPlayerId && (() => {
                const excluded = players.find(p => p.id === selfBrawl.dapengExcludedPlayerId);
                return excluded ? (
                  <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 'bold', color: '#fb923c' }}>
                    🦅 云程万里俯瞰天机：已为红孩儿暗中排除【{excluded.seat}号 · {excluded.nickname}】（此人绝非孙悟空）！
                  </div>
                ) : null;
              })()}

              {/* 菩提祖师专属私密点化天机 */}
              {selfBrawl.putiDianhuaNotice && (
                <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 'bold', color: '#c084fc' }}>
                  {selfBrawl.putiDianhuaNotice}
                </div>
              )}

              {/* 观音菩萨专属：净瓶甘露探查结果与状态 */}
              {selfBrawl.guanyinGanluResult ? (
                <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 'bold', color: selfBrawl.guanyinGanluResult.success ? '#4ade80' : '#f87171' }}>
                  🪷 净瓶甘露探照天机：目标【{selfBrawl.guanyinGanluResult.targetSeat}号 · {selfBrawl.guanyinGanluResult.targetNickname}】在方才出征任务中投出了【{selfBrawl.guanyinGanluResult.success ? '成功牌 🟢' : '失败牌 🔴'}】！
                </div>
              ) : selfBrawl.guanyinNotice ? (
                <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 'bold', color: '#67e8f9' }}>
                  {selfBrawl.guanyinNotice}
                </div>
              ) : null}

              {/* 黄风怪专属：三昧神风窥探天机 */}
              {selfBrawl.huangfengSecret && (
                <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 'bold', color: '#fde047' }}>
                  🌪️ {selfBrawl.huangfengSecret}
                </div>
              )}

              {/* 铁扇公主专属：芭蕉神风窥破仙阶 */}
              {selfBrawl.tieshanSecret && (
                <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 'bold', color: '#34d399' }}>
                  {selfBrawl.tieshanSecret}
                </div>
              )}

              {/* 黄眉老怪专属：假设雷音假传佛旨状态 */}
              {selfBrawl.huangmeiNotice && (
                <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 'bold', color: '#fbbf24' }}>
                  {selfBrawl.huangmeiNotice}
                </div>
              )}

              {/* 白骨精专属：画皮离间虚增败数状态 */}
              {selfBrawl.baiguLijianStatus && (
                <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 'bold', color: '#f43f5e' }}>
                  {selfBrawl.baiguLijianStatus}
                </div>
              )}

              {/* 百眼魔君专属：黄花毒茶状态 */}
              {selfBrawl.baiyanDuchaStatus && (
                <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 'bold', color: '#f59e0b' }}>
                  {selfBrawl.baiyanDuchaStatus}
                </div>
              )}

              {/* 金角大王专属：紫金葫芦状态 */}
              {selfBrawl.jinjiaoNotice && (
                <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 'bold', color: '#eab308' }}>
                  {selfBrawl.jinjiaoNotice}
                </div>
              )}

              {/* 玉兔精专属：捣药迷魂状态 */}
              {selfBrawl.yutuNotice && (
                <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 'bold', color: '#ec4899' }}>
                  {selfBrawl.yutuNotice}
                </div>
              )}

              {/* 通用神魔法宝施法回执与生效确认 */}
              {selfBrawl.generalFeedback && (
                <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 'bold', color: '#38bdf8' }}>
                  {selfBrawl.generalFeedback}
                </div>
              )}
            </div>

            {/* 技能发动交互 */}
            {selfBrawl.skillAvailable && !selfBrawl.skillUsed && isClickableSkill && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {selfBrawl.skill.actionType === 'target_player' && (() => {
                  const effectiveRoleId = selfBrawl.bonusRoleId ?? selfBrawl.roleId;
                  const isQingshi = effectiveRoleId === 'qingmao_shizi';
                  const isZhizhu = effectiveRoleId === 'zhizhu_jing';
                  const isRulai = effectiveRoleId === 'rulai_fozu';
                  const isYinjiao = effectiveRoleId === 'yinjiao_dawang';

                  return (
                    <select
                      value={selectedTarget}
                      onChange={e => setSelectedTarget(e.target.value)}
                      style={{
                        background: '#ffffff',
                        color: '#241208',
                        border: '1.5px solid #d4af37',
                        borderRadius: '6px',
                        padding: '4px 6px',
                        fontSize: '12px',
                        maxWidth: '160px',
                      }}
                    >
                      <option value="">选目标</option>
                      {players.map(p => {
                        let label = `${p.seat}号 ${p.nickname}`;
                        let disabledOpt = false;
                        const isSelf = Boolean(userId && p.id === userId);
                        if ((isQingshi || isZhizhu || isRulai || isYinjiao) && isSelf) {
                          disabledOpt = true;
                          label += ' (自己)';
                        }
                        return (
                          <option key={p.id} value={p.id} disabled={disabledOpt}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  );
                })()}
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

      {/* 3. 天机战报收折抽屉（公法不公人，仅在非隐私模式且有战报时作为调试/回顾辅助展示） */}
      {!privacyMode && events.length > 0 && (
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
                background: 'linear-gradient(180deg, #fefcf5 0%, #fbf4e2 100%)',
                border: '1.5px solid rgba(212, 175, 55, 0.55)',
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
                      color: '#241208',
                      marginBottom: '6px',
                      lineHeight: 1.5,
                      borderBottom: '1px dashed rgba(212, 175, 55, 0.35)',
                      paddingBottom: '4px',
                    }}
                  >
                    <div>
                      <span style={{ color: '#92400e', fontWeight: 700 }}>
                        [{ev.roleName} · {ev.skillName}]
                      </span>{' '}
                      {ev.summary}
                    </div>
                    {!hasDetailedSummary && detail && (
                      <div style={{ fontSize: '11px', color: '#0369a1', marginTop: '2px' }}>
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
