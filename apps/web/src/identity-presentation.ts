import type { GameView } from '@avalon/contracts';

export function identityKnowledge(self: NonNullable<GameView['self']>) {
  const candidates = self.merlinCandidates.length ? self.merlinCandidates : self.evilIds;
  const title = self.merlinCandidates.length ? '两位大圣 · 真假待辨'
    : self.role === 'merlin' ? '你火眼金睛识破的群妖'
    : self.evilIds.length ? '与你相认的同伙群妖'
    : '取经漫漫 · 静观其变';
  const description = self.merlinCandidates.length ? '一位是真大圣孙悟空，一位是假大圣六耳猕猴，无法分辨对应身份。'
    : self.role === 'merlin' ? '本局潜伏群妖在你的火眼金睛中显出妖气（若抽中黄眉老怪，其假佛金身不在其中）；仅知阵营，不知角色。'
    : self.evilIds.length ? '以上是与你相认的群妖同伙（若抽中牛魔王，其孤身独霸不在相认之列）；仅知阵营，不知角色。'
    : '没有其他初始身份线索，请从发言与取经战况中判断。';

  return { candidates, title, description };
}

export function identityTreasure(_self: NonNullable<GameView['self']>, _count: number, _treasuresEnabled: boolean, _game?: GameView) {
  return { enabled: false, description: '', canClickTreasure: false, treasureSub: '' };
}
