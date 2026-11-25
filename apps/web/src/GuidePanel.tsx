import { assetUrl } from './deployment';
import { useLayoutEffect, useRef, useState } from 'react';
import { usePageSound } from './audio-interactions';
import type { FemaleDemon, LoyalGuardian, Role, BrawlRoleDef } from '@avalon/contracts';
import {
  ROLE_CONFIG,
  MISSION_SIZES,
  BRAWL_ROLE_REGISTRY,
  BRAWL_PLAYER_CONFIG,
  BRAWL_MISSION_SIZES,
  BRAWL_ORDEAL_REGISTRY,
  ALL_BRAWL_ORDEAL_IDS,
  BRAWL_SKILL_PROBS,
  failuresRequiredFor,
} from '@avalon/game-core';
import { Emblem, roleTeam } from './Heraldry';
import { RolePortrait } from './RolePortrait';
import { ALL_GALLERY_ROLES, FEMALE_DEMONS, LOYAL_GUARDIANS, WUYUE_MISSIONS, roleNames, roleMottos, roleTitles, type RoleGalleryItem } from './roles';
import { RoleViewerModal } from './RoleViewerModal';

import { roleDescriptions, roleTreasures } from './role-descriptions';
export { roleDescriptions, roleTreasures };

const allRoles = Object.keys(roleNames) as Role[];
const classicRuleChapters = ['胜负条件', '对局流程', '人数配置', '房主设置', '刺杀与天机', '专属法宝'];

const brawlRuleChapters = [
  '仙魔三界对决',
  '人数配额与固定领军',
  '两流必发与奇劫军令状',
  '房主设置与心仪选角',
  '30位弱技能设计',
  '天机战报公法不公人',
];

const BRAWL_ALL_CORE_IDS = new Set(['sun_wukong', 'tang_seng', 'hong_haier', 'liuer_mihou']);
const BRAWL_NINE_PLUS_CORE_IDS = new Set(['guanyin_pusa', 'huangmei_laoguai']);
const pct = (p: number) => `${Math.round(p * 100)}%`;

const brawlRolesList: BrawlRoleDef[] = [
  // 蓝方 15 仙佛
  BRAWL_ROLE_REGISTRY.sun_wukong,
  BRAWL_ROLE_REGISTRY.tang_seng,
  BRAWL_ROLE_REGISTRY.rulai_fozu,
  BRAWL_ROLE_REGISTRY.yuhuang_dadi,
  BRAWL_ROLE_REGISTRY.wangmu_niangniang,
  BRAWL_ROLE_REGISTRY.taishang_laojun,
  BRAWL_ROLE_REGISTRY.puti_zhushi,
  BRAWL_ROLE_REGISTRY.guanyin_pusa,
  BRAWL_ROLE_REGISTRY.zhenyuan_daxian,
  BRAWL_ROLE_REGISTRY.erlang_shen,
  BRAWL_ROLE_REGISTRY.nezha,
  BRAWL_ROLE_REGISTRY.li_tianwang,
  BRAWL_ROLE_REGISTRY.zhu_bajie,
  BRAWL_ROLE_REGISTRY.sha_wujing,
  BRAWL_ROLE_REGISTRY.bai_longma,
  // 红方 15 妖魔
  BRAWL_ROLE_REGISTRY.hong_haier,
  BRAWL_ROLE_REGISTRY.liuer_mihou,
  BRAWL_ROLE_REGISTRY.bai_gujing,
  BRAWL_ROLE_REGISTRY.zhizhu_jing,
  BRAWL_ROLE_REGISTRY.yutu_jing,
  BRAWL_ROLE_REGISTRY.laoshu_jing,
  BRAWL_ROLE_REGISTRY.niu_mowang,
  BRAWL_ROLE_REGISTRY.tieshan_gongzhu,
  BRAWL_ROLE_REGISTRY.huangmei_laoguai,
  BRAWL_ROLE_REGISTRY.jinjiao_dawang,
  BRAWL_ROLE_REGISTRY.yinjiao_dawang,
  BRAWL_ROLE_REGISTRY.huangfeng_guai,
  BRAWL_ROLE_REGISTRY.baiyan_mojun,
  BRAWL_ROLE_REGISTRY.qingmao_shizi,
  BRAWL_ROLE_REGISTRY.jinchi_dapeng,
].filter(Boolean);

import { BRAWL_PHASE_NAMES, BRAWL_TACTICAL_TIPS } from './brawl-roles';

type GuideSection = 'rules' | 'roles';
type GuideMode = 'brawl' | 'classic';

function guideChapters(section: GuideSection, mode: GuideMode = 'brawl') {
  if (mode === 'brawl') {
    return section === 'rules'
      ? brawlRuleChapters.map((title, i) => ({ title, id: `guide-brawl-rule-${i + 1}` }))
      : brawlRolesList.map(r => ({ title: r.name, id: `guide-brawl-role-${r.id}` }));
  }
  return section === 'rules'
    ? classicRuleChapters.map((title, i) => ({ title, id: `guide-rule-${i + 1}` }))
    : allRoles.map(role => ({ title: roleNames[role], id: `guide-role-${role}` }));
}

function GuideIndex({ section, mode, onJump }: { section: GuideSection; mode: GuideMode; onJump: (id: string) => void }) {
  return (
    <div className="guide-directory" id="guide-directory">
      <p className="guide-index-heading">{section === 'rules' ? '规则目录' : '角色目录'}</p>
      <nav className="guide-index" aria-label={section === 'rules' ? '规则章节定位' : '角色快速定位'}>
        {guideChapters(section, mode).map(({ title, id }) => (
          <button type="button" className="secondary" key={id} onClick={() => onJump(id)}>
            {title}
          </button>
        ))}
      </nav>
    </div>
  );
}

function composition(roles: Role[]) {
  return [...new Set(roles)].map(role => `${roleNames[role]}${roles.filter(r => r === role).length > 1 ? ` ×${roles.filter(r => r === role).length}` : ''}`).join('、');
}

