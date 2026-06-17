// ============================================================
// CLASSI  (riuso D2)
// ============================================================
class Libro {
  constructor(titolo, autore, anno) {
    this.titolo = titolo;
    this.autore = autore;
    this.anno = anno;
    this.letto = false;
    this.formato = 'cartaceo';
    this.id = Date.now() + '-' + Math.floor(Math.random() * 10000);
  }

  segnaComeLetto() {
    this.letto = true;
  }
}

class LibroDigitale extends Libro {
  constructor(titolo, autore, anno, dimensioneMb) {
    super(titolo, autore, anno);
    this.formato = 'digitale';
    this.dimensioneMb = dimensioneMb || (Math.random() * 10 + 0.5).toFixed(1);
  }
}

// ============================================================
// STORAGE
// ============================================================
const STORAGE_KEY = 'libri';
const QUERY_KEY = 'ultimaQuery';

function salvaLibri() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(libri));
  } catch (e) {
    console.error('localStorage non disponibile:', e);
  }
}

function caricaLibri() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.error('localStorage non disponibile:', e);
    return [];
  }
  if (raw === null) return [];

  return JSON.parse(raw).map(d => {
    let l;
    if (d.dimensioneMb !== undefined) {
      l = new LibroDigitale(d.titolo, d.autore, d.anno, d.dimensioneMb);
    } else {
      l = new Libro(d.titolo, d.autore, d.anno);
    }
    l.id = d.id;
    l.letto = d.letto;
    return l;
  });
}

// ============================================================
// STATO
// ============================================================
let libri = caricaLibri();
let ultimiRisultati = []; // cache dei docs mostrati, per ri-render coerente

// ============================================================
// RIFERIMENTI DOM
// ============================================================
const inputCerca  = document.getElementById('cerca');
const statoEl     = document.getElementById('stato-ricerca');
const risultatiUl = document.getElementById('risultati');
const listaUl     = document.getElementById('lista-libri');

// ============================================================
// LIBRERIA PERSONALE — RENDER
// ============================================================
function renderLibri() {
  document.getElementById('titolo-lista').textContent = `I tuoi libri (${libri.length})`;
  listaUl.replaceChildren();

  if (libri.length === 0) {
    const li = document.createElement('li');
    li.className = 'lista-vuota';
    li.append(document.createTextNode('Nessun libro nella tua libreria.'));
    listaUl.append(li);
    return;
  }

  libri.forEach(libro => {
    const badgeLabel = libro.formato === 'digitale'
      ? `digitale (${libro.dimensioneMb} MB)`
      : 'cartaceo';

    const li = document.createElement('li');
    li.className = libro.letto ? 'libro-item letto' : 'libro-item';
    li.dataset.id = libro.id;

    const divInfo = document.createElement('div');
    divInfo.className = 'libro-info';

    const spanTitolo = document.createElement('span');
    spanTitolo.className = 'libro-titolo';
    spanTitolo.append(document.createTextNode(libro.titolo));

    const spanBadge = document.createElement('span');
    spanBadge.className = 'badge';
    spanBadge.append(document.createTextNode(badgeLabel));

    const divDettagli = document.createElement('div');
    divDettagli.className = 'libro-dettagli';
    divDettagli.append(document.createTextNode(`${libro.autore} — ${libro.anno}`));

    divInfo.append(spanTitolo, spanBadge, divDettagli);

    const divAzioni = document.createElement('div');
    divAzioni.className = 'libro-azioni';

    if (libro.letto) {
      const spanLetto = document.createElement('span');
      spanLetto.className = 'letto-label';
      spanLetto.append(document.createTextNode('✓ letto'));
      divAzioni.append(spanLetto);
    } else {
      const btnLetto = document.createElement('button');
      btnLetto.className = 'btn-letto';
      btnLetto.dataset.azione = 'leggi';
      btnLetto.dataset.id = libro.id;
      btnLetto.append(document.createTextNode('Segna come letto'));
      divAzioni.append(btnLetto);
    }

    const btnRimuovi = document.createElement('button');
    btnRimuovi.className = 'btn-rimuovi';
    btnRimuovi.dataset.azione = 'rimuovi';
    btnRimuovi.dataset.id = libro.id;
    btnRimuovi.append(document.createTextNode('Rimuovi'));
    divAzioni.append(btnRimuovi);

    li.append(divInfo, divAzioni);
    listaUl.append(li);
  });
}

