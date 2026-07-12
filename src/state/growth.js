/* =========================================================
   生育の理：実時間で育つ。退化はしない。
   草は伸び、水は減る。それも田んぼの時間。
   ========================================================= */
import { clamp } from "../scene/daycycle.js";

export const GROW_BASE_DAYS = 16;

export function growthRate(vigor, water) {
  const comfort = (water >= 0.35 && water <= 0.75) ? 1 : 0.45;
  return (1 / GROW_BASE_DAYS) * (1 + 0.28 * vigor + 0.14 * comfort);
}

export function elapseDays(st, days) {
  if (days <= 0) return st;
  st.growth = clamp(st.growth + days * growthRate(st.vigor, st.water), 0, 1);
  st.vigor  = clamp(st.vigor - days * 0.14, 0, 1);
  st.grass  = clamp(st.grass + days / 4.5, 0, 1);
  st.water  = clamp(st.water - days * 0.16, 0.08, 1);
  return st;
}

function hx(h){const n=parseInt(h.slice(1),16);return[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];}
function mix3(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
const sm=t=>t*t*(3-2*t);
const C_NAE=hx("#8fbf4d"), C_MID=hx("#2f6b33"), C_FUK=hx("#245a2c"), C_OCH=hx("#8a7a3a");
export function plantBodyColor(g){
  if(g<0.5) return mix3(C_NAE,C_MID,sm(g*2));
  if(g<0.72) return mix3(C_MID,C_FUK,sm((g-0.5)/0.22));
  return mix3(C_FUK,C_OCH,sm((g-0.72)/0.28));
}
export function earColor(g){
  return mix3(hx("#a8b45c"),hx("#e8c268"),sm(clamp((g-0.6)/0.4,0,1)));
}
