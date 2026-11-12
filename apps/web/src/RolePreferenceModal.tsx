import { useState, useEffect } from 'react';
import { ROLE_CONFIG, BRAWL_ROLE_REGISTRY, type BrawlRoleDef } from '@avalon/game-core';
import type { Role } from '@avalon/contracts';
import { roleTeam } from './Heraldry';
import { RolePortrait } from './RolePortrait';
import { roleMottos, roleNames, roleTitles } from './roles';
import { assetUrl } from './deployment';
import { Modal } from './Modal';

type RolePreferenceProps = {
  open: boolean;
  onClose: () => void;
  currentPreferences: string[];
  playerCount: number;
  brawlMode?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onSave: (preferences: string[]) => Promise<void>;
};

export function RolePreferenceModal(props: RolePreferenceProps) {
  return props.open ? <RolePreferenceForm {...props} /> : null;
}

function RolePreferenceForm({
  onClose,
  currentPreferences,
  playerCount,
  brawlMode = false,
  disabled = false,
  disabledReason,
  onSave,
}: RolePreferenceProps) {
  const maxPreferences = brawlMode ? 5 : 3;
  const validRoles = brawlMode
    ? Object.keys(BRAWL_ROLE_REGISTRY)
    : Array.from(new Set(ROLE_CONFIG[playerCount] ?? []));

  const [selected, setSelected] = useState<string[]>(() =>
    currentPreferences.filter(role => validRoles.includes(role)).slice(0, maxPreferences)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!brawlMode) {
      const available = ROLE_CONFIG[playerCount] ?? [];
      setSelected(draft => draft.filter(role => available.includes(role as Role)));
    }
  }, [playerCount, brawlMode]);

  const blueRoles = !brawlMode ? validRoles.filter(r => roleTeam(r as Role) === 'blue') : [];
  const redRoles = !brawlMode ? validRoles.filter(r => roleTeam(r as Role) === 'red') : [];

  const brawlBlue = brawlMode ? Object.values(BRAWL_ROLE_REGISTRY).filter(r => r.camp === 'blue') : [];
  const brawlRed = brawlMode ? Object.values(BRAWL_ROLE_REGISTRY).filter(r => r.camp === 'red') : [];
  const brawlNeutral = brawlMode ? Object.values(BRAWL_ROLE_REGISTRY).filter(r => r.camp === 'neutral') : [];

  const handleToggleRole = (roleId: string) => {
    if (disabled || saving) return;
    setError(null);
    const existingIndex = selected.indexOf(roleId);
    if (existingIndex !== -1) {
      setSelected(selected.filter(r => r !== roleId));
    } else {
      if (selected.length >= maxPreferences) {
        setError(`最多只可选择 ${maxPreferences} 个心仪角色，可点击已选志愿移除后再选。`);
        return;
      }
      setSelected([...selected, roleId]);
    }
  };

  const handleRemoveSlot = (index: number) => {
    if (disabled || saving) return;
    setError(null);
    setSelected(selected.filter((_, i) => i !== index));
  };

  const handleClear = () => {
    if (disabled || saving) return;
    setError(null);
    setSelected([]);
  };

  const handleConfirm = async () => {
    if (disabled || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(selected);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const slotLabels = ['第一志愿', '第二志愿', '第三志愿', '第四志愿', '第五志愿'].slice(0, maxPreferences);
  const slotTags = ['① 志愿', '② 志愿', '③ 志愿', '④ 志愿', '⑤ 志愿'].slice(0, maxPreferences);

  const getRoleDisplayName = (roleId: string): string => {
    if (brawlMode && BRAWL_ROLE_REGISTRY[roleId]) {
      return BRAWL_ROLE_REGISTRY[roleId].name;
    }
    return roleNames[roleId as Role] || roleId;
  };

  return (
    <Modal label="心仪选角" scene="library" onClose={() => { if (!saving) onClose(); }}>
      <div className="table-modal-sheet role-pref-sheet">
        {/* Header */}
        <div className="table-modal-head role-pref-head">
          <div className="role-pref-head-left">
            <strong className="role-pref-title">
              {brawlMode ? '⚔️ 仙魔大乱斗 · 心仪选角' : '🎭 心仪选角 · 偏好匹配'}
            </strong>
            <span className="role-pref-sub">
              {brawlMode ? '支持预选 5 位心仪神魔 · 优先入池与分配' : '志愿提高机会 · 不保证命中'}
            </span>
          </div>
          <button
            type="button"
            className="role-pref-close-btn"
            onClick={onClose}
            disabled={saving}
            aria-label="关闭"
            title="关闭"
          >
            ✕
          </button>
        </div>

        {/* Slots Status Section */}
        <div className="role-pref-slots-section">
          <div className="role-pref-slots-top-row">
            <div className="role-pref-slots-legend">
              <span className="legend-star">⭐</span>
              <span className="legend-title">出战意向志愿</span>
              <span className="legend-count">({selected.length}/{maxPreferences})</span>
            </div>
            {selected.length > 0 && (
              <button
                type="button"
                className="role-pref-clear-btn"
                onClick={handleClear}
                disabled={disabled || saving}
                title="清空已选志愿"
              >
                清空重选
              </button>
            )}
          </div>

          <div className={`role-pref-slots-grid ${brawlMode ? 'is-brawl-slots' : ''}`} aria-label="已选出战志愿">
            {Array.from({ length: maxPreferences }, (_, slotIdx) => {
              const roleId = selected[slotIdx];
              const brawlDef = roleId ? BRAWL_ROLE_REGISTRY[roleId] : undefined;
              return (
                <div
                  key={slotIdx}
                  className={`role-pref-slot-card ${roleId ? 'is-filled' : 'is-empty'} slot-rank-${slotIdx + 1}`}
                  onClick={() => roleId && handleRemoveSlot(slotIdx)}
                  title={roleId ? `第${slotIdx + 1}志愿：${getRoleDisplayName(roleId)}（点击移除）` : `第${slotIdx + 1}志愿：待点选下方角色`}
                  role={roleId ? 'button' : undefined}
                  tabIndex={roleId ? 0 : undefined}
                >
                  <span className="slot-rank-tag">{slotTags[slotIdx]}</span>
                  <span className="sr-only">{slotLabels[slotIdx]}</span>
                  {roleId ? (
                    <div className="slot-card-body">
                      <span className="slot-card-avatar">
                        {brawlDef ? (
                          <img
                            src={assetUrl(`/art/roles/${brawlDef.artPrefix}-160.webp?v=audit1`)}
                            alt={brawlDef.name}
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <RolePortrait role={roleId as Role} size="mini" />
                        )}
                      </span>
                      <strong className="slot-card-name">{getRoleDisplayName(roleId)}</strong>
                      <span className="slot-card-remove-icon" aria-hidden="true" title="移除">✕</span>
                    </div>
                  ) : (
                    <span className="slot-card-placeholder">待选择</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && <div className="role-pref-error-banner" role="alert">{error}</div>}
        {disabled && !saving && disabledReason && <div className="role-pref-error-banner" role="status">{disabledReason}</div>}

        {/* Scrollable Role Catalog */}
        <div className="role-pref-catalog-section">
          {brawlMode ? (
            <>
              {/* Brawl Blue Faction (15) */}
              <div className="role-camp-group">
                <h4 className="camp-heading blue-heading">
                  <span>🔵 护经仙佛 · 正道神圣 ({brawlBlue.length}位)</span>
                </h4>
                <div className="role-cards-grid">
                  {brawlBlue.map(r => renderBrawlCard(r))}
                </div>
              </div>

              {/* Brawl Red Faction (15) */}
              <div className="role-camp-group">
                <h4 className="camp-heading red-heading">
                  <span>🔴 乱道妖魔 · 混世妖王 ({brawlRed.length}位)</span>
                </h4>
                <div className="role-cards-grid">
                  {brawlRed.map(r => renderBrawlCard(r))}
                </div>
              </div>

              {/* Brawl Neutral (1) */}
              {brawlNeutral.length > 0 && (
                <div className="role-camp-group">
                  <h4 className="camp-heading" style={{ color: '#ffd54f' }}>
                    <span>🟡 摇摆天命 · 守山中立 ({brawlNeutral.length}位)</span>
                  </h4>
                  <div className="role-cards-grid">
                    {brawlNeutral.map(r => renderBrawlCard(r))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Standard Avalon Blue */}
              <div className="role-camp-group">
                <h4 className="camp-heading blue-heading">
                  <span>🔵 护经正道 · 神佛仙圣 ({blueRoles.length})</span>
                </h4>
                <div className="role-cards-grid">
                  {blueRoles.map(role => {
                    const selIdx = selected.indexOf(role);
                    const isSelected = selIdx !== -1;
                    return (
                      <button
                        key={role}
                        type="button"
                        className={`role-choice-card team-blue ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => handleToggleRole(role)}
                        disabled={disabled || saving}
                      >
                        {isSelected && <span className="choice-badge">{slotTags[selIdx]}</span>}
                        <div className="choice-portrait-wrap">
                          <RolePortrait role={role as Role} size="mini" />
                        </div>
                        <div className="choice-details">
                          <div className="choice-title-row">
                            <strong className="choice-title">{roleNames[role as Role]}</strong>
                            <span className="choice-subtitle">{roleTitles[role as Role]}</span>
                          </div>
                          <p className="choice-motto">{roleMottos[role as Role]}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Standard Avalon Red */}
              <div className="role-camp-group">
                <h4 className="camp-heading red-heading">
                  <span>🔴 乱道妖魔 · 混世群妖 ({redRoles.length})</span>
                </h4>
                <div className="role-cards-grid">
                  {redRoles.map(role => {
                    const selIdx = selected.indexOf(role);
                    const isSelected = selIdx !== -1;
                    return (
                      <button
                        key={role}
                        type="button"
                        className={`role-choice-card team-red ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => handleToggleRole(role)}
                        disabled={disabled || saving}
                      >
                        {isSelected && <span className="choice-badge">{slotTags[selIdx]}</span>}
                        <div className="choice-portrait-wrap">
                          <RolePortrait role={role as Role} size="mini" />
                        </div>
                        <div className="choice-details">
                          <div className="choice-title-row">
                            <strong className="choice-title">{roleNames[role as Role]}</strong>
                            <span className="choice-subtitle">{roleTitles[role as Role]}</span>
                          </div>
                          <p className="choice-motto">{roleMottos[role as Role]}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Helpful matching mechanism note */}
          <div className="role-pref-mechanics-note">
            <span className="note-icon">💡</span>
            <div className="note-body">
              <strong>心仪角色匹配说明：</strong>
              <span>
                {brawlMode
                  ? '大乱斗模式支持从 31 位神魔中预选最多 5 位心仪角色。选定后系统将优先将心仪神魔抽取至本局盲盒角色池，并根据出战阵营优先分配给仙友。心仪志愿全程对其他玩家保密。'
                  : '第一、第二、第三志愿及其他角色的基础权重为 8 / 4 / 2 / 1。近期重复角色会降低权重，系统结合本局角色数量与保护条件随机发牌，不保证命中志愿。选角意向不向其他玩家公开。'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="role-pref-footer">
          <button
            type="button"
            className="role-pref-cancel-btn"
            onClick={onClose}
            disabled={saving}
          >
            取消
          </button>
          <button
            type="button"
            className="role-pref-submit-btn"
            onClick={handleConfirm}
            disabled={disabled || saving}
          >
            {saving
              ? '保存中…'
              : selected.length === 0
                ? '盲选出战 (不设偏好)'
                : `确认出战偏好 (${selected.length}/${maxPreferences})`}
          </button>
        </div>
      </div>
    </Modal>
  );

  function renderBrawlCard(r: BrawlRoleDef) {
    const selIdx = selected.indexOf(r.id);
    const isSelected = selIdx !== -1;
    const teamClass = r.camp === 'blue' ? 'team-blue' : r.camp === 'red' ? 'team-red' : 'team-gold';
    return (
      <button
        key={r.id}
        type="button"
        className={`role-choice-card ${teamClass} ${isSelected ? 'is-selected' : ''}`}
        onClick={() => handleToggleRole(r.id)}
        disabled={disabled || saving}
      >
        {isSelected && <span className="choice-badge">{slotTags[selIdx]}</span>}
        <div className="choice-portrait-wrap">
          <img
            src={assetUrl(`/art/roles/${r.artPrefix}-160.webp?v=audit1`)}
            alt={r.name}
            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e7bd6a' }}
          />
        </div>
        <div className="choice-details">
          <div className="choice-title-row">
            <strong className="choice-title">{r.name}</strong>
            <span className="choice-subtitle">{r.title}</span>
          </div>
          <p className="choice-motto" style={{ fontSize: '11px', color: '#ffd54f' }}>
            【{r.skill.skillName}】{r.skill.description}
          </p>
        </div>
      </button>
    );
  }
}
