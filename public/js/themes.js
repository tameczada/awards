window.VOTACAO_THEMES = {
  premiere: {
    label: 'Premiação · Dourado',
    swatch: ['#cba135', '#7a1f2b'],
    gold: '#cba135', goldSoft: '#e4c874', crimson: '#7a1f2b', crimsonSoft: '#9c3040',
  },
  rose: {
    label: 'Rosa Neon',
    swatch: ['#ff4f9a', '#7a1f45'],
    gold: '#ff4f9a', goldSoft: '#ff8fc2', crimson: '#7a1f45', crimsonSoft: '#a8305f',
  },
  esmeralda: {
    label: 'Esmeralda',
    swatch: ['#34c78a', '#1f4d3a'],
    gold: '#34c78a', goldSoft: '#7fe3b4', crimson: '#1f4d3a', crimsonSoft: '#2c6b4f',
  },
  oceano: {
    label: 'Oceano',
    swatch: ['#3fa9e8', '#17384f'],
    gold: '#3fa9e8', goldSoft: '#8ccdf2', crimson: '#17384f', crimsonSoft: '#2c5b78',
  },
  royal: {
    label: 'Royal Purple',
    swatch: ['#a875e8', '#3a1f5c'],
    gold: '#a875e8', goldSoft: '#cbabf2', crimson: '#3a1f5c', crimsonSoft: '#5c3a82',
  },
};

// chaves de cor que podem ser sobrescritas no modo "personalizado"
window.VOTACAO_COLOR_KEYS = ['gold', 'goldSoft', 'crimson', 'crimsonSoft', 'void', 'card', 'cream'];

const CSS_VAR_MAP = {
  gold: '--gold', goldSoft: '--gold-soft', crimson: '--crimson', crimsonSoft: '--crimson-soft',
  void: '--void', card: '--card', cream: '--cream',
};

// tons derivados automaticamente quando o fundo/cartão é personalizado,
// pra manter contraste e hierarquia visual coerentes
function deriveExtras(colors) {
  const root = document.documentElement.style;
  if (colors.void) root.setProperty('--void-2', colors.void);
  if (colors.card) root.setProperty('--card-hover', colors.card);
}

window.applyVotacaoTheme = function applyVotacaoTheme(key, customColors) {
  const root = document.documentElement.style;
  window.VOTACAO_COLOR_KEYS.forEach((k) => root.removeProperty(CSS_VAR_MAP[k]));
  root.removeProperty('--void-2');
  root.removeProperty('--card-hover');

  if (key === 'custom' && customColors) {
    window.VOTACAO_COLOR_KEYS.forEach((k) => {
      if (customColors[k]) root.setProperty(CSS_VAR_MAP[k], customColors[k]);
    });
    deriveExtras(customColors);
    return;
  }

  const t = window.VOTACAO_THEMES[key] || window.VOTACAO_THEMES.premiere;
  root.setProperty('--gold', t.gold);
  root.setProperty('--gold-soft', t.goldSoft);
  root.setProperty('--crimson', t.crimson);
  root.setProperty('--crimson-soft', t.crimsonSoft);
};

// =====================================================
// PARES DE FONTES
// =====================================================
window.VOTACAO_FONTS = {
  classic: {
    label: 'Clássico · Editorial',
    display: '"Fraunces", Georgia, serif',
    body: '"Inter", -apple-system, sans-serif',
    italic: true,
    google: 'family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=Inter:wght@400;500;600',
  },
  elegante: {
    label: 'Elegante · Clássico',
    display: '"Playfair Display", Georgia, serif',
    body: '"Inter", -apple-system, sans-serif',
    italic: true,
    google: 'family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&family=Inter:wght@400;500;600',
  },
  moderno: {
    label: 'Moderno · Geométrico',
    display: '"Space Grotesk", sans-serif',
    body: '"Inter", -apple-system, sans-serif',
    italic: false,
    google: 'family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600',
  },
  impacto: {
    label: 'Impacto · Pôster',
    display: '"Bebas Neue", sans-serif',
    body: '"Inter", -apple-system, sans-serif',
    italic: false,
    google: 'family=Bebas+Neue&family=Inter:wght@400;500;600',
  },
  jornal: {
    label: 'Jornal · Serifado',
    display: '"Libre Baskerville", Georgia, serif',
    body: '"Source Sans 3", sans-serif',
    italic: true,
    google: 'family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@400;500;600',
  },
  divertido: {
    label: 'Divertido · Arredondado',
    display: '"Fredoka", sans-serif',
    body: '"Nunito", -apple-system, sans-serif',
    italic: false,
    google: 'family=Fredoka:wght@500;600;700&family=Nunito:wght@400;500;600',
  },
};

const loadedFontLinks = new Set();

function ensureGoogleFont(googleQuery) {
  if (loadedFontLinks.has(googleQuery)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${googleQuery}&display=swap`;
  document.head.appendChild(link);
  loadedFontLinks.add(googleQuery);
}

window.applyVotacaoFont = function applyVotacaoFont(key) {
  const f = window.VOTACAO_FONTS[key] || window.VOTACAO_FONTS.classic;
  ensureGoogleFont(f.google);
  const root = document.documentElement.style;
  root.setProperty('--font-display', f.display);
  root.setProperty('--font-body', f.body);
  root.setProperty('--font-display-style', f.italic ? 'italic' : 'normal');
};
