import { deployment } from './deployment';
import { useEffect, useState } from 'react';
import type {
  AdminGameSummary,
  AdminOverview,
  AdminRoomSummary,
  AdminUserSummary,
  CustomBannerConfig,
  RedemptionCodeItem,
  Replay,
  SystemAnnouncement,
} from '@avalon/contracts';
import { BANNER_PRESET_TEMPLATES, DEFAULT_CUSTOM_BANNER_CONFIG } from '@avalon/contracts';
import { ReplayView } from './AccountPanel';
import { AdminRoleAssignmentAudit } from './AdminRoleAssignmentAudit';
import { AdminContentSafety } from './AdminContentSafety';
import './admin.css';
import { SpecialAdmin, PlayerCodeEditor } from './SpecialAdmin';
import { adminRoomPhaseLabel } from './admin-room-state';

interface AdminDashboardProps {
  onBackToGame: () => void;
}

function CustomBannerPanel({
  customBanner,
  setCustomBanner,
  savingBanner,
  onSave,
}: {
  customBanner: CustomBannerConfig;
  setCustomBanner: React.Dispatch<React.SetStateAction<CustomBannerConfig>>;
  savingBanner: boolean;
  onSave: () => Promise<void>;
}) {
  return (
    <div className="admin-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h3 className="admin-panel-title" style={{ margin: 0 }}>🎉 定制玩家专属横幅与周期提示</h3>
        <button
          type="button"
          className="admin-primary-btn"
          onClick={() => setCustomBanner(b => ({ ...b, enabled: !b.enabled }))}
          style={{
            background: customBanner.enabled ? '#10b981' : '#64748b',
            color: '#ffffff',
            fontSize: '13px',
            padding: '6px 14px',
          }}
        >
          {customBanner.enabled ? '● 已启用生效' : '○ 已停用（冷藏备用）'}
        </button>
      </div>

      <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.5 }}>
        在玩家进入房间或对局时弹出专属全屏悬浮横幅。支持按仙友码/昵称精准定向指定玩家（或全员广播），支持预置模板一键填充、周期重复频次、屏幕悬浮时长、局内聊天同步以及生效起止时间段控制。
      </p>

      {/* 1. Quick Preset Templates */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#fef08a', marginBottom: '8px' }}>
          ⚡ 官方预置方案模板（点击一键载入配置）：
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {BANNER_PRESET_TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              type="button"
              className="admin-tool-btn"
              style={{ fontSize: '12px', padding: '5px 10px', background: 'rgba(212, 163, 89, 0.15)', borderColor: 'rgba(212, 163, 89, 0.4)' }}
              onClick={() => {
                setCustomBanner(prev => ({
                  ...prev,
                  ...tpl.config,
                  title: tpl.config.title ?? prev.title,
                  icon: tpl.config.icon ?? prev.icon,
                  text: tpl.config.text ?? prev.text,
                  targetType: tpl.config.targetType ?? prev.targetType,
                  targetCodes: tpl.config.targetCodes ?? prev.targetCodes,
                  targetNicknames: tpl.config.targetNicknames ?? prev.targetNicknames,
                  intervalMinutes: tpl.config.intervalMinutes ?? prev.intervalMinutes,
                  durationSeconds: tpl.config.durationSeconds ?? prev.durationSeconds,
                  sendToRoomChat: tpl.config.sendToRoomChat ?? prev.sendToRoomChat,
                  theme: tpl.config.theme ?? prev.theme,
                }));
              }}
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Target Audience */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: '14px', color: '#f8fafc' }}>🎯 目标触达人群</strong>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="bannerTargetType"
                checked={customBanner.targetType === 'specific'}
                onChange={() => setCustomBanner(b => ({ ...b, targetType: 'specific' }))}
              />
              <span>指定特定仙友 (仙友码/昵称)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="bannerTargetType"
                checked={customBanner.targetType === 'all'}
                onChange={() => setCustomBanner(b => ({ ...b, targetType: 'all' }))}
              />
              <span>全员生效 (所有房间所有玩家)</span>
            </label>
          </div>
        </div>

        {customBanner.targetType === 'specific' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                  目标仙友码（多个以逗号隔开）：
                </label>
                <input
                  type="text"
                  className="admin-input"
                  value={customBanner.targetCodes}
                  onChange={e => setCustomBanner(b => ({ ...b, targetCodes: e.target.value }))}
                  placeholder="例如: 100001, 100002"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                  目标昵称关键字（多个以逗号隔开，模糊匹配）：
                </label>
                <input
                  type="text"
                  className="admin-input"
                  value={customBanner.targetNicknames}
                  onChange={e => setCustomBanner(b => ({ ...b, targetNicknames: e.target.value }))}
                  placeholder="例如: 寿星, 老王, 小李"
                />
              </div>
            </div>
            <small style={{ color: '#64748b', fontSize: '11.5px' }}>
              💡 提示：当对局或房间成员中包含上述任一仙友时，即对本局所有在场玩家展示该定制横幅。
            </small>
          </div>
        )}
      </div>

      {/* 3. Message Content and Theme */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: '#f8fafc', fontWeight: 600, marginBottom: '6px' }}>
            ✍️ 横幅展示文案：
          </label>
          <textarea
            value={customBanner.text}
            onChange={e => setCustomBanner(b => ({ ...b, text: e.target.value }))}
            rows={3}
            className="admin-input"
            placeholder="请输入要在屏幕上方弹出的祝福或横幅文案…"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
              徽标图标 (Emoji)：
            </label>
            <input
              type="text"
              className="admin-input"
              value={customBanner.icon || '🎂'}
              onChange={e => setCustomBanner(b => ({ ...b, icon: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
              发信人别名 (用于聊天频道)：
            </label>
            <input
              type="text"
              className="admin-input"
              value={customBanner.title || '寿星贺表'}
              onChange={e => setCustomBanner(b => ({ ...b, title: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
              视觉主题风格：
            </label>
            <select
              className="admin-input"
              value={customBanner.theme || 'gold'}
              onChange={e => setCustomBanner(b => ({ ...b, theme: e.target.value as any }))}
              style={{ width: '100%' }}
            >
              <option value="gold">金色华贵 (Gold - 华诞/尊享)</option>
              <option value="purple">极客紫电 (Purple - 技术/神机)</option>
              <option value="red">热烈红火 (Red - 战神/狂欢)</option>
              <option value="cyan">仙庭青蓝 (Cyan - 团建/清爽)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Frequency, Duration and Chat Sync */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
            循环播报频率 (分钟)：
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="number"
              min={0}
              max={120}
              className="admin-input"
              value={customBanner.intervalMinutes}
              onChange={e => setCustomBanner(b => ({ ...b, intervalMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
              style={{ width: '90px' }}
            />
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>分钟 (填0表示仅进房弹出1次)</span>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
            横幅停留时长 (秒)：
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="number"
              min={3}
              max={120}
              className="admin-input"
              value={customBanner.durationSeconds}
              onChange={e => setCustomBanner(b => ({ ...b, durationSeconds: Math.max(3, parseInt(e.target.value, 10) || 16) }))}
              style={{ width: '90px' }}
            />
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>秒</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={customBanner.sendToRoomChat}
              onChange={e => setCustomBanner(b => ({ ...b, sendToRoomChat: e.target.checked }))}
            />
            <span>同步发送至房间聊天抽屉</span>
          </label>
        </div>
      </div>

      {/* 5. Time Window Gating */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={customBanner.timeWindowEnabled}
              onChange={e => setCustomBanner(b => ({ ...b, timeWindowEnabled: e.target.checked }))}
            />
            <span style={{ fontWeight: 600, color: '#f8fafc' }}>限制生效时间窗口（未勾选则开启时一直生效）</span>
          </label>
          {customBanner.timeWindowEnabled && (
            <button
              type="button"
              className="admin-tool-btn"
              style={{ fontSize: '11px', padding: '2px 8px' }}
              onClick={() => {
                const now = new Date();
                const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
                const pad = (n: number) => String(n).padStart(2, '0');
                const startStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
                const endStr = `${midnight.getFullYear()}-${pad(midnight.getMonth() + 1)}-${pad(midnight.getDate())}T00:00`;
                setCustomBanner(b => ({ ...b, startTime: startStr, endTime: endStr }));
              }}
            >
              🕒 快速设为截止至今日24:00 (今夜生效)
            </button>
          )}
        </div>

        {customBanner.timeWindowEnabled && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', paddingTop: '4px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                开始生效时间 (可选)：
              </label>
              <input
                type="datetime-local"
                className="admin-input"
                value={customBanner.startTime || ''}
                onChange={e => setCustomBanner(b => ({ ...b, startTime: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                结束生效时间 (可选)：
              </label>
              <input
                type="datetime-local"
                className="admin-input"
                value={customBanner.endTime || ''}
                onChange={e => setCustomBanner(b => ({ ...b, endTime: e.target.value }))}
              />
            </div>
          </div>
        )}
      </div>

      {/* 6. Save Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          type="button"
          className="admin-primary-btn"
          disabled={savingBanner}
          onClick={onSave}
          style={{
            background: '#f59e0b',
            color: '#1c1917',
            fontWeight: 'bold',
            padding: '10px 24px',
            fontSize: '14px',
          }}
        >
          {savingBanner ? '正在保存并广播…' : '💾 保存并实时推送专属横幅配置'}
        </button>
      </div>
    </div>
  );
}

export function AdminDashboard({ onBackToGame }: AdminDashboardProps) {
  const [adminKey, setAdminKey] = useState<string>(() => sessionStorage.getItem('avalon_admin_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(sessionStorage.getItem('avalon_admin_key')));
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);

  // Tabs: 'overview' | 'strategy' | 'banner' | 'users' | 'rooms' | 'codes' | 'special' | 'content'
  const [activeTab, setActiveTab] = useState<'overview' | 'strategy' | 'banner' | 'users' | 'rooms' | 'codes' | 'special' | 'content'>('overview');
  const [specialRefresh,setSpecialRefresh]=useState(0);
  const [contentRefresh,setContentRefresh]=useState(0);

  // Overview Data
  const [overview, setOverview] = useState<AdminOverview | null>(null);

  // Strategy Data
  const [settings, setSettings] = useState<{
    freeAccessMode: boolean;
    adRewardHours: number;
    announcement: SystemAnnouncement;
    customBanner?: CustomBannerConfig;
  } | null>(null);
  const [announcementInput, setAnnouncementInput] = useState('');
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [customBanner, setCustomBanner] = useState<CustomBannerConfig>(DEFAULT_CUSTOM_BANNER_CONFIG);
  const [savingBanner, setSavingBanner] = useState(false);

  const [codeUser,setCodeUser]=useState<AdminUserSummary|null>(null);

  // Users Data
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userFriendsModal, setUserFriendsModal] = useState<{ userName: string; friends: any[] } | null>(null);

  // Rooms & Games Data
  const [roomSubTab, setRoomSubTab] = useState<'active' | 'history'>('active');
  const [activeRooms, setActiveRooms] = useState<AdminRoomSummary[]>([]);
  const [gameHistory, setGameHistory] = useState<AdminGameSummary[]>([]);
  const [inspectingReplay, setInspectingReplay] = useState<Replay | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);

  // Redemption Codes Data
  const [codes, setCodes] = useState<RedemptionCodeItem[]>([]);
  const [codeGenCount, setCodeGenCount] = useState(5);
  const [codeGenDays, setCodeGenDays] = useState(30);
  const [codeGenNote, setCodeGenNote] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');

  // API Helper
  const adminApi = async <T,>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> => {
    const res = await fetch(deployment.path(`api/admin${path}`), {
      method,
      headers: {
        'x-admin-key': adminKey,
        'x-avalon-request': '1',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      if (res.status === 401) {
        sessionStorage.removeItem('avalon_admin_key');
        setIsAuthenticated(false);
        throw new Error('口令失效，请重新登录');
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || '请求异常');
    }
    return res.json();
  };

  const [showPassword, setShowPassword] = useState(false);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = loginInput.trim();
    if (!cleanKey) return;
    setBusy(true);
    setLoginError('');
    try {
      const res = await fetch(deployment.path('api/admin/verify'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-avalon-request': '1',
        },
        body: JSON.stringify({ key: cleanKey }),
      });
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('后台管理接口未就绪，请确保服务端已同步更新并重启');
        }
        if (res.status === 401) {
          throw new Error('管理口令错误，请核对大小写及特殊符号后重试');
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `验证失败 (${res.status})`);
      }
      sessionStorage.setItem('avalon_admin_key', cleanKey);
      setAdminKey(cleanKey);
      setIsAuthenticated(true);
    } catch (err: any) {
      setLoginError(err.message || '登录失败');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('avalon_admin_key');
    setAdminKey('');
    setIsAuthenticated(false);
  };

  // Load Overview Data
  const loadOverview = async () => {
    try {
      const data = await adminApi<AdminOverview>('/overview');
      setOverview(data);
    } catch {
      // silently handle or error
    }
  };

  // Load Settings
  const loadSettings = async () => {
    try {
      const data = await adminApi<{
        freeAccessMode: boolean;
        adRewardHours: number;
        announcement: SystemAnnouncement;
        customBanner?: CustomBannerConfig;
      }>('/settings');
      setSettings(data);
      setAnnouncementInput(data.announcement?.text || '');
      setAnnouncementEnabled(data.announcement?.enabled ?? false);
      if (data.customBanner) {
        setCustomBanner(data.customBanner);
      }
    } catch {
      // ignore
    }
  };

  // Load Users
  const loadUsers = async (query = '') => {
    try {
      const data = await adminApi<{ users: AdminUserSummary[]; total: number }>(`/users?query=${encodeURIComponent(query)}`);
      setUsers(data.users);
      setUserTotal(data.total);
    } catch {
      // ignore
    }
  };

  // Load Rooms
  const loadRooms = async () => {
    try {
      const [rData, gData] = await Promise.all([
        adminApi<{ rooms: AdminRoomSummary[] }>('/rooms'),
        adminApi<{ games: AdminGameSummary[] }>('/games'),
      ]);
      setActiveRooms(rData.rooms);
      setGameHistory(gData.games);
    } catch {
      // ignore
    }
  };

  // Load Codes
  const loadCodes = async () => {
    try {
      const data = await adminApi<{ codes: RedemptionCodeItem[] }>('/redemption-codes');
      setCodes(data.codes);
    } catch {
      // ignore
    }
  };

  // Load initial tab data
  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeTab === 'overview') {
      void loadOverview();
      void loadSettings();
    } else if (activeTab === 'strategy' || activeTab === 'banner') {
      void loadSettings();
    } else if (activeTab === 'users') {
      void loadUsers(userSearchQuery);
    } else if (activeTab === 'rooms') {
      void loadRooms();
    } else if (activeTab === 'codes') {
      void loadCodes();
    }
  }, [isAuthenticated, activeTab]);

  // Actions
  const toggleFreeAccessMode = async () => {
    if (!settings) return;
    const nextMode = !settings.freeAccessMode;
    try {
      await adminApi('/settings', { key: 'free_access_mode', value: nextMode });
      setSettings(s => s ? { ...s, freeAccessMode: nextMode } : s);
      if (overview) setOverview(o => o ? { ...o, freeAccessMode: nextMode } : o);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBroadcastAnnouncement = async () => {
    try {
      await adminApi('/broadcast', { text: announcementInput.trim(), enabled: announcementEnabled });
      alert('已向全服在线玩家推送最新广播！');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveCustomBanner = async () => {
    setSavingBanner(true);
    try {
      await adminApi('/settings', {
        key: 'custom_banner_config',
        value: customBanner,
      });
      alert('已成功保存专属横幅配置，并通过 WebSocket 实时推送到所有在线客户端！');
    } catch (err: any) {
      alert(`保存失败: ${err.message || '网络或权限错误'}`);
    } finally {
      setSavingBanner(false);
    }
  };

  const handleBanUser = async (user: AdminUserSummary) => {
    const nextBan = !user.isBanned;
    let reason: string | null = null;
    if (nextBan) {
      reason = prompt(`请输入封禁玩家【${user.nickname}】的原因：`, '违规言论或通牌作弊');
      if (reason === null) return;
    }
    try {
      await adminApi(`/users/${user.id}/ban`, { isBanned: nextBan, reason });
      void loadUsers(userSearchQuery);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGrantVip = async (user: AdminUserSummary) => {
    const daysStr = prompt(`为玩家【${user.nickname}】赠送多少天 VIP 会员？`, '30');
    if (!daysStr) return;
    const days = parseInt(daysStr, 10);
    if (isNaN(days) || days <= 0) return alert('请输入有效的天数');
    try {
      await adminApi(`/users/${user.id}/vip`, { days });
      alert(`成功为【${user.nickname}】延长 ${days} 天 VIP！`);
      void loadUsers(userSearchQuery);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetProfile = async (user: AdminUserSummary) => {
    if (!confirm(`确认重置【${user.nickname}】的昵称或头像为系统默认？`)) return;
    try {
      await adminApi(`/users/${user.id}/reset-profile`, { resetNickname: true, resetAvatar: true });
      alert('玩家资料已重置为默认值！');
      void loadUsers(userSearchQuery);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleViewFriends = async (user: AdminUserSummary) => {
    try {
      const res = await adminApi<{ friends: any[] }>(`/users/${user.id}/friends`);
      setUserFriendsModal({ userName: user.nickname, friends: res.friends });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (user: AdminUserSummary) => {
    if (user.gamesCount > 0) {
      alert(`仙友【${user.nickname}】已有 ${user.gamesCount} 局历史对局战绩，为保证对局复盘与数据完整性，不可删除！如需限制其访问可使用【封禁】。`);
      return;
    }
    if (!confirm(`⚠️ 彻底删除确认：\n\n确定要永久删除仙友【${user.nickname}】（仙友码 #${user.playerCode}）吗？\n该用户无历史对局战绩，删除后该账号及仙友码将被彻底注销，不可恢复。`)) {
      return;
    }
    try {
      await adminApi(`/users/${user.id}`, undefined, 'DELETE');
      alert(`仙友【${user.nickname}】已成功删除！`);
      void loadUsers(userSearchQuery);
      void loadOverview();
    } catch (err: any) {
      alert(err.message || '删除失败，请稍后重试');
    }
  };

  const handleBatchDeleteEmptyUsers = async () => {
    if (!confirm('⚠️ 批量清理确认：\n\n确定要一键清理系统中所有【无对局战绩（0局）】的仙籍与测试账号吗？\n\n· 有对局记录（哪怕1局）的仙友将受到严格保护，绝不删除。\n· 无战绩游离账号将被彻底清理并释放。\n\n是否继续执行批量清理？')) {
      return;
    }
    try {
      const res = await adminApi<{ deletedCount: number }>('/users/batch-delete-empty', {}, 'POST');
      alert(`批量清理完成！共彻底删除了 ${res.deletedCount} 个无对局战绩的账号。`);
      void loadUsers(userSearchQuery);
      void loadOverview();
    } catch (err: any) {
      alert(err.message || '批量清理失败，请重试');
    }
  };

  const handleKillRoom = async (room: AdminRoomSummary) => {
    if (!confirm(`确认强制解散房间【${room.code}】？此操作将立即结束该房并将全员送回大厅。`)) return;
    try {
      await adminApi(`/rooms/${room.id}/kill`, {});
      alert(`房间【${room.code}】已强制解散！`);
      void loadRooms();
      void loadOverview();
      setSpecialRefresh(v=>v+1);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleViewGameReplay = async (gameId: string) => {
    setReplayLoading(true);
    try {
      const replay = await adminApi<Replay>(`/games/${gameId}/replay`);
      setInspectingReplay(replay);
    } catch (err: any) {
      alert('读取对局复盘失败：' + (err.message || '请重试'));
    } finally {
      setReplayLoading(false);
    }
  };

  const handleGenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await adminApi<{ codes: string[] }>('/redemption-codes/generate', {
        count: codeGenCount,
        days: codeGenDays,
        note: codeGenNote,
      });
      alert(`已成功生成 ${res.codes.length} 个兑换码！`);
      void loadCodes();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCopyUnusedCodes = () => {
    const unused = codes.filter(c => !c.redeemedAt).map(c => `${c.code} (${c.days}天 - ${c.note || '无备注'})`).join('\n');
    if (!unused) return alert('当前没有未使用的兑换码');
    navigator.clipboard.writeText(unused);
    setCopyFeedback('已复制全部未核销兑换码！');
    setTimeout(() => setCopyFeedback(''), 3000);
  };

  // If not authenticated, render Login Screen
  if (!isAuthenticated) {
    return (
      <div className="admin-viewport">
        <div className="admin-login-screen">
          <div className="admin-login-card">
            <div className="admin-login-emblem">⛩️</div>
            <h2 className="admin-login-title">法坛中枢 · 管理后台</h2>
            <p className="admin-login-sub">运营与用户增长控制台（方案 2）</p>

            <form onSubmit={handleLogin} className="admin-login-form">
              <div className="admin-input-group">
                <label className="admin-input-label">管理员访问口令 (Admin Secret)</label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginInput}
                    onChange={e => setLoginInput(e.target.value)}
                    placeholder="请输入后台管理员访问口令"
                    className="admin-input"
                    style={{ paddingRight: '44px' }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      boxShadow: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      fontSize: '16px',
                      width: 'auto',
                      minHeight: 'auto',
                      marginTop: 0,
                      color: '#ffd875',
                    }}
                    title={showPassword ? '隐藏口令' : '显示口令'}
                    aria-label={showPassword ? '隐藏口令' : '显示口令'}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              {loginError && <div style={{ color: '#f87171', fontSize: '13px' }}>{loginError}</div>}

              <button type="submit" disabled={busy} className="admin-primary-btn">
                {busy ? '验证中…' : '登入法坛中枢 ›'}
              </button>

              <button type="button" onClick={onBackToGame} className="admin-back-btn">
                ‹ 返回前台游戏大厅
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-viewport">
      {/* Top Header */}
      <header className="admin-header">
        <div className="admin-header-left">
          <h1 className="admin-header-title">
            <span>⛩️ 法坛中枢</span>
            <span className="admin-header-sub">· 运营管理</span>
          </h1>
          <span className="admin-status-badge">● 系统正常</span>
        </div>

        <div className="admin-header-right">
          <button
            type="button"
            className="admin-tool-btn"
            onClick={() => {
              if (activeTab === 'overview') { void loadOverview(); void loadSettings(); }
              else if (activeTab === 'strategy' || activeTab === 'banner') { void loadSettings(); }
              else if (activeTab === 'users') { void loadUsers(userSearchQuery); }
              else if (activeTab === 'rooms') { void loadRooms(); }
              else if (activeTab === 'codes') { void loadCodes(); }
              else if (activeTab === 'special') { setSpecialRefresh(v=>v+1); }
              else if (activeTab === 'content') { setContentRefresh(v=>v+1); }
            }}
          >
            🔄 刷新数据
          </button>
          <button type="button" className="admin-tool-btn" onClick={onBackToGame}>
            ‹ 返回大厅
          </button>
          <button type="button" className="admin-tool-btn danger" onClick={handleLogout}>
            🚪 登出
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="admin-nav-bar">
        <button
          type="button"
          className={`admin-nav-item ${activeTab === 'overview' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 运营看板
        </button>
        <button
          type="button"
          className={`admin-nav-item ${activeTab === 'strategy' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('strategy')}
        >
          ⚙️ 运营策略
        </button>
        <button
          type="button"
          className={`admin-nav-item ${activeTab === 'banner' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('banner')}
          style={{ position: 'relative' }}
        >
          🎉 专属横幅与祝福
          {customBanner.enabled && (
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                marginLeft: '6px',
                boxShadow: '0 0 6px #10b981',
              }}
              title="当前已有横幅生效中"
            />
          )}
        </button>
        <button
          type="button"
          className={`admin-nav-item ${activeTab === 'users' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 仙友用户 ({userTotal})
        </button>
        <button
          type="button"
          className={`admin-nav-item ${activeTab === 'rooms' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('rooms')}
        >
          🏛️ 法坛对局 ({activeRooms.length})
        </button>
        <button
          type="button"
          className={`admin-nav-item ${activeTab === 'codes' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('codes')}
        >
          🎟️ 兑换码 ({codes.length})
        </button>
        <button type="button" className={`admin-nav-item ${activeTab==='special'?'is-active':''}`} onClick={()=>setActiveTab('special')}>专属房与靓号</button>
        <button type="button" className={`admin-nav-item ${activeTab==='content'?'is-active':''}`} onClick={()=>setActiveTab('content')}>内容审核</button>
      </nav>

      {/* Main Container */}
      <main className="admin-main-container">
        {activeTab==='special'&&<SpecialAdmin request={adminApi} refreshToken={specialRefresh} onRoomsChanged={async()=>{await Promise.all([loadRooms(),loadOverview()]);}}/>}
        {activeTab==='content'&&<AdminContentSafety request={adminApi} refreshToken={contentRefresh}/>}
        {codeUser&&<PlayerCodeEditor user={codeUser} request={adminApi} onClose={()=>setCodeUser(null)} onSaved={()=>void loadUsers(userSearchQuery)}/>}
        {/* ================= Tab 1: Overview ================= */}
        {activeTab === 'overview' && (
          <div>
            {/* Free Access Mode Highlight Banner */}
            <div className="admin-banner-card">
              <div className="admin-banner-content">
                <h4>
                  <span>{settings?.freeAccessMode ? '🎉 公测全员畅玩模式生效中' : '💼 商业化运营模式（广告+VIP）生效中'}</span>
                </h4>
                <p>
                  {settings?.freeAccessMode
                    ? '当前系统处于【冷启动全员免费体验阶段】。所有对局复盘、高级角色板子均向所有玩家零门槛免费开放，无任何弹窗广告或付费限制，让玩家尽享纯粹开黑乐趣！'
                    : '当前已切换至【商业化运营模式】。玩家看激励视频广告可获得 24 小时灵气特权或兑换 VIP 会员。'}
                </p>
              </div>
              <button
                type="button"
                className="admin-primary-btn"
                onClick={toggleFreeAccessMode}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                {settings?.freeAccessMode ? '切换为商业化模式' : '一键恢复全员免费模式'}
              </button>
            </div>

            {/* Metrics */}
            <div className="admin-metric-grid">
              <div className="admin-metric-card">
                <span className="admin-metric-label">👥 累计注册用户</span>
                <span className="admin-metric-value">{overview?.totalUsers ?? '…'}</span>
              </div>
              <div className="admin-metric-card">
                <span className="admin-metric-label">🌱 今日新增用户</span>
                <span className="admin-metric-value">{overview?.todayNewUsers ?? '…'}</span>
              </div>
              <div className="admin-metric-card">
                <span className="admin-metric-label">⚡ 未关闭房间</span>
                <span className="admin-metric-value">{overview?.activeRoomsCount ?? '…'}</span>
              </div>
              <div className="admin-metric-card">
                <span className="admin-metric-label">🔌 在线长连接 (WS)</span>
                <span className="admin-metric-value">{overview?.onlineConnections ?? '…'}</span>
              </div>
              <div className="admin-metric-card">
                <span className="admin-metric-label">📜 累计对局总数</span>
                <span className="admin-metric-value">{overview?.totalGames ?? '…'}</span>
              </div>
              <div className="admin-metric-card">
                <span className="admin-metric-label">⚔️ 今日对局场次</span>
                <span className="admin-metric-value">{overview?.todayGames ?? '…'}</span>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="admin-panel">
              <h3 className="admin-panel-title">⚡ 运营快捷捷径</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button type="button" className="admin-action-btn" onClick={() => setActiveTab('strategy')}>
                  📢 发送全服实时公告
                </button>
                <button type="button" className="admin-action-btn" onClick={() => setActiveTab('users')}>
                  🔍 查询与管理仙友
                </button>
                <button type="button" className="admin-action-btn" onClick={() => setActiveTab('rooms')}>
                  🏛️ 巡查未关闭法坛房间
                </button>
                <button type="button" className="admin-action-btn" onClick={() => setActiveTab('codes')}>
                  🎟️ 批量生成 VIP 兑换码
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= Tab: Custom Banner ================= */}
        {activeTab === 'banner' && (
          <div>
            <CustomBannerPanel
              customBanner={customBanner}
              setCustomBanner={setCustomBanner}
              savingBanner={savingBanner}
              onSave={handleSaveCustomBanner}
            />
          </div>
        )}

        {/* ================= Tab 2: Strategy ================= */}
        {activeTab === 'strategy' && (
          <div>
            <CustomBannerPanel
              customBanner={customBanner}
              setCustomBanner={setCustomBanner}
              savingBanner={savingBanner}
              onSave={handleSaveCustomBanner}
            />

            <div className="admin-panel" style={{ marginTop: '24px' }}>
              <h3 className="admin-panel-title">⚙️ 商业化与功能放开策略</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <strong style={{ fontSize: '15px', color: '#f8fafc' }}>公测全员畅玩模式（冷启动零摩擦）</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                      开启后，全体玩家无需看广告、无需开通 VIP，即可免费体验战绩复盘、高级阵营板子与房主管理特权。
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-primary-btn"
                    onClick={toggleFreeAccessMode}
                    style={{
                      background: settings?.freeAccessMode ? '#10b981' : '#64748b',
                      color: '#ffffff',
                    }}
                  >
                    {settings?.freeAccessMode ? '已开启（全员免费）' : '已关闭（商业模式）'}
                  </button>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                  <strong style={{ fontSize: '15px', color: '#f8fafc' }}>激励视频广告特权奖励时长</strong>
                  <p style={{ margin: '4px 0 10px', fontSize: '13px', color: '#94a3b8' }}>
                    在商业化模式下，玩家观看 1 次激励视频所获得的地仙特权时长（单位：小时）。
                  </p>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="number"
                      value={settings?.adRewardHours ?? 24}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) setSettings(s => s ? { ...s, adRewardHours: val } : s);
                      }}
                      className="admin-input"
                      style={{ width: '120px' }}
                    />
                    <span style={{ fontSize: '13px', color: '#cbd5e1' }}>小时</span>
                    <button
                      type="button"
                      className="admin-tool-btn"
                      onClick={async () => {
                        if (!settings) return;
                        await adminApi('/settings', { key: 'ad_reward_hours', value: settings.adRewardHours });
                        alert('已保存特权时长设置！');
                      }}
                    >
                      保存配置
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Broadcast Announcement */}
            <div className="admin-panel">
              <h3 className="admin-panel-title">📢 全服跑马灯实时广播推送</h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 14px' }}>
                编辑文字并点击推送后，全服所有当前在线的 WebSocket 客户端将立即同步弹出跑马灯或置顶广播。
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <textarea
                  value={announcementInput}
                  onChange={e => setAnnouncementInput(e.target.value)}
                  rows={3}
                  className="admin-input"
                  placeholder="请输入要向全服仙友广播的公告内容…"
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={announcementEnabled}
                      onChange={e => setAnnouncementEnabled(e.target.checked)}
                    />
                    <span>启用此广播横幅并在大厅循环展示</span>
                  </label>
                  <button type="button" className="admin-primary-btn" onClick={handleBroadcastAnnouncement}>
                    📢 立即推送全服广播
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= Tab 3: Users ================= */}
        {activeTab === 'users' && (
          <div className="admin-panel">
            <h3 className="admin-panel-title">
              <span>👥 仙友用户列表 ({userTotal})</span>
            </h3>

            {/* Search Bar & Batch Clean */}
            <div className="admin-form-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="搜索仙友（输入6位仙友码 / 昵称 / UUID）…"
                value={userSearchQuery}
                onChange={e => setUserSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void loadUsers(userSearchQuery); }}
                className="admin-input admin-search-input"
              />
              <button type="button" className="admin-primary-btn" onClick={() => void loadUsers(userSearchQuery)}>
                🔍 搜索
              </button>
              {userSearchQuery && (
                <button type="button" className="admin-tool-btn" onClick={() => { setUserSearchQuery(''); void loadUsers(''); }}>
                  清空
                </button>
              )}
              <button
                type="button"
                className="admin-action-btn danger"
                style={{
                  marginLeft: 'auto',
                  background: 'rgba(239, 68, 68, 0.15)',
                  borderColor: 'rgba(239, 68, 68, 0.5)',
                  color: '#fca5a5',
                  padding: '6px 12px',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
                onClick={handleBatchDeleteEmptyUsers}
                title="一键清理所有0对局记录的游离或测试账号"
              >
                🗑️ 批量清理无战绩账号
              </button>
            </div>

            {/* Desktop User Table */}
            <div className="admin-desktop-table admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>仙友</th>
                    <th>6位仙友码</th>
                    <th>仙位/特权</th>
                    <th>状态</th>
                    <th>对局场次</th>
                    <th>好友数</th>
                    <th>注册时间</th>
                    <th>管理操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                        暂未找到匹配的仙友
                      </td>
                    </tr>
                  ) : (
                    users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, color: '#f8fafc' }}>{u.nickname}</span>
                          </div>
                        </td>
                        <td>
                          <code style={{ color: '#ffd875', fontSize: '13px' }}>{u.playerCode}</code>
                        </td>
                        <td>
                          {u.isVip ? (
                            <span className="badge-vip" title={`到期时间：${u.vipUntil}`}>
                              ⭐ 尊享会员
                            </span>
                          ) : settings?.freeAccessMode ? (
                            <span className="badge-free">公测全免</span>
                          ) : (
                            <span className="badge-normal">普通仙友</span>
                          )}
                        </td>
                        <td>
                          {u.isBanned ? (
                            <span className="badge-banned" title={u.bannedReason || ''}>
                              🚫 已封禁
                            </span>
                          ) : (
                            <span style={{ color: '#4ade80', fontSize: '12px' }}>● 正常</span>
                          )}
                        </td>
                        <td>{u.gamesCount} 局</td>
                        <td>{u.friendsCount} 人</td>
                        <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <button type="button" className="admin-action-btn" onClick={()=>setCodeUser(u)}>改仙友码</button>
                          <button type="button" className="admin-action-btn" onClick={() => handleGrantVip(u)} title="赠送VIP">
                            🎁 赠会员
                          </button>
                          <button
                            type="button"
                            className={`admin-action-btn ${u.isBanned ? '' : 'danger'}`}
                            onClick={() => handleBanUser(u)}
                          >
                            {u.isBanned ? '✅ 解封' : '🚫 封禁'}
                          </button>
                          <button type="button" className="admin-action-btn" onClick={() => handleViewFriends(u)} title="查看好友关系">
                            👥 社交
                          </button>
                          <button type="button" className="admin-action-btn" onClick={() => handleResetProfile(u)} title="重置资料">
                            🔄 重置
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn danger"
                            style={{
                              color: u.gamesCount > 0 ? '#64748b' : '#f87171',
                              borderColor: u.gamesCount > 0 ? 'rgba(255,255,255,0.08)' : 'rgba(239, 68, 68, 0.4)',
                              cursor: u.gamesCount > 0 ? 'not-allowed' : 'pointer',
                              opacity: u.gamesCount > 0 ? 0.45 : 1,
                            }}
                            onClick={() => handleDeleteUser(u)}
                            title={u.gamesCount > 0 ? `该仙友有 ${u.gamesCount} 局历史对局战绩，不可删除` : '彻底删除该无战绩账号'}
                            disabled={u.gamesCount > 0}
                          >
                            🗑️ 删除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile User Cards */}
            <div className="admin-mobile-cards admin-user-cards">
              {users.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                  暂未找到匹配的仙友
                </div>
              ) : (
                users.map(u => (
                  <div key={u.id} className="admin-user-card">
                    <div className="admin-user-card-head">
                      <div className="admin-user-card-name">
                        <span>{u.nickname}</span>
                        <span className="admin-user-card-code">#{u.playerCode}</span>
                      </div>
                      <div className="admin-user-card-badges">
                        {u.isVip ? (
                          <span className="badge-vip" title={`到期时间：${u.vipUntil}`}>⭐ 会员</span>
                        ) : settings?.freeAccessMode ? (
                          <span className="badge-free">公测全免</span>
                        ) : (
                          <span className="badge-normal">普通</span>
                        )}
                        {u.isBanned ? (
                          <span className="badge-banned" title={u.bannedReason || ''}>🚫 封禁</span>
                        ) : (
                          <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: 600 }}>● 正常</span>
                        )}
                      </div>
                    </div>

                    <div className="admin-user-card-meta">
                      <span>⚔️ {u.gamesCount} 局</span>
                      <span>👥 {u.friendsCount} 位好友</span>
                      <span>📅 {new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="admin-user-card-actions">
                      <button type="button" className="admin-action-btn" onClick={()=>setCodeUser(u)}>改仙友码</button>
                          <button type="button" className="admin-action-btn" onClick={() => handleGrantVip(u)} title="赠送VIP">
                        🎁 赠VIP
                      </button>
                      <button
                        type="button"
                        className={`admin-action-btn ${u.isBanned ? '' : 'danger'}`}
                        onClick={() => handleBanUser(u)}
                      >
                        {u.isBanned ? '✅ 解封' : '🚫 封禁'}
                      </button>
                      <button type="button" className="admin-action-btn" onClick={() => handleViewFriends(u)} title="查看社交圈">
                        👥 社交
                      </button>
                      <button type="button" className="admin-action-btn" onClick={() => handleResetProfile(u)} title="重置资料">
                        🔄 重置
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn danger"
                        style={{
                          color: u.gamesCount > 0 ? '#64748b' : '#f87171',
                          borderColor: u.gamesCount > 0 ? 'rgba(255,255,255,0.08)' : 'rgba(239, 68, 68, 0.4)',
                          cursor: u.gamesCount > 0 ? 'not-allowed' : 'pointer',
                          opacity: u.gamesCount > 0 ? 0.45 : 1,
                        }}
                        onClick={() => handleDeleteUser(u)}
                        title={u.gamesCount > 0 ? `该仙友有 ${u.gamesCount} 局历史对局战绩，不可删除` : '彻底删除该无战绩账号'}
                        disabled={u.gamesCount > 0}
                      >
                        🗑️ 删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Friend Network Modal */}
            {userFriendsModal && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 100,
                  padding: '20px',
                }}
              >
                <div className="admin-panel" style={{ maxWidth: '500px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, color: '#ffd875' }}>【{userFriendsModal.userName}】的仙友圈子</h3>
                    <button type="button" className="admin-tool-btn" onClick={() => setUserFriendsModal(null)}>
                      关闭
                    </button>
                  </div>
                  {userFriendsModal.friends.length === 0 ? (
                    <p style={{ color: '#94a3b8' }}>暂无好友记录</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {userFriendsModal.friends.map(f => (
                        <li key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(30,41,59,0.5)', borderRadius: '6px' }}>
                          <span>{f.nickname} ({f.player_code})</span>
                          <span style={{ fontSize: '12px', color: f.status === 'accepted' ? '#4ade80' : '#f59e0b' }}>
                            {f.status === 'accepted' ? '已互关好友' : '申请中'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= Tab 4: Rooms & Matches ================= */}
        {activeTab === 'rooms' && (
          <div className="admin-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 className="admin-panel-title" style={{ margin: 0 }}>🏛️ 法坛对局监控</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className={`admin-tool-btn ${roomSubTab === 'active' ? 'admin-primary-btn' : ''}`}
                  onClick={() => setRoomSubTab('active')}
                >
                  ⚡ 未关闭房间 ({activeRooms.length})
                </button>
                <button
                  type="button"
                  className={`admin-tool-btn ${roomSubTab === 'history' ? 'admin-primary-btn' : ''}`}
                  onClick={() => setRoomSubTab('history')}
                >
                  📜 历史对局归档 ({gameHistory.length})
                </button>
              </div>
            </div>

            {roomSubTab === 'active' ? (
              activeRooms.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '36px' }}>
                  当前没有未关闭的法坛房间
                </div>
              ) : (
                <div className="admin-room-grid">
                  {activeRooms.map(r => (
                    <div key={r.id} className="admin-room-card">
                      <div className="admin-room-head">
                        <span className="admin-room-code">房间 #{r.code}</span>
                        <span className={r.phase === 'playing' ? 'badge-vip' : 'badge-free'}>
                          {adminRoomPhaseLabel(r.phase)}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>房主：<strong>{r.hostNickname}</strong></div>
                        <div>在席：{r.memberCount} / {r.playerCount} 人</div>
                        <div>语音：{r.voiceChatEnabled ? '🎙️ 开启' : '无语音'}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                          创建于：{new Date(r.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="admin-action-btn danger"
                        onClick={() => handleKillRoom(r)}
                        style={{ alignSelf: 'flex-start', marginTop: '6px' }}
                      >
                        💥 一键强制解散
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div>
                {/* Desktop Match History Table */}
                <div className="admin-desktop-table admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>对局 ID</th>
                        <th>房号</th>
                        <th>人数</th>
                        <th>胜利阵营</th>
                        <th>结束原因</th>
                        <th>开局时间</th>
                        <th>结束时间</th>
                        <th>管理操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gameHistory.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                            暂无历史对局数据
                          </td>
                        </tr>
                      ) : (
                        gameHistory.map(g => (
                          <tr key={g.id}>
                            <td>
                              <code style={{ fontSize: '11px', color: '#ffd875' }}>{g.id.slice(0, 8)}</code>
                            </td>
                            <td>{g.roomCode}</td>
                            <td>{g.playerCount} 人局</td>
                            <td>
                              {g.winner === 'blue' ? (
                                <span style={{ color: '#38bdf8', fontWeight: 600 }}>蓝方 · 取经正果</span>
                              ) : g.winner === 'red' ? (
                                <span style={{ color: '#f87171', fontWeight: 600 }}>红方 · 群妖乱道</span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>平局/中止</span>
                              )}
                            </td>
                            <td style={{ fontSize: '12px', color: '#cbd5e1' }}>{g.reason || '—'}</td>
                            <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                              {new Date(g.createdAt).toLocaleTimeString()}
                            </td>
                            <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                              {g.endedAt ? new Date(g.endedAt).toLocaleTimeString() : '—'}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="admin-action-btn"
                                disabled={replayLoading}
                                onClick={() => handleViewGameReplay(g.id)}
                                title="点击调取本局完整复盘"
                              >
                                🔍 查看复盘
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Match History Cards */}
                <div className="admin-mobile-cards admin-game-cards">
                  {gameHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                      暂无历史对局数据
                    </div>
                  ) : (
                    gameHistory.map(g => (
                      <div key={g.id} className="admin-game-card">
                        <div className="admin-game-card-head">
                          <span style={{ fontWeight: 700, color: '#f8fafc' }}>
                            房间 #{g.roomCode} <small style={{ color: '#94a3b8' }}>({g.playerCount}人局)</small>
                          </span>
                          <span className="admin-game-card-winner">
                            {g.winner === 'blue' ? (
                              <span style={{ color: '#38bdf8' }}>蓝方 · 取经正果</span>
                            ) : g.winner === 'red' ? (
                              <span style={{ color: '#f87171' }}>红方 · 群妖乱道</span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>平局/中止</span>
                            )}
                          </span>
                        </div>
                        <div className="admin-game-card-meta">
                          <div>结案原因：{g.reason || '—'}</div>
                          <div>结束时间：{g.endedAt ? new Date(g.endedAt).toLocaleString() : '—'}</div>
                          <div>对局ID：<code style={{ fontSize: '11px', color: '#ffd875' }}>{g.id}</code></div>
                        </div>
                        <button
                          type="button"
                          className="admin-primary-btn"
                          disabled={replayLoading}
                          onClick={() => handleViewGameReplay(g.id)}
                          style={{ width: '100% !important', padding: '8px 12px', fontSize: '13px' }}
                        >
                          {replayLoading ? '读取复盘中…' : '🔍 查看本局完整复盘'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= Tab 5: Redemption Codes ================= */}
        {activeTab === 'codes' && (
          <div>
            {/* Generator Form */}
            <div className="admin-panel">
              <h3 className="admin-panel-title">🎟️ 批量生成 VIP 兑换码</h3>
              <form onSubmit={handleGenerateCodes} className="admin-form-row">
                <div className="admin-input-group">
                  <label className="admin-input-label">生成数量</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={codeGenCount}
                    onChange={e => setCodeGenCount(parseInt(e.target.value, 10))}
                    className="admin-input"
                    style={{ width: '100px' }}
                  />
                </div>
                <div className="admin-input-group">
                  <label className="admin-input-label">VIP 有效天数</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={codeGenDays}
                    onChange={e => setCodeGenDays(parseInt(e.target.value, 10))}
                    className="admin-input"
                    style={{ width: '120px' }}
                  />
                </div>
                <div className="admin-input-group" style={{ flex: 1, minWidth: '200px' }}>
                  <label className="admin-input-label">备注说明（可选）</label>
                  <input
                    type="text"
                    placeholder="如：小红书公测抽奖福利 / 社群专属"
                    value={codeGenNote}
                    onChange={e => setCodeGenNote(e.target.value)}
                    className="admin-input"
                  />
                </div>
                <button type="submit" className="admin-primary-btn">
                  🚀 立即生成
                </button>
              </form>
            </div>

            {/* Codes List */}
            <div className="admin-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 className="admin-panel-title" style={{ margin: 0 }}>
                  <span>兑换码库存与核销记录 ({codes.length})</span>
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {copyFeedback && <span style={{ color: '#34d399', fontSize: '13px' }}>{copyFeedback}</span>}
                  <button type="button" className="admin-tool-btn" onClick={handleCopyUnusedCodes}>
                    📋 一键复制全部可用码
                  </button>
                </div>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>兑换码</th>
                      <th>VIP 天数</th>
                      <th>备注说明</th>
                      <th>核销状态</th>
                      <th>兑换玩家</th>
                      <th>兑换时间</th>
                      <th>创建时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                          暂无兑换码记录，请在上方批量生成
                        </td>
                      </tr>
                    ) : (
                      codes.map(c => (
                        <tr key={c.code}>
                          <td>
                            <code style={{ fontSize: '14px', color: '#ffd875', fontWeight: 700, letterSpacing: '1px' }}>
                              {c.code}
                            </code>
                          </td>
                          <td>{c.days} 天</td>
                          <td style={{ color: '#cbd5e1' }}>{c.note || '—'}</td>
                          <td>
                            {c.redeemedAt ? (
                              <span style={{ color: '#94a3b8', fontSize: '12px' }}>已核销</span>
                            ) : (
                              <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 600 }}>● 可使用</span>
                            )}
                          </td>
                          <td>{c.redeemerNickname || '—'}</td>
                          <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                            {c.redeemedAt ? new Date(c.redeemedAt).toLocaleString() : '—'}
                          </td>
                          <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Admin Replay Inspection Modal */}
      {inspectingReplay && (
        <div className="admin-replay-modal-backdrop" onClick={() => setInspectingReplay(null)}>
          <div className="admin-replay-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-replay-modal-head">
              <h3 className="admin-replay-modal-title">
                <span>📜 法坛对局全景复盘</span>
                <span style={{ fontSize: '12px', color: '#ffd875', fontWeight: 500, marginLeft: '6px' }}>
                  ({inspectingReplay.playerCount}人局 · 胜者：{inspectingReplay.result.winner === 'blue' ? '蓝方' : inspectingReplay.result.winner === 'red' ? '红方' : '中断'})
                </span>
              </h3>
              <button
                type="button"
                className="admin-tool-btn"
                onClick={() => setInspectingReplay(null)}
                style={{ padding: '4px 10px', fontSize: '13px' }}
              >
                ✕ 关闭
              </button>
            </div>
            <div className="admin-replay-modal-body">
              <ReplayView replay={inspectingReplay} />
              <AdminRoleAssignmentAudit replay={inspectingReplay} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
