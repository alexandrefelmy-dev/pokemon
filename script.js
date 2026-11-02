// Légendaires · recherche, filtres, tri, version chromatique,
// fiche détaillée et inclinaison des cartes.
// La page fonctionne sans ce script : il ajoute des fonctions,
// il ne remplace rien de ce que font déjà le HTML et le CSS.

const ART = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';
const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest';

const STAT_KEYS = { 'PV': 'pv', 'Attaque': 'attaque', 'Att. Spé.': 'att-spe', 'Vitesse': 'vitesse' };
const SORT_TITLES = {
  nom: 'Ordre alphabétique',
  pv: 'Classement par PV',
  attaque: 'Classement par Attaque',
  'att-spe': 'Classement par Att. Spé.',
  vitesse: 'Classement par Vitesse',
};

const TYPE_LABELS = {
  normal: 'Normal', fire: 'Feu', water: 'Eau', electric: 'Électrik', grass: 'Plante', ice: 'Glace',
  fighting: 'Combat', poison: 'Poison', ground: 'Sol', flying: 'Vol', psychic: 'Psy', bug: 'Insecte',
  rock: 'Roche', ghost: 'Spectre', dragon: 'Dragon', dark: 'Ténèbres', steel: 'Acier', fairy: 'Fée',
};

// Table des types : efficacité d'un type d'attaque sur un type de défense.
// Seules les valeurs différentes de ×1 sont notées.
const TYPE_CHART = {
  normal: { rock: .5, ghost: 0, steel: .5 },
  fire: { fire: .5, water: .5, grass: 2, ice: 2, bug: 2, rock: .5, dragon: .5, steel: 2 },
  water: { fire: 2, water: .5, grass: .5, ground: 2, rock: 2, dragon: .5 },
  electric: { water: 2, electric: .5, grass: .5, ground: 0, flying: 2, dragon: .5 },
  grass: { fire: .5, water: 2, grass: .5, poison: .5, ground: 2, flying: .5, bug: .5, rock: 2, dragon: .5, steel: .5 },
  ice: { fire: .5, water: .5, grass: 2, ice: .5, ground: 2, flying: 2, dragon: 2, steel: .5 },
  fighting: { normal: 2, ice: 2, poison: .5, flying: .5, psychic: .5, bug: .5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: .5 },
  poison: { grass: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: .5, poison: 2, flying: 0, bug: .5, rock: 2, steel: 2 },
  flying: { electric: .5, grass: 2, fighting: 2, bug: 2, rock: .5, steel: .5 },
  psychic: { fighting: 2, poison: 2, psychic: .5, dark: 0, steel: .5 },
  bug: { fire: .5, grass: 2, fighting: .5, poison: .5, flying: .5, psychic: 2, ghost: .5, dark: 2, steel: .5, fairy: .5 },
  rock: { fire: 2, ice: 2, fighting: .5, ground: .5, flying: 2, bug: 2, steel: .5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: .5 },
  dragon: { dragon: 2, steel: .5, fairy: 0 },
  dark: { fighting: .5, psychic: 2, ghost: 2, dark: .5, fairy: .5 },
  steel: { fire: .5, water: .5, electric: .5, ice: 2, rock: 2, steel: .5, fairy: 2 },
  fairy: { fire: .5, fighting: 2, poison: .5, dragon: 2, dark: 2, steel: .5 },
};

// Minuscules et sans accents : « electhor » trouve « Électhor »
const normalize = (text) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const decimal = (value) => Number(value).toLocaleString('fr-FR');

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- Transitions de vue ----------
   document.startViewTransition photographie la page, applique le
   changement, puis anime chaque élément nommé de l'ancienne place
   vers la nouvelle. Sans prise en charge, le changement est immédiat. */
function withTransition(change) {
  if (!document.startViewTransition || reduceMotion.matches) {
    change();
    return null;
  }
  return document.startViewTransition(change);
}

const main = document.querySelector('main');
const toolbar = document.querySelector('.toolbar');
const search = document.querySelector('#q');
const typeSelect = document.querySelector('#f-type');
const genSelect = document.querySelector('#f-gen');
const sortSelect = document.querySelector('#f-sort');
const shinyToggle = document.querySelector('.toolbar__shiny');
const count = document.querySelector('.toolbar__count output');
const clearButton = document.querySelector('.toolbar__clear');
const empty = document.querySelector('.empty');

