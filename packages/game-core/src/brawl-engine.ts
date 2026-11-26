import type {
  BrawlGameState,
  BrawlPlayerState,
  BrawlBattleEvent,
  BrawlEventVisibility,
  BrawlReplayAction,
  BrawlRoleDef,
  BrawlSecretState,
  BrawlSkillControlState,
  BrawlPeekedRole,
  SelfBrawlView,
} from '@avalon/contracts';
import { BRAWL_ROLE_REGISTRY, BRAWL_SKILL_PROBS, sampleWithoutReplacement } from './brawl-registry.js';

/**
 * 显性公法不公人战报白名单：
 * 局中允许匿名播报“哪位神魔发动了何种显性法宝/发生了何种劫数”，绝不泄露玩家座位与昵称；
 * 其余暗算、毒茶、栽赃、私密查验等静默技能严格仅存终局复盘，零剧透。
 */
export const PUBLIC_BROADCAST_ROLE_IDS = new Set([
  'rulai_fozu',
  'zhizhu_jing',
  'qingmao_shizi',
  'bai_longma',
  'zhenyuan_daxian',
  'wangmu_niangniang',
  'yuhuang_dadi',
  'taishang_laojun',
  'sha_wujing',
  'zhu_bajie',
  'nezha',
  'niu_mowang',
  'yinjiao_dawang',
  'ordeal_system',
  'wager_system',
]);

export function ensureBrawlSecrets(state: BrawlGameState): BrawlSecretState {
  if (!state.secrets) {
    state.secrets = { privateReceipts: {} };
  }
  if (!state.secrets.privateReceipts) {
    state.secrets.privateReceipts = {};
  }
  return state.secrets;
}

/**
 * 获取玩家当前可发动主动技能所对应的角色定义（若 5~8 人局核心配发了副法宝，则返回副法宝来源角色）
 */
export function getEffectiveSkillRole(ps: BrawlPlayerState | undefined): BrawlRoleDef | undefined {
  if (!ps) return undefined;
  return BRAWL_ROLE_REGISTRY[ps.bonusRoleId ?? ps.roleId];
}

/**
 * 判断玩家自身身份或 5~8 人局附加副法宝是否包含指定角色技能
 */
export function hasBrawlSkillRole(ps: BrawlPlayerState | undefined, roleId: string): boolean {
  return Boolean(ps && (ps.roleId === roleId || ps.bonusRoleId === roleId));
}

/**
 * 5~8 人局乱斗提纯：为 4 名固定核心（孙悟空、唐三藏、红孩儿、六耳猕猴）
 * 从本局未出场的同阵营主动乱斗池中各无放回配发 1 个兼容副法宝，消除小局白板感。
 */
export function assignCoreBonusSkills(
  playerStates: Record<string, BrawlPlayerState>,
  rng: () => number = Math.random,
): Array<{ userId: string; coreRoleId: string; bonusRoleId: string }> {
  const assignedIds = new Set(Object.values(playerStates).map(ps => ps.roleId));
  const blueCores = Object.values(playerStates).filter(ps => ps.roleId === 'sun_wukong' || ps.roleId === 'tang_seng');
  const redCores = Object.values(playerStates).filter(ps => ps.roleId === 'hong_haier' || ps.roleId === 'liuer_mihou');

  const blueCandidates = Object.values(BRAWL_ROLE_REGISTRY).filter(
    r => r.camp === 'blue' && !r.isCore && r.skill.actionType !== 'passive' && !assignedIds.has(r.id),
  );
  // 排除牛魔王（孤狼描述会与固定核心互认语义冲突）
  const redCandidates = Object.values(BRAWL_ROLE_REGISTRY).filter(
    r => r.camp === 'red' && !r.isCore && r.skill.actionType !== 'passive' && r.id !== 'niu_mowang' && !assignedIds.has(r.id),
  );

  const pickedBlue = sampleWithoutReplacement(blueCandidates, Math.min(blueCores.length, blueCandidates.length), rng);
  const pickedRed = sampleWithoutReplacement(redCandidates, Math.min(redCores.length, redCandidates.length), rng);

  const grants: Array<{ userId: string; coreRoleId: string; bonusRoleId: string }> = [];
  blueCores.forEach((ps, idx) => {
    const bonus = pickedBlue[idx];
    if (bonus) {
      ps.bonusRoleId = bonus.id;
      grants.push({ userId: ps.userId, coreRoleId: ps.roleId, bonusRoleId: bonus.id });
    }
  });
  redCores.forEach((ps, idx) => {
    const bonus = pickedRed[idx];
    if (bonus) {
      ps.bonusRoleId = bonus.id;
      grants.push({ userId: ps.userId, coreRoleId: ps.roleId, bonusRoleId: bonus.id });
    }
  });
  return grants;
}

