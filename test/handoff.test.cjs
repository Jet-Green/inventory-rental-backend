const { test } = require('node:test');
const assert = require('node:assert/strict');
const { UserService } = require('../dist/modules/user/user.service');
const { AuthService } = require('../dist/modules/auth/auth.service');
const { AuthController } = require('../dist/modules/auth/auth.controller');
const payload = { provider: 'gorodaivesi', externalId: 'a'.repeat(24), email: 'fixture@example.test', fullName: 'Fixture' };
function model({ existing = null, email = null } = {}) {
  return { created: null, findOne(query) { return { exec: async () => query.externalId ? existing : email }; }, async create(value) { this.created = value; return value; } };
}
test('email collision cannot absorb local account or assign admin', async () => {
  const m = model({ email: { _id: 'local', roles: ['admin'] } });
  await assert.rejects(new UserService(m).upsertExternalUser(payload), /Почта уже используется/);
  assert.equal(m.created, null);
});
test('new external identity receives renter only, even when ADMIN_EMAILS matches', async () => {
  const previous = process.env.ADMIN_EMAILS; process.env.ADMIN_EMAILS = payload.email;
  try { const m = model(); await new UserService(m).upsertExternalUser(payload); assert.deepEqual(m.created.roles, ['renter']); }
  finally { if (previous === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = previous; }
});
test('stable linked identity preserves local roles and rejects blocked account', async () => {
  const existing = { federationOnly: true, roles: ['renter', 'business'], email: 'old@example.test' };
  assert.equal(await new UserService(model({ existing })).upsertExternalUser(payload), existing);
  await assert.rejects(new UserService(model({ existing: { federationOnly: true, isBlocked: true } })).upsertExternalUser(payload), /заблокирован/);
});
test('callback without original browser state never calls code exchange', async () => {
  let called = false;
  const c = new AuthController({ completeHandoff: () => { called = true; } });
  await assert.rejects(c.completeHandoff({ code: 'a'.repeat(64), state: 'b'.repeat(64) }, { cookies: { rentalHandoff: 'c'.repeat(64) } }, {}), /другом браузере/);
  assert.equal(called, false);
});
test('uncertain exchange is attempted once, never automatically retried', async () => {
  const previous = global.fetch, secret = process.env.RENTAL_HANDOFF_SECRET; let calls = 0;
  global.fetch = async (url, options) => { calls++; assert.equal(url, 'https://gorodaivesi.ru/auth/rental-handoff/exchange'); assert.equal(options.redirect, 'error'); throw Error('timeout'); };
  process.env.RENTAL_HANDOFF_SECRET = 'fixture-'.repeat(5);
  try { await assert.rejects(new AuthService({}, {}).completeHandoff('a'.repeat(64), 'b'.repeat(64)), /timeout/); assert.equal(calls, 1); }
  finally { global.fetch = previous; if (secret === undefined) delete process.env.RENTAL_HANDOFF_SECRET; else process.env.RENTAL_HANDOFF_SECRET = secret; }
});
test('concurrent external signup returns only winner with same provider identity', async () => {
  let reads = 0;
  const winner = { federationOnly: true, _id: 'winner', roles: ['renter'] };
  const m = { findOne(query) { return { exec: async () => query.externalId && ++reads > 1 ? winner : null }; }, async create() { throw Object.assign(Error('duplicate'), { code: 11000 }); } };
  assert.equal(await new UserService(m).upsertExternalUser(payload), winner);
});

test('legacy externalId inherited from email auto-link is not ownership proof', async () => {
  await assert.rejects(new UserService(model({ existing: { _id: 'legacy-native', roles: ['admin'] } })).upsertExternalUser(payload), /безопасной привязки/);
});