/* ---------- Lecture des cartes ----------
   Toutes les informations sont déjà dans le HTML : on les relit
   une fois au chargement plutôt que de les dupliquer. */
const sections = [...document.querySelectorAll('.gen')].map((section) => {
  const title = section.querySelector('.gen__title');
  return {
    el: section,
    id: title.id,
    name: title.firstChild.textContent.trim(),
    region: title.querySelector('span').textContent.split('·')[0].trim(),
    label: title.querySelector('span'),
  };
});

const cards = [...document.querySelectorAll('.card')].map((el) => {
  const img = el.querySelector('.poke img');
  const num = Number(el.getAttribute('aria-labelledby').slice(1));
  return {
    el,
    img,
    num,
    home: el.parentElement, // grille d'origine, pour revenir au tri par numéro
    src: img.getAttribute('src'),
    alt: img.alt,
    name: el.querySelector('h3').textContent.trim(),
    numLabel: el.querySelector('.card__num').textContent,
    desc: el.querySelector('.card__desc').textContent,
    typeKeys: [...el.querySelectorAll('.type')].map((type) => type.className.match(/type--(\w+)/)[1]),
    types: [...el.querySelectorAll('.type')].map((type) => type.textContent.trim()),
    gen: el.closest('.gen').querySelector('.gen__title').id,
    stats: Object.fromEntries([...el.querySelectorAll('.stat')].map((stat) => [
      STAT_KEYS[stat.querySelector('dt').textContent.trim()],
      Number(stat.querySelector('dd').textContent),
    ])),
    defense: Number(el.dataset.def),
    specialDefense: Number(el.dataset.defSpe),
    height: el.dataset.taille,
    weight: el.dataset.poids,
  };
});

const shinySrc = (card) => `${ART}/shiny/${card.num}.png`;

/* ---------- Préparation des cartes ---------- */
for (const card of cards) {
  // Un nom unique par carte : c'est lui qui permet de la faire glisser.
  // Le CSS ne l'applique que pendant un tri ou un filtrage (classe tri-en-cours).
  card.el.style.setProperty('--vt-name', `carte-${card.num}`);

  // Le nom devient un bouton qui ouvre la fiche. Son ::after couvre
  // toute la carte, si bien qu'un clic n'importe où l'ouvre aussi.
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'card__open';
  open.innerHTML = `${card.name}<span class="sr-only"> : voir la fiche</span>`;
  open.addEventListener('click', () => openFiche(card));
  card.el.querySelector('h3').replaceChildren(open);
}

/* ---------- Remplissage des listes ---------- */
const allTypes = [...new Set(cards.flatMap((card) => card.types))].sort((a, b) => a.localeCompare(b, 'fr'));
typeSelect.append(...allTypes.map((type) => new Option(type, type)));
genSelect.append(...sections.map((s) => new Option(`${s.name.replace('Génération ', '')} · ${s.region}`, s.id)));

/* ---------- Section « Classement » pour les tris autres que par numéro ----------
   Trier par Attaque n'a de sens que sur l'ensemble des cartes :
   elles quittent alors leur génération pour une grille unique. */
const results = document.createElement('section');
results.className = 'gen';
results.hidden = true;
results.setAttribute('aria-labelledby', 'gen-classement');
results.innerHTML = '<h2 class="gen__title" id="gen-classement"><span></span></h2><div class="cards"></div>';
main.prepend(results);
const resultsName = document.createTextNode('');
const resultsCount = results.querySelector('h2 span');
results.querySelector('h2').prepend(resultsName, ' ');
const resultsGrid = results.querySelector('.cards');

