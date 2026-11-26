// Copia shared/regras.js para a API (Apps Script) e para o front (web).
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const CABECALHO = '// GERADO por scripts/sincronizar.js — edite shared/regras.js\n';
const fonte = fs.readFileSync(path.join(raiz, 'shared', 'regras.js'), 'utf8');

for (const destino of ['api/Regras.js', 'web/js/regras.js']) {
  const alvo = path.join(raiz, destino);
  fs.mkdirSync(path.dirname(alvo), { recursive: true });
  fs.writeFileSync(alvo, CABECALHO + fonte);
}
console.log('regras.js sincronizado');
