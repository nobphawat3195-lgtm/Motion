// Plugin vs Skill vs MCP: pure function of time. window.seek(t) paints frame t (see lib/motion.js).
// Timing is in beats (u) on the measured 120 bpm grid; docs/shotlist.md is the plan, vo.json the VO lines.
// Thai text is always drawn as whole strings (never per glyph): vowels and tone marks stack on their
// consonant, so splitting a Thai word breaks it. Words animate as units; typing walks grapheme clusters.
import * as M from './lib/motion.js';

const { W, H, FORMAT, E, prog, lerp, clamp, springU, SPRING, wobble, bump, font, fill, rrect, shake } = M;

const C = { bg: '#0E0E0E', panel: '#1B1A18', line: '#34312D', ink: '#F4F1EA', mute: '#7D776E', accent: '#D97757' };
const DISPLAY = 'Display', UI = 'UI';
const fD = (s) => font(s, 800, DISPLAY), fU = (s) => font(s, 600, UI);
const S = FORMAT.safe;
const CX = S.x + S.w / 2;

const HITS = [
  [0, 'Plugin slams in', 'impact'],
  [2, 'Skill slams in', 'thud', { pitch: 140, to: 60 }],
  [3.5, 'MCP slams in', 'thud', { pitch: 160, to: 60 }],
  [5, 'question line', 'pop', { pitch: 'A5' }],
  [8, 'task bubble', 'pop', { pitch: 'D6' }],
  [9, 'typing', 'type', { len: 2.2, n: 16 }],
  [12, 'chip MCP', 'blip', { pitch: 'A5' }],
  [12.5, 'chip Skill', 'blip', { pitch: 'C6' }],
  [13, 'chip Plugin', 'blip', { pitch: 'E6' }],
  [15.6, 'push to MCP', 'whoosh', { len: 0.5 }],
  [16, 'MCP title', 'impact'],
  [18, 'plug 1', 'click'],
  [19, 'plug 2', 'click'],
  [20, 'plug 3', 'click'],
  [23, 'data arrives', 'blip', { pitch: 'D6' }],
  [25, 'real data label', 'pop', { pitch: 'F5' }],
  [29.6, 'push to Skill', 'whoosh', { len: 0.5, from: 2400, to: 600 }],
  [30, 'Skill title', 'thud'],
  [34, 'tick 1', 'tick'],
  [36.5, 'tick 2', 'tick'],
  [39, 'tick 3', 'tick'],
  [41.5, 'tick 4', 'bell', { pitch: 'A5' }],
  [43.6, 'push to Plugin', 'whoosh', { len: 0.5 }],
  [44, 'box lands', 'thud'],
  [47, 'skill card drops in', 'pop', { pitch: 'C6' }],
  [49.5, 'plug drops in', 'pop', { pitch: 'G5' }],
  [53.5, 'lid shuts', 'thud', { pitch: 120, to: 50 }],
  [54.5, 'install once', 'bell', { pitch: 'D6' }],
  [57, 'summary', 'sub', { len: 0.6 }],
  [58.3, 'row MCP', 'tok', { pitch: 'D5' }],
  [61, 'row Skill', 'tok', { pitch: 'F5' }],
  [63.5, 'row Plugin', 'tok', { pitch: 'A5' }],
  [68, 'end card', 'impact'],
  [72.5, 'follow pill', 'bell', { pitch: 'D6' }],
];

// ---------------------------------------------------------------- helpers

// A line of words, each rising into place from under a clip line (no fades), staggered.
function words(ctx, str, x, y, size, fam, color, u, u0, { stagger = 0.22, align = 'left', cfg = SPRING.snappy } = {}) {
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

const seg = new Intl.Segmenter('th', { granularity: 'grapheme' });
const graphemes = (s) => [...seg.segment(s)].map((g) => g.segment);

// Plug: prongs up at (0,0) in local space, body below, scale s (~ body width).
function plug(ctx, x, y, s, rot, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s / 100, s / 100);
  ctx.fillStyle = color;
  rrect(ctx, -30, -38, 14, 40, 5); ctx.fill();
  rrect(ctx, 16, -38, 14, 40, 5); ctx.fill();
  rrect(ctx, -50, 0, 100, 70, 18); ctx.fill();
  rrect(ctx, -16, 66, 32, 26, 8); ctx.fill();
  ctx.restore();
}

