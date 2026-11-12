import { assetUrl } from './deployment';
import { useLayoutEffect, useRef, useState } from 'react';
import { usePageSound } from './audio-interactions';
import type { FemaleDemon, LoyalGuardian, Role, BrawlRoleDef } from '@avalon/contracts';
import { ROLE_CONFIG, MISSION_SIZES, BRAWL_ROLE_REGISTRY } from '@avalon/game-core';
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
  '全明星抽卡与盲盒',
  '黑熊精暗身抉择',
  '31位弱技能设计',
  '天机战报公法不公人',
];

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
  // 中立 1 守山大神
  BRAWL_ROLE_REGISTRY.heixiong_jing,
].filter(Boolean);

const brawlTacticalTips: Record<string, string> = {
  sun_wukong: '蓝方核心。开局看清红方妖气；任务三胜后务必隐藏锋芒，模仿普通护法语气，防范红孩儿终局刺杀。',
  tang_seng: '蓝方领队。辨出真假大圣（孙悟空与六耳猕猴）却不知谁真谁假，需通过挑人试探与发言破绽辨识真猴。',
  rulai_fozu: '强力控场。在挑人前祭出五行山掌禁锢嫌疑极大的坏人，使其当轮既不能进队也不能投票，强行粉碎坏人车。',
  yuhuang_dadi: '神迹翻盘。任务仅出 1 张失败牌时降旨，50% 概率将其赦免为成功，是好人在关键决胜轮的强力护盾。',
  wangmu_niangniang: '大车克星。仅对 4 人及以上车队有效，赐九转仙桃将失败门槛升至 2 张失败牌，彻底打消好人不敢组大车的顾虑。',
  taishang_laojun: '法宝克星。当场上任意妖魔施展主动技能时，老君祭起金刚琢当场套走收缴其效果，是红方强力技能的终极梦魇。',
  puti_zhushi: '道法点化。第 2 轮任务后，50% 概率让除孙悟空外的 1 名随机蓝方私密得知 1 位红方真名，为好人暗中注入铁逻辑。',
  guanyin_pusa: '甘露辨忠。组队前洒甘露标记一人，若队伍出征且任务失败，私下获知其是否投了成功，精准揪出内鬼。',
  zhenyuan_daxian: '大袖乾坤。眼见恶人队伍即将票过时，大袖一挥收走全队强制流局且不扣全局流局上限，救全场于水火。',
  erlang_shen: '天眼照虚。开局天眼洞开，直接看穿红方盲盒抽中的 1 位妖魔名号，提前知晓红方潜伏的技能底细。',
  nezha: '乾坤一掷。在关键队伍公开表决时，哪吒投票权重计为 2 票，关键时刻单枪匹马强行扭转战局。',
  li_tianwang: '照妖宝镜。队伍敲定后举镜探查，私密得知当前队伍是否包含妖魔，是好人队长验车的绝对神器。',
  zhu_bajie: '倒打一耙。组队表决未通过时倒打一耙，将全场最后 1 张反对票反转为赞成票，强行保护好人车出征。',
  sha_wujing: '定海神针。自己当队长提议平票时，降妖宝杖定海强制判定通过，是忠诚可靠的破局底牌。',
  bai_longma: '负重破局。挑人时主动负重，队长当轮队伍名额临时 +1，多保 1 名好人上车稀释翻车风险。',
  hong_haier: '红方刺客。开局与同伙互认，任务三败可获胜；若蓝方三胜，需依据全场发言与票型精准一击刺杀孙悟空。',
  liuer_mihou: '绝命假圣。在唐三藏眼中与真大圣一模一样，需极力模仿悟空的思维与语气误导唐僧，诱杀真猴。',
  bai_gujing: '画皮千幻。开局 50% 概率不显妖气（孙悟空视野盲区），可放心大胆带节奏、假冒好人甚至反向套话。',
  zhizhu_jing: '盘丝控场。挑人阶段吐丝将 1 名仙友结茧，当轮禁止被选入队伍，精准拆解好人稳固的双人连线。',
  yutu_jing: '迷魂捣药。队伍敲定后暗中迷魂车上 1 名好人，使其有概率无法投出成功牌，制造冤假错案。',
  laoshu_jing: '灵山窥机。偷吃灵山灯油灵光一闪，开局私密得知蓝方盲盒抽中的仙佛角色，提前预判好人技能威胁。',
  niu_mowang: '平天霸气。在关键组队表决时，牛魔王一人算 2 票，关键轮次直接以绝对票力强行压过好人反对。',
  tieshan_gongzhu: '煽风搅局。当好人队伍以微弱 1 票优势通过时煽起神风吹散，强制全场重新公开表决。',
  huangmei_laoguai: '金袋套人。挑人阶段祭起人种袋，强行吸走队长已选的 1 名队员剔除出队伍，彻底打乱好人计划。',
  jinjiao_dawang: '葫芦吸气。出征前私选 1 人，若其投成功有 50% 概率被紫金葫芦化解吸收，制造假失败栽赃好人。',
  yinjiao_dawang: '移山定身。表决阶段强行将场上任意 1 人的票压制为弃权，消除关键的好人赞成票或反对票。',
  huangfeng_guai: '三昧神风。神风护体孙悟空看不见黄风怪，但若遭遇蓝方探查法宝，有 50% 概率被破防显形。',
  baiyan_mojun: '盲盒千眼。千眼金光窥破天机，开局私密掌握蓝方抽中的仙佛神仙名号，全盘掌控好人阵容底细。',
  qingmao_shizi: '吞天震慑。队伍表决通过后强行吞除 1 名队员资格，迫使队长现场重新补选，打乱节奏。',
  jinchi_dapeng: '绝杀明灯。终局刺杀时大鹏展翅俯瞰，直接为红孩儿排除 1 个绝对非悟空的席位，大幅提高刺杀胜率。',
  heixiong_jing: '暗度陈仓。7人及以上局出场（对冲红方配额，孤狼盲降互不知晓），首轮必投成功；R1结算私下暗选阵营，R2表决前超时系统摇骰保底，全场零通知，暗助所选阵营！',
};

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
  return (
    <div className="guide-rules">
      <section id="guide-brawl-rule-1" className="panel guide-section">
        <p className="eyebrow">01 / 仙魔三界对决</p>
        <h2>31位全明星神魔，弱技能碰撞，天机盲盒推理博弈</h2>
        <div className="guide-victories">
          <div className="allegiance-blue">
            <h3><Emblem kind="blue" />蓝方 · 取经仙佛</h3>
            <p>在五轮修道任务中完成三次出征，并在终局刺杀中守护齐天大圣孙悟空免遭红孩儿刺杀，即获全胜！</p>
          </div>
          <div className="allegiance-red">
            <h3><Emblem kind="red" />红方 · 混世妖魔</h3>
            <p>破坏三次任务、让流局次数达到五次，或由红孩儿在终局刺杀中准确刺中孙悟空，任一成立即可翻盘获胜！</p>
          </div>
          <div className="allegiance-neutral" style={{ background: '#2b2316e6', border: '1px solid #f59e0b80', borderRadius: '12px', padding: '8px 10px' }}>
            <h3 style={{ color: '#fbbf24' }}>🐻 中立 · 守山大神黑熊精</h3>
            <p style={{ color: '#fef3c7' }}>8人以上对局必出黑熊精！首轮必投成功，首轮结束后私下暗选皈依佛门（蓝方）或割据称王（红方），全场零通知，暗助一方！</p>
          </div>
        </div>
      </section>

      <section id="guide-brawl-rule-2" className="panel guide-section">
        <p className="eyebrow">02 / 全明星抽卡与盲盒机制</p>
        <h2>无放回随机抽取，情报与盲盒</h2>
        <p>西游大乱斗拥有 15 位蓝方仙佛、15 位红方妖魔与 1 位中立黑熊精（共 31 位西游高知名度全明星神魔）。</p>
        <ul>
          <li><strong>5~7人局（纯乱斗模式）</strong>：蓝方必定包含核心神魔（孙悟空、唐三藏），红方必定包含（红孩儿、六耳猕猴），其余席位从全明星池中<strong>无放回随机抽取</strong>！</li>
          <li><strong>8~12人局（大乱斗模式）</strong>：8人及以上局必定抽入中立角色【黑熊精】，其余席位严格按蓝红配额无放回抽取！</li>
          <li><strong>天机盲盒</strong>：未被抽入本局的神仙与妖魔隐藏于“盲盒”中，二郎神（天眼照虚）、老鼠精（偷吃灯油）、百眼魔君（千眼窥机）等角色拥有窥探盲盒的专属特异灵觉！</li>
        </ul>
      </section>

      <section id="guide-brawl-rule-3" className="panel guide-section">
        <p className="eyebrow">03 / 黑熊精专属暗身中立机制</p>
        <h2>异步私密抉择，节奏零阻塞，全场零通知</h2>
        <ul>
          <li><strong>首轮立地成佛</strong>：黑熊精首轮出征必定投出成功牌（好人属性保底）。</li>
          <li><strong>非阻塞暗身抉择</strong>：第 1 轮结束后，全场无缝推进第 2 轮（绝不停顿打断节奏）。黑熊精手机端私密浮现【天命抉择卡】，在第 2 轮投票前随时可私下选择皈依蓝方或割据红方！</li>
          <li><strong>摇骰超时保底</strong>：若直至第 2 轮投票开始黑熊精仍未选定，系统在 0.1 秒内自动随机摇骰分配并私信告知他本人，不卡全场！</li>
          <li><strong>单向绝对保密</strong>：全场零广播、零弹窗、零提示，除黑熊精本人外没有任何人知道他的选择，保持绝对单向暗身！</li>
        </ul>
      </section>

      <section id="guide-brawl-rule-4" className="panel guide-section">
        <p className="eyebrow">04 / 31位弱技能设计原则</p>
        <h2>彻底脱离实体坐席几何限制，重在博弈与配合</h2>
        <p>所有神魔弱技能均严格脱离现场实体的顺逆时针或几何相邻座位，不依赖现场物理排座：</p>
        <ul>
          <li><strong>投票权重型</strong>：如哪吒三太子【三头六臂】算 2 票，牛魔王【平天撼地】算 2 票；猪八戒【倒打一耙】反转尾票；</li>
          <li><strong>组队出征资格型</strong>：如如来佛祖【五行山掌】禁锢 1 人入五行山（当轮禁止组队与投票）；蜘蛛精【盘丝结茧】；白龙马【龙马负重】队伍名额 +1；</li>
          <li><strong>免死翻盘保底型</strong>：如玉皇大帝【天尊玉旨】50% 概率赦免单张失败牌；王母娘娘【九转仙桃】（仅对 4 人及以上车队有效，需 2 张失败牌才算失败）；</li>
          <li><strong>盲盒侦测与反制型</strong>：如二郎神天眼照虚、老鼠精偷吃灯油、太上老君金刚琢收缴妖魔法宝！</li>
        </ul>
      </section>

      <section id="guide-brawl-rule-5" className="panel guide-section">
        <p className="eyebrow">05 / 天机战报“公法不公人”原则</p>
        <h2>法宝公开播报，施法者席位绝对隐匿</h2>
        <p>任何仙魔在手机端发动其专属法宝时，全场公屏将实时弹窗滚动【天机战报】（如“【五行山掌】如来佛祖施展五行山掌，将一名仙友禁锢于五行山下”）：</p>
        <ul>
          <li><strong>公法</strong>：全场所有人都能获知哪位神魔祭出了什么法宝，知晓法术效果正在生效；</li>
          <li><strong>不公人</strong>：战报绝对不透露施法者的座位号与用户 ID，全场玩家依然需要通过场上发言、眼神与逻辑盘出究竟是谁在施法，极大保留桌游盘逻辑的乐趣！</li>
        </ul>
      </section>
    </div>
  );
}

