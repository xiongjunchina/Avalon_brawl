import { useState } from 'react';
import type { Command, GameView, Player } from '@avalon/contracts';
import { ROLE_CONFIG } from '@avalon/game-core';
import { assetUrl } from './deployment';
import { IdentityCard } from './RolePortrait';
import { PlayerToken } from './PlayerToken';
import { getRoleGalleryItem } from './roles';
import { RoleViewerModal } from './RoleViewerModal';
import { TreasureModal } from './TreasureModal';
import { GUARDIAN_TREASURE_DISABLED_REASON, treasureAccess } from './treasure-access';
import { roleDescriptions } from './GuidePanel';

/** Only the server-projected, private self view is accepted. Never infer other roles. */
export function IdentityDetails({
  self,
  players,
  game,
  disabled = false,
  send,
  treasuresEnabled = false,
  userId,
  onChooseBrawlCamp,
  onUseBrawlSkill,
}: {
  self: NonNullable<GameView['self']>;
  players: Player[];
  game?: GameView;
  disabled?: boolean;
  send?: (action: Pick<Command, 'type' | 'payload'>) => void;
  treasuresEnabled?: boolean;
  userId?: string;
  onChooseBrawlCamp?: (camp: 'blue' | 'red') => void;
  onUseBrawlSkill?: (skillId: string, targetId?: string) => void;
}) {
  const [viewingArt, setViewingArt] = useState(false);
  const [viewingBrawlArt, setViewingBrawlArt] = useState(false);
  const [treasureOpen, setTreasureOpen] = useState(false);
  const [brawlTarget, setBrawlTarget] = useState<string>('');
  const selfBrawl = game?.selfBrawl;

  const handleChooseCamp = (camp: 'blue' | 'red') => {
    if (onChooseBrawlCamp) {
      onChooseBrawlCamp(camp);
    } else {
      send?.({ type: 'brawlCommand', payload: { action: 'chooseCamp', camp } });
    }
  };

  const handleUseSkill = (skillId: string, targetId?: string) => {
    if (onUseBrawlSkill) {
      onUseBrawlSkill(skillId, targetId);
    } else {
      send?.({ type: 'brawlCommand', payload: { action: 'useSkill', skillId, targetPlayerId: targetId } });
    }
  };
  const galleryItem = getRoleGalleryItem(self.role, self.loyalGuardian, self.femaleDemon);
  const brawlGalleryItem = game?.selfBrawl && game.selfBrawl.artPrefix ? {
    id: game.selfBrawl.roleId,
    role: self.role,
    name: game.selfBrawl.roleName,
    fullName: `【${game.selfBrawl.roleName}】· ${game.selfBrawl.roleTitle}`,
    title: game.selfBrawl.roleTitle,
    motto: game.selfBrawl.skill.description,
    story: `【${game.selfBrawl.skill.skillName}】${game.selfBrawl.skill.description}`,
    team: (game.selfBrawl.camp === 'red' ? 'red' : 'blue') as 'red' | 'blue',
    artPrefix: game.selfBrawl.artPrefix,
  } : null;

  const candidates = self.merlinCandidates.length ? self.merlinCandidates
    : self.guinevereCandidates?.length ? self.guinevereCandidates
    : self.guardianClue?.targetIds?.length ? self.guardianClue.targetIds
    : self.evilIds;
  const title = self.merlinCandidates.length ? '两位大圣 · 真假待辨'
    : self.guinevereCandidates?.length ? '两道天机 · 尚待查证'
    : self.guardianClue ? self.guardianClue.title
    : self.role === 'merlin' ? '你火眼金睛识破的群妖' : self.evilIds.length ? '与你相认的同伙群妖' : '取经漫漫 · 静观其变';
  const description = self.merlinCandidates.length ? '一位是真大圣孙悟空，一位是假大圣六耳猕猴，无法分辨对应身份。'
    : self.guinevereCandidates?.length ? '一位是假扮佛祖的黄眉老怪，一位是取经正果同伴，无法分辨对应身份。'
    : self.guardianClue ? self.guardianClue.description
    : self.role === 'merlin' ? (ROLE_CONFIG[players.length]?.includes('mordred') ? '本局含黄眉老怪（假扮如来设小雷音寺），他不在你的火眼金睛视野中；所见成员仅知阵营，不知角色。' : '以上是本局全部群妖成员，仅知阵营，不知具体角色。')
    : self.evilIds.length ? (ROLE_CONFIG[players.length]?.includes('oberon') ? '本局牛魔王独霸一方不参与相认；同伙仅知阵营，不知角色。' : '以上是与你相认的群妖同伙，仅知阵营，不知具体角色。')
    : '没有其他初始身份线索，请从发言与取经战况中判断。';

  const is8Plus = players.length >= 8;
  const isTreasureModeActive = Boolean(treasuresEnabled && is8Plus && self.treasures?.enabled);
  const access = treasureAccess({ self, players }, treasuresEnabled);
  const canClickTreasure = access.canOpen;

  let treasureSub = '';
  if (self.treasures?.disabledReason === 'guardian_perks') {
    treasureSub = GUARDIAN_TREASURE_DISABLED_REASON;
  } else if (!isTreasureModeActive) {
    if (self.role === 'assassin') {
      if (game?.phase === 'assassination') {
        treasureSub = '🔥 终局刺杀 · 点击祭出火尖枪！';
      } else if (self.canDecideEarly) {
        treasureSub = '🗡️ 提前刺杀窗口已解锁';
      } else {
        treasureSub = '火尖枪（刺客专属神兵）';
      }
    } else {
      treasureSub = '未开启法宝模式（仅刺客可用神兵）';
    }
  } else {
    if (self.role === 'percival') {
      treasureSub = self.treasures?.tinStaff?.used
        ? '九环锡杖（已显灵）'
        : self.treasures?.tinStaff?.available
          ? '✨ 可私密查验盲区仙友！'
          : '九环锡杖（第2轮任务后解锁）';
    } else if (self.role === 'guinevere') {
      treasureSub = self.treasures?.guanyinMirror?.used
        ? '慈航照妖镜（已照耀）'
        : self.treasures?.guanyinMirror?.available
          ? '✨ 正在审视车队（5秒专属期）！'
          : '慈航照妖镜（发车表决后开启）';
    } else if (self.role === 'mordred') {
      treasureSub = self.treasures?.humanBag?.used
        ? '后天人种袋（已收人）'
        : self.treasures?.humanBag?.available
          ? '✨ 可禁选1人上车！'
          : '后天人种袋（第3/4轮提名前解锁）';
    } else if (self.role === 'loyal') {
      treasureSub = self.treasures?.jinguSeal?.used
        ? '紧箍信物（已通灵）'
        : self.treasures?.jinguSeal?.available
          ? '✨ 绝境信物已激活！'
          : '紧箍信物（好人绝境时激活）';
    } else if (self.role === 'oberon') {
      treasureSub = self.treasures?.bananaFan?.used
        ? '芭蕉神扇（已吹散）'
        : self.treasures?.bananaFan?.armed
          ? '🌪️ 聚风待发（通过则吹散）'
          : '芭蕉神扇（点击预设吹散）';
    } else if (self.role === 'assassin') {
      treasureSub = game?.phase === 'assassination'
        ? '🔥 终局刺杀 · 祭出火尖枪！'
        : '火尖枪（刺客专属神兵）';
    } else if (self.role === 'merlin') {
      treasureSub = '齐天大圣 · 无为而治（大隐潜行）';
    } else if (self.role === 'morgana') {
      treasureSub = '假美猴王 · 随心机变';
    } else {
      treasureSub = self.treasures?.heartBell?.used ? '同心铃（已传音）' : self.treasures?.heartBell?.available ? '同心铃（可向同车同伙传音）' : '同心铃（等待传音时机）';
    }
  }
  if (isTreasureModeActive && self.treasures?.incomingHeartBell) treasureSub = '同心铃私密传音 · 点击回看';

  return (
    <>
      {selfBrawl && (
        <section
          className="brawl-identity-banner"
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: `1.5px solid ${selfBrawl.camp === 'blue' ? '#3b82f6' : selfBrawl.camp === 'red' ? '#ef4444' : '#f59e0b'}`,
            borderRadius: '12px',
            padding: '10px 12px',
            marginBottom: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* 上部：真身法相头像与基础描述 */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%' }}>
            {selfBrawl.artPrefix && (
              <button
                type="button"
                className="brawl-identity-avatar-btn"
                onClick={() => setViewingBrawlArt(true)}
                title="点击放大查看专属法相"
                style={{
                  width: '56px',
                  minWidth: '56px',
                  maxWidth: '56px',
                  height: '56px',
                  flex: '0 0 56px',
                  flexShrink: 0,
                  padding: 0,
                  margin: 0,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                  position: 'relative',
                  display: 'block',
                }}
              >
                <img
                  src={assetUrl(`/art/roles/${selfBrawl.artPrefix}-160.webp?v=brawl-art-v2`)}
                  alt={selfBrawl.roleName}
                  width={56}
                  height={56}
                  style={{
                    display: 'block',
                    width: '56px',
                    height: '56px',
                    borderRadius: '8px',
                    objectFit: 'cover',
                    border: `2px solid ${selfBrawl.camp === 'blue' ? '#60a5fa' : selfBrawl.camp === 'red' ? '#f87171' : '#fbbf24'}`,
                  }}
                />
                <span style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  fontSize: '9px',
                  background: 'rgba(0,0,0,0.7)',
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                <span style={{
                  fontWeight: 700,
                  fontSize: '15px',
                  color: selfBrawl.camp === 'blue' ? '#60a5fa' : selfBrawl.camp === 'red' ? '#f87171' : '#fbbf24',
                }}>
                  【{selfBrawl.roleName}】· {selfBrawl.roleTitle}
                </span>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: selfBrawl.camp === 'blue' ? 'rgba(59, 130, 246, 0.2)' : selfBrawl.camp === 'red' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: selfBrawl.camp === 'blue' ? '#93c5fd' : selfBrawl.camp === 'red' ? '#fca5a5' : '#fde68a',
                  flexShrink: 0,
                }}>
                  {selfBrawl.camp === 'blue' ? '仙佛阵营' : selfBrawl.camp === 'red' ? '妖魔阵营' : '初始中立'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#e2e8f0', marginTop: '2px', lineHeight: 1.45 }}>
                <strong style={{ color: '#fbbf24' }}>绝技 · {selfBrawl.skill.skillName}：</strong>
                <span style={{ color: '#cbd5e1' }}>{selfBrawl.skill.description}</span>
              </div>
              {selfBrawl.peekedRoles && selfBrawl.peekedRoles.length > 0 && (
                <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '4px', borderTop: '1px dashed rgba(245, 158, 11, 0.3)', paddingTop: '3px' }}>
                  🔍 <strong>盲盒天机：</strong>侦察到本局潜伏敌手包含【{selfBrawl.peekedRoles.map(r => r.roleName).join('、')}】
                </div>
              )}
              <div style={{ marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setViewingBrawlArt(true)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 216, 117, 0.3)',
                    borderRadius: '12px',
                    color: '#ffd875',
                    fontSize: '11px',
                    padding: '2px 8px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="点击赏析高清专属神魔法相与生平典故"
                >
                  🔍 点击赏析专属法相大图
                </button>
              </div>
            </div>
          </div>

          {/* 黑熊精非阻塞异步天命抉择（纯私下决定，全场不通报） */}
          {selfBrawl.roleId === 'heixiong_jing' && selfBrawl.neutralDecisionPending && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1.5px solid #f59e0b',
              borderRadius: '8px',
              padding: '8px 10px',
              marginTop: '2px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 700 }}>
                  🐻 天命抉择（全场暗中行事，绝不通报）
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>第2轮表决前随时可决</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleChooseCamp('blue')}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    margin: 0,
                  }}
                >
                  🌟 皈依佛门 (蓝方)
                </button>
                <button
                  type="button"
                  onClick={() => handleChooseCamp('red')}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    margin: 0,
                  }}
                >
                  🔥 啸聚为妖 (红方)
                </button>
              </div>
            </div>
          )}

          {/* 技能发动交互区 */}
          {selfBrawl.skillAvailable && !selfBrawl.skillUsed && selfBrawl.skill.actionType !== 'passive' && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              borderRadius: '8px',
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              marginTop: '2px',
            }}>
              <span style={{ fontSize: '12px', color: '#fde68a', fontWeight: 700 }}>
                ✨ 绝技蓄势待发
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {selfBrawl.skill.actionType === 'target_player' && (
                  <select
                    value={brawlTarget}
                    onChange={e => setBrawlTarget(e.target.value)}
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
                  disabled={disabled || (selfBrawl.skill.actionType === 'target_player' && !brawlTarget)}
                  onClick={() => handleUseSkill(selfBrawl.skill.skillId, brawlTarget || undefined)}
                  style={{
                    background: '#f59e0b',
                    color: '#000',
                    fontWeight: 'bold',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    margin: 0,
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
              color: '#94a3b8',
              background: 'rgba(15, 23, 42, 0.5)',
              padding: '4px 8px',
              borderRadius: '6px',
              textAlign: 'right',
            }}>
              ✦ 本命绝技已施展（已消耗）
            </div>
          )}
        </section>
      )}

      {/* 经典模式下渲染经典原版身份卡；大乱斗模式下上面唯一神魔卡即是玩家真身，绝不显示双角色 */}
      {!selfBrawl && (
        <IdentityCard
          role={self.role}
          loyalGuardian={self.loyalGuardian}
          femaleDemon={self.femaleDemon}
          onInspect={() => setViewingArt(true)}
        />
      )}

      <section className="identity-knowledge" aria-label="你的身份视野">
        <h3>{title}</h3>
        {!!candidates.length && <div className="identity-vision" data-count={candidates.length}>{candidates.map(id => {
          const player = players.find(p => p.id === id);
          return player ? <PlayerToken key={id} player={player} /> : null;
        })}</div>}
        <p>{description}</p>
      </section>

      {/* 玩法心法：大乱斗模式展示神魔专属心法与座右铭；经典模式展示原版心法 */}
      {selfBrawl ? (
        <div className="identity-tip-capsule" title="本角色的神魔破局心法">
          <span className="tip-capsule-badge">💡 神魔心法</span>
          <p className="tip-capsule-text">
            {selfBrawl.motto ? `「${selfBrawl.motto}」—— ` : ''}
            {selfBrawl.camp === 'blue'
              ? '凝聚仙佛神力，明辨真假猴王，严防妖魔作祟，护持灵山大道。'
              : selfBrawl.camp === 'red'
                ? '潜伏同流隐匿妖气，伺机制造失败，混淆视听以夺天机。'
                : '首轮必投成功以明哲保身，静观众仙妖胜负走向，随时私下暗择归宿。'}
          </p>
        </div>
      ) : roleDescriptions[self.role]?.tip ? (
        <div className="identity-tip-capsule" title="本角色的取经心法秘诀">
          <span className="tip-capsule-badge">💡 玩法心法</span>
          <p className="tip-capsule-text">{roleDescriptions[self.role].tip}</p>
        </div>
      ) : null}

      {/* 法宝栏：大乱斗模式下神魔绝技即为本命法宝（在上方法相底牌中完整发动）；经典法宝栏仅在非大乱斗模式时展示 */}
      {!selfBrawl && (
        <div className="identity-treasure-row">
          <button
            type="button"
            className={`identity-treasure-entry-btn ${canClickTreasure ? 'is-enabled' : 'is-locked'}`}
            disabled={!canClickTreasure}
            onClick={() => setTreasureOpen(true)}
            title={access.reason}
          >
            <span className="treasure-entry-icon">📿</span>
            <span className="treasure-entry-info">
              <strong>本命法宝 · 仙家神兵</strong>
              <small>{treasureSub}</small>
            </span>
            <span className="treasure-entry-chevron">{canClickTreasure ? '❯' : '🔒'}</span>
          </button>
        </div>
      )}

      {viewingArt && (
        <RoleViewerModal
          item={galleryItem}
          onClose={() => setViewingArt(false)}
        />
      )}

      {viewingBrawlArt && brawlGalleryItem && (
        <RoleViewerModal
          item={brawlGalleryItem}
          onClose={() => setViewingBrawlArt(false)}
        />
      )}

      <TreasureModal
        open={treasureOpen}
        onClose={() => setTreasureOpen(false)}
        self={self}
        players={players}
        game={game}
        userId={userId}
        disabled={disabled}
        send={send}
        treasuresEnabled={treasuresEnabled}
      />
    </>
  );
}