// Recipe card icon: card with three rows.
function cardIcon(ctx, x, y, s, color, bg) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100);
  rrect(ctx, -42, -52, 84, 104, 12); ctx.fillStyle = color; ctx.fill();
  ctx.fillStyle = bg;
  for (let i = 0; i < 3; i++) { rrect(ctx, -26, -30 + i * 26, 12, 12, 3); ctx.fill(); rrect(ctx, -6, -27 + i * 26, 34, 7, 3); ctx.fill(); }
  ctx.restore();
}

// Box icon: front face + lid.
function boxIcon(ctx, x, y, s, color, bg) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100);
  ctx.fillStyle = color;
  rrect(ctx, -50, -20, 100, 72, 8); ctx.fill();
  rrect(ctx, -56, -44, 112, 22, 6); ctx.fill();
  ctx.fillStyle = bg; rrect(ctx, -14, -16, 28, 10, 4); ctx.fill();
  ctx.restore();
}

// Check mark drawn on by p (0..1).
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

// Title block shared by the three "what is it" scenes: big English name + Thai meaning.
function title(ctx, u, u0, name, meaning) {
  const k = springU(u, u0, SPRING.bouncy);
  if (k > 0) {
    ctx.save();
    ctx.translate(S.x, S.y + 190);
    ctx.beginPath(); ctx.rect(-20, -260, W, 330); ctx.clip();
    label(ctx, name, 0, (1 - k) * 260, 230, DISPLAY, C.accent);
    ctx.restore();
  }
  words(ctx, meaning, S.x + 6, S.y + 300, 64, UI, C.ink, u, u0 + 0.6, { stagger: 0.18 });
}

// ---------------------------------------------------------------- S1 hook (u 0..8)
function sceneHook(ctx, u) {
  shake(ctx, u, 0, 14); shake(ctx, u, 2, 10, 5); shake(ctx, u, 3.5, 10, 7);
  const size = 250, x = S.x - 4;
  const rows = [['Plugin', -0.55, -1, C.ink], ['Skill', 1.75, 1, C.ink], ['MCP', 3.25, 0, C.accent]];
  rows.forEach(([w, u0, dir, col], i) => {
    const k = springU(u, u0, SPRING.bouncy);
    if (k <= 0) return;
    const y = S.y + 300 + i * 255;
    const dx = dir ? (1 - k) * dir * W : 0, dy = dir ? 0 : (1 - k) * 420;
    ctx.save(); ctx.translate(x + dx, y + dy);
    const sq = 0.06 * wobble(u - u0 - 0.35, 2.2, 5);
    ctx.scale(1 + sq, 1 - sq);
    label(ctx, w, 0, 0, size, DISPLAY, col);
    ctx.restore();
  });
  words(ctx, 'ต่างกันยังไง?', S.x, S.y + 1080, 120, DISPLAY, C.ink, u, 4.75, { cfg: SPRING.bouncy });
  // a thin accent rule grows under the question: the hook's one graphic accent
  const r = E.outCubic(prog(u, 5.4, 6.6));
  if (r > 0) { ctx.fillStyle = C.accent; ctx.fillRect(S.x + 4, S.y + 1130, r * 520, 12); }
}

