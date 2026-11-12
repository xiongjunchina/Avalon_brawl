import type {
  BrawlRoleDef,
  BrawlCamp,
  BrawlBlindBox,
} from '@avalon/contracts';

/**
 * 31 位西游高知名度全明星阵容注册表
 * 架构支持未来任意扩展（只需向注册表追加新对象）
 */
export const BRAWL_ROLE_REGISTRY: Record<string, BrawlRoleDef> = {
  // ==================== 蓝方 15 仙佛 ====================
  sun_wukong: {
    id: 'sun_wukong',
    name: '孙悟空',
    fullName: '齐天大圣 · 孙悟空',
    title: '齐天大圣',
    camp: 'blue',
    isCore: true,
    artPrefix: 'merlin',
    motto: '火眼金睛识群妖，天机不可轻泄',
    skill: {
      skillId: 'huoyan_jinjing',
      skillName: '火眼金睛',
      triggerPhase: 'game_start',
      actionType: 'passive',
      maxUses: 1,
      description: '开局见红方妖气；任务 3 胜后隐藏真身防刺杀。',
    },
  },
  tang_seng: {
    id: 'tang_seng',
    name: '唐三藏',
    fullName: '大唐圣僧 · 唐三藏',
    title: '大唐圣僧',
    camp: 'blue',
    isCore: true,
    artPrefix: 'percival',
    motto: '辨明真假美猴王，护持大圣保真经',
    skill: {
      skillId: 'jingu_huiyan',
      skillName: '紧箍慧眼',
      triggerPhase: 'game_start',
      actionType: 'passive',
      maxUses: 1,
      description: '开局辨识真假美猴王气机；作为领队统帅车队。',
    },
  },
  rulai_fozu: {
    id: 'rulai_fozu',
    name: '如来佛祖',
    fullName: '西天释迦 · 如来佛祖',
    title: '万佛之祖',
    camp: 'blue',
    isCore: false,
    artPrefix: 'brawl-rulai',
    motto: '法力无边掌乾坤，五行山下镇妖魔',
    skill: {
      skillId: 'wuxingshan_zhang',
      skillName: '五行山掌',
      triggerPhase: 'team_building',
      actionType: 'target_player',
      maxUses: 1,
      description: '挑人前指定 1 人压入五行山，该玩家本轮禁止被选入车队与参与表决。',
    },
  },
  yuhuang_dadi: {
    id: 'yuhuang_dadi',
    name: '玉皇大帝',
    fullName: '昊天金阙 · 玉皇大帝',
    title: '三界至尊',
    camp: 'blue',
    isCore: false,
    artPrefix: 'brawl-yuhuang',
    motto: '昊天金阙尊玉旨，三界统御赦群仙',
    skill: {
      skillId: 'tianzun_yuzhi',
      skillName: '天尊玉旨',
      triggerPhase: 'mission_resolved',
      actionType: 'single_button',
      maxUses: 1,
      awakeningChance: 0.5,
      description: '任务仅出现 1 张失败牌时降旨，50% 概率将该失败牌赦免为成功。',
    },
  },
  wangmu_niangniang: {
    id: 'wangmu_niangniang',
    name: '王母娘娘',
    fullName: '瑶池金母 · 王母娘娘',
    title: '瑶池金母',
    camp: 'blue',
    isCore: false,
    artPrefix: 'brawl-wangmu',
    motto: '九千年开蟠桃宴，仙桃延寿破万险',
    skill: {
      skillId: 'jiuzhuan_xiantao',
      skillName: '九转仙桃',
      triggerPhase: 'team_building',
      actionType: 'single_button',
      maxUses: 1,
      description: '仅对 4 人及以上车队生效，赐仙桃护体：本轮任务需【至少 2 张失败牌】方算失败。',
    },
  },
  taishang_laojun: {
    id: 'taishang_laojun',
    name: '太上老君',
    fullName: '兜率道祖 · 太上老君',
    title: '兜率道祖',
    camp: 'blue',
    isCore: false,
    artPrefix: 'brawl-laojun',
    motto: '金刚琢套天下宝，八卦炉中炼造化',
    skill: {
      skillId: 'jingang_zhuo',
      skillName: '金刚琢',
      triggerPhase: 'passive',
      actionType: 'single_button',
      maxUses: 1,
      description: '当场上任意妖魔发动其主动技能时，老君祭起金刚琢当场套走收缴其效果！',
    },
  },
  puti_zhushi: {
    id: 'puti_zhushi',
    name: '菩提祖师',
    fullName: '斜月三星 · 菩提祖师',
    title: '世外方寸祖',
    camp: 'blue',
    isCore: false,
    artPrefix: 'brawl-puti',
    motto: '灵台方寸斜月沉，不染红尘授长生',
    skill: {
      skillId: 'daofa_dianhua',
      skillName: '道法点化',
      triggerPhase: 'mission_resolved',
      actionType: 'single_button',
      maxUses: 1,
      awakeningChance: 0.5,
      description: '第 2 轮任务后，50% 概率让除孙悟空外的 1 名随机蓝方私密得知 1 位红方真名。',
    },
  },
  guanyin_pusa: {
    id: 'guanyin_pusa',
    name: '观音菩萨',
    fullName: '南海大士 · 观音菩萨',
    title: '慈航大士',
    camp: 'blue',
    isCore: false,
    artPrefix: 'brawl-guanyin',
    motto: '杨柳甘露净尘世，紫竹林中解心魔',
    skill: {
      skillId: 'jingping_ganlu',
      skillName: '净瓶甘露',
      triggerPhase: 'team_building',
      actionType: 'target_player',
      maxUses: 1,
      description: '组队前给 1 人洒甘露，若其后续出征且任务失败，私密获知该人是否投了成功。',
    },
  },
  zhenyuan_daxian: {
    id: 'zhenyuan_daxian',
    name: '镇元大仙',
    fullName: '万寿道祖 · 镇元大仙',
    title: '地仙之祖',
    camp: 'blue',
    isCore: false,
    artPrefix: 'brawl-zhenyuan',
    motto: '五庄观前地仙祖，袖里乾坤纳三千',
    skill: {
      skillId: 'xiuli_qiankun',
      skillName: '袖里乾坤',
      triggerPhase: 'team_voting',
      actionType: 'single_button',
      maxUses: 1,
      description: '表决前大袖收走全队，强制流局换下任队长重新组队，且不扣 5 次流局上限。',
    },
  },
  erlang_shen: {
    id: 'erlang_shen',
    name: '二郎神',
    fullName: '显圣真君 · 杨戬',
    title: '清源妙道真君',
    camp: 'blue',
    isCore: false,
    artPrefix: 'brawl-erlang',
    motto: '天眼洞开彻三界，听调不听封玉阶',
    skill: {
      skillId: 'tianyan_zhaoxu',
      skillName: '天眼照虚',
      triggerPhase: 'game_start',
      actionType: 'passive',
      maxUses: 1,
      description: '天眼洞开，开局私密得知本局红方随机盲盒中抽中的 1 位妖魔名号。',
    },
  },
  nezha: {
    id: 'nezha',
    name: '哪吒三太子',
    fullName: '三坛海会 · 哪吒三太子',
    title: '三坛海会大神',
    camp: 'blue',
    isCore: false,
    artPrefix: 'brawl-nezha',
    motto: '三头六臂乾坤圈，火尖枪动伏群妖',
    skill: {
      skillId: 'santou_liubi',
      skillName: '三头六臂',
      triggerPhase: 'team_voting',
      actionType: 'single_button',
      maxUses: 1,
      description: '在任意一次队伍公开表决时，哪吒投票权重在此次表决中计为 2 票！',
    },
  },
  li_tianwang: {
    id: 'li_tianwang',
    name: '托塔李天王',
    fullName: '降妖大元帅 · 李靖',
    title: '托塔天王',
    camp: 'blue',
    isCore: false,
    artPrefix: 'brawl-litianwang',
    motto: '玲珑宝塔镇十方，降妖宝镜照元形',
    skill: {
      skillId: 'zhaoyao_baojing',
      skillName: '照妖宝镜',
      triggerPhase: 'team_building',
      actionType: 'single_button',
      maxUses: 1,
      description: '队伍敲定后举镜探查，私密得知当前队伍是否包含妖魔（反馈 是/否）。',
    },
  },
  zhu_bajie: {
    id: 'zhu_bajie',
    name: '猪八戒',
    fullName: '天蓬元帅 · 猪八戒',
    title: '净坛使者',
    camp: 'blue',
    isCore: false,
    artPrefix: 'zhubajie-loyal',
    motto: '九齿钉耙护圣僧，贪吃好面倒打耙',
    skill: {
      skillId: 'daoda_yipa',
      skillName: '倒打一耙',
      triggerPhase: 'team_voting',
      actionType: 'single_button',
      maxUses: 1,
      description: '组队表决未通过时倒打一耙，强制将全场最后 1 张反对票反转为赞成票！',
    },
  },
  sha_wujing: {
    id: 'sha_wujing',
    name: '沙悟净',
    fullName: '卷帘大将 · 沙悟净',
    title: '金身罗汉',
    camp: 'blue',
    isCore: false,
    artPrefix: 'shawujing-loyal',
    motto: '降妖宝杖担重任，沉稳如山定风波',
    skill: {
      skillId: 'xiangyao_baozhang',
      skillName: '降妖宝杖',
      triggerPhase: 'team_voting',
      actionType: 'single_button',
      maxUses: 1,
      description: '自己当队长提议平票时，宝杖定海强制判定通过。',
    },
  },
  bai_longma: {
    id: 'bai_longma',
    name: '白龙马',
    fullName: '西海龙王太子 · 白龙马',
    title: '八部天龙',
    camp: 'blue',
    isCore: false,
    artPrefix: 'bailong-loyal',
    motto: '踏破重山驮圣僧，化龙出渊救危途',
    skill: {
      skillId: 'longma_fuzhong',
      skillName: '龙马负重',
      triggerPhase: 'team_building',
      actionType: 'single_button',
      maxUses: 1,
      description: '挑人时主动负重，队长当轮队伍名额上限临时 +1（多保 1 名好人上车）。',
    },
  },

  // ==================== 红方 15 妖魔 ====================
  hong_haier: {
    id: 'hong_haier',
    name: '红孩儿',
    fullName: '圣婴大王 · 红孩儿',
    title: '圣婴大王',
    camp: 'red',
    isCore: true,
    artPrefix: 'assassin',
    motto: '三昧真火焚天地，终局一击断灵山',
    skill: {
      skillId: 'sanmei_zhenhuo',
      skillName: '三昧真火',
      triggerPhase: 'assassination',
      actionType: 'target_player',
      maxUses: 1,
      description: '开局见红方同伙；任务 3 胜后负责辨识并一击刺杀孙悟空。',
    },
  },
  liuer_mihou: {
    id: 'liuer_mihou',
    name: '六耳猕猴',
    fullName: '善聆音假圣 · 六耳猕猴',
    title: '混世假圣',
    camp: 'red',
    isCore: true,
    artPrefix: 'morgana',
    motto: '善聆音察理知前后，真假大圣惑三藏',
    skill: {
      skillId: 'hunshi_jiasheng',
      skillName: '混世假圣',
      triggerPhase: 'game_start',
      actionType: 'passive',
      maxUses: 1,
      description: '开局见红方同伙；在唐僧眼中与大圣同相，互辨真假破绽。',
    },
  },
  bai_gujing: {
    id: 'bai_gujing',
    name: '白骨精',
    fullName: '白骨夫人 · 白骨精',
    title: '白骨夫人',
    camp: 'red',
    isCore: false,
    artPrefix: 'minion-baigu',
    motto: '骷髅红颜三般变，粉面含笑乱佛心',
    skill: {
      skillId: 'huapi_sanbian',
      skillName: '画皮三变',
      triggerPhase: 'game_start',
      actionType: 'passive',
      maxUses: 1,
      awakeningChance: 0.5,
      description: '开局 50% 概率不显红光妖气（处于孙悟空视野盲区）。',
    },
  },
  zhizhu_jing: {
    id: 'zhizhu_jing',
    name: '蜘蛛精',
    fullName: '盘丝大仙 · 蜘蛛精',
    title: '盘丝大仙',
    camp: 'red',
    isCore: false,
    artPrefix: 'minion-spider',
    motto: '盘丝结网诱唐僧，红绡濯垢缚真龙',
    skill: {
      skillId: 'pansi_jiejian',
      skillName: '盘丝结茧',
      triggerPhase: 'team_building',
      actionType: 'target_player',
      maxUses: 1,
      description: '挑人阶段，吐丝将 1 名仙友结茧，该玩家当轮禁止被选入出征队伍。',
    },
  },
  yutu_jing: {
    id: 'yutu_jing',
    name: '玉兔精',
    fullName: '广寒素娥 · 玉兔精',
    title: '天竺妖仙',
    camp: 'red',
    isCore: false,
    artPrefix: 'minion-yutu',
    motto: '广寒私逃下天竺，捣药臼中炼迷香',
    skill: {
      skillId: 'daoyao_mihun',
      skillName: '捣药迷魂',
      triggerPhase: 'team_building',
      actionType: 'target_player',
      maxUses: 1,
      awakeningChance: 0.33,
      description: '队伍敲定后暗中迷魂车上 1 名好人，其出征时 33% 概率成功牌被封印弃权。',
    },
  },
  laoshu_jing: {
    id: 'laoshu_jing',
    name: '老鼠精',
    fullName: '地涌夫人 · 老鼠精',
    title: '地涌夫人',
    camp: 'red',
    isCore: false,
    artPrefix: 'minion-laoshu',
    motto: '陷空深洞金鼻毛，灵山偷油窃玄机',
    skill: {
      skillId: 'touchi_dengyou',
      skillName: '偷吃灯油',
      triggerPhase: 'game_start',
      actionType: 'passive',
      maxUses: 1,
      description: '偷饮灵山佛前灯油灵光一现，私密得知本局蓝方盲盒抽中的 1 位仙佛名号。',
    },
  },
  niu_mowang: {
    id: 'niu_mowang',
    name: '牛魔王',
    fullName: '大力牛魔 · 牛魔王',
    title: '平天大圣',
    camp: 'red',
    isCore: false,
    artPrefix: 'brawl-niumowang',
    motto: '平天大力谁能敌，撼动昆仑震四方',
    skill: {
      skillId: 'pingtian_handi',
      skillName: '平天撼地',
      triggerPhase: 'team_voting',
      actionType: 'single_button',
      maxUses: 1,
      description: '在任意一次队伍公开表决时，牛魔王个人投票权重在此次表决中计为 2 票！',
    },
  },
  tieshan_gongzhu: {
    id: 'tieshan_gongzhu',
    name: '铁扇公主',
    fullName: '翠云山主 · 罗刹女',
    title: '铁扇仙',
    camp: 'red',
    isCore: false,
    artPrefix: 'brawl-tieshan',
    motto: '翠云芭蕉扇狂风，一扇息火二生云',
    skill: {
      skillId: 'bajiao_shenfeng',
      skillName: '芭蕉神风',
      triggerPhase: 'team_voting',
      actionType: 'single_button',
      maxUses: 1,
      description: '当队伍以微弱 1 票优势通过时煽风吹散，强制全场重新公开表决一次。',
    },
  },
  huangmei_laoguai: {
    id: 'huangmei_laoguai',
    name: '黄眉老怪',
    fullName: '小雷音寺假佛 · 黄眉老怪',
    title: '小雷音佛祖',
    camp: 'red',
    isCore: false,
    artPrefix: 'brawl-huangmei',
    motto: '假设雷音瞒正果，后天袋内困神仙',
    skill: {
      skillId: 'renzhong_jindai',
      skillName: '人种金袋',
      triggerPhase: 'team_building',
      actionType: 'target_player',
      maxUses: 1,
      description: '挑人阶段祭起人种袋，将队长已选的 1 名队员吸走，强制剔除出队伍。',
    },
  },
  jinjiao_dawang: {
    id: 'jinjiao_dawang',
    name: '金角大王',
    fullName: '平顶山莲花洞 · 金角大王',
    title: '金角大王',
    camp: 'red',
    isCore: false,
    artPrefix: 'brawl-jinjiao',
    motto: '我叫你一声你敢应吗？紫金红葫芦装神仙',
    skill: {
      skillId: 'zijin_hulu',
      skillName: '紫金葫芦',
      triggerPhase: 'team_building',
      actionType: 'target_player',
      maxUses: 1,
      awakeningChance: 0.5,
      description: '手机私密选定出征队员 1 人，若其投成功，50% 概率被葫芦化解吸收。',
    },
  },
  yinjiao_dawang: {
    id: 'yinjiao_dawang',
    name: '银角大王',
    fullName: '平顶山莲花洞 · 银角大王',
    title: '银角大王',
    camp: 'red',
    isCore: false,
    artPrefix: 'brawl-yinjiao',
    motto: '移山倒海移须弥，羊脂玉净瓶摄魂',
    skill: {
      skillId: 'yishan_yading',
      skillName: '移山压顶',
      triggerPhase: 'team_voting',
      actionType: 'target_player',
      maxUses: 1,
      description: '表决阶段，将全场任意 1 人的表决票强制压制为【弃权】。',
    },
  },
  huangfeng_guai: {
    id: 'huangfeng_guai',
    name: '黄风怪',
    fullName: '黄风岭大王 · 黄风怪',
    title: '黄风大圣',
    camp: 'red',
    isCore: false,
    artPrefix: 'brawl-huangfeng',
    motto: '黄风刮动天地暗，吹盲行者火眼眸',
    skill: {
      skillId: 'fengsha_nixing',
      skillName: '风沙匿形',
      triggerPhase: 'game_start',
      actionType: 'passive',
      maxUses: 1,
      awakeningChance: 0.5,
      description: '神风护体孙悟空看不见黄风怪；若受蓝方探查法宝，50% 概率被破防显形。',
    },
  },
  baiyan_mojun: {
    id: 'baiyan_mojun',
    name: '百眼魔君',
    fullName: '黄花观主 · 百眼魔君',
    title: '多目怪',
    camp: 'red',
    isCore: false,
    artPrefix: 'brawl-baiyan',
    motto: '肋下千眼放金光，黄雾升腾惑真仙',
    skill: {
      skillId: 'qianyan_kuiji',
      skillName: '千眼窥机',
      triggerPhase: 'game_start',
      actionType: 'passive',
      maxUses: 1,
      description: '千眼放光，开局私密得知本局蓝方盲盒抽中的 1 位仙佛底牌名号。',
    },
  },
  qingmao_shizi: {
    id: 'qingmao_shizi',
    name: '青毛狮子怪',
    fullName: '狮驼岭大王 · 青毛狮子怪',
    title: '青毛狮王',
    camp: 'red',
    isCore: false,
    artPrefix: 'brawl-qingshi',
    motto: '大口吞天吞十万，南天门前威风显',
    skill: {
      skillId: 'dakou_tuntian',
      skillName: '大口吞天',
      triggerPhase: 'team_voting',
      actionType: 'target_player',
      maxUses: 1,
      description: '队伍表决通过后强行吞除 1 名队员资格，迫使队长现场重新补选。',
    },
  },
  jinchi_dapeng: {
    id: 'jinchi_dapeng',
    name: '金翅大鹏雕',
    fullName: '狮驼岭三王 · 金翅大鹏雕',
    title: '云程万里鹏',
    camp: 'red',
    isCore: false,
    artPrefix: 'brawl-dapeng',
    motto: '云程九万展双翼，三界巡视锁行者',
    skill: {
      skillId: 'yuncheng_wanli',
      skillName: '云程万里',
      triggerPhase: 'assassination',
      actionType: 'single_button',
      maxUses: 1,
      description: '终局刺杀阶段大鹏展翅俯瞰，为红孩儿直接排除 1 个绝对不是孙悟空的席位。',
    },
  },
};

