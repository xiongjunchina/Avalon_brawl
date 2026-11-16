import type { CustomBannerConfig } from '@avalon/contracts';

export function isCustomBannerActive(
  config: CustomBannerConfig | null | undefined,
  nowMs: number = Date.now(),
  user?: { playerCode?: string; nickname?: string } | null,
  roomMembers: Array<{ playerCode?: string; nickname?: string }> = []
): boolean {
  if (!config || !config.enabled || !config.text?.trim()) return false;

  // Time window check
  if (config.timeWindowEnabled) {
    if (config.startTime) {
      const startMs = new Date(config.startTime).getTime();
      if (!isNaN(startMs) && nowMs < startMs) return false;
    }
    if (config.endTime) {
      const endMs = new Date(config.endTime).getTime();
      if (!isNaN(endMs) && nowMs >= endMs) return false;
    }
  }

  // Target audience check
  if (config.targetType === 'all') {
    return true;
  }

  // Specific targets: targetCodes and targetNicknames
  const targetCodes = (config.targetCodes || '')
    .split(/[,，\s]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  const targetNames = (config.targetNicknames || '')
    .split(/[,，\s]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  if (targetCodes.length === 0 && targetNames.length === 0) {
    return true; // No filter specified
  }

  const checkPerson = (p?: { playerCode?: string; nickname?: string } | null) => {
    if (!p) return false;
    const pCode = String(p.playerCode || '').trim().toLowerCase();
    if (pCode && targetCodes.includes(pCode)) return true;
    const pName = (p.nickname || '').trim().toLowerCase();
    if (pName && targetNames.some(t => pName.includes(t))) return true;
    return false;
  };

  // Check current user
  if (checkPerson(user)) return true;

  // Check any member in current room / table
  return roomMembers.some(m => checkPerson(m));
}
