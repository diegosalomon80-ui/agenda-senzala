const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const raiz = path.join(__dirname, '..');
const CABECALHO = '// GERADO por scripts/sincronizar.js — edite shared/regras.js\n';

test('sincronizar copia shared/regras.js para api e web', () => {
  execFileSync(process.execPath, [path.join(raiz, 'scripts', 'sincronizar.js')]);
  const fonte = fs.readFileSync(path.join(raiz, 'shared', 'regras.js'), 'utf8');
  for (const destino of ['api/Regras.js', 'web/js/regras.js']) {
    assert.equal(fs.readFileSync(path.join(raiz, destino), 'utf8'), CABECALHO + fonte, destino);
  }
});
