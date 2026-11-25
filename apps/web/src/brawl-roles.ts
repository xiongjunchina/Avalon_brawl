import type { BrawlRoleDef, BrawlCamp } from '@avalon/contracts';
import { BRAWL_ROLE_REGISTRY, BRAWL_SKILL_PROBS } from '@avalon/game-core';

const pct = (p: number) => `${Math.round(p * 100)}%`;

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

export function getBrawlTacticalTip(roleId: string): string {
  if (BRAWL_TACTICAL_TIPS[roleId]) return BRAWL_TACTICAL_TIPS[roleId];
  const stripped = roleId.replace(/_/g, '').toLowerCase();
  for (const [key, tip] of Object.entries(BRAWL_TACTICAL_TIPS)) {
    if (key.replace(/_/g, '').toLowerCase() === stripped) return tip;
  }
  return '';
}

export const BRAWL_PHASE_NAMES: Record<string, string> = {
  game_start: '开局生效（常驻/私密盲盒视野）',
  team_building: '领队挑人组队阶段',
  team_voting: '队伍公开表决阶段',
  mission_exec: '任务出牌出征阶段',
  mission_resolved: '任务出牌结算阶段',
  assassination: '终局刺杀阶段',
  passive: '常驻被动触发',
};

export const BRAWL_TACTICAL_TIPS: Record<string, string> = {
  sun_wukong: '蓝方核心（全人数必出）。开局火眼金睛识破群妖妖气（看不见黄眉老怪；若开启【画皮惑眼】眼中会混入 1 位无辜蓝方假红气）；5~8 人局额外附带 1 个随机蓝方副法宝；任务三胜后务必隐藏锋芒，防范红孩儿终局刺杀。',
  tang_seng: '蓝方领队（全人数必出）。辨出真假大圣（孙悟空与六耳猕猴）却不知谁真谁假；5~8 人局额外附带 1 个随机蓝方副法宝，需通过挑人试探与发言破绽辨识真猴。',
  rulai_fozu: '强力控场。在挑人或论道阶段祭出五行山掌禁锢嫌疑极大的坏人，使其当轮既不能进队也不能投票，强行粉碎坏人车（受防死锁人数护栏约束）。',
  yuhuang_dadi: `天尊救场（须在出征结算前提前降旨蓄力）。本轮任务若失败将自动降旨赦免（1 败 ${pct(BRAWL_SKILL_PROBS.YUHUANG_ONE_FAIL)} 概率逆转为胜，2 败 ${pct(BRAWL_SKILL_PROBS.YUHUANG_TWO_FAIL)} 概率逆转为胜），关键时刻力挽狂澜。`,
  wangmu_niangniang: `仙桃护体。任意规模车队出征前均可赐桃：本轮任务若出现失败牌，${pct(BRAWL_SKILL_PROBS.WANGMU_PARDON)} 概率当场抵消赦免 1 败，极大降低翻车概率。`,
  taishang_laojun: '法宝克星。提前祭起金刚琢悬空待命，当场上任意妖魔发动主动技能时自动凌空套走收缴使其作废，是红方强力技能的终极梦魇。',
  puti_zhushi: `道法点化（第 2 难起即可发动，全程静默不公屏）。${pct(BRAWL_SKILL_PROBS.PUTI_REVEAL)} 概率让除孙悟空外的 1 名随机蓝方私密得知 1 位在场红方真名，为好人暗中注入铁逻辑。`,
  guanyin_pusa: '甘露辨忠（9 人及以上局必出，全程静默不公屏）。出征前对 1 名队员洒甘露，只要其随队出征，无论任务成败均 100% 私密得知其真实投了成功牌还是失败牌，精准揪出内鬼。',
  zhenyuan_daxian: '大袖乾坤。在挑人、论道或表决阶段大袖一挥收走全队，直接轮换下任队长重选且不增加本难流局计数（不触发两流必发，原车军令状亦一并作废）。',
  erlang_shen: '天眼照虚（开局常驻被动）。天眼洞开直接看穿红方入局的 1 位妖魔名号，提前知晓红方潜伏的技能底细。',
  nezha: '乾坤一掷。在关键队伍公开表决时投票权重计为 2 票，单枪匹马强行扭转战局（两流必发强发轮跳过表决，该技能将暂留）。',
  li_tianwang: '照妖宝镜（全程静默不公屏）。队伍敲定或拟定时举镜探查，私密得知当前车队是否包含妖魔（是/否），是好人验车的绝对神器。',
  zhu_bajie: '倒打一耙。提前蓄势，若本轮组队表决未通过，强制将 1 张反对票反转为赞成票，护送好人车出征（两流必发强发轮暂留）。',
  sha_wujing: `定海神针。提前蓄势，若本轮组队表决未通过流局，${pct(BRAWL_SKILL_PROBS.SHA_PASS)} 概率强行将流局镇压反转为发车通过（两流必发强发轮暂留）。`,
  bai_longma: '负重破局。挑人时主动负重，队长当轮队伍名额上限临时 +1，多保 1 名好人上车稀释翻车风险。',
  hong_haier: '红方刺客（全人数必出）。开局与同伙互认（不含孤狼牛魔王），5~8 人局额外附带 1 个随机红方副法宝；任务三败可胜，若蓝方三胜则终局精准一击刺杀孙悟空翻盘。',
  liuer_mihou: '绝命假圣（全人数必出）。在唐三藏眼中与真大圣一模一样，5~8 人局额外附带 1 个随机红方副法宝；需极力模仿悟空的思维与语气误导唐僧，诱杀真猴。',
  bai_gujing: '画皮离间（全程静默不公屏）。出征前暗埋离间魔骨，若本轮任务出现失败牌，必静默虚增 1 张失败牌（不发公屏战报），引爆车内好人反目自相猜忌！',
  zhizhu_jing: '盘丝控场。挑人或论道阶段吐丝将 1 名非队长仙友结茧，当轮禁止被选入队伍，精准拆解好人稳固连线（受防死锁人数护栏约束）。',
  yutu_jing: `迷魂捣药（全程静默不公屏）。出征前暗锁 1 名队员，若其随队出征并投出成功牌，${pct(BRAWL_SKILL_PROBS.YUTU_DISCARD)} 概率将其成功牌封印作废转为失败结算，制造冤假错案。`,
  laoshu_jing: '灵山窥机（开局常驻被动）。偷吃灵山灯油灵光一闪，开局私密得知本局蓝方盲盒抽中的 1 位仙佛角色，提前预判好人技能威胁。',
  niu_mowang: '平天孤狼与双倍票力。属于红方妖魔但孤身独行：看不见其他妖魔同党，其他妖魔也看不见他（孙悟空能见其妖气）；表决时一人算 2 票（两流必发强发轮暂留）。',
  tieshan_gongzhu: `窥破仙阶（全程静默不公屏）。扇动芭蕉神扇刺探蓝方阵容：100% 获知蓝方是否坐镇至尊大能，且 ${pct(BRAWL_SKILL_PROBS.TIESHAN_BONUS_ROLE)} 概率进一步洞悉 1 位具体仙佛法号！`,
  huangmei_laoguai: '佛相匿形与假佛旨（9 人及以上局必出，全程静默不公屏）。孙悟空完全看不见，且军令状天眼查验亦显蓝方清光；挑人时可假传菩提真传，向 1 名除悟空外的随机蓝方私发栽赃密信引爆好人内讧。',
  jinjiao_dawang: `葫芦吸气（全程静默不公屏）。出征前暗锁 1 名队员，若其随队出征并投出成功牌，${pct(BRAWL_SKILL_PROBS.JINJIAO_ABSORB)} 概率被紫金葫芦化解吸收为失败，栽赃好人。`,
  yinjiao_dawang: '移山压顶。表决阶段强行将场上任意 1 名其他玩家的票压制为弃权，消除关键的好人赞成票或反对票（两流必发强发轮暂留）。',
  huangfeng_guai: `三昧神风（全程静默不公屏）。黄风岭大圣刮起遮天神风，${pct(BRAWL_SKILL_PROBS.HUANGFENG_PEEK)} 概率吹探得知本局除悟空外的 1 位蓝方仙佛法号，掌握好人底细！`,
  baiyan_mojun: `千眼窥机与黄花毒茶（全程静默不公屏）。开局被动窥探 1 位蓝方入局仙佛名号；出征前暗下毒茶，目标随队且投成功时，4 人及以上大车 ${pct(BRAWL_SKILL_PROBS.BAIYAN_BIG_TEAM)}、3 人及以下小车 ${pct(BRAWL_SKILL_PROBS.BAIYAN_SMALL_TEAM)} 概率静默毒化为失败！`,
  qingmao_shizi: '大口吞天。挑人、论道或表决阶段将 1 名非队长仙友强行吞走剔除出队且本难禁选（若已在车上则打回重选），霸道拆解好人车（受防死锁人数护栏约束）。',
  jinchi_dapeng: '绝杀明灯（全程静默不公屏）。对局任意阶段均可提前蓄力，进入刺杀阶段自动为红孩儿排除 1 个绝非孙悟空的席位，大幅提高刺杀胜率。',
};
