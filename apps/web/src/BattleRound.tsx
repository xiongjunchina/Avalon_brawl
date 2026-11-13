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
      <h4>组队表决</h4>
      {r.vote ? <>
        <div className="battle-vote-totals"><span className="approve">✓ {r.vote.approvals} 赞成</span><span className="reject">× {r.vote.rejections} 反对</span><span className="abstain">− {r.vote.abstentions ?? 0} 弃权</span><strong>{r.vote.passed ? '组队通过' : '组队未通过（流局）'}</strong></div>
        {ballots ? <details className="chronicle-ballots"><summary>全员公开票型 · {players.length} 人</summary><div className="battle-voters" aria-label="全员公开票型">{players.map(p => <div key={p.id} aria-label={`${p.seat} 号 ${p.nickname}：${ballots[p.id] === true ? '赞成' : ballots[p.id] === false ? '反对' : ballots[p.id] === 'abstain' ? '弃权' : '无票型记录'}`}><PlayerToken player={p} vote={ballots[p.id]} self={p.id === userId} />{ballots[p.id]===undefined&&<span className="chronicle-no-ballot">无记录</span>}</div>)}</div><p className="hint">图标表示组队投票，不代表任务出牌。</p></details> : <p className="hint">{anonymous ? '匿名组队投票，仅展示总票数。' : '本次未记录个人票型，仅展示总票数。'}</p>}
      </> : <p className="hint">本次表决未完成，不展示未收齐的个人选择。</p>}
    </section>
    {r.result && <section className={`battle-section battle-result ${r.result.passed ? 'is-pass' : 'is-fail'}`} aria-label="任务结算">
      <h4>任务结算</h4>
      <div className="battle-card-counts"><span className="approve">成功牌 × {r.result.successes}</span><span className="reject">失败牌 × {r.result.failures}</span></div>
      <p className="hint">任务牌始终匿名，不对应个人。</p>
    </section>}
    {brawlActions && brawlActions.length > 0 && (
      <section className="battle-section battle-brawl-chronicle" aria-label="仙妖斗法实录">
        <h4>仙妖斗法实录 · {brawlActions.length} 处</h4>
        <div className="brawl-chronicle-list">
          {brawlActions.map(action => (
            <div key={action.id} className={`brawl-chronicle-item outcome-${action.outcome}`}>
              <div className="brawl-chronicle-head">
                <span className="brawl-chronicle-actor">
                  {action.actorSeat > 0 ? `${action.actorSeat}号 · ` : ''}{action.actorNickname} <strong>({action.roleName})</strong>
                </span>
                <span className="brawl-chronicle-skill">【{action.skillName}】</span>
                <span className={`brawl-chronicle-badge is-${action.outcome}`}>
                  {action.outcome === 'success' ? '✓ 生效' : action.outcome === 'blocked' ? '🛡️ 被化解' : action.outcome === 'info' ? '👁️ 天机' : '× 未触发'}
                </span>
              </div>
              <p className="brawl-chronicle-detail">{action.detail}</p>
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

  const initialBrawlActions = brawlActions?.filter(a => a.roundNumber === 0) ?? [];
  const assassinationBrawlActions = brawlActions?.filter(a => a.phase === 'assassination') ?? [];
  const roundNumbers = new Set(rounds.map(r => r.number));
  const otherBrawlActions = brawlActions?.filter(a =>
    a.roundNumber !== 0 &&
    a.phase !== 'assassination' &&
    !roundNumbers.has(a.roundNumber)
  ) ?? [];

  return <div className="battle-history">
    {/* If game ended and brawl mode was enabled, but no skills were used at all */}
    {brawlActions !== undefined && brawlActions.length === 0 && (
      <div className="battle-section battle-brawl-chronicle" style={{ marginBottom: 10, background: '#fdf8ee', borderStyle: 'dotted' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#8c6d48', textAlign: 'center' }}>
          📜 仙妖斗法：本局全场玩家均未施展主动法宝或触发暗算
        </p>
      </div>
    )}

    {/* Opening intelligence if available */}
    {initialBrawlActions.length > 0 && (
      <section className="battle-section battle-brawl-chronicle" style={{ marginBottom: 10 }}>
        <h4>🔮 初始天机 · 开局窥探实录</h4>
        <div className="brawl-chronicle-list">
          {initialBrawlActions.map(action => (
            <div key={action.id} className={`brawl-chronicle-item outcome-${action.outcome}`}>
              <div className="brawl-chronicle-head">
                <span className="brawl-chronicle-actor">
                  {action.actorSeat > 0 ? `${action.actorSeat}号 · ` : ''}{action.actorNickname} <strong>({action.roleName})</strong>
                </span>
                <span className="brawl-chronicle-skill">【{action.skillName}】</span>
                <span className={`brawl-chronicle-badge is-${action.outcome}`}>
                  {action.outcome === 'success' ? '✓ 生效' : action.outcome === 'blocked' ? '🛡️ 被化解' : action.outcome === 'info' ? '👁️ 天机' : '× 未触发'}
                </span>
              </div>
              <p className="brawl-chronicle-detail">{action.detail}</p>
            </div>
          ))}
        </div>
      </section>
    )}

    <nav className="round-jump-nav" aria-label="提案快速定位">
      <button type="button" className="secondary" onClick={()=>jump(rounds.at(-1)!.number)}>最近一轮</button>
      {rounds.map(r=><button key={r.number} type="button" className="secondary" aria-pressed={active===r.number} onClick={()=>jump(r.number)}>第{r.number}次 · 第{r.mission}难</button>)}
    </nav>
    {rounds.map(round => <div className="battle-round-anchor" key={round.number} ref={el=>{if(el)cards.current.set(round.number,el);else cards.current.delete(round.number);}}><BattleRound {...props} round={round} brawlActions={brawlActions?.filter(a => a.roundNumber === round.number && a.phase !== 'assassination')} /></div>)}

    {/* Any other brawl actions not attached to specific numbered rounds */}
    {otherBrawlActions.length > 0 && (
      <section className="battle-section battle-brawl-chronicle" style={{ marginTop: 12 }}>
        <h4>⚡ 仙妖斗法奇谋实录</h4>
        <div className="brawl-chronicle-list">
          {otherBrawlActions.map(action => (
            <div key={action.id} className={`brawl-chronicle-item outcome-${action.outcome}`}>
              <div className="brawl-chronicle-head">
                <span className="brawl-chronicle-actor">
                  {action.actorSeat > 0 ? `${action.actorSeat}号 · ` : ''}{action.actorNickname} <strong>({action.roleName})</strong>
                </span>
                <span className="brawl-chronicle-skill">【{action.skillName}】</span>
                <span className={`brawl-chronicle-badge is-${action.outcome}`}>
                  {action.outcome === 'success' ? '✓ 生效' : action.outcome === 'blocked' ? '🛡️ 被化解' : action.outcome === 'info' ? '👁️ 天机' : '× 未触发'}
                </span>
              </div>
              <p className="brawl-chronicle-detail">{action.detail}</p>
            </div>
          ))}
        </div>
      </section>
    )}

    {/* Assassination brawl action if available */}
    {assassinationBrawlActions.length > 0 && (
      <section className="battle-section battle-brawl-chronicle" style={{ marginTop: 12 }}>
        <h4>🗡️ 终局决战 · 刺杀大圣实录</h4>
        <div className="brawl-chronicle-list">
          {assassinationBrawlActions.map(action => (
            <div key={action.id} className={`brawl-chronicle-item outcome-${action.outcome}`}>
              <div className="brawl-chronicle-head">
                <span className="brawl-chronicle-actor">
                  {action.actorSeat > 0 ? `${action.actorSeat}号 · ` : ''}{action.actorNickname} <strong>({action.roleName})</strong>
                </span>
                <span className="brawl-chronicle-skill">【{action.skillName}】</span>
                <span className={`brawl-chronicle-badge is-${action.outcome}`}>
                  {action.outcome === 'success' ? '✓ 绝杀' : '× 落空'}
                </span>
              </div>
              <p className="brawl-chronicle-detail">{action.detail}</p>
            </div>
          ))}
        </div>
      </section>
    )}
  </div>;
}
