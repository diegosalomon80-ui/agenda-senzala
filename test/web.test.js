const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const web = path.join(__dirname, '..', 'web');
const ler = (p) => fs.readFileSync(path.join(web, p), 'utf8');

function tamanhoPng(p) {
  const b = fs.readFileSync(path.join(web, p));
  assert.equal(b.toString('ascii', 1, 4), 'PNG', p + ' não é PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test('manifest instalável: nome, display, start_url e ícones 192/512 reais', () => {
  const m = JSON.parse(ler('manifest.webmanifest'));
  assert.equal(m.name, 'Agenda Senzala Londrina');
  assert.equal(m.short_name, 'Agenda Senzala');
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  for (const icone of m.icons) {
    const [w, h] = tamanhoPng(icone.src);
    assert.equal(`${w}x${h}`, icone.sizes, icone.src);
  }
  assert.ok(m.icons.some((i) => i.sizes === '192x192'));
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
});

test('service worker só pré-carrega arquivos que existem', () => {
  const sw = ler('sw.js');
  const lista = JSON.parse(sw.match(/var ARQUIVOS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
  for (const arq of lista) {
    if (arq === './') continue;
    assert.ok(fs.existsSync(path.join(web, arq)), arq);
  }
});

test('index.html referencia só arquivos existentes e registra o service worker', () => {
  const html = ler('index.html');
  const refs = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 5);
  for (const r of refs) assert.ok(fs.existsSync(path.join(web, r)), r);
  assert.match(ler('js/app.js'), /serviceWorker\.register\('sw\.js'\)/);
});

test('config.js não contém segredo', () => {
  const cfg = ler('js/config.js');
  assert.doesNotMatch(cfg, /secret|AIza|PLANILHA/i);
});
