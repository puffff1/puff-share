// 涂鸦小站 · Y2K 像素绘画 App（横屏 · 全状态恢复 · 稳定版）
const CW = 640, CH = 440, TAU = Math.PI * 2;

var KEEP = {
  img: null, strokes: 0, undo: [],
  tool: "b:pencil", color: "#ff5fa2", alpha: 1, size: 6,
  view: { scale: 1, tx: 0, ty: 0 },
  tab: "brush", charId: "",
  busy: false, busyAt: 0, lastAsked: 0,
  recent: [], log: [], token: 0
};

/* ================= 基础工具 ================= */
function mk(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function rgb2(hex) {
  var s = String(hex || "#000").replace("#", "");
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  var n = parseInt(s, 16);
  if (isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rga(hex, a) { var c = rgb2(hex); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
function seg(g, a, b, lw) {
  if (Math.hypot(b.x - a.x, b.y - a.y) < 0.6) {
    g.beginPath(); g.arc(b.x, b.y, Math.max(lw / 2, 0.35), 0, TAU); g.fill();
  } else {
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  }
}
function stampLine(g, fn, a, b, size, gap) {
  var d = Math.hypot(b.x - a.x, b.y - a.y);
  var step = Math.max(3, size * gap);
  var n = Math.max(1, Math.ceil(d / step));
  for (var i = 0; i <= n; i++) {
    var t = i / n;
    fn(g, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, size / 2);
  }
}
function cleanLine(s) {
  return String(s || "").replace(/\s+/g, " ").replace(/^["'「『“”]+|["'」』“”]+$/g, "").trim();
}
function pickText(r) {
  if (!r) return "";
  if (typeof r === "string") return cleanLine(r);
  if (typeof r.text === "string") return cleanLine(r.text);
  if (typeof r.content === "string") return cleanLine(r.content);
  if (Array.isArray(r.content)) {
    return cleanLine(r.content.map(function (c) {
      return typeof c === "string" ? c : (c && c.text) || "";
    }).join(""));
  }
  return "";
}
function colorName(r, g2, b) {
  var max = Math.max(r, g2, b), min = Math.min(r, g2, b);
  var l = (max + min) / 2, d = max - min;
  if (d < 26) return l > 205 ? "白" : (l > 130 ? "灰" : "黑");
  var h = 0;
  if (max === r) h = ((g2 - b) / d) % 6;
  else if (max === g2) h = (b - r) / d + 2;
  else h = (r - g2) / d + 4;
  h = Math.round(h * 60); if (h < 0) h += 360;
  var tb = [[15, "红"], [45, "橙"], [70, "黄"], [160, "绿"], [200, "青"], [255, "蓝"], [290, "紫"], [330, "品红"], [361, "红"]];
  var nm = "彩";
  for (var i = 0; i < tb.length; i++) { if (h < tb[i][0]) { nm = tb[i][1]; break; } }
  return (l < 92 ? "深" : (l > 205 ? "浅" : "")) + nm;
}

/* ================= 笔刷 ================= */
function brPencil(g, a, b, s) {
  var w = Math.max(0.7, s.size * 0.5);
  var d = Math.hypot(b.x - a.x, b.y - a.y);
  var n = Math.max(1, Math.ceil(d / 1.2));
  g.save(); g.fillStyle = s.color;
  for (var i = 0; i <= n; i++) {
    var t = i / n;
    g.globalAlpha = s.alpha * (0.3 + Math.random() * 0.5);
    g.beginPath();
    g.arc(a.x + (b.x - a.x) * t + Math.random() - 0.5,
      a.y + (b.y - a.y) * t + Math.random() - 0.5,
      w * (0.2 + Math.random() * 0.6), 0, TAU);
    g.fill();
  }
  g.restore();
}
function brCrayon(g, a, b, s) {
  var r = Math.max(1.2, s.size * 0.85);
  var d = Math.hypot(b.x - a.x, b.y - a.y);
  g.save();
  g.strokeStyle = s.color; g.lineCap = "round"; g.lineWidth = r;
  g.globalAlpha = s.alpha * 0.5;
  seg(g, a, b, r);
  g.fillStyle = s.color;
  var n = Math.min(40, Math.ceil(d * r * 0.5) + 5);
  for (var i = 0; i < n; i++) {
    var t = Math.random(), ang = Math.random() * TAU, dd = Math.random() * r;
    g.globalAlpha = s.alpha * (0.1 + Math.random() * 0.35);
    g.beginPath();
    g.arc(a.x + (b.x - a.x) * t + Math.cos(ang) * dd,
      a.y + (b.y - a.y) * t + Math.sin(ang) * dd,
      r * (0.12 + Math.random() * 0.18), 0, TAU);
    g.fill();
  }
  g.restore();
}
function brInk(g, a, b, s) {
  var base = Math.max(1.5, s.size * 1.1);
  var d = Math.hypot(b.x - a.x, b.y - a.y);
  var tar = base * (1 - Math.min(0.6, d / 28));
  var r0 = (s.r == null) ? tar : s.r;
  var n = Math.max(1, Math.ceil(d / 1.5));
  g.save(); g.fillStyle = s.color; g.globalAlpha = s.alpha;
  for (var i = 1; i <= n; i++) {
    var t = i / n, r = r0 + (tar - r0) * t;
    g.beginPath();
    g.arc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, Math.max(0.4, r / 2), 0, TAU);
    g.fill();
  }
  g.restore();
  s.r = tar;
}
function brPen(g, a, b, s) {
  g.save();
  g.strokeStyle = s.color; g.fillStyle = s.color;
  g.lineWidth = Math.max(1, s.size * 0.7);
  g.lineCap = "round"; g.lineJoin = "round";
  g.globalAlpha = s.alpha;
  seg(g, a, b, g.lineWidth);
  g.restore();
}
/* 马克笔：方头，用 square 而不是 butt，避免段间缝隙 */
function brMarker(g, a, b, s) {
  g.save();
  g.strokeStyle = s.color;
  g.lineCap = "square";           // 关键：改为 square，段与段之间会重叠
  g.lineJoin = "round";
  g.lineWidth = Math.max(2, s.size * 1.6);
  g.globalAlpha = s.alpha * 0.5;
  seg(g, a, b, g.lineWidth);
  g.restore();
}
function brCharcoal(g, a, b, s) {
  var r = Math.max(1.5, s.size * 0.9);
  var d = Math.hypot(b.x - a.x, b.y - a.y);
  g.save(); g.fillStyle = s.color;
  var n = Math.min(56, Math.ceil(d * r * 0.6) + 6);
  for (var i = 0; i < n; i++) {
    var t = Math.random(), ang = Math.random() * TAU;
    var dd = Math.pow(Math.random(), 0.6) * r;
    g.globalAlpha = s.alpha * (0.04 + Math.random() * 0.22);
    g.beginPath();
    g.arc(a.x + (b.x - a.x) * t + Math.cos(ang) * dd,
      a.y + (b.y - a.y) * t + Math.sin(ang) * dd,
      r * (0.12 + Math.random() * 0.4), 0, TAU);
    g.fill();
  }
  g.restore();
}
function brWater(g, a, b, s) {
  var r = Math.max(2.5, s.size);
  var d = Math.hypot(b.x - a.x, b.y - a.y);
  var n = Math.max(1, Math.ceil(d / 2.4));
  g.save(); g.globalCompositeOperation = "multiply";
  for (var i = 0; i <= n; i++) {
    var t = i / n;
    var x = a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 3;
    var y = a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 3;
    for (var k = 0; k < 2; k++) {
      var rr = r * (0.55 + Math.random() * 0.6);
      var gr = g.createRadialGradient(x, y, rr * 0.08, x, y, rr);
      gr.addColorStop(0, rga(s.color, s.alpha * 0.16));
      gr.addColorStop(1, rga(s.color, 0));
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    }
  }
  g.restore();
}
function brFluo(g, a, b, s) {
  g.save();
  g.globalCompositeOperation = "multiply";
  g.strokeStyle = s.color;
  g.lineWidth = Math.max(5, s.size * 2);
  g.lineCap = "square";
  g.globalAlpha = s.alpha * 0.35;
  seg(g, a, b, g.lineWidth);
  g.restore();
}
function brSpray(g, a, b, s) {
  var r = Math.max(4, s.size * 2.2);
  var n = Math.min(24, Math.max(6, Math.round(s.size)));
  var dx = b.x - a.x, dy = b.y - a.y;
  var steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
  g.save(); g.fillStyle = s.color;
  for (var k = 0; k <= steps; k++) {
    var x = a.x + dx * k / steps, y = a.y + dy * k / steps;
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * TAU, rr = Math.random() * r;
      g.globalAlpha = s.alpha * (0.08 + Math.random() * 0.3);
      g.fillRect(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, 1.2, 1.2);
    }
  }
  g.restore();
}
function brPixel(g, a, b, s) {
  var c = Math.max(2, Math.round(s.size));
  var d = Math.hypot(b.x - a.x, b.y - a.y);
  var n = Math.max(1, Math.ceil(d / (c * 0.45)));
  g.save(); g.fillStyle = s.color; g.globalAlpha = s.alpha;
  for (var i = 0; i <= n; i++) {
    var t = i / n;
    g.fillRect(Math.floor((a.x + (b.x - a.x) * t) / c) * c,
      Math.floor((a.y + (b.y - a.y) * t) / c) * c, c, c);
  }
  g.restore();
}
/* 霓虹笔：改用多层描边，不用 shadowBlur，避免段间发光错位成虚线 */
function brNeon(g, a, b, s) {
  g.save();
  g.lineCap = "round";
  g.lineJoin = "round";
  // 外层柔光
  g.globalAlpha = s.alpha * 0.22;
  g.strokeStyle = s.color;
  g.lineWidth = Math.max(6, s.size * 2.2);
  seg(g, a, b, g.lineWidth);
  // 中层主色
  g.globalAlpha = s.alpha * 0.75;
  g.lineWidth = Math.max(3, s.size * 1.1);
  seg(g, a, b, g.lineWidth);
  // 内层亮芯
  g.globalAlpha = s.alpha;
  g.strokeStyle = "#ffffff";
  g.lineWidth = Math.max(1, s.size * 0.28);
  seg(g, a, b, g.lineWidth);
  g.restore();
}
function brEraser(g, a, b, s) {
  g.save();
  g.strokeStyle = "#ffffff"; g.fillStyle = "#ffffff";
  g.lineCap = "round"; g.lineJoin = "round";
  g.lineWidth = Math.max(4, s.size * 1.3);
  seg(g, a, b, g.lineWidth);
  g.restore();
}

/* ================= 素材图形 ================= */
var STAMPS = {
  star: function (g, x, y, r, c) {
    g.fillStyle = c; g.beginPath();
    for (var i = 0; i < 10; i++) {
      var rr = i % 2 ? r * 0.45 : r;
      var a = -1.5708 + i * 0.6283;
      var px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath(); g.fill();
  },
  heart: function (g, x, y, r, c) {
    g.fillStyle = c; g.beginPath();
    g.moveTo(x, y + r * 0.92);
    g.bezierCurveTo(x - r * 1.65, y - r * 0.42, x - r * 0.55, y - r * 1.45, x, y - r * 0.32);
    g.bezierCurveTo(x + r * 0.55, y - r * 1.45, x + r * 1.65, y - r * 0.42, x, y + r * 0.92);
    g.fill();
  },
  bubble: function (g, x, y, r, c) {
    g.strokeStyle = c; g.lineWidth = Math.max(1, r * 0.2);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    g.fillStyle = c;
    g.beginPath(); g.arc(x - r * 0.33, y - r * 0.33, Math.max(0.8, r * 0.16), 0, TAU); g.fill();
  },
  confetti: function (g, x, y, r, c) {
    g.strokeStyle = c; g.lineWidth = Math.max(1, r * 0.16); g.lineCap = "round";
    for (var i = 0; i < 6; i++) {
      var a = Math.random() * TAU, d = Math.random() * r * 1.2 + r * 0.3;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * d * 0.3, y + Math.sin(a) * d * 0.3);
      g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      g.stroke();
    }
  },
  cloud: function (g, x, y, r, c) {
    g.fillStyle = c; g.beginPath();
    g.arc(x - r * 0.85, y + r * 0.2, r * 0.68, 0, TAU);
    g.arc(x, y - r * 0.25, r * 0.9, 0, TAU);
    g.arc(x + r * 0.85, y + r * 0.2, r * 0.68, 0, TAU);
    g.arc(x, y + r * 0.4, r * 0.8, 0, TAU);
    g.fill();
  },
  petal: function (g, x, y, r, c) {
    g.fillStyle = c;
    for (var i = 0; i < 5; i++) {
      g.save(); g.translate(x, y); g.rotate(i * 1.2566 - 1.5708);
      g.beginPath(); g.ellipse(0, -r * 0.6, r * 0.32, r * 0.6, 0, 0, TAU); g.fill();
      g.restore();
    }
    g.fillStyle = "#fff3b0";
    g.beginPath(); g.arc(x, y, r * 0.24, 0, TAU); g.fill();
  },
  spark: function (g, x, y, r, c) {
    g.strokeStyle = c; g.lineWidth = Math.max(1, r * 0.2); g.lineCap = "round";
    for (var i = 0; i < 4; i++) {
      var a = i * 1.5708 + 0.7854;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke();
    }
    g.fillStyle = c;
    g.beginPath(); g.arc(x, y, Math.max(1, r * 0.2), 0, TAU); g.fill();
  },
  note: function (g, x, y, r, c) {
    g.fillStyle = c;
    g.beginPath(); g.ellipse(x - r * 0.4, y + r * 0.7, r * 0.48, r * 0.34, -0.32, 0, TAU); g.fill();
    g.strokeStyle = c; g.lineWidth = Math.max(1, r * 0.26); g.lineCap = "round";
    g.beginPath();
    g.moveTo(x + r * 0.02, y + r * 0.64);
    g.lineTo(x + r * 0.02, y - r * 0.85);
    g.quadraticCurveTo(x + r * 0.85, y - r * 1.05, x + r * 0.95, y - r * 0.24);
    g.stroke();
  },
  diamond: function (g, x, y, r, c) {
    g.fillStyle = c; g.beginPath();
    g.moveTo(x, y - r); g.lineTo(x + r * 0.7, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.7, y);
    g.closePath(); g.fill();
    g.save(); g.globalAlpha *= 0.5; g.fillStyle = "#ffffff";
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.7, y); g.lineTo(x, y); g.closePath(); g.fill();
    g.restore();
  },
  paw: function (g, x, y, r, c) {
    g.fillStyle = c;
    g.beginPath(); g.ellipse(x, y + r * 0.5, r * 0.8, r * 0.66, 0, 0, TAU); g.fill();
    for (var i = 0; i < 4; i++) {
      var a = -1.5708 + (i - 1.5) * 0.52;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.28, r * 0.36, a + 1.5708, 0, TAU);
      g.fill();
    }
  },
  bow: function (g, x, y, r, c) {
    g.fillStyle = c;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - r, y - r * 0.7); g.lineTo(x - r, y + r * 0.7); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + r, y - r * 0.7); g.lineTo(x + r, y + r * 0.7); g.closePath(); g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath(); g.arc(x, y, r * 0.23, 0, TAU); g.fill();
  },
  moon: function (g, x, y, r, c) {
    g.strokeStyle = c; g.lineWidth = Math.max(1.6, r * 0.42); g.lineCap = "round";
    g.beginPath(); g.arc(x, y, r * 0.75, Math.PI * 0.34, Math.PI * 1.66); g.stroke();
  }
};

