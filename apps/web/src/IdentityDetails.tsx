import { useState } from 'react';
import type { Command, GameView, Player } from '@avalon/contracts';
import { assetUrl } from './deployment';
import { PlayerToken } from './PlayerToken';
import { RoleViewerModal } from './RoleViewerModal';
import { BRAWL_PHASE_NAMES, getBrawlTacticalTip } from './brawl-roles';

export function IdentityDetails({
  self,
  players,
  game,
  disabled = false,
  send,
  userId,
  onUseBrawlSkill,
}: {
  self: NonNullable<GameView['self']>;
  players: Player[];
  game?: GameView;
  disabled?: boolean;
  send?: (action: Pick<Command, 'type' | 'payload'>) => void;
  treasuresEnabled?: boolean;
  userId?: string;
  onUseBrawlSkill?: (skillId: string, targetId?: string) => void;
}) {
  const [viewingBrawlArt, setViewingBrawlArt] = useState(false);
  const [brawlTarget, setBrawlTarget] = useState<string>('');
  const [wagerTarget, setWagerTarget] = useState<string>('');
  const selfBrawl = game?.selfBrawl;

  const handleUseSkill = (skillId: string, targetId?: string) => {
    if (onUseBrawlSkill) {
      onUseBrawlSkill(skillId, targetId);
    } else {
      send?.({ type: 'brawlCommand', payload: { action: 'useSkill', skillId, targetPlayerId: targetId } });
    }
  };

  const brawlGalleryItem = selfBrawl && selfBrawl.artPrefix ? {
    id: selfBrawl.roleId,
    role: self.role,
    name: selfBrawl.roleName,
    fullName: `【${selfBrawl.roleName}】· ${selfBrawl.roleTitle}`,
    title: selfBrawl.roleTitle,
    motto: selfBrawl.skill.description,
    story: `【${selfBrawl.skill.skillName}】${selfBrawl.skill.description}`,
    team: (selfBrawl.camp === 'red' ? 'red' : 'blue') as 'red' | 'blue',
    artPrefix: selfBrawl.artPrefix,
  } : null;

  const candidates = self.merlinCandidates.length ? self.merlinCandidates : self.evilIds;
  const isBrawlNiuMowang = Boolean(selfBrawl?.roleId === 'niu_mowang');
  const title = self.merlinCandidates.length
    ? '两位大圣 · 真假待辨'
    : self.role === 'merlin'
      ? '你火眼金睛识破的群妖'
      : isBrawlNiuMowang
        ? '平天独霸 · 孤狼独战'
        : self.evilIds.length
          ? '与你相认的同伙群妖'
          : '取经漫漫 · 静观其变';

  const description = self.merlinCandidates.length
    ? '一位是真大圣孙悟空，一位是假大圣六耳猕猴，无法分辨对应身份。'
    : isBrawlNiuMowang
      ? '你威震平天独霸一方，属于红方妖魔，但孤身独战——看不见其他妖魔同党，其他妖魔也看不见你（孙悟空能看见你的妖气）。表决时拥有平天大力（计 2 票），请凭战局推断暗助群妖！'
      : self.role === 'merlin'
        ? (players.length >= 9
            ? '本局必含小雷音寺黄眉老怪，其佛相金身匿形，不在你的火眼金睛妖气中；所见成员仅知阵营，不知角色。'
            : '本局潜伏群妖在你的火眼金睛中显出妖气（若抽中黄眉老怪，其假佛金身不在其中）；仅知阵营，不知角色。')
        : self.evilIds.length
          ? '以上是与你相认的群妖同伙（若抽中牛魔王，其孤身独霸不在相认之列）；仅知阵营，不知角色。'
          : '没有其他初始身份线索，请从发言与取经战况中判断。';

  const skillControl = selfBrawl?.skillControl ?? (
    selfBrawl?.skillAvailable && !selfBrawl?.skillUsed && selfBrawl.skill.actionType !== 'passive'
      ? { visible: true, canCast: true, requiresTarget: selfBrawl.skill.actionType === 'target_player' }
      : undefined
  );

  return (
    <>
      {selfBrawl && (
        <section
          className="brawl-identity-banner"
          style={{
            background: selfBrawl.camp === 'blue'
              ? 'linear-gradient(135deg, #ffffff 0%, #f6faff 50%, #eaf4ff 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #fff5f5 50%, #fee2e2 100%)',
            border: `1.5px solid ${selfBrawl.camp === 'blue' ? '#38bdf8' : '#f43f5e'}`,
            borderRadius: '12px',
            padding: '8px 10px',
            marginBottom: '8px',
            boxShadow: selfBrawl.camp === 'blue'
              ? '0 4px 12px rgba(14, 165, 233, 0.15), inset 0 1px 0 #ffffff'
              : '0 4px 12px rgba(244, 63, 94, 0.15), inset 0 1px 0 #ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* 上部：真身法相头像与基础描述 */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
            {selfBrawl.artPrefix && (
              <button
                type="button"
                className="brawl-identity-avatar-btn"
                onClick={() => setViewingBrawlArt(true)}
                title="点击放大查看专属法相"
                style={{
                  width: '52px',
                  minWidth: '52px',
                  maxWidth: '52px',
                  height: '52px',
                  flex: '0 0 52px',
                  flexShrink: 0,
                  padding: 0,
                  margin: 0,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  position: 'relative',
                  display: 'block',
                }}
              >
                <img
                  src={assetUrl(`/art/roles/${selfBrawl.artPrefix}-160.webp?v=brawl-art-v3`)}
                  alt={selfBrawl.roleName}
                  width={52}
                  height={52}
                  style={{
                    display: 'block',
                    width: '52px',
                    height: '52px',
                    borderRadius: '10px',
                    objectFit: 'cover',
                    border: `2px solid ${selfBrawl.camp === 'blue' ? '#d4af37' : '#f43f5e'}`,
                  }}
                />
                <span style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  fontSize: '9px',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fef08a',
                  padding: '1px 3px',
                  borderRadius: '3px',
                  lineHeight: 1,
                }}>
                  🔍
                </span>
              </button>
            )}
            <div style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', marginBottom: '2px' }}>
                <span style={{
                  fontWeight: 800,
                  fontSize: '14.5px',
                  color: selfBrawl.camp === 'blue' ? '#0369a1' : '#991b1b',
                }}>
                  【{selfBrawl.roleName}】· {selfBrawl.roleTitle}
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1.5px 7px',
                  borderRadius: '999px',
                  background: selfBrawl.camp === 'blue' ? 'linear-gradient(180deg, #0ea5e9 0%, #0369a1 100%)' : 'linear-gradient(180deg, #f43f5e 0%, #be123c 100%)',
                  color: '#ffffff',
                  border: `1px solid ${selfBrawl.camp === 'blue' ? '#7dd3fc' : '#fecdd3'}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                  flexShrink: 0,
                }}>
                  {selfBrawl.camp === 'blue' ? '仙佛阵营' : '妖魔阵营'}
                </span>
                {Boolean(selfBrawl.wishRank) && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1.5px 7px',
                    borderRadius: '999px',
                    background: 'linear-gradient(180deg, #f59e0b 0%, #b45309 100%)',
                    color: '#fffbeb',
                    border: '1px solid #fde68a',
                    flexShrink: 0,
                  }}>
                    ✨ 命中第 {selfBrawl.wishRank} 心愿
                  </span>
                )}
              </div>
              {selfBrawl.motto && (
                <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  「{selfBrawl.motto}」
                </div>
              )}
            </div>
          </div>

          {/* 中部：本命法宝与效果描述 */}
          <div style={{
            fontSize: '11.5px',
            color: '#241208',
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(212, 175, 55, 0.5)',
            borderRadius: '8px',
            padding: '6px 9px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            lineHeight: 1.4,
            width: '100%',
            boxSizing: 'border-box',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ color: '#92400e', fontWeight: 800, fontSize: '12px' }}>
                📿 {selfBrawl.bonusRoleName ? `附带随机仙宝（${selfBrawl.bonusRoleName}）` : '本命绝技'} · {selfBrawl.skill.skillName}
              </span>
              <span style={{ fontSize: '10px', color: '#78350f', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '1px 5px', borderRadius: '4px' }}>
                {selfBrawl.skill.actionType === 'passive' ? '常驻被动' : '整局限用 1 次'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#0369a1' }}>
              <strong>⏳ 发动时机：</strong>
              <span>{BRAWL_PHASE_NAMES[selfBrawl.skill.triggerPhase] || selfBrawl.skill.triggerPhase}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#334155' }}>
              <strong style={{ color: '#92400e' }}>✨ 法宝效果：</strong>
              <span>{selfBrawl.skill.description}</span>
            </div>
          </div>

          {/* 私密天机与状态反馈通知 */}
          {selfBrawl.peekedRoles && selfBrawl.peekedRoles.length > 0 && (
            <div style={{ fontSize: '11px', color: '#78350f', background: 'rgba(245, 158, 11, 0.12)', border: '1px dashed #d4af37', borderRadius: '6px', padding: '4px 8px' }}>
              🔍 <strong>盲盒天机：</strong>侦察到本局潜伏敌手包含【{selfBrawl.peekedRoles.map(r => r.roleName).join('、')}】
            </div>
          )}
          {selfBrawl.zhaoyaoResult !== undefined && (
            <div style={{
              fontSize: '11.5px',
              fontWeight: 'bold',
              color: selfBrawl.zhaoyaoResult ? '#991b1b' : '#065f46',
              background: selfBrawl.zhaoyaoResult ? '#fef2f2' : '#ecfdf5',
              border: `1px solid ${selfBrawl.zhaoyaoResult ? '#ef4444' : '#10b981'}`,
              borderRadius: '6px',
              padding: '5px 8px',
            }}>
              {selfBrawl.zhaoyaoDetail || (selfBrawl.zhaoyaoResult
                ? '🪞 照妖镜探照天机：当前车队中【有妖魔潜伏！】'
                : '🪞 照妖镜探照天机：当前车队中【无妖魔，皆是正道仙友！】')}
            </div>
          )}
          {selfBrawl.dapengExcludedPlayerId && (() => {
            const excluded = players.find(p => p.id === selfBrawl.dapengExcludedPlayerId);
            return excluded ? (
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#92400e' }}>
                🦅 云程万里俯瞰天机：已暗中排除【${excluded.seat}号 · ${excluded.nickname}】（此人绝非孙悟空）！
              </div>
            ) : null;
          })()}
          {selfBrawl.shituoExcludedPlayerId && (() => {
            const excluded = players.find(p => p.id === selfBrawl.shituoExcludedPlayerId);
            return excluded ? (
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#991b1b' }}>
                🦁 狮驼死战妖魔重赏：已额外排除【${excluded.seat}号 · ${excluded.nickname}】（此人绝非孙悟空）！
              </div>
            ) : null;
          })()}
          {selfBrawl.wagerInspectResult && (
            <div style={{
              fontSize: '11.5px',
              fontWeight: 700,
              color: selfBrawl.wagerInspectResult.team === 'blue' ? '#065f46' : '#991b1b',
              background: selfBrawl.wagerInspectResult.team === 'blue' ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${selfBrawl.wagerInspectResult.team === 'blue' ? '#10b981' : '#ef4444'}`,
              borderRadius: '6px',
              padding: '5px 8px',
            }}>
              📜 军令状天眼查验结果：【{selfBrawl.wagerInspectResult.targetSeat}号 · {selfBrawl.wagerInspectResult.targetNickname}】显现为【{selfBrawl.wagerInspectResult.team === 'blue' ? '仙佛清光（蓝方）' : '妖魔邪气（红方）'}】！
            </div>
          )}
          {selfBrawl.putiDianhuaNotice && (
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6d28d9', whiteSpace: 'pre-line' }}>
              {selfBrawl.putiDianhuaNotice}
            </div>
          )}
          {selfBrawl.guanyinGanluResult ? (
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: selfBrawl.guanyinGanluResult.success ? '#065f46' : '#991b1b' }}>
              🪷 净瓶甘露探照天机：目标【{selfBrawl.guanyinGanluResult.targetSeat}号 · {selfBrawl.guanyinGanluResult.targetNickname}】在方才出征任务中投出了【{selfBrawl.guanyinGanluResult.success ? '成功牌 🟢' : '失败牌 🔴'}】！
            </div>
          ) : selfBrawl.guanyinNotice ? (
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0369a1' }}>
              {selfBrawl.guanyinNotice}
            </div>
          ) : null}
          {selfBrawl.huangfengSecret && (
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#92400e' }}>
              🌪️ {selfBrawl.huangfengSecret}
            </div>
          )}
          {selfBrawl.tieshanSecret && (
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#065f46' }}>
              {selfBrawl.tieshanSecret}
            </div>
          )}
          {selfBrawl.huangmeiNotice && (
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#92400e' }}>
              {selfBrawl.huangmeiNotice}
            </div>
          )}
          {selfBrawl.baiguLijianStatus && (
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#991b1b' }}>
              {selfBrawl.baiguLijianStatus}
            </div>
          )}
          {selfBrawl.baiyanDuchaStatus && (
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#92400e' }}>
              {selfBrawl.baiyanDuchaStatus}
            </div>
          )}
          {selfBrawl.jinjiaoNotice && (
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#78350f' }}>
              {selfBrawl.jinjiaoNotice}
            </div>
          )}
          {selfBrawl.yutuNotice && (
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#be185d' }}>
              {selfBrawl.yutuNotice}
            </div>
          )}
          {selfBrawl.generalFeedback && !(selfBrawl.zhaoyaoResult !== undefined && selfBrawl.zhaoyaoDetail) && (
            <div style={{
              fontSize: '11.5px',
              fontWeight: 'bold',
              color: '#0369a1',
              background: '#f0f9ff',
              border: '1px solid #7dd3fc',
              borderRadius: '6px',
              padding: '5px 8px',
            }}>
              {selfBrawl.generalFeedback}
            </div>
          )}

          {/* 法相大图赏析按钮 */}
          <button
            type="button"
            onClick={() => setViewingBrawlArt(true)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'linear-gradient(180deg, #ffffff 0%, #fdf8ee 100%)',
              border: '1.2px solid #d4af37',
              borderRadius: '8px',
              color: '#78350f',
              fontSize: '11.5px',
              fontWeight: 700,
              padding: '6px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(212, 175, 55, 0.2)',
            }}
            title="点击赏析高清专属神魔法相与生平典故"
          >
            🔍 点击赏析专属法相大图
          </button>

          {/* 军令状成功兑现：私密天眼查验交互区 */}
          {selfBrawl.canWagerInspect && (
            <div style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '1.5px solid #d97706',
              borderRadius: '8px',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(217, 119, 6, 0.2)',
            }}>
              <span style={{ fontSize: '12px', color: '#831843', fontWeight: 800 }}>
                📜 军令状护经成功 · 天眼查验特权就绪
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <select
                  value={wagerTarget}
                  onChange={e => setWagerTarget(e.target.value)}
                  style={{
                    flex: '1 1 120px',
                    background: '#ffffff',
                    color: '#241208',
                    border: '1.5px solid #d4af37',
                    borderRadius: '6px',
                    padding: '4px 6px',
                    fontSize: '12px',
                  }}
                >
                  <option value="">选择要查验阵营的仙友</option>
                  {players.filter(p => p.id !== userId).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.seat}号 {p.nickname}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={disabled || !wagerTarget}
                  onClick={() => {
                    if (!wagerTarget) return;
                    send?.({ type: 'brawlCommand', payload: { action: 'wagerInspect', targetPlayerId: wagerTarget } });
                    setWagerTarget('');
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    margin: 0,
                  }}
                >
                  🔍 立即查验
                </button>
              </div>
            </div>
          )}

          {/* 技能发动交互区：服务端权威单真理源驱动 */}
          {skillControl && skillControl.visible && !selfBrawl.skillUsed && (
            <div style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #fef3c7 100%)',
              border: '1.5px solid #d4af37',
              borderRadius: '8px',
              padding: '7px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              marginTop: '2px',
              boxShadow: '0 2px 8px rgba(212, 175, 55, 0.25)',
              flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '12px', color: '#78350f', fontWeight: 800 }}>
                {skillControl.blockedReason || '✨ 绝技蓄势待发'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {skillControl.requiresTarget && skillControl.targetOptions && (
                  <select
                    value={brawlTarget}
                    onChange={e => setBrawlTarget(e.target.value)}
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
                    {skillControl.targetOptions.map(opt => (
                      <option key={opt.playerId} value={opt.playerId} disabled={opt.disabled}>
                        {opt.seat}号 {opt.nickname} {opt.tag ? `(${opt.tag})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  disabled={disabled || !skillControl.canCast || (skillControl.requiresTarget && !brawlTarget)}
                  onClick={() => handleUseSkill(selfBrawl.skill.skillId, brawlTarget || undefined)}
                  style={{
                    background: 'linear-gradient(135deg, #d97706 0%, #b45309 50%, #78350f 100%)',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    cursor: (disabled || !skillControl.canCast || (skillControl.requiresTarget && !brawlTarget)) ? 'not-allowed' : 'pointer',
                    opacity: (disabled || !skillControl.canCast || (skillControl.requiresTarget && !brawlTarget)) ? 0.6 : 1,
                    margin: 0,
                    boxShadow: '0 2px 6px rgba(180, 83, 9, 0.35)',
                  }}
                >
                  发动绝技
                </button>
              </div>
            </div>
          )}

          {/* 技能已消耗状态提示 */}
          {selfBrawl.skillUsed && (
            <div style={{
              fontSize: '11px',
              color: '#64748b',
              background: 'rgba(255, 255, 255, 0.85)',
              border: '1px solid #cbd5e1',
              padding: '4px 8px',
              borderRadius: '6px',
              textAlign: 'right',
            }}>
              ✦ 本命绝技已施展（已消耗）
            </div>
          )}
        </section>
      )}

      <section className="identity-knowledge" aria-label="你的身份视野">
        <h3>{title}</h3>
        {selfBrawl?.phantomVisionActive && (
          <p style={{
            margin: '4px 0 6px',
            padding: '6px 8px',
            borderRadius: '8px',
            background: '#fffbeb',
            border: '1px solid #d97706',
            color: '#92400e',
            fontSize: '11.5px',
            fontWeight: 700,
          }}>
            ⚠️【画皮惑眼生效】妖气混杂！你眼中混入了 1 位无辜仙友冒充红气，请结合场上局势自行甄别！
          </p>
        )}
        {!!candidates.length && (
          <div className="identity-vision" data-count={candidates.length}>
            {candidates.map(id => {
              const player = players.find(p => p.id === id);
              return player ? <PlayerToken key={id} player={player} /> : null;
            })}
          </div>
        )}
        <p>{description}</p>
      </section>

      {/* 玩法心法：大乱斗模式展示神魔专属心法与座右铭 */}
      {selfBrawl && (
        <div className="identity-tip-capsule" title="本角色的神魔破局心法">
          <span className="tip-capsule-badge">💡 神魔心法</span>
          <p className="tip-capsule-text">
            {selfBrawl.motto ? `「${selfBrawl.motto}」—— ` : ''}
            {getBrawlTacticalTip(selfBrawl.roleId) || (selfBrawl.camp === 'blue'
              ? '凝聚仙佛神力，明辨真假猴王，严防妖魔作祟，护持灵山大道。'
              : '潜伏同流隐匿妖气，伺机制造失败，混淆视听以夺天机。')}
          </p>
        </div>
      )}

      {viewingBrawlArt && brawlGalleryItem && (
        <RoleViewerModal
          item={brawlGalleryItem}
          onClose={() => setViewingBrawlArt(false)}
        />
      )}
    </>
  );
}
