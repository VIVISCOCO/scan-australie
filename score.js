// Note santé d'un produit sur 100, selon les priorités de Leo :
// additifs, transformation, pesticides, antibiotiques/hormones, sucre, récupération.

// Additifs classés par numéro (les étiquettes australiennes écrivent "Preservative (282)").
const ADDITIFS = {
  rouge: { // à risque : plafonne la note à 49
    '249': 'Nitrite de potassium', '250': 'Nitrite de sodium', '251': 'Nitrate de sodium', '252': 'Nitrate de potassium',
    '171': 'Dioxyde de titane', '319': 'TBHQ (perturbateur endocrinien suspecté)', '320': 'BHA (perturbateur endocrinien suspecté)',
    '321': 'BHT (perturbateur endocrinien suspecté)', '951': 'Aspartame', '950': 'Acésulfame K', '955': 'Sucralose', '954': 'Saccharine',
    '102': 'Tartrazine', '104': 'Jaune de quinoléine', '110': 'Jaune orangé S', '122': 'Azorubine', '124': 'Ponceau 4R', '129': 'Rouge allura',
    '150c': 'Caramel ammoniacal', '150d': 'Caramel au sulfite d\'ammonium', '407': 'Carraghénanes', '433': 'Polysorbate 80',
    '466': 'Carboxyméthylcellulose', '338': 'Acide phosphorique', '339': 'Phosphates de sodium', '340': 'Phosphates de potassium',
    '341': 'Phosphates de calcium', '450': 'Diphosphates', '451': 'Triphosphates', '452': 'Polyphosphates'
  },
  orange: { // risque modéré
    '211': 'Benzoate de sodium', '210': 'Acide benzoïque', '282': 'Propionate de calcium', '281': 'Propionate de sodium', '280': 'Acide propionique',
    '220': 'Sulfites', '221': 'Sulfites', '223': 'Sulfites', '224': 'Sulfites', '228': 'Sulfites', '621': 'Glutamate (MSG)',
    '471': 'Mono- et diglycérides', '472e': 'Esters DATEM', '476': 'PGPR', '481': 'Stéaroyl lactylate', '482': 'Stéaroyl lactylate',
    '491': 'Monostéarate de sorbitane', '120': 'Carmin', '132': 'Indigotine', '133': 'Bleu brillant', '143': 'Vert solide', '155': 'Brun HT',
    '385': 'EDTA', '952': 'Cyclamate', '962': 'Sel d\'aspartame-acésulfame'
  },
  jaune: { // risque limité
    '200': 'Acide sorbique', '202': 'Sorbate de potassium', '160b': 'Rocou', '627': 'Guanylate', '631': 'Inosinate', '635': 'Ribonucléotides',
    '960': 'Stévia', '965': 'Maltitol', '420': 'Sorbitol', '1442': 'Amidon modifié', '1422': 'Amidon modifié', '1412': 'Amidon modifié',
    '412': 'Gomme de guar', '415': 'Gomme xanthane', '150a': 'Caramel'
  }
};

const MOTS = {
  bio: /\b(organic|biologique|\bbio\b|australian-certified-organic|aco\b|nasaa)/i,
  elevageBon: /(antibiotic|hormone|hgp|grass.?fed|free.?range|pasture|organic)/i,
  animal: /(meat|beef|chicken|poultry|pork|lamb|ham|bacon|sausage|salami|milk|dair|cheese|yog|butter|cream|egg|salmon|fish|seafood|prawn)/i,
  vegetal: /(fruit|vegetable|cereal|grain|oat|wheat|rice|legume|bean|lentil|tea|coffee|cocoa|potato|tomato|berr|apple|spinach)/i,
  ultra: /(flavour|flavor|arôme|maltodextrin|glucose syrup|fructose|dextrose|hydroly[sz]ed|isolate|modified starch|emulsifier|thickener|colour|invert sugar)/i,
  hydrogene: /hydrogenated|hydrogéné/i
};