/* ================= CSS ================= */
var CSS = ""
+ ".pk,.pk *,.pk *::before,.pk *::after{box-sizing:border-box;font-family:'Courier New',ui-monospace,Menlo,monospace}"
+ ".pk{position:fixed;inset:0;z-index:9000;overflow:hidden;background:#f3e8ff;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}"
+ ".pk-rot{position:absolute;transform-origin:center center;will-change:transform}"
+ ".pk-win{width:100%;height:100%;display:flex;flex-direction:column;min-height:0;overflow:hidden;color:#2a1b3d;background:#fff7fd}"
+ ".pk-menu{flex:none;height:26px;display:flex;align-items:center;gap:6px;padding:0 8px;background:linear-gradient(180deg,#ffc9e6,#ff9ad0 55%,#ff7cc2);border-bottom:2px solid #2a1b3d}"
+ ".pk-dots{display:flex;gap:3px;flex:none}"
+ ".pk-dot{width:8px;height:8px;border:1.5px solid #2a1b3d;border-radius:50%}"
+ ".pk-dot.a{background:#ffe066}.pk-dot.b{background:#7ee8fa}.pk-dot.c{background:#b18cff}"
+ ".pk-mtitle{flex:none;font-size:11px;font-weight:700;white-space:nowrap;text-shadow:1px 1px 0 rgba(255,255,255,.7)}"
+ ".pk-mspace{flex:1 1 auto;min-width:4px}"
+ ".pk-x{width:26px;height:20px;padding:0;font:inherit;font-size:12px;line-height:1;background:#fff;color:#2a1b3d;border:1.5px solid #2a1b3d;border-radius:3px;cursor:pointer;flex:none}"
+ ".pk-body{flex:1;min-height:0;display:flex;flex-wrap:nowrap;gap:6px;padding:6px;overflow:hidden}"
+ ".pk-stagewrap{flex:1;min-width:0;min-height:0;position:relative;overflow:hidden;background:#efe0fb;border:2px solid #2a1b3d;border-radius:4px;box-shadow:3px 3px 0 #2a1b3d;display:flex;align-items:center;justify-content:center}"
+ ".pk-cv{display:block;background:#fff;border:1.5px solid #2a1b3d;border-radius:2px;touch-action:none;cursor:crosshair;transform-origin:center center;will-change:transform;box-shadow:2px 2px 0 rgba(42,27,61,.25)}"
+ ".pk-tip{position:absolute;left:50%;top:8px;transform:translateX(-50%);z-index:5;font-size:10px;padding:3px 8px;background:#fff3b0;border:1.5px solid #2a1b3d;border-radius:3px;box-shadow:2px 2px 0 rgba(42,27,61,.3);white-space:nowrap;pointer-events:none;transition:opacity .5s;opacity:1}"
+ ".pk-tip.off{opacity:0}"
+ ".pk-rail{width:186px;flex:none;min-height:0;display:flex;flex-direction:column;gap:5px}"
+ ".pk-tabs{flex:none;display:flex;gap:3px}"
+ ".pk-tab{flex:1;font:inherit;font-size:9px;padding:3px 0;border:1.5px solid #2a1b3d;border-radius:3px;background:#fff;color:inherit;cursor:pointer;white-space:nowrap}"
+ ".pk-tab.on{background:#ffe066;box-shadow:inset 0 0 0 1px #2a1b3d}"
+ ".pk-box{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;border:1.5px solid #2a1b3d;border-radius:4px;background:#fff;padding:5px;box-shadow:2px 2px 0 rgba(42,27,61,.22);-webkit-overflow-scrolling:touch}"
+ ".pk-pane{display:none}.pk-pane.on{display:block}"
+ ".pk-tt{font-size:9px;font-weight:700;letter-spacing:.5px;opacity:.72;margin:0 0 4px}"
+ ".pk-tt+.pk-tt{margin-top:8px}"
+ ".pk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3px}"
+ ".pk-tool{height:34px;padding:1px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;border:1.5px solid #2a1b3d;border-radius:3px;background:#fff;color:inherit;font:inherit;cursor:pointer;overflow:hidden}"
+ ".pk-tool span{font-size:13px;line-height:1}"
+ ".pk-tool small{font-size:7.5px;opacity:.72;white-space:nowrap;transform:scale(.96)}"
+ ".pk-tool.on{background:#ffe066;box-shadow:inset 0 0 0 1px #2a1b3d}"
+ ".pk-sw{display:grid;grid-template-columns:repeat(6,1fr);gap:3px}"
+ ".pk-sw button{height:17px;padding:0;border:1.5px solid #2a1b3d;border-radius:3px;cursor:pointer}"
+ ".pk-sw button.on{outline:2px solid #2a1b3d;outline-offset:1px}"
+ ".pk-row{display:flex;align-items:center;gap:6px;margin-top:5px}"
+ ".pk-cp{width:36px;height:24px;padding:0;border:1.5px solid #2a1b3d;border-radius:3px;background:#fff;cursor:pointer}"
+ ".pk-hex{font-size:10px;opacity:.75}"
+ ".pk-lab{font-size:9.5px;opacity:.8;margin:5px 0 2px}"
+ ".pk-rng{width:100%;accent-color:#ff5fa2;margin:0}"
+ ".pk-asg{display:grid;grid-template-columns:repeat(3,1fr);gap:3px}"
+ ".pk-asc{position:relative;height:40px;padding:0;overflow:hidden;border:1.5px solid #2a1b3d;border-radius:3px;background:#f8f0ff;cursor:pointer;display:flex;align-items:center;justify-content:center}"
+ ".pk-asc img{max-width:100%;max-height:100%;display:block}"
+ ".pk-asc.on{box-shadow:inset 0 0 0 2px #ff5fa2}"
+ ".pk-asc i{position:absolute;top:1px;right:1px;width:13px;height:13px;font-size:8px;line-height:1;font-style:normal;border:1px solid #2a1b3d;border-radius:2px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}"
+ ".pk-mini{width:100%;margin-top:5px;font:inherit;font-size:9.5px;padding:4px 6px;border:1.5px solid #2a1b3d;border-radius:3px;background:#d6f4ff;cursor:pointer}"
+ ".pk-sel{width:100%;font:inherit;font-size:10px;padding:3px;border:1.5px solid #2a1b3d;border-radius:3px;background:#fff;color:#2a1b3d}"
+ ".pk-cinfo{font-size:8.5px;opacity:.6;margin-top:4px;line-height:1.4;max-height:36px;overflow:hidden}"
+ ".pk-chat{flex:none;height:96px;display:flex;flex-direction:column;border:1.5px solid #2a1b3d;border-radius:4px;background:#fff;overflow:hidden;box-shadow:2px 2px 0 rgba(42,27,61,.22)}"
+ ".pk-ch{flex:none;padding:3px 6px;background:linear-gradient(180deg,#d8f6ff,#b6ecff);border-bottom:1.5px solid #2a1b3d;font-size:9px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
+ ".pk-cl{flex:1;min-height:0;overflow-y:auto;padding:4px 5px;display:flex;flex-direction:column;gap:4px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}"
+ ".pk-m{display:flex;gap:4px;align-items:flex-start}"
+ ".pk-av{width:18px;height:18px;flex:none;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;border:1.5px solid #2a1b3d;border-radius:3px;background:#ffd6ec center/cover no-repeat;overflow:hidden}"
+ ".pk-bb{flex:1;min-width:0;font-size:10px;line-height:1.45;padding:3px 5px;border:1.5px solid #2a1b3d;border-radius:3px;background:#fff7fd;word-break:break-word}"
+ ".pk-sys{font-size:9px;opacity:.6;text-align:center;width:100%}"
+ ".pk-ft{flex:none;display:flex;align-items:center;gap:4px;padding:4px 8px;border-top:2px solid #2a1b3d;background:linear-gradient(180deg,#f6ecff,#ece0fb);overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}"
+ ".pk-ft::-webkit-scrollbar{display:none}"
+ ".pk-st{flex:none;font-size:9px;opacity:.7;white-space:nowrap}"
+ ".pk-sp{flex:1 1 auto;min-width:6px}"
+ ".pk-btn{flex:none;font:inherit;font-size:9.5px;padding:4px 8px;border:1.5px solid #2a1b3d;border-radius:3px;background:#fff;color:inherit;box-shadow:1px 1px 0 #2a1b3d;cursor:pointer;white-space:nowrap}"
+ ".pk-btn.p{background:#ffd6ec}.pk-btn.c{background:#d6f4ff}.pk-btn.y{background:#fff3b0}.pk-btn.g{background:#c8f7c5}"
+ ".pk-zbtn{flex:none;font:inherit;font-size:10px;padding:2px 6px;border:1.5px solid #2a1b3d;border-radius:3px;background:#f3e8ff;cursor:pointer}"
+ ".pk-zpct{flex:none;font-size:9px;min-width:34px;text-align:center}"
+ ".pk-h{font-size:12px;font-weight:700;padding:4px 2px 8px;border-bottom:1.5px dashed rgba(42,27,61,.35);margin-bottom:8px}"
+ ".pk-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:6px}"
+ ".pk-gc{position:relative;border:1.5px solid #2a1b3d;border-radius:3px;overflow:hidden;background:#fff}"
+ ".pk-gc img{display:block;width:100%;height:auto;cursor:pointer}"
+ ".pk-gc b{display:block;font-size:9px;font-weight:400;padding:2px 4px;border-top:1px solid rgba(42,27,61,.25);opacity:.78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
+ ".pk-gx{position:absolute;top:2px;right:2px;width:17px;height:17px;padding:0;line-height:1;font-size:10px;border:1px solid #2a1b3d;border-radius:2px;background:#fff;cursor:pointer}";

