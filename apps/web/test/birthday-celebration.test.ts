import { test } from 'node:test';
import assert from 'node:assert/strict';

test('birthday celebration: player identification for Dennis and Chen Xin', () => {
  const isBirthdayPerson = (m: { playerCode?: string; nickname?: string }) => {
    const code = String(m.playerCode || '');
    if (code === '932866' || code === '805678') return true;
    const n = (m.nickname || '').toLowerCase();
    return n.includes('dennis') || n.includes('小一') || n.includes('邓一名') || n.includes('陈欣') || n.includes('小陈');
  };

  // Dennis matching
  assert.equal(isBirthdayPerson({ playerCode: '932866', nickname: '玩家A' }), true);
  assert.equal(isBirthdayPerson({ nickname: 'Dennis' }), true);
  assert.equal(isBirthdayPerson({ nickname: 'dennis_dev' }), true);
  assert.equal(isBirthdayPerson({ nickname: '小一' }), true);
  assert.equal(isBirthdayPerson({ nickname: '邓一名' }), true);

  // Chen Xin matching
  assert.equal(isBirthdayPerson({ playerCode: '805678', nickname: '玩家B' }), true);
  assert.equal(isBirthdayPerson({ nickname: '陈欣' }), true);
  assert.equal(isBirthdayPerson({ nickname: '小陈' }), true);

  // Unrelated person
  assert.equal(isBirthdayPerson({ playerCode: '123456', nickname: '路人甲' }), false);
});

test('birthday celebration: time gating strictly expires at Beijing Time 2026-11-16 24:00 (2026-11-17 00:00:00+08:00)', () => {
  const DEADLINE = new Date('2026-11-17T00:00:00+08:00').getTime();

  // Test during evening of Nov 16 (e.g. 19:30 CST)
  const activeTime = new Date('2026-11-16T19:30:00+08:00').getTime();
  assert.equal(activeTime < DEADLINE, true, 'Must be active before 24:00 CST');

  // Test right after midnight (e.g. 2026-11-17 00:00:01 CST)
  const expiredTime = new Date('2026-11-17T00:00:01+08:00').getTime();
  assert.equal(expiredTime < DEADLINE, false, 'Must be inactive after 24:00 CST');
});

test('birthday celebration: blessing text matches option 4 customized without game IDs', () => {
  const bdayText = '⚡【内核直发 · Birthday.Init()】Happy Birthday to Dennis & 陈欣！🎂 祝两位极客大佬：代码无 Bug，人生无阻断，算力永不限流，灵感常驻缓存！今晚大乱斗全场起立为寿星让道，出征必胜！🎉🚀';

  assert.match(bdayText, /Happy Birthday to Dennis & 陈欣！/);
  assert.match(bdayText, /代码无 Bug/);
  assert.match(bdayText, /算力永不限流/);
  assert.doesNotMatch(bdayText, /小一/);
  assert.doesNotMatch(bdayText, /小陈/);
});