/**
 * 创建纯大乱斗初始状态（公开态与 secrets 私密容器结构化隔离）
 */
export function createBrawlGameState(
  playerStates: Record<string, BrawlPlayerState>,
  bluePoolRoles: string[],
  redPoolRoles: string[],
): BrawlGameState {
  return {
    enabled: true,
    blindBox: {
      bluePoolRoles,
      redPoolRoles,
    },
    playerStates,
    events: [],
    replayTimeline: [],
    secrets: {
      privateReceipts: {},
    },
    imprisonedTargetId: undefined,
    zhizhuBannedTargetId: undefined,
    qingshiTuntianTargetId: undefined,
    extraSeatLimit: 0,
    laojunZhuoActive: false,
    doubleVoteUserId: undefined,
    yishanTargetId: undefined,
    taoshouActive: false,
    yuhuangYuzhiArmed: false,
    shawujingBaozhangArmed: false,
    zhubajieDaodaArmed: false,
  };
}

/**
 * 生成全场天机战报（公法不公人：严格不透露玩家座位和用户ID）
 */
export function appendBattleEvent(
  state: BrawlGameState,
  roleId: string,
  summary: string,
  description?: string,
  visibility?: BrawlEventVisibility,
): BrawlBattleEvent {
  const role = BRAWL_ROLE_REGISTRY[roleId];
  const systemRoleNames: Record<string, { roleName: string; skillName: string }> = {
    ordeal_system: { roleName: '八十一难奇劫', skillName: '天道法则' },
    wager_system: { roleName: '取经军令状', skillName: '领队担保' },
  };
  const sysMeta = systemRoleNames[roleId];
  const roleName = role ? role.name : (sysMeta?.roleName ?? roleId);
  const skillName = role ? role.skill.skillName : (sysMeta?.skillName ?? '独门法宝');
  const resolvedVisibility: BrawlEventVisibility =
    visibility ?? (PUBLIC_BROADCAST_ROLE_IDS.has(roleId) ? 'anonymous_broadcast' : 'silent');
  const event: BrawlBattleEvent = {
    id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    roleId,
    roleName,
    skillName,
    summary,
    description: description || role?.skill.description,
    visibility: resolvedVisibility,
    timestamp: new Date().toISOString(),
  };
  state.events.push(event);
  return event;
}

/**
 * 记录全景对局复盘动作（服务端权威留存，终局胜负已定时全盘揭晓）
 */