/** 大乱斗模式专属规则介绍 */
export function BrawlGuideRules() {
  const playerCounts = [5, 6, 7, 8, 9, 10, 11, 12] as const;

  return (
    <div className="guide-rules">
      <section id="guide-brawl-rule-1" className="panel guide-section">
        <p className="eyebrow">01 / 仙魔三界对决</p>
        <h2>30位全明星神魔，弱技能碰撞，天机盲盒推理博弈</h2>
        <div className="guide-victories">
          <div className="allegiance-blue">
            <h3><Emblem kind="blue" />蓝方 · 取经仙佛</h3>
            <p>在五轮取经劫难中完成三次出征（蓝方出征只能投成功牌），并在终局刺杀中守护齐天大圣孙悟空免遭红孩儿三昧真火刺杀，即获全胜！</p>
          </div>
          <div className="allegiance-red">
            <h3><Emblem kind="red" />红方 · 混世妖魔</h3>
            <p>破坏三次出征任务（红方出征可投成功或失败牌），或由红孩儿在刺杀中准确刺中孙悟空，任一条件成立即可翻盘获胜！</p>
          </div>
        </div>
        <ul>
          <li><strong>开局基础视野</strong>：<strong>孙悟空</strong>看清红方妖气，但看不见佛相匿形的<strong>黄眉老怪</strong>（若开启【画皮惑眼】还会混入 1 位无辜蓝方假红气）；<strong>唐三藏</strong>能看见孙悟空与六耳猕猴，但不知谁真谁假；<strong>红方妖魔</strong>彼此相认，但<strong>孤狼牛魔王</strong>不与群妖互认（大圣仍能见其妖气）。</li>
          <li><strong>节奏保障</strong>：大乱斗模式取消传统“五次流局直接判负”，全面采用固定基础规则<strong>【两流必发】</strong>，让每一难都直奔真枪实弹的推理交锋。</li>
        </ul>
      </section>

      <section id="guide-brawl-rule-2" className="panel guide-section">
        <p className="eyebrow">02 / 人数配额与固定领军</p>
        <h2>5–12 人局固定领军、副法宝提纯与天机盲盒</h2>
        <p>西游大乱斗收录 15 位蓝方仙佛与 15 位红方妖魔（共 30 位全明星神魔），按对局人数区分两档固定领军安排：</p>
        <ul>
          <li><strong>5–8 人局（固定必出 4 位领军 + 附带随机副法宝）</strong>：蓝方必出<strong>孙悟空、唐三藏</strong>，红方必出<strong>红孩儿、六耳猕猴</strong>；其余席位从各阵营剩余 13 位神魔池中<strong>无放回随机抽取</strong>。为消除小局固定核心的白板感，这 4 位核心开局还会各额外获赐 <strong>1 个本局未出场的同阵营主动副法宝</strong>（红方副法宝不含孤狼牛魔王），确保人人有法宝可打！</li>
          <li><strong>9–12 人局（固定必出 6 位领军）</strong>：蓝方必出<strong>孙悟空、唐三藏、观音菩萨</strong>，红方必出<strong>红孩儿、六耳猕猴、黄眉老怪</strong>；其余席位从各阵营剩余 12 位神魔池中<strong>无放回随机抽取</strong>，强化大局的查验与反侦察深度！</li>
          <li><strong>天机盲盒侦察</strong>：未被抽入本局的神魔藏于盲盒之中，<strong>二郎神</strong>（开局窥 1 妖）、<strong>老鼠精</strong>（开局窥 1 仙）、<strong>百眼魔君</strong>（开局窥 1 仙）自带洞悉本局入场敌方名号的盲盒灵觉。</li>
        </ul>

        <div className="guide-configs" aria-label="大乱斗5至12人人数配置">
          {playerCounts.map(count => {
            const cfg = BRAWL_PLAYER_CONFIG[count];
            const sizes = BRAWL_MISSION_SIZES[count];
            const is9Plus = count >= 9;
            const twoFailMissions = [1, 2, 3, 4, 5].filter(m => failuresRequiredFor(count, m, true) === 2);
            return (
              <article key={count} className="guide-config">
                <h3>
                  {count} 人局
                  <span className="guide-config-split">（{cfg.blueTotal}蓝 {cfg.redTotal}红）</span>
                </h3>
                <p>
                  <strong>固定领军</strong>
                  {is9Plus
                    ? '6 位必出（蓝：孙悟空、唐三藏、观音菩萨；红：红孩儿、六耳猕猴、黄眉老怪）'
                    : '4 位必出（蓝：孙悟空、唐三藏；红：红孩儿、六耳猕猴）· 核心各附 1 随机同阵营主动副法宝'}
                </p>
                <p>
                  <strong>盲盒抽取</strong>
                  蓝方随机抽 {cfg.blueDrawCount} 位 · 红方{cfg.redDrawCount > 0 ? `随机抽 ${cfg.redDrawCount} 位` : '无额外盲盒席位（双首领各附随机妖宝）'}
                </p>
                <p className="hint guide-config-twofail-hint">
                  五难出征人数{twoFailMissions.length > 0 ? ` · 第 ${twoFailMissions.join('/')} 难需 2 张失败牌方算失败` : ' · 五难均 1 张失败牌即失败'}
                </p>
                <ol aria-label={`大乱斗${count}人局各任务人数`} className="guide-missions">
                  {sizes.map((size, i) => {
                    const needTwo = failuresRequiredFor(count, i + 1, true) === 2;
                    return (
                      <li key={i} className={needTwo ? 'is-two-fail' : ''}>
                        <span>{WUYUE_MISSIONS[i]?.shortLabel ?? `第${i + 1}难`}</span>
                        <strong>{size}人</strong>
                        {needTwo && <em className="guide-mission-two-fail">需2败</em>}
                      </li>
                    );
                  })}
                </ol>
              </article>
            );
          })}
        </div>
      </section>

      <section id="guide-brawl-rule-3" className="panel guide-section">
        <p className="eyebrow">03 / 两流必发、八十一难奇劫与立军令状</p>
        <h2>每难一劫多变博弈，零实体座次依赖</h2>
        <ul>
          <li><strong>【两流必发】（大乱斗常驻基础规则）</strong>：每难流局独立计数（进入新一难重置为 0/2）。单难连续流局 2 次后，第 3 轮保留领队点将与全员发言论道，随后<strong>跳过表决强制发车直接出征</strong>。强发轮不进入表决，纯表决类技能（哪吒、牛魔王、银角大王、猪八戒、沙悟净）将自动暂留保留，而镇元大仙【袖里乾坤】仍可出手收队换队长。</li>
          <li><strong>【立军令状】（第 2~4 难领队亲征特权）</strong>：第 2、3、4 难且本难非「舍己为公」时，领队若将自己编入出征名单，可自愿勾选【立军令状】公开担保本车：
            <ul>
              <li><strong>护经成功</strong>：领队获赐 1 次<strong>私密天眼查验</strong>任意 1 名其他玩家阵营的特权（整局最多成功兑现 1 次；查验尊重黄眉老怪假佛匿形，验到黄眉仍显蓝方清光）；</li>
              <li><strong>出征翻车</strong>：领队识人不明受罚，<strong>下一难全程禁止入选出征车队</strong>（即便领队本身为蓝方好人亦须受罚；若触发防死锁人数下限则自动豁免）；</li>
              <li><strong>流局作废</strong>：若立状车队表决未通过或被镇元大仙收队，军令状自动作废，不消耗全局限额。</li>
            </ul>
          </li>
          <li><strong>【八十一难 · 每难一劫】（开房可开关，默认开启）</strong>：开局从 5 张精锐奇劫牌库中无放回抽取 5 张不重复法则，每进入新一难自动翻开 1 张（其中「弱水流沙」绝不出现在第 1 难），全部零物理座次依赖：</li>
        </ul>

        <div className="guide-brawl-ordeal-grid" aria-label="八十一难五张奇劫法则卡">
          {ALL_BRAWL_ORDEAL_IDS.map(id => {
            const ordeal = BRAWL_ORDEAL_REGISTRY[id];
            return (
              <article key={id} className="guide-brawl-ordeal-card">
                <div className="guide-brawl-ordeal-head">
                  <span className="guide-brawl-ordeal-icon" aria-hidden="true">{ordeal.icon}</span>
                  <div>
                    <strong>{ordeal.name}</strong>
                    <small>{ordeal.tagline}</small>
                  </div>
                </div>
                <p>{ordeal.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="guide-brawl-rule-4" className="panel guide-section">
        <p className="eyebrow">04 / 房主设置与心仪选角</p>
        <h2>独立大乱斗配置、高阶信息迷雾与 30 角色独立战绩</h2>
        <dl className="guide-options">
          <dt>精简专属大乱斗选项（无经典版冗余项）</dt>
          <dd>本作已全面独立演进为《西游 · 仙魔大乱斗》，房主可自由调节 <strong>5–12 人局</strong>、<strong>普通房 / 声网实时语音房</strong>、<strong>队长分配（座位循环 / 开局随机）</strong>、<strong>匿名或实名组队投票</strong>、<strong>提前刺杀</strong>、<strong>倒计时后自动亮牌</strong>、<strong>心仪选角</strong>、<strong>八十一难奇劫</strong>与<strong>画皮惑眼</strong>；传统经典版的“护法天机”“8–12 人经典法宝”“五次流局判负”均已移除，由 30 位神魔独立神通与固定【两流必发】全面替代。</dd>
          <dt>画皮惑眼（高阶可选开关）</dt>
          <dd>开启后，系统开局从除孙悟空、唐三藏外的蓝方仙友中随机选定 1 人笼罩虚幻妖气，在孙悟空的火眼金睛中误显红光！打破“大圣全知上帝视角”，迫使双方深化推理博弈，终局复盘将揭晓假红真身。</dd>
          <dt>心仪神魔选角（最多 5 位志愿）</dt>
          <dd>房主开启后，每位玩家可在等待区从 30 位全明星神魔中私密预选最多 <strong>5 位心仪志愿</strong>（第 1→5 志愿依次优先纳入盲盒并按阵营分配，同时兼顾首领防连庄与近期角色防重复保护）。选角志愿对其他玩家全程保密。</dd>
          <dt>30 位神魔独立建档战绩</dt>
          <dd>每局结束后，桌面全员直接亮明 30 位神魔真实法相与名号；个人中心「我的战绩」按 30 位神魔角色各自独立统计出场与胜率，绝不混归为传统护法或女妖精。</dd>
        </dl>
      </section>

      <section id="guide-brawl-rule-5" className="panel guide-section">
        <p className="eyebrow">05 / 30位弱技能设计原则</p>
        <h2>彻底脱离实体坐席几何限制，内置流局退还与永久回执</h2>
        <p>所有 30 位神魔弱技能均严格脱离现场实体排座与顺逆时针依赖，所有封禁技能内置防死锁人数护栏：</p>
        <ul>
          <li><strong>投票权重与反制型</strong>：哪吒三太子【三头六臂】与牛魔王【平天撼地】投票计 2 票；银角大王【移山压顶】强制压制 1 人弃权；猪八戒【倒打一耙】流局反转 1 张反对票；沙悟净【降妖宝杖】流局 {pct(BRAWL_SKILL_PROBS.SHA_PASS)} 概率强行反转为发车通过；</li>
          <li><strong>组队资格与换队型</strong>：如来佛祖【五行山掌】禁锢 1 人当轮禁止上车与投票；蜘蛛精【盘丝结茧】与青毛狮子怪【大口吞天】封禁或吞走剔除 1 名非队长队员；白龙马【龙马负重】队伍名额上限临时 +1；镇元大仙【袖里乾坤】收队换下任队长重选且不增加本难流局计数；</li>
          <li><strong>任务增减与保底翻盘型</strong>：王母娘娘【九转仙桃】任意车队出征前均可赐桃，若出现失败牌有 {pct(BRAWL_SKILL_PROBS.WANGMU_PARDON)} 概率当场化解赦免 1 张失败牌；玉皇大帝【天尊玉旨】出征结算前提前降旨蓄力，本轮失败时 1 败 {pct(BRAWL_SKILL_PROBS.YUHUANG_ONE_FAIL)} 概率逆转为胜、2 败 {pct(BRAWL_SKILL_PROBS.YUHUANG_TWO_FAIL)} 概率逆转为胜；白骨精【画皮离间】失败时静默虚增 1 败；金角大王【紫金葫芦】{pct(BRAWL_SKILL_PROBS.JINJIAO_ABSORB)}、玉兔精【捣药迷魂】{pct(BRAWL_SKILL_PROBS.YUTU_DISCARD)}、百眼魔君【黄花毒茶】大车 {pct(BRAWL_SKILL_PROBS.BAIYAN_BIG_TEAM)}/小车 {pct(BRAWL_SKILL_PROBS.BAIYAN_SMALL_TEAM)} 暗中破坏目标成功牌；</li>
          <li><strong>盲盒侦测、查验与收缴型</strong>：二郎神、老鼠精、百眼魔君开局窥探盲盒；观音菩萨【净瓶甘露】无论成败 100% 验明随队目标真实出牌；托塔李天王【照妖宝镜】待领队点出队员后举镜查验车队是否含妖魔（队伍未选人时不消耗法宝）；菩提祖师【道法点化】与黄眉老怪【假设雷音】上演真假密信博弈；太上老君【金刚琢】提前悬空自动套走下一次红方主动法宝；金翅大鹏雕【云程万里】提前蓄力于终局为红孩儿排除 1 个非大圣席位！</li>
          <li><strong>流局自动退还 &amp; 永久私密回执</strong>：王母娘娘、玉皇大帝、观音菩萨、白骨精、金角大王、玉兔精、百眼魔君等在出征前提前蓄力/锁人的任务型法宝，若本轮组队表决流局或被镇元大仙收队，<strong>法宝次数自动全额退还</strong>；且所有法宝施展后的探查结论、生效结果、0 失败未触发或被金刚琢收缴的反馈，均<strong>永久保留在【真身】底牌</strong>中，跨轮随时可回看。</li>
        </ul>
      </section>

      <section id="guide-brawl-rule-6" className="panel guide-section">
        <p className="eyebrow">06 / 天机战报“公法不公人”原则 · 回执与全景复盘</p>
        <h2>显性公法匿名播报，暗算密探静默至终局全量解密</h2>
        <p>为兼顾“信息风暴”与“桌游盘逻辑”的纯粹体验，大乱斗战报采用<strong>显性公法白名单 + 暗算密探静默执行</strong>双轨机制：</p>
        <ul>
          <li><strong>显性公法白名单（公法不公人）</strong>：如来佛祖、蜘蛛精、青毛狮子怪、白龙马、镇元大仙、王母娘娘、玉皇大帝、太上老君、沙悟净、猪八戒、哪吒三太子、牛魔王、银角大王，以及八十一难奇劫与军令状，发动时会在公屏实时播报【天机战报】——全员知晓法术效果正在生效，但<strong>绝不透露施法者的座位号与昵称</strong>；</li>
          <li><strong>暗算密探静默执行（零剧透不自爆）</strong>：白骨精、百眼魔君、黄眉老怪、金角大王、玉兔精、观音菩萨、托塔李天王、菩提祖师、铁扇公主、黄风怪、金翅大鹏雕的技能在局中<strong>严格静默不发公屏战报</strong>，仅当事人于【真身】底牌永久留存私密回执，彻底避免暗算与密探自爆身份；</li>
          <li><strong>终局全景解密与逐轮法宝实录</strong>：对局结束后，桌面与历史复盘页均展示全员 30 位神魔真实法相与 5–8 人副法宝，并自动解密【仙魔对局全景复盘】及每一难每一轮的【仙妖斗法实录】，完整还原每位玩家施展了何种法宝、具体生效/未触发/退还结果、画皮假红真身与混沌迷雾真实牌数！</li>
        </ul>
      </section>
    </div>
  );
}

/** 大乱斗模式 30 位全明星角色图鉴（15 蓝方仙佛 vs 15 红方混世妖魔） */
export function BrawlGuideRoles({ onSelectRole }: { onSelectRole?: (role: BrawlRoleDef) => void }) {
  const blueRoles = brawlRolesList.filter(r => r.camp === 'blue');
  const redRoles = brawlRolesList.filter(r => r.camp === 'red');

  const phaseNames = BRAWL_PHASE_NAMES;

  const renderRoleCard = (role: BrawlRoleDef) => {
    const factionClass = `allegiance-${role.camp}`;
    const factionLabel = role.camp === 'blue' ? '蓝方 · 取经仙佛' : '红方 · 混世妖魔';

    return (
      <article id={`guide-brawl-role-${role.id}`} className={`guide-role ${factionClass}`} key={role.id}>
        <div
          className="guide-role-heading guide-role-interactive"
          onClick={() => onSelectRole?.(role)}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectRole?.(role);
            }
          }}
          title="点击鉴赏此神魔高清立绘大图"
        >
          <span className={`role-portrait portrait-tile ${factionClass}`} role="img" aria-label={`${role.fullName}法相图案`}>
            <img
              src={assetUrl(`/art/roles/${role.artPrefix}-160.webp?v=brawl-art-v3`)}
              alt={role.name}
              width={160}
              height={160}
              loading="lazy"
            />
          </span>
          <div className="guide-role-meta">
            <div className="guide-role-badges">
              <span className="guide-role-faction-pill">{factionLabel}</span>
              <span className="guide-role-title-pill">{role.title}</span>
              {BRAWL_ALL_CORE_IDS.has(role.id) && <span className="guide-role-core-pill">全人数必出</span>}
              {BRAWL_NINE_PLUS_CORE_IDS.has(role.id) && <span className="guide-role-core-pill is-nine-plus">9人+必出</span>}
            </div>
            <h3>{role.fullName}</h3>
            <p className="guide-role-motto">{role.motto}</p>
            <span className="guide-role-inspect-hint">🔍 点击赏析完整法相大图 ›</span>
          </div>
        </div>

        <dl className="guide-role-dl">
          <div className="guide-role-detail">
            <dt>专属神通</dt>
            <dd style={{ color: '#92400e', fontWeight: 'bold' }}>【{role.skill.skillName}】</dd>
          </div>
          <div className="guide-role-detail">
            <dt>施法时机</dt>
            <dd>{phaseNames[role.skill.triggerPhase] || role.skill.triggerPhase} · {role.skill.actionType === 'passive' ? '常驻被动' : '整局限用 1 次'}</dd>
          </div>
          <div className="guide-role-detail">
            <dt>神通效果</dt>
            <dd>{role.skill.description}</dd>
          </div>
          <div className="guide-role-detail">
            <dt>西游战术</dt>
            <dd>{BRAWL_TACTICAL_TIPS[role.id] || '巧妙配合阵营同伴，灵活把握施法时机！'}</dd>
          </div>
        </dl>
      </article>
    );
  };

  return (
    <div className="guide-roles">
      <p className="hint">
        这里展示《西游 · 仙魔大乱斗》全部 30 位全明星神魔图鉴。5–8 人局固定 4 位核心（悟空/唐僧/红孩儿/六耳，各附 1 随机同阵营主动副法宝）；9–12 人局固定 6 位领军（增设观音菩萨与黄眉老怪），其余席位无放回盲盒抽取。点击任意法相可鉴赏高清立绘大图。
      </p>

      {/* 蓝方 15 仙佛 */}
      <section aria-label="蓝方仙佛介绍" className="guide-faction allegiance-blue">
        <h2>
          <Emblem kind="blue" />
          蓝方 · 取经仙佛（15位）
        </h2>
        <div className="guide-role-grid">
          {blueRoles.map(renderRoleCard)}
        </div>
      </section>

      {/* 红方 15 妖魔 */}
      <section aria-label="红方妖魔介绍" className="guide-faction allegiance-red">
        <h2>
          <Emblem kind="red" />
          红方 · 混世妖魔（15位）
        </h2>
        <div className="guide-role-grid">
          {redRoles.map(renderRoleCard)}
        </div>
      </section>
    </div>
  );
}

/** 通用原版规则介绍（保持向后兼容） */
export function GuideRules({ mode = 'classic' }: { mode?: GuideMode }) {
  if (mode === 'brawl') {
    return <BrawlGuideRules />;
  }

  return (
    <div className="guide-rules">
      <section id="guide-rule-1" className="panel guide-section">
        <p className="eyebrow">01 / 佛魔真假对决</p>
        <h2>一念佛魔皆幻相，谁是修道取经人</h2>
        <div className="guide-victories">
          <div className="allegiance-blue">
            <h3><Emblem kind="blue" />蓝方 · 取经正果</h3>
            <p>在五轮劫难中完成三次取经任务，并护住齐天大圣孙悟空躲过红孩儿的三昧真火刺杀，即可获胜。</p>
          </div>
          <div className="allegiance-red">
            <h3><Emblem kind="red" />红方 · 群妖乱道</h3>
            <p>破坏三次取经任务、让流局次数达到五次，或由红孩儿刺杀命中孙悟空，任一条件成立即可获胜。</p>
          </div>
        </div>
        <p className="hint">开启提前刺杀时，红孩儿若刺错目标，蓝方立即获胜。中断对局不计胜负。</p>
      </section>

      <section id="guide-rule-2" className="panel guide-section">
        <p className="eyebrow">02 / 取经五难流程</p>
        <h2>从聚义，到证果</h2>
        <ol className="guide-steps">
          <li className="guide-step-card">
            <div className="guide-step-header">
              <Emblem kind="cards" />
              <div className="guide-step-title-wrap">
                <strong>准备与发牌</strong>
                <small>全员准备，倒计时5秒</small>
              </div>
            </div>
            <p>5–12位玩家入座且全员准备后，由房主点击开始发牌。所有人同步倒计时5秒，结束后各自在手机上私下查看底牌法相（取经护法与女妖精均会随机分配专属法相名号），首任领队（队长）即可开始点将组队。</p>
            <p className="hint">点击开局后设置与席位锁定。刷新或重连继续原局、原身份和原倒计时；不会重新计时或重新洗牌。</p>
          </li>
          <li className="guide-step-card">
            <div className="guide-step-header">
              <Emblem kind="crown" />
              <div className="guide-step-title-wrap">
                <strong>领队点将，真假论道</strong>
                <small>预选实时同步，投票前可修改</small>
              </div>
            </div>
            <p>每局共历 1–5 五场修道劫难（依次为：1·五行揭帖、2·流沙收徒、3·三打白骨、4·真假雷音、5·灵山取经）。领队按本场劫难要求选人（可选自己），并指定顺时针或逆时针发言。领队点击“预选阵容”后全员按序论道发言；发言完毕后领队点击“已确认阵容 · 开启投票”发起全员表决，此后不可再改。</p>
          </li>
          <li className="guide-step-card">
            <div className="guide-step-header">
              <Emblem kind="chronicle" />
              <div className="guide-step-title-wrap">
                <strong>全员表决</strong>
                <small>赞成多于反对即通过</small>
              </div>
            </div>
            <p>每人提交赞成、反对或弃权，收齐后结算。赞成票多于反对票即通过；弃权不参与比较，平票或全员弃权不通过。未通过记一次流局，换下一位队长重新组队，不推进劫难编号。</p>
          </li>
          <li className="guide-step-card">
            <div className="guide-step-header">
              <Emblem kind="blue" />
              <div className="guide-step-title-wrap">
                <strong>护法出征执行取经</strong>
                <small>任务出牌始终匿名</small>
              </div>
            </div>
            <p>只有入选队员提交任务牌。蓝方取经人只能提交成功；红方群妖可以提交成功或失败。任务牌始终匿名，只公布成功、失败的数量。</p>
            <p>通常出现一张失败牌即取经受阻失败。唯独7–12人局的第四难（4·真假雷音），以及11人、12人局的第三难（3·三打白骨），需要至少两张失败牌才算失败。</p>
          </li>
          <li className="guide-step-card">
            <div className="guide-step-header">
              <Emblem kind="assassin" />
              <div className="guide-step-title-wrap">
                <strong>轮换与真火刺杀</strong>
                <small>三次成功后，仍须守护孙悟空</small>
              </div>
            </div>
            <p>每场任务结束后换下一位队长。三场任务失败立即红方胜；三场任务成功则进入终局刺杀，红方可当面商议，由红孩儿确认刺杀目标。命中孙悟空红方翻盘获胜，否则蓝方取经正果获胜。</p>
          </li>
        </ol>
        <p className="hint">投票提交成功后不可修改。断线不代投、不自动判负；重连后可继续。确实无法继续时，可向房主申请中止；房主同意或主动结束后关闭房间，全员返回大厅，不计胜负。</p>
      </section>

      <section id="guide-rule-3" className="panel guide-section">
        <p className="eyebrow">03 / 配置与规模</p>
        <h2>人数、角色与取经五难</h2>
        <div className="guide-configs">
          {Object.entries(ROLE_CONFIG).map(([count, roles]) => (
            <article key={count} className="guide-config">
              <h3>{count} 人局</h3>
              <p><strong>蓝方</strong> {composition(roles.filter(r => roleTeam(r) === 'blue'))}</p>
              <p><strong>红方</strong> {composition(roles.filter(r => roleTeam(r) === 'red'))}</p>
              <p className="hint">取经五难（1–5）出征人数</p>
              <ol aria-label={`${count}人局各任务人数`} className="guide-missions">
                {MISSION_SIZES[Number(count)].map((size, i) => (
                  <li key={i}>
                    <span>{WUYUE_MISSIONS[i]?.shortLabel ?? `第${i + 1}次`}</span>
                    <strong>{size}人</strong>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section id="guide-rule-4" className="panel guide-section">
        <p className="eyebrow">04 / 房主约定</p>
        <h2>开局前，约定取经规矩</h2>
        <dl className="guide-options">
          <dt>队长顺序</dt>
          <dd>默认按座位循环；也可开局打乱一次，此后整局按该顺序循环。房主与当轮队长是两个概念。</dd>
          <dt>组队投票是否匿名</dt>
          <dd>5–7人默认匿名，8–12人默认公开；房主开局前可修改。公开模式实时显示已提交的赞成、反对或弃权；匿名模式只展示是否已投和最终总票数。任务出牌在两种设置下都始终匿名。</dd>
          <dt>五次流局</dt>
          <dd>默认全局累计，达到五次红方胜；也可只累计当前任务，实际任务结束后清零。一次组队表决未通过记一次流局。</dd>
          <dt>心仪选角（加权偏好）</dt>
          <dd>房主可选开启。玩家可设置 3 个志愿，第一、第二、第三志愿及其他角色的基础权重为 8 / 4 / 2 / 1；近期重复角色会降低权重。系统结合本局角色数量与保护条件随机发牌，志愿提高获得机会，但不保证命中。意向不向其他玩家公开。</dd>
          <dt>实时语音房与麦克风指示</dt>
          <dd>支持开启声网高清实时语音；入座仙友的头像座次上将实时显示麦克风指示（绿波开麦、浅绿就绪、灰色静音），方便相互感知开麦状态。</dd>
          <dt>新成员加入</dt>
          <dd>等待时房主可关闭新成员加入，已有成员仍可重连。开局后锁定席位。修改玩法会清除准备状态，切换接纳开关不会。</dd>
        </dl>
      </section>

      <section id="guide-rule-5" className="panel guide-section">
        <p className="eyebrow">05 / 刺杀与天机</p>
        <h2>提前刺杀与护法天机</h2>
        <h3 className="guide-sub-heading">提前刺杀</h3>
        <p>可选开启。完成第二个实际任务起，在轮间确认窗口由红孩儿（刺客）私下决定发起或跳过；此后的任务结束或组队流局也可能再出现窗口，流局本身不计实际任务。</p>
        <ul>
          <li>每局最多发起一次。跳过本次窗口不会消耗机会。</li>
          <li>发起后不能撤回，红孩儿必须选人；命中孙悟空红方胜，刺错则立即蓝方胜。</li>
          <li>不能在投票或任务出牌过程中随时打断。</li>
          <li>其他玩家只看到“轮间确认中”，不会获知谁是红孩儿。</li>
        </ul>
        <p>新开对局按护法人数依次选入白龙、猪八戒、沙悟净、金刚，再随机分配给护法玩家；人物各自的护法天机能力保持不变。旧局及历史复盘沿用原分配结果。</p>
        <h3 className="guide-sub-heading">护法天机（建议7-12人）</h3>
        <p>可选开启，建议7人以上对局开启。开启后为闭眼的「取经护法」赋予专属微弱灵觉，各显神通：</p>
        <p className="hint">新局同时开启护法天机与法宝模式时，蓝方阵营的法宝禁用，红方法宝保留；角色原有身份视野和护法天机线索照常生效。</p>
        <ul>
          <li><strong>猪八戒（八戒巡山）</strong>：探知一名仙友绝非六耳猕猴（假猴王）。</li>
          <li><strong>沙悟净（同修感应）</strong>：感应到另一位亦是取经护法的同修仙友（若无其他护法则感应唯君独守）。</li>
          <li><strong>白龙（龙驹护圣）</strong>：感知两位仙友之中，必有一位是大唐圣僧唐三藏（另一位为红方群妖）。</li>
          <li><strong>金刚（金刚怒目）</strong>：金光察知两位仙友之中，至少潜藏一位混世妖魔（绝不包含齐天大圣孙悟空）。</li>
        </ul>
        <p className="notice">判定顺序：先判断终局；未终局时进入提前刺杀窗口。三次任务成功走正常刺杀，三次失败或五次流局直接结束。护法天机线索为私下查验信息，不直接揭示大圣真身，兼顾平衡与乐趣。</p>
      </section>

      <section id="guide-rule-6" className="panel guide-section">
        <p className="eyebrow">06 / 仙家专属法宝</p>
        <h2>8–12人局专属法宝奇谋</h2>
        <p>房主开局前可勾选开启【8–12人专属法宝模式】。新局若未开启护法天机，双方按角色保留法宝；若已开启护法天机，则蓝方法宝禁用，仅红方法宝生效。对局页统一提供【法宝】入口，按角色、人数与本局规则开放使用。法宝规则公开，私密查验与传音仅当事人可见：</p>
        <p className="hint">蓝方法宝禁用时，九环锡杖、慈航照妖镜与紧箍信物均不可使用，也不会出现观音法宝等待期。已开局对局与历史复盘沿用各自保存的规则。</p>
        <ul>
          <li><strong>大唐圣僧 ·【九环锡杖】</strong>：第 2 轮任务完成后，私密查验 1 位盲区仙友气息（排除自己与真假猴王，查验黄眉老怪仍显蓝方）。整局限用 1 次。</li>
          <li><strong>南海观音 ·【慈航照妖镜】</strong>：组队通过后全场进入 5 秒中立决断期，观音可一键点选车队 1 人私密辨察纯善/妖邪（或跳过保留至后续轮次），全场仅中立倒计时，绝不暴露观音编号。整局限用 1 次。</li>
          <li><strong>小雷音寺黄眉 ·【后天人种袋】</strong>：第 3/4 轮提名前，禁锢 1 名仙友本轮不可被选入车队（当轮队长不可被禁，打破好人抱团车）。整局限用 1 次。</li>
          <li><strong>取经护法 ·【紧箍信物】</strong>：当好人阵营输掉 2 轮任务（0:2 或 1:2 绝境）时激活，可消耗信物向唐三藏自证，唐三藏将收到全屏【金箍显圣 · 护法归位】弹窗并点亮护法神座角标。整局限用 1 次。</li>
          <li><strong>平天大圣牛魔王 ·【芭蕉神扇】</strong>：采用预设狂风机制，若投票通过立刻吹散换下任队长，绝对不计入 5 次流局上限，全场 0 延迟。整局限用 1 次。</li>
          <li><strong>女妖精 ·【同心铃】</strong>：11–12人局中，整局一次，向同车且已相认的同伙发送「建议护经」或「建议作祟」。仅限一张失败牌即失败的任务，双方都须未出牌，不含牛魔王。私密传音不透露发送者座位、不要求回复、不改动任务牌。</li>
          <li><strong>圣婴大王红孩儿 ·【火尖枪】</strong>：刺客专属神兵，终局刺杀选定真大圣一击定乾坤。未开启法宝模式时全局亦通用此入口。</li>
          <li><strong>齐天大圣孙悟空 & 假猴王六耳猕猴</strong>：坚决不持任何法宝，潜龙在渊，深藏功名。</li>
        </ul>
        <p className="notice">✦ 战术防坑铁律：所有法宝能力与名称在本规则与仙魔谱中全员公开查阅。公屏背诵法宝规则不能作为自证身份的凭据（坏人亦可假冒法宝发言）；真取经人须凭行事、票型与私密系统显圣综合判断！</p>
      </section>
    </div>
  );
}

/** 通用原版角色图鉴（保持向后兼容） */
export function GuideRoles({ mode = 'classic', onSelectBrawlRole }: { mode?: GuideMode; onSelectBrawlRole?: (role: BrawlRoleDef) => void }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (mode === 'brawl') {
    return <BrawlGuideRoles onSelectRole={onSelectBrawlRole} />;
  }

  const openViewer = (role: Role, guardian?: LoyalGuardian, demon?: FemaleDemon) => {
    let idx = -1;
    if (guardian) {
      idx = ALL_GALLERY_ROLES.findIndex(r => r.role === 'loyal' && r.loyalGuardian === guardian);
    } else if (demon) {
      idx = ALL_GALLERY_ROLES.findIndex(r => r.role === 'minion' && r.femaleDemon === demon);
    } else {
      idx = ALL_GALLERY_ROLES.findIndex(r => r.role === role);
    }
    if (idx !== -1) setViewerIndex(idx);
  };

  return (
    <div className="guide-roles">
      <p className="hint">这里介绍《嘻游 · 真假猴王》全部神魔人物的通用规则，不显示本局谁拿到了什么身份。准确角色仅由本人查看，终局才公开。点击任意法相可鉴赏高清立绘大图。</p>
      {(['blue', 'red'] as const).map(team => (
        <section key={team} aria-label={`${team === 'blue' ? '蓝方' : '红方'}角色介绍`} className={`guide-faction allegiance-${team}`}>
          <h2>
            <Emblem kind={team} />
            {team === 'blue' ? '蓝方 · 取经正果' : '红方 · 群妖乱道'}
          </h2>
          <div className="guide-role-grid">
            {allRoles.filter(r => roleTeam(r) === team).map(role => (
              <article id={`guide-role-${role}`} className={`guide-role allegiance-${team}`} key={role}>
                <div
                  className="guide-role-heading guide-role-interactive"
                  onClick={() => openViewer(role)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openViewer(role);
                    }
                  }}
                  title="点击鉴赏此神魔高清立绘大图"
                >
                  <RolePortrait role={role} />
                  <div className="guide-role-meta">
                    <div className="guide-role-badges">
                      <span className="guide-role-faction-pill">{team === 'blue' ? '蓝方 · 取经正果' : '红方 · 群妖乱道'}</span>
                      <span className="guide-role-title-pill">{roleTitles[role]}</span>
                    </div>
                    <h3>
                      {roleNames[role]}
                      {role === 'loyal' ? '（白龙 / 猪八戒 / 沙悟净 / 金刚）' : ''}
                      {role === 'minion' ? '（玉兔精 / 白骨精 / 老鼠精 / 蜘蛛精）' : ''}
                    </h3>
                    <p className="guide-role-motto">{roleMottos[role]}</p>
                    <span className="guide-role-inspect-hint">🔍 点击赏析完整法相大图 ›</span>
                  </div>
                </div>

                <dl className="guide-role-dl">
                  <div className="guide-role-detail"><dt>能力与视野</dt><dd>{roleDescriptions[role].ability}</dd></div>
                  <div className="guide-role-detail"><dt>谁能看见你</dt><dd>{roleDescriptions[role].visibility}</dd></div>
                  <div className="guide-role-detail"><dt>专属法宝</dt><dd>{roleTreasures[role]}</dd></div>
                  <div className="guide-role-detail"><dt>玩法提示</dt><dd>{roleDescriptions[role].tip}</dd></div>
                </dl>

                {/* Sub-gallery for Loyal Guardians */}
                {role === 'loyal' && (
                  <div className="sub-figures-section">
                    <h4 className="sub-figures-title">✦ 四位取经护法使者法相（点击鉴赏高清立绘大图）：</h4>
                    <div className="sub-figures-grid">
                      {Object.values(LOYAL_GUARDIANS).map(g => (
                        <button
                          key={g.key}
                          type="button"
                          className="sub-figure-card allegiance-blue"
                          onClick={() => openViewer('loyal', g.key)}
                          aria-label={`${g.fullName}法相立绘`}
                        >
                          <span className="sub-figure-avatar">
                            <img src={assetUrl(`/art/roles/${g.artPrefix}-160.webp?v=audit1`)} alt={g.name} />
                          </span>
                          <span className="sub-figure-title">{g.title}</span>
                          <strong className="sub-figure-name">{g.name}</strong>
                          <span className="sub-figure-zoom">🔍 大图</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-gallery for Female Demons */}
                {role === 'minion' && (
                  <div className="sub-figures-section">
                    <h4 className="sub-figures-title">✦ 四位绝色妖仙法相（点击鉴赏高清立绘大图）：</h4>
                    <div className="sub-figures-grid">
                      {Object.values(FEMALE_DEMONS).map(d => (
                        <button
                          key={d.key}
                          type="button"
                          className="sub-figure-card allegiance-red"
                          onClick={() => openViewer('minion', undefined, d.key)}
                          aria-label={`${d.fullName}法相立绘`}
                        >
                          <span className="sub-figure-avatar">
                            <img src={assetUrl(`/art/roles/${d.artPrefix}-160.webp?v=audit1`)} alt={d.name} />
                          </span>
                          <span className="sub-figure-title">{d.title}</span>
                          <strong className="sub-figure-name">{d.name}</strong>
                          <span className="sub-figure-zoom">🔍 大图</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
      <p className="hint">蓝方所有角色的任务牌都只能选成功；红方所有角色都可以选成功或失败。红方互认仅显示阵营，不揭示队友的具体角色。</p>

      {/* Full Artwork Modal Viewer */}
      <RoleViewerModal
        item={viewerIndex !== null ? ALL_GALLERY_ROLES[viewerIndex] : null}
        onClose={() => setViewerIndex(null)}
        onPrev={() => setViewerIndex(i => (i !== null ? (i - 1 + ALL_GALLERY_ROLES.length) % ALL_GALLERY_ROLES.length : 0))}
        onNext={() => setViewerIndex(i => (i !== null ? (i + 1) % ALL_GALLERY_ROLES.length : 0))}
        currentIndex={viewerIndex ?? undefined}
        totalCount={ALL_GALLERY_ROLES.length}
      />
    </div>
  );
}

export function GuidePanel({ onBack }: { onBack: () => void }) {
  const [section, setSection] = useState<GuideSection>('roles');
  const [destination, setDestination] = useState('');
  const [activeBrawlRole, setActiveBrawlRole] = useState<BrawlRoleDef | null>(null);

  const guideRef = useRef<HTMLElement>(null);
  const navigationRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    const measure = () => guideRef.current?.style.setProperty('--guide-navigation-height', `${navigation.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(navigation);
    return () => observer.disconnect();
  }, []);

  usePageSound(section);

  const changeSection = (next: GuideSection) => {
    setSection(next);
    setDestination('');
    window.scrollTo({ top: 0 });
  };

  const jumpTo = (id: string) => {
    setDestination(id);
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  };

  const returnToDirectory = () => {
    setDestination('');
    document.getElementById('guide-directory')?.scrollIntoView({ block: 'start' });
  };

  const brawlGalleryItem: RoleGalleryItem | null = activeBrawlRole ? {
    id: activeBrawlRole.id,
    role: 'loyal',
    name: activeBrawlRole.name,
    fullName: activeBrawlRole.fullName,
    title: activeBrawlRole.title,
    motto: activeBrawlRole.motto,
    story: `【${activeBrawlRole.skill.skillName}】${activeBrawlRole.skill.description}`,
    team: activeBrawlRole.camp === 'red' ? 'red' : 'blue',
    artPrefix: activeBrawlRole.artPrefix,
  } : null;

  return (
    <section className="guide guide-flow" ref={guideRef}>
      <div className="guide-navigation" ref={navigationRef}>
        <div className="guide-controls">
          <button
            type="button"
            className="secondary guide-back-icon-btn"
            aria-label="返回原页面"
            title="返回原页面"
            onClick={onBack}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <nav className="guide-nav" aria-label="说明分类">
            <button type="button" className="secondary" aria-label="角色介绍" aria-pressed={section === 'roles'} onClick={() => changeSection('roles')}>角色</button>
            <button type="button" className="secondary" aria-label="游戏规则" aria-pressed={section === 'rules'} onClick={() => changeSection('rules')}>规则</button>
          </nav>
          <select className="guide-chapter-select" aria-label={section === 'rules' ? '跳转规则章节' : '跳转角色介绍'} value={destination} onChange={e => jumpTo(e.target.value)}>
            <option value="" disabled>章节跳转</option>
            {guideChapters(section, 'brawl').map(({ title, id }) => <option key={id} value={id}>{title}</option>)}
          </select>
          <button type="button" className="secondary" aria-label="返回目录" onClick={returnToDirectory}>目录 ↑</button>
        </div>
      </div>

      <div className="guide-heading">
        <div>
          <p className="eyebrow">WESTWARD BRAWL / 仙魔对决天机卷</p>
          <h1>《西游 · 仙魔大乱斗》</h1>
          <p className="muted">30位西游神魔全明星阵容，弱技能碰撞，天机盲盒推理博弈</p>
        </div>
      </div>

      <GuideIndex section={section} mode="brawl" onJump={jumpTo} />

      {section === 'rules' ? (
        <BrawlGuideRules />
      ) : (
        <BrawlGuideRoles onSelectRole={setActiveBrawlRole} />
      )}

      {/* 大乱斗高清立绘大图弹窗 */}
      <RoleViewerModal
        item={brawlGalleryItem}
        onClose={() => setActiveBrawlRole(null)}
      />
    </section>
  );
}
