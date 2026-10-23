// Claude คือเชฟ: pure function of time. window.seek(t) paints frame t (see lib/motion.js).
// Timing is in beats (u) on the measured 120 bpm grid. Cue beats come from the VO phrase pauses
// (vo.json + silencedetect), so pictures land on the words that name them.
// Thai text is drawn as whole strings (never per glyph) so vowels and tone marks stay on their consonant.
import * as M from './lib/motion.js';

const { W, H, FORMAT, E, prog, lerp, clamp, springU, SPRING, wobble, bump, font, fill, rrect, shake, TAU } = M;

const C = {
  bg: '#0E0E0E', panel: '#1B1A18', line: '#34312D', ink: '#F4F1EA', mute: '#7D776E',
  accent: '#D97757', deep: '#B85C40', cheek: '#EFA88E', market: '#2A1F1A',
};
const DISPLAY = 'Display', UI = 'UI';
const fD = (s) => font(s, 800, DISPLAY), fU = (s) => font(s, 600, UI);
const S = FORMAT.safe;
const CX = S.x + S.w / 2;
const TOP = 1300;            // counter top: the kitchen's floor line

const HITS = [
  [0, 'AI ตัวเดียว', 'impact'],
  [3.2, 'counter rolls', 'riser', { len: 1.6 }],
  [6.5, '100 lands', 'thud'],
  [8.5, 'chef drops in', 'boing', { pitch: 'C5', to: 'G5' }],
  [11, 'Claude = เชฟ', 'pop', { pitch: 'E6' }],
  [12.5, 'pan flip', 'whoosh', { len: 0.4 }],
  [14, 'kitchen empties', 'sub', { len: 0.5 }],
  [16.5, 'tumbleweed', 'tick'],
  [24, 'MCP title', 'impact'],
  [26.5, 'door opens', 'whoosh', { len: 0.6, from: 400, to: 2000 }],
  [30.8, 'data flows', 'blip', { pitch: 'D6' }],
  [34.8, 'อีเมล', 'pop', { pitch: 'C6' }],
  [36.9, 'ไฟล์', 'pop', { pitch: 'E6' }],
  [38.2, 'งานออกแบบ', 'pop', { pitch: 'G6' }],
  [42, 'Skill title', 'impact'],
  [44.4, 'recipe card', 'whoosh', { len: 0.4 }],
  [49, 'step 1', 'tick'],
  [50.4, 'step 2', 'tick'],
  [51.6, 'step 3', 'tick'],
  [52.8, 'step 4', 'tick'],
  [53.5, 'dish 1', 'bell', { pitch: 'C6' }],
  [54.5, 'dish 2', 'bell', { pitch: 'C6' }],
  [55.5, 'dish 3', 'bell', { pitch: 'C6' }],
  [58, 'Plugin title', 'impact'],
  [60.2, 'box lands', 'thud'],
  [63.5, 'box opens', 'pop', { pitch: 'A5' }],
  [64.8, 'recipe out', 'whoosh', { len: 0.3 }],
  [66.4, 'door out', 'whoosh', { len: 0.3 }],
  [68, 'tools out', 'whoosh', { len: 0.3 }],
  [68.8, 'install', 'riser', { len: 1.1 }],
  [71, 'ready', 'bell', { pitch: 'D6' }],
  [78, 'summary', 'sub', { len: 0.6 }],
  [83, 'row MCP', 'tok', { pitch: 'D5' }],
  [87.4, 'row Skill', 'tok', { pitch: 'F5' }],
  [90.7, 'row Plugin', 'tok', { pitch: 'A5' }],
  [96, 'end card', 'impact'],
  [104.3, 'follow pill', 'bell', { pitch: 'D6' }],
];

// ---------------------------------------------------------------- text helpers