// ============================================================
// RICERCA — STATI UI
// ============================================================
function mostraSpinner() {
  statoEl.replaceChildren();
  const wrap = document.createElement('div');
  wrap.className = 'spinner-wrap';
  const sp = document.createElement('div');
  sp.className = 'spinner';
  wrap.append(sp, document.createTextNode('Carico…'));
  statoEl.append(wrap);
  risultatiUl.replaceChildren();
}

function mostraErrore(messaggio) {
  statoEl.replaceChildren();
  const alert = document.createElement('div');
  alert.className = 'alert-errore';
  alert.append(document.createTextNode(messaggio));
  statoEl.append(alert);
  risultatiUl.replaceChildren();
}

function pulisciStato() {
  statoEl.replaceChildren();
}

// ============================================================
// RICERCA — LOGICA
// ============================================================

/**
 * Esegue la ricerca su Open Library e aggiorna l'interfaccia.
 * Con query vuota carica i libri di tendenza (trending/daily.json),
 * altrimenti interroga search.json. Gestisce gli stati
 * spinner / errore / risultati e salva l'ultima query in localStorage.
 *
 * @async
 * @param {string} query - Testo digitato dall'utente (titolo o autore).
 * @returns {Promise<void>}
 */
function cerca(query) {
  const q = query.trim();
  localStorage.setItem(QUERY_KEY, q); // punto 19: salva l'ultima query

  mostraSpinner();

  let fetchPromise;

  if (q === '') {
    // Nessuna query → libri più famosi (API tendenze)
    fetchPromise = fetch('https://openlibrary.org/trending/daily.json')
      .then(res => {
        if (!res.ok) return Promise.reject(new Error('HTTP ' + res.status));
        return res.json();
      })
      .then(data => data.works || []);
  } else {
    const url = 'https://openlibrary.org/search.json?q=' +
                encodeURIComponent(q) + '&limit=12';
    fetchPromise = fetch(url)
      .then(res => {
        if (!res.ok) return Promise.reject(new Error('HTTP ' + res.status));
        return res.json();
      })
      .then(data => data.docs || []);
  }

  return fetchPromise
    .then(docs => {
      pulisciStato();
      renderRisultati(docs);
    })
    .catch(err => {
      mostraErrore('Errore nel caricamento dei risultati. Riprova. (' + err.message + ')');
    });
}

/**
 * Renderizza la lista dei risultati di ricerca.
 * Scarta i documenti privi di author_name (punto 18), poi crea per ciascuno
 * una riga con i bottoni "Dettagli" e "Aggiungi" (disabilitato se il libro
 * è già presente in libreria).
 *
 * @param {Array<Object>} docs - Documenti restituiti da Open Library.
 * @param {string}   docs[].title              - Titolo del libro.
 * @param {string[]} [docs[].author_name]      - Autori del libro.
 * @param {number}   [docs[].first_publish_year] - Anno di prima pubblicazione.
 * @param {string}   [docs[].key]              - Chiave dell'opera (es. "/works/OL...W").
 * @returns {void}
 */
function renderRisultati(docs) {
  ultimiRisultati = docs;
  risultatiUl.replaceChildren();

  // punto 18: scarta i libri senza autore
  const validi = docs.filter(d => d.author_name);

  if (validi.length === 0) {
    const li = document.createElement('li');
    li.className = 'lista-vuota';
    li.append(document.createTextNode('Nessun risultato.'));
    risultatiUl.append(li);
    return;
  }

  validi.slice(0, 12).forEach(d => {
    const titolo = d.title || 'Senza titolo';
    const autore = d.author_name[0];
    const anno   = d.first_publish_year ?? '—';

    const giaInLibreria = libri.some(l =>
      l.titolo.toLowerCase() === titolo.toLowerCase() &&
      l.autore.toLowerCase() === autore.toLowerCase());

    const li = document.createElement('li');
    li.className = 'risultato-item';

    const info = document.createElement('div');
    info.className = 'ris-info';

    const t = document.createElement('div');
    t.className = 'ris-titolo';
    t.append(document.createTextNode(titolo));

    const dett = document.createElement('div');
    dett.className = 'ris-dettagli';
    dett.append(document.createTextNode(`${autore} — ${anno}`));

    info.append(t, dett);

    const azioni = document.createElement('div');
    azioni.className = 'ris-azioni';

    // Bottone Dettagli (punto 20)
    const btnDett = document.createElement('button');
    btnDett.className = 'btn-dettagli';
    btnDett.append(document.createTextNode('Dettagli'));
    btnDett.addEventListener('click', () => mostraDettagli(d.key));

    // Bottone Aggiungi
    const btnAdd = document.createElement('button');
    btnAdd.className = giaInLibreria ? 'btn-add aggiunto' : 'btn-add';
    btnAdd.disabled = giaInLibreria;
    btnAdd.append(document.createTextNode(giaInLibreria ? '✓ Aggiunto' : 'Aggiungi'));
    if (!giaInLibreria) {
      btnAdd.addEventListener('click', () => {
        aggiungiDaRicerca(titolo, autore, anno);
        renderRisultati(ultimiRisultati); // sincronizza lo stato "Aggiunto"
      });
    }

    azioni.append(btnDett, btnAdd);
    li.append(info, azioni);
    risultatiUl.append(li);
  });
}