/* ---------- Mise à jour de l'affichage ---------- */
function render() {
  const query = normalize(search.value.trim());
  const numberQuery = /^\d+$/.test(query) ? String(Number(query)) : null;
  const type = typeSelect.value;
  const gen = genSelect.value;
  const sort = sortSelect.value;

  let visible = 0;
  for (const card of cards) {
    const matchesText = !query
      || normalize(card.name).includes(query)
      || (numberQuery !== null && String(card.num).includes(numberQuery));
    const match = matchesText && (!type || card.types.includes(type)) && (!gen || card.gen === gen);
    card.el.hidden = !match;
    if (match) visible += 1;
  }

  // Tri : par numéro, chaque carte retourne dans sa génération ;
  // sinon, toutes passent dans la grille de classement, dans l'ordre voulu.
  const ranked = sort !== 'num';
  if (ranked) {
    const order = sort === 'nom'
      ? (a, b) => a.name.localeCompare(b.name, 'fr')
      : (a, b) => b.stats[sort] - a.stats[sort] || a.num - b.num;
    resultsGrid.append(...[...cards].sort(order).map((card) => card.el));
    resultsName.data = SORT_TITLES[sort];
    resultsCount.textContent = `${visible} Pokémon`;
  } else if (resultsGrid.children.length) {
    for (const card of cards) card.home.append(card.el);
  }
  results.hidden = !ranked || visible === 0;

  // Chaque génération affiche son propre compte, et disparaît si elle est vide
  for (const section of sections) {
    const shown = cards.filter((card) => card.gen === section.id && !card.el.hidden).length;
    section.label.textContent = `${section.region} · ${shown} Pokémon`;
    section.el.hidden = ranked || shown === 0;
  }

  count.value = visible === cards.length ? `${cards.length} Pokémon` : `${visible} Pokémon sur ${cards.length}`;
  empty.hidden = visible > 0;
  clearButton.hidden = !(query || type || gen || ranked);
}

// Chaque changement de filtre ou de tri fait glisser les cartes.
// Les cartes ne sont nommées que le temps de cette transition : nommées en
// permanence, elles passeraient devant la fiche quand on l'ouvre.
let sortTransitions = 0;
function update() {
  document.documentElement.classList.add('tri-en-cours');
  sortTransitions += 1;
  const transition = withTransition(render);
  const done = () => {
    sortTransitions -= 1;
    if (sortTransitions === 0) document.documentElement.classList.remove('tri-en-cours');
  };
  if (transition) transition.finished.finally(done);
  else done();
}

toolbar.addEventListener('input', update);
toolbar.addEventListener('submit', (event) => event.preventDefault());
// L'événement reset part avant que les champs soient vidés : on attend un tour
toolbar.addEventListener('reset', () => setTimeout(update));
empty.querySelector('button').addEventListener('click', () => toolbar.reset());

/* ---------- Version chromatique de toutes les cartes ---------- */
let shinyMode = false;

shinyToggle.addEventListener('click', () => {
  shinyMode = !shinyMode;
  shinyToggle.setAttribute('aria-pressed', shinyMode);
  for (const card of cards) {
    card.img.src = shinyMode ? shinySrc(card) : card.src;
    card.img.alt = shinyMode ? `${card.alt}, version chromatique` : card.alt;
  }
});

toolbar.hidden = false;
render();

/* =========================================================
   Fiche détaillée
   ========================================================= */
const dialog = document.querySelector('.fiche');
const fiche = {
  img: dialog.querySelector('.fiche__art img'),
  num: dialog.querySelector('.card__num'),
  name: dialog.querySelector('#fiche-nom'),
  types: dialog.querySelector('.types'),
  desc: dialog.querySelector('.fiche__desc'),
  cry: dialog.querySelector('.fiche__cri'),
  shiny: dialog.querySelector('.fiche__shiny'),
  height: dialog.querySelector('[data-champ="taille"]'),
  weight: dialog.querySelector('[data-champ="poids"]'),
  total: dialog.querySelector('[data-champ="total"]'),
  stats: dialog.querySelector('.fiche__stats'),
  weaknesses: dialog.querySelector('.fiche__faiblesses'),
};

let current = null;
let ficheShiny = false;
let audio = null;

// Multiplicateur de dégâts de chaque type d'attaque sur ce Pokémon
function weaknessesOf(typeKeys) {
  return Object.keys(TYPE_CHART)
    .map((attack) => ({
      attack,
      factor: typeKeys.reduce((total, defense) => total * (TYPE_CHART[attack][defense] ?? 1), 1),
    }))
    .filter(({ factor }) => factor > 1)
    .sort((a, b) => b.factor - a.factor || TYPE_LABELS[a.attack].localeCompare(TYPE_LABELS[b.attack], 'fr'));
}