/** 大乱斗模式 31 位全明星角色图鉴 */
export function BrawlGuideRoles({ onSelectRole }: { onSelectRole?: (role: BrawlRoleDef) => void }) {
  const blueRoles = brawlRolesList.filter(r => r.camp === 'blue');
  const redRoles = brawlRolesList.filter(r => r.camp === 'red');
  const neutralRoles = brawlRolesList.filter(r => r.camp === 'neutral');

  const phaseNames: Record<string, string> = {
    game_start: '开局生效（常驻/私密盲盒视野）',
    team_building: '领队挑人组队阶段',
    team_voting: '队伍公开表决阶段',
    mission_resolved: '任务出牌结算阶段',
    assassination: '终局刺杀阶段',
    passive: '常驻被动触发',
  };

  const renderRoleCard = (role: BrawlRoleDef) => {
    const isNeutral = role.camp === 'neutral';
    const factionClass = isNeutral ? 'allegiance-neutral' : `allegiance-${role.camp}`;
    const factionLabel = isNeutral ? '中立 · 守山大神' : role.camp === 'blue' ? '蓝方 · 取经仙佛' : '红方 · 混世妖魔';

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
              src={assetUrl(`/art/roles/${role.artPrefix}-160.webp?v=brawl-art-v2`)}
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
            </div>
            <h3>{role.fullName}</h3>
            <p className="guide-role-motto">{role.motto}</p>
            <span className="guide-role-inspect-hint">🔍 点击赏析完整法相大图 ›</span>
          </div>
        </div>

        <dl className="guide-role-dl">
          <div className="guide-role-detail">
            <dt>专属神通</dt>
            <dd style={{ color: '#ffd54f', fontWeight: 'bold' }}>【{role.skill.skillName}】</dd>
          </div>
          <div className="guide-role-detail">
            <dt>施法时机</dt>
            <dd>{phaseNames[role.skill.triggerPhase] || role.skill.triggerPhase} · {role.skill.maxUses === 1 ? '整局限用 1 次' : '常驻被动'}</dd>
          </div>
          <div className="guide-role-detail">
            <dt>神通效果</dt>
            <dd>{role.skill.description}</dd>
          </div>
          <div className="guide-role-detail">
            <dt>西游战术</dt>
            <dd>{brawlTacticalTips[role.id] || '巧妙配合阵营同伴，灵活把握施法时机！'}</dd>
          </div>
        </dl>
      </article>
    );
  };

  return (
    <div className="guide-roles">
      <p className="hint">
        这里展示《西游 · 仙魔大乱斗》全部 31 位全明星神魔人物图鉴。每局按人数从仙魔池中无放回随机抽取，点击任意法相可鉴赏高清立绘大图。
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

      {/* 中立 1 守山大神 */}
      <section aria-label="中立神兽介绍" className="guide-faction allegiance-neutral" style={{ marginTop: '20px' }}>
        <h2>
          <span style={{ fontSize: '20px', marginRight: '6px' }}>🐻</span>
          中立 · 守山大神（1位 · 8人以上必出）
        </h2>
        <div className="guide-role-grid">
          {neutralRoles.map(renderRoleCard)}
        </div>
      </section>
    </div>
  );
}

