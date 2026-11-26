import type { Player, RoundView, BrawlReplayAction } from '@avalon/contracts';
import { PlayerToken } from './PlayerToken';
import { WUYUE_MISSIONS } from './roles';
import { useRef, useState } from 'react';

/** Shared by live mission details, all rounds and historical replays. */
export function BattleRound({ round: r, players, anonymous, userId, brawlActions }: {
  round: RoundView; players: Player[]; anonymous: boolean; userId?: string; brawlActions?: BrawlReplayAction[];
}) {
  const captain = players.find(p => p.id === r.captainId);
  const playerById = (id: string): Player => players.find(p => p.id === id) ?? { id, seat: 0, nickname: '未知成员' };
  // Even if a stale/inconsistent response contains ballots, anonymous rooms never render them.
  const ballots = !anonymous ? r.vote?.ballots : undefined;
  const state=r.result?(r.result.passed?'✓ 任务成功':'× 任务失败'):r.vote?(r.vote.passed?'等待任务结算':'组队未通过'):'表决未完成';
  const tone=r.result?(r.result.passed?'pass':'fail'):r.vote&&!r.vote.passed?'fail':'pending';
  return <article className="battle-round chronicle-round" aria-label={`第${r.number}次提案`}>
    <div className="chronicle-round-head"><h3>第 {r.number} 次提案 <small>{WUYUE_MISSIONS[r.mission - 1]?.title ?? `任务 ${r.mission}`}</small></h3><span className={`chronicle-state is-${tone}`}>{state}</span></div>
    <section className="battle-section battle-party" aria-label="组队方案">
      <div className="battle-captain"><h4>领队</h4>{captain ? <PlayerToken player={captain} self={captain.id === userId} />:<span>未知成员</span>}<span className="chronicle-direction">{r.direction === 'clockwise' ? '顺时针' : '逆时针'}发言</span></div>
      <p className="battle-section-label">出征队员 · {r.team.length} 人</p>
      <div className="battle-party-grid" data-count={r.team.length}>{r.team.map(id => <PlayerToken key={id} player={playerById(id)} self={id === userId} />)}</div>
    </section>
    <section className="battle-section" aria-label="组队表决">
      <h4>组队表决{r.militaryWager ? ' · 📜 立军令状' : ''}</h4>
      {r.vote ? (r.vote.forced ? (
        <p className="hint" style={{ color: '#92400e', fontWeight: 600 }}>🔥 两流必发：本难已流局 2 次，第 3 轮跳过组队表决强制发车出征。</p>
      ) : <>
        <div className="battle-vote-totals"><span className="approve">✓ {r.vote.approvals} 赞成</span><span className="reject">× {r.vote.rejections} 反对</span><span className="abstain">− {r.vote.abstentions ?? 0} 弃权</span><strong>{r.vote.passed ? '组队通过' : '组队未通过（流局）'}</strong></div>
        {ballots ? <details className="chronicle-ballots"><summary>全员票型实录 · {players.length} 人</summary><div className="battle-voters" aria-label="全员公开票型">{players.map(p => <div key={p.id} aria-label={`${p.seat} 号 ${p.nickname}：${ballots[p.id] === true ? '赞成' : ballots[p.id] === false ? '反对' : ballots[p.id] === 'abstain' ? '弃权' : '无票型记录'}`}><PlayerToken player={p} vote={ballots[p.id]} self={p.id === userId} />{ballots[p.id]===undefined&&<span className="chronicle-no-ballot">无记录</span>}</div>)}</div><p className="hint">图标表示组队投票，记录每位仙友当时选择。</p></details> : <p className="hint">{anonymous ? '匿名组队投票，仅展示总票数。' : '本次未记录个人票型，仅展示总票数。'}</p>}
      </>) : <p className="hint">本次表决未完成，不展示未收齐的个人选择。</p>}
    </section>
    {r.result && <section className={`battle-section battle-result ${r.result.passed ? 'is-pass' : 'is-fail'}`} aria-label="任务结算">
      <h4>任务结算</h4>
      {r.result.masked && r.result.successes < 0 ? (
        <div className="battle-card-counts"><span className="approve">🌫️ 混沌迷雾 · 牌数已隐藏（? 张）</span></div>
      ) : (
        <div className="battle-card-counts"><span className="approve">成功牌 × {r.result.successes}</span><span className="reject">失败牌 × {r.result.failures}</span></div>
      )}
      <p className="hint">
        {r.result.masked && r.result.successes < 0
          ? '本难触发混沌迷雾，终局复盘揭晓真实牌底。'
          : r.result.masked
            ? '🌫️ 本难原为混沌迷雾，复盘已还原真实成功/失败牌数。'
            : r.result.cards
              ? '终局复盘已解密车队队员真实牌底（出牌不计法宝转化，法宝效果见下方斗法实录）。'
              : '任务牌在对局中匿名，不对应个人。'}
      </p>
      {r.result.cards && (
        <div className="battle-member-cards" aria-label="出征队员实际出牌">
          <p className="battle-member-cards-title">🎴 出征队员实际出牌（终局揭晓）：</p>
          <div className="battle-member-cards-grid">
            {r.team.map(id => {
              const p = playerById(id);
              const card = r.result!.cards![id];
              return (
                <div key={id} className={`battle-member-card ${card === true ? 'is-pass' : card === false ? 'is-fail' : 'is-unknown'}`}>
                  <span className="battle-member-name">{p.seat > 0 ? `${p.seat}号 · ` : ''}{p.nickname}</span>
                  <span className={`battle-card-badge ${card === true ? 'badge-pass' : card === false ? 'badge-fail' : 'badge-unknown'}`}>
                    {card === true ? '✓ 成功' : card === false ? '× 失败' : '未投'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>}
    {brawlActions && brawlActions.length > 0 && (
      <section className="battle-section battle-brawl-summary" aria-label="仙妖斗法实录">
        <h4 className="brawl-summary-heading">⚡ 仙妖斗法实录 · {brawlActions.length} 处</h4>
        <div className="brawl-summary-chips">
          {brawlActions.map(action => (
            <div key={action.id} className={`brawl-summary-chip outcome-${action.outcome}`} title={action.detail}>
              <span className="brawl-summary-actor">
                {action.actorSeat > 0 ? `${action.actorSeat}号 · ` : ''}{action.actorNickname}
                <strong className="brawl-summary-role">({action.roleName})</strong>
              </span>
              <span className="brawl-summary-skill">【{action.skillName}】</span>
              {action.targetNickname && (
                <span className="brawl-summary-target">
                  🎯 {action.targetSeat ? `${action.targetSeat}号 · ` : ''}{action.targetNickname}
                </span>
              )}
              <span className={`brawl-summary-badge is-${action.outcome}`}>
                {action.outcome === 'success' ? '✓ 生效' : action.outcome === 'blocked' ? '🛡️ 被化解' : action.outcome === 'info' ? '👁️ 天机' : '× 未触发'}
              </span>
            </div>
          ))}
        </div>
      </section>
    )}
  </article>;
}

/** Keep every proposal in chronological order; each individual card stays compact. */
export function BattleHistory({ rounds, brawlActions, ...props }: Omit<Parameters<typeof BattleRound>[0], 'round'> & { rounds: RoundView[]; brawlActions?: BrawlReplayAction[] }) {
  const cards=useRef(new Map<number, HTMLDivElement>());
  const [active,setActive]=useState<number|null>(null);
  const jump=(number:number)=>{setActive(number);cards.current.get(number)?.scrollIntoView({block:'start'});};
  if (!rounds.length) return <p className="chronicle-empty">尚无提案记录。</p>;

  return <div className="battle-history">
    <nav className="round-jump-nav" aria-label="提案快速定位">
      <button type="button" className="secondary" onClick={()=>jump(rounds.at(-1)!.number)}>最近一轮</button>
      {rounds.map(r=><button key={r.number} type="button" className="secondary" aria-pressed={active===r.number} onClick={()=>jump(r.number)}>第{r.number}次 · 第{r.mission}难</button>)}
    </nav>
    {rounds.map(round => (
      <div className="battle-round-anchor" key={round.number} ref={el=>{if(el)cards.current.set(round.number,el);else cards.current.delete(round.number);}}>
        <BattleRound {...props} round={round} brawlActions={brawlActions?.filter(a => a.roundNumber === round.number && a.phase !== 'assassination')} />
      </div>
    ))}
  </div>;
}