/* ================= 主逻辑 ================= */
function mount(ctx, host, api) {
  var close = (api && api.close) || function () {};
  var timers = [];
  var myToken = ++KEEP.token;
  function isAlive() { return KEEP.token === myToken; }
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function P(k, d) {
    try { var v = ctx.kit.prefs.get(k); return (v === undefined || v === null) ? d : v; }
    catch (e) { return d; }
  }
  function KG(k, d) {
    try { var v = ctx.kit.kv.get(k); return (v === undefined || v === null) ? d : v; }
    catch (e) { return d; }
  }
  function KS(k, v) { try { ctx.kit.kv.set(k, v); } catch (e) {} }

  host.innerHTML = "";
  host.appendChild(mk("style", null, CSS));

  var BRUSHES = [
    ["pencil", "铅笔", "✏", brPencil], ["crayon", "蜡笔", "▨", brCrayon],
    ["ink", "毛笔", "〆", brInk], ["pen", "钢笔", "✒", brPen],
    ["marker", "马克", "▬", brMarker], ["charcoal", "炭笔", "▩", brCharcoal],
    ["water", "水彩", "◍", brWater], ["fluo", "荧光", "▮", brFluo],
    ["spray", "喷枪", "░", brSpray], ["pixel", "像素", "⊞", brPixel],
    ["neon", "霓虹", "☄", brNeon], ["eraser", "橡皮", "⌫", brEraser]
  ];
  var BRUSH = {}; BRUSHES.forEach(function (b) { BRUSH[b[0]] = b[3]; });

  var SHAPES = [
    ["line", "直线", "╱"], ["rect", "方框", "▢"], ["ellipse", "圆", "◯"],
    ["triangle", "三角", "△"], ["hand", "抓手", "✋"]
  ];
  var STAMP_LIST = [
    ["star", "星星", "★"], ["heart", "爱心", "♥"], ["bubble", "泡泡", "◯"],
    ["confetti", "彩带", "✧"], ["cloud", "云朵", "☁"], ["petal", "花瓣", "❀"],
    ["spark", "闪光", "✦"], ["note", "音符", "♪"], ["diamond", "钻石", "◆"],
    ["paw", "猫爪", "🐾"], ["bow", "蝴蝶结", "🎀"], ["moon", "月亮", "☾"]
  ];
  var SWATCHES = [
    "#2a1b3d", "#ffffff", "#ff5fa2", "#ff8fab", "#ff4d6d", "#ffd166",
    "#ffe066", "#b8f2a8", "#8ac926", "#7ee8fa", "#4cc9f0", "#3a86ff",
    "#b18cff", "#c77dff", "#f15bb5", "#ff6b35", "#c9ada7", "#6b5b95",
    "#000000", "#5f4b8b", "#b8b8ff", "#f8f0ff", "#a0e7e5", "#ffadad"
  ];
  var FALLBACKS = [
    "嗯……这构图挺自由的，我欣赏。", "你这线条，跟我的心情一样飘。",
    "颜色挺敢用的，我喜欢。", "再画两笔，我快看懂了。",
    "这画里有故事，就是还没讲完。", "抽象派大师，是你吧。",
    "嗯，这一笔我记住了。", "我盯着看了三秒，笑了一下。",
    "你画你的，我看我的，挺好。", "要不……我帮你补两笔？"
  ];

  var state = {
    tool: KEEP.tool || "b:pencil",
    color: KEEP.color || "#ff5fa2",
    alpha: (KEEP.alpha == null ? 1 : KEEP.alpha),
    size: KEEP.size || 6,
    drawing: false, last: null, start: null, snap: null, inkR: null,
    undo: (KEEP.undo || []).slice(),
    strokes: KEEP.strokes || 0,
    used: {}
  };
  var view = {
    scale: (KEEP.view && KEEP.view.scale) || 1,
    tx: (KEEP.view && KEEP.view.tx) || 0,
    ty: (KEEP.view && KEEP.view.ty) || 0
  };
  var pointers = {};
  var pinchStart = null, panning = null, rotated = false, saveTimer = null;
  var assetImgs = {};
  var chars = [];
  var autoTimer = null;
  var recent = KEEP.recent;

  var charSel = null, charInfo = null;

  var root = mk("div", "pk");
  var rot = mk("div", "pk-rot");
  var win = mk("div", "pk-win");

  var menu = mk("div", "pk-menu");
  var dots = mk("div", "pk-dots");
  ["a", "b", "c"].forEach(function (k) { dots.appendChild(mk("i", "pk-dot " + k)); });
  var mTitle = mk("div", "pk-mtitle", "涂鸦小站 · 铅笔");
  var btnX = mk("button", "pk-x", "✕");
  btnX.type = "button"; btnX.onclick = close;
  menu.append(dots, mTitle, mk("div", "pk-mspace"), btnX);

  var body = mk("div", "pk-body");
  var stageWrap = mk("div", "pk-stagewrap");
  var cvs = document.createElement("canvas");
  cvs.width = CW; cvs.height = CH; cvs.className = "pk-cv";
  stageWrap.appendChild(cvs);
  var tip = mk("div", "pk-tip", "📱 把手机横过来，画面自动铺满");
  stageWrap.appendChild(tip);
  var g = cvs.getContext("2d", { willReadFrequently: true });
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, CW, CH);

  var rail = mk("div", "pk-rail");
  var tabs = mk("div", "pk-tabs");
  var box = mk("div", "pk-box");
  var chatp = mk("div", "pk-chat");
  var chatHead = mk("div", "pk-ch", "✦ ta 在看");
  var chatList = mk("div", "pk-cl");
  chatp.append(chatHead, chatList);
  rail.append(tabs, box, chatp);
  body.append(stageWrap, rail);

  var foot = mk("div", "pk-ft");
  var stTool = mk("span", "pk-st", "◈ 铅笔");
  var stSize = mk("span", "pk-st", "◈ 6px");
  var stAlpha = mk("span", "pk-st", "◈ 100%");
  var stStroke = mk("span", "pk-st", "◈ 0 笔");
  var btnUndo = mk("button", "pk-btn", "↩ 撤销");
  var btnClear = mk("button", "pk-btn", "✕ 清空");
  var btnLook = mk("button", "pk-btn y", "◎ 让 ta 看");
  var btnSave = mk("button", "pk-btn p", "✦ 存册");
  var btnOut = mk("button", "pk-btn c", "⤓ 导出");
  var btnGal = mk("button", "pk-btn g", "▤ 相册");
  var zOut = mk("button", "pk-zbtn", "－");
  var zPct = mk("span", "pk-zpct", "100%");
  var zIn = mk("button", "pk-zbtn", "＋");
  var zRst = mk("button", "pk-zbtn", "1:1");
  [btnUndo, btnClear, btnLook, btnSave, btnOut, btnGal, zOut, zIn, zRst].forEach(function (b) { b.type = "button"; });
  foot.append(stTool, stSize, stAlpha, stStroke, mk("span", "pk-sp"),
    zOut, zPct, zIn, zRst, mk("span", "pk-sp"),
    btnUndo, btnClear, btnLook, btnSave, btnOut, btnGal);

  win.append(menu, body, foot);
  rot.appendChild(win);
  root.appendChild(rot);
  host.appendChild(root);

  function persistState() {
    KEEP.tool = state.tool; KEEP.color = state.color;
    KEEP.alpha = state.alpha; KEEP.size = state.size;
    KEEP.view = { scale: view.scale, tx: view.tx, ty: view.ty };
    if (charSel) KEEP.charId = charSel.value || "";
  }
  function persistImage() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try {
        KEEP.img = g.getImageData(0, 0, CW, CH);
        KEEP.strokes = state.strokes;
        KEEP.undo = state.undo.slice(-2);
      } catch (e) {}
    }, 260);
  }
  function restore() {
    if (KEEP.img) { try { g.putImageData(KEEP.img, 0, 0); } catch (e) {} }
  }
  function canvasIsBlank() {
    try {
      var d = g.getImageData(0, 0, CW, CH).data;
      for (var i = 0; i < d.length; i += 64) {
        if (d[i] < 246 || d[i + 1] < 246 || d[i + 2] < 246) return false;
      }
      return true;
    } catch (e) { return false; }
  }
  var guardId = setInterval(function () {
    if (!isAlive()) return;
    if (!KEEP.img || state.strokes <= 0) return;
    if (state.drawing) return;
    if (canvasIsBlank()) {
      try { g.putImageData(KEEP.img, 0, 0); updateStatus(); } catch (e) {}
    }
  }, 2500);

  function layout() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var land = vw >= vh;
    rotated = !land;
    var w = land ? vw : vh, h = land ? vh : vw;
    rot.style.width = w + "px"; rot.style.height = h + "px";
    rot.style.left = ((vw - w) / 2) + "px"; rot.style.top = ((vh - h) / 2) + "px";
    rot.style.transform = land ? "none" : "rotate(90deg)";
    if (rotated) tip.classList.remove("off");
    else later(function () { tip.classList.add("off"); }, 1200);
    fitCanvas();
  }
  function fitCanvas() {
    var w = Math.max(80, stageWrap.clientWidth - 22);
    var h = Math.max(55, stageWrap.clientHeight - 22);
    var r = CW / CH;
    var cw = w, ch = w / r;
    if (ch > h) { ch = h; cw = h * r; }
    cvs.style.width = Math.round(cw) + "px";
    cvs.style.height = Math.round(ch) + "px";
  }

  function applyView() {
    cvs.style.transform = "translate(" + view.tx + "px," + view.ty + "px) scale(" + view.scale + ")";
    zPct.textContent = Math.round(view.scale * 100) + "%";
    persistState();
  }
  function resetView() { view.scale = 1; view.tx = 0; view.ty = 0; applyView(); }
  function zoomBy(k) { view.scale = clamp(view.scale * k, 0.4, 8); applyView(); }
  zIn.onclick = function () { zoomBy(1.2); };
  zOut.onclick = function () { zoomBy(1 / 1.2); };
  zRst.onclick = resetView;

  var TABS = [["brush", "笔"], ["shape", "形"], ["stamp", "材"], ["color", "色"], ["set", "人"]];
  var paneNodes = {}, tabNodes = {};
  function switchTab(key) {
    Object.keys(paneNodes).forEach(function (k) { paneNodes[k].classList.toggle("on", k === key); });
    Object.keys(tabNodes).forEach(function (k) { tabNodes[k].classList.toggle("on", k === key); });
    KEEP.tab = key;
  }
  TABS.forEach(function (t) {
    var b = mk("button", "pk-tab", t[1]);
    b.type = "button";
    b.onclick = function () { switchTab(t[0]); };
    tabNodes[t[0]] = b; tabs.appendChild(b);
  });
  function pane(key) {
    var p = mk("div", "pk-pane");
    paneNodes[key] = p; box.appendChild(p); return p;
  }

  var toolNodes = {};
  function addTool(parent, id, icon, name) {
    var b = mk("button", "pk-tool");
    b.type = "button"; b.title = name;
    b.append(mk("span", null, icon), mk("small", null, name));
    b.onclick = function () { selectTool(id); };
    toolNodes[id] = b; parent.appendChild(b);
  }

  var pBrush = pane("brush");
  pBrush.appendChild(mk("div", "pk-tt", "◈ 画笔"));
  var gBrush = mk("div", "pk-grid");
  BRUSHES.forEach(function (b) { addTool(gBrush, "b:" + b[0], b[2], b[1]); });
  pBrush.appendChild(gBrush);

  var pShape = pane("shape");
  pShape.appendChild(mk("div", "pk-tt", "◈ 形状 / 填色 / 抓手"));
  var gShape = mk("div", "pk-grid");
  SHAPES.forEach(function (s) { addTool(gShape, "sh:" + s[0], s[2], s[1]); });
  addTool(gShape, "fill", "◧", "填色");
  pShape.appendChild(gShape);

  var pStamp = pane("stamp");
  pStamp.appendChild(mk("div", "pk-tt", "◈ 素材笔"));
  var gStamp = mk("div", "pk-grid");
  STAMP_LIST.forEach(function (s) { addTool(gStamp, "s:" + s[0], s[2], s[1]); });
  pStamp.appendChild(gStamp);
  pStamp.appendChild(mk("div", "pk-tt", "◈ 我的素材"));
  var assetGrid = mk("div", "pk-asg");
  pStamp.appendChild(assetGrid);
  var btnImport = mk("button", "pk-mini", "＋ 导入图片 / 素材");
  btnImport.type = "button";
  pStamp.appendChild(btnImport);
  var fileInput = document.createElement("input");
  fileInput.type = "file"; fileInput.accept = "image/*"; fileInput.style.display = "none";
  pStamp.appendChild(fileInput);

  var pColor = pane("color");
  pColor.appendChild(mk("div", "pk-tt", "◈ 颜色"));
  var swWrap = mk("div", "pk-sw");
  var swNodes = [];
  SWATCHES.forEach(function (c) {
    var b = mk("button");
    b.type = "button"; b.style.background = c; b.title = c;
    b.onclick = function () { setColor(c); };
    swWrap.appendChild(b); swNodes.push({ n: b, c: c });
  });
  pColor.appendChild(swWrap);
  var crow = mk("div", "pk-row");
  var cPick = document.createElement("input");
  cPick.type = "color"; cPick.className = "pk-cp"; cPick.value = state.color;
  cPick.oninput = function () { setColor(cPick.value); };
  var cHex = mk("span", "pk-hex", state.color);
  crow.append(cPick, cHex);
  pColor.appendChild(crow);
  pColor.appendChild(mk("div", "pk-tt", "◈ 笔尖 / 不透明度"));
  var sizeLab = mk("div", "pk-lab", "笔尖 " + state.size + " px");
  var sizeIn = document.createElement("input");
  sizeIn.type = "range"; sizeIn.min = "1"; sizeIn.max = "90";
  sizeIn.value = String(state.size); sizeIn.className = "pk-rng";
  sizeIn.oninput = function () {
    state.size = Number(sizeIn.value) || 1;
    sizeLab.textContent = "笔尖 " + state.size + " px";
    updateStatus(); persistState();
  };
  var alphaLab = mk("div", "pk-lab", "不透明度 " + Math.round(state.alpha * 100) + "%");
  var alphaIn = document.createElement("input");
  alphaIn.type = "range"; alphaIn.min = "5"; alphaIn.max = "100";
  alphaIn.value = String(Math.round(state.alpha * 100)); alphaIn.className = "pk-rng";
  alphaIn.oninput = function () {
    state.alpha = (Number(alphaIn.value) || 100) / 100;
    alphaLab.textContent = "不透明度 " + alphaIn.value + "%";
    updateStatus(); persistState();
  };
  pColor.append(sizeLab, sizeIn, alphaLab, alphaIn);

  var pSet = pane("set");
  pSet.appendChild(mk("div", "pk-tt", "◈ 一起画的人"));
  charSel = document.createElement("select");
  charSel.className = "pk-sel";
  pSet.appendChild(charSel);
  charInfo = mk("div", "pk-cinfo", "");
  pSet.appendChild(charInfo);

  function toolName(id) {
    if (!id) return "";
    if (id.indexOf("b:") === 0) {
      var f = BRUSHES.filter(function (x) { return x[0] === id.slice(2); })[0];
      return f ? f[1] : id;
    }
    if (id.indexOf("sh:") === 0) {
      var f2 = SHAPES.filter(function (x) { return x[0] === id.slice(3); })[0];
      return f2 ? f2[1] : id;
    }
    if (id.indexOf("s:") === 0) {
      var f3 = STAMP_LIST.filter(function (x) { return x[0] === id.slice(2); })[0];
      return f3 ? f3[1] : id;
    }
    if (id === "fill") return "填色";
    if (id.indexOf("a:") === 0) return "素材";
    return id;
  }
  function selectTool(id) {
    state.tool = id;
    Object.keys(toolNodes).forEach(function (k) { toolNodes[k].classList.toggle("on", k === id); });
    Array.prototype.forEach.call(assetGrid.children, function (card) {
      if (!card.dataset || !card.dataset.brush) return;
      card.classList.toggle("on", card.dataset.brush === id);
    });
    var isHand = (id === "sh:hand");
    cvs.style.cursor = isHand ? "grab" : (id === "fill" ? "copy" : "crosshair");
    mTitle.textContent = "涂鸦小站 · " + toolName(id);
    updateStatus(); persistState();
  }
  function setColor(c) {
    state.color = c; cPick.value = c; cHex.textContent = c;
    swNodes.forEach(function (s) {
      s.n.classList.toggle("on", s.c.toLowerCase() === String(c).toLowerCase());
    });
    persistState();
  }
  function updateStatus() {
    stTool.textContent = "◈ " + toolName(state.tool);
    stSize.textContent = "◈ " + state.size + "px";
    stAlpha.textContent = "◈ " + Math.round(state.alpha * 100) + "%";
    stStroke.textContent = "◈ " + state.strokes + " 笔";
  }

  function renderAssets() {
    var list = KG("assets", []);
    assetGrid.innerHTML = "";
    if (!list.length) {
      var h = mk("div", "pk-lab", "还没素材，点下面导入");
      h.style.cssText = "font-size:9px;opacity:.55;grid-column:1/-1;text-align:center;padding:5px 0;";
      assetGrid.appendChild(h); return;
    }
    list.forEach(function (a) {
      var card = mk("button", "pk-asc");
      card.type = "button"; card.dataset.brush = "a:" + a.id; card.title = a.name;
      var im = mk("img"); im.src = a.url; card.appendChild(im);
      card.onclick = function () {
        if (!assetImgs[a.id]) {
          var i2 = new Image();
          i2.onload = function () { assetImgs[a.id] = i2; };
          i2.src = a.url;
        }
        selectTool("a:" + a.id);
      };
      var del = mk("i", null, "✕");
      del.onclick = function (ev) {
        ev.stopPropagation();
        KS("assets", KG("assets", []).filter(function (x) { return x.id !== a.id; }));
        delete assetImgs[a.id];
        renderAssets();
        if (state.tool === "a:" + a.id) selectTool("b:pencil");
      };
      card.appendChild(del); assetGrid.appendChild(card);
    });
  }
  fileInput.onchange = function () {
    var f = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!f) return;
    if (KG("assets", []).length >= 9) { ctx.ui.toast("素材最多 9 张，先删掉一些吧"); return; }
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 200, sc = Math.min(1, max / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * sc));
        var h = Math.max(1, Math.round(img.height * sc));
        var c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        var url = c.toDataURL("image/png");
        var rec = { id: "a" + Date.now().toString(36), name: String(f.name || "素材").replace(/\.[^.]+$/, "").slice(0, 8), url: url };
        var arr = KG("assets", []); arr.push(rec); KS("assets", arr);
        var i2 = new Image();
        i2.onload = function () { assetImgs[rec.id] = i2; };
        i2.src = url;
        renderAssets(); selectTool("a:" + rec.id); switchTab("stamp");
        ctx.ui.toast("素材已加入，可以当图章笔用");
      };
      img.onerror = function () { ctx.ui.toast("这张图读不出来"); };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  };
  btnImport.onclick = function () { fileInput.click(); };

  function loadChars() {
    var out = [], seen = {};
    try {
      (ctx.threads.list() || []).forEach(function (t) {
        if (t && !t.isGroup && t.characterId && !seen[t.characterId]) {
          seen[t.characterId] = 1;
          var p = null;
          try { p = ctx.personas.get(t.characterId); } catch (e) {}
          out.push({ id: t.characterId, name: (p && p.name) || t.title || t.characterId, avatar: (p && p.avatar) || "", summary: (p && p.summary) || "" });
        }
      });
    } catch (e) {}
    try {
      (ctx.personas.list() || []).forEach(function (p) {
        if (p && p.id && !seen[p.id]) {
          seen[p.id] = 1;
          out.push({ id: p.id, name: p.name || p.id, avatar: p.avatar || "", summary: p.summary || "" });
        }
      });
    } catch (e) {}
    return out;
  }
  function curChar() {
    var id = charSel.value;
    var arr = chars.filter(function (c) { return c.id === id; });
    return arr.length ? arr[0] : null;
  }
  var silentCharSwitch = true;  // 初次渲染不刷「换成了」消息，避免日志堆积
  function onCharChange() {
    var c = curChar();
    KEEP.charId = charSel.value || "";
    if (!c) { chatHead.textContent = "✦ ta 在看"; charInfo.textContent = ""; return; }
    chatHead.textContent = "✦ " + c.name + " 在看";
    charInfo.textContent = c.summary ? String(c.summary).slice(0, 60) : "（这位还没写人设，ta 会随性吐槽）";
    if (silentCharSwitch) return;
    addMsg("sys", "换成了「" + c.name + "」。");
  }
  function renderChars() {
    chars = loadChars();
    charSel.innerHTML = "";
    if (!chars.length) {
      var o = document.createElement("option");
      o.value = ""; o.textContent = "（还没有可选角色）";
      charSel.appendChild(o);
      charInfo.textContent = "先去小手机里建一个角色吧。";
      return;
    }
    chars.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c.id; o.textContent = c.name;
      charSel.appendChild(o);
    });
    var want = KEEP.charId || KG("charId", "");
    if (want && chars.filter(function (c) { return c.id === want; }).length) charSel.value = want;
    onCharChange();
    silentCharSwitch = false;
  }
  charSel.onchange = onCharChange;

  function avatarNode(c) {
    var a = mk("div", "pk-av");
    if (c && c.avatar) a.style.backgroundImage = "url(" + c.avatar + ")";
    else a.textContent = c ? String(c.name || "?").slice(0, 1) : "?";
    return a;
  }
  function renderMsg(rec) {
    if (rec.who === "sys") chatList.appendChild(mk("div", "pk-sys", rec.text));
    else {
      var row = mk("div", "pk-m");
      row.appendChild(avatarNode(rec.who === "char" ? curChar() : { name: "你" }));
      row.appendChild(mk("div", "pk-bb", rec.text));
      chatList.appendChild(row);
    }
    chatList.scrollTop = chatList.scrollHeight;
  }
  function addMsg(who, text) {
    KEEP.log.push({ who: who, text: text, t: Date.now() });
    if (KEEP.log.length > 40) KEEP.log.shift();
    renderMsg({ who: who, text: text });
  }
  function addTyping() {
    var row = mk("div", "pk-m");
    row.appendChild(avatarNode(curChar()));
    var b = mk("div", "pk-bb", "· · ·");
    b.style.letterSpacing = "2px"; b.style.opacity = ".55";
    row.appendChild(b); chatList.appendChild(row);
    chatList.scrollTop = chatList.scrollHeight;
    var i = 0;
    var t = setInterval(function () {
      i = (i + 1) % 3;
      b.textContent = ["· · ·", "· · ·  ·", "· · ·  ·  ·"][i];
    }, 340);
    timers.push(t);
    return {
      remove: function () {
        clearInterval(t);
        if (row.parentNode) row.parentNode.removeChild(row);
      }
    };
  }

  function analyze() {
    var d;
    try { d = g.getImageData(0, 0, CW, CH).data; }
    catch (e) { return "画布上有些东西，但看不清细节。"; }
    var S = 8, total = 0, painted = 0;
    var map = {}, reg = [0,0,0,0,0,0,0,0,0];
    var minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
    for (var y = 0; y < CH; y += S) {
      for (var x = 0; x < CW; x += S) {
        var i = (y * CW + x) * 4;
        var r = d[i], gg = d[i + 1], b = d[i + 2];
        total++;
        if (r > 246 && gg > 246 && b > 246) continue;
        painted++;
        var k = (r >> 5) + "_" + (gg >> 5) + "_" + (b >> 5);
        var o = map[k] || (map[k] = { n: 0, r: 0, g: 0, b: 0 });
        o.n++; o.r += r; o.g += gg; o.b += b;
        var gx = Math.min(2, (x / (CW / 3)) | 0);
        var gy = Math.min(2, (y / (CH / 3)) | 0);
        reg[gy * 3 + gx]++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (painted < 8) return "画布几乎还是空白的，用户好像还没怎么下笔。";
    var density = painted / total;
    var keys = Object.keys(map).sort(function (a, b) { return map[b].n - map[a].n; }).slice(0, 3);
    var top = keys.map(function (k) {
      var o = map[k];
      return colorName((o.r / o.n) | 0, (o.g / o.n) | 0, (o.b / o.n) | 0);
    });
    var names = ["左上", "上方", "右上", "左侧", "中央", "右侧", "左下", "下方", "右下"];
    var mx = 0, mi = 0;
    reg.forEach(function (v, i) { if (v > mx) { mx = v; mi = i; } });
    var w = maxX - minX, h = maxY - minY;
    var spread = density > 0.45 ? "涂得很满" : (density > 0.18 ? "画得比较铺开" : "留白很多，只有零散几笔");
    var shape = (w > CW * 0.75 && h > CH * 0.7) ? "铺满了整块画布"
      : (w < CW * 0.28 && h < CH * 0.28) ? "集中在很小一块地方"
      : (w > h * 1.8) ? "横向铺得很宽"
      : (h > w * 1.8) ? "竖向拉得很长"
      : "集中在画面中间一片";
    var used = Object.keys(state.used).filter(function (k) { return state.used[k]; });
    var toolNote = used.length ? "用过的工具：" + used.slice(0, 5).join("、") : "";
    return [
      "画面覆盖约 " + Math.round(density * 100) + "%（" + spread + "）",
      "主要颜色：" + top.join("、"),
      "构图：" + shape + "，最密的区域是" + names[mi],
      "共落下 " + state.strokes + " 笔",
      toolNote
    ].filter(Boolean).join("；") + "。";
  }
  function fallbackLine() {
    var pool = FALLBACKS.filter(function (x) { return recent.indexOf(x) < 0; });
    var arr = pool.length ? pool : FALLBACKS;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* ---------- 让 ta 看 ---------- */
  function releaseBusy() { KEEP.busy = false; }

  function ask(reason) {
    if (!isAlive()) return;
    // 强制释放超时锁：超过 20 秒视为卡死，允许新请求
    if (KEEP.busy && Date.now() - KEEP.busyAt > 20000) {
      KEEP.busy = false;
    }
    if (KEEP.busy) {
      ctx.ui.toast("ta 还在说话，稍等一下");
      return;
    }
    var c = curChar();
    if (!c) { addMsg("sys", "先在「人」里选一个角色吧"); switchTab("set"); return; }
    KEEP.busy = true;
    KEEP.busyAt = Date.now();
    var t = addTyping();

    var system = [
      "你正在陪用户一起画画，你们共用一块 640×440 的空白画布。",
      "以下是你的角色设定，请完全以这个身份、这个口吻说话：",
      String(c.summary || "（暂无详细设定，就按名字和日常感觉来）").slice(0, 900),
      "",
      "规则：",
      "1. 用第一人称，口语化，像真人随口说一句，20～50 字。",
      "2. 看到什么就说什么，可以夸、可以吐槽、可以好奇、可以联想。",
      "3. 只输出这一句话本身，不要引号、不要括号、不要解释、不要换行。",
      "4. 不要重复你之前说过的话。"
    ].join("\n");

    var user = "【画布快照】" + analyze()
      + (reason ? "\n【此刻】" + reason : "")
      + (KEEP.recent.length ? "\n【你之前说过】" + KEEP.recent.slice(-4).join(" / ") : "");

    var maxTok = Number(P("len", 60)) || 60;

    Promise.resolve()
      .then(function () {
        return ctx.model.ask({ prompt: user, system: system, temperature: 1, maxTokens: maxTok });
      })
      .then(function (r) {
        // 无论 token 是否一致，都要释放 busy
        releaseBusy();
        if (KEEP.token !== myToken) return;
        t.remove();
        var txt = pickText(r) || fallbackLine();
        KEEP.recent.push(txt);
        if (KEEP.recent.length > 8) KEEP.recent.shift();
        addMsg("char", txt);
      })
      .catch(function () {
        releaseBusy();
        if (KEEP.token !== myToken) return;
        t.remove();
        var txt = fallbackLine();
        KEEP.recent.push(txt);
        if (KEEP.recent.length > 8) KEEP.recent.shift();
        addMsg("char", txt);
      });
  }

  function scheduleAuto() {
    if (!isAlive()) return;
    if (!P("auto", true)) return;
    if (state.strokes === 0) return;
    if (autoTimer) clearTimeout(autoTimer);
    var gap = Math.max(5, Number(P("gap", 14)) || 14) * 1000;
    autoTimer = setTimeout(function () {
      autoTimer = null;
      if (!isAlive()) return;
      if (state.drawing) return;
      if (KEEP.busy && Date.now() - KEEP.busyAt < 20000) return;
      if (Date.now() - KEEP.lastAsked < 4000) return;
      KEEP.lastAsked = Date.now();
      ask("用户刚停笔");
    }, gap);
    timers.push(autoTimer);
  }

  function pos(e) {
    var r = cvs.getBoundingClientRect();
    if (rotated) {
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var X = e.clientX - cx, Y = e.clientY - cy;
      var u = Y, v = -X;
      var wCSS = r.height, hCSS = r.width;
      return {
        x: ((u + wCSS / 2) / Math.max(1, wCSS)) * CW,
        y: ((v + hCSS / 2) / Math.max(1, hCSS)) * CH
      };
    }
    return {
      x: ((e.clientX - r.left) / Math.max(1, r.width)) * CW,
      y: ((e.clientY - r.top) / Math.max(1, r.height)) * CH
    };
  }

  function pushUndo() {
    try {
      state.undo.push(g.getImageData(0, 0, CW, CH));
      while (state.undo.length > 8) state.undo.shift();
    } catch (e) {}
  }
  function stroke(a, b) {
    var t = state.tool;
    var s = { color: state.color, alpha: state.alpha, size: state.size, r: state.inkR };
    if (t.indexOf("b:") === 0) {
      var fn = BRUSH[t.slice(2)];
      if (!fn) return;
      g.save();
      if (t.slice(2) !== "eraser") { g.strokeStyle = state.color; g.fillStyle = state.color; }
      fn(g, a, b, s);
      g.restore();
      state.inkR = s.r;
      return;
    }
    if (t.indexOf("s:") === 0) {
      var fn2 = STAMPS[t.slice(2)];
      if (!fn2) return;
      g.save(); g.globalAlpha = state.alpha;
      stampLine(g, fn2, a, b, Math.max(4, state.size * 0.95), 1.15);
      g.restore();
      return;
    }
    if (t.indexOf("a:") === 0) {
      var im = assetImgs[t.slice(2)];
      if (!im) return;
      var w = Math.max(6, state.size);
      var h = w * im.height / Math.max(1, im.width);
      g.save(); g.globalAlpha = state.alpha;
      stampLine(g, function (gg, x, y) { gg.drawImage(im, x - w / 2, y - h / 2, w, h); },
        a, b, Math.max(6, state.size), 1.05);
      g.restore();
    }
  }
  function shapePreview(tool, a, b) {
    if (state.snap) g.putImageData(state.snap, 0, 0);
    g.save();
    g.strokeStyle = state.color; g.fillStyle = state.color;
    g.lineWidth = Math.max(1, state.size * 0.8);
    g.globalAlpha = state.alpha;
    g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath();
    if (tool === "line") { g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
    else if (tool === "rect") g.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    else if (tool === "ellipse") g.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, TAU);
    else if (tool === "triangle") { g.moveTo((a.x + b.x) / 2, a.y); g.lineTo(b.x, b.y); g.lineTo(a.x, b.y); g.closePath(); }
    g.stroke();
    g.restore();
  }
  function flood(sx, sy) {
    sx = Math.round(sx); sy = Math.round(sy);
    if (sx < 0 || sy < 0 || sx >= CW || sy >= CH) return;
    var img = g.getImageData(0, 0, CW, CH);
    var d = img.data;
    var idx = (sy * CW + sx) * 4;
    var tr = d[idx], tg = d[idx + 1], tb = d[idx + 2], ta = d[idx + 3];
    var c = rgb2(state.color);
    var fa = Math.round(state.alpha * 255);
    if (Math.abs(tr - c[0]) < 6 && Math.abs(tg - c[1]) < 6 &&
      Math.abs(tb - c[2]) < 6 && Math.abs(ta - fa) < 6) return;
    var tol = 34;
    function ok(i) {
      return Math.abs(d[i] - tr) <= tol && Math.abs(d[i + 1] - tg) <= tol &&
        Math.abs(d[i + 2] - tb) <= tol && Math.abs(d[i + 3] - ta) <= tol;
    }
    var seen = new Uint8Array(CW * CH);
    var stack = [sy * CW + sx];
    seen[sy * CW + sx] = 1;
    while (stack.length) {
      var p = stack.pop();
      var i = p * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = fa;
      var x = p % CW, y = (p / CW) | 0;
      if (x > 0 && !seen[p - 1] && ok((p - 1) * 4)) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < CW - 1 && !seen[p + 1] && ok((p + 1) * 4)) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && !seen[p - CW] && ok((p - CW) * 4)) { seen[p - CW] = 1; stack.push(p - CW); }
      if (y < CH - 1 && !seen[p + CW] && ok((p + CW) * 4)) { seen[p + CW] = 1; stack.push(p + CW); }
    }
    g.putImageData(img, 0, 0);
  }

  function beginStroke(p) {
    pushUndo();
    state.inkR = null;
    state.used[toolName(state.tool)] = 1;
    if (state.tool === "fill") {
      flood(p.x, p.y);
      state.strokes++;
      updateStatus(); persistImage(); persistState(); scheduleAuto();
      return;
    }
    state.drawing = true;
    state.start = p; state.last = p;
    if (state.tool.indexOf("sh:") === 0) {
      try { state.snap = g.getImageData(0, 0, CW, CH); } catch (e) { state.snap = null; }
      return;
    }
    stroke(p, p);
    state.strokes++;
    updateStatus();
  }
  function abortStroke() {
    state.drawing = false; state.snap = null;
    state.last = null; state.start = null;
  }
  function endStroke(p) {
    if (!state.drawing) return;
    state.drawing = false;
    if (state.tool.indexOf("sh:") === 0 && state.start) {
      shapePreview(state.tool.slice(3), state.start, p);
      state.snap = null;
      state.strokes++;
    }
    state.last = null; state.start = null;
    updateStatus(); persistImage(); persistState(); scheduleAuto();
  }

  function stageCenter() {
    var r = stageWrap.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function pointerCount() {
    var n = 0;
    for (var k in pointers) { if (pointers[k]) n++; }
    return n;
  }
  function startPinch() {
    var ids = Object.keys(pointers).filter(function (k) { return pointers[k]; });
    if (ids.length < 2) { pinchStart = null; return; }
    var a = pointers[ids[0]], b = pointers[ids[1]];
    var o = stageCenter();
    pinchStart = {
      dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      scale: view.scale,
      cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2,
      tx: view.tx, ty: view.ty,
      ox: o.x, oy: o.y
    };
  }
  function updatePinch() {
    var ids = Object.keys(pointers).filter(function (k) { return pointers[k]; });
    if (ids.length < 2 || !pinchStart) return;
    var a = pointers[ids[0]], b = pointers[ids[1]];
    var dist = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    var cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    var s2 = clamp(pinchStart.scale * (dist / pinchStart.dist), 0.4, 8);
    var ratio = s2 / pinchStart.scale;
    view.scale = s2;
    view.tx = cx - pinchStart.ox - (pinchStart.cx - pinchStart.ox - pinchStart.tx) * ratio;
    view.ty = cy - pinchStart.oy - (pinchStart.cy - pinchStart.oy - pinchStart.ty) * ratio;
    applyView();
  }
  function onDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    try { cvs.setPointerCapture(e.pointerId); } catch (err) {}
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (pointerCount() >= 2) {
      abortStroke(); panning = null; startPinch();
      return;
    }
    if (state.tool === "sh:hand") {
      panning = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
      cvs.style.cursor = "grabbing";
      return;
    }
    beginStroke(pos(e));
  }
  function onMove(e) {
    if (!pointers[e.pointerId]) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (pointerCount() >= 2 && pinchStart) { updatePinch(); return; }
    if (panning) {
      view.tx = panning.tx + (e.clientX - panning.x);
      view.ty = panning.ty + (e.clientY - panning.y);
      applyView(); return;
    }
    if (!state.drawing) return;
    e.preventDefault();
    var p = pos(e);
    if (state.tool.indexOf("sh:") === 0) {
      shapePreview(state.tool.slice(3), state.start, p);
      state.last = p; return;
    }
    stroke(state.last || p, p);
    state.last = p;
    updateStatus();
  }
  function onUp(e) {
    if (!pointers[e.pointerId]) return;
    var p = pos(e);
    delete pointers[e.pointerId];
    if (pointerCount() === 0) {
      if (panning) { panning = null; cvs.style.cursor = state.tool === "sh:hand" ? "grab" : "crosshair"; }
      pinchStart = null; endStroke(p); return;
    }
    if (pointerCount() === 1) {
      pinchStart = null; panning = null; abortStroke(); return;
    }
    startPinch();
  }
  function onCancel(e) {
    if (!pointers[e.pointerId]) return;
    delete pointers[e.pointerId];
    if (pointerCount() === 0) {
      if (panning) { panning = null; cvs.style.cursor = state.tool === "sh:hand" ? "grab" : "crosshair"; }
      pinchStart = null; abortStroke();
      persistImage(); persistState(); scheduleAuto();
      return;
    }
    if (pointerCount() === 1) {
      pinchStart = null; panning = null; abortStroke(); return;
    }
    startPinch();
  }
  cvs.addEventListener("pointerdown", onDown);
  cvs.addEventListener("pointermove", onMove);
  cvs.addEventListener("pointerup", onUp);
  cvs.addEventListener("pointercancel", onCancel);
  stageWrap.addEventListener("wheel", function (e) {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });

  btnUndo.onclick = function () {
    var snap = state.undo.pop();
    if (!snap) { ctx.ui.toast("没有可撤销的了"); return; }
    g.putImageData(snap, 0, 0);
    state.strokes = Math.max(0, state.strokes - 1);
    updateStatus(); persistImage(); persistState();
  };
  btnClear.onclick = function () {
    pushUndo();
    g.save();
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, CW, CH);
    g.restore();
    state.strokes = 0;
    KEEP.img = null; KEEP.strokes = 0; KEEP.undo = [];
    updateStatus();
    addMsg("sys", "画布清空了。");
  };
  btnLook.onclick = function () { ask("用户主动让你看看"); };
  function download(url, name) {
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    later(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 200);
  }
  btnOut.onclick = function () {
    if (state.strokes === 0) { ctx.ui.toast("还没画呢"); return; }
    download(cvs.toDataURL("image/png"), "涂鸦-" + Date.now() + ".png");
    ctx.ui.toast("已导出 PNG");
  };
  btnSave.onclick = function () {
    if (state.strokes === 0) { ctx.ui.toast("还没画呢"); return; }
    var url = cvs.toDataURL("image/png");
    var list = KG("gal", []);
    list.push({ id: "g" + Date.now().toString(36), t: Date.now(), url: url });
    if (list.length > 12) list = list.slice(-12);
    KS("gal", list);
    ctx.ui.toast("已存进涂鸦相册");
  };
  function openGallery() {
    ctx.ui.dialog(function (el, dlg) {
      el.style.cssText = "min-width:min(600px,88vw);max-height:70vh;overflow:auto;";
      var list = KG("gal", []).slice().reverse();
      el.appendChild(mk("div", "pk-h", "▤ 涂鸦相册（" + list.length + " / 12）"));
      if (!list.length) {
        el.appendChild(mk("div", "pk-sys", "还没有作品。画一张，然后点「存册」。"));
        return;
      }
      var grid = mk("div", "pk-gal");
      list.forEach(function (item) {
        var card = mk("div", "pk-gc");
        var im = mk("img"); im.src = item.url; im.title = "点击导出这张";
        im.onclick = function () { download(item.url, "涂鸦-" + item.t + ".png"); };
        card.appendChild(im);
        card.appendChild(mk("b", null, new Date(item.t).toLocaleString()));
        var x = mk("button", "pk-gx", "✕");
        x.type = "button";
        x.onclick = function () {
          KS("gal", KG("gal", []).filter(function (v) { return v.id !== item.id; }));
          dlg.close(); later(openGallery, 60);
        };
        card.appendChild(x); grid.appendChild(card);
      });
      el.appendChild(grid);
    });
  }
  btnGal.onclick = openGallery;

  renderAssets();
  renderChars();
  restore();
  selectTool(state.tool);
  setColor(state.color);
  updateStatus();
  switchTab(KEEP.tab || "brush");
  layout();
  applyView();
  sizeIn.value = String(state.size);
  sizeLab.textContent = "笔尖 " + state.size + " px";
  alphaIn.value = String(Math.round(state.alpha * 100));
  alphaLab.textContent = "不透明度 " + Math.round(state.alpha * 100) + "%";

  if (KEEP.log.length) {
    chatList.innerHTML = "";
    KEEP.log.forEach(renderMsg);
  }

  var resizeTimer = null;
  function onResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { resizeTimer = null; layout(); }, 180);
  }
  function onOrient() {
    setTimeout(onResize, 60);
    setTimeout(onResize, 300);
  }
  try {
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onOrient);
  } catch (e) {}

  if (!chars.length) addMsg("sys", "还没有可选角色，先去小手机建一个吧。");
  else if (!KEEP.img && !KEEP.log.length) addMsg("sys", "画点什么吧，ta 会看着你的每一笔。");

  return function () {
    try {
      KEEP.img = g.getImageData(0, 0, CW, CH);
      KEEP.strokes = state.strokes;
      KEEP.undo = state.undo.slice(-2);
    } catch (e) {}
    persistState();
    if (autoTimer) clearTimeout(autoTimer);
    if (saveTimer) clearTimeout(saveTimer);
    if (resizeTimer) clearTimeout(resizeTimer);
    if (guardId) clearInterval(guardId);
    timers.forEach(function (t) {
      try { clearTimeout(t); } catch (e) {}
      try { clearInterval(t); } catch (e) {}
    });
    timers.length = 0;
    pointers = {};
    try { window.removeEventListener("resize", onResize); } catch (e) {}
    try { window.removeEventListener("orientationchange", onOrient); } catch (e) {}
  };
}

export default {
  manifest: {
    id: "puff-y2k-paint",
    name: "涂鸦小站",
    engine: "puff",
    apiVersion: 1,
    version: "1.8.0",
    author: "",
    description: "Y2K 像素风绘画 App：竖屏自动旋转成横屏界面，13 种笔刷 + 12 种素材笔 + 导入图片，双指缩放画布，内置角色实时吐槽，画布/工具/角色状态全恢复，可导出、存涂鸦相册",
    permissions: ["读取角色人设", "调用模型生成吐槽", "本地保存作品"],
    app: { name: "涂鸦小站", letter: "画" },
    settings: [
      { key: "auto", label: "停笔后自动吐槽", type: "boolean", default: true, description: "关掉后只有点「让 ta 看」才会说话" },
      { key: "gap", label: "自动吐槽间隔（秒）", type: "number", default: 14, description: "停笔多久后角色开口，最短 5 秒" },
      { key: "len", label: "吐槽字数上限", type: "number", default: 60, description: "控制角色一次说多长" }
    ]
  },
  setup: function (ctx) {
    return ctx.ui.appPage(function (el, api) {
      return mount(ctx, el, api);
    });
  }
};