// Trouve les numéros d'additifs dans une liste d'ingrédients écrite à la main ou lue sur photo.
function additifsDuTexte(texte) {
  const codes = new Set();
  for (const groupe of texte.matchAll(/\(([^()]*)\)/g))
    for (const t of groupe[1].split(/[,;/]/)) {
      const m = t.trim().match(/^e?\s?(\d{3,4}[a-f]?)(?:\s*\(?[ivx]+\)?)?$/i);
      if (m) codes.add(m[1].toLowerCase());
    }
  for (const m of texte.matchAll(/\bE\s?(\d{3,4}[a-f]?)\b/gi)) codes.add(m[1].toLowerCase());
  return [...codes];
}

function niveauAdditif(code) {
  const c = code.replace(/^en:/, '').replace(/^e/, '').toLowerCase();
  for (const cle of [c, c.replace(/[a-z]+$/, '')])
    for (const niveau of ['rouge', 'orange', 'jaune'])
      if (ADDITIFS[niveau][cle]) return { niveau, nom: ADDITIFS[niveau][cle], code: 'E' + c };
  return null;
}

// produit : { ingredients, additifs[], labels[], categories[], nova, sucre, sel, proteines } (valeurs pour 100 g)
function noter(p) {
  const texte = [p.ingredients, ...(p.labels || []), ...(p.categories || []), p.nom].join(' ');
  const raisons = [];
  let note = 100, plafond = 100;
  const perte = (pts, txt) => { note -= pts; raisons.push({ bon: false, txt }); };
  const gain = (pts, txt) => { note += pts; raisons.push({ bon: true, txt }); };

  const codes = new Set([...(p.additifs || []), ...additifsDuTexte(p.ingredients || '')]);
  const vus = new Set();
  for (const code of codes) {
    const a = niveauAdditif(code);
    if (!a || vus.has(a.code)) continue;
    vus.add(a.code);
    if (a.niveau === 'rouge') { perte(20, `${a.code} ${a.nom} : additif à risque`); plafond = 49; }
    else if (a.niveau === 'orange') perte(10, `${a.code} ${a.nom} : risque modéré`);
    else perte(3, `${a.code} ${a.nom} : risque limité`);
  }

  // Transformation : NOVA d'Open Food Facts, sinon estimation depuis les ingrédients.
  let nova = p.nova;
  if (!nova && p.ingredients) {
    const nb = p.ingredients.split(/,(?![^()]*\))/).length;
    nova = (MOTS.ultra.test(p.ingredients) || vus.size > 0 || nb > 10) ? 4 : (nb > 3 ? 3 : 1);
  }
  if (nova === 4) perte(25, 'Ultra-transformé');
  else if (nova === 3) perte(10, 'Transformé');
  else if (nova === 1) gain(0, 'Brut ou peu transformé');

  const bio = MOTS.bio.test(texte);
  if (MOTS.animal.test(texte)) {
    if (MOTS.elevageBon.test(texte)) gain(5, 'Élevage mieux contrôlé (bio, plein air, sans antibiotiques ou hormones)');
    else perte(15, 'Produit animal sans garantie sur les antibiotiques et les hormones');
  } else if (MOTS.vegetal.test(texte)) {
    if (bio) gain(5, 'Bio : pas de pesticides de synthèse');
    else perte(10, 'Végétal non bio : pesticides probables');
  }

  if (MOTS.hydrogene.test(p.ingredients || '')) { perte(20, 'Huile hydrogénée (graisses trans)'); plafond = 49; }
  if (p.sucre > 22.5) perte(15, `Très sucré (${Math.round(p.sucre)} g / 100 g) : mauvais pour l'équilibre hormonal`);
  else if (p.sucre > 10) perte(7, `Sucré (${Math.round(p.sucre)} g / 100 g)`);
  if (p.sel > 1.5) perte(10, `Très salé (${p.sel.toFixed(1)} g / 100 g)`);
  if (p.proteines >= 10) gain(5, `Riche en protéines (${Math.round(p.proteines)} g / 100 g) : bon pour la récupération`);

  note = Math.max(0, Math.min(100, plafond, Math.round(note)));
  const niveau = note >= 75 ? 'Excellent' : note >= 50 ? 'Bon' : note >= 25 ? 'Médiocre' : 'Mauvais';
  return { note, niveau, raisons };
}

if (typeof module !== 'undefined') module.exports = { noter, additifsDuTexte, niveauAdditif };
