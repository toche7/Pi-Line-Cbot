import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, visibleSettings, type StaffPrincipal } from './staff-policy.js';
const person = (role: StaffPrincipal['role']): StaffPrincipal => ({ subject: 'fixture-subject', email: 'fixture@example.test', role, enabled: true, extras: [] });
test('staff policy applies the approved role matrix and separately grants only named extra permissions', () => {
  const staff = person('staff'), content = person('content'), admin = person('admin');
  for (const p of [staff, content, admin]) assert.equal(hasPermission(p, 'conversation.takeover'), true);
  assert.equal(hasPermission(staff, 'news.draft'), false);
  assert.equal(hasPermission(content, 'news.draft'), true);
  assert.equal(hasPermission(content, 'knowledge.publish'), true);
  assert.equal(hasPermission(admin, 'knowledge.publish'), true);
  assert.deepEqual(visibleSettings(staff), []);
  assert.deepEqual(visibleSettings(content), ['knowledge', 'system']);
  assert.deepEqual(visibleSettings(admin), ['profile', 'line', 'knowledge', 'ai', 'system', 'users']);
  staff.extras = ['news.send', 'line.approve'];
  assert.equal(hasPermission(staff, 'news.send'), true);
  assert.equal(hasPermission(staff, 'line.approve'), true);
  assert.equal(hasPermission(staff, 'knowledge.publish'), false);
  assert.equal(hasPermission(staff, 'ai.manage'), false);
  assert.deepEqual(visibleSettings(staff), []);
});
test('disabled, unknown and missing principals fail closed even with extra permissions', () => {
  const p = person('admin'); p.enabled = false; p.extras = ['news.send'];
  assert.equal(hasPermission(p, 'news.send'), false);
  assert.equal(hasPermission(undefined, 'work.read'), false);
  assert.equal(hasPermission({ ...person('admin'), role: 'forged' as any }, 'staff.manage'), false);
  assert.deepEqual(visibleSettings(p), []);
});
