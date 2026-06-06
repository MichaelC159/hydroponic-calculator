const $ = (id) => document.getElementById(id);

const DEFAULT_SETTINGS = {
  nutrients: {
    mb: 0.53,
    ca: 0.53,
    mg: 0.265
  },
  acid: {
    // mL of 75% phosphoric acid per liter per 1.0 pH drop.
    // Default: 1 mL in 20 L causing pH 7.0 -> 5.8.
    ml75PerLiterPerPh: 1 / (20 * 1.2),
    calVolume: 20,
    calMl75: 1,
    phBefore: 7.0,
    phAfter: 5.8
  }
};

let SETTINGS = loadSettings();

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("hydro_settings_v1") || "null");
    if (!saved) return structuredClone(DEFAULT_SETTINGS);
    return {
      nutrients: { ...DEFAULT_SETTINGS.nutrients, ...(saved.nutrients || {}) },
      acid: { ...DEFAULT_SETTINGS.acid, ...(saved.acid || {}) }
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

function saveSettingsObject() {
  localStorage.setItem("hydro_settings_v1", JSON.stringify(SETTINGS));
}

const mascotPath = (file) => `assets/${file}`;

const nutrientStates = [
  { max: 25, file: "mascot_seedling.png", msg: "Gentle seedling strength." },
  { max: 50, file: "mascot_low.png", msg: "Light feeding. Good for young plants." },
  { max: 75, file: "mascot_medium.png", msg: "Moderate leafy-green strength." },
  { max: 99, file: "mascot_good.png", msg: "Good leafy-green range." },
  { max: 100, file: "mascot_success.png", msg: "Perfect 100% leafy-green recipe." },
  { max: 125, file: "mascot_thinking.png", msg: "A little strong. Check EC before adding." },
  { max: 150, file: "mascot_concerned.png", msg: "Strong mix. Mature plants only, preferably." },
  { max: 175, file: "mascot_warning.png", msg: "Very strong. Easy to overshoot EC." },
  { max: Infinity, file: "mascot_danger.png", msg: "That is too spicy for the plants!" }
];

function setMascot(imgEl, file) {
  const next = mascotPath(file);
  if (imgEl.getAttribute("src") !== next) {
    imgEl.classList.remove("mascot-pop");
    void imgEl.offsetWidth;
    imgEl.setAttribute("src", next);
    imgEl.classList.add("mascot-pop");
  }
}

function getNutrientState(percent) {
  const p = Math.round(Number(percent) || 0);
  if (p <= 0) return { file: "mascot_idle.png", msg: "No nutrients selected yet." };
  return nutrientStates.find(s => p <= s.max);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function updateSliderVisual(value) {
  const min = 0;
  const max = 200;
  const pos = ((value - min) / (max - min)) * 100;
  const p = clamp(pos, 0, 100);
  $("sliderFill").style.width = `${p}%`;
  $("sliderThumb").style.left = `${p}%`;
  $("floatingValue").style.left = `${p}%`;
  $("floatingValue").textContent = `${Math.round(value)}%`;
  $("strengthPill").textContent = `${Math.round(value)}%`;
}

function updateNutrients() {
  let liters = Math.max(0, Number($("waterVolume").value) || 0);
  let percent = clamp(Number($("nutrientStrength").value) || 0, 0, 200);

  $("nutrientStrength").value = Math.round(percent);
  $("strengthRange").value = Math.round(percent);
  updateSliderVisual(percent);

  const factor = percent / 100;
  const mb = liters * SETTINGS.nutrients.mb * factor;
  const ca = liters * SETTINGS.nutrients.ca * factor;
  const mg = liters * SETTINGS.nutrients.mg * factor;

  $("mbGrams").textContent = `${mb.toFixed(2)} g`;
  $("caGrams").textContent = `${ca.toFixed(2)} g`;
  $("mgGrams").textContent = `${mg.toFixed(2)} g`;

  $("mbPerL").textContent = `${(SETTINGS.nutrients.mb * factor).toFixed(3)} g/L at ${Math.round(percent)}%`;
  $("caPerL").textContent = `${(SETTINGS.nutrients.ca * factor).toFixed(3)} g/L at ${Math.round(percent)}%`;
  $("mgPerL").textContent = `${(SETTINGS.nutrients.mg * factor).toFixed(3)} g/L at ${Math.round(percent)}%`;

  const state = getNutrientState(percent);
  setMascot($("nutrientMascot"), state.file);
  $("nutrientMessage").textContent = state.msg;
}

function updateAcid(fromDiluted = false) {
  const liters = Math.max(0.01, Number($("acidVolume").value) || 0.01);
  const currentPh = Number($("currentPh")?.value) || 0;
  const targetPh = Number($("targetPh")?.value) || 0;
  const phDrop = Math.max(0, currentPh - targetPh);
  const estimatedMl75 = liters * phDrop * SETTINGS.acid.ml75PerLiterPerPh;

  if ($("acid75Result")) {
    $("acid75Result").textContent = `${estimatedMl75.toFixed(2)} mL`;
    $("acidDilutedResult").textContent = `${(estimatedMl75 * 10).toFixed(2)} mL`;
    $("acid75Note").textContent = `${liters.toFixed(1)} L × ${phDrop.toFixed(2)} pH drop`;
  }

  if (fromDiluted) {
    $("acid75").value = ((Number($("acid75diluted").value) || 0) / 10).toFixed(2);
  } else {
    $("acid75diluted").value = ((Number($("acid75").value) || 0) * 10).toFixed(2);
  }

  const manualMl75 = Math.max(0, Number($("acid75").value) || 0);
  const riskMl75 = Math.max(manualMl75, estimatedMl75);
  const mlPerL = riskMl75 / liters;

  let file = "mascot_scientist.png";
  let msg = "Estimate only. Add slowly, mix well, then re-measure pH.";

  if (phDrop <= 0) {
    file = "mascot_thinking.png";
    msg = "Target pH is not below current pH, so no acid is estimated.";
  } else if (mlPerL <= 0.03) {
    file = "mascot_good.png";
    msg = "Small correction. Still add slowly and measure.";
  } else if (mlPerL <= 0.07) {
    file = "mascot_thinking.png";
    msg = "Moderate acid correction. Mix well before re-testing.";
  } else if (mlPerL <= 0.12) {
    file = "mascot_concerned.png";
    msg = "Large correction. Add in portions, not all at once.";
  } else {
    file = "mascot_warning.png";
    msg = "Very large correction. Dilute first and re-check your pH meter.";
  }

  setMascot($("acidMascot"), file);
  $("acidMessage").textContent = msg;
}

function updatePeroxide() {
  const liters = Math.max(0, Number($("peroxideVolume").value) || 0);
  const dose = Math.max(0, Number($("peroxideDose").value) || 0);
  const plants = $("plantsPresent").checked;
  const total = liters * dose;

  $("peroxideMl").textContent = `${Math.round(total)} mL`;

  let file = "mascot_cleaning.png";
  let msg = "Cleaning mode. Select a dose and whether plants are present.";
  let pill = "Cleaning";

  if (dose > 0) {
    if (plants) {
      if (dose <= 1.0) { file = "mascot_good.png"; msg = "Plant-present maintenance dose."; pill = "Maintenance"; }
      else if (dose <= 2.0) { file = "mascot_thinking.png"; msg = "Higher plant-present dose. Use only when needed."; pill = "Higher"; }
      else if (dose <= 3.0) { file = "mascot_concerned.png"; msg = "Upper plant-present cleaning zone. Monitor roots."; pill = "Upper"; }
      else if (dose <= 4.0) { file = "mascot_warning.png"; msg = "Aggressive with plants present. Avoid casual use."; pill = "Warning"; }
      else { file = "mascot_danger.png"; msg = "Too aggressive for plants. Use a lower plant-present dose."; pill = "Danger"; }
    } else {
      if (dose <= 2.0) { file = "mascot_good.png"; msg = "Light empty-system rinse."; pill = "Light"; }
      else if (dose <= 4.0) { file = "mascot_thinking.png"; msg = "Moderate empty-system rinse."; pill = "Moderate"; }
      else if (dose <= 6.0) { file = "mascot_concerned.png"; msg = "Strong empty-system cleaning dose."; pill = "Strong"; }
      else { file = "mascot_warning.png"; msg = "Very strong. Flush before plants go back in."; pill = "Very strong"; }
    }
  }

  setMascot($("peroxideMascot"), file);
  $("peroxideMessage").textContent = msg;
  $("peroxidePill").textContent = pill;
  $("peroxideNote").textContent = `${dose.toFixed(1)} mL/L × ${liters.toFixed(1)} L`;
}

function getPresets() {
  try { return JSON.parse(localStorage.getItem("hydro_presets_v1") || "[]"); }
  catch { return []; }
}

function savePresets(presets) {
  localStorage.setItem("hydro_presets_v1", JSON.stringify(presets));
}

function renderPresets() {
  const list = $("presetList");
  const presets = getPresets();
  if (!presets.length) {
    list.innerHTML = `<div class="notice">No saved presets yet. Save your current nutrient mix first.</div>`;
    return;
  }
  list.innerHTML = presets.map((p, i) => `
    <div class="saved-preset">
      <div>
        <b>${p.name}</b><br>
        <small>${p.liters} L at ${p.percent}%</small>
      </div>
      <div>
        <button data-load="${i}">Load</button>
        <button data-delete="${i}">Delete</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll("[data-load]").forEach(btn => btn.addEventListener("click", () => {
    const p = getPresets()[Number(btn.dataset.load)];
    $("waterVolume").value = p.liters;
    $("nutrientStrength").value = p.percent;
    updateNutrients();
    setMascot($("presetMascot"), "mascot_success.png");
    $("presetMessage").textContent = "Preset loaded.";
  }));

  list.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => {
    const presets = getPresets();
    presets.splice(Number(btn.dataset.delete), 1);
    savePresets(presets);
    renderPresets();
  }));
}


function updateSettingsReadout() {
  if (!$("setMbPerL")) return;

  $("setMbPerL").value = SETTINGS.nutrients.mb;
  $("setMgPerL").value = SETTINGS.nutrients.mg;
  $("setCaPerL").value = SETTINGS.nutrients.ca;

  $("setAcidCalVolume").value = SETTINGS.acid.calVolume;
  $("setAcidCalMl").value = SETTINGS.acid.calMl75;
  $("setAcidPhBefore").value = SETTINGS.acid.phBefore;
  $("setAcidPhAfter").value = SETTINGS.acid.phAfter;

  $("acidCalibrationReadout").textContent = SETTINGS.acid.ml75PerLiterPerPh.toFixed(4);
}

function collectSettingsFromInputs() {
  const mb = Math.max(0, Number($("setMbPerL").value) || DEFAULT_SETTINGS.nutrients.mb);
  const mg = Math.max(0, Number($("setMgPerL").value) || DEFAULT_SETTINGS.nutrients.mg);
  const ca = Math.max(0, Number($("setCaPerL").value) || DEFAULT_SETTINGS.nutrients.ca);

  const calVolume = Math.max(0.01, Number($("setAcidCalVolume").value) || DEFAULT_SETTINGS.acid.calVolume);
  const calMl75 = Math.max(0, Number($("setAcidCalMl").value) || DEFAULT_SETTINGS.acid.calMl75);
  const phBefore = Number($("setAcidPhBefore").value) || DEFAULT_SETTINGS.acid.phBefore;
  const phAfter = Number($("setAcidPhAfter").value) || DEFAULT_SETTINGS.acid.phAfter;
  const phDrop = Math.max(0.01, phBefore - phAfter);
  const ml75PerLiterPerPh = calMl75 / (calVolume * phDrop);

  SETTINGS = {
    nutrients: { mb, mg, ca },
    acid: { ml75PerLiterPerPh, calVolume, calMl75, phBefore, phAfter }
  };
}

function saveSettingsFromInputs() {
  collectSettingsFromInputs();
  saveSettingsObject();
  updateSettingsReadout();
  updateNutrients();
  updateAcid(false);
  if ($("presetMascot")) {
    setMascot($("presetMascot"), "mascot_success.png");
  }
}

function resetSettingsToDefault() {
  SETTINGS = structuredClone(DEFAULT_SETTINGS);
  saveSettingsObject();
  updateSettingsReadout();
  updateNutrients();
  updateAcid(false);
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    $(`tab-${btn.dataset.tab}`).classList.add("active");
  }));

  ["waterVolume", "nutrientStrength"].forEach(id => $(id).addEventListener("input", updateNutrients));
  $("strengthRange").addEventListener("input", () => {
    $("nutrientStrength").value = $("strengthRange").value;
    updateNutrients();
  });

  document.querySelectorAll("[data-preset]").forEach(btn => btn.addEventListener("click", () => {
    $("nutrientStrength").value = btn.dataset.preset;
    updateNutrients();
  }));

  $("acid75").addEventListener("input", () => updateAcid(false));
  $("acid75diluted").addEventListener("input", () => updateAcid(true));
  ["acidVolume", "currentPh", "targetPh"].forEach(id => $(id).addEventListener("input", () => updateAcid(false)));

  if ($("saveSettings")) $("saveSettings").addEventListener("click", saveSettingsFromInputs);
  if ($("resetSettings")) $("resetSettings").addEventListener("click", resetSettingsToDefault);

  ["peroxideVolume", "peroxideDose", "plantsPresent"].forEach(id => $(id).addEventListener("input", updatePeroxide));
  $("plantsPresent").addEventListener("change", updatePeroxide);
  document.querySelectorAll("[data-peroxide]").forEach(btn => btn.addEventListener("click", () => {
    $("peroxideDose").value = btn.dataset.peroxide;
    updatePeroxide();
  }));

  $("savePreset").addEventListener("click", () => {
    const liters = Number($("waterVolume").value) || 0;
    const percent = Number($("nutrientStrength").value) || 0;
    const presets = getPresets();
    presets.unshift({
      name: `${liters} L @ ${percent}%`,
      liters,
      percent,
      savedAt: new Date().toISOString()
    });
    savePresets(presets.slice(0, 20));
    renderPresets();
    setMascot($("presetMascot"), "mascot_success.png");
    $("presetMessage").textContent = "Saved!";
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}


function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  const btn = $("themeToggle");
  if (btn) btn.textContent = theme === "light" ? "☀️ Light" : "🌙 Dark";
  localStorage.setItem("hydro_theme_v1", theme);
}

function initTheme() {
  const saved = localStorage.getItem("hydro_theme_v1") || "dark";
  applyTheme(saved);
  const btn = $("themeToggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const next = document.body.classList.contains("light") ? "dark" : "light";
      applyTheme(next);
    });
  }
}

initTheme();
bindEvents();
updateSettingsReadout();
updateNutrients();
updateAcid(false);
updatePeroxide();
renderPresets();