// ---------------------------------------------------------------- S2 the task (u 8..16)
const TASK = 'ทำคลิป TikTok 40 วิ ให้หน่อย';
const TASK_G = graphemes(TASK);
function sceneTask(ctx, u) {
  const push = E.inOutCubic(prog(u, 15.1, 16));
  ctx.save(); ctx.translate(0, -push * 1400);
  words(ctx, 'งานเดียว', S.x, S.y + 170, 150, DISPLAY, C.ink, u, 7.75, { cfg: SPRING.bouncy });
  words(ctx, 'ดูว่าใครช่วยตรงไหน', S.x + 4, S.y + 270, 58, UI, C.mute, u, 8.6);
  // the request, typed into a bubble (a plain shape, not any product's UI)
  const k = springU(u, 7.8, SPRING.bouncy);
  if (k > 0) {
    const bw = 830, bh = 210, bx = S.x, by = S.y + 380;
    ctx.save(); ctx.translate(bx + bw, by + bh); ctx.scale(k, k); ctx.translate(-(bx + bw), -(by + bh));
    rrect(ctx, bx, by, bw, bh, 44); ctx.fillStyle = C.panel; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = C.line; ctx.stroke();
    const n = Math.floor(clamp((u - 9) / 2.2) * TASK_G.length);
    const s = TASK_G.slice(0, n).join('');
    label(ctx, s, bx + 50, by + 132, 66, UI, C.ink);
    if (u < 12 && Math.floor(u * 2) % 2 === 0) { ctx.font = fU(66); ctx.fillStyle = C.accent; ctx.fillRect(bx + 56 + ctx.measureText(s).width, by + 70, 6, 76); }
    ctx.restore();
  }
  words(ctx, 'ใครทำหน้าที่อะไร?', S.x + 4, S.y + 1010, 64, UI, C.ink, u, 13.4);
  ctx.restore();
  // three chips: who helps. They line up, then MCP pushes forward into the next scene's title.
  ['MCP', 'Skill', 'Plugin'].forEach((c, i) => {
    const kk = springU(u, 12 + i * 0.5 - 0.15, SPRING.bouncy);
    if (kk <= 0) return;
    const cw = 250, ch = 120, gap = 34;
    let x = S.x + i * (cw + gap), y = S.y + 760 + (1 - kk) * 200, sc = 1;
    if (i === 0 && push > 0) { sc = 2.6 ** push; x = lerp(x, S.x + 40, push); y = lerp(y, S.y + 40, push); }
    else if (push > 0) y += push * 1400;
    ctx.save(); ctx.translate(x + cw / 2, y + ch / 2); ctx.scale(sc, sc); ctx.translate(-(x + cw / 2), -(y + ch / 2));
    rrect(ctx, x, y, cw, ch, 60);
    ctx.lineWidth = 5; ctx.strokeStyle = i === 0 ? C.accent : C.ink; ctx.stroke();
    label(ctx, c, x + cw / 2, y + 82, 60, DISPLAY, i === 0 ? C.accent : C.ink, 'center');
    ctx.restore();
  });
}

