import type {
  BrawlCamp,
  BrawlRoleDef,
  BrawlSkillControlState,
  BrawlSkillTargetOption,
  BrawlTriggerPhase,
  Player,
  RoundView,
} from '@avalon/contracts';
import {
  BRAWL_ROLE_REGISTRY,
  BRAWL_SKILL_PROBS,
} from './brawl-registry.js';
import {
  appendBattleEvent,
  ensureBrawlSecrets,
  getEffectiveSkillRole,
  hasBrawlSkillRole,
  recordBrawlReplayAction,
  setBrawlPrivateReceipt,
} from './brawl-engine.js';
import {
  BRAWL_MAX_REJECTIONS_BEFORE_FORCE,
  canSafelyBanPlayer,
  collectMissionBannedPlayerIds,
} from './brawl-ordeals.js';
import {
  captain,
  failuresRequired,
  getLiveMissionTeam,
  missionSizesFor,
  requireRule,
  type GameState,
} from './brawl-types.js';

export function getEligibleSkillTargetPlayers(
  g: GameState,
  casterId: string,
  skillId: string,
): BrawlSkillTargetOption[] {
  const liveTeam = getLiveMissionTeam(g);
  const curCaptainId = captain(g);
  const baseSize = missionSizesFor(g.players.length, true)[g.mission - 1];
  const bannedIds = collectMissionBannedPlayerIds({
    mission: g.mission,
    captainId: curCaptainId,
    imprisonedTargetId: g.brawl?.imprisonedTargetId,
    zhizhuBannedTargetId: g.brawl?.zhizhuBannedTargetId,
    qingshiTuntianTargetId: g.brawl?.qingshiTuntianTargetId,
    ordeals: g.brawl?.ordeals,
    wager: g.brawl?.wager,
  });

  return g.players.map(p => {
    const isSelf = p.id === casterId;
    const isCaptain = p.id === curCaptainId;
    const isOnLiveTeam = liveTeam.includes(p.id);

    let disabled = false;
    let tag = isOnLiveTeam ? '已入选车队' : '未入队';
    let priority = isOnLiveTeam ? 0 : 1;

    if (skillId === 'wuxingshan_zhang' || skillId === 'yishan_yading') {
      if (isSelf) {
        disabled = true;
        tag = '你自己·不可选';
      }
    }

    if (skillId === 'dakou_tuntian' || skillId === 'pansi_jiejian') {
      if (isSelf) {
        disabled = true;
        tag = '你自己·不可选';
      } else if (isCaptain) {
        disabled = true;
        tag = '队长·不可禁';
      } else if (!canSafelyBanPlayer(g.players.length, bannedIds, p.id, baseSize)) {
        disabled = true;
        tag = '防死锁·不可禁';
      }
    }

    if (skillId === 'wuxingshan_zhang') {
      if (!disabled && !canSafelyBanPlayer(g.players.length, bannedIds, p.id, baseSize)) {
        disabled = true;
        tag = '防死锁·不可禁';
      }
    }

    return {
      playerId: p.id,
      seat: p.seat,
      nickname: p.nickname,
      disabled,
      tag,
      priority,
    };
  });
}

export function computeSkillControl(g: GameState, userId: string): BrawlSkillControlState | undefined {
  const playerState = g.brawl?.playerStates?.[userId];
  if (!playerState) return undefined;

  const role = getEffectiveSkillRole(playerState);
  if (!role) return undefined;

  const skill = role.skill;
  if (skill.actionType === 'passive' || skill.skillId === 'sanmei_zhenhuo') {
    return undefined;
  }

  // 终局或已流产阶段直接不显示控制栏
  if (g.phase === 'finished' || g.phase === 'aborted') {
    return {
      visible: false,
      canCast: false,
      blockedReason: '对局已终局',
      requiresTarget: false,
    };
  }

  if (playerState.skillUsed) {
    return {
      visible: true,
      canCast: false,
      blockedReason: '本局法宝已施展',
      requiresTarget: false,
    };
  }

  // 检查自身是否被如来五行山禁锢
  if (g.brawl?.imprisonedTargetId === userId) {
    return {
      visible: true,
      canCast: false,
      blockedReason: '已被佛法镇压于五行山下，无法施展法宝',
      requiresTarget: skill.actionType === 'target_player',
    };
  }

  const skillId = skill.skillId;
  const isVoteOnlySkill = ['santou_liubi', 'pingtian_handi', 'yishan_yading', 'xiangyao_baozhang', 'daoda_yipa'].includes(skillId);
  const isTeamBuildControlSkill = ['wuxingshan_zhang', 'pansi_jiejian', 'dakou_tuntian', 'xiuli_qiankun'].includes(skillId);

  let allowedPhase = true;
  let blockedReason: string | undefined;

  if (isVoteOnlySkill) {
    if (['mission', 'assassination'].includes(g.phase)) {
      allowedPhase = false;
      blockedReason = '仅在组队及表决阶段可用';
    } else if (g.rejectionCount >= BRAWL_MAX_REJECTIONS_BEFORE_FORCE) {
      allowedPhase = false;
      blockedReason = '2次流局强行发车，无须表决';
    }
  } else if (skillId === 'longma_fuzhong') {
    if (!['role_reveal', 'proposing', 'discussion'].includes(g.phase)) {
      allowedPhase = false;
      blockedReason = '仅在挑选队员阶段可用';
    }
  } else if (isTeamBuildControlSkill) {
    if (!['role_reveal', 'proposing', 'discussion', 'team_vote'].includes(g.phase)) {
      allowedPhase = false;
      blockedReason = '仅在组队及表决阶段可用';
    }
  } else if (skillId !== 'yuncheng_wanli') {
    if (g.phase === 'assassination') {
      allowedPhase = false;
      blockedReason = '刺杀阶段不可用';
    }
  }

  if (allowedPhase && skillId === 'zhaoyao_baojing') {
    const liveTeam = getLiveMissionTeam(g);
    if (liveTeam.length === 0) {
      allowedPhase = false;
      blockedReason = '需先有队员入选车队后方可照妖';
    }
  }

  if (allowedPhase && skillId === 'daofa_dianhua') {
    if (g.mission < 2) {
      allowedPhase = false;
      blockedReason = '需第 2 难及之后方可传法点化';
    }
  }

  const requiresTarget = skill.actionType === 'target_player';
  const targetOptions = requiresTarget ? getEligibleSkillTargetPlayers(g, userId, skillId) : undefined;

  return {
    visible: true,
    canCast: allowedPhase,
    blockedReason,
    requiresTarget,
    targetOptions,
  };
}

