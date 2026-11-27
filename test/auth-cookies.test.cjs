const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AuthCookiesService, rentalCookieDomain } = require('../dist/modules/auth/auth-cookies.service');
const { AuthController } = require('../dist/modules/auth/auth.controller');
const { FederationController } = require('../dist/modules/auth/federation.controller');
function response() {
  return { req: { hostname: 'api.rent.gorodaivesi.ru' }, events: [], cookie(name, value, options) { this.events.push({ action: 'write', name, value, options }); return this; }, clearCookie(name, options) { this.events.push({ action: 'clear', name, options }); return this; }, setHeader() {} };
}
function withDomain(domain, run) {
  const prior = process.env.DOMAIN;
  if (domain === undefined) delete process.env.DOMAIN; else process.env.DOMAIN = domain;
  const cookies = new AuthCookiesService();
  return Promise.resolve().then(() => run(cookies)).finally(() => { if (prior === undefined) delete process.env.DOMAIN; else process.env.DOMAIN = prior; });
}
const session = { accessToken: 'new-access', refreshToken: 'new-refresh', user: { _id: 'fixture', roles: ['renter'] }, path: '/cabinet' };
function checkMigration(res, expectedDomain) {
  const writes = res.events.filter(e => e.action === 'write');
  assert.equal(writes.length, 3);
  for (const name of ['refreshToken', 'token', 'roles']) {
    const final = writes.find(e => e.name === name);
    assert.equal(final.options.domain, expectedDomain);
    assert.equal(final.options.path, '/');
    const clears = res.events.filter(e => e.name === name && e.action === 'clear');
    if (expectedDomain !== undefined) assert.ok(clears.some(e => e.options.domain === undefined), 'competing host-only cookie removed');
    if (expectedDomain !== 'rent.gorodaivesi.ru') assert.ok(clears.some(e => e.options.domain === 'rent.gorodaivesi.ru'), 'competing Rental domain cookie removed');
    assert.ok(clears.every(e => e.options.domain !== expectedDomain), 'intended cookie overwritten directly');
    assert.ok(res.events.indexOf(final) > Math.max(...clears.map(e => res.events.indexOf(e))), 'canonical cookie written last');
  }
  for (const e of res.events) {
    assert.notEqual(e.options.domain, 'gorodaivesi.ru');
    assert.notEqual(e.options.domain, '.gorodaivesi.ru');
    assert.ok(!e.options.domain?.includes('firetechno'), 'unrelated Rental domain untouched');
  }
}
test('safe Rental domain permits SSR and rejects any scope that reaches GiV', () => {
  assert.equal(rentalCookieDomain('.Rent.Gorodaivesi.Ru'), 'rent.gorodaivesi.ru');
  for (const domain of ['gorodaivesi.ru', '.gorodaivesi.ru', 'ru', 'evil.test', 'gorodaivesi.ru.evil.test']) assert.throws(() => rentalCookieDomain(domain));
});
test('native sign-in replaces both legacy scopes with the configured Rental subtree', async () => {
  await withDomain('.rent.gorodaivesi.ru', async cookies => {
    const res = response(), controller = new AuthController({ login: async () => session }, cookies);
    await controller.login({}, res); checkMigration(res, 'rent.gorodaivesi.ru');
  });
});
test('federated sign-in uses the same cookie writer and Rental SSR scope', async () => {
  await withDomain('rent.gorodaivesi.ru', async cookies => {
    const res = response(), controller = new FederationController({ invoke: async () => session }, cookies);
    await controller.complete({ code: 'a'.repeat(64), state: 'b'.repeat(64) }, { cookies: {} }, res);
    checkMigration({ events: res.events.filter(e => e.name !== 'rentalFederation') }, 'rent.gorodaivesi.ru');
  });
});
test('downgrading to host-only explicitly removes old Rental domain cookies', async () => {
  await withDomain(undefined, async cookies => { const res = response(); cookies.write(res, 'a', 'r', []); checkMigration(res, undefined); });
});
test('logout revokes duplicate refresh cookies and clears all valid legacy scopes', async () => {
  await withDomain('rent.gorodaivesi.ru', async cookies => {
    const revoked = [], res = response(), controller = new AuthController({ logout: async token => revoked.push(token) }, cookies);
    await controller.logout({ headers: { cookie: 'refreshToken=old-domain; token=access; refreshToken=new-host' }, cookies: { refreshToken: 'old-domain' } }, res);
    assert.deepEqual(revoked.sort(), ['new-host', 'old-domain']);
    assert.ok(res.events.every(e => e.action === 'clear'));
    for (const name of ['refreshToken', 'token', 'roles']) {
      assert.ok(res.events.some(e => e.name === name && e.options.domain === undefined));
      assert.ok(res.events.some(e => e.name === name && e.options.domain === 'rent.gorodaivesi.ru'));
    }
    assert.ok(res.events.every(e => e.options.domain !== 'gorodaivesi.ru'));
  });
});

test('a Rental host never clears the other Rental environment domain', async () => {
  await withDomain('rent.firetechno.ru', async cookies => {
    const res = response();
    assert.throws(() => cookies.write(res, 'a', 'r', []));
    assert.equal(res.events.length, 0);
  });
});
