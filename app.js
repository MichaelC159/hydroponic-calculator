const settingsKey = 'nutrientCalcSettingsV5';
const presetsKey = 'nutrientCalcPresetsV5';

const defaults = {
  mbPerLiter100: 0.53,
  mgPerLiter100: 0.265,
  caPerLiter100: 0.53,
  acidMlPerLiter100: 0.10,
  recipeName: 'Leafy greens Masterblend 3-part',
  darkMode: false
};

const ids = [
  'waterVolume', 'nutrientPercent', 'strengthSlider', 'sliderBubble', 'sliderCard',
  'mbPerLiter100', 'mgPerLiter100', 'caPerLiter100',
  'acidMlPerLiter100', 'recipeName', 'dilutionFinalVolume',
  'presetName', 'presetNote', 'peroxideVolume', 'peroxideConcentration', 'peroxideDose'
];
const el = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));

const out = {
  strengthBadge: document.getElementById('strengthBadge'),
  mbResult: document.getElementById('mbResult'),
  mgResult: document.getElementById('mgResult'),
  caResult: document.getElementById('caResult'),
  mbSub: document.getElementById('mbSub'),
  mgSub: document.getElementById('mgSub'),
  caSub: document.getElementById('caSub'),
  acid75Result: document.getElementById('acid75Result'),
  acid75DilutedResult: document.getElementById('acid75DilutedResult'),
  dilutionRecipe: document.getElementById('dilutionRecipe'),
  currentPresetSummary: document.getElementById('currentPresetSummary'),
  presetList: document.getElementById('presetList'),
  peroxideMlResult: document.getElementById('peroxideMlResult'),
  peroxidePpmResult: document.getElementById('peroxidePpmResult'),
  peroxide140Result: document.getElementById('peroxide140Result'),
  peroxideDoseSummary: document.getElementById('peroxideDoseSummary'),
  peroxideModeBadge: document.getElementById('peroxideModeBadge'),
  peroxideConcentrationSub: document.getElementById('peroxideConcentrationSub')
};

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function fmt(value, decimals = 2) {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 100) return value.toFixed(1).replace(/\.0$/, '');
  if (Math.abs(value) >= 10) return value.toFixed(2).replace(/\.00$/, '').replace(/0$/, '');
  return value.toFixed(decimals).replace(/\.000$/, '').replace(/\.00$/, '').replace(/0$/, '');
}

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem(settingsKey) || '{}');
  const settings = { ...defaults, ...saved };
  el.mbPerLiter100.value = settings.mbPerLiter100;
  el.mgPerLiter100.value = settings.mgPerLiter100;
  el.caPerLiter100.value = settings.caPerLiter100;
  el.acidMlPerLiter100.value = settings.acidMlPerLiter100;
  el.recipeName.value = settings.recipeName;
  document.body.classList.toggle('dark', Boolean(settings.darkMode));
}

function saveSettings() {
  localStorage.setItem(settingsKey, JSON.stringify({
    mbPerLiter100: num(el.mbPerLiter100.value, defaults.mbPerLiter100),
    mgPerLiter100: num(el.mgPerLiter100.value, defaults.mgPerLiter100),
    caPerLiter100: num(el.caPerLiter100.value, defaults.caPerLiter100),
    acidMlPerLiter100: num(el.acidMlPerLiter100.value, defaults.acidMlPerLiter100),
    recipeName: el.recipeName.value || defaults.recipeName,
    darkMode: document.body.classList.contains('dark')
  }));
}

function getPresets() {
  return JSON.parse(localStorage.getItem(presetsKey) || '[]');
}

function savePresets(presets) {
  localStorage.setItem(presetsKey, JSON.stringify(presets));
}

function setStrength(percent) {
  const p = clamp(num(percent), 0, 200);
  el.nutrientPercent.value = p;
  el.strengthSlider.value = p;
  calculate(true);
}

function updatePresetState(percent) {
  document.querySelectorAll('[data-strength]').forEach(button => {
    const active = Number(button.dataset.strength) === Number(percent);
    button.classList.toggle('active', active);
  });
}

function updateSliderVisual(percent) {
  const fill = clamp(percent / 200 * 100, 0, 100);
  el.strengthSlider.style.setProperty('--fill', `${fill}%`);
  el.sliderBubble.textContent = `${fmt(percent, 0)}%`;
  out.strengthBadge.textContent = `${fmt(percent, 0)}%`;
}