// ---------------------------------------------------------------- S3 MCP = hands (u 16..30)
function sceneMCP(ctx, u) {
  title(ctx, u, 15.75, 'MCP', '= มือที่หยิบข้อมูลจริงมาให้');
  const hub = [CX, S.y + 700];
  const nodes = [['Figma', CX - 285, S.y + 1150], ['Gmail', CX, S.y + 1220], ['Notion', CX + 285, S.y + 1150]];
  nodes.forEach(([name, nx, ny], i) => {
    const kn = springU(u, 16.6 + i * 0.3, SPRING.bouncy);
    if (kn <= 0) return;
    const c = E.outCubic(prog(u, 17 + i, 18 + i));
    const dx = nx - hub[0], dy = (ny - 80) - hub[1], len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    if (c > 0) {
      const ex = hub[0] + ux * (165 + (len - 230) * c), ey = hub[1] + uy * (165 + (len - 230) * c);
      ctx.strokeStyle = C.line; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hub[0] + ux * 150, hub[1] + uy * 150); ctx.lineTo(ex, ey); ctx.stroke();
      // data: dots travel node -> hub once connected
      if (u > 22) {
        for (let d = 0; d < 3; d++) {
          const p = ((u - 22) * 0.45 + d / 3 + i * 0.17) % 1;
          const px = lerp(nx, hub[0] + ux * 150, p), py = lerp(ny - 80, hub[1] + uy * 150, p);
          ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(px, py, 16, 0, M.TAU); ctx.fill();
        }
      }
      const kick = 10 * wobble(u - (18 + i), 3, 6);
      plug(ctx, ex + ux * kick, ey + uy * kick, 90, Math.atan2(uy, ux) + Math.PI / 2, C.accent);
    }
    // the service: its name only, in our own face (no logos)
    const w = 250, h = 120;
    ctx.save(); ctx.translate(nx, ny); ctx.scale(kn, kn);
    rrect(ctx, -w / 2, -h / 2, w, h, 26); ctx.fillStyle = C.panel; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = u >= 18 + i ? C.accent : C.line; ctx.stroke();
    label(ctx, name, 0, 22, 60, UI, C.ink, 'center');
    ctx.restore();
  });
  // hub: Claude, pulsing as data lands
  const kh = springU(u, 16.2, SPRING.bouncy);
  if (kh > 0) {
    const pulse = u > 22 ? 0.05 * bump((u - 22) % 1, 0.15, 0.3) : 0;
    ctx.save(); ctx.translate(hub[0], hub[1]); ctx.scale(kh * (1 + pulse), kh * (1 + pulse));
    ctx.beginPath(); ctx.arc(0, 0, 150, 0, M.TAU); ctx.fillStyle = C.panel; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = C.ink; ctx.stroke();
    label(ctx, 'Claude', 0, 22, 68, UI, C.ink, 'center');
    ctx.restore();
  }
  words(ctx, 'ข้อมูลจริง ไม่ต้องก๊อปวาง', CX, S.y + 1370, 62, UI, C.accent, u, 25, { align: 'center' });
}

// ---------------------------------------------------------------- S4 Skill = recipe (u 30..44)
const STEPS = ['เขียนสคริปต์', 'ทำดนตรี + เสียง', 'สร้างภาพโมชั่น', 'เรนเดอร์ส่งงาน'];
const TICK = [34, 36.5, 39, 41.5];
function sceneSkill(ctx, u) {
  title(ctx, u, 29.75, 'Skill', '= สูตรงาน ทำทีละขั้น');
  const k = springU(u, 30.3, SPRING.gentle);
  if (k <= 0) return;
  const x = S.x + 10, y = S.y + 470, w = 830, h = 700;
  ctx.save();
  ctx.translate(CX, y + h / 2 + (1 - k) * 900);
  ctx.rotate(lerp(-0.12, -0.025, k));
  ctx.translate(-CX, -(y + h / 2));
  rrect(ctx, x, y, w, h, 36); ctx.fillStyle = C.panel; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = C.line; ctx.stroke();
  label(ctx, 'SKILL.md', x + 56, y + 96, 50, UI, C.mute);
  ctx.fillStyle = C.line; ctx.fillRect(x + 56, y + 128, w - 112, 3);
  STEPS.forEach((s, i) => {
    const ry = y + 230 + i * 125, done = prog(u, TICK[i], TICK[i] + 0.5);
    const bx = x + 56, bs = 70;
    const pop = 1 + 0.18 * wobble(u - TICK[i], 3, 6);
    ctx.save(); ctx.translate(bx + bs / 2, ry - 22); ctx.scale(pop, pop);
    rrect(ctx, -bs / 2, -bs / 2, bs, bs, 16);
    if (done > 0) { ctx.fillStyle = C.accent; ctx.fill(); } else { ctx.lineWidth = 5; ctx.strokeStyle = C.mute; ctx.stroke(); }
    check(ctx, 0, 2, 50, E.outCubic(done), C.bg, 10);
    ctx.restore();
    label(ctx, `${i + 1}. ${s}`, bx + bs + 34, ry, 60, UI, done > 0 ? C.ink : C.mute);
  });
  ctx.restore();
  words(ctx, 'ผลออกมาเหมือนเดิมทุกครั้ง', CX, S.y + 1300, 62, UI, C.accent, u, 38.5, { align: 'center' });
}

