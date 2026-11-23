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
  sun_wukong: '蓝方核心。开局看清红方妖气；任务三胜后务必隐藏锋芒，模仿普通护法语气，防范红孩儿终局刺杀。',
  tang_seng: '蓝方领队。辨出真假大圣（孙悟空与六耳猕猴）却不知谁真谁假，需通过挑人试探与发言破绽辨识真猴。',
  rulai_fozu: '强力控场。在挑人前祭出五行山掌禁锢嫌疑极大的坏人，使其当轮既不能进队也不能投票，强行粉碎坏人车。',
  yuhuang_dadi: '天尊救场。任一轮任务失败时降旨赦免（1败时60%概率逆转为胜，2败时30%概率逆转为胜），关键时刻力挽狂澜。',
  wangmu_niangniang: '仙桃护体。任意车队出征时均可赐桃：本轮任务若出失败牌，50%概率直接抵消赦免1败，极大降低翻车概率。',
  taishang_laojun: '法宝克星。当场上任意妖魔施展主动技能时，老君祭起金刚琢当场套走收缴其效果，是红方强力技能的终极梦魇。',
  puti_zhushi: '道法点化。第 2 轮任务后，50% 概率让除孙悟空外的 1 名随机蓝方私密得知 1 位红方真名，为好人暗中注入铁逻辑。',
  guanyin_pusa: '甘露辨忠。车队敲定后对车上队员洒甘露，若出征任务失败，100%私下获知其是否投了成功，精准揪出内鬼。',
  zhenyuan_daxian: '大袖乾坤。眼见恶人队伍即将票过时，大袖一挥收走全队强制流局且不扣全局流局上限，救全场于水火。',
  erlang_shen: '天眼照虚。开局天眼洞开，直接看穿红方盲盒抽中的 1 位妖魔名号，提前知晓红方潜伏的技能底细。',
  nezha: '乾坤一掷。在关键队伍公开表决时，哪吒投票权重计为 2 票，关键时刻单枪匹马强行扭转战局。',
  li_tianwang: '照妖宝镜。队伍敲定后举镜探查，私密得知当前队伍是否包含妖魔，是好人队长验车的绝对神器。',
  zhu_bajie: '倒打一耙。组队表决未通过时倒打一耙，将全场最后 1 张反对票反转为赞成票，强行保护好人车出征。',
  sha_wujing: '定海神针。组队表决未通过流局时，降妖宝杖定海定风波，50%概率强行将流局镇压反转为发车通过！',
  bai_longma: '负重破局。挑人时主动负重，队长当轮队伍名额临时 +1，多保 1 名好人上车稀释翻车风险。',
  hong_haier: '红方刺客。开局与同伙互认，任务三败可获胜；若蓝方三胜，需依据全场发言与票型精准一击刺杀孙悟空。',
  liuer_mihou: '绝命假圣。在唐三藏眼中与真大圣一模一样，需极力模仿悟空的思维与语气误导唐僧，诱杀真猴。',
  bai_gujing: '画皮离间。开局50%概率隐身；任务出征若失败，静默虚增1张失败牌，引爆车内好人反目自相残杀！',
  zhizhu_jing: '盘丝控场。挑人阶段吐丝将 1 名仙友结茧，当轮禁止被选入队伍，精准拆解好人稳固的双人连线。',
  yutu_jing: '迷魂捣药。队伍敲定后暗中迷魂车上 1 名好人，使其有概率无法投出成功牌，制造冤假错案。',
  laoshu_jing: '灵山窥机。偷吃灵山灯油灵光一闪，开局私密得知蓝方盲盒抽中的仙佛角色，提前预判好人技能威胁。',
  niu_mowang: '平天孤狼与双倍票力。属于红方妖魔但孤身独行：看不见其他妖魔同党，其他妖魔也看不见他（孙悟空能见其妖气）；公开表决时一人算2票，关键轮次直接以绝对重炮票力强行压过好人反对！',
  tieshan_gongzhu: '窥破仙阶。扇动芭蕉神扇刺探蓝方阵容：100%获知蓝方是至尊大能还是散仙护法，且50%概率进一步洞悉具体仙佛法号！',
  huangmei_laoguai: '佛相匿形与假佛旨。孙悟空完全看不见；挑人时假传菩提真传，向1名随机好人私发假点化引爆好人内讧。',
  jinjiao_dawang: '葫芦吸气。出征前私选 1 人，若其投成功有 50% 概率被紫金葫芦化解吸收，制造假失败栽赃好人。',
  yinjiao_dawang: '移山定身。表决阶段强行将场上任意 1 人的票压制为弃权，消除关键的好人赞成票或反对票。',
  huangfeng_guai: '三昧神风。黄风岭大圣刮起遮天神风，50%概率直接吹探得知本局蓝方盲盒抽中的1位仙佛名号，掌握好人底细！',
  baiyan_mojun: '黄花毒茶。出征前暗下毒茶：目标若投成功，4人及以上大车50%、3人及以下小车33%概率静默毒化为失败！',
  qingmao_shizi: '大口吞天。狮驼岭大大王张开血盆巨口，挑人阶段将队长已选的1人强行吞走剔除出队，霸道拆解好人车。',
  jinchi_dapeng: '绝杀明灯。终局刺杀时大鹏展翅俯瞰，直接为红孩儿排除 1 个绝对非悟空的席位，大幅提高刺杀胜率。',
};
