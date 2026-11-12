import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getKnownAccountsStorageKey, knownAccountForNickname, knownAccountsList, rememberAccount, forgetAccount } from '../src/known-accounts.js';

test('getKnownAccountsStorageKey generates path-namespaced keys', () => {
  assert.equal(getKnownAccountsStorageKey('/avalon_vs/'), 'avalon_known_accounts_avalon_vs');
  assert.equal(getKnownAccountsStorageKey('/avalon/'), 'avalon_known_accounts_avalon');
  assert.equal(getKnownAccountsStorageKey('/'), 'avalon_known_accounts');
  assert.equal(getKnownAccountsStorageKey(''), 'avalon_known_accounts');
});

test('rememberAccount and forgetAccount manipulate accounts under specified storage key', () => {
  const memory: Record<string, string> = {};
  const mockStorage = {
    getItem: (k: string) => memory[k] ?? null,
    setItem: (k: string, v: string) => { memory[k] = v; },
  };
  // @ts-expect-error mock global localStorage
  globalThis.localStorage = mockStorage;

  const testKey = 'avalon_known_accounts_test';
  assert.deepEqual(knownAccountsList(testKey), []);

  const user1 = { id: 'u1', nickname: '老熊', avatar: 'leaf' as const, playerCode: '999999' };
  const user2 = { id: 'u2', nickname: 'XJ', avatar: 'leaf' as const, playerCode: '562084' };

  rememberAccount(user1, testKey);
  let list = knownAccountsList(testKey);
  assert.equal(list.length, 1);
  assert.equal(list[0].playerCode, '999999');

  rememberAccount(user2, testKey);
  list = knownAccountsList(testKey);
  assert.equal(list.length, 2);

  forgetAccount('999999', testKey);
  list = knownAccountsList(testKey);
  assert.equal(list.length, 1);
  assert.equal(list[0].playerCode, '562084');
});
