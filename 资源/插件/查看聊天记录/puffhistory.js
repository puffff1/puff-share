export default {
  manifest: {
    id: "puff-paged-history",
    name: "分页历史",
    engine: "puff",
    apiVersion: 1,
    version: "1.1.0",
    description: "一次只看 20 条历史消息，点一下再往前看 20 条，不再一口气渲染几千条。入口在输入框上方、对话设置页顶部、长按气泡菜单。双击分页里的消息，可跳回聊天页里那一条。",
    settings: [
      { key: "pageSize", label: "每次加载条数", type: "number", default: 20, description: "5～200" },
      { key: "keepMax", label: "窗口里最多同时保留几条", type: "number", default: 200, description: "超过会把另一头的自动收起，保持流畅" },
      { key: "showRail", label: "输入框上方显示入口", type: "boolean", default: true },
      { key: "showPanel", label: "对话设置页显示入口", type: "boolean", default: true },
      { key: "showMenu", label: "长按气泡显示「从这条往前翻」", type: "boolean", default: true },
    ],
  },

  setup(ctx) {
    ctx.ui.css(`
.pph-box{--bg:#ffffff;--fg:#1c1c1e;--sub:rgba(60,60,67,.6);--line:rgba(60,60,67,.12);--me:#dfe9f7;--ta:#f1f1f3;--btn:rgba(60,60,67,.08);
  width:min(92vw,520px);height:min(82vh,760px);display:flex;flex-direction:column;background:var(--bg);color:var(--fg);
  border-radius:18px;overflow:hidden;font-size:14px;box-sizing:border-box;}
@media (prefers-color-scheme:dark){.pph-box{--bg:#1a1a1c;--fg:#ececee;--sub:rgba(235,235,245,.5);--line:rgba(235,235,245,.1);--me:#2a3546;--ta:#262628;--btn:rgba(235,235,245,.1);}}
.pph-head{display:flex;align-items:center;gap:6px;padding:12px 12px 10px 16px;border-bottom:1px solid var(--line);}
.pph-title{font-weight:600;font-size:15px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pph-count{font-size:12px;color:var(--sub);padding:6px 16px;border-bottom:1px solid var(--line);}
.pph-btn{border:0;background:var(--btn);color:inherit;border-radius:999px;padding:6px 12px;font:inherit;font-size:12px;cursor:pointer;}
.pph-btn:disabled{opacity:.55;cursor:default;}
.pph-btn.on{background:var(--fg);color:var(--bg);}
.pph-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:6px 12px 10px;}
.pph-more{display:block;margin:10px auto;}
.pph-row{display:flex;flex-direction:column;align-items:flex-start;margin:10px 0;max-width:86%;}
.pph-row.me{margin-left:auto;align-items:flex-end;}
.pph-row.sys{max-width:100%;align-items:center;margin:6px 0;}
.pph-meta{font-size:11px;color:var(--sub);margin:0 4px 3px;}
.pph-bub{padding:8px 12px;border-radius:14px;background:var(--ta);white-space:pre-wrap;word-break:break-word;line-height:1.55;}
.pph-row.me .pph-bub{background:var(--me);}
.pph-row.sys .pph-bub{background:transparent;color:var(--sub);font-size:12px;padding:2px 4px;text-align:center;}
.pph-bub img{max-width:100%;border-radius:10px;display:block;margin-top:6px;}
.pph-row{-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;}
.pph-row.pph-tap .pph-bub{filter:brightness(1.25);}
.pph-confirm{height:auto;padding:18px 18px 14px;gap:14px;line-height:1.6;}
.pph-confirm-acts{display:flex;justify-content:flex-end;gap:8px;}
.pph-mark{display:block;height:0;margin:0;padding:0;overflow:hidden;}
@keyframes pph-flash{0%,30%{box-shadow:0 0 0 3px rgba(255,214,120,.9);background-color:rgba(255,214,120,.18);}100%{box-shadow:0 0 0 3px rgba(255,214,120,0);background-color:transparent;}}
.pph-flash{animation:pph-flash 2s ease-out;border-radius:14px;}
.pph-chip{border:0;background:rgba(127,127,127,.2);color:inherit;border-radius:999px;padding:4px 11px;font:inherit;font-size:12px;cursor:pointer;}
`);

    const LABELS = {
      image: "[图片]", sticker: "[表情]", voice: "[语音]", video: "[视频]",
      file: "[文件]", location: "[位置]", transfer: "[转账]", redpacket: "[红包]",
    };

    function mk(tag, cls) {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      return n;
    }
    function safe(fn) {
      try { return fn(); } catch (e) { return null; }
    }
    function num(key, def, min, max) {
      const n = Math.floor(Number(ctx.kit.prefs.get(key)));
      return Number.isFinite(n) && n >= min && n <= max ? n : def;
    }
    function tsOf(m) {
      let v = m && (m.createdAt ?? m.timestamp ?? m.time ?? m.ts ?? m.sentAt);
      if (v == null) return 0;
      if (typeof v === "string") v = /^\d+$/.test(v) ? Number(v) : Date.parse(v);
      if (!Number.isFinite(v)) return 0;
      return v < 1e12 ? v * 1000 : v;
    }
    function pad(n) { return n < 10 ? "0" + n : String(n); }
    function fmtTime(t) {
      if (!t) return "";
      const d = new Date(t);
      const now = new Date();
      const hm = pad(d.getHours()) + ":" + pad(d.getMinutes());
      const md = pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      return d.getFullYear() === now.getFullYear() ? md + " " + hm : d.getFullYear() + "-" + md + " " + hm;
    }

    // ===== 跳回原聊天页 =====
    // 在原页面每个气泡里埋一个看不见的标记，用来定位
    ctx.ui.place("bubble.meta", (el, props) => {
      const msg = props && props.message;
      el.className = "pph-mark";
      if (msg && msg.id != null) el.setAttribute("data-pph-id", String(msg.id));
    });

    function findMarker(id) {
      if (id == null) return null;
      const v = String(id).replace(/["\\]/g, "\\$&");
      return document.querySelector('[data-pph-id="' + v + '"]');
    }

    function flashAt(marker) {
      marker.scrollIntoView({ block: "center" });
      const target = marker.parentElement || marker;
      target.classList.remove("pph-flash");
      void target.offsetWidth;
      target.classList.add("pph-flash");
      // 图片等加载完布局会动，再校正一次
      ctx.kit.later(function () {
        if (document.contains(marker)) marker.scrollIntoView({ block: "center" });
      }, 450);
      ctx.kit.later(function () { target.classList.remove("pph-flash"); }, 2100);
    }

    function findOlderButton() {
      const nodes = document.querySelectorAll("button,[role=button],a,div,span");
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.children.length > 2 || (n.closest && n.closest(".pph-box"))) continue;
        const t = (n.textContent || "").trim();
        if (t.length < 30 && t.indexOf("查看更早") !== -1) return n;
      }
      return null;
    }

    function loadAndJump(id) {
      const tip = ctx.ui.toast("正在加载更早的消息…", { durationMs: 0 });
      let tries = 0, lastBtn = null, lastAt = 0;
      const stop = ctx.kit.every(function () {
        tries++;
        const found = findMarker(id);
        if (found) { stop(); tip.close(); flashAt(found); return; }
        const b = findOlderButton();
        const now = Date.now();
        if (b && (b !== lastBtn || now - lastAt > 2500)) {
          lastBtn = b; lastAt = now;
          try { b.click(); } catch (e) {}
        }
        if (tries > 60) {
          stop(); tip.close();
          ctx.ui.toast("没能跳到这条，可以在聊天页手动往上翻");
        }
      }, 400);
    }

    function jumpTo(msg, close) {
      close();
      ctx.kit.later(function () {
        const marker = findMarker(msg.id);
        if (marker) { flashAt(marker); return; }
        if (!findOlderButton()) {
          ctx.ui.toast("聊天页里找不到这条。请在聊天页（不是设置页）打开分页再双击");
          return;
        }
        ctx.ui.dialog(function (el, api) {
          const done = api && api.close ? api.close : function () {};
          const box = mk("div", "pph-box pph-confirm");
          const p = mk("div");
          p.textContent = "这条消息在聊天页还没加载出来。要先加载更早的消息再跳过去吗？消息很多时会卡几秒。";
          const acts = mk("div", "pph-confirm-acts");
          const no = mk("button", "pph-btn"); no.type = "button"; no.textContent = "算了";
          const yes = mk("button", "pph-btn on"); yes.type = "button"; yes.textContent = "加载并跳转";
          no.onclick = done;
          yes.onclick = function () { done(); loadAndJump(msg.id); };
          acts.append(no, yes);
          box.append(p, acts);
          el.innerHTML = "";
          el.appendChild(box);
        });
      }, 150);
    }

    async function openViewer(sessionId, anchorId) {
      if (!sessionId) { ctx.ui.toast("先打开一个对话"); return; }

      let all = null;
      try { all = await Promise.resolve(ctx.rows.list(sessionId)); }
      catch (e) { ctx.kit.log("rows.list 失败", e); }
      all = Array.isArray(all) ? all.slice() : [];
      if (!all.length) { ctx.ui.toast("这个对话还没有消息"); return; }

      // 确保从旧到新排列
      if (all.length > 1) {
        const a = tsOf(all[0]), b = tsOf(all[all.length - 1]);
        if (a && b && a > b) all.reverse();
      }

      const th = safe(() => ctx.threads.get(sessionId));
      const persona = th && th.characterId ? safe(() => ctx.personas.get(th.characterId)) : null;
      const otherName = (persona && persona.name) || (th && th.title) || "对方";
      const size = num("pageSize", 20, 5, 200);
      const keepMax = Math.max(size * 2, num("keepMax", 200, 20, 2000));

      ctx.ui.dialog((el, api) => {
        const close = api && api.close ? api.close : function () {};
        let lo = 0, hi = 0;

        const box = mk("div", "pph-box");
        const head = mk("div", "pph-head");
        const title = mk("div", "pph-title");
        title.textContent = (th && th.title) || otherName;
        const btnLatest = mk("button", "pph-btn");
        btnLatest.type = "button";
        btnLatest.textContent = "最新";
        const btnEarliest = mk("button", "pph-btn");
        btnEarliest.type = "button";
        btnEarliest.textContent = "最早";
        const btnClose = mk("button", "pph-btn");
        btnClose.type = "button";
        btnClose.textContent = "关闭";
        btnClose.onclick = close;
        head.append(title, btnLatest, btnEarliest, btnClose);

        const count = mk("div", "pph-count");
        const scroll = mk("div", "pph-scroll");
        const topBtn = mk("button", "pph-btn pph-more");
        topBtn.type = "button";
        const rows = mk("div");
        const botBtn = mk("button", "pph-btn pph-more");
        botBtn.type = "button";
        scroll.append(topBtn, rows, botBtn);
        box.append(head, count, scroll);
        el.innerHTML = "";
        el.appendChild(box);

        function rowEl(m) {
          const role = m.role;
          const r = mk("div", "pph-row " + (role === "user" ? "me" : role === "system" ? "sys" : "ta"));
          if (role !== "system") {
            const meta = mk("div", "pph-meta");
            const name = role === "user" ? "我" : (m.senderName || m.name || otherName);
            const t = fmtTime(tsOf(m));
            meta.textContent = t ? name + "  " + t : name;
            r.appendChild(meta);
          }
          const b = mk("div", "pph-bub");
          const kind = m.mediaType || "text";
          const text = m.content == null ? "" : String(m.content);
          if (kind === "text") {
            b.textContent = text || "（空）";
          } else {
            const label = LABELS[kind] || "[" + kind + "]";
            b.textContent = text ? label + " " + text : label;
            if (kind === "image" || kind === "sticker") {
              const ib = mk("button", "pph-btn");
              ib.type = "button";
              ib.textContent = "点开看图";
              ib.style.cssText = "display:block;margin-top:6px;";
              ib.onclick = async function () {
                ib.disabled = true;
                ib.textContent = "加载中…";
                try {
                  let src = await Promise.resolve(ctx.rows.media(m));
                  if (src && typeof src !== "string") src = URL.createObjectURL(src);
                  if (!src) src = m.mediaUrl;
                  if (!src) throw new Error("no media");
                  const img = document.createElement("img");
                  img.src = src;
                  img.alt = "图片";
                  ib.replaceWith(img);
                } catch (e) {
                  ib.textContent = "这张图取不到了";
                }
              };
              b.appendChild(ib);
            }
          }
          r.appendChild(b);
          // 双击跳回原聊天页
          let lastTap = 0;
          r.addEventListener("click", function (ev) {
            if (ev.target && ev.target.closest && ev.target.closest("button")) return;
            const now = Date.now();
            if (now - lastTap < 350) {
              lastTap = 0;
              jumpTo(m, close);
            } else {
              lastTap = now;
              r.classList.add("pph-tap");
              setTimeout(function () { r.classList.remove("pph-tap"); }, 180);
            }
          });
          return r;
        }

        function updateUi() {
          if (lo <= 0) {
            topBtn.disabled = true;
            topBtn.textContent = "已经是最早的消息";
          } else {
            topBtn.disabled = false;
            topBtn.textContent = "再往前看 " + Math.min(size, lo) + " 条（还有 " + lo + " 条）";
          }
          const left = all.length - hi;
          if (left <= 0) {
            botBtn.disabled = true;
            botBtn.textContent = "已经是最新的消息";
          } else {
            botBtn.disabled = false;
            botBtn.textContent = "往后看 " + Math.min(size, left) + " 条（还有 " + left + " 条）";
          }
          count.textContent = "正在看第 " + (lo + 1) + "～" + hi + " 条，共 " + all.length + " 条 · 双击消息跳回聊天";
          btnLatest.classList.toggle("on", hi >= all.length);
          btnEarliest.classList.toggle("on", lo <= 0);
        }

        function loadOlder() {
          if (lo <= 0) return;
          const from = Math.max(0, lo - size);
          const frag = document.createDocumentFragment();
          for (let i = from; i < lo; i++) frag.appendChild(rowEl(all[i]));
          const h = scroll.scrollHeight, t = scroll.scrollTop;
          rows.insertBefore(frag, rows.firstChild);
          lo = from;
          // 保持当前看着的位置不跳
          scroll.scrollTop = t + (scroll.scrollHeight - h);
          while (hi - lo > keepMax && rows.lastChild) { rows.removeChild(rows.lastChild); hi--; }
          updateUi();
        }

        function loadNewer() {
          if (hi >= all.length) return;
          const to = Math.min(all.length, hi + size);
          const frag = document.createDocumentFragment();
          for (let i = hi; i < to; i++) frag.appendChild(rowEl(all[i]));
          rows.appendChild(frag);
          hi = to;
          if (hi - lo > keepMax) {
            const h = scroll.scrollHeight, t = scroll.scrollTop;
            while (hi - lo > keepMax && rows.firstChild) { rows.removeChild(rows.firstChild); lo++; }
            scroll.scrollTop = t - (h - scroll.scrollHeight);
          }
          updateUi();
        }

        function startAt(pos, dir) {
          rows.innerHTML = "";
          lo = hi = pos;
          if (dir === "older") loadOlder(); else loadNewer();
          requestAnimationFrame(function () {
            scroll.scrollTop = dir === "older" ? scroll.scrollHeight : 0;
          });
        }

        topBtn.onclick = loadOlder;
        botBtn.onclick = loadNewer;
        btnLatest.onclick = function () { startAt(all.length, "older"); };
        btnEarliest.onclick = function () { startAt(0, "newer"); };

        let idx = -1;
        if (anchorId != null) idx = all.findIndex(function (m) { return m.id === anchorId; });
        if (idx >= 0) startAt(idx + 1, "older");
        else startAt(all.length, "older");
      });
    }

    ctx.ui.place("composer.rail", (el, props) => {
      if (ctx.kit.prefs.get("showRail") === false) return;
      const sid = props && props.sessionId;
      if (!sid) return;
      el.innerHTML = "";
      el.style.cssText = "display:flex;justify-content:flex-end;padding:2px 2px 4px;";
      const b = mk("button", "pph-chip");
      b.type = "button";
      b.textContent = "分页看历史";
      b.onclick = function () { openViewer(sid); };
      el.appendChild(b);
    });

    ctx.ui.place("thread.panel", (el, props) => {
      if (ctx.kit.prefs.get("showPanel") === false) return;
      const sid = props && props.sessionId;
      if (!sid) return;
      el.innerHTML = "";
      el.style.cssText = "padding:4px 0 10px;";
      const b = mk("button", "pph-chip");
      b.type = "button";
      b.textContent = "分页查看聊天记录（每次 " + num("pageSize", 20, 5, 200) + " 条）";
      b.onclick = function () { openViewer(sid); };
      el.appendChild(b);
    });

    if (ctx.kit.prefs.get("showMenu") !== false) {
      ctx.ui.bubbleMenu({
        id: "from-here",
        label: "从这条往前翻",
        onSelect: function (msg) {
          openViewer(msg && msg.sessionId, msg && msg.id);
        },
      });
    }
  },
};