function showFicheImage() {
  fiche.img.src = ficheShiny ? shinySrc(current) : current.src;
  fiche.img.alt = ficheShiny ? `${current.alt}, version chromatique` : current.alt;
  fiche.shiny.setAttribute('aria-pressed', ficheShiny);
}

function fillFiche(card) {
  current = card;

  // La fiche reprend les couleurs de la carte
  for (const name of ['--h', '--h2', '--c', '--hb']) {
    dialog.style.setProperty(name, card.el.style.getPropertyValue(name) || null);
  }

  showFicheImage();
  fiche.num.textContent = card.numLabel;
  fiche.name.textContent = card.name;
  fiche.types.replaceChildren(...[...card.el.querySelectorAll('.type')].map((type) => type.cloneNode(true)));
  fiche.desc.textContent = card.desc;
  fiche.height.textContent = `${decimal(card.height)} m`;
  fiche.weight.textContent = `${decimal(card.weight)} kg`;

  const stats = [
    ['PV', card.stats.pv],
    ['Attaque', card.stats.attaque],
    ['Défense', card.defense],
    ['Att. Spé.', card.stats['att-spe']],
    ['Déf. Spé.', card.specialDefense],
    ['Vitesse', card.stats.vitesse],
  ];
  fiche.total.textContent = stats.reduce((sum, [, value]) => sum + value, 0);
  fiche.stats.innerHTML = stats
    .map(([label, value]) => `<div class="stat" style="--v: ${value}"><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('');

  fiche.weaknesses.innerHTML = weaknessesOf(card.typeKeys)
    .map(({ attack, factor }) => `<li class="type type--${attack}">${TYPE_LABELS[attack]} <b>×${factor}</b></li>`)
    .join('');

  stopCry();
}

/* La fiche s'ouvre directement, avec une animation CSS (voir .fiche[open]).
   Pas de transition de vue ici : elle remplace la page par des captures
   le temps de l'animation, et la fiche arrivait au premier plan en retard. */
function openFiche(card) {
  ficheShiny = shinyMode;
  fillFiche(card);
  dialog.showModal();
}

function closeFiche() {
  stopCry();
  dialog.close();
}

// Trois façons de fermer : le bouton ✕, la touche Échap, un clic à côté
dialog.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault();
  closeFiche();
});
dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeFiche();
});
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) closeFiche();
});

fiche.shiny.addEventListener('click', () => {
  ficheShiny = !ficheShiny;
  showFicheImage();
});

/* ---------- Cri du Pokémon : uniquement au clic ---------- */
function stopCry() {
  audio?.pause();
  audio = null;
  fiche.cry.textContent = 'Écouter le cri';
}

fiche.cry.addEventListener('click', () => {
  stopCry();
  const sound = new Audio(`${CRIES}/${current.num}.ogg`);
  sound.volume = .6;
  const unavailable = () => { fiche.cry.textContent = 'Cri indisponible sur ce navigateur'; };
  sound.addEventListener('ended', () => { fiche.cry.textContent = 'Écouter le cri'; });
  sound.addEventListener('error', unavailable);
  fiche.cry.textContent = 'Lecture…';
  sound.play().catch(unavailable);
  audio = sound;
});

/* ---------- Inclinaison qui suit la souris ----------
   La position du curseur est transmise au CSS par --mx et --my (de 0 à 1).
   Le CSS en déduit l'angle de la carte et la place du reflet. */
for (const { el } of cards) {
  let frame = 0;

  el.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || reduceMotion.matches) return;
    cancelAnimationFrame(frame);
    // Une seule mise à jour par image affichée, même si la souris bouge plus vite
    frame = requestAnimationFrame(() => {
      const box = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((event.clientX - box.left) / box.width).toFixed(3));
      el.style.setProperty('--my', ((event.clientY - box.top) / box.height).toFixed(3));
      el.classList.add('is-tilting');
    });
  });

  el.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame);
    el.classList.remove('is-tilting');
  });
}
