const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load.cjs');

function catalogWith(data) {
  return load('src/lib/catalog.ts', {
    './config': { demoMode: () => false },
    './db': { database: () => ({ from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data, error: null }) }) }) }) }) },
  });
}

test('catalog preserves each product gallery in order without mixing product photos', async () => {
  const make = (id, images) => ({ id, title: id, description: '', image: `/${id}.jpg`, images, category: 'Y2K',
    gp_variants: [{ id: `${id}-small`, size: '8 × 10 in', price_cents: 1800, active: true }] });
  const { getCatalog } = catalogWith([make('angel', ['/angel-detail.jpg', '/angel-room.jpg']), make('star', ['/star-detail.jpg']), make('single', null)]);
  const { prints, unavailable } = await getCatalog();
  assert.equal(unavailable, false);
  assert.deepEqual(prints.map(p => [p.image, p.images]), [
    ['/angel.jpg', ['/angel-detail.jpg', '/angel-room.jpg']],
    ['/star.jpg', ['/star-detail.jpg']],
    ['/single.jpg', []],
  ]);
  assert.equal(prints[0].variants[0].priceCents, 1800);
});

test('all demo products have distinct existing gallery assets', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { demoPrints } = load('src/lib/demo.ts');
  for (const print of demoPrints) {
    const images = [print.image, ...print.images];
    assert.equal(new Set(images).size, 3);
    for (const image of images) assert.ok(fs.existsSync(path.join(__dirname, '../public', image)));
  }
});