// ---------------------------------------------------------------- S5 Plugin = box (u 44..57)
function sceneBox(ctx, u) {
  title(ctx, u, 43.75, 'Plugin', '= กล่องรวมชุดเครื่องมือ');
  const bw = 620, bh = 420, bx = CX - bw / 2, by = S.y + 800;
  const land = springU(u, 43.8, SPRING.bouncy);
  const dropY = (1 - land) * -1200;
  const sq = 0.05 * wobble(u - 44.2, 2.4, 5) + 0.06 * wobble(u - 53.6, 2.8, 6);
  ctx.save();
  ctx.translate(CX, by + bh + dropY); ctx.scale(1 + sq, 1 - sq); ctx.translate(-CX, -(by + bh));
  // the box's dark mouth; items fall into it and the front face covers them
  rrect(ctx, bx + 20, by - 50, bw - 40, 70, 10); ctx.fillStyle = '#060606'; ctx.fill();
  const items = [[47, (x, y) => cardIcon(ctx, x, y, 150, C.ink, C.panel), -110], [49.5, (x, y) => plug(ctx, x, y, 110, 0.25, C.accent), 110]];
  items.forEach(([u0, draw, ox]) => {
    const kk = E.inQuad(prog(u, u0 - 0.7, u0));
    if (kk <= 0) return;
    // falls, lands peeking over the rim, then settles down inside as the lid comes
    const sink = E.inOutCubic(prog(u, 52, 53));
    draw(CX + ox, lerp(by - 900, by - 60, kk) + 10 * wobble(u - u0, 3, 6) + sink * 200);
  });
  rrect(ctx, bx, by, bw, bh, 22); ctx.fillStyle = C.panel; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = C.accent; ctx.stroke();
  label(ctx, 'Plugin', CX, by + 170, 110, DISPLAY, C.ink, 'center');
  // lid: hinged at the back-left, swings shut at 53.5
  // lid: drops in from above and shuts at 53.5
  const shut = E.inCubic(prog(u, 52.6, 53.5));
  ctx.save();
  ctx.translate(CX, lerp(-300, by - 26, shut));
  ctx.rotate(lerp(-0.18, 0, shut));
  rrect(ctx, -bw / 2 - 18, -30, bw + 36, 60, 14); ctx.fillStyle = C.accent; ctx.fill();
  ctx.restore();
  const tag = springU(u, 54.3, SPRING.bouncy);
  if (tag > 0) {
    ctx.save(); ctx.translate(CX, by + 300); ctx.scale(tag, tag);
    rrect(ctx, -250, -54, 500, 100, 50); ctx.fillStyle = C.accent; ctx.fill();
    label(ctx, 'ติดตั้งครั้งเดียว', 0, 18, 56, UI, C.bg, 'center');
    ctx.restore();
  }
  ctx.restore();
  words(ctx, 'Skill + MCP + คำสั่ง อยู่ในชุดเดียว', CX, S.y + 1370, 56, UI, C.mute, u, 50.5, { align: 'center' });
}