function bumpCards() {
  document.querySelectorAll('.nutrient-card, .acid-card').forEach(card => {
    card.classList.remove('bump');
    void card.offsetWidth;
    card.classList.add('bump');
  });
}

function currentCalcValues() {
  const liters = Math.max(0, num(el.waterVolume.value));
  const percent = clamp(num(el.nutrientPercent.value), 0, 200);
  const strength = percent / 100;

  const mbPerL = Math.max(0, num(el.mbPerLiter100.value)) * strength;
  const mgPerL = Math.max(0, num(el.mgPerLiter100.value)) * strength;
  const caPerL = Math.max(0, num(el.caPerLiter100.value)) * strength;
  const acid75PerL100 = Math.max(0, num(el.acidMlPerLiter100.value));

  return {
    liters,
    percent,
    mbPerL,
    mgPerL,
    caPerL,
    mb: liters * mbPerL,
    mg: liters * mgPerL,
    ca: liters * caPerL,
    acid75: liters * acid75PerL100 * strength,
    acidDiluted: liters * acid75PerL100 * strength * 10
  };
}


function currentPeroxideValues() {
  const liters = Math.max(0, num(el.peroxideVolume.value, 140));
  const concentration = Math.max(0.1, num(el.peroxideConcentration.value, 3));
  const dose3 = clamp(num(el.peroxideDose.value, 1), 0, 10); // mL/L expressed as 3% peroxide equivalent
  const bottleMlPerL = dose3 * (3 / concentration);
  const ppm = dose3 * 30; // 3% H2O2 is approximately 30 mg/mL, so 1 mL/L ≈ 30 mg/L
  const totalMl = liters * bottleMlPerL;
  const total140 = 140 * bottleMlPerL;
  return { liters, concentration, dose3, bottleMlPerL, ppm, totalMl, total140 };
}

function updatePeroxideModeState(dose3) {
  let activeMode = 'custom';
  document.querySelectorAll('.dose-mode').forEach(button => {
    const active = Number(button.dataset.dose) === Number(dose3);
    button.classList.toggle('active', active);
    if (active) activeMode = button.dataset.mode;
  });
  out.peroxideModeBadge.textContent = activeMode;
}

function calculatePeroxide(animate = false) {
  const values = currentPeroxideValues();
  const { concentration, dose3, bottleMlPerL, ppm, totalMl, total140 } = values;

  if (Number(el.peroxideDose.value) !== dose3) el.peroxideDose.value = dose3;
  updatePeroxideModeState(dose3);

  out.peroxideMlResult.textContent = `${fmt(totalMl)} mL`;
  out.peroxidePpmResult.textContent = `${fmt(ppm, 0)} ppm`;
  out.peroxide140Result.textContent = `${fmt(total140)} mL`;
  out.peroxideDoseSummary.textContent = `${fmt(dose3)} mL/L of 3% ≈ ${fmt(bottleMlPerL)} mL/L of ${fmt(concentration)}%`;
  out.peroxideConcentrationSub.textContent = `${fmt(bottleMlPerL)} mL/L using ${fmt(concentration)}% peroxide`;

  if (animate) {
    document.querySelectorAll('.peroxide-card, .peroxide-current').forEach(card => {
      card.classList.remove('bump');
      void card.offsetWidth;
      card.classList.add('bump');
    });
  }
}

function setPeroxideDose(dose) {
  el.peroxideDose.value = clamp(num(dose), 0, 10);
  calculatePeroxide(true);
}

function calculate(animate = false) {
  const values = currentCalcValues();
  const { liters, percent, mbPerL, mgPerL, caPerL, mb, mg, ca, acid75, acidDiluted } = values;

  if (Number(el.nutrientPercent.value) !== percent) el.nutrientPercent.value = percent;
  el.strengthSlider.value = percent;
  updateSliderVisual(percent);
  updatePresetState(percent);

  out.mbResult.textContent = `${fmt(mb)} g`;
  out.mgResult.textContent = `${fmt(mg)} g`;
  out.caResult.textContent = `${fmt(ca)} g`;
  out.mbSub.textContent = `${fmt(mbPerL, 3)} g/L at ${fmt(percent, 0)}%`;
  out.mgSub.textContent = `${fmt(mgPerL, 3)} g/L at ${fmt(percent, 0)}%`;
  out.caSub.textContent = `${fmt(caPerL, 3)} g/L at ${fmt(percent, 0)}%`;

  out.acid75Result.textContent = `${fmt(acid75)} mL`;
  out.acid75DilutedResult.textContent = `${fmt(acidDiluted)} mL`;

  const finalVol = Math.max(0, num(el.dilutionFinalVolume.value));
  const acidPart = finalVol / 10;
  const waterPart = finalVol * 0.9;
  out.dilutionRecipe.textContent = `${fmt(acidPart)} mL acid + ${fmt(waterPart)} mL water`;

  out.currentPresetSummary.textContent = `${fmt(liters)} L at ${fmt(percent, 0)}%`;

  if (animate) bumpCards();
  saveSettings();
}