export function refundArmedMissionSkillsOnProposalAbort(g: GameState, reasonLabel: string): void {
  if (!g.brawl) return;
  const brawl = g.brawl;
  const roundNumber = g.rounds.at(-1)?.number ?? (g.rounds.length || 1);
  const refundOne = (roleId: string, clearFn: () => void) => {
    const actor = g.players.find(p => hasBrawlSkillRole(brawl.playerStates?.[p.id], roleId));
    clearFn();
    if (!actor || !brawl.playerStates) return;
    const ps = brawl.playerStates[actor.id];
    const roleDef = BRAWL_ROLE_REGISTRY[roleId];
    if (ps) ps.skillUsed = false;
    setBrawlPrivateReceipt(
      brawl,
      actor.id,
      `♻️ 因${reasonLabel}未发车，你的【${roleDef?.skill.skillName ?? '法宝'}】已自动退还保留，可在后续出征车队确定后再次施展！`,
    );
    recordBrawlReplayAction(brawl, {
      roundNumber,
      mission: g.mission,
      phase: 'team_voting',
      actorId: actor.id,
      actorSeat: actor.seat,
      actorNickname: actor.nickname,
      roleId,
      roleName: roleDef?.name ?? roleId,
      skillName: roleDef?.skill.skillName ?? '法宝',
      outcome: 'miss',
      detail: `因${reasonLabel}未发车，先前蓄力的【${roleDef?.skill.skillName ?? '法宝'}】未消耗并已自动退还保留。`,
    });
  };

  const secrets = ensureBrawlSecrets(brawl);
  if (secrets.guanyinGanluTargetId) refundOne('guanyin_pusa', () => { secrets.guanyinGanluTargetId = undefined; });
  if (secrets.jinjiaoHuluTargetId) refundOne('jinjiao_dawang', () => { secrets.jinjiaoHuluTargetId = undefined; });
  if (secrets.yutuMihunTargetId) refundOne('yutu_jing', () => { secrets.yutuMihunTargetId = undefined; });
  if (secrets.baiyanDuchaTargetId) refundOne('baiyan_mojun', () => { secrets.baiyanDuchaTargetId = undefined; });
  if (secrets.baiguLijianArmed) refundOne('bai_gujing', () => { secrets.baiguLijianArmed = false; });
  if (brawl.taoshouActive) refundOne('wangmu_niangniang', () => { brawl.taoshouActive = false; });
  if (brawl.yuhuangYuzhiArmed) refundOne('yuhuang_dadi', () => { brawl.yuhuangYuzhiArmed = false; });
}

