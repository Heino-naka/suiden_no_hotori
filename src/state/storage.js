/* localStorageのみ。外部送信は一切ない。 */
const KEY = "suiden_hotori_v3";
const OLD_KEY = "suiden_hotori_v1";

export function defaultState() {
  return {
    v: 3, plantedAt: Date.now(), lastVisit: Date.now(),
    growth: 0, vigor: 0.2, water: 0.6, grass: 0.15, harvests: 0,
    sound: true, mode: "real",
  };
}
export function loadState() {
  try {
    if (typeof localStorage === "undefined") return defaultState();
    let raw = localStorage.getItem(KEY);
    if (!raw) raw = localStorage.getItem(OLD_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    if (!s) return defaultState();
    return Object.assign(defaultState(), s, { v: 3 });
  } catch (e) { return defaultState(); }
}
export function saveState(s) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
}