function renderPresets() {
  const presets = getPresets();
  if (!presets.length) {
    out.presetList.innerHTML = '<div class="empty-state">No saved amounts yet. Make your usual tank/top-up mix and press Save current.</div>';
    return;
  }

  out.presetList.innerHTML = presets.map(preset => `
    <article class="preset-item" data-id="${preset.id}">
      <div>
        <h3>${escapeHtml(preset.name)}</h3>
        <p class="preset-meta">
          ${fmt(preset.liters)} L at ${fmt(preset.percent, 0)}%<br>
          ${fmt(preset.mb)} g MB · ${fmt(preset.mg)} g MgSO₄ · ${fmt(preset.ca)} g CaNO₃<br>
          ${preset.note ? escapeHtml(preset.note) : 'No note'}
        </p>
      </div>
      <div class="preset-actions">
        <button type="button" data-action="apply">Apply</button>
        <button type="button" class="delete-btn" data-action="delete">Delete</button>
      </div>
    </article>
  `).join('');
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function saveCurrentPreset() {
  const values = currentCalcValues();
  const defaultName = `${fmt(values.liters)} L at ${fmt(values.percent, 0)}%`;
  const name = el.presetName.value.trim() || defaultName;
  const note = el.presetNote.value.trim();
  const presets = getPresets();
  presets.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name,
    note,
    liters: values.liters,
    percent: values.percent,
    mb: values.mb,
    mg: values.mg,
    ca: values.ca,
    acid75: values.acid75,
    acidDiluted: values.acidDiluted,
    createdAt: new Date().toISOString()
  });
  savePresets(presets.slice(0, 30));
  el.presetName.value = '';
  el.presetNote.value = '';
  renderPresets();
}

function handlePresetClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = event.target.closest('.preset-item');
  const id = item?.dataset.id;
  const presets = getPresets();
  const preset = presets.find(p => p.id === id);
  if (!preset) return;

  if (button.dataset.action === 'apply') {
    el.waterVolume.value = preset.liters;
    setStrength(preset.percent);
    switchTab('calculator');
  }

  if (button.dataset.action === 'delete') {
    savePresets(presets.filter(p => p.id !== id));
    renderPresets();
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tabName}`));
}

loadSettings();
calculate();
calculatePeroxide();
renderPresets();

ids.forEach(id => {
  if (['strengthSlider', 'sliderBubble', 'sliderCard', 'presetName', 'presetNote', 'peroxideVolume', 'peroxideConcentration', 'peroxideDose'].includes(id)) return;
  el[id].addEventListener('input', () => calculate(false));
});

el.strengthSlider.addEventListener('input', () => setStrength(el.strengthSlider.value));
el.strengthSlider.addEventListener('pointerdown', () => el.sliderCard.classList.add('dragging'));
el.strengthSlider.addEventListener('pointerup', () => el.sliderCard.classList.remove('dragging'));
el.strengthSlider.addEventListener('pointercancel', () => el.sliderCard.classList.remove('dragging'));

el.nutrientPercent.addEventListener('change', () => setStrength(el.nutrientPercent.value));

el.peroxideVolume.addEventListener('input', () => calculatePeroxide(false));
el.peroxideConcentration.addEventListener('input', () => calculatePeroxide(false));
el.peroxideDose.addEventListener('input', () => calculatePeroxide(true));
document.querySelectorAll('.dose-mode').forEach(button => {
  button.addEventListener('click', () => setPeroxideDose(button.dataset.dose));
});

document.querySelectorAll('[data-strength]').forEach(button => {
  button.addEventListener('click', () => setStrength(button.dataset.strength));
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

document.getElementById('saveCurrentPreset').addEventListener('click', saveCurrentPreset);
out.presetList.addEventListener('click', handlePresetClick);

document.getElementById('resetSettings').addEventListener('click', () => {
  localStorage.removeItem(settingsKey);
  loadSettings();
  setStrength(100);
});

document.getElementById('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  saveSettings();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