// ---------------------------------------------------------------- S6 summary (u 57..68)
const ROWS = [['MCP', 'มือ', 58.3, plug], ['Skill', 'สูตร', 61, cardIcon], ['Plugin', 'กล่อง', 63.5, boxIcon]];
function sceneSummary(ctx, u) {
  words(ctx, 'จำง่ายๆ', S.x, S.y + 170, 150, DISPLAY, C.ink, u, 56.75, { cfg: SPRING.bouncy });
  const active = u < 61 ? 0 : u < 63.5 ? 1 : 2;
  ROWS.forEach(([en, th, u0, icon], i) => {
    const k = springU(u, u0 - 0.2, SPRING.snappy);
    if (k <= 0) return;
    const y = S.y + 420 + i * 290, x = S.x + (1 - k) * W;
    const on = u >= 66 || i === active;
    rrect(ctx, x, y, 840, 240, 40); ctx.fillStyle = on ? C.panel : C.bg; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = on ? C.accent : C.line; ctx.stroke();
    if (icon === plug) plug(ctx, x + 120, y + 92, 80, 0, on ? C.accent : C.mute);
    else icon(ctx, x + 120, y + 120, 110, on ? C.accent : C.mute, on ? C.panel : C.bg);
    label(ctx, en, x + 220, y + 148, 88, DISPLAY, on ? C.accent : C.mute);
    ctx.font = fD(88); const ew = ctx.measureText(en).width;
    label(ctx, `= ${th}`, x + 220 + ew + 24, y + 148, 88, DISPLAY, on ? C.ink : C.mute);
  });
}

// ---------------------------------------------------------------- S7 end card (u 68..80)
function sceneEnd(ctx, u) {
  words(ctx, 'เลือกให้ถูก', S.x, S.y + 560, 140, DISPLAY, C.ink, u, 67.75, { cfg: SPRING.bouncy });
  words(ctx, 'งานเสร็จไวขึ้น', S.x, S.y + 735, 140, DISPLAY, C.accent, u, 69.3, { cfg: SPRING.bouncy });
  [plug, cardIcon, boxIcon].forEach((icon, i) => {
    const k = springU(u, 70.5 + i * 0.25, SPRING.bouncy);
    if (k <= 0) return;
    const x = S.x + 80 + i * 220, y = S.y + 960;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    if (icon === plug) plug(ctx, 0, -40, 95, 0, C.mute); else icon(ctx, 0, 0, 135, C.mute, C.bg);
    ctx.restore();
  });
  const k = springU(u, 72.2, SPRING.bouncy);
  if (k > 0) {
    const pw = 700, ph = 170, px = S.x, py = S.y + 1130;
    const beat = u > 74 ? 1 + 0.035 * bump((u - 74) % 2, 0.2, 0.4) : 1;
    ctx.save(); ctx.translate(px + pw / 2, py + ph / 2); ctx.scale(k * beat, k * beat);
    rrect(ctx, -pw / 2, -ph / 2, pw, ph, ph / 2); ctx.fillStyle = C.accent; ctx.fill();
    label(ctx, 'กดติดตามไว้เลย', 0, 28, 82, DISPLAY, C.bg, 'center');
    ctx.restore();
  }
}

// ---------------------------------------------------------------- timeline
const SCENES = [[0, sceneHook], [8, sceneTask], [16, sceneMCP], [30, sceneSkill], [44, sceneBox], [57, sceneSummary], [68, sceneEnd]];

M.film({
  fonts: [fD(100), fU(40)],
  samples: 8,
  async init() {
    // the Thai subsets load only when Thai text is requested
    await Promise.all([fD(100), fU(40)].map((f) => document.fonts.load(f, 'กขคปลั๊กอินสกิล')));
  },
  hits: HITS,
  draw(ctx, u) {
    let i = SCENES.length - 1;
    while (i > 0 && u < SCENES[i][0]) i--;
    const next = SCENES[i + 1] ? SCENES[i + 1][0] : Infinity;
    // the outgoing scene lifts away over its last half beat (S2 carries its own push via the MCP chip)
    const out = i === 1 ? 0 : E.inBack(prog(u, next - 0.5, next), 1.3);
    fill(ctx, C.bg);
    ctx.save();
    if (out > 0) ctx.translate(0, -out * H * 0.7);
    SCENES[i][1](ctx, u);
    ctx.restore();
  },
});
