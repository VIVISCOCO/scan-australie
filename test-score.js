// Lancer : node test-score.js
const assert = require('assert');
const { noter, additifsDuTexte } = require('./score.js');

assert.deepStrictEqual(additifsDuTexte('Flour, Preservative (282), Emulsifiers (471, 481), Black Beans (60%), E250').sort(), ['250', '282', '471', '481']);

const haricots = noter({ nom: 'Black beans', ingredients: 'Black Beans (60%), Water.', categories: ['en:legumes'], nova: 1, sucre: 0.1, sel: 0.02, proteines: 7 });
assert.strictEqual(haricots.note, 90); // végétal non bio : -10

const jambon = noter({ nom: 'Ham', ingredients: 'Pork (90%), Salt, Preservative (250)', categories: ['en:meats'], sucre: 1, sel: 2.5, proteines: 18 });
assert.ok(jambon.note <= 49, 'nitrite = plafond 49');

const steakBio = noter({ nom: 'Grass fed beef mince', ingredients: 'Beef', labels: ['en:organic'], categories: ['en:meats'], nova: 1, proteines: 20 });
assert.strictEqual(steakBio.note, 100);

console.log('OK', haricots.note, jambon.note, steakBio.note);
