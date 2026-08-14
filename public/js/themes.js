window.VOTACAO_THEMES = {
  premiere: {
    label: 'Premiação · Dourado',
    swatch: ['#cba135', '#7a1f2b'],
    gold: '#cba135',
    goldSoft: '#e4c874',
    crimson: '#7a1f2b',
    crimsonSoft: '#9c3040',
  },
  rose: {
    label: 'Rosa Neon',
    swatch: ['#ff4f9a', '#7a1f45'],
    gold: '#ff4f9a',
    goldSoft: '#ff8fc2',
    crimson: '#7a1f45',
    crimsonSoft: '#a8305f',
  },
  esmeralda: {
    label: 'Esmeralda',
    swatch: ['#34c78a', '#1f4d3a'],
    gold: '#34c78a',
    goldSoft: '#7fe3b4',
    crimson: '#1f4d3a',
    crimsonSoft: '#2c6b4f',
  },
  oceano: {
    label: 'Oceano',
    swatch: ['#3fa9e8', '#17384f'],
    gold: '#3fa9e8',
    goldSoft: '#8ccdf2',
    crimson: '#17384f',
    crimsonSoft: '#2c5b78',
  },
  royal: {
    label: 'Royal Purple',
    swatch: ['#a875e8', '#3a1f5c'],
    gold: '#a875e8',
    goldSoft: '#cbabf2',
    crimson: '#3a1f5c',
    crimsonSoft: '#5c3a82',
  },
};

window.applyVotacaoTheme = function applyVotacaoTheme(key) {
  const t = window.VOTACAO_THEMES[key] || window.VOTACAO_THEMES.premiere;
  const root = document.documentElement.style;
  root.setProperty('--gold', t.gold);
  root.setProperty('--gold-soft', t.goldSoft);
  root.setProperty('--crimson', t.crimson);
  root.setProperty('--crimson-soft', t.crimsonSoft);
};