export function recordBrawlReplayAction(
  state: BrawlGameState,
  action: Omit<BrawlReplayAction, 'id' | 'timestamp'>,
): BrawlReplayAction {
  if (!state.replayTimeline) {
    state.replayTimeline = [];
  }
  const entry: BrawlReplayAction = {
    ...action,
    id: `replay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  state.replayTimeline.push(entry);
  return entry;
}

/**
 * 记录某位玩家的法宝施展/结算私密永久回执（存入 secrets 容器，局中仅投影给本人）
 */
export function setBrawlPrivateReceipt(state: BrawlGameState, userId: string | undefined, text: string): void {
  if (!userId) return;
  ensureBrawlSecrets(state).privateReceipts[userId] = text;
}

/**
 * 投影大乱斗公开状态：
 * 对局进行中整块物理剔除 secrets、playerStates、blindBox、replayTimeline，
 * 从数据结构上杜绝抓包看底牌或漏写单个 delete 导致的信息泄露；
 * 终局揭晓（isEnded 为 true）时完整解密下发。
 */
export function projectBrawlGameState(
  brawl: BrawlGameState,
  isEnded: boolean,
): BrawlGameState {
  if (isEnded) {
    return structuredClone(brawl);
  }
  const sanitized = structuredClone(brawl);
  delete sanitized.secrets;
  delete sanitized.playerStates;
  delete sanitized.blindBox;
  delete sanitized.replayTimeline;
  sanitized.events = sanitized.events.filter(ev => ev.visibility === 'anonymous_broadcast');

  if (sanitized.ordeals) {
    sanitized.ordeals.deck = sanitized.ordeals.currentOrdealId ? [sanitized.ordeals.currentOrdealId] : [];
    delete sanitized.ordeals.shituoExcludedPlayerId;
  }
  if (sanitized.wager) {
    delete sanitized.wager.inspectResult;
  }

  return sanitized;
}

/**
 * 任务出牌合法性校验（蓝方仙友只能出成功）
 */
export function validateBrawlMissionVote(
  state: BrawlGameState,
  userId: string,
  _mission: number,
  success: boolean,
): { valid: boolean; error?: string } {
  const player = state.playerStates?.[userId];
  if (!player) return { valid: true };

  if (player.camp === 'blue' && !success) {
    return {
      valid: false,
      error: 'BLUE_CANNOT_FAIL: 蓝方仙友只能出成功牌',
    };
  }
  return { valid: true };
}

export function isPlayerImprisoned(state: BrawlGameState, playerId: string): boolean {
  return state.imprisonedTargetId === playerId;
}

/**
 * 重置单难生效的临时技能状态（绝不清空 secrets 中的永久私密回执与查验结果）
 */
export function resetRoundBrawlEffects(state: BrawlGameState): void {
  state.imprisonedTargetId = undefined;
  state.zhizhuBannedTargetId = undefined;
  state.qingshiTuntianTargetId = undefined;
  state.extraSeatLimit = 0;
  state.doubleVoteUserId = undefined;
  state.yishanTargetId = undefined;
  state.taoshouActive = false;

  const secrets = ensureBrawlSecrets(state);
  secrets.guanyinGanluTargetId = undefined;
  secrets.jinjiaoHuluTargetId = undefined;
  secrets.yutuMihunTargetId = undefined;
  secrets.baiyanDuchaTargetId = undefined;
  secrets.baiguLijianArmed = false;
}

/**
 * 生成玩家个人的乱斗私密视图（由服务端统一投影所有私密结果与技能控制态）
 */
export function projectSelfBrawlView(
  state: BrawlGameState,
  userId: string,
  _mission: number,
  peekedMapOverride?: Record<string, BrawlPeekedRole[]>,
  players: { id: string; seat: number; nickname: string }[] = [],
  skillControl?: BrawlSkillControlState,
): SelfBrawlView | undefined {
  const playerState = state.playerStates?.[userId];
  if (!playerState) return undefined;

  const roleDef = BRAWL_ROLE_REGISTRY[playerState.roleId];
  if (!roleDef) return undefined;

  const bonusRoleDef = playerState.bonusRoleId ? BRAWL_ROLE_REGISTRY[playerState.bonusRoleId] : undefined;
  const effectiveRoleDef = bonusRoleDef ?? roleDef;
  const effectiveRoleId = effectiveRoleDef.id;
  const secrets = state.secrets;
  const peekedMap = peekedMapOverride ?? secrets?.peekedMap ?? {};

  const isLiTianwang = hasBrawlSkillRole(playerState, 'li_tianwang');
  const isGuanyin = hasBrawlSkillRole(playerState, 'guanyin_pusa');
  const isAssassinOrDapeng = playerState.roleId === 'hong_haier' || hasBrawlSkillRole(playerState, 'jinchi_dapeng');

  let guanyinNoticeResult: { targetSeat: number; targetNickname: string; success: boolean } | undefined;
  let guanyinStatusText: string | undefined;
  if (isGuanyin) {
    if (secrets?.guanyinGanluResult) {
      const targetPlayer = players.find(p => p.id === secrets.guanyinGanluResult?.targetId);
      if (targetPlayer) {
        guanyinNoticeResult = {
          targetSeat: targetPlayer.seat,
          targetNickname: targetPlayer.nickname,
          success: secrets.guanyinGanluResult.targetSuccess,
        };
        guanyinStatusText = `🪷 净瓶甘露探照天机：目标【${targetPlayer.seat}号 · ${targetPlayer.nickname}】在本次出征中投出了【${secrets.guanyinGanluResult.targetSuccess ? '成功牌 🟢' : '失败牌 🔴'}】！`;
      }
    } else if (secrets?.guanyinGanluNotOnTeam) {
      const notOnTeamPlayer = players.find(p => p.id === secrets.guanyinGanluNotOnTeam);
      guanyinStatusText = notOnTeamPlayer
        ? `🪷 净瓶甘露未能显圣：选定目标【${notOnTeamPlayer.seat}号 · ${notOnTeamPlayer.nickname}】未随队出征，甘露未被饮用。`
        : '🪷 净瓶甘露未能显圣：选定目标未随队出征。';
    } else if (secrets?.guanyinGanluTargetId) {
      const markedP = players.find(p => p.id === secrets.guanyinGanluTargetId);
      guanyinStatusText = markedP
        ? `🪷 净瓶甘露已洒向【${markedP.seat}号 · ${markedP.nickname}】：待其随队出征归来，将私密显圣验其票底！`
        : '🪷 净瓶甘露已洒向出征队员，待出征结算显圣...';
    }
  }

  const dianhuaNotices: string[] = [];
  if (secrets?.putiDianhuaNotice?.targetBlueUserId === userId) {
    dianhuaNotices.push(`🔮 菩提祖师道法点化真传：天机暗授，场上潜伏群妖之一的真名为【${secrets.putiDianhuaNotice.redRoleName}】！`);
  }
  if (secrets?.huangmeiDianhuaNotice?.targetBlueUserId === userId) {
    dianhuaNotices.push(`🔮 菩提祖师道法点化真传：天机暗授，暗查【${secrets.huangmeiDianhuaNotice.targetSeat}号 · ${secrets.huangmeiDianhuaNotice.targetNickname}】身上妖氛缠绕！`);
  }
  const dianhuaNoticeText: string | undefined = dianhuaNotices.length > 0 ? dianhuaNotices.join('\n') : undefined;

  let huangmeiNotice: string | undefined;
  if (hasBrawlSkillRole(playerState, 'huangmei_laoguai') && secrets?.huangmeiDianhuaNotice) {
    huangmeiNotice = `🪷 假设雷音佛音已发：已假借菩提祖师真传之名，将【${secrets.huangmeiDianhuaNotice.targetSeat}号 · ${secrets.huangmeiDianhuaNotice.targetNickname}】是妖魔的假天机私密投递给了 1 名蓝方仙友！`;
  }

  let baiguLijianStatus: string | undefined;
  if (hasBrawlSkillRole(playerState, 'bai_gujing')) {
    if (secrets?.baiguLijianResult) {
      baiguLijianStatus = '💀 离间魔功已得逞：本轮出征战报已静默虚增 1 张失败牌，好人同乘已自相猜忌！';
    } else if (secrets?.baiguLijianArmed) {
      baiguLijianStatus = '💀 离间魔骨已就绪：本轮任务出征若出现失败牌，将静默虚增 1 败制造冤案！';
    }
  }

  let baiyanDuchaStatus: string | undefined;
  if (hasBrawlSkillRole(playerState, 'baiyan_mojun')) {
    if (secrets?.baiyanDuchaResult === true) {
      baiyanDuchaStatus = '🍵 黄花毒茶毒发：目标仙友投出的成功牌已静默被剧毒反转为失败牌！';
    } else if (secrets?.baiyanDuchaNotOnTeam) {
      baiyanDuchaStatus = '🍵 黄花毒茶未能生效：下毒目标未随队出征，毒茶未被饮用。';
    } else if (secrets?.baiyanDuchaResult === false) {
      baiyanDuchaStatus = '🍵 黄花毒茶未奏效：目标仙友浩然正气护体（概率未命中或未投成功）。';
    } else if (secrets?.baiyanDuchaTargetId) {
      baiyanDuchaStatus = '🍵 黄花毒茶已暗中下入出征车队杯中，待出征结算生效...';
    }
  }

  let jinjiaoNotice: string | undefined;
  if (hasBrawlSkillRole(playerState, 'jinjiao_dawang')) {
    const pct = Math.round(BRAWL_SKILL_PROBS.JINJIAO_ABSORB * 100);
    if (secrets?.jinjiaoResult?.absorbed) {
      jinjiaoNotice = `🏺 紫金红葫芦神威显圣（${pct}%概率命中）：已成功将出征队员【${secrets.jinjiaoResult.targetSeat}号 · ${secrets.jinjiaoResult.targetNickname}】投出的 1 张成功牌暗中化解吸收为失败！`;
    } else if (secrets?.jinjiaoResult?.notOnTeam) {
      jinjiaoNotice = `🏺 紫金红葫芦未能生效：锁定的目标【${secrets.jinjiaoResult.targetSeat}号 · ${secrets.jinjiaoResult.targetNickname}】未在出征车队中，葫芦吸空。`;
    } else if (secrets?.jinjiaoResult && !secrets.jinjiaoResult.absorbed) {
      jinjiaoNotice = `🏺 紫金红葫芦未生效：未能化解【${secrets.jinjiaoResult.targetSeat}号 · ${secrets.jinjiaoResult.targetNickname}】（概率未命中或目标未投成功）。`;
    } else if (secrets?.jinjiaoHuluTargetId) {
      jinjiaoNotice = '🏺 紫金红葫芦已对准出征队员暗中备用，待出征结算生效...';
    }
  }

  let yutuNotice: string | undefined;
  if (hasBrawlSkillRole(playerState, 'yutu_jing')) {
    const pct = Math.round(BRAWL_SKILL_PROBS.YUTU_DISCARD * 100);
    if (secrets?.yutuResult?.discarded) {
      yutuNotice = `🐇 广寒仙药捣药迷魂（${pct}%概率命中）：已成功迷魂封印【${secrets.yutuResult.targetSeat}号 · ${secrets.yutuResult.targetNickname}】投出的成功牌（强制弃权作废）！`;
    } else if (secrets?.yutuResult?.notOnTeam) {
      yutuNotice = `🐇 捣药迷魂未能生效：锁定的目标【${secrets.yutuResult.targetSeat}号 · ${secrets.yutuResult.targetNickname}】未在出征车队中，药杵击空。`;
    } else if (secrets?.yutuResult && !secrets.yutuResult.discarded) {
      yutuNotice = `🐇 捣药迷魂未生效：未能迷魂封印【${secrets.yutuResult.targetSeat}号 · ${secrets.yutuResult.targetNickname}】（概率未命中或目标未投成功）。`;
    } else if (secrets?.yutuMihunTargetId) {
      yutuNotice = '🐇 捣药迷香已暗中向出征队员施放，待出征结算生效...';
    }
  }

  let generalFeedback: string | undefined = secrets?.privateReceipts?.[userId];
  if (!generalFeedback && playerState.skillUsed) {
    if (effectiveRoleId === 'rulai_fozu') {
      const imprisonedP = players.find(p => p.id === state.imprisonedTargetId);
      generalFeedback = imprisonedP
        ? `🪷 五行山神威显化：已降下佛法巨掌，将【${imprisonedP.seat}号 · ${imprisonedP.nickname}】镇压于五行山下（本轮禁止随队出征与参与表决）！`
        : '🪷 五行山神威已施展：本轮佛法镇压已生效。';
    } else if (effectiveRoleId === 'yinjiao_dawang') {
      const yishanP = players.find(p => p.id === state.yishanTargetId);
      generalFeedback = yishanP
        ? `⛰️ 移山压顶神威显化：已调遣须弥泰山重压【${yishanP.seat}号 · ${yishanP.nickname}】，其在本次表决中票数将强制按弃权处理！`
        : '⛰️ 移山压顶神威已施展：移山压顶已生效。';
    } else if (effectiveRoleId === 'zhizhu_jing') {
      const bannedP = players.find(p => p.id === state.zhizhuBannedTargetId);
      generalFeedback = bannedP
        ? `🕸️ 盘丝结茧暗施魔功：已布下天罗地网缠缚【${bannedP.seat}号 · ${bannedP.nickname}】，本轮禁止其入队出征！`
        : '🕸️ 盘丝结茧魔功已施展：万千蛛丝封禁已生效。';
    } else if (effectiveRoleId === 'zhenyuan_daxian') {
      generalFeedback = '袖里乾坤混元一掷：已施展无上道法收走争议车队，本轮重新洗牌！';
    } else if (effectiveRoleId === 'nezha' || effectiveRoleId === 'niu_mowang') {
      generalFeedback = state.doubleVoteUserId === userId
        ? '🔥 神力爆发显圣：已成功激活在本次表决中的双倍表决权（投出 2 票）！'
        : '🔥 神力爆发显圣：本命神力已消耗完毕。';
    } else if (effectiveRoleId === 'qingmao_shizi') {
      const bannedP = players.find(p => p.id === state.qingshiTuntianTargetId);
      generalFeedback = bannedP
        ? `🦁 大口吞天神威显化：已张开巨口强行将【${bannedP.seat}号 · ${bannedP.nickname}】吞走剔除出队，本轮禁止其入队！`
        : '🦁 大口吞天神威已施展：已将车上队员吞走剔除出队！';
    } else if (effectiveRoleId === 'puti_zhushi') {
      generalFeedback = secrets?.putiDianhuaNotice
        ? `🔮 道法点化显灵：已将【${secrets.putiDianhuaNotice.redRoleName}】真名密授给 1 位蓝方同修！`
        : '🔮 道法点化已施展（50% 概率未命中，本次未能传信）。';
    } else if (effectiveRoleId === 'yuhuang_dadi') {
      generalFeedback = '📜 天尊玉旨天条已敕：已降下三界至尊御旨，后续出征若溃败将降旨赦免尝试逆转！';
    } else if (effectiveRoleId === 'wangmu_niangniang') {
      generalFeedback = `🍑 瑶池九转仙桃神威：已赐下圣桃仙气护体，本轮出征若出现失败牌有 ${Math.round(BRAWL_SKILL_PROBS.WANGMU_PARDON * 100)}% 概率当场化解赦免 1 败！`;
    } else if (effectiveRoleId === 'bai_longma') {
      generalFeedback = '🐴 龙马负重天马显圣：已激发神足负重潜能，本轮出征车队席位上限已提升 +1！';
    } else if (effectiveRoleId === 'sha_wujing') {
      generalFeedback = '🌊 降妖宝杖定海蓄势：本轮表决若流局，将有 50% 概率强行镇压反转为发车通过！';
    } else if (effectiveRoleId === 'zhu_bajie') {
      generalFeedback = '🌾 倒打一耙暗度陈仓：九齿钉耙神机已蓄势，表决未过时将强制反转 1 张反对票！';
    } else if (effectiveRoleId === 'taishang_laojun') {
      generalFeedback = '⭕ 金刚琢悬空待命：下一次任意妖魔发动主动法宝时，将当场凌空套走收缴！';
    } else if (effectiveRoleId === 'li_tianwang' && secrets?.zhaoyaoResult) {
      generalFeedback = `🪞 照妖宝镜探查完毕：${secrets.zhaoyaoResult.hasDemon ? '车队中【有妖魔潜伏！】' : '车队中【无妖魔，皆是正道仙友！】'}`;
    } else if (effectiveRoleId === 'jinchi_dapeng') {
      generalFeedback = '🦅 云程万里已蓄力待命：进入刺杀阶段将自动为红孩儿排除 1 名非孙悟空席位！';
    }
  }

  let zhaoyaoDetail: string | undefined;
  if (isLiTianwang && secrets?.zhaoyaoResult) {
    const zr = secrets.zhaoyaoResult;
    const teamDesc = zr.teamSummary
      || zr.teamPlayerIds
        .map(id => {
          const tp = players.find(p => p.id === id);
          return tp ? `${tp.seat}号${tp.nickname}` : '';
        })
        .filter(Boolean)
        .join('、');
    const missionPrefix = zr.mission ? `第 ${zr.mission} 难` : '当前';
    zhaoyaoDetail = zr.hasDemon
      ? `🪞 ${missionPrefix}照妖宝镜探查${teamDesc ? `【${teamDesc}】` : '车队'}：【有妖魔潜伏！】`
      : `🪞 ${missionPrefix}照妖宝镜探查${teamDesc ? `【${teamDesc}】` : '车队'}：【无妖魔，皆是正道仙友！】`;
  }

  const huangfengSecret = hasBrawlSkillRole(playerState, 'huangfeng_guai') && secrets?.huangfengSecret
    ? secrets.huangfengSecret
    : undefined;

  const wagerInspectResult = state.wager?.inspectResult?.inspectorId === userId
    ? {
        targetSeat: state.wager.inspectResult.targetSeat,
        targetNickname: state.wager.inspectResult.targetNickname,
        team: state.wager.inspectResult.team,
      }
    : undefined;

  const skillAvailable = !playerState.skillUsed
    && effectiveRoleDef.skill.actionType !== 'passive'
    && effectiveRoleDef.skill.skillId !== 'sanmei_zhenhuo';

  return {
    roleId: playerState.roleId,
    roleName: roleDef.name,
    roleTitle: roleDef.title,
    camp: playerState.camp,
    artPrefix: roleDef.artPrefix,
    motto: roleDef.motto,
    skill: effectiveRoleDef.skill,
    skillAvailable,
    skillUsed: playerState.skillUsed,
    ...(skillControl ? { skillControl } : {}),
    ...(bonusRoleDef ? { bonusRoleId: bonusRoleDef.id, bonusRoleName: bonusRoleDef.name } : {}),
    isAwakened: playerState.isAwakened,
    wishRank: playerState.wishRank,
    peekedRoles: peekedMap[playerState.roleId]?.length ? peekedMap[playerState.roleId] : undefined,
    ...(isLiTianwang && secrets?.zhaoyaoResult ? { zhaoyaoResult: secrets.zhaoyaoResult.hasDemon, ...(zhaoyaoDetail ? { zhaoyaoDetail } : {}) } : {}),
    ...(isAssassinOrDapeng && secrets?.dapengExcludedPlayerId ? { dapengExcludedPlayerId: secrets.dapengExcludedPlayerId } : {}),
    ...(isAssassinOrDapeng && state.ordeals?.shituoExcludedPlayerId ? { shituoExcludedPlayerId: state.ordeals.shituoExcludedPlayerId } : {}),
    ...(playerState.roleId === 'sun_wukong' && secrets?.phantomEvilId ? { phantomVisionActive: true } : {}),
    ...(state.wager?.pendingInspectorId === userId ? { canWagerInspect: true } : {}),
    ...(wagerInspectResult ? { wagerInspectResult } : {}),
    ...(guanyinNoticeResult ? { guanyinGanluResult: guanyinNoticeResult } : {}),
    ...(guanyinStatusText ? { guanyinNotice: guanyinStatusText } : {}),
    ...(dianhuaNoticeText ? { putiDianhuaNotice: dianhuaNoticeText } : {}),
    ...(hasBrawlSkillRole(playerState, 'tieshan_gongzhu') && secrets?.tieshanSecret ? { tieshanSecret: secrets.tieshanSecret } : {}),
    ...(huangfengSecret ? { huangfengSecret } : {}),
    ...(huangmeiNotice ? { huangmeiNotice } : {}),
    ...(baiguLijianStatus ? { baiguLijianStatus } : {}),
    ...(baiyanDuchaStatus ? { baiyanDuchaStatus } : {}),
    ...(jinjiaoNotice ? { jinjiaoNotice } : {}),
    ...(yutuNotice ? { yutuNotice } : {}),
    ...(generalFeedback ? { generalFeedback } : {}),
  };
}