// A line of words, each rising into place from under a clip line (no fades), staggered.
function words(ctx, str, x, y, size, fam, color, u, u0, { stagger = 0.2, align = 'left', cfg = SPRING.snappy } = {}) {
  ctx.font = font(size, fam === DISPLAY ? 800 : 600, fam);
  const ws = str.split(' ');
  const wd = ws.map((w) => ctx.measureText(w).width);
  const sp = ctx.measureText(' ').width;
  const total = wd.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
  let xx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, y - size * 1.35, W, size * 1.75); ctx.clip();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color;
  ws.forEach((w, i) => {
    const k = springU(u, u0 + i * stagger, cfg);
    if (k > 0) ctx.fillText(w, xx, y + (1 - k) * size * 1.3);
    xx += wd[i] + sp;
  });
  ctx.restore();
  return total;
}
function label(ctx, str, x, y, size, fam, color, align = 'left') {
  ctx.font = font(size, fam === DISPLAY ? 800 : 600, fam);
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}
// Scene title: big English name (accent) + Thai meaning under it.
function title(ctx, u, u0, name, meaning, u1) {
  const k = springU(u, u0, SPRING.bouncy);
  if (k > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, S.y - 60, W, 260); ctx.clip();
    label(ctx, name, S.x - 4, S.y + 170 + (1 - k) * 240, 200, DISPLAY, C.accent);
    ctx.restore();
  }
  words(ctx, meaning, S.x, S.y + 280, 70, DISPLAY, C.ink, u, u1 ?? u0 + 0.6, { stagger: 0.18 });
}
function pop(u, u0, cfg = SPRING.bouncy) { return springU(u, u0, cfg); }
function scaled(ctx, x, y, k, draw) {
  if (k <= 0.001) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); draw(); ctx.restore();
}

