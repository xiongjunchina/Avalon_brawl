import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CUSTOM_BANNER_CONFIG,
  BANNER_PRESET_TEMPLATES,
  type CustomBannerConfig,
} from '@avalon/contracts';
import { isCustomBannerActive } from '../src/custom-banner-helper.js';

test('birthday celebration: Dennis & Chen Xin blessing text removes 【内核直发】 and starts cleanly with Happy Birthday', () => {
  const bdayText = DEFAULT_CUSTOM_BANNER_CONFIG.text;

  // Must start directly with Happy Birthday
  assert.equal(bdayText.startsWith('Happy Birthday to Dennis & 陈欣！'), true, 'Should start cleanly with Happy Birthday');
  assert.doesNotMatch(bdayText, /【内核直发/);
  assert.doesNotMatch(bdayText, /Birthday\.Init/);
  assert.match(bdayText, /代码无 Bug/);
  assert.match(bdayText, /算力永不限流/);
  assert.match(bdayText, /出征必胜/);
  assert.doesNotMatch(bdayText, /小一/);
  assert.doesNotMatch(bdayText, /小陈/);

  // Check preset template
  const geekTpl = BANNER_PRESET_TEMPLATES.find(t => t.id === 'geek-birthday-dennis-chenxin');
  assert.ok(geekTpl, 'Geek birthday preset template must exist');
  assert.equal(geekTpl.config.text?.startsWith('Happy Birthday to Dennis & 陈欣！'), true);
  assert.doesNotMatch(geekTpl.config.text || '', /内核直发/);
});

test('birthday celebration: preset templates provide diverse one-click options', () => {
  assert.ok(BANNER_PRESET_TEMPLATES.length >= 5, 'Should provide at least 5 preset templates');
  const labels = BANNER_PRESET_TEMPLATES.map(t => t.label);
  assert.ok(labels.some(l => l.includes('Dennis & 陈欣')));
  assert.ok(labels.some(l => l.includes('仙友华诞')));
  assert.ok(labels.some(l => l.includes('极客大牛')));
  assert.ok(labels.some(l => l.includes('战神出征')));
  assert.ok(labels.some(l => l.includes('团建狂欢')));
});

test('custom banner: isCustomBannerActive identifies targeted Dennis & Chen Xin', () => {
  const config: CustomBannerConfig = {
    ...DEFAULT_CUSTOM_BANNER_CONFIG,
    enabled: true,
  };

  // Dennis matching
  assert.equal(isCustomBannerActive(config, Date.now(), { playerCode: '932866', nickname: '玩家A' }, []), true);
  assert.equal(isCustomBannerActive(config, Date.now(), { nickname: 'Dennis' }, []), true);
  assert.equal(isCustomBannerActive(config, Date.now(), { nickname: 'dennis_dev' }, []), true);
  assert.equal(isCustomBannerActive(config, Date.now(), { nickname: '小一' }, []), true);
  assert.equal(isCustomBannerActive(config, Date.now(), { nickname: '邓一名' }, []), true);

  // Chen Xin matching
  assert.equal(isCustomBannerActive(config, Date.now(), { playerCode: '805678', nickname: '玩家B' }, []), true);
  assert.equal(isCustomBannerActive(config, Date.now(), { nickname: '陈欣' }, []), true);
  assert.equal(isCustomBannerActive(config, Date.now(), { nickname: '小陈' }, []), true);

  // Other room members contain celebrant
  assert.equal(isCustomBannerActive(config, Date.now(), { nickname: '普通玩家' }, [{ playerCode: '932866', nickname: '小一' }]), true);

  // Unrelated person and room
  assert.equal(isCustomBannerActive(config, Date.now(), { playerCode: '123456', nickname: '路人甲' }, [{ nickname: '路人乙' }]), false);
});

test('custom banner: targetType "all" broadcasts to all players', () => {
  const config: CustomBannerConfig = {
    ...DEFAULT_CUSTOM_BANNER_CONFIG,
    enabled: true,
    targetType: 'all',
  };

  assert.equal(isCustomBannerActive(config, Date.now(), { playerCode: '123456', nickname: '路人甲' }, []), true);
});

test('custom banner: disabled config never triggers', () => {
  const config: CustomBannerConfig = {
    ...DEFAULT_CUSTOM_BANNER_CONFIG,
    enabled: false,
  };

  assert.equal(isCustomBannerActive(config, Date.now(), { playerCode: '932866' }, []), false);
});

test('custom banner: time window gating enforces start and end deadlines', () => {
  const config: CustomBannerConfig = {
    ...DEFAULT_CUSTOM_BANNER_CONFIG,
    enabled: true,
    timeWindowEnabled: true,
    startTime: '2026-11-16T18:00:00+08:00',
    endTime: '2026-11-17T00:00:00+08:00',
  };

  // Before start time
  const beforeStart = new Date('2026-11-16T17:59:59+08:00').getTime();
  assert.equal(isCustomBannerActive(config, beforeStart, { playerCode: '932866' }, []), false);

  // In active window
  const activeTime = new Date('2026-11-16T21:30:00+08:00').getTime();
  assert.equal(isCustomBannerActive(config, activeTime, { playerCode: '932866' }, []), true);

  // After deadline
  const expiredTime = new Date('2026-11-17T00:00:01+08:00').getTime();
  assert.equal(isCustomBannerActive(config, expiredTime, { playerCode: '932866' }, []), false);
});