export function executeBrawlSkill(
  g: GameState,
  userId: string,
  skillId: string,
  targetPlayerId?: string,
  onRotate?: (g: GameState) => void,
): { shouldCheckTeamVoteComplete?: boolean } {
  requireRule(g.brawl && g.brawl.playerStates, 'BRAWL_NOT_ENABLED');
  const playerState = g.brawl.playerStates[userId];
  requireRule(playerState, 'PLAYER_NOT_FOUND');
  requireRule(!playerState.skillUsed, 'SKILL_ALREADY_USED');
  const role = getEffectiveSkillRole(playerState);
  requireRule(role, 'ROLE_NOT_FOUND');
  requireRule(skillId === role.skill.skillId, 'INVALID_SKILL');

  const isVoteOnlySkill = ['santou_liubi', 'pingtian_handi', 'yishan_yading', 'xiangyao_baozhang', 'daoda_yipa'].includes(skillId);
  const isTeamBuildControlSkill = ['wuxingshan_zhang', 'pansi_jiejian', 'dakou_tuntian', 'xiuli_qiankun'].includes(skillId);

  if (isVoteOnlySkill) {
    requireRule(!['mission', 'assassination'].includes(g.phase), 'WRONG_PHASE');
    requireRule(g.rejectionCount < BRAWL_MAX_REJECTIONS_BEFORE_FORCE, 'FORCED_LAUNCH_NO_VOTE');
  } else if (skillId === 'longma_fuzhong') {
    requireRule(['role_reveal', 'proposing', 'discussion'].includes(g.phase), 'WRONG_PHASE');
  } else if (isTeamBuildControlSkill) {
    requireRule(['role_reveal', 'proposing', 'discussion', 'team_vote'].includes(g.phase), 'WRONG_PHASE');
  } else if (skillId !== 'yuncheng_wanli') {
    requireRule(g.phase !== 'assassination', 'WRONG_PHASE');
  }

  const currentRoundNumber = g.phase === 'proposing'
    ? g.rounds.length + 1
    : (g.rounds.at(-1)?.number ?? (g.rounds.length || 1));

  let targetText = '';
  let targetPlayer: Player | undefined;
  if (targetPlayerId) {
    targetPlayer = g.players.find(p => p.id === targetPlayerId);
    if (targetPlayer) {
      targetText = `对【${targetPlayer.seat}号 · ${targetPlayer.nickname}】`;
    }
  }

  if (role.skill.actionType === 'target_player' && skillId !== 'sanmei_zhenhuo') {
    requireRule(targetPlayer, 'TARGET_REQUIRED');
  }
  if (['wuxingshan_zhang', 'yishan_yading'].includes(skillId) && targetPlayer) {
    requireRule(targetPlayer.id !== userId, 'CANNOT_TARGET_SELF');
  }
  if (['dakou_tuntian', 'pansi_jiejian'].includes(skillId) && targetPlayer) {
    requireRule(targetPlayer.id !== captain(g), 'CANNOT_BAN_CAPTAIN');
    requireRule(targetPlayer.id !== userId, 'CANNOT_BAN_SELF');
  }
  if (skillId === 'zhaoyao_baojing') {
    const liveTeam = getLiveMissionTeam(g);
    requireRule(liveTeam.length > 0, 'TEAM_NOT_READY');
  }
  if (skillId === 'daofa_dianhua') {
    requireRule(g.mission >= 2, 'MISSION_NOT_REACHED');
  }
  if (['wuxingshan_zhang', 'pansi_jiejian', 'dakou_tuntian'].includes(skillId) && targetPlayer) {
    const baseSize = missionSizesFor(g.players.length, true)[g.mission - 1];
    const curBanned = collectMissionBannedPlayerIds({
      mission: g.mission,
      captainId: captain(g),
      imprisonedTargetId: g.brawl.imprisonedTargetId,
      zhizhuBannedTargetId: g.brawl.zhizhuBannedTargetId,
      qingshiTuntianTargetId: g.brawl.qingshiTuntianTargetId,
      ordeals: g.brawl.ordeals,
      wager: g.brawl.wager,
    });
    requireRule(canSafelyBanPlayer(g.players.length, curBanned, targetPlayer.id, baseSize), 'TOO_MANY_BANNED');
  }

  // 太上老君金刚琢拦截红方主动法宝
  if (playerState.camp === 'red' && g.brawl.laojunZhuoActive) {
    g.brawl.laojunZhuoActive = false;
    playerState.skillUsed = true;
    const interceptSummary = `【太上老君】金刚琢凌空显圣，半空中一道金光当场将【${role.name}】祭出的【${role.skill.skillName}】套走收缴，妖法作废失效！`;
    appendBattleEvent(g.brawl, 'taishang_laojun', interceptSummary, '金刚琢套走妖魔绝技，收缴其法宝效果使其失效。', 'anonymous_broadcast');
    const actorP = g.players.find(p => p.id === userId);
    const laojunP = g.players.find(p => hasBrawlSkillRole(g.brawl?.playerStates?.[p.id], 'taishang_laojun'));
    setBrawlPrivateReceipt(
      g.brawl,
      userId,
      `⭕ 你的法宝【${role.skill.skillName}】在第 ${g.mission} 难发动瞬间被太上老君【金刚琢】凌空套走收缴，妖法作废未能生效！`,
    );
    setBrawlPrivateReceipt(
      g.brawl,
      laojunP?.id,
      `⭕ 金刚琢大显神威！第 ${g.mission} 难已凌空套走收缴【${role.name}】的【${role.skill.skillName}】，使其妖法作废！`,
    );
    recordBrawlReplayAction(g.brawl, {
      roundNumber: currentRoundNumber,
      mission: g.mission,
      phase: 'team_building',
      actorId: userId,
      actorSeat: actorP?.seat ?? 0,
      actorNickname: actorP?.nickname ?? role.name,
      roleId: role.id,
      roleName: role.name,
      skillName: role.skill.skillName,
      outcome: 'blocked',
      detail: `祭出绝技【${role.skill.skillName}】，被太上老君金刚琢当场套走收缴，妖法作废失效！`,
    });
    recordBrawlReplayAction(g.brawl, {
      roundNumber: currentRoundNumber,
      mission: g.mission,
      phase: 'team_building',
      actorId: laojunP?.id ?? '',
      actorSeat: laojunP?.seat ?? 0,
      actorNickname: laojunP?.nickname ?? '太上老君',
      roleId: 'taishang_laojun',
      roleName: '太上老君',
      skillName: '金刚琢',
      targetId: userId,
      targetSeat: actorP?.seat,
      targetNickname: actorP?.nickname,
      outcome: 'success',
      detail: `金刚琢凌空显圣，成功收缴套走【${actorP?.seat}号 · ${actorP?.nickname}】（${role.name}）的【${role.skill.skillName}】！`,
    });
    return {};
  }

  playerState.skillUsed = true;
  let customSummary: string | undefined;
  let shouldCheckTeamVoteComplete = false;
  const secrets = ensureBrawlSecrets(g.brawl);

  if (role.skill.skillId === 'jingang_zhuo') {
    g.brawl.laojunZhuoActive = true;
    setBrawlPrivateReceipt(g.brawl, userId, `⭕ 第 ${g.mission} 难金刚琢已悬空待命：下一次任意妖魔发动主动法宝时，将当场凌空套走收缴！`);
  } else if (role.skill.skillId === 'dakou_tuntian') {
    requireRule(targetPlayer, 'TARGET_REQUIRED');
    g.brawl.qingshiTuntianTargetId = targetPlayer.id;

    if (g.draftTeam?.playerIds.includes(targetPlayer.id)) {
      g.draftTeam.playerIds = g.draftTeam.playerIds.filter(id => id !== targetPlayer.id);
    }
    const currentRound = g.rounds.at(-1);
    if (currentRound && currentRound.mission === g.mission && currentRound.team.includes(targetPlayer.id) && (g.phase === 'discussion' || g.phase === 'team_vote')) {
      currentRound.team = currentRound.team.filter(id => id !== targetPlayer.id);
      if (g.brawl.wager && g.brawl.wager.activeRoundNumber === currentRound.number) {
        g.brawl.wager.activeRoundNumber = undefined;
        g.brawl.wager.activeCaptainId = undefined;
      }
      g.phase = 'proposing';
      g.teamVotes = {};
    }
    setBrawlPrivateReceipt(
      g.brawl,
      userId,
      `🦁 第 ${g.mission} 难大口吞天已生效：已将【${targetPlayer.seat}号 · ${targetPlayer.nickname}】吞走剔除出队，本难禁止其入队！`,
    );
  } else if (role.skill.skillId === 'jiashe_leiyin') {
    let detail = '施展假设雷音佛音暗传';
    if (targetPlayer) {
      const candidateBlues = g.players.filter(p => {
        const ps = g.brawl?.playerStates?.[p.id];
        return ps?.camp === 'blue' && ps?.roleId !== 'sun_wukong';
      });
      if (candidateBlues.length > 0) {
        const randomBlue = candidateBlues[Math.floor(Math.random() * candidateBlues.length)];
        secrets.huangmeiDianhuaNotice = {
          targetBlueUserId: randomBlue.id,
          targetSeat: targetPlayer.seat,
          targetNickname: targetPlayer.nickname,
        };
        detail = `假托菩提祖师名义向蓝方【${randomBlue.seat}号 · ${randomBlue.nickname}】私发密信，栽赃诬陷【${targetPlayer.seat}号 · ${targetPlayer.nickname}】身上妖氛缠绕！`;
      }
    }
    const actorP = g.players.find(p => p.id === userId);
    recordBrawlReplayAction(g.brawl, {
      roundNumber: currentRoundNumber,
      mission: g.mission,
      phase: 'team_building',
      actorId: userId,
      actorSeat: actorP?.seat ?? 0,
      actorNickname: actorP?.nickname ?? role.name,
      roleId: role.id,
      roleName: role.name,
      skillName: role.skill.skillName,
      targetId: targetPlayer?.id,
      targetSeat: targetPlayer?.seat,
      targetNickname: targetPlayer?.nickname,
      outcome: 'success',
      detail,
    });
    return {};
  } else if (role.skill.skillId === 'huapi_lijian') {
    secrets.baiguLijianArmed = true;
    const actorP = g.players.find(p => p.id === userId);
    recordBrawlReplayAction(g.brawl, {
      roundNumber: currentRoundNumber,
      mission: g.mission,
      phase: 'team_building',
      actorId: userId,
      actorSeat: actorP?.seat ?? 0,
      actorNickname: actorP?.nickname ?? role.name,
      roleId: role.id,
      roleName: role.name,
      skillName: role.skill.skillName,
      outcome: 'info',
      detail: '暗中埋下离间魔骨：待命若本轮出征任务失败，将静默虚增 1 张失败牌引车内好人自相残杀！',
    });
    return {};
  } else if (role.skill.skillId === 'huanghua_ducha') {
    if (targetPlayer) {
      secrets.baiyanDuchaTargetId = targetPlayer.id;
    }
    const actorP = g.players.find(p => p.id === userId);
    recordBrawlReplayAction(g.brawl, {
      roundNumber: currentRoundNumber,
      mission: g.mission,
      phase: 'team_building',
      actorId: userId,
      actorSeat: actorP?.seat ?? 0,
      actorNickname: actorP?.nickname ?? role.name,
      roleId: role.id,
      roleName: role.name,
      skillName: role.skill.skillName,
      targetId: targetPlayer?.id,
      targetSeat: targetPlayer?.seat,
      targetNickname: targetPlayer?.nickname,
      outcome: 'info',
      detail: `暗中向出征队员【${targetPlayer?.seat}号 · ${targetPlayer?.nickname}】的茶杯中下黄花毒茶，待命出征结算！`,
    });
    return {};
  } else if (role.skill.skillId === 'wuxingshan_zhang') {
    if (targetPlayer) {
      g.brawl.imprisonedTargetId = targetPlayer.id;

      if (g.draftTeam?.playerIds.includes(targetPlayer.id)) {
        g.draftTeam.playerIds = g.draftTeam.playerIds.filter(id => id !== targetPlayer.id);
      }
      const currentRound = g.rounds.at(-1);
      if (currentRound && currentRound.mission === g.mission && (g.phase === 'discussion' || g.phase === 'team_vote') && currentRound.team.includes(targetPlayer.id)) {
        currentRound.team = currentRound.team.filter(id => id !== targetPlayer.id);
        if (g.brawl.wager && g.brawl.wager.activeRoundNumber === currentRound.number) {
          g.brawl.wager.activeRoundNumber = undefined;
          g.brawl.wager.activeCaptainId = undefined;
        }
        g.phase = 'proposing';
        g.teamVotes = {};
      } else if (g.phase === 'team_vote') {
        g.teamVotes[targetPlayer.id] = 'abstain';
        shouldCheckTeamVoteComplete = true;
      }
      setBrawlPrivateReceipt(
        g.brawl,
        userId,
        `🪷 第 ${g.mission} 难五行山掌已生效：已将【${targetPlayer.seat}号 · ${targetPlayer.nickname}】镇压于五行山下，本难禁止入队与表决！`,
      );
    }
  } else if (role.skill.skillId === 'jiuzhuan_xiantao') {
    g.brawl.taoshouActive = true;
    setBrawlPrivateReceipt(
      g.brawl,
      userId,
      `🍑 第 ${g.mission} 难九转仙桃已赐下护体：本难若出现失败牌，将有 ${Math.round(BRAWL_SKILL_PROBS.WANGMU_PARDON * 100)}% 概率化解 1 败（流局自动退还）！`,
    );
  } else if (role.skill.skillId === 'longma_fuzhong') {
    g.brawl.extraSeatLimit = 1;
    setBrawlPrivateReceipt(g.brawl, userId, `🐴 第 ${g.mission} 难龙马负重已生效：本难出征车队席位上限临时 +1！`);
  } else if (role.skill.skillId === 'pansi_jiejian') {
    if (targetPlayer) {
      g.brawl.zhizhuBannedTargetId = targetPlayer.id;

      if (g.draftTeam?.playerIds.includes(targetPlayer.id)) {
        g.draftTeam.playerIds = g.draftTeam.playerIds.filter(id => id !== targetPlayer.id);
      }
      const currentRound = g.rounds.at(-1);
      if (currentRound && currentRound.mission === g.mission && (g.phase === 'discussion' || g.phase === 'team_vote') && currentRound.team.includes(targetPlayer.id)) {
        currentRound.team = currentRound.team.filter(id => id !== targetPlayer.id);
        if (g.brawl.wager && g.brawl.wager.activeRoundNumber === currentRound.number) {
          g.brawl.wager.activeRoundNumber = undefined;
          g.brawl.wager.activeCaptainId = undefined;
        }
        g.phase = 'proposing';
        g.teamVotes = {};
      }
      setBrawlPrivateReceipt(
        g.brawl,
        userId,
        `🕸️ 第 ${g.mission} 难盘丝结茧已生效：已将【${targetPlayer.seat}号 · ${targetPlayer.nickname}】结茧缠缚，本难禁止其入队出征！`,
      );
    }
  } else if (role.skill.skillId === 'xiuli_qiankun') {
    delete g.draftTeam;
    g.teamVotes = {};
    g.missionVotes = {};
    if (g.brawl.wager && g.brawl.wager.activeRoundNumber === g.rounds.at(-1)?.number) {
      g.brawl.wager.activeRoundNumber = undefined;
      g.brawl.wager.activeCaptainId = undefined;
    }
    refundArmedMissionSkillsOnProposalAbort(g, '镇元大仙袖里乾坤收队');
    if (onRotate) onRotate(g);
    g.phase = 'proposing';
    setBrawlPrivateReceipt(g.brawl, userId, `🌀 第 ${g.mission} 难袖里乾坤已生效：已收走争议车队并轮换下任队长重选，不增加本难流局计数！`);
  } else if (role.skill.skillId === 'zhaoyao_baojing') {
    const currentTeam = getLiveMissionTeam(g);
    requireRule(currentTeam.length > 0, 'TEAM_NOT_READY');
    const hasDemon = currentTeam.some(id => g.brawl?.playerStates?.[id]?.camp === 'red');
    const teamSummary = currentTeam
      .map(id => {
        const tp = g.players.find(p => p.id === id);
        return tp ? `${tp.seat}号${tp.nickname}` : '';
      })
      .filter(Boolean)
      .join('、');
    secrets.zhaoyaoResult = {
      hasDemon,
      teamPlayerIds: [...currentTeam],
      mission: g.mission,
      roundNumber: currentRoundNumber,
      teamSummary,
    };
    setBrawlPrivateReceipt(
      g.brawl,
      userId,
      `🪞 第 ${g.mission} 难照妖宝镜探查【${teamSummary}】：车队中【${hasDemon ? '有妖魔潜伏！' : '无妖魔，皆是正道仙友！'}】`,
    );
  } else if (role.skill.skillId === 'yuncheng_wanli') {
    secrets.dapengArmed = true;
    setBrawlPrivateReceipt(
      g.brawl,
      userId,
      '🦅 云程万里已蓄力待命：进入刺杀阶段将自动为红孩儿排除 1 个绝非孙悟空的席位！',
    );
  } else if (role.skill.skillId === 'santou_liubi' || role.skill.skillId === 'pingtian_handi') {
    g.brawl.doubleVoteUserId = userId;
    setBrawlPrivateReceipt(g.brawl, userId, `🔥 第 ${g.mission} 难双倍表决权已激活：本次组队表决你的选票将计为 2 票！`);
  } else if (role.skill.skillId === 'yishan_yading') {
    if (targetPlayer) {
      g.brawl.yishanTargetId = targetPlayer.id;
      if (g.phase === 'team_vote') {
        g.teamVotes[targetPlayer.id] = 'abstain';
        shouldCheckTeamVoteComplete = true;
      }
      setBrawlPrivateReceipt(g.brawl, userId, `⛰️ 第 ${g.mission} 难移山压顶已生效：已将【${targetPlayer.seat}号 · ${targetPlayer.nickname}】本次表决票强制压制为弃权！`);
    }
  } else if (role.skill.skillId === 'tianzun_yuzhi') {
    g.brawl.yuhuangYuzhiArmed = true;
    setBrawlPrivateReceipt(g.brawl, userId, '📜 天尊玉旨已降旨蓄力：后续任一难出征溃败时将自动降旨尝试赦免逆转（1败60%/2败30%）！');
  } else if (role.skill.skillId === 'xiangyao_baozhang') {
    g.brawl.shawujingBaozhangArmed = true;
    setBrawlPrivateReceipt(g.brawl, userId, '🌊 降妖宝杖定海已蓄势：后续组队表决若流局，将有 50% 概率强行镇压反转为发车通过！');
  } else if (role.skill.skillId === 'daoda_yipa') {
    g.brawl.zhubajieDaodaArmed = true;
    setBrawlPrivateReceipt(g.brawl, userId, '🌾 倒打一耙已蓄势：后续组队表决若流局，将强制反转 1 张反对票为赞成票！');
  } else if (role.skill.skillId === 'bajiao_shenfeng') {
    const supremeRoleIds = ['rulai_fozu', 'yuhuang_dadi', 'guanyin_pusa', 'taishang_laojun', 'wangmu_niangniang', 'zhenyuan_daxian', 'puti_zhushi'];
    const blueInPlay = g.players
      .map(p => g.brawl?.playerStates?.[p.id])
      .filter(ps => ps?.camp === 'blue')
      .map(ps => ps!.roleId);
    const inPlaySupreme = blueInPlay.filter(id => supremeRoleIds.includes(id));
    const hasSupreme = inPlaySupreme.length > 0;
    let tierText = hasSupreme
      ? '🍃 芭蕉神风窥得天机：本局蓝方入局阵容包含【天庭至尊/灵山大能】（如来/玉帝/王母/老君/观音/镇元/菩提等顶级神仙）！'
      : '🍃 芭蕉神风窥得天机：本局蓝方无大能坐镇，全员皆为【散仙护法】（八戒/沙僧/白龙/哪吒等，无五行山或金刚琢威胁）！';
    if (Math.random() < BRAWL_SKILL_PROBS.TIESHAN_BONUS_ROLE) {
      const nonCoreBlues = blueInPlay.filter(id => id !== 'sun_wukong' && id !== 'tang_seng');
      const targetId = nonCoreBlues.length > 0 ? nonCoreBlues[Math.floor(Math.random() * nonCoreBlues.length)] : blueInPlay[0];
      const def = BRAWL_ROLE_REGISTRY[targetId];
      if (def) {
        tierText += ` 且灵光乍现探得仙班之一为【${def.name}】！`;
      }
    }
    secrets.tieshanSecret = tierText;
  } else if (role.skill.skillId === 'sanmei_shenfeng') {
    if (Math.random() < BRAWL_SKILL_PROBS.HUANGFENG_PEEK) {
      const blueRoles = g.players
        .map(p => g.brawl?.playerStates?.[p.id])
        .filter(ps => ps?.camp === 'blue' && ps?.roleId !== 'sun_wukong')
        .map(ps => ps!.roleId);
      if (blueRoles.length > 0) {
        const targetRole = BRAWL_ROLE_REGISTRY[blueRoles[Math.floor(Math.random() * blueRoles.length)]];
        if (targetRole) {
          customSummary = `【黄风怪】祭起【三昧神风】黄风蔽日！狂风大作吹探出蓝方盲盒中暗藏【${targetRole.name}】气机！`;
        }
      }
    }
    if (!customSummary) {
      customSummary = '【黄风怪】祭起【三昧神风】黄风蔽日，但神佛宝相庄严，未能吹探出仙佛名号。';
    }
    secrets.huangfengSecret = customSummary;
  } else if (role.skill.skillId === 'jingping_ganlu') {
    if (targetPlayer) {
      secrets.guanyinGanluTargetId = targetPlayer.id;
      setBrawlPrivateReceipt(
        g.brawl,
        userId,
        `🪷 第 ${g.mission} 难净瓶甘露已洒向【${targetPlayer.seat}号 · ${targetPlayer.nickname}】：待其随队出征结算后将私密验其票底（流局自动退还）！`,
      );
    }
  } else if (role.skill.skillId === 'daofa_dianhua') {
    requireRule(g.mission >= 2, 'MISSION_NOT_REACHED');
    const candidateBlues = g.players.filter(p => {
      const ps = g.brawl?.playerStates?.[p.id];
      return ps?.camp === 'blue' && ps?.roleId !== 'sun_wukong';
    });
    const candidateReds = g.players.filter(p => {
      const ps = g.brawl?.playerStates?.[p.id];
      return ps?.camp === 'red';
    });
    if (candidateBlues.length > 0 && candidateReds.length > 0 && Math.random() < BRAWL_SKILL_PROBS.PUTI_REVEAL) {
      const targetBlue = candidateBlues[Math.floor(Math.random() * candidateBlues.length)];
      const targetRed = candidateReds[Math.floor(Math.random() * candidateReds.length)];
      const redDef = BRAWL_ROLE_REGISTRY[g.brawl.playerStates[targetRed.id].roleId];
      secrets.putiDianhuaNotice = {
        targetBlueUserId: targetBlue.id,
        redRoleName: redDef ? redDef.name : '未知妖魔',
      };
      setBrawlPrivateReceipt(
        g.brawl,
        userId,
        `🔮 第 ${g.mission} 难道法点化显灵（50% 命中）：已将潜伏妖魔【${secrets.putiDianhuaNotice.redRoleName}】真名密授给 1 位蓝方同修！`,
      );
    } else {
      setBrawlPrivateReceipt(
        g.brawl,
        userId,
        `🔮 第 ${g.mission} 难道法点化未显灵（50% 概率未命中）：本次天机未现，未能点化传信。`,
      );
    }
  } else if (role.skill.skillId === 'zijin_hulu') {
    if (targetPlayer) {
      secrets.jinjiaoHuluTargetId = targetPlayer.id;
    }
  } else if (role.skill.skillId === 'daoyao_mihun') {
    if (targetPlayer) {
      secrets.yutuMihunTargetId = targetPlayer.id;
    }
  }

  const summaryText = customSummary || `【${role.name}】祭出绝技【${role.skill.skillName}】${targetText}！效用：${role.skill.description}`;
  appendBattleEvent(g.brawl, role.id, summaryText, role.skill.description);

  const actorP = g.players.find(p => p.id === userId);
  let actionPhase: BrawlTriggerPhase = 'team_building';
  if (['santou_liubi', 'pingtian_handi', 'yishan_yading', 'xiuli_qiankun', 'xiangyao_baozhang', 'daoda_yipa'].includes(role.skill.skillId) || g.phase === 'team_vote') {
    actionPhase = 'team_voting';
  } else if (['jingping_ganlu', 'zijin_hulu', 'daoyao_mihun', 'jiuzhuan_xiantao', 'tianzun_yuzhi'].includes(role.skill.skillId)) {
    actionPhase = 'mission_exec';
  }

  let replayDetail = summaryText;
  let replayOutcome: 'success' | 'blocked' | 'miss' | 'info' = 'success';
  if (role.skill.skillId === 'bajiao_shenfeng' && secrets.tieshanSecret) {
    replayDetail = secrets.tieshanSecret;
    replayOutcome = 'info';
  } else if (role.skill.skillId === 'sanmei_shenfeng') {
    replayOutcome = secrets.huangfengSecret?.includes('暗藏【') ? 'info' : 'miss';
  } else if (role.skill.skillId === 'daofa_dianhua') {
    if (secrets.putiDianhuaNotice) {
      const recvP = g.players.find(p => p.id === secrets.putiDianhuaNotice?.targetBlueUserId);
      replayDetail = `施展道法点化真传（50% 命中），向蓝方【${recvP?.seat}号 · ${recvP?.nickname}】暗授天机：场上潜伏群妖之一为【${secrets.putiDianhuaNotice.redRoleName}】！`;
      replayOutcome = 'success';
    } else {
      replayDetail = '施展道法点化真传（50% 概率未命中）：天机未显，未能向蓝方同修传信。';
      replayOutcome = 'miss';
    }
  } else if (role.skill.skillId === 'zhaoyao_baojing' && secrets.zhaoyaoResult) {
    const teamStr = secrets.zhaoyaoResult.teamSummary ? `【${secrets.zhaoyaoResult.teamSummary}】` : '当前车队';
    replayDetail = `举起照妖宝镜密照${teamStr}：探查结果显示车内【${secrets.zhaoyaoResult.hasDemon ? '妖氛弥漫（有妖魔）' : '清光纯正（无妖魔）'}】。`;
    replayOutcome = 'info';
  } else if (['jingping_ganlu', 'zijin_hulu', 'daoyao_mihun', 'jiuzhuan_xiantao', 'tianzun_yuzhi', 'xiangyao_baozhang', 'daoda_yipa', 'jingang_zhuo', 'yuncheng_wanli', 'santou_liubi', 'pingtian_handi'].includes(role.skill.skillId)) {
    replayOutcome = 'info';
  }

  recordBrawlReplayAction(g.brawl, {
    roundNumber: currentRoundNumber,
    mission: g.mission,
    phase: actionPhase,
    actorId: userId,
    actorSeat: actorP?.seat ?? 0,
    actorNickname: actorP?.nickname ?? role.name,
    roleId: role.id,
    roleName: role.name,
    skillName: role.skill.skillName,
    targetId: targetPlayer?.id,
    targetSeat: targetPlayer?.seat,
    targetNickname: targetPlayer?.nickname,
    outcome: replayOutcome,
    detail: replayDetail,
  });

  return { shouldCheckTeamVoteComplete };
}