/**
 * Crea un oggetto Libro (riuso D2) dai dati del risultato e lo aggiunge
 * alla libreria personale, persistendo su localStorage.
 *
 * @param {string} titolo
 * @param {string} autore
 * @param {(number|string)} anno
 * @returns {void}
 */
function aggiungiDaRicerca(titolo, autore, anno) {
  const nuovo = new Libro(titolo, autore, anno);
  libri.push(nuovo);
  salvaLibri();
  renderLibri();
}

/**
 * Recupera i dettagli dell'opera (punto 20) e mostra la descrizione in alert.
 * La description di Open Library può essere una stringa oppure un oggetto
 * { type, value }: entrambi i casi sono gestiti.
 *
 * @async
 * @param {string} key - Chiave dell'opera (es. "/works/OL...W").
 * @returns {Promise<void>}
 */
function mostraDettagli(key) {
  if (!key) {
    alert('nessuna descrizione');
    return;
  }
  return fetch('https://openlibrary.org' + key + '.json')
    .then(res => {
      if (!res.ok) return Promise.reject(new Error('HTTP ' + res.status));
      return res.json();
    })
    .then(data => {
      let desc = data.description;
      if (desc && typeof desc === 'object') desc = desc.value; // { type, value }
      alert(desc || 'nessuna descrizione');
    })
    .catch(() => {
      alert('Errore nel recupero dei dettagli.');
    });
}

// ============================================================
// UTILITY
// ============================================================
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ============================================================
// EVENTI
// ============================================================
const cercaDebounced = debounce(cerca, 400); // punto: debounce 400ms
inputCerca.addEventListener('input', (e) => cercaDebounced(e.target.value));

// Lista personale: leggi / rimuovi (event delegation, riuso D2)
listaUl.addEventListener('click', (e) => {
  const bottone = e.target.closest('[data-azione]');
  if (!bottone) return;

  const azione = bottone.dataset.azione;
  const id     = bottone.dataset.id;

  if (azione === 'leggi') {
    const libro = libri.find(l => l.id === id);
    if (libro) libro.segnaComeLetto();
  }
  if (azione === 'rimuovi') {
    libri = libri.filter(l => l.id !== id);
  }

  salvaLibri();
  renderLibri();
  renderRisultati(ultimiRisultati); // riallinea i bottoni "Aggiungi/Aggiunto"
});

// Esporta JSON
document.getElementById('btn-esporta').addEventListener('click', () => {
  const json = JSON.stringify(libri, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'libri.json';
  a.click();
  URL.revokeObjectURL(url);
});

// Svuota tutto
document.getElementById('svuota-tutto').addEventListener('click', () => {
  if (!confirm('Sei sicuro? Verranno eliminati tutti i libri.')) return;
  libri = [];
  localStorage.removeItem(STORAGE_KEY);
  renderLibri();
  renderRisultati(ultimiRisultati);
});

// ============================================================
// AVVIO
// ============================================================
renderLibri();

// punto 19: ripristina l'ultima query, altrimenti carica i libri famosi
const querySalvata = localStorage.getItem(QUERY_KEY);
if (querySalvata) {
  inputCerca.value = querySalvata;
}
cerca(inputCerca.value); // query vuota → trending; query salvata → ricerca