// ---------------------------------------------------------------- the chef (Claude)
// Origin at the body's centre; s = scale. mood: happy | sad | wow | focus.
// arms: [left, right] angles in radians from straight down (positive swings outward/up).
function chef(ctx, x, y, s, u, { mood = 'happy', arms = [0.35, 0.35], sq = 0, look = 0, hold } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const idle = 0.025 * Math.cos(TAU * u / 2);
  const q = sq + idle;
  // arms behind the body (angle from hanging straight down, swinging outward), then the body over their roots
  ctx.lineCap = 'round';
  [[-1, arms[0]], [1, arms[1]]].forEach(([side, a]) => {
    const sx = side * 108, sy = 25;
    const hx = sx + side * Math.sin(a) * 95, hy = sy + Math.cos(a) * 95;
    ctx.strokeStyle = C.deep; ctx.lineWidth = 24;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = C.deep; ctx.beginPath(); ctx.arc(hx, hy, 22, 0, TAU); ctx.fill();
    if (hold && side === 1) hold(hx, hy);
  });
  // body
  ctx.save(); ctx.scale(1 + q, 1 - q);
  ctx.fillStyle = C.accent;
  ctx.beginPath(); ctx.ellipse(0, 0, 130, 150, 0, 0, TAU); ctx.fill();
  // cheeks
  ctx.fillStyle = C.cheek;
  ctx.beginPath(); ctx.ellipse(-72, 22, 20, 12, 0, 0, TAU); ctx.ellipse(72, 22, 20, 12, 0, 0, TAU); ctx.fill();
  // eyes with blink + look
  const blink = 1 - 0.92 * Math.max(bump(u % 7, 3.1, 0.12), bump(u % 7, 6.2, 0.12));
  ctx.fillStyle = C.bg;
  for (const ex of [-44, 44]) {
    ctx.beginPath();
    if (mood === 'focus') { ctx.ellipse(ex + look * 8, -26, 15, 7 * blink + 2, 0, 0, TAU); }
    else ctx.ellipse(ex + look * 8, -26, 13, (mood === 'wow' ? 26 : 21) * blink, 0, 0, TAU);
    ctx.fill();
  }
  // mouth
  ctx.strokeStyle = C.bg; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath();
  if (mood === 'happy' || mood === 'focus') ctx.arc(0, 18, 40, 0.18 * Math.PI, 0.82 * Math.PI);
  else if (mood === 'sad') ctx.arc(0, 78, 36, 1.22 * Math.PI, 1.78 * Math.PI);
  if (mood !== 'wow') ctx.stroke();
  else { ctx.fillStyle = C.bg; ctx.beginPath(); ctx.ellipse(0, 46, 17, 23, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
  // chef hat
  const hy = -150 * (1 - q);
  ctx.fillStyle = C.ink;
  rrect(ctx, -82, hy - 38, 164, 46, 10); ctx.fill();
  ctx.beginPath();
  ctx.arc(-58, hy - 70, 48, 0, TAU); ctx.arc(0, hy - 96, 60, 0, TAU); ctx.arc(58, hy - 70, 48, 0, TAU);
  ctx.fill();
  rrect(ctx, -82, hy - 80, 164, 50, 0); ctx.fill();
  ctx.fillStyle = C.line; ctx.fillRect(-82, hy - 4, 164, 6);
  ctx.restore();
}

// ---------------------------------------------------------------- props

function counter(ctx, x0 = 0, x1 = W) {
  ctx.fillStyle = C.panel; ctx.fillRect(x0, TOP, x1 - x0, 1490 - TOP + 300);
  ctx.fillStyle = C.line; ctx.fillRect(x0, TOP, x1 - x0, 10);
}
function mail(ctx, x, y, s, col = C.ink) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rrect(ctx, -60, -40, 120, 80, 10); ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = C.bg; ctx.lineWidth = 8; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-50, -30); ctx.lineTo(0, 8); ctx.lineTo(50, -30); ctx.stroke();
  ctx.restore();
}
function file(ctx, x, y, s, col = C.ink) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(-42, -55); ctx.lineTo(18, -55); ctx.lineTo(42, -31); ctx.lineTo(42, 55); ctx.lineTo(-42, 55); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.bg;
  for (let i = 0; i < 3; i++) ctx.fillRect(-26, -14 + i * 22, 52, 8);
  ctx.restore();
}
function palette(ctx, x, y, s, col = C.ink) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, 62, 50, -0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(26, 18, 12, 0, TAU); ctx.fill();
  ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(-24, -14, 11, 0, TAU); ctx.fill();
  ctx.fillStyle = C.mute; ctx.beginPath(); ctx.arc(4, -26, 10, 0, TAU); ctx.fill();
  ctx.fillStyle = C.deep; ctx.beginPath(); ctx.arc(-30, 16, 10, 0, TAU); ctx.fill();
  ctx.restore();
}
function pan(ctx, x, y, s, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = C.mute; rrect(ctx, 50, -10, 90, 20, 10); ctx.fill();
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(0, 0, 62, 22, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = C.line; ctx.beginPath(); ctx.ellipse(0, -3, 48, 13, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function knife(ctx, x, y, s, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.moveTo(-70, -6); ctx.lineTo(30, -16); ctx.lineTo(30, 14); ctx.quadraticCurveTo(-30, 14, -70, -6); ctx.fill();
  ctx.fillStyle = C.deep; rrect(ctx, 30, -10, 60, 22, 8); ctx.fill();
  ctx.restore();
}
// A plate with a domed dish and rising steam (steam phase from u, so it's a function of time).
function dish(ctx, x, y, s, u) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(0, 0, 90, 22, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = C.accent; ctx.beginPath(); ctx.ellipse(0, -10, 58, 40, 0, Math.PI, TAU); ctx.fill();
  ctx.fillStyle = C.deep; ctx.beginPath(); ctx.arc(-18, -28, 8, 0, TAU); ctx.arc(14, -36, 7, 0, TAU); ctx.fill();
  ctx.strokeStyle = C.mute; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) {
      const yy = -60 - k * 7, xx = i * 26 + 8 * Math.sin(k * 0.7 + u * 3 + i);
      if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function pot(ctx, x, y, s, u) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = C.mute; rrect(ctx, -110, -110, 20, 34, 8); ctx.fill(); rrect(ctx, 90, -110, 20, 34, 8); ctx.fill();
  ctx.fillStyle = C.ink; rrect(ctx, -95, -130, 190, 130, 22); ctx.fill();
  ctx.fillStyle = C.line; ctx.fillRect(-95, -130, 190, 16);
  ctx.strokeStyle = C.mute; ctx.lineWidth = 7; ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) {
      const yy = -150 - k * 8, xx = i * 40 + 10 * Math.sin(k * 0.6 + u * 3 + i * 2);
      if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}
// Door in a frame; open 0..1 swings the panel toward the viewer (fake perspective: panel narrows).
function door(ctx, x, y, w, h, open, u) {
  ctx.fillStyle = C.market; rrect(ctx, x, y, w, h, 16); ctx.fill();
  if (open > 0.05) {
    ctx.save(); rrect(ctx, x, y, w, h, 16); ctx.clip();
    // the market beyond: awning stripes + a glow line
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? C.accent : C.ink; ctx.fillRect(x + i * w / 6, y + 30, w / 6 + 1, 46); }
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) ctx.arc(x + (i + 0.5) * w / 6, y + 76, w / 12, 0, Math.PI);
    ctx.fill();
    label(ctx, 'ตลาด', x + w / 2, y + 160, 50, DISPLAY, C.ink, 'center');
    ctx.restore();
  }
  ctx.lineWidth = 10; ctx.strokeStyle = C.ink; rrect(ctx, x, y, w, h, 16); ctx.stroke();
  const pw = w * (1 - 0.82 * open);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = C.panel; rrect(ctx, 6, 6, pw - 6, h - 12, 12); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = C.line; ctx.stroke();
  if (pw > 60) { ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(pw - 32, h / 2, 13, 0, TAU); ctx.fill(); }
  ctx.restore();
}
// Recipe card with steps that tick at the given beats.
function recipe(ctx, x, y, w, h, u, steps, ticks, size = 46) {
  rrect(ctx, x, y, w, h, 28); ctx.fillStyle = C.ink; ctx.fill();
  label(ctx, 'สูตร', x + 40, y + 78, 56, DISPLAY, C.accent);
  ctx.fillStyle = '#D9D3C7'; ctx.fillRect(x + 40, y + 102, w - 80, 4);
  steps.forEach((s, i) => {
    const ry = y + 180 + i * Math.max(size * 1.4, (h - 210) / steps.length), t = ticks ? prog(u, ticks[i], ticks[i] + 0.4) : 0;
    const bs = size * 1.05;
    const pp = ticks ? 1 + 0.2 * wobble(u - ticks[i], 3, 6) : 1;
    ctx.save(); ctx.translate(x + 40 + bs / 2, ry - size * 0.35); ctx.scale(pp, pp);
    rrect(ctx, -bs / 2, -bs / 2, bs, bs, 10);
    if (t > 0) { ctx.fillStyle = C.accent; ctx.fill(); } else { ctx.lineWidth = 5; ctx.strokeStyle = C.mute; ctx.stroke(); }
    if (t > 0) check(ctx, 0, 2, bs * 0.7, E.outCubic(t), C.ink, 8);
    ctx.restore();
    label(ctx, s, x + 40 + bs + 22, ry, size, UI, t > 0 ? C.bg : C.mute);
  });
}
function check(ctx, x, y, s, p, color, lw) {
  if (p <= 0) return;
  const pts = [[-0.45, 0.02], [-0.12, 0.34], [0.5, -0.36]];
  const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
  const l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  const d = p * (l1 + l2);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = color; ctx.lineWidth = lw / s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  if (d <= l1) ctx.lineTo(lerp(pts[0][0], pts[1][0], d / l1), lerp(pts[0][1], pts[1][1], d / l1));
  else { ctx.lineTo(pts[1][0], pts[1][1]); const q = (d - l1) / l2; ctx.lineTo(lerp(pts[1][0], pts[2][0], q), lerp(pts[1][1], pts[2][1], q)); }
  ctx.stroke(); ctx.restore();
}
// The plugin box: body + two flaps that open by `open` (0..1).
function box(ctx, x, y, w, h, open, lbl = true) {
  const fl = open * 2.3;
  ctx.fillStyle = C.deep;
  [[-1, x], [1, x + w]].forEach(([side, hx]) => {
    ctx.save(); ctx.translate(hx, y); ctx.rotate(side * -fl);
    rrect(ctx, side < 0 ? 0 : -w / 2, -18, w / 2, 36, 8); ctx.fill();
    ctx.restore();
  });
  rrect(ctx, x, y, w, h, 18); ctx.fillStyle = C.accent; ctx.fill();
  ctx.fillStyle = C.deep; ctx.fillRect(x + w / 2 - 20, y, 40, h * 0.42);
  if (lbl) label(ctx, 'Plugin', x + w / 2, y + h * 0.75, Math.min(84, w * 0.2), DISPLAY, C.bg, 'center');
}
function star(ctx, x, y, r, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.38 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill(); ctx.restore();
}
function tumbleweed(ctx, x, y, r, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.strokeStyle = C.mute; ctx.lineWidth = 5;
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.55, i * 0.45, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- S1 hook (u 0..8)
const HOOK_ICONS = [mail, file, palette, pan, knife, mail, file, palette];
function sceneHook(ctx, u) {
  shake(ctx, u, 0, 12); shake(ctx, u, 6.5, 14, 4);
  words(ctx, 'AI ตัวเดียว', S.x, S.y + 170, 160, DISPLAY, C.ink, u, -0.5, { cfg: SPRING.bouncy, stagger: 0.5 });
  words(ctx, 'ทำงานได้', S.x, S.y + 330, 110, DISPLAY, C.ink, u, 3.0, { cfg: SPRING.bouncy });
  // the counter rolls 1 -> 100 while the question is asked, then slams
  const p = E.outCubic(prog(u, 3.2, 6.5));
  if (u > 3.0) {
    const n = Math.max(1, Math.round(1 + 99 * p));
    const k = 1 + 0.12 * wobble(u - 6.5, 2.5, 5);
    ctx.save(); ctx.translate(S.x, S.y + 640); ctx.scale(k, k);
    label(ctx, String(n), 0, 0, 300, DISPLAY, C.accent);
    ctx.font = fD(300); const nw = ctx.measureText('100').width;
    ctx.restore();
    words(ctx, 'อย่าง?', S.x + nw * k + 30, S.y + 640, 120, DISPLAY, C.ink, u, 6.2, { cfg: SPRING.bouncy });
  }
  // tasks pile up underneath as the number grows
  HOOK_ICONS.forEach((icon, i) => {
    const k = pop(u, 3.4 + i * 0.38);
    const x = S.x + 90 + (i % 4) * 225, y = S.y + 860 + Math.floor(i / 4) * 240;
    scaled(ctx, x, y, k, () => icon(ctx, 0, 0, 1.45, i % 3 === 1 ? C.mute : C.ink));
  });
}

// ---------------------------------------------------------------- S2 chef + empty kitchen (u 8..24)
function sceneChef(ctx, u) {
  if (u < 10.8) words(ctx, 'ลองนึกภาพว่า...', S.x, S.y + 170, 80, DISPLAY, C.mute, u, 8.4);
  words(ctx, 'Claude', S.x, S.y + 170, 170, DISPLAY, C.accent, u, 10.8, { cfg: SPRING.bouncy });
  words(ctx, '= เชฟฝีมือดี', S.x, S.y + 290, 80, DISPLAY, C.ink, u, 12.0);
  const empty = prog(u, 14, 14.6);
  if (u >= 14) words(ctx, 'แต่ครัวว่างเปล่า...', S.x, S.y + 420, 66, UI, C.mute, u, 14.1);
  // empty shelves: dashed slots where ingredients should be
  const sh = pop(u, 13.8, SPRING.snappy);
  if (sh > 0) {
    ctx.save(); ctx.globalAlpha = 1;
    for (let r = 0; r < 2; r++) {
      const y = 780 + r * 170;
      ctx.fillStyle = C.line; ctx.fillRect(S.x, y + 100, 420 * sh, 10);
      ctx.setLineDash([12, 10]); ctx.lineWidth = 4; ctx.strokeStyle = C.line;
      for (let i = 0; i < 3; i++) if (sh > 0.6) { rrect(ctx, S.x + 10 + i * 140, y, 110, 90, 12); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
  counter(ctx);
  // the chef drops in, flips a pan, then deflates when the kitchen turns out empty
  const land = springU(u, 7.75, SPRING.bouncy);
  const y = lerp(-400, TOP - 170, land);
  const sq = 0.12 * wobble(u - 8.4, 2.2, 4.5);
  const flip = prog(u, 12.4, 13.6);
  const mood = u < 8.8 ? 'wow' : u < 14 ? 'happy' : 'sad';
  const deflate = 0.06 * empty;
  chef(ctx, 690, y + 20 * empty, 1.2, u, {
    mood, sq: sq - deflate,
    arms: u < 14 ? [0.5, lerp(0.9, 2.3, bump(flip, 0.5, 0.5))] : [0.15, 0.15],
    hold: u < 14 && u > 11.5 ? (hx, hy) => pan(ctx, hx + 70, hy - 10, 0.9, -0.3 - 0.4 * Math.sin(flip * Math.PI)) : null,
  });
  if (u > 11.5 && u < 14) {
    // the tossed ingredient arcs up and back into the pan
    const a = Math.sin(flip * Math.PI);
    if (flip > 0 && flip < 1) { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(900 - 40 * flip, 1080 - 380 * a, 22, 0, TAU); ctx.fill(); }
  }
  // tumbleweed rolls across the bare counter
  if (u > 16.3 && u < 23.5) {
    const p = prog(u, 16.3, 23.2);
    const x = lerp(-120, W + 120, p);
    tumbleweed(ctx, x, TOP - 52 - 30 * Math.abs(Math.sin(p * Math.PI * 5)), 52, p * 14);
  }
  if (u >= 16.4) words(ctx, 'ทำอาหารไม่ได้', CX, 1420, 64, DISPLAY, C.ink, u, 16.4, { align: 'center' });
}

// ---------------------------------------------------------------- S3 MCP = the door to the market (u 24..42)
const TOKENS = [[34.8, mail, 'อีเมล'], [36.9, file, 'ไฟล์'], [38.2, palette, 'งานออกแบบ']];
function sceneMCP(ctx, u) {
  title(ctx, u, 23.75, 'MCP', '= ประตูต่อไปตลาด', 26.3);
  const dx = S.x, dy = 760, dw = 260, dh = TOP - 760;
  const open = E.outBack(prog(u, 26.5, 27.6), 1.2);
  const kd = pop(u, 24.6, SPRING.snappy);
  ctx.save(); ctx.translate(dx, TOP); ctx.scale(1, kd); ctx.translate(-dx, -TOP);
  door(ctx, dx, dy, dw, dh, clamp(open, 0, 1.1), u);
  ctx.restore();
  counter(ctx, dx + dw - 10);
  ctx.fillStyle = C.line; ctx.fillRect(0, TOP, dx + dw, 10);
  // small ingredients stream out of the market as data
  if (u > 30.5) {
    for (let i = 0; i < 10; i++) {
      const run = (u - 30.5) * 0.32 - i / 10;     // each piece leaves the door a little after the last
      if (run < 0) continue;
      const p = run % 1;
      const x = lerp(dx + dw / 2, 700, p), y = TOP - 26 - 70 * Math.sin(p * Math.PI) * (i % 2 ? 0.6 : 1);
      ctx.fillStyle = i % 3 ? C.accent : C.ink; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill();
    }
  }
  // the named ingredients arrive and stack on the counter by the chef
  TOKENS.forEach(([u0, icon, name], i) => {
    const t = prog(u, u0 - 0.6, u0);
    if (t <= 0) return;
    const tx = 520, ty = TOP - 62 - i * 122;
    const x = lerp(dx + dw / 2, tx, E.outCubic(t)), y = lerp(TOP - 200, ty, E.outBack(t, 1.4));
    icon(ctx, x, y, 1.0, C.ink);
  });
  const mood = u < 26.5 ? 'happy' : u < 29 ? 'wow' : 'happy';
  const look = u > 26 && u < 31 ? -1 : 0;
  const catchK = Math.max(...TOKENS.map(([u0]) => bump(u, u0 + 0.1, 0.4)));
  chef(ctx, 820, TOP - 165, 1.15, u, { mood, look, sq: 0.06 * catchK, arms: [0.4 + 0.9 * catchK, 0.5] });
  words(ctx, 'ดึงข้อมูลจริงเข้ามาใช้', S.x, S.y + 390, 58, UI, C.accent, u, 30.8);
  // the ingredients' names, each as it is said
  let lx = S.x;
  TOKENS.forEach(([u0, , name]) => {
    const w = words(ctx, name, lx, S.y + 470, 60, DISPLAY, C.ink, u, u0 - 0.1);
    lx += w + 40;
  });
}

// ---------------------------------------------------------------- S4 Skill = recipe (u 42..58)
const STEPS = ['เตรียมวัตถุดิบ', 'ผัดให้หอม', 'ปรุงรส', 'จัดจาน'];
const STEP_U = [49, 50.4, 51.6, 52.8];
function sceneSkill(ctx, u) {
  title(ctx, u, 41.75, 'Skill', '= สูตรอาหาร', 44.2);
  // the recipe card slides in from the left, tilted, and settles
  const k = springU(u, 44.3, SPRING.gentle);
  if (k > 0) {
    ctx.save();
    ctx.translate(S.x + 250 - (1 - k) * 760, 960);
    ctx.rotate(lerp(-0.3, -0.04, k));
    recipe(ctx, -250, -270, 510, 540, u, STEPS, STEP_U, 54);
    ctx.restore();
  }
  counter(ctx);
  const dishes = [53.5, 54.5, 55.5];
  const potOut = prog(u, 53.0, 53.5);
  if (potOut < 1) pot(ctx, 620, TOP, 0.95 * (1 - E.inBack(potOut)), u);
  dishes.forEach((u0, i) => {
    const kk = pop(u, u0 - 0.2);
    scaled(ctx, 160 + i * 250, TOP - 24, kk, () => dish(ctx, 0, 0, 1, u));
    if (i > 0) scaled(ctx, 160 + i * 250 - 125, TOP - 60, pop(u, u0), () => label(ctx, '=', 0, 0, 80, DISPLAY, C.accent, 'center'));
  });
  if (u >= 53.3) words(ctx, 'ทำกี่ครั้ง ผลก็เหมือนเดิม', CX, 1430, 60, DISPLAY, C.ink, u, 53.3, { align: 'center' });
  // the chef cooks along: stirs on each step, steps aside when the dishes come out
  const stir = Math.max(...STEP_U.map((s) => bump(u, s + 0.15, 0.35)));
  const away = E.inOutCubic(prog(u, 53, 53.8));
  chef(ctx, lerp(870, 910, away), TOP - 165 + away * 60, lerp(1.15, 0.8, away), u, {
    mood: u < 48.5 ? 'happy' : u < 53 ? 'focus' : 'happy', look: u < 53 ? -1 : 0,
    arms: [0.3 + 1.2 * stir, 0.4 + (u > 53.5 ? 1.6 * bump(u, 54.5, 1.2) : 0)], sq: 0.05 * stir,
  });
}

// ---------------------------------------------------------------- S5 Plugin = ready-made kitchen kit (u 58..78)
function scenePlugin(ctx, u) {
  title(ctx, u, 57.75, 'Plugin', '= ชุดครัวสำเร็จรูป', 60.2);
  counter(ctx);
  const bw = 330, bh = 250, bx = 330, by = TOP - bh;
  const land = springU(u, 59.9, SPRING.bouncy);
  const open = E.outBack(prog(u, 63.3, 63.9), 1.6);
  // the kit's parts fly out of the box to their places
  const parts = [
    [64.8, [200, 900], (x, y, s) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); recipe(ctx, -130, -150, 260, 300, u, ['ขั้น 1', 'ขั้น 2', 'ขั้น 3'], null, 34); ctx.restore(); }],
    [66.4, [560, 860], (x, y, s) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); door(ctx, -100, -150, 200, 300, 1, u); ctx.restore(); }],
    [68.0, [180, TOP - 60], (x, y, s) => { pan(ctx, x - 40, y + 20, s * 0.9, 0); knife(ctx, x + 10, y - 30, s * 0.8, -0.1); }],
  ];
  parts.forEach(([u0, [tx, ty], draw]) => {
    const t = prog(u, u0 - 0.5, u0 + 0.1);
    if (t <= 0) return;
    const sx = bx + bw / 2, sy = by;
    const p = E.outCubic(t);
    const x = lerp(sx, tx, p), y = lerp(sy, ty, p) - Math.sin(p * Math.PI) * 260;
    draw(x, y, lerp(0.3, 1, E.outBack(t, 1.3)));
  });
  if (land > 0) {
    const sq = 0.08 * wobble(u - 60.2, 2.4, 5);
    ctx.save(); ctx.translate(bx + bw / 2, TOP); ctx.scale(1 + sq, 1 - sq); ctx.translate(-(bx + bw / 2), -TOP);
    ctx.translate(0, (1 - land) * -1300);
    box(ctx, bx, by, bw, bh, open);
    ctx.restore();
  }
  // install bar under the title
  if (u >= 68.6) {
    const p = E.inOutCubic(prog(u, 68.8, 70.8));
    const x = S.x, y = S.y + 370, w = 820, h = 64;
    const kk = pop(u, 68.6, SPRING.snappy);
    ctx.save(); ctx.translate(x, y); ctx.scale(1, kk);
    rrect(ctx, 0, 0, w, h, h / 2); ctx.fillStyle = C.panel; ctx.fill();
    rrect(ctx, 0, 0, Math.max(h, w * p), h, h / 2); ctx.fillStyle = C.accent; ctx.fill();
    label(ctx, p < 1 ? `ติดตั้ง ${Math.round(p * 100)}%` : 'พร้อมใช้ทันที', 28, 46, 42, UI, p > 0.25 ? C.bg : C.ink);
    ctx.restore();
  }
  // the chef: worried in the bare kitchen, amazed at the box, jumps when it's ready
  const jump = Math.sin(Math.PI * prog(u, 71, 72.2)) * 160 + Math.sin(Math.PI * prog(u, 73, 74)) * 80;
  const mood = u < 60 ? 'sad' : u < 63.3 ? 'wow' : u < 71 ? 'happy' : 'wow';
  chef(ctx, 860, TOP - 160 - jump, 0.95, u, { mood, look: u > 63 && u < 71 ? -1 : 0, arms: u > 71 ? [2.3, 2.3] : [0.3, 0.3], sq: 0.08 * wobble(u - 72.2, 2.5, 5) });
  if (u > 71) {
    for (let i = 0; i < 5; i++) {
      const k = pop(u, 71 + i * 0.12) * (1 - prog(u, 74, 75));
      const a = -Math.PI / 2 + (i - 2) * 0.5;
      scaled(ctx, 850 + Math.cos(a) * 260, 900 + Math.sin(a) * 200 - jump * 0.3, k, () => star(ctx, 0, 0, 26, u));
    }
  }
}

// ---------------------------------------------------------------- S6 summary (u 78..96)
const ROWS = [
  ['MCP', 'วัตถุดิบ', 'ข้อมูลจริงจากภายนอก', 83, (x, y) => mail(ctx_, x, y, 0.85, C.accent)],
  ['Skill', 'สูตร', 'ขั้นตอนที่ทำซ้ำได้', 87.4, (x, y) => file(ctx_, x, y, 0.85, C.accent)],
  ['Plugin', 'ชุดครัว', 'รวมทุกอย่างในกล่องเดียว', 90.7, (x, y) => { ctx_.save(); ctx_.translate(x, y); ctx_.scale(0.36, 0.36); box(ctx_, -165, -100, 330, 220, 0, false); ctx_.restore(); }],
];
let ctx_ = null;
function sceneSummary(ctx, u) {
  ctx_ = ctx;
  words(ctx, 'สรุปง่ายๆ', S.x, S.y + 170, 150, DISPLAY, C.ink, u, 77.75, { cfg: SPRING.bouncy });
  const active = u < 83 ? -1 : u < 87.4 ? 0 : u < 90.7 ? 1 : 2;
  ROWS.forEach(([en, th, sub, u0, icon], i) => {
    // all three slide in dim while the line starts, then each lights up as it is named
    const k = springU(u, 79.2 + i * 0.45, SPRING.snappy);
    if (k <= 0) return;
    const y = S.y + 330 + i * 290, x = S.x + (1 - k) * W;
    const on = u >= 93 || i === active;
    const lit = 1 + 0.06 * wobble(u - u0, 2.6, 6);
    ctx.save(); ctx.translate(x + 430, y + 125); ctx.scale(lit, lit); ctx.translate(-(x + 430), -(y + 125));
    rrect(ctx, x, y, 860, 250, 40); ctx.fillStyle = on ? C.panel : C.bg; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = on ? C.accent : C.line; ctx.stroke();
    icon(x + 100, y + 125);
    label(ctx, en, x + 200, y + 118, 84, DISPLAY, on ? C.accent : C.mute);
    ctx.font = fD(84); const ew = ctx.measureText(en).width;
    label(ctx, `= ${th}`, x + 200 + ew + 22, y + 118, 84, DISPLAY, on ? C.ink : C.mute);
    label(ctx, sub, x + 202, y + 190, 46, UI, on ? C.ink : C.mute);
    ctx.restore();
  });
}

// ---------------------------------------------------------------- S7 end card (u 96..120)
function sceneEnd(ctx, u) {
  words(ctx, 'เลือกให้ถูก', S.x, S.y + 170, 150, DISPLAY, C.ink, u, 95.75, { cfg: SPRING.bouncy });
  words(ctx, 'AI ทำงานแทน', S.x, S.y + 330, 120, DISPLAY, C.accent, u, 98.2, { cfg: SPRING.bouncy });
  words(ctx, 'คุณได้จริง', S.x, S.y + 470, 120, DISPLAY, C.accent, u, 99.6, { cfg: SPRING.bouncy });
  counter(ctx);
  const land = springU(u, 96.2, SPRING.bouncy);
  const wave = Math.sin(u * Math.PI) * 0.35;
  chef(ctx, 760, lerp(TOP + 300, TOP - 140, land), 0.9, u, {
    mood: 'happy', arms: [2.1 + wave, 0.9], sq: 0.05 * wobble(u - 97, 2.4, 5),
    hold: (hx, hy) => dish(ctx, hx + 20, hy - 40, 0.8, u),
  });
  const k = pop(u, 104.1);
  if (k > 0) {
    const pw = 560, ph = 150, px = S.x, py = 1040;
    const beat = u > 106 ? 1 + 0.04 * bump((u - 106) % 2, 0.2, 0.4) : 1;
    ctx.save(); ctx.translate(px + pw / 2, py + ph / 2); ctx.scale(k * beat, k * beat);
    rrect(ctx, -pw / 2, -ph / 2, pw, ph, ph / 2); ctx.fillStyle = C.accent; ctx.fill();
    label(ctx, 'กดติดตาม', 0, 26, 78, DISPLAY, C.bg, 'center');
    ctx.restore();
  }
}

// ---------------------------------------------------------------- timeline
const SCENES = [[0, sceneHook], [8, sceneChef], [24, sceneMCP], [42, sceneSkill], [58, scenePlugin], [78, sceneSummary], [96, sceneEnd]];

M.film({
  fonts: [fD(100), fU(40)],
  samples: 8,
  async init() {
    await Promise.all([fD(100), fU(40)].map((f) => document.fonts.load(f, 'กขคเชฟครัวสูตร')));
  },
  hits: HITS,
  draw(ctx, u) {
    let i = SCENES.length - 1;
    while (i > 0 && u < SCENES[i][0]) i--;
    const next = SCENES[i + 1] ? SCENES[i + 1][0] : Infinity;
    const out = E.inBack(prog(u, next - 0.5, next), 1.3);
    fill(ctx, C.bg);
    ctx.save();
    if (out > 0) ctx.translate(0, -out * H * 0.7);
    SCENES[i][1](ctx, u);
    ctx.restore();
  },
});
