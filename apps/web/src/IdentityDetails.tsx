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
import { BRAWL_PHASE_NAMES, BRAWL_TACTICAL_TIPS, getBrawlTacticalTip } from './brawl-roles';

/** Only the server-projected, private self view is accepted. Never infer other roles. */
export function IdentityDetails({
  self,
  players,
  game,
  disabled = false,
  send,
  treasuresEnabled = false,
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
  const [viewingArt, setViewingArt] = useState(false);
  const [viewingBrawlArt, setViewingBrawlArt] = useState(false);
  const [treasureOpen, setTreasureOpen] = useState(false);
  const [brawlTarget, setBrawlTarget] = useState<string>('');
  const [wagerTarget, setWagerTarget] = useState<string>('');
  const selfBrawl = game?.selfBrawl;
  const effectiveSkillRoleId = selfBrawl?.bonusRoleId ?? selfBrawl?.roleId;
  const isForcedLaunchTurn = Boolean(game?.brawl && (game.rejectionCount ?? 0) >= 2);
  const isVoteOnlyBrawlSkill = Boolean(
    selfBrawl && ['santou_liubi', 'pingtian_handi', 'yishan_yading', 'xiangyao_baozhang', 'daoda_yipa'].includes(selfBrawl.skill.skillId)
  );
  const currentMissionLiveTeam = game
    ? (['proposing', 'role_reveal'].includes(game.phase)
        ? (game.draftTeam?.playerIds ?? [])
        : (game.rounds?.at(-1)?.mission === game.mission ? (game.rounds?.at(-1)?.team ?? []) : []))
    : [];
  const isLiTianwangWaitingTeam = Boolean(
    selfBrawl?.skill.skillId === 'zhaoyao_baojing' && currentMissionLiveTeam.length === 0
  );
  const isPutiWaitingMission2 = Boolean(
    selfBrawl?.skill.skillId === 'daofa_dianhua' && (game?.mission ?? 1) < 2
  );
  const isClickableBrawlSkill = Boolean(
    selfBrawl && selfBrawl.skill.actionType !== 'passive'
  );

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
  const isBrawlNiuMowang = Boolean(game?.selfBrawl?.roleId === 'niu_mowang');
  const title = self.merlinCandidates.length ? '两位大圣 · 真假待辨'
    : self.guinevereCandidates?.length ? '两道天机 · 尚待查证'
    : self.guardianClue ? self.guardianClue.title
    : self.role === 'merlin' ? '你火眼金睛识破的群妖'
    : isBrawlNiuMowang ? '平天独霸 · 孤狼独战'
    : self.evilIds.length ? '与你相认的同伙群妖' : '取经漫漫 · 静观其变';
  const description = self.merlinCandidates.length ? '一位是真大圣孙悟空，一位是假大圣六耳猕猴，无法分辨对应身份。'
    : self.guinevereCandidates?.length ? '一位是假扮佛祖的黄眉老怪，一位是取经正果同伴，无法分辨对应身份。'
    : self.guardianClue ? self.guardianClue.description
    : isBrawlNiuMowang ? '你威震平天独霸一方，属于红方妖魔，但孤身独战——看不见其他妖魔同党，其他妖魔也看不见你（孙悟空能看见你的妖气）。表决时拥有平天大力（计 2 票），请凭战局推断暗助群妖！'
    : self.role === 'merlin' ? (Boolean(game?.brawl) ? (players.length >= 9 ? '本局必含小雷音寺黄眉老怪，其佛相金身匿形，不在你的火眼金睛妖气中；所见成员仅知阵营，不知角色。' : '本局潜伏群妖在你的火眼金睛中显出妖气（若抽中黄眉老怪，其假佛金身不在其中）；仅知阵营，不知角色。') : ROLE_CONFIG[players.length]?.includes('mordred') ? '本局含黄眉老怪（假扮如来设小雷音寺），他不在你的火眼金睛视野中；所见成员仅知阵营，不知角色。' : '以上是本局全部群妖成员，仅知阵营，不知具体角色。')
    : self.evilIds.length ? (Boolean(game?.brawl) ? '以上是与你相认的群妖同伙（若抽中牛魔王，其孤身独霸不在相认之列）；仅知阵营，不知角色。' : ROLE_CONFIG[players.length]?.includes('oberon') ? '本局牛魔王独霸一方不参与相认；同伙仅知阵营，不知角色。' : '以上是与你相认的群妖同伙，仅知阵营，不知具体角色。')
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
          {/* 上部：真身法相头像与基础描述（左右结构，头像在左，名字阵营在右） */}
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
                  src={assetUrl(`/art/roles/${selfBrawl.artPrefix}-160.webp?v=brawl-art-v2`)}
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

          {/* 中部：本命法宝与发动时机（整行 100% 满宽展示，充分利用横向空间，不留空白，控制纵向高度） */}
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

          {/* 私密天机与状态反馈通知（整行满宽） */}
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
                🦅 云程万里俯瞰天机：已暗中排除【{excluded.seat}号 · {excluded.nickname}】（此人绝非孙悟空）！
              </div>
            ) : null;
          })()}
          {selfBrawl.shituoExcludedPlayerId && (() => {
            const excluded = players.find(p => p.id === selfBrawl.shituoExcludedPlayerId);
            return excluded ? (
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#991b1b' }}>
                🦁 狮驼死战妖魔重赏：已额外排除【{excluded.seat}号 · {excluded.nickname}】（此人绝非孙悟空）！
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
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6d28d9' }}>
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

          {/* 法相大图赏析按钮（满宽居中，与下方绝技发动框完全对齐保持一致） */}
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

          {/* 技能发动交互区 */}
          {selfBrawl.skillAvailable && !selfBrawl.skillUsed && isClickableBrawlSkill && (
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
                {isForcedLaunchTurn && isVoteOnlyBrawlSkill
                  ? '🔥 强发轮跳过表决 · 表决技暂留'
                  : isLiTianwangWaitingTeam
                    ? '⏳ 待领队选好队员后再祭出照妖宝镜'
                    : isPutiWaitingMission2
                      ? '⏳ 第 2 难起解锁道法点化'
                      : '✨ 绝技蓄势待发'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {selfBrawl.skill.actionType === 'target_player' && (() => {
                  const currentTeam = currentMissionLiveTeam;
                  const captainId = game?.captainId;
                  const isQingshi = effectiveSkillRoleId === 'qingmao_shizi';
                  const isZhizhu = effectiveSkillRoleId === 'zhizhu_jing';
                  const isGuanyin = effectiveSkillRoleId === 'guanyin_pusa';
                  const isTeamTargetSkill = ['guanyin_pusa', 'jinjiao_dawang', 'yutu_jing', 'baiyan_mojun'].includes(effectiveSkillRoleId ?? '');
                  const isRulai = effectiveSkillRoleId === 'rulai_fozu';
                  const isYinjiao = effectiveSkillRoleId === 'yinjiao_dawang';

                  const candidateOptions = players.map(p => {
                    const isSelf = p.id === userId;
                    const isCaptain = p.id === captainId;
                    const isOnTeam = currentTeam.includes(p.id);

                    let label = `${p.seat}号 ${p.nickname}`;
                    let disabledOpt = false;

                    if (isQingshi) {
                      if (isSelf) {
                        label += ' (你自己·不可选)';
                        disabledOpt = true;
                      } else if (isCaptain) {
                        label += ' (队长·不可吞)';
                        disabledOpt = true;
                      } else if (isOnTeam) {
                        label = `[车上队员] ${label}`;
                      } else {
                        label = `[未入队] ${label}`;
                      }
                    } else if (isTeamTargetSkill) {
                      if (isOnTeam) {
                        label = `[出征队员] ${label}`;
                      } else if (currentTeam.length > 0) {
                        label = `[未入队] ${label}`;
                      }
                    } else if (isZhizhu) {
                      if (isSelf) {
                        label += ' (你自己·不可选)';
                        disabledOpt = true;
                      } else if (isCaptain) {
                        label += ' (队长·不可结茧)';
                        disabledOpt = true;
                      }
                    } else if ((isRulai || isYinjiao) && isSelf) {
                      label += ' (你自己·不可选)';
                      disabledOpt = true;
                    }

                    return { player: p, label, disabled: disabledOpt, isOnTeam };
                  });

                  candidateOptions.sort((a, b) => {
                    if (isQingshi || isGuanyin || isTeamTargetSkill) {
                      if (a.isOnTeam && !b.isOnTeam) return -1;
                      if (!a.isOnTeam && b.isOnTeam) return 1;
                    }
                    return a.player.seat - b.player.seat;
                  });

                  return (
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
                      {candidateOptions.map(opt => (
                        <option key={opt.player.id} value={opt.player.id} disabled={opt.disabled}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  );
                })()}
                <button
                  type="button"
                  disabled={disabled || isLiTianwangWaitingTeam || isPutiWaitingMission2 || (isForcedLaunchTurn && isVoteOnlyBrawlSkill) || (selfBrawl.skill.actionType === 'target_player' && !brawlTarget)}
                  onClick={() => handleUseSkill(selfBrawl.skill.skillId, brawlTarget || undefined)}
                  style={{
                    background: 'linear-gradient(135deg, #d97706 0%, #b45309 50%, #78350f 100%)',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
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
            {getBrawlTacticalTip(selfBrawl.roleId) || (selfBrawl.camp === 'blue'
              ? '凝聚仙佛神力，明辨真假猴王，严防妖魔作祟，护持灵山大道。'
              : '潜伏同流隐匿妖气，伺机制造失败，混淆视听以夺天机。')}
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