/**
 * 5~12 人局的标准人数配置（严格遵循原版阿瓦隆蓝红比例：5人3:2, 6人4:2, 7人4:3, 8人5:3, 9人6:3, 10人6:4, 11人7:4, 12人8:4）
 */
export interface BrawlPlayerCountConfig {
  playerCount: number;
  blueTotal: number;
  redTotal: number;
  blueDrawCount: number;
  redDrawCount: number;
}

export const BRAWL_PLAYER_CONFIG: Record<number, BrawlPlayerCountConfig> = {
  5: { playerCount: 5, blueTotal: 3, redTotal: 2, blueDrawCount: 1, redDrawCount: 0 },
  6: { playerCount: 6, blueTotal: 4, redTotal: 2, blueDrawCount: 2, redDrawCount: 0 },
  7: { playerCount: 7, blueTotal: 4, redTotal: 3, blueDrawCount: 2, redDrawCount: 1 },
  8: { playerCount: 8, blueTotal: 5, redTotal: 3, blueDrawCount: 3, redDrawCount: 1 },
  9: { playerCount: 9, blueTotal: 6, redTotal: 3, blueDrawCount: 4, redDrawCount: 1 },
  10: { playerCount: 10, blueTotal: 6, redTotal: 4, blueDrawCount: 4, redDrawCount: 2 },
  11: { playerCount: 11, blueTotal: 7, redTotal: 4, blueDrawCount: 5, redDrawCount: 2 },
  12: { playerCount: 12, blueTotal: 8, redTotal: 4, blueDrawCount: 6, redDrawCount: 2 },
};

