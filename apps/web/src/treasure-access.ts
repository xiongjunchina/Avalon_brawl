export const GUARDIAN_TREASURE_DISABLED_REASON = '';

export function treasureAccess(_game: any, _enabled: boolean) {
  return { canOpen: false, reason: '', status: '' };
}
