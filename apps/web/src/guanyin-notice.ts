import type { GameView } from '@avalon/contracts';
import { usePrivateNotice } from './private-notice';

export function guanyinNoticeKey(game: GameView, userId: string): string | null {
  if (game.selfBrawl?.guanyinGanluResult) {
    return `avalon:brawl-guanyin-read:${game.id}:${userId}:${game.selfBrawl.guanyinGanluResult.targetSeat}:${game.selfBrawl.guanyinGanluResult.success}`;
  }
  return game.self?.role === 'guinevere' && game.self.treasures?.enabled && game.self.treasures.guanyinMirror?.result
    ? `avalon:guanyin-read:${game.id}:${userId}` : null;
}

export function useGuanyinNotice(game: GameView, userId: string, connected: boolean) {
  return usePrivateNotice(guanyinNoticeKey(game, userId), connected);
}
