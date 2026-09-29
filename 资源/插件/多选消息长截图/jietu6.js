export default {
  manifest: {
    id: "puff-long-shot",
    name: "长截图 v1.5",
    engine: "puff",
    apiVersion: 1,
    version: "1.5.0",
    description: "长按气泡点「截图」，点选消息，按你自己的气泡装扮生成长截图；出图后用手机自带的长截屏保存",
    permissions: ["读取当前对话消息", "读取聊天界面的样式"],
  },

  setup(ctx) {
    let curSid = "";
    ctx.watch("thread.open", function (p) { if (p && p.sessionId) curSid = p.sessionId; });

    /* ================= 基础工具 ================= */
    const FALLBACK_FONT = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
    function esc(s) { return String(s == null ? "" : s); }
    function px(v, d) { const n = parseFloat(v); return isNaN(n) ? d : n; }
    function isImg(m) { return ["image", "sticker", "emoji", "photo"].indexOf(m.mediaType) >= 0; }
    function plain(m) {
      if (isImg(m)) return "[图片]";
      if (m.mediaType === "voice") return "[语音] " + esc(m.content);
      if (m.mediaType && m.mediaType !== "text") return "[" + m.mediaType + "] " + esc(m.content);
      return esc(m.content);
    }
    function who(m, th) {
      if (m.role === "user") return { name: m.senderName || m.name || "我", avatar: m.avatar || m.senderAvatar || "" };
      let name = m.senderName || m.name || m.speaker || m.characterName || "";
      let avatar = m.avatar || m.senderAvatar || "";
      if (!name || !avatar) {
        try {
          const cid = m.characterId || (th && th.characterId);
          const p = cid ? ctx.personas.get(cid) : null;
          if (p) { name = name || p.name; avatar = avatar || p.avatar; }
        } catch (e) {}
      }
      return { name: name || "对方", avatar: avatar };
    }
    function loadImg(src) {
      return new Promise(function (r) {
        if (!src) return r(null);
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = function () { r(i); };
        i.onerror = function () { r(null); };
        i.src = src;
      });
    }
    async function getMedia(m) {
      try {
        let r = await ctx.rows.media(m);
        if (!r) return null;
        if (typeof r !== "string") r = URL.createObjectURL(r);
        return r;
      } catch (e) { return null; }
    }
    function rr4(g, x, y, w, h, r) {
      const m = Math.min(w, h) / 2;
      const a = Math.min(r[0], m), b = Math.min(r[1], m), c = Math.min(r[2], m), d = Math.min(r[3], m);
      g.beginPath();
      g.moveTo(x + a, y);
      g.lineTo(x + w - b, y); g.arcTo(x + w, y, x + w, y + b, b);
      g.lineTo(x + w, y + h - c); g.arcTo(x + w, y + h, x + w - c, y + h, c);
      g.lineTo(x + d, y + h); g.arcTo(x, y + h, x, y + h - d, d);
      g.lineTo(x, y + a); g.arcTo(x, y, x + a, y, a);
      g.closePath();
    }
    function setFont(g, size, family) {
      g.font = size + "px " + (family || FALLBACK_FONT);
      if (/^10px/.test(g.font) && size !== 10) g.font = size + "px " + FALLBACK_FONT;
    }
    function wrap(g, text, max) {
      const out = [];
      String(text).split("\n").forEach(function (para) {
        let line = "";
        Array.from(para).forEach(function (ch) {
          if (g.measureText(line + ch).width > max && line) { out.push(line); line = ch; }
          else line += ch;
        });
        out.push(line);
      });
      return out;
    }
    function blobToDataURL(blob) {
      return new Promise(function (res, rej) {
        const fr = new FileReader();
        fr.onload = function () { res(fr.result); };
        fr.onerror = function () { rej(fr.error); };
        fr.readAsDataURL(blob);
      });
    }
    function parseRGB(s) {
      const m = /rgba?\(([^)]+)\)/.exec(s || "");
      if (!m) return null;
      const p = m[1].split(",").map(function (x) { return parseFloat(x); });
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    function lum(c) { return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; }

    /* ================= 读取用户的装扮 / 气泡 CSS ================= */
    // 通过 bubble.meta 拿到每个气泡旁边的真实元素，读它的计算样式（每个用户各不相同）
    const cap = { user: null, assistant: null, name: null };
    try {
      const old = ctx.kit.kv.get("cap");
      if (old) { cap.user = old.user || null; cap.assistant = old.assistant || null; cap.name = old.name || null; }
    } catch (e) {}

    function grabStyles(el, props) {
      try {
        const m = props && props.message;
        if (!m || isImg(m) || (m.mediaType && m.mediaType !== "text")) return;
        const role = m.role === "user" ? "user" : m.role === "assistant" ? "assistant" : null;
        if (!role) return;
        const snippet = String(m.content || "").trim().slice(0, 6);
        if (!snippet) return;
        let scope = el.parentElement, body = null;
        for (let up = 0; up < 3 && scope && !body; up++, scope = scope.parentElement) {
          let best = null, bestLen = 1e9;
          scope.querySelectorAll("*").forEach(function (n) {
            if (n === el || el.contains(n)) return;
            const t = n.textContent || "";
            if (t.indexOf(snippet) < 0 || t.length >= bestLen) return;
            const cs = getComputedStyle(n);
            const c = parseRGB(cs.backgroundColor);
            if ((c && c.a > 0.05) || (cs.backgroundImage && cs.backgroundImage !== "none")) { best = n; bestLen = t.length; }
          });
          body = best;
        }
        if (!body) return;
        const cs = getComputedStyle(body);
        const rad = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(function (v) { return px(v, 10); });
        cap[role] = {
          bg: cs.backgroundColor, bgImage: cs.backgroundImage, color: cs.color, radius: rad,
          fontFamily: cs.fontFamily, size: px(cs.fontSize, 15),
          lh: cs.lineHeight === "normal" ? 0 : px(cs.lineHeight, 0),
          padX: px(cs.paddingLeft, 10), padY: px(cs.paddingTop, 8),
          border: px(cs.borderTopWidth, 0), borderColor: cs.borderTopColor,
        };
        // 昵称样式
        const nm = who(m, ctx.threads.get(m.sessionId || curSid)).name;
        const holder = body.parentElement && body.parentElement.parentElement ? body.parentElement.parentElement : body.parentElement;
        if (holder && nm) {
          const leaves = holder.querySelectorAll("*");
          for (let i = 0; i < leaves.length; i++) {
            const n = leaves[i];
            if (n.children.length === 0 && (n.textContent || "").trim() === nm) {
              const ns = getComputedStyle(n);
              cap.name = { color: ns.color, size: px(ns.fontSize, 12) };
              break;
            }
          }
        }
        ctx.kit.kv.set("cap", cap);
      } catch (e) { ctx.kit.log("读取样式失败", e); }
    }
    ctx.ui.place("bubble.meta", function (el, props) {
      el.style.cssText = "display:none;";
      ctx.kit.later(function () { grabStyles(el, props); }, 80);
    });

    /* ================= 日夜间兜底 ================= */
    function readHostDark() {
      try {
        if (typeof window.dark !== "undefined") {
          const d = window.dark;
          if (typeof d === "boolean") return d;
          if (typeof d === "function") { try { const r = d(); if (typeof r === "boolean") return r; } catch (e) {} }
          if (d && typeof d === "object") {
            if (typeof d.value === "boolean") return d.value;
            if (typeof d.isDark === "boolean") return d.isDark;
          }
        }
        const cfg = window.__PUFF_CONFIG__;
        if (cfg && typeof cfg === "object") {
          if (typeof cfg.dark === "boolean") return cfg.dark;
          if (typeof cfg.theme === "string") { if (/dark/i.test(cfg.theme)) return true; if (/light/i.test(cfg.theme)) return false; }
        }
      } catch (e) {}
      return null;
    }
    function detectDark() {
      try {
        const hostDark = readHostDark();
        if (hostDark !== null) return hostDark;
        const de = document.documentElement, bd = document.body;
        const cls = [de.className, bd && bd.className, de.getAttribute("data-theme"), bd && bd.getAttribute("data-theme"), de.getAttribute("data-mode"), bd && bd.getAttribute("data-mode")].join(" ").toLowerCase();
        if (/(^|[^a-z])(dark|night)([^a-z]|$)/.test(cls)) return true;
        if (/(^|[^a-z])(light|day)([^a-z]|$)/.test(cls)) return false;
        const cands = [bd, bd && bd.firstElementChild, document.getElementById("root"), document.getElementById("app"), de];
        for (let i = 0; i < cands.length; i++) {
          if (!cands[i]) continue;
          const c = parseRGB(getComputedStyle(cands[i]).backgroundColor);
          if (c && c.a > 0.5) return lum(c) < 128;
        }
        const tc = bd ? parseRGB(getComputedStyle(bd).color) : null;
        if (tc) return lum(tc) > 170;
        return !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
      } catch (e) { return false; }
    }
    function palette(dark) {
      return dark
        ? { bg: "#1c1c1e", panel: "#26262a", other: "#2c2c2e", me: "#3a7d44", text: "#f2f2f2", meText: "#ffffff", sub: "#8e8e93", line: "#3a3a3c", btn: "#3a3a3c", sys: "#8e8e93", mark: "#6b6b70", av1: "#6a55b5", av2: "#3f6fb5" }
        : { bg: "#f4f5f7", panel: "#ffffff", other: "#ffffff", me: "#95ec69", text: "#111111", meText: "#111111", sub: "#888888", line: "#eeeeee", btn: "#f0f1f3", sys: "#999999", mark: "#a8a8ad", av1: "#c9a7ff", av2: "#7fb6ff" };
    }
    function styleFor(role, P) {
      const c = role === "user" ? cap.user : cap.assistant;
      const right = role === "user";
      if (c) return c;
      return { bg: right ? P.me : P.other, bgImage: "none", color: right ? P.meText : P.text, radius: [10, 10, 10, 10], fontFamily: FALLBACK_FONT, size: 15, lh: 21, padX: 10, padY: 8, border: 0, borderColor: "transparent" };
    }
    function fillBubble(g, S, x, y, w, h) {
      rr4(g, x, y, w, h, S.radius);
      const stops = String(S.bgImage || "").indexOf("gradient") >= 0 ? (S.bgImage.match(/rgba?\([^)]+\)/g) || []) : [];
      if (stops.length >= 2) {
        const gr = g.createLinearGradient(x, y, x + w, y + h);
        stops.forEach(function (s, i) { gr.addColorStop(i / (stops.length - 1), s); });
        g.fillStyle = gr; g.fill();
      } else {
        const c = parseRGB(S.bg);
        if (c && c.a > 0) { g.fillStyle = S.bg; g.fill(); }
      }
      if (S.border > 0) { g.lineWidth = S.border; g.strokeStyle = S.borderColor; g.stroke(); }
    }

    /* ================= 生成长图 ================= */
    async function build(msgs, th, opt, dark) {
      const P = palette(dark);
      const W = Math.max(320, Math.min(window.innerWidth || 390, 480));
      const PAD = 12, ROWGAP = 14, NAMEH = 16, MARK_H = 32;
      const AV = opt.hideAvatar ? 0 : 36;
      const GAP = opt.hideAvatar ? 0 : 8;
      let scale = 2;
      const nameColor = cap.name ? cap.name.color : P.sub;
      const nameSize = cap.name ? cap.name.size : 12;

      const mc = document.createElement("canvas").getContext("2d");
      const items = [];
      for (const m of msgs) {
        const it = { m: m, side: m.role === "user" ? "r" : "l" };
        if (m.role === "system") {
          it.kind = "sys";
          setFont(mc, 12);
          it.lines = wrap(mc, plain(m), W - 80);
          it.h = it.lines.length * 17 + 6;
          items.push(it);
          continue;
        }
        const S = styleFor(m.role, P);
        it.S = S;
        it.LH = S.lh || Math.round(S.size * 1.45);
        const w = who(m, th);
        it.name = w.name;
        it.avatarImg = opt.hideAvatar ? null : await loadImg(w.avatar);
        it.letter = Array.from(w.name || "?")[0];
        let bh, bw;
        if (isImg(m)) {
          const im = await loadImg(await getMedia(m));
          if (im) {
            const r = Math.min(180 / im.width, 260 / im.height, 1);
            it.kind = "img"; it.img = im;
            bw = Math.max(40, Math.round(im.width * r));
            bh = Math.max(40, Math.round(im.height * r));
          }
        }
        if (!it.kind) {
          it.kind = "text";
          setFont(mc, S.size, S.fontFamily);
          it.lines = wrap(mc, plain(m), W - PAD * 2 - AV - GAP - 44 - S.padX * 2);
          let mw = 0;
          it.lines.forEach(function (l) { mw = Math.max(mw, mc.measureText(l).width); });
          bw = Math.max(40, Math.ceil(mw) + S.padX * 2);
          bh = it.lines.length * it.LH + S.padY * 2;
        }
        it.bw = bw; it.bh = bh;
        it.h = Math.max(AV, (opt.hideName ? 0 : NAMEH) + bh);
        items.push(it);
      }

      let H = PAD;
      items.forEach(function (it) { H += it.h + ROWGAP; });
      H += MARK_H - ROWGAP;
      while (H * scale > 15000 && scale > 1) scale -= 0.5;

      const cv = document.createElement("canvas");
      cv.width = Math.round(W * scale);
      cv.height = Math.round(H * scale);
      const g = cv.getContext("2d");
      g.scale(scale, scale);

      // 背景固定跟日夜间走
      g.fillStyle = P.bg;
      g.fillRect(0, 0, W, H);
      g.textBaseline = "top";

      let y = PAD;
      items.forEach(function (it) {
        if (it.kind === "sys") {
          setFont(g, 12); g.fillStyle = P.sys; g.textAlign = "center";
          it.lines.forEach(function (l, i) { g.fillText(l, W / 2, y + 3 + i * 17); });
          g.textAlign = "left";
          y += it.h + ROWGAP;
          return;
        }
        const right = it.side === "r";
        if (!opt.hideAvatar) {
          const ax = right ? W - PAD - AV : PAD;
          g.save();
          g.beginPath(); g.arc(ax + AV / 2, y + AV / 2, AV / 2, 0, Math.PI * 2); g.clip();
          if (it.avatarImg) g.drawImage(it.avatarImg, ax, y, AV, AV);
          else {
            g.fillStyle = right ? P.av2 : P.av1;
            g.fillRect(ax, y, AV, AV);
            g.fillStyle = "#fff"; setFont(g, 16); g.textAlign = "center";
            g.fillText(it.letter, ax + AV / 2, y + AV / 2 - 9);
            g.textAlign = "left";
          }
          g.restore();
        }
        const bx = right ? W - PAD - AV - GAP - it.bw : PAD + AV + GAP;
        let by = y;
        if (!opt.hideName) {
          setFont(g, nameSize); g.fillStyle = nameColor;
          const nw = g.measureText(it.name).width;
          g.fillText(it.name, right ? bx + it.bw - nw : bx, y + 1);
          by = y + NAMEH;
        }
        if (it.kind === "img") {
          g.save(); rr4(g, bx, by, it.bw, it.bh, [8, 8, 8, 8]); g.clip();
          g.drawImage(it.img, bx, by, it.bw, it.bh); g.restore();
        } else {
          fillBubble(g, it.S, bx, by, it.bw, it.bh);
          g.fillStyle = it.S.color; setFont(g, it.S.size, it.S.fontFamily);
          it.lines.forEach(function (l, i) { g.fillText(l, bx + it.S.padX, by + it.S.padY + i * it.LH + Math.max(0, (it.LH - it.S.size) / 2 - 1)); });
        }
        y += it.h + ROWGAP;
      });

      // 右下角水印
      setFont(g, 11); g.textAlign = "right";
      g.fillStyle = P.mark; g.fillText("以上聊天内容来源 Puff", W - PAD, H - 22);
      g.textAlign = "left";

      return await new Promise(function (res, rej) {
        try { cv.toBlob(function (b) { b ? res(b) : rej(new Error("toBlob 失败（背景图可能跨域）")); }, "image/png"); }
        catch (e) { rej(e); }
      });
    }

    /* ================= 成品页（占满屏幕，右上角小叉关闭；保存请用手机自带长截屏） ================= */
    function showResult(blob, dark) {
      const P = palette(dark);
      blobToDataURL(blob).then(function (dataUrl) {
        ctx.ui.dialog(function (el, api) {
          const root = document.createElement("div");
          root.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;box-sizing:border-box;overflow:auto;background:" + P.bg + ";padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);";
          const im = document.createElement("img");
          im.src = dataUrl;
          im.style.cssText = "display:block;width:100%;";
          im.style.setProperty("-webkit-touch-callout", "default", "important");
          im.style.setProperty("-webkit-user-select", "auto", "important");
          im.style.setProperty("user-select", "auto", "important");
          const x = document.createElement("button");
          x.textContent = "\u00d7";
          x.style.cssText = "position:fixed;top:calc(env(safe-area-inset-top,0px) + 10px);right:10px;width:34px;height:34px;line-height:32px;border-radius:50%;border:0;background:rgba(0,0,0,.4);color:#fff;font-size:22px;text-align:center;z-index:10;";
          x.onclick = function () { api.close(); };
          root.appendChild(im);
          root.appendChild(x);
          el.appendChild(root);
        });
      });
    }


    /* ================= 选择页 ================= */
    async function openPicker(msg, helpers) {
      const sid = msg.sessionId || curSid;
      if (!sid) { helpers.toast("找不到当前对话"); return; }
      let list = [];
      try { list = (await ctx.rows.list(sid)) || []; } catch (e) {}
      list = list.slice(-500);
      if (!list.length) { helpers.toast("没有消息"); return; }
      const th = ctx.threads.get(sid);
      const dark = detectDark();
      const P = palette(dark);
      let saved = {};
      try { saved = ctx.kit.kv.get("opts") || {}; } catch (e) {}
      const opt = { hideName: !!saved.hideName, hideAvatar: !!saved.hideAvatar };
      let start = list.findIndex(function (m) { return m.id === msg.id; });
      if (start < 0) start = list.length - 1;
      const sel = new Set([start]);
      const gotBubble = !!(cap.user || cap.assistant);

      ctx.ui.dialog(function (el, api) {
        const root = document.createElement("div");
        root.style.cssText = "width:min(94vw,520px);height:min(90vh,780px);display:flex;flex-direction:column;background:" + P.panel + ";color:" + P.text + ";border-radius:14px;overflow:hidden;";
        const top = document.createElement("div");
        top.style.cssText = "padding:10px 14px;border-bottom:1px solid " + P.line + ";display:flex;justify-content:space-between;align-items:center;";
        const t = document.createElement("div");
        t.innerHTML = "<div style='font-size:15px;font-weight:600'>截图</div><div style='font-size:11px;opacity:.6'>点选要截的消息（可多选）· 样式：" +
          (gotBubble ? "已跟随你的气泡装扮" : "默认" + (dark ? "夜间" : "日间")) + "</div>";
        const clr = document.createElement("button");
        clr.textContent = "清空选择";
        clr.style.cssText = "border:0;background:none;font-size:14px;color:#3a7bd5;";
        top.appendChild(t); top.appendChild(clr);

        const sc = document.createElement("div");
        sc.style.cssText = "flex:1;overflow:auto;background:" + P.bg + ";";
        const rows = [];
        list.forEach(function (m, i) {
          const w = m.role === "system" ? { name: "" } : who(m, th);
          const row = document.createElement("div");
          row.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 10px;";
          const dot = document.createElement("div");
          dot.style.cssText = "flex:none;width:20px;height:20px;border-radius:50%;border:1.5px solid " + P.sub + ";box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;";
          const body = document.createElement("div");
          body.style.cssText = "flex:1;min-width:0;display:flex;flex-direction:column;align-items:" + (m.role === "user" ? "flex-end" : "flex-start") + ";";
          if (w.name) {
            const n = document.createElement("div");
            n.textContent = w.name;
            n.style.cssText = "font-size:11px;color:" + P.sub + ";margin-bottom:2px;";
            body.appendChild(n);
          }
          const bub = document.createElement("div");
          const txt = plain(m);
          bub.textContent = txt.length > 120 ? txt.slice(0, 120) + "…" : txt;
          bub.style.cssText = "max-width:80%;padding:6px 10px;border-radius:10px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-break:break-all;background:" + (m.role === "user" ? P.me : P.other) + ";color:" + (m.role === "user" ? P.meText : P.text) + ";";
          body.appendChild(bub);
          row.appendChild(dot); row.appendChild(body);
          row.onclick = function () { if (sel.has(i)) sel.delete(i); else sel.add(i); paint(); };
          sc.appendChild(row);
          rows.push({ row: row, dot: dot });
        });

        const bar = document.createElement("div");
        bar.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:10px 12px;border-top:1px solid " + P.line + ";background:" + P.panel + ";";
        const cnt = document.createElement("div");
        cnt.style.cssText = "font-size:12px;color:" + P.sub + ";width:100%;";
        function check(label, key) {
          const lab = document.createElement("label");
          lab.style.cssText = "display:flex;align-items:center;gap:4px;font-size:14px;";
          const cb = document.createElement("input");
          cb.type = "checkbox"; cb.checked = opt[key];
          cb.onchange = function () {
            opt[key] = cb.checked;
            try { ctx.kit.kv.set("opts", { hideName: opt.hideName, hideAvatar: opt.hideAvatar }); } catch (e) {}
          };
          lab.appendChild(cb); lab.appendChild(document.createTextNode(label));
          bar.appendChild(lab);
        }
        bar.appendChild(cnt);
        check("隐藏昵称", "hideName");
        check("隐藏头像", "hideAvatar");
        const sp = document.createElement("div"); sp.style.flex = "1"; bar.appendChild(sp);
        const cancel = document.createElement("button");
        cancel.textContent = "取消";
        cancel.style.cssText = "border:0;background:" + P.btn + ";border-radius:999px;padding:9px 16px;font-size:14px;color:" + P.text + ";";
        cancel.onclick = function () { api.close(); };
        const ok = document.createElement("button");
        ok.textContent = "完成";
        ok.style.cssText = "border:0;background:#2f7cf6;color:#fff;border-radius:999px;padding:9px 22px;font-size:14px;";
        ok.onclick = async function () {
          if (!sel.size) { ctx.ui.toast("先点选要截的消息"); return; }
          ok.disabled = true; ok.textContent = "生成中…";
          try {
            const picked = Array.from(sel).sort(function (p, q) { return p - q; }).map(function (i) { return list[i]; });
            const blob = await build(picked, th, opt, dark);
            api.close();
            showResult(blob, dark);
          } catch (e) {
            ok.disabled = false; ok.textContent = "完成";
            ctx.kit.log("截图失败", e);
            ctx.ui.toast("生成失败：" + (e && e.message ? e.message : e));
          }
        };
        bar.appendChild(cancel); bar.appendChild(ok);

        function paint() {
          rows.forEach(function (r, i) {
            const on = sel.has(i);
            r.row.style.background = on ? "rgba(47,124,246,.14)" : "transparent";
            r.dot.style.background = on ? "#2f7cf6" : "transparent";
            r.dot.style.borderColor = on ? "#2f7cf6" : P.sub;
            r.dot.textContent = on ? "✓" : "";
          });
          cnt.textContent = sel.size ? "已选 " + sel.size + " 条（按聊天顺序排列）" : "未选择";
        }
        clr.onclick = function () { sel.clear(); paint(); };

        root.appendChild(top); root.appendChild(sc); root.appendChild(bar);
        el.appendChild(root);
        paint();
        ctx.kit.later(function () { if (rows[start]) rows[start].row.scrollIntoView({ block: "center" }); }, 60);
      });
    }

    ctx.ui.bubbleMenu({
      id: "long-shot",
      label: "截图",
      onSelect: function (msg, helpers) { openPicker(msg, helpers); },
    });
  },
};