/**
 * 无放回随机采样算法 (Fisher-Yates 变种)
 */
export function sampleWithoutReplacement<T>(items: T[], count: number, rng: () => number = Math.random): T[] {
  if (count <= 0) return [];
  if (count > items.length) {
    throw new Error(`Cannot sample ${count} items from pool of ${items.length}`);
  }
  const pool = [...items];
  const result: T[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
}

export interface BrawlRoleAssignment {
  roles: BrawlRoleDef[];
  blindBox: BrawlBlindBox;
  peekedMap: Record<string, { roleId: string; roleName: string; camp: BrawlCamp }[]>;
}

/**
 * 大乱斗角色抽取核心引擎 (支持未来无限扩展)
 */
export function drawBrawlRoles(
  playerCount: number,
  customRegistry: Record<string, BrawlRoleDef> = BRAWL_ROLE_REGISTRY,
  rng: () => number = Math.random,
  preferences?: Record<string, string[]>,
): BrawlRoleAssignment {
  const config = BRAWL_PLAYER_CONFIG[playerCount];
  if (!config) {
    throw new Error(`Unsupported player count for Brawl Mode: ${playerCount}`);
  }

  const assigned: BrawlRoleDef[] = [];

  // 1. 固定必出核心
  const sunWukong = customRegistry.sun_wukong;
  const tangSeng = customRegistry.tang_seng;
  const liuerMihou = customRegistry.liuer_mihou;
  const hongHaier = customRegistry.hong_haier;

  if (!sunWukong || !tangSeng || !liuerMihou || !hongHaier) {
    throw new Error('Core roles missing from registry');
  }

  assigned.push(sunWukong, tangSeng);
  assigned.push(liuerMihou, hongHaier);

  // 提取心仪偏好角色集合
  const preferredBlue = new Set<string>();
  const preferredRed = new Set<string>();
  if (preferences) {
    for (const prefs of Object.values(preferences)) {
      if (Array.isArray(prefs)) {
        for (const roleId of prefs) {
          const def = customRegistry[roleId];
          if (def && !def.isCore) {
            if (def.camp === 'blue') preferredBlue.add(roleId);
            else if (def.camp === 'red') preferredRed.add(roleId);
          }
        }
      }
    }
  }

  // 3. 蓝方乱斗池抽取（心仪角色优先入池）
  const bluePool = Object.values(customRegistry).filter(r => r.camp === 'blue' && !r.isCore);
  const favoredBlue = bluePool.filter(r => preferredBlue.has(r.id));
  const otherBlue = bluePool.filter(r => !preferredBlue.has(r.id));
  const pickedBlue: BrawlRoleDef[] = [];
  if (favoredBlue.length > 0) {
    const pickCount = Math.min(favoredBlue.length, config.blueDrawCount);
    pickedBlue.push(...sampleWithoutReplacement(favoredBlue, pickCount, rng));
  }
  if (pickedBlue.length < config.blueDrawCount) {
    const remain = config.blueDrawCount - pickedBlue.length;
    pickedBlue.push(...sampleWithoutReplacement(otherBlue, remain, rng));
  }
  assigned.push(...pickedBlue);

  // 4. 红方乱斗池抽取（心仪角色优先入池）
  const redPool = Object.values(customRegistry).filter(r => r.camp === 'red' && !r.isCore);
  const favoredRed = redPool.filter(r => preferredRed.has(r.id));
  const otherRed = redPool.filter(r => !preferredRed.has(r.id));
  const pickedRed: BrawlRoleDef[] = [];
  if (favoredRed.length > 0) {
    const pickCount = Math.min(favoredRed.length, config.redDrawCount);
    pickedRed.push(...sampleWithoutReplacement(favoredRed, pickCount, rng));
  }
  if (pickedRed.length < config.redDrawCount) {
    const remain = config.redDrawCount - pickedRed.length;
    pickedRed.push(...sampleWithoutReplacement(otherRed, remain, rng));
  }
  assigned.push(...pickedRed);

  // 校验人数严格一致
  if (assigned.length !== playerCount) {
    throw new Error(`Role assignment mismatch: expected ${playerCount}, got ${assigned.length}`);
  }

  // 构造盲盒信息（不公开显示给全场，仅系统与特定情报技能可知）
  const blindBox: BrawlBlindBox = {
    bluePoolRoles: pickedBlue.map(r => r.id),
    redPoolRoles: pickedRed.map(r => r.id),
  };

  // 生成特定情报特权（二郎神看 1 妖，百眼魔君看 1 仙，老鼠精看 1 仙）
  const peekedMap: Record<string, { roleId: string; roleName: string; camp: BrawlCamp }[]> = {};

  // 二郎神：看 1 红
  if (pickedBlue.some(r => r.id === 'erlang_shen')) {
    // 如果红方抽中了乱斗妖魔，看乱斗妖魔；如果只有核心（如5、6人局），看核心妖魔
    const targetRed = pickedRed.length > 0 ? pickedRed[0] : hongHaier;
    peekedMap.erlang_shen = [{ roleId: targetRed.id, roleName: targetRed.name, camp: 'red' }];
  }

  // 百眼魔君：看 1 蓝
  if (pickedRed.some(r => r.id === 'baiyan_mojun')) {
    const targetBlue = pickedBlue.length > 0 ? pickedBlue[0] : sunWukong;
    peekedMap.baiyan_mojun = [{ roleId: targetBlue.id, roleName: targetBlue.name, camp: 'blue' }];
  }

  // 老鼠精：看 1 蓝
  if (pickedRed.some(r => r.id === 'laoshu_jing')) {
    const targetBlue = pickedBlue.length > 0 ? pickedBlue[pickedBlue.length - 1] : tangSeng;
    peekedMap.laoshu_jing = [{ roleId: targetBlue.id, roleName: targetBlue.name, camp: 'blue' }];
  }

  return {
    roles: assigned,
    blindBox,
    peekedMap,
  };
}