/** 经典原版规则介绍（保持向后兼容） */
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

/** 经典原版角色图鉴（保持向后兼容） */
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
  const [guideMode, setGuideMode] = useState<GuideMode>('brawl');
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
      <style>{`
        .allegiance-neutral {
          background: #2b2316e6;
          border: 1px solid #f59e0b80;
        }
        .allegiance-neutral .guide-role-faction-pill {
          background: #78350f;
          color: #fde68a;
        }
        .guide-mode-switch {
          display: flex;
          gap: 6px;
          margin: 8px 0;
          padding: 3px;
          background: rgba(15, 23, 42, 0.65);
          border: 1px solid rgba(212, 163, 89, 0.4);
          border-radius: 12px;
        }
        .guide-mode-btn {
          flex: 1;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }
        .guide-mode-btn.active {
          background: linear-gradient(135deg, #b45309 0%, #78350f 100%);
          color: #fff8db;
          border-color: #fbbf24;
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.35);
        }
        .guide-mode-btn:not(.active) {
          background: transparent;
          color: #94a3b8;
        }
      `}</style>

      <div className="guide-navigation" ref={navigationRef}>
        <div className="guide-controls">
          <button type="button" className="secondary" aria-label="返回原页面" onClick={onBack}>返回</button>
          <nav className="guide-nav" aria-label="说明分类">
            <button type="button" className="secondary" aria-label="角色介绍" aria-pressed={section === 'roles'} onClick={() => changeSection('roles')}>角色</button>
            <button type="button" className="secondary" aria-label="游戏规则" aria-pressed={section === 'rules'} onClick={() => changeSection('rules')}>规则</button>
          </nav>
          <select className="guide-chapter-select" aria-label={section === 'rules' ? '跳转规则章节' : '跳转角色介绍'} value={destination} onChange={e => jumpTo(e.target.value)}>
            <option value="" disabled>章节跳转</option>
            {guideChapters(section, guideMode).map(({ title, id }) => <option key={id} value={id}>{title}</option>)}
          </select>
          <button type="button" className="secondary" aria-label="返回目录" onClick={returnToDirectory}>目录 ↑</button>
        </div>
      </div>

      {/* 顶部模式切换开关 */}
      <div className="guide-mode-switch" role="tablist" aria-label="玩法说明模式切换">
        <button
          type="button"
          role="tab"
          aria-selected={guideMode === 'brawl'}
          className={`guide-mode-btn ${guideMode === 'brawl' ? 'active' : ''}`}
          onClick={() => { setGuideMode('brawl'); setDestination(''); }}
        >
          ⚔️ 仙魔大乱斗（31位全明星）
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={guideMode === 'classic'}
          className={`guide-mode-btn ${guideMode === 'classic' ? 'active' : ''}`}
          onClick={() => { setGuideMode('classic'); setDestination(''); }}
        >
          📜 经典原版（真假猴王）
        </button>
      </div>

      {guideMode === 'brawl' ? (
        <div className="guide-heading">
          <div>
            <p className="eyebrow">WESTWARD BRAWL / 仙魔对决天机卷</p>
            <h1>《西游 · 仙魔大乱斗》</h1>
            <p className="muted">31位西游神魔全明星阵容，弱技能碰撞，天机盲盒推理博弈</p>
          </div>
        </div>
      ) : (
        <div className="guide-heading">
          <div>
            <p className="eyebrow">JOURNEY TO THE WEST / 真假猴王秘卷</p>
            <h1>《嘻游 · 真假猴王》</h1>
            <p className="muted">一念佛魔皆幻相，谁是修道取经人</p>
          </div>
        </div>
      )}

      <GuideIndex section={section} mode={guideMode} onJump={jumpTo} />

      {section === 'rules' ? (
        <GuideRules mode={guideMode} />
      ) : (
        <GuideRoles mode={guideMode} onSelectBrawlRole={setActiveBrawlRole} />
      )}

      {/* 大乱斗高清立绘大图弹窗 */}
      <RoleViewerModal
        item={brawlGalleryItem}
        onClose={() => setActiveBrawlRole(null)}
      />
    </section>
  );
}
