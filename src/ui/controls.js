/* =========================================================
   手入れUI・ささやき・案内。DOM操作はここに集約。
   ========================================================= */
import { clamp } from "../scene/daycycle.js";
import { saveState } from "../state/storage.js";
import { initAudio, resumeAudio, setSound, splashSound } from "../audio/ambient.js";

const $ = (id) => document.getElementById(id);
let whisperTimer = 0;

export function whisper(text, ms) {
  const el = $("whisper");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(whisperTimer);
  whisperTimer = setTimeout(() => el.classList.remove("show"), ms || 4200);
}

export function updateHarvestBtn(state) { $("harvestBtn").classList.toggle("show", state.growth >= 1); }
export function updateGauge(state) { $("gaugeFill").style.height = Math.round(state.water * 100) + "%"; }

export function initUI(state, hooks) {
  const updateSoundBtn = () => $("soundBtn").classList.toggle("off", !state.sound);
  const updateModeBtn = () => {
    $("modeBtn").textContent = state.mode === "fast" ? "三" : "刻";
    $("modeBtn").title = state.mode === "fast" ? "三分で一日" : "実時間";
  };

  const gesture = () => { initAudio(state.sound); resumeAudio(); };
  document.addEventListener("pointerdown", gesture);

  $("soundBtn").addEventListener("click", () => {
    gesture();
    state.sound = !state.sound; saveState(state); updateSoundBtn();
    setSound(state.sound);
    whisper(state.sound ? "音を、ひらいた。" : "音を、とじた。", 2400);
  });
  $("modeBtn").addEventListener("click", () => {
    hooks.onModeToggle();
    saveState(state); updateModeBtn();
    whisper(state.mode === "fast" ? "三分で、一日がめぐる。" : "いまの時刻に、もどった。", 3600);
  });
  $("infoBtn").addEventListener("click", () => $("infoWrap").classList.add("show"));
  $("closeInfo").addEventListener("click", () => $("infoWrap").classList.remove("show"));
  $("infoWrap").addEventListener("click", (e) => { if (e.target.id === "infoWrap") $("infoWrap").classList.remove("show"); });

  let fertCooldown = 0;
  $("fertBtn").addEventListener("click", () => {
    const t = performance.now();
    if (t - fertCooldown < 4000) return;
    fertCooldown = t;
    state.vigor = clamp(state.vigor + 0.42, 0, 1);
    saveState(state);
    hooks.onFertilize();
    splashSound();
    whisper("肥料をまいた。", 3000);
  });
  $("mowBtn").addEventListener("click", () => {
    if (state.grass < 0.12) { whisper("草は、まだ短い。", 2600); return; }
    state.grass = 0.05; saveState(state);
    whisper("畔の草を、刈った。", 3000);
  });
  $("waterBtn").addEventListener("click", () => {
    updateGauge(state);
    $("waterPanel").classList.toggle("show");
  });
  document.addEventListener("pointerdown", (e) => {
    const wp = $("waterPanel");
    if (wp.classList.contains("show") && !wp.contains(e.target) && e.target.id !== "waterBtn") {
      wp.classList.remove("show");
    }
  });
  function adjustWater(d) {
    const before = state.water;
    state.water = clamp(state.water + d, 0.08, 1);
    saveState(state); updateGauge(state);
    if (state.water !== before) {
      hooks.onWaterAdjust();
      splashSound();
      whisper(d > 0 ? "水を、引き入れた。" : "水を、落とした。", 2600);
    }
  }
  $("waterUp").addEventListener("click", () => adjustWater(0.14));
  $("waterDown").addEventListener("click", () => adjustWater(-0.14));

  $("harvestBtn").addEventListener("click", () => {
    if (state.growth < 1) return;
    state.harvests++;
    const n = state.harvests;
    $("veilMain").textContent = "今年の米が、実った。";
    $("veilSub").textContent = (n === 1 ? "はじめての" : n + "度目の") + "実り。──また、苗から。";
    $("veil").classList.add("show");
    setTimeout(() => {
      state.growth = 0; state.vigor = 0.2; state.plantedAt = Date.now();
      saveState(state); updateHarvestBtn(state);
    }, 2400);
    setTimeout(() => $("veil").classList.remove("show"), 6200);
  });

  updateSoundBtn(); updateModeBtn(); updateHarvestBtn(state); updateGauge(state);
  setTimeout(() => $("title").classList.add("show"), 600);
  setTimeout(() => $("title").classList.remove("show"), 9000);
}
