// أدوات DOM للوحة الجانبية — بناء آمن بالـ textContent (لا innerHTML لنصوص الخادم)،
// وأيقونات Lucide كمسارات SVG، وعلامة تنفيذ.

const SVG_NS = "http://www.w3.org/2000/svg";

const ICONS = {
  sparkles: ["M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z", "M20 3v4", "M22 5h-4", "M4 17v2", "M5 18H3"],
  fill: ["M5 4h1a3 3 0 0 1 3 3 3 3 0 0 1 3-3h1", "M13 20h-1a3 3 0 0 1-3-3 3 3 0 0 1-3 3H5", "M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1", "M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7", "M9 7v10"],
  folder: ["M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z", "M8 10v4", "M12 10v2", "M16 10v6"],
  x: ["M18 6 6 18", "m6 6 12 12"],
  check: ["M20 6 9 17l-5-5"],
  loader: ["M21 12a9 9 0 1 1-6.219-8.56"],
  send: ["m5 12 7-7 7 7", "M12 19V5"],
  stop: ["M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"],
  newChat: ["M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7", "M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"],
  search: ["M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "m21 21-4.3-4.3"],
  copy: ["M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z", "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"],
  external: ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
  refresh: ["M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", "M8 16H3v5"],
  trash: ["M3 6h18", "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  eye: ["M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
  eyeOff: ["M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49", "M14.084 14.158a3 3 0 0 1-4.242-4.242", "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143", "m2 2 20 20"],
  shield: ["M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z", "m9 12 2 2 4-4"],
  alert: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 8v4", "M12 16h.01"],
  help: ["M7.9 20A9 9 0 1 0 4 16.1L2 22Z", "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", "M12 17h.01"],
  listChecks: ["m3 17 2 2 4-4", "m3 7 2 2 4-4", "M13 6h8", "M13 12h8", "M13 18h8"],
  route: ["M6 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15", "M18 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
  key: ["M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z", "M16.5 7a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1z"],
  filePlus: ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4", "M9 15h6", "M12 18v-6"],
  scale: ["m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z", "m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z", "M7 21h10", "M12 3v18", "M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"],
  sun: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v2", "M12 20v2", "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41", "M2 12h2", "M20 12h2", "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41"],
  moon: ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"],
  monitor: ["M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M8 21h8", "M12 17v4"],
  server: ["M4 2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z", "M4 14h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z", "M6 6h.01", "M6 18h.01"],
  clock: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 6v6l4 2"],
  mail: ["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
  lock: ["M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z", "M7 11V7a5 5 0 0 1 10 0v4"],
  globe: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20", "M2 12h20"],
  chevronDown: ["m6 9 6 6 6-6"],
  arrowLeft: ["m12 19-7-7 7-7", "M19 12H5"],
  circleCheck: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "m9 12 2 2 4-4"],
  circleX: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "m15 9-6 6", "m9 9 6 6"],
  circleMinus: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M8 12h8"],
};

export function icon(name, size, cls) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size || 18));
  svg.setAttribute("height", String(size || 18));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "i" + (cls ? " " + cls : ""));
  (ICONS[name] || []).forEach(function (d) {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
  });
  return svg;
}

const MARK_TONES = {
  brand: ["#6CB56E", "#337349", "#00665E", "#6CB56E"],
  mono: ["rgba(255,255,255,0.45)", "rgba(255,255,255,0.72)", "#FFFFFF", "#9ED9A6"],
};

/** علامة تنفيذ — نفس هندسة frontend-v3 LogoMark (58×40). */
export function mark(size, tone) {
  const t = MARK_TONES[tone] || MARK_TONES.brand;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 58 40");
  svg.setAttribute("width", String(Math.round(size * 1.45)));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "mark");
  [0, 16, 32].forEach(function (x, i) {
    const p = document.createElementNS(SVG_NS, "polyline");
    p.setAttribute("points", x + 5.5 + ",7 " + (x + 18.5) + ",20 " + (x + 5.5) + ",33");
    p.setAttribute("stroke", t[i]);
    p.setAttribute("stroke-width", "9");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    svg.appendChild(p);
  });
  const dot = document.createElementNS(SVG_NS, "circle");
  dot.setAttribute("cx", "53.4");
  dot.setAttribute("cy", "5.6");
  dot.setAttribute("r", "3.6");
  dot.setAttribute("fill", t[3]);
  svg.appendChild(dot);
  return svg;
}

/**
 * h("div", { class: "x", on: { click }, attrs: {...} }, ...children)
 * النصوص تدخل كعُقد نصية — آمنة لأي محتوى من الخادم.
 */
export function h(tag, props) {
  const el = document.createElement(tag);
  if (props) {
    Object.keys(props).forEach(function (k) {
      const v = props[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "on") Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === "attrs") Object.keys(v).forEach(function (a) { if (v[a] != null && v[a] !== false) el.setAttribute(a, v[a] === true ? "" : String(v[a])); });
      else if (k === "style") Object.assign(el.style, v);
      else if (k in el) el[k] = v;
      else el.setAttribute(k, v === true ? "" : String(v));
    });
  }
  for (let i = 2; i < arguments.length; i++) append(el, arguments[i]);
  return el;
}

function append(el, child) {
  if (child == null || child === false) return;
  if (Array.isArray(child)) child.forEach(function (c) { append(el, c); });
  else if (child instanceof Node) el.appendChild(child);
  else el.appendChild(document.createTextNode(String(child)));
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** «قبل 3 دقائق» */
export function ago(ms) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 45) return "الآن";
  const m = Math.round(s / 60);
  if (m < 60) return "قبل " + m + (m === 1 ? " دقيقة" : m === 2 ? " دقيقتين" : m <= 10 ? " دقائق" : " دقيقة");
  const hrs = Math.floor(m / 60);
  return "قبل " + hrs + (hrs === 1 ? " ساعة" : hrs === 2 ? " ساعتين" : " ساعات");
}

/** «خلال ساعة و12 دقيقة» */
export function remaining(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const hrs = Math.floor(m / 60);
  const mins = m % 60;
  if (hrs && mins) return hrs + " س " + mins + " د";
  if (hrs) return hrs + " س";
  return mins + " د";
}

export function firstLetter(text) {
  const s = String(text || "").trim();
  return s ? Array.from(s)[0] : "ت";
}
