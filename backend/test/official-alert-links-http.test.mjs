import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  OFFICIAL_ALERT_LINKS,
  OFFICIAL_ALERT_LINKS_PATH,
  OFFICIAL_ALERT_LINKS_CONTRACT,
  createOfficialAlertLinksHttpHandler,
} from '../src/official-alert-links-http.mjs';

test('official notice links are static, source-scoped and do not invent active alerts', async () => {
  assert.equal(OFFICIAL_ALERT_LINKS.length, 4);
  assert.deepEqual(OFFICIAL_ALERT_LINKS.map(x => x.id), ['defesa-civil-rj', 'alerta-rio', 'inmet-avisos', 'inpe-cptec-avisos']);
  assert.ok(OFFICIAL_ALERT_LINKS.every(x => !/cemaden/i.test(x.id + ' ' + x.url)));
  assert.ok(OFFICIAL_ALERT_LINKS.some(x => x.id === 'inmet-avisos' && x.url === 'https://avisos.inmet.gov.br/'));
  assert.ok(OFFICIAL_ALERT_LINKS.some(x => x.id === 'inpe-cptec-avisos' && x.url === 'https://www.cptec.inpe.br/'));
  assert.equal(OFFICIAL_ALERT_LINKS.some(x=>Object.hasOwn(x,'severity')||Object.hasOwn(x,'level')),false);
  assert.ok(OFFICIAL_ALERT_LINKS.every(x => x.url.startsWith('https://')));
  assert.ok(OFFICIAL_ALERT_LINKS.every(x => x.message && !x.message.includes('ATIVO')));
  let delegated = 0;
  const server = http.createServer(createOfficialAlertLinksHttpHandler((_req, res) => {
    delegated += 1;
    res.statusCode = 404;
    res.end();
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const response = await fetch(base + OFFICIAL_ALERT_LINKS_PATH);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json();
    assert.equal(result.contract, OFFICIAL_ALERT_LINKS_CONTRACT);
    assert.equal(result.alertStatus, 'NOT_CHECKED');
    assert.deepEqual(result.links, OFFICIAL_ALERT_LINKS);
    const disallowed = await fetch(base + OFFICIAL_ALERT_LINKS_PATH, { method: 'POST' });
    assert.equal(disallowed.status, 405);
    const unknown = await fetch(base + '/other');
    assert.equal(unknown.status, 404);
    assert.equal(delegated, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
