import type { BrawlRoleDef, BrawlCamp } from '@avalon/contracts';
import { BRAWL_ROLE_REGISTRY } from '@avalon/game-core';

export function getBrawlRole(roleId: string): BrawlRoleDef | undefined {
  return BRAWL_ROLE_REGISTRY[roleId];
}

export function getBrawlRoleName(roleId: string): string {
  return BRAWL_ROLE_REGISTRY[roleId]?.name || roleId;
}

export function getBrawlRoleTitle(roleId: string): string {
  return BRAWL_ROLE_REGISTRY[roleId]?.title || '';
}

export function getBrawlRoleArtPrefix(roleId: string): string {
  return BRAWL_ROLE_REGISTRY[roleId]?.artPrefix || 'loyal';
}

export function getBrawlRoleCamp(roleId: string): BrawlCamp {
  return BRAWL_ROLE_REGISTRY[roleId]?.camp || 'blue';
}
