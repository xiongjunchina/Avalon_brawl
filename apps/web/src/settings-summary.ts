import type {Settings} from '@avalon/contracts';
export function settingsText(s:Settings, _rulesetVersion?:string) {
  const brawlTags = `⚔️ 仙魔大乱斗${s.brawlOrdealsEnabled ? '·八十一难奇劫' : ''}${s.brawlPhantomVisionEnabled ? '·画皮惑眼' : ''}`;
  return `${s.playerCount} 人 · ${s.voiceChatEnabled ? '🎙️ 语音房' : '🏛️ 常规房'} · ${brawlTags} · ${s.anonymousTeamVote ? '匿名' : '实名'}表决 · ${s.captainMode === 'seat_order' ? '座位队长' : '随机队长'} · 两流必发${s.earlyAssassinationEnabled ? ' · 提前刺杀' : ''}${s.autoRevealRoleEnabled ? ' · 自动亮牌' : ''}${s.rolePreferenceEnabled ? ' · 心仪选角' : ''}`;
}