export function resolveMissionSkillEffects(
  g: GameState,
  round: RoundView,
  missionVotes: Record<string, boolean>,
  initialFailures: number,
  initialSuccesses: number,
): { failures: number; successes: number; passed: boolean } {
  let failures = initialFailures;
  let successes = initialSuccesses;
  if (!g.brawl) {
    const required = failuresRequired(g);
    return { failures, successes, passed: failures < required };
  }
  const brawl = g.brawl;
  const secrets = ensureBrawlSecrets(brawl);

  // 金角大王【紫金葫芦】
  if (secrets.jinjiaoHuluTargetId) {
    const targetId = secrets.jinjiaoHuluTargetId;
    const targetP = g.players.find(p => p.id === targetId);
    const jinjiaoPlayer = g.players.find(p => hasBrawlSkillRole(brawl?.playerStates?.[p.id], 'jinjiao_dawang'));

    if (!round.team.includes(targetId)) {
      if (targetP) {
        secrets.jinjiaoResult = {
          targetSeat: targetP.seat,
          targetNickname: targetP.nickname,
          absorbed: false,
          notOnTeam: true,
        };
      }
      recordBrawlReplayAction(brawl, {
        roundNumber: round.number,
        mission: g.mission,
        phase: 'mission_resolved',
        actorId: jinjiaoPlayer?.id ?? '',
        actorSeat: jinjiaoPlayer?.seat ?? 0,
        actorNickname: jinjiaoPlayer?.nickname ?? '金角大王',
        roleId: 'jinjiao_dawang',
        roleName: '金角大王',
        skillName: '紫金葫芦',
        targetId: targetP?.id,
        targetSeat: targetP?.seat,
        targetNickname: targetP?.nickname,
        outcome: 'miss',
        detail: `所选目标【${targetP?.seat}号 · ${targetP?.nickname}】未随队出征，紫金红葫芦吸空未能生效。`,
      });
    } else {
      const targetVotedSuccess = missionVotes[targetId];
      const absorbed = targetVotedSuccess && Math.random() < BRAWL_SKILL_PROBS.JINJIAO_ABSORB;
      if (absorbed) {
        failures += 1;
        successes = Math.max(0, successes - 1);
        appendBattleEvent(
          brawl,
          'jinjiao_dawang',
          '【金角大王】紫金红葫芦灵光大盛！出征队伍中 1 名仙友的浩然正气被宝葫芦暗中化解吸收！',
          '手机私密选定出征队员 1 人，若其投成功，60% 概率被葫芦化解吸收。',
        );
      }
      if (targetP) {
        secrets.jinjiaoResult = {
          targetSeat: targetP.seat,
          targetNickname: targetP.nickname,
          absorbed: Boolean(absorbed),
        };
      }
      recordBrawlReplayAction(brawl, {
        roundNumber: round.number,
        mission: g.mission,
        phase: 'mission_resolved',
        actorId: jinjiaoPlayer?.id ?? '',
        actorSeat: jinjiaoPlayer?.seat ?? 0,
        actorNickname: jinjiaoPlayer?.nickname ?? '金角大王',
        roleId: 'jinjiao_dawang',
        roleName: '金角大王',
        skillName: '紫金葫芦',
        targetId: targetP?.id,
        targetSeat: targetP?.seat,
        targetNickname: targetP?.nickname,
        outcome: absorbed ? 'success' : 'miss',
        detail: absorbed
          ? `紫金红葫芦神威显圣（60% 概率命中）：暗中化解吸收了【${targetP?.seat}号 · ${targetP?.nickname}】投出的 1 张成功牌！`
          : (targetVotedSuccess
            ? `紫金红葫芦判定未命中（60% 概率未生效）：未能化解【${targetP?.seat}号 · ${targetP?.nickname}】的成功牌。`
            : `所选目标【${targetP?.seat}号 · ${targetP?.nickname}】未投出成功牌，紫金红葫芦未能化解吸收。`),
      });
    }
    secrets.jinjiaoHuluTargetId = undefined;
  }

  // 玉兔精【捣药迷魂】
  if (secrets.yutuMihunTargetId) {
    const targetId = secrets.yutuMihunTargetId;
    const targetP = g.players.find(p => p.id === targetId);
    const yutuPlayer = g.players.find(p => hasBrawlSkillRole(brawl?.playerStates?.[p.id], 'yutu_jing'));

    if (!round.team.includes(targetId)) {
      if (targetP) {
        secrets.yutuResult = {
          targetSeat: targetP.seat,
          targetNickname: targetP.nickname,
          discarded: false,
          notOnTeam: true,
        };
      }
      recordBrawlReplayAction(brawl, {
        roundNumber: round.number,
        mission: g.mission,
        phase: 'mission_resolved',
        actorId: yutuPlayer?.id ?? '',
        actorSeat: yutuPlayer?.seat ?? 0,
        actorNickname: yutuPlayer?.nickname ?? '玉兔精',
        roleId: 'yutu_jing',
        roleName: '玉兔精',
        skillName: '捣药迷魂',
        targetId: targetP?.id,
        targetSeat: targetP?.seat,
        targetNickname: targetP?.nickname,
        outcome: 'miss',
        detail: `所选目标【${targetP?.seat}号 · ${targetP?.nickname}】未随队出征，捣药迷魂未能生效。`,
      });
    } else {
      const targetVotedSuccess = missionVotes[targetId];
      const discarded = targetVotedSuccess && Math.random() < BRAWL_SKILL_PROBS.YUTU_DISCARD;
      if (discarded) {
        failures += 1;
        successes = Math.max(0, successes - 1);
        appendBattleEvent(
          brawl,
          'yutu_jing',
          '【玉兔精】广寒仙药捣药迷魂！出征队伍中受迷香干扰，1 名仙友的成功神力被封印化解！',
          '队伍敲定后暗中迷魂车上 1 名好人，其出征时 50% 概率成功牌被封印弃权。',
        );
      }
      if (targetP) {
        secrets.yutuResult = {
          targetSeat: targetP.seat,
          targetNickname: targetP.nickname,
          discarded: Boolean(discarded),
        };
      }
      recordBrawlReplayAction(brawl, {
        roundNumber: round.number,
        mission: g.mission,
        phase: 'mission_resolved',
        actorId: yutuPlayer?.id ?? '',
        actorSeat: yutuPlayer?.seat ?? 0,
        actorNickname: yutuPlayer?.nickname ?? '玉兔精',
        roleId: 'yutu_jing',
        roleName: '玉兔精',
        skillName: '捣药迷魂',
        targetId: targetP?.id,
        targetSeat: targetP?.seat,
        targetNickname: targetP?.nickname,
        outcome: discarded ? 'success' : 'miss',
        detail: discarded
          ? `捣药迷魂生效（50% 概率命中）：迷魂封印了【${targetP?.seat}号 · ${targetP?.nickname}】投出的成功牌（强制弃权作废）！`
          : (targetVotedSuccess
            ? `捣药迷魂判定未命中（50% 概率未生效）：未能迷魂封印【${targetP?.seat}号 · ${targetP?.nickname}】。`
            : `所选目标【${targetP?.seat}号 · ${targetP?.nickname}】未投出成功牌，捣药迷魂未能封印。`),
      });
    }
    secrets.yutuMihunTargetId = undefined;
  }

  // 百眼魔君【黄花毒茶】
  if (secrets.baiyanDuchaTargetId) {
    const targetId = secrets.baiyanDuchaTargetId;
    const targetP = g.players.find(p => p.id === targetId);
    const baiyanPlayer = g.players.find(p => hasBrawlSkillRole(brawl?.playerStates?.[p.id], 'baiyan_mojun'));

    if (!round.team.includes(targetId)) {
      secrets.baiyanDuchaResult = false;
      secrets.baiyanDuchaNotOnTeam = true;
      recordBrawlReplayAction(brawl, {
        roundNumber: round.number,
        mission: g.mission,
        phase: 'mission_resolved',
        actorId: baiyanPlayer?.id ?? '',
        actorSeat: baiyanPlayer?.seat ?? 0,
        actorNickname: baiyanPlayer?.nickname ?? '百眼魔君',
        roleId: 'baiyan_mojun',
        roleName: '百眼魔君',
        skillName: '黄花毒茶',
        targetId: targetP?.id,
        targetSeat: targetP?.seat,
        targetNickname: targetP?.nickname,
        outcome: 'miss',
        detail: `下毒目标【${targetP?.seat}号 · ${targetP?.nickname}】未随队出征，黄花毒茶未能生效。`,
      });
    } else {
      const targetVotedSuccess = missionVotes[targetId];
      const isBig = round.team.length >= 4;
      const chance = isBig ? BRAWL_SKILL_PROBS.BAIYAN_BIG_TEAM : BRAWL_SKILL_PROBS.BAIYAN_SMALL_TEAM;
      const poisoned = targetVotedSuccess && Math.random() < chance;
      if (poisoned) {
        failures += 1;
        successes = Math.max(0, successes - 1);
        secrets.baiyanDuchaResult = true;
      } else {
        secrets.baiyanDuchaResult = false;
      }
      recordBrawlReplayAction(brawl, {
        roundNumber: round.number,
        mission: g.mission,
        phase: 'mission_resolved',
        actorId: baiyanPlayer?.id ?? '',
        actorSeat: baiyanPlayer?.seat ?? 0,
        actorNickname: baiyanPlayer?.nickname ?? '百眼魔君',
        roleId: 'baiyan_mojun',
        roleName: '百眼魔君',
        skillName: '黄花毒茶',
        targetId: targetP?.id,
        targetSeat: targetP?.seat,
        targetNickname: targetP?.nickname,
        outcome: poisoned ? 'success' : 'miss',
        detail: poisoned
          ? `黄花毒茶毒发成功（${isBig ? '大车 60%' : '小车 50%'} 概率命中）：暗中将【${targetP?.seat}号 · ${targetP?.nickname}】投出的【成功牌】静默毒化为【失败牌】！导致本轮出征翻车！`
          : (targetVotedSuccess
            ? `黄花毒茶未能毒发（${isBig ? '大车 60%' : '小车 50%'} 概率未命中）：【${targetP?.seat}号 · ${targetP?.nickname}】未受毒化影响。`
            : `下毒目标【${targetP?.seat}号 · ${targetP?.nickname}】未投出成功牌，黄花毒茶未生效。`),
      });
    }
    secrets.baiyanDuchaTargetId = undefined;
  }

  // 白骨精【画皮离间】
  if (secrets.baiguLijianArmed) {
    secrets.baiguLijianArmed = false;
    const baiguPlayer = g.players.find(p => hasBrawlSkillRole(brawl?.playerStates?.[p.id], 'bai_gujing'));
    if (failures > 0) {
      failures += 1;
      successes = Math.max(0, successes - 1);
      secrets.baiguLijianResult = true;
      setBrawlPrivateReceipt(
        brawl,
        baiguPlayer?.id,
        `💀 第 ${g.mission} 难画皮离间得逞：战报已静默虚增 1 张失败牌（实 ${failures - 1} 败 → 显 ${failures} 败）！`,
      );
      recordBrawlReplayAction(brawl, {
        roundNumber: round.number,
        mission: g.mission,
        phase: 'mission_resolved',
        actorId: baiguPlayer?.id ?? '',
        actorSeat: baiguPlayer?.seat ?? 0,
        actorNickname: baiguPlayer?.nickname ?? '白骨精',
        roleId: 'bai_gujing',
        roleName: '白骨精',
        skillName: '画皮离间',
        outcome: 'success',
        detail: `画皮离间魔功得逞：出征战报静默虚增 1 张失败牌（实际失败牌数 ${failures - 1}，虚增后展示为 ${failures} 张），成功引车内好人同室操戈！`,
      });
    } else {
      setBrawlPrivateReceipt(
        brawl,
        baiguPlayer?.id,
        `💀 第 ${g.mission} 难全员投出成功牌，离间魔骨无失败牌可借势，本次未能触发虚增。`,
      );
      recordBrawlReplayAction(brawl, {
        roundNumber: round.number,
        mission: g.mission,
        phase: 'mission_resolved',
        actorId: baiguPlayer?.id ?? '',
        actorSeat: baiguPlayer?.seat ?? 0,
        actorNickname: baiguPlayer?.nickname ?? '白骨精',
        roleId: 'bai_gujing',
        roleName: '白骨精',
        skillName: '画皮离间',
        outcome: 'miss',
        detail: '本难出征全员投出成功牌（0 张失败牌），离间魔骨未能借势虚增。',
      });
    }
  }

  // 王母娘娘【九转仙桃】
  if (brawl.taoshouActive) {
    brawl.taoshouActive = false;
    const wangmuPlayer = g.players.find(p => hasBrawlSkillRole(brawl?.playerStates?.[p.id], 'wangmu_niangniang'));
    if (failures > 0) {
      const taoSuccess = Math.random() < BRAWL_SKILL_PROBS.WANGMU_PARDON;
      if (taoSuccess) {
        failures = Math.max(0, failures - 1);
        successes = round.team.length - failures;
        appendBattleEvent(
          brawl,
          'wangmu_niangniang',
          '【王母娘娘】瑶池九转仙桃神力显圣！仙桃延寿护体，当场化解吸收了队伍中的 1 张失败牌！',
          '出征前赐九转仙桃护体：本轮任务若出现失败牌，仙桃有 50% 概率当场化解赦免 1 张失败牌！',
        );
      } else {
        appendBattleEvent(
          brawl,
          'wangmu_niangniang',
          '【王母娘娘】九转仙桃护体，劫数深重未能抵消失败牌。',
          '出征前赐九转仙桃护体：本轮任务若出现失败牌，仙桃有 50% 概率当场化解赦免 1 张失败牌！',
        );
      }
      setBrawlPrivateReceipt(
        brawl,
        wangmuPlayer?.id,
        taoSuccess
          ? `🍑 第 ${g.mission} 难九转仙桃显圣（50% 命中）：已当场化解赦免 1 张失败牌！`
          : `🍑 第 ${g.mission} 难九转仙桃触发（50% 未命中）：未能抵消队伍中的失败牌。`,
      );
      recordBrawlReplayAction(brawl, {
        roundNumber: round.number,
        mission: g.mission,
        phase: 'mission_resolved',
        actorId: wangmuPlayer?.id ?? '',
        actorSeat: wangmuPlayer?.seat ?? 0,
        actorNickname: wangmuPlayer?.nickname ?? '王母娘娘',
        roleId: 'wangmu_niangniang',
        roleName: '王母娘娘',
        skillName: '九转仙桃',
        outcome: taoSuccess ? 'success' : 'miss',
        detail: taoSuccess
          ? '九转仙桃仙气护体（50% 概率命中）：出征战报当场化解赦免了队伍中的 1 张失败牌！'
          : '九转仙桃护体判定未命中（50% 概率）：劫数深重未能抵消失败牌。',
      });
    } else {
      setBrawlPrivateReceipt(
        brawl,
        wangmuPlayer?.id,
        `🍑 第 ${g.mission} 难全员投出成功牌，九转仙桃平安护体无需化解失败牌。`,
      );
      recordBrawlReplayAction(brawl, {
        roundNumber: round.number,
        mission: g.mission,
        phase: 'mission_resolved',
        actorId: wangmuPlayer?.id ?? '',
        actorSeat: wangmuPlayer?.seat ?? 0,
        actorNickname: wangmuPlayer?.nickname ?? '王母娘娘',
        roleId: 'wangmu_niangniang',
        roleName: '王母娘娘',
        skillName: '九转仙桃',
        outcome: 'miss',
        detail: '本难出征全员投出成功牌（0 张失败牌），九转仙桃护体未遇败牌无需触发。',
      });
    }
  }

  let passed = failures < failuresRequired(g);

  // 玉皇大帝【天尊玉旨】
  if (!passed && failures > 0 && brawl.yuhuangYuzhiArmed) {
    brawl.yuhuangYuzhiArmed = false;
    const failuresBefore = failures;
    const pardonChance = failures === 1 ? BRAWL_SKILL_PROBS.YUHUANG_ONE_FAIL : (failures === 2 ? BRAWL_SKILL_PROBS.YUHUANG_TWO_FAIL : 0);
    const yuhuangSuccess = pardonChance > 0 && Math.random() < pardonChance;
    const yuhuangPlayer = g.players.find(p => hasBrawlSkillRole(brawl?.playerStates?.[p.id], 'yuhuang_dadi'));
    if (yuhuangSuccess) {
      passed = true;
      failures = 0;
      successes = round.team.length;
      appendBattleEvent(
        brawl,
        'yuhuang_dadi',
        '【玉皇大帝】昊天金阙降下天尊玉旨！三界至尊金口御言赦免此难劫数，任务绝境逆转为大获全胜！',
        '任一轮任务失败时降旨赦免（若为 1 败则 60% 概率逆转为胜，若为 2 败则 30% 概率逆转为胜）！',
      );
    } else {
      appendBattleEvent(
        brawl,
        'yuhuang_dadi',
        '【玉皇大帝】天尊降旨，群魔势大劫数难消，未能化解此次失败。',
        '任一轮任务失败时降旨赦免（若为 1 败则 60% 概率逆转为胜，若为 2 败则 30% 概率逆转为胜）！',
      );
    }
    setBrawlPrivateReceipt(
      brawl,
      yuhuangPlayer?.id,
      yuhuangSuccess
        ? `📜 第 ${g.mission} 难天尊玉旨显圣（${failuresBefore}败 · ${Math.round(pardonChance * 100)}%命中）：已将本次溃败绝境逆转为大获全胜！`
        : `📜 第 ${g.mission} 难天尊玉旨触发（${failuresBefore}败 · ${Math.round(pardonChance * 100)}%概率未命中）：未能化解此次失败。`,
    );
    recordBrawlReplayAction(brawl, {
      roundNumber: round.number,
      mission: g.mission,
      phase: 'mission_resolved',
      actorId: yuhuangPlayer?.id ?? '',
      actorSeat: yuhuangPlayer?.seat ?? 0,
      actorNickname: yuhuangPlayer?.nickname ?? '玉皇大帝',
      roleId: 'yuhuang_dadi',
      roleName: '玉皇大帝',
      skillName: '天尊玉旨',
      outcome: yuhuangSuccess ? 'success' : 'miss',
      detail: yuhuangSuccess
        ? `天尊降旨赦免此难劫数（${failuresBefore}败 · ${Math.round(pardonChance * 100)}%命中）：三界至尊金口御言，将本次出征溃败绝境逆转为【大获全胜】！`
        : `天尊降旨（${failuresBefore}败 · ${Math.round(pardonChance * 100)}%未命中）：群妖势大劫数难消，未能化解此次失败。`,
    });
  }

  // 观音菩萨【净瓶甘露】
  if (secrets.guanyinGanluTargetId) {
    const targetId = secrets.guanyinGanluTargetId;
    const targetP = g.players.find(p => p.id === targetId);
    const guanyinPlayer = g.players.find(p => hasBrawlSkillRole(brawl?.playerStates?.[p.id], 'guanyin_pusa'));
    if (round.team.includes(targetId)) {
      const targetVote = missionVotes[targetId];
      secrets.guanyinGanluResult = {
        targetId,
        targetSuccess: Boolean(targetVote),
      };
      setBrawlPrivateReceipt(
        brawl,
        guanyinPlayer?.id,
        `🪷 第 ${g.mission} 难净瓶甘露显圣：目标【${targetP?.seat}号 · ${targetP?.nickname}】真实投出了【${targetVote ? '成功牌 🟢' : '失败牌 🔴'}】！`,
      );
      recordBrawlReplayAction(brawl, {
        roundNumber: round.number,
        mission: g.mission,
        phase: 'mission_resolved',
        actorId: guanyinPlayer?.id ?? '',
        actorSeat: guanyinPlayer?.seat ?? 0,
        actorNickname: guanyinPlayer?.nickname ?? '观音菩萨',
        roleId: 'guanyin_pusa',
        roleName: '观音菩萨',
        skillName: '净瓶甘露',
        targetId: targetP?.id,
        targetSeat: targetP?.seat,
        targetNickname: targetP?.nickname,
        outcome: 'info',
        detail: `净瓶甘露显圣：私密验看【${targetP?.seat}号 · ${targetP?.nickname}】票底为【${targetVote ? '成功牌 🟢' : '失败牌 🔴'}】！`,
      });
    } else {
      secrets.guanyinGanluNotOnTeam = targetId;
      setBrawlPrivateReceipt(
        brawl,
        guanyinPlayer?.id,
        `🪷 第 ${g.mission} 难净瓶甘露未能显圣：选定目标【${targetP?.seat}号 · ${targetP?.nickname}】未随队出征，甘露未被饮用。`,
      );
      recordBrawlReplayAction(brawl, {
        roundNumber: round.number,
        mission: g.mission,
        phase: 'mission_resolved',
        actorId: guanyinPlayer?.id ?? '',
        actorSeat: guanyinPlayer?.seat ?? 0,
        actorNickname: guanyinPlayer?.nickname ?? '观音菩萨',
        roleId: 'guanyin_pusa',
        roleName: '观音菩萨',
        skillName: '净瓶甘露',
        targetId: targetP?.id,
        targetSeat: targetP?.seat,
        targetNickname: targetP?.nickname,
        outcome: 'miss',
        detail: `所选目标【${targetP?.seat}号 · ${targetP?.nickname}】未随队出征，净瓶甘露未能显圣。`,
      });
    }
    secrets.guanyinGanluTargetId = undefined;
  }

  return { failures, successes, passed };
}
