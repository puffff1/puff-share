export default {
  manifest: {
    id: "puff-code-search",
    name: "代码搜索",
    engine: "puff",
    apiVersion: 1,
    version: "3.4.3",
    author: "",
    description: "悬浮球式代码搜索编辑器。拖球自由定位、点球展开；搜关键词逐个高亮，跳到位置直接改；搜索栏可收起；一键全选/复制。只有缩成球时闲置才变淡。",
  },
  setup(ctx) {
    const NL = String.fromCharCode(10);
    const BALL_W = 56, BALL_H = 56;
    const MIN_W = 260, MIN_H = 300;
    const IDLE_DELAY = 3000;
    const isDesktop = (window.innerWidth || 0) >= 768;

    /* ============ 状态 ============ */
    let isOpen = false;
    let isMaximized = false;
    let isSearchCollapsed = false;
    let rawCode = "";
    let matches = [];
    let currentMatch = -1;
    let saveTimer = null;
    let rescanTimer = null;
    let idleTimer = null;
    let scrollRaf = null;
    let toastTimer = null;

    /* ============================================================
       样式
       ============================================================ */
    const offCss = ctx.ui.css(`
      .pcs-ball {
        position: fixed;
        top: 0;
        left: 0;
        width: 56px; height: 56px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.32);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483000;
        user-select: none;
        -webkit-user-select: none;
        /* 关键：禁掉浏览器所有触摸手势，事件全交给我们自己处理 */
        touch-action: none;
        transform: translate3d(0, 0, 0);
        transition: opacity .55s ease;
      }
      .pcs-ball::before {
        content: '';
        position: absolute;
        width: 38px; height: 38px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.18);
      }
      .pcs-ball::after {
        content: '';
        position: absolute;
        width: 22px; height: 22px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.9);
      }
      .pcs-ball.pcs-idle { opacity: .35; }
      .pcs-ball.pcs-hidden { display: none; }
      .pcs-ball.pcs-dragging { will-change: transform; }

      .pcs-win {
        position: fixed;
        display: none;
        flex-direction: column;
        background: #f8f9fa;
        color: #212529;
        border-radius: 14px;
        box-shadow: 0 18px 48px rgba(0, 0, 0, .35), 0 0 0 1px rgba(0, 0, 0, .06);
        overflow: hidden;
        z-index: 2147483001;
        font-family: system-ui, -apple-system, 'PingFang SC', sans-serif;
        font-size: 13px;
        transition: border-radius .15s ease;
      }
      .pcs-win.pcs-open { display: flex; }
      .pcs-win.pcs-max { border-radius: 0; }
      @media (prefers-color-scheme: dark) {
        .pcs-win {
          background: #1e1e20;
          color: #ececec;
          box-shadow: 0 18px 48px rgba(0, 0, 0, .6), 0 0 0 1px rgba(255, 255, 255, .06);
        }
      }

      .pcs-bar {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px 10px;
        border-bottom: 1px solid rgba(127, 127, 127, .18);
        flex-shrink: 0;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }
      .pcs-bar:active { cursor: grabbing; }
      .pcs-win.pcs-max .pcs-bar { cursor: default; }
      .pcs-bar-left, .pcs-bar-right {
        display: flex;
        gap: 2px;
        flex-shrink: 0;
      }
      .pcs-title {
        flex: 1;
        text-align: center;
        font-weight: 600;
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding: 0 4px;
      }
      @media (max-width: 380px) {
        .pcs-title { display: none; }
      }
      .pcs-bar button {
        background: transparent;
        border: 0;
        color: #0d6efd;
        padding: 4px 6px;
        border-radius: 6px;
        font: inherit;
        font-size: 13px;
        cursor: pointer;
        white-space: nowrap;
        transition: background .15s;
      }
      @media (prefers-color-scheme: dark) {
        .pcs-bar button { color: #6ea8fe; }
      }
      .pcs-bar button:hover { background: rgba(127, 127, 127, .16); }
      .pcs-bar button.pcs-active {
        color: #212529;
        background: rgba(127, 127, 127, .18);
      }
      @media (prefers-color-scheme: dark) {
        .pcs-bar button.pcs-active { color: #ececec; }
      }
      @media (max-width: 300px) {
        .pcs-bar button { font-size: 12px; padding: 4px 4px; }
      }

      .pcs-search-row {
        display: flex;
        gap: 6px;
        align-items: center;
        padding: 8px 10px;
        border-bottom: 1px solid rgba(127, 127, 127, .18);
        position: relative;
        flex-shrink: 0;
        cursor: default;
      }
      .pcs-search-input {
        flex: 1;
        min-width: 0;
        padding: 6px 10px;
        border: 1px solid rgba(127, 127, 127, .28);
        border-radius: 8px;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 13px;
        outline: none;
      }
      .pcs-search-input:focus { border-color: rgba(127, 127, 127, .65); }
      .pcs-count {
        font-size: 12px;
        color: rgba(127, 127, 127, 1);
        min-width: 36px;
        text-align: center;
        flex-shrink: 0;
      }
      .pcs-search-row button {
        background: rgba(127, 127, 127, .14);
        border: 0;
        color: inherit;
        padding: 6px 9px;
        border-radius: 8px;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        flex-shrink: 0;
      }
      .pcs-search-row button:hover { background: rgba(127, 127, 127, .24); }

      .pcs-tabs {
        display: flex;
        border-bottom: 1px solid rgba(127, 127, 127, .18);
        flex-shrink: 0;
      }
      .pcs-tab {
        flex: 1;
        text-align: center;
        padding: 9px 0;
        font-size: 13px;
        cursor: pointer;
        user-select: none;
        color: rgba(127, 127, 127, 1);
        transition: color .15s;
      }
      .pcs-tab.pcs-on {
        color: inherit;
        font-weight: 600;
        border-bottom: 2px solid currentColor;
        margin-bottom: -1px;
      }

      .pcs-body {
        flex: 1;
        min-height: 0;
        position: relative;
        overflow: hidden;
      }
      .pcs-page {
        position: absolute;
        inset: 0;
        display: none;
        flex-direction: column;
        min-height: 0;
      }
      .pcs-page.pcs-on { display: flex; }

      .pcs-paste-ta {
        flex: 1;
        min-height: 0;
        width: 100%;
        resize: none;
        border: 0;
        padding: 12px;
        box-sizing: border-box;
        font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
        font-size: 13px;
        line-height: 1.6;
        background: transparent;
        color: inherit;
        outline: none;
      }

      .pcs-stack {
        position: relative;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
        font-size: 12px;
        line-height: 1.6;
        letter-spacing: normal;
        tab-size: 4;
        -moz-tab-size: 4;
      }
      .pcs-hl, .pcs-ta {
        position: absolute;
        inset: 0;
        margin: 0;
        padding: 12px;
        border: 0;
        box-sizing: border-box;
        font: inherit;
        line-height: inherit;
        letter-spacing: inherit;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
        word-break: normal;
        tab-size: inherit;
        -moz-tab-size: inherit;
      }
      .pcs-hl {
        z-index: 1;
        overflow: hidden;
        pointer-events: none;
      }
      .pcs-hl mark {
        background: rgba(255, 193, 7, .55);
        color: inherit;
        border-radius: 2px;
        padding: 0;
        margin: 0;
      }
      .pcs-hl mark.pcs-cur {
        background: #ff9800;
        color: #000;
        font-weight: 600;
      }
      .pcs-ta {
        z-index: 2;
        color: transparent;
        -webkit-text-fill-color: transparent;
        background: transparent;
        caret-color: #212529;
        overflow: auto;
        resize: none;
        outline: none;
      }
      @media (prefers-color-scheme: dark) {
        .pcs-ta { caret-color: #ececec; }
      }
      .pcs-ta::placeholder {
        color: rgba(127, 127, 127, 1);
        -webkit-text-fill-color: rgba(127, 127, 127, 1);
        opacity: 1;
      }
      .pcs-ta::selection {
        background: rgba(13, 110, 253, .28);
        color: transparent;
        -webkit-text-fill-color: transparent;
      }
      .pcs-ta::-moz-selection {
        background: rgba(13, 110, 253, .28);
        color: transparent;
      }

      .pcs-drop {
        position: absolute;
        top: 100%;
        left: 10px;
        right: 10px;
        margin-top: 4px;
        background: #fff;
        color: #212529;
        border: 1px solid rgba(0, 0, 0, .1);
        border-radius: 8px;
        max-height: 40vh;
        overflow-y: auto;
        z-index: 20;
        box-shadow: 0 6px 20px rgba(0, 0, 0, .2);
        display: none;
      }
      @media (prefers-color-scheme: dark) {
        .pcs-drop {
          background: #26262a;
          color: #ececec;
          border-color: rgba(255, 255, 255, .12);
        }
      }
      .pcs-drop.pcs-on { display: block; }
      .pcs-drop-item {
        padding: 6px 10px;
        border-bottom: 1px solid rgba(127, 127, 127, .15);
        cursor: pointer;
        font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pcs-drop-item:last-child { border-bottom: none; }
      .pcs-drop-item:hover { background: rgba(127, 127, 127, .14); }
      .pcs-drop-num {
        color: rgba(127, 127, 127, 1);
        margin-right: 8px;
      }
      .pcs-drop-item mark {
        background: #ffc107;
        color: #000;
        border-radius: 2px;
        padding: 0 2px;
      }

      .pcs-expand-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 1px solid rgba(127, 127, 127, .22);
        background: rgba(255, 255, 255, .9);
        color: #212529;
        box-shadow: 0 4px 12px rgba(0, 0, 0, .18);
        cursor: pointer;
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 5;
        padding: 0;
        transition: background .15s, transform .12s;
        -webkit-backdrop-filter: blur(6px);
        backdrop-filter: blur(6px);
      }
      @media (prefers-color-scheme: dark) {
        .pcs-expand-btn {
          background: rgba(38, 38, 42, .9);
          color: #ececec;
          border-color: rgba(255, 255, 255, .14);
        }
      }
      .pcs-expand-btn:hover { background: rgba(127, 127, 127, .18); }
      .pcs-expand-btn:active { transform: scale(0.94); }
      .pcs-expand-btn.pcs-visible { display: flex; }

      .pcs-toast {
        position: absolute;
        left: 50%;
        bottom: 22px;
        transform: translate(-50%, 12px);
        padding: 8px 16px;
        background: #212529;
        color: #fff;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
        opacity: 0;
        pointer-events: none;
        transition: opacity .22s ease, transform .22s ease;
        z-index: 300;
        box-shadow: 0 6px 20px rgba(0, 0, 0, .28);
        white-space: nowrap;
      }
      @media (prefers-color-scheme: dark) {
        .pcs-toast { background: #ececec; color: #212529; }
      }
      .pcs-toast.pcs-show {
        opacity: 1;
        transform: translate(-50%, 0);
      }

      .pcs-resize {
        position: absolute;
        right: 0;
        bottom: 0;
        width: 22px;
        height: 22px;
        cursor: nwse-resize;
        touch-action: none;
        z-index: 5;
        user-select: none;
        -webkit-user-select: none;
      }
      .pcs-resize::before {
        content: '';
        position: absolute;
        right: 4px;
        bottom: 4px;
        width: 12px;
        height: 12px;
        border-right: 2px solid rgba(127, 127, 127, .8);
        border-bottom: 2px solid rgba(127, 127, 127, .8);
        border-radius: 0 0 4px 0;
        opacity: .55;
        transition: opacity .15s;
      }
      .pcs-resize:hover::before { opacity: 1; }
      .pcs-win.pcs-max .pcs-resize { display: none; }
    `);

    /* ============================================================
       位置恢复
       ============================================================ */
    const vw0 = window.innerWidth || document.documentElement.clientWidth || 360;
    const vh0 = window.innerHeight || document.documentElement.clientHeight || 640;
    const savedBall = (function () { try { return ctx.kit.kv.get("ballPos") || {}; } catch (e) { return {}; } })();
    const savedWin = (function () { try { return ctx.kit.kv.get("winRect") || {}; } catch (e) { return {}; } })();

    let ballL = (typeof savedBall.l === "number") ? savedBall.l : (vw0 - BALL_W - 16);
    let ballT = (typeof savedBall.t === "number") ? savedBall.t : (vh0 - BALL_H - 120);
    let winW = (typeof savedWin.w === "number") ? savedWin.w : 340;
    let winH = (typeof savedWin.h === "number") ? savedWin.h : 460;
    let winL = (typeof savedWin.l === "number") ? savedWin.l : Math.max(8, Math.floor((vw0 - winW) / 2));
    let winT = (typeof savedWin.t === "number") ? savedWin.t : Math.max(8, Math.floor((vh0 - winH) / 2));

    function clampBall() {
      const vw = window.innerWidth || document.documentElement.clientWidth || 360;
      const vh = window.innerHeight || document.documentElement.clientHeight || 640;
      ballL = Math.max(4, Math.min(vw - BALL_W - 4, ballL));
      ballT = Math.max(4, Math.min(vh - BALL_H - 4, ballT));
    }
    function clampWin() {
      const vw = window.innerWidth || document.documentElement.clientWidth || 360;
      const vh = window.innerHeight || document.documentElement.clientHeight || 640;
      winL = Math.max(4, Math.min(vw - 60, winL));
      winT = Math.max(4, Math.min(vh - 40, winT));
      winW = Math.max(MIN_W, Math.min(vw - winL - 4, winW));
      winH = Math.max(MIN_H, Math.min(vh - winT - 4, winH));
    }
    clampBall();
    clampWin();

    try {
      const v = ctx.kit.kv.get("code");
      if (typeof v === "string") rawCode = v;
    } catch (e) {}

    /* ============================================================
       创建 DOM
       ============================================================ */
    const ball = document.createElement("div");
    ball.className = "pcs-ball";
    ball.style.transform = "translate3d(" + ballL + "px, " + ballT + "px, 0)";
    document.body.appendChild(ball);

    const win = document.createElement("div");
    win.className = "pcs-win";
    win.style.left = winL + "px";
    win.style.top = winT + "px";
    win.style.width = winW + "px";
    win.style.height = winH + "px";
    win.innerHTML = [
      '<div class="pcs-bar">',
      '  <span class="pcs-bar-left">',
      '    <button type="button" data-act="min">缩小</button>',
      '    <button type="button" data-act="clear">清空</button>',
      '  </span>',
      '  <span class="pcs-title">代码搜索器</span>',
      '  <span class="pcs-bar-right">',
      '    <button type="button" data-act="select-all">全选</button>',
      '    <button type="button" data-act="copy">复制</button>',
      '    <button type="button" data-act="max">最大化</button>',
      '  </span>',
      '</div>',
      '<div class="pcs-search-row" style="display:none;">',
      '  <input type="text" class="pcs-search-input" placeholder="输入关键字，回车下一个...">',
      '  <span class="pcs-count">0/0</span>',
      '  <button type="button" data-act="prev" title="上一个">\u2191</button>',
      '  <button type="button" data-act="next" title="下一个">\u2193</button>',
      '  <button type="button" data-act="collapse-search" title="收起搜索栏">\u2227</button>',
      '  <div class="pcs-drop"></div>',
      '</div>',
      '<div class="pcs-tabs">',
      '  <div class="pcs-tab pcs-on" data-tab="edit">1. 粘贴代码</div>',
      '  <div class="pcs-tab" data-tab="view">2. 搜索查看</div>',
      '</div>',
      '<div class="pcs-body">',
      '  <div class="pcs-page pcs-on" data-page="edit">',
      '    <textarea class="pcs-paste-ta" placeholder="把你的 CSS 或代码粘贴到这里..."></textarea>',
      '  </div>',
      '  <div class="pcs-page" data-page="view">',
      '    <div class="pcs-stack">',
      '      <pre class="pcs-hl"></pre>',
      '      <textarea class="pcs-ta" placeholder="先粘贴代码，再在上面搜关键字..." spellcheck="false" autocorrect="off" autocapitalize="off"></textarea>',
      '    </div>',
      '  </div>',
      '  <button type="button" class="pcs-expand-btn" title="展开搜索栏">',
      '    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">',
      '      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>',
      '    </svg>',
      '  </button>',
      '  <div class="pcs-toast"></div>',
      '</div>',
      '<div class="pcs-resize"></div>',
    ].join("");
    document.body.appendChild(win);

    /* ============================================================
       元素引用
       ============================================================ */
    const taPaste = win.querySelector(".pcs-paste-ta");
    const taEdit = win.querySelector(".pcs-ta");
    const hl = win.querySelector(".pcs-hl");
    const searchRow = win.querySelector(".pcs-search-row");
    const searchInput = win.querySelector(".pcs-search-input");
    const countEl = win.querySelector(".pcs-count");
    const drop = win.querySelector(".pcs-drop");
    const bar = win.querySelector(".pcs-bar");
    const resizeEl = win.querySelector(".pcs-resize");
    const expandBtn = win.querySelector(".pcs-expand-btn");
    const toastEl = win.querySelector(".pcs-toast");
    const tabs = win.querySelectorAll(".pcs-tab");
    const pages = win.querySelectorAll(".pcs-page");

    taPaste.value = rawCode;
    taEdit.value = rawCode;

    /* ============================================================
       工具
       ============================================================ */
    function escapeHTML(s) {
      return String(s)
        .split("&").join("&amp;")
        .split("<").join("&lt;")
        .split(">").join("&gt;");
    }

    function showToast(msg) {
      if (!toastEl) return;
      toastEl.textContent = msg;
      toastEl.classList.add("pcs-show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toastEl.classList.remove("pcs-show");
      }, 1500);
    }

    /* ============================================================
       闲置变淡：只对球态
       ============================================================ */
    function clearIdle() {
      clearTimeout(idleTimer);
      idleTimer = null;
      ball.classList.remove("pcs-idle");
    }
    function startIdleCountdown() {
      clearIdle();
      idleTimer = setTimeout(function () {
        if (!isOpen) ball.classList.add("pcs-idle");
      }, IDLE_DELAY);
    }
    function kickIdle() {
      ball.classList.remove("pcs-idle");
      if (!isOpen) startIdleCountdown();
      else { clearTimeout(idleTimer); idleTimer = null; }
    }
    ["pointerdown","pointermove","pointerup","pointercancel",
     "keydown","keyup","input","focusin","wheel","touchstart",
     "touchmove","touchend","scroll"].forEach(function (ev) {
      document.addEventListener(ev, kickIdle, { passive: true, capture: true });
    });

    /* ============================================================
       搜索栏显示控制
       ============================================================ */
    function updateSearchBarVisibility() {
      const onViewTab = win.querySelector('.pcs-page[data-page="view"]').classList.contains("pcs-on");
      if (!onViewTab) {
        isSearchCollapsed = false;
        searchRow.style.display = "none";
        expandBtn.classList.remove("pcs-visible");
        return;
      }
      if (isSearchCollapsed) {
        searchRow.style.display = "none";
        expandBtn.classList.add("pcs-visible");
      } else {
        searchRow.style.display = "flex";
        expandBtn.classList.remove("pcs-visible");
      }
    }
    function collapseSearch() {
      if (isSearchCollapsed) return;
      isSearchCollapsed = true;
      updateSearchBarVisibility();
      drop.classList.remove("pcs-on");
      try { taEdit.focus({ preventScroll: true }); }
      catch (e) { try { taEdit.focus(); } catch (e2) {} }
    }
    function expandSearch() {
      if (!isSearchCollapsed) {
        try { searchInput.focus(); } catch (e) {}
        return;
      }
      isSearchCollapsed = false;
      updateSearchBarVisibility();
      try { searchInput.focus(); } catch (e) {}
      const v = searchInput.value || "";
      try { searchInput.setSelectionRange(v.length, v.length); } catch (e) {}
    }

    /* ============================================================
       打开 / 最小化 / 恢复
       ============================================================ */
    function openWin() {
      isOpen = true;
      win.classList.add("pcs-open");
      ball.classList.add("pcs-hidden");
      clearIdle();
      requestAnimationFrame(function () { syncPadding(); syncScroll(); });
    }
    function minimizeWin() {
      isOpen = false;
      win.classList.remove("pcs-open");
      ball.classList.remove("pcs-hidden");
      startIdleCountdown();
    }
    function restoreApp() {
      isSearchCollapsed = false;
      openWin();
      updateSearchBarVisibility();
    }

    /* ============================================================
       悬浮球：拖动 + 点击展开
       —— 用 mousedown + touchstart 双通道，move/up 挂到 document 的 capture 阶段
       ============================================================ */
    (function () {
      let drag = null;
      let rafPending = false;
      let pendingL = ballL;
      let pendingT = ballT;
      let vw = 0, vh = 0;

      function measureViewport() {
        vw = window.innerWidth || document.documentElement.clientWidth || 360;
        vh = window.innerHeight || document.documentElement.clientHeight || 640;
      }
      function flushTransform() {
        rafPending = false;
        ball.style.transform = "translate3d(" + pendingL + "px, " + pendingT + "px, 0)";
      }
      function requestFlush() {
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(flushTransform);
        }
      }
      function getPoint(e) {
        if (e.touches && e.touches.length) return e.touches[0];
        if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0];
        return e;
      }

      function onDown(e) {
        /* 鼠标事件只响应左键 */
        if (e.type === "mousedown" && e.button !== 0) return;
        const pt = getPoint(e);
        measureViewport();
        drag = {
          startX: pt.clientX,
          startY: pt.clientY,
          startL: ballL,
          startT: ballT,
          moved: false
        };
        pendingL = ballL;
        pendingT = ballT;
        ball.classList.add("pcs-dragging");

        /* 都挂到 document 上，capture 阶段抢先于冒泡阶段 */
        document.addEventListener("mousemove", onMove, true);
        document.addEventListener("mouseup", onUp, true);
        document.addEventListener("touchmove", onMove, { passive: false, capture: true });
        document.addEventListener("touchend", onUp, true);
        document.addEventListener("touchcancel", onUp, true);

        if (e.type === "mousedown") e.preventDefault();
        if (e.type === "touchstart" && e.cancelable) e.preventDefault();
      }

      function onMove(e) {
        if (!drag) return;
        const pt = getPoint(e);
        const dx = pt.clientX - drag.startX;
        const dy = pt.clientY - drag.startY;
        if (!drag.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
          drag.moved = true;
        }
        if (drag.moved) {
          pendingL = Math.max(4, Math.min(vw - BALL_W - 4, drag.startL + dx));
          pendingT = Math.max(4, Math.min(vh - BALL_H - 4, drag.startT + dy));
          requestFlush();
          if (e.type === "touchmove" && e.cancelable) e.preventDefault();
        }
      }

      function onUp(e) {
        if (!drag) return;
        const moved = drag.moved;
        drag = null;
        ball.classList.remove("pcs-dragging");

        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        document.removeEventListener("touchmove", onMove, true);
        document.removeEventListener("touchend", onUp, true);
        document.removeEventListener("touchcancel", onUp, true);

        if (rafPending) {
          rafPending = false;
          ball.style.transform = "translate3d(" + pendingL + "px, " + pendingT + "px, 0)";
        }

        if (moved) {
          ballL = pendingL;
          ballT = pendingT;
          try { ctx.kit.kv.set("ballPos", { l: ballL, t: ballT }); } catch (er) {}
        } else {
          restoreApp();
        }
      }

      /* 只用 mousedown + touchstart，不再用 pointer 事件 */
      ball.addEventListener("mousedown", onDown);
      ball.addEventListener("touchstart", onDown, { passive: false });
    })();

    /* ============================================================
       面板拖动：标题栏
       ============================================================ */
    (function () {
      let drag = null;
      bar.addEventListener("pointerdown", function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        if (e.target.closest && e.target.closest("button")) return;
        if (isMaximized) return;
        e.preventDefault();
        drag = {
          id: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          startL: winL,
          startT: winT
        };
        try { bar.setPointerCapture(e.pointerId); } catch (er) {}
      });
      bar.addEventListener("pointermove", function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        const vw = window.innerWidth || document.documentElement.clientWidth || 360;
        const vh = window.innerHeight || document.documentElement.clientHeight || 640;
        winL = Math.max(4, Math.min(vw - 60, drag.startL + (e.clientX - drag.startX)));
        winT = Math.max(4, Math.min(vh - 40, drag.startT + (e.clientY - drag.startY)));
        win.style.left = winL + "px";
        win.style.top = winT + "px";
      });
      function end(e) {
        if (!drag || e.pointerId !== drag.id) return;
        drag = null;
        try { ctx.kit.kv.set("winRect", { l: winL, t: winT, w: winW, h: winH }); } catch (er) {}
      }
      bar.addEventListener("pointerup", end);
      bar.addEventListener("pointercancel", end);
      bar.addEventListener("lostpointercapture", function (e) {
        if (drag && e.pointerId === drag.id) end(e);
      });
    })();

    /* ============================================================
       面板缩放：右下角手柄
       ============================================================ */
    (function () {
      let rs = null;
      resizeEl.addEventListener("pointerdown", function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        rs = { id: e.pointerId, startX: e.clientX, startY: e.clientY, startW: winW, startH: winH };
        try { resizeEl.setPointerCapture(e.pointerId); } catch (er) {}
      });
      resizeEl.addEventListener("pointermove", function (e) {
        if (!rs || e.pointerId !== rs.id) return;
        const vw = window.innerWidth || document.documentElement.clientWidth || 360;
        const vh = window.innerHeight || document.documentElement.clientHeight || 640;
        winW = Math.max(MIN_W, Math.min(vw - winL - 4, rs.startW + (e.clientX - rs.startX)));
        winH = Math.max(MIN_H, Math.min(vh - winT - 4, rs.startH + (e.clientY - rs.startY)));
        win.style.width = winW + "px";
        win.style.height = winH + "px";
        syncPadding();
      });
      function end(e) {
        if (!rs || e.pointerId !== rs.id) return;
        rs = null;
        try { ctx.kit.kv.set("winRect", { l: winL, t: winT, w: winW, h: winH }); } catch (er) {}
        requestAnimationFrame(function () { syncPadding(); syncScroll(); });
      }
      resizeEl.addEventListener("pointerup", end);
      resizeEl.addEventListener("pointercancel", end);
      resizeEl.addEventListener("lostpointercapture", function (e) {
        if (rs && e.pointerId === rs.id) end(e);
      });
    })();

    /* ============================================================
       最大化
       ============================================================ */
    function applyMaximize(on) {
      const maxBtn = bar.querySelector('[data-act="max"]');
      if (on) {
        win.style.left = "0px";
        win.style.top = "0px";
        win.style.width = "100vw";
        win.style.height = "100vh";
        win.style.borderRadius = "0";
        win.classList.add("pcs-max");
        if (maxBtn) maxBtn.textContent = "还原";
      } else {
        clampWin();
        win.style.left = winL + "px";
        win.style.top = winT + "px";
        win.style.width = winW + "px";
        win.style.height = winH + "px";
        win.style.borderRadius = "";
        win.classList.remove("pcs-max");
        if (maxBtn) maxBtn.textContent = "最大化";
      }
      requestAnimationFrame(function () { syncPadding(); syncScroll(); });
    }

    /* ============================================================
       顶栏按钮
       ============================================================ */
    function getActiveTextarea() {
      return win.querySelector('.pcs-page[data-page="view"]').classList.contains("pcs-on") ? taEdit : taPaste;
    }
    function doSelectAll() {
      const el = getActiveTextarea();
      const text = el.value || "";
      if (!text) { showToast("没有内容"); return; }
      try { el.focus({ preventScroll: true }); }
      catch (e) { try { el.focus(); } catch (e2) {} }
      try { el.setSelectionRange(0, text.length); }
      catch (e) { try { el.select(); } catch (e2) {} }
      showToast("已全选 " + text.length + " 字符");
    }
    function copyViaFallback(text) {
      try {
        const tmp = document.createElement("textarea");
        tmp.value = text;
        tmp.style.position = "fixed";
        tmp.style.left = "-9999px";
        tmp.style.top = "0";
        tmp.style.opacity = "0";
        tmp.setAttribute("readonly", "");
        document.body.appendChild(tmp);
        tmp.select();
        tmp.setSelectionRange(0, text.length);
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(tmp);
        return ok;
      } catch (e) { return false; }
    }
    function doCopy() {
      const el = getActiveTextarea();
      const text = el.value || "";
      if (!text) { showToast("没有内容"); return; }
      const fallbackAfterAsync = function () {
        if (copyViaFallback(text)) showToast("已复制 " + text.length + " 字符");
        else showToast("复制失败");
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          navigator.clipboard.writeText(text).then(function () {
            showToast("已复制 " + text.length + " 字符");
          }).catch(function () {
            fallbackAfterAsync();
          });
        } catch (e) {
          fallbackAfterAsync();
        }
      } else {
        fallbackAfterAsync();
      }
    }
    bar.addEventListener("click", function (e) {
      const btn = e.target.closest ? e.target.closest("button[data-act]") : null;
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      if (act === "min") { minimizeWin(); return; }
      if (act === "clear") { clearAll(); return; }
      if (act === "max") {
        isMaximized = !isMaximized;
        applyMaximize(isMaximized);
        return;
      }
      if (act === "select-all") { doSelectAll(); return; }
      if (act === "copy") { doCopy(); return; }
    });

    /* ============================================================
       搜索栏内按钮
       ============================================================ */
    searchRow.addEventListener("click", function (e) {
      const btn = e.target.closest ? e.target.closest("button[data-act]") : null;
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      if (act === "prev") { if (matches.length > 0) gotoMatch(currentMatch - 1); return; }
      if (act === "next") { if (matches.length > 0) gotoMatch(currentMatch + 1); return; }
      if (act === "collapse-search") { collapseSearch(); return; }
    });
    expandBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      expandSearch();
    });

    /* ============================================================
       清空
       ============================================================ */
    function clearAll() {
      taPaste.value = "";
      taEdit.value = "";
      rawCode = "";
      try { ctx.kit.kv.set("code", ""); } catch (e) {}
      searchInput.value = "";
      matches = [];
      currentMatch = -1;
      countEl.textContent = "0/0";
      drop.innerHTML = "";
      drop.classList.remove("pcs-on");
      renderHighlight();
      switchTab("edit");
      showToast("已清空");
    }

    /* ============================================================
       内容缓存
       ============================================================ */
    function persistCode(text) {
      try { ctx.kit.kv.set("code", text); } catch (e) {}
    }
    function scheduleSave(text) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { persistCode(text); }, 500);
    }
    taPaste.addEventListener("input", function () {
      rawCode = taPaste.value;
      scheduleSave(rawCode);
    });

    /* ============================================================
       两层同步
       ============================================================ */
    function syncScroll() {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(function () {
        scrollRaf = null;
        hl.scrollTop = taEdit.scrollTop;
        hl.scrollLeft = taEdit.scrollLeft;
      });
    }
    function syncPadding() {
      const sbw = taEdit.offsetWidth - taEdit.clientWidth;
      hl.style.paddingRight = (12 + Math.max(0, sbw)) + "px";
    }
    taEdit.addEventListener("scroll", syncScroll, { passive: true });

    /* ============================================================
       高亮渲染
       ============================================================ */
    function renderHighlight() {
      const text = taEdit.value;
      if (matches.length === 0) {
        hl.textContent = text + NL;
        return;
      }
      let html = "";
      let pos = 0;
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        if (m.start > pos) html += escapeHTML(text.substring(pos, m.start));
        const cls = (i === currentMatch) ? ' class="pcs-cur"' : "";
        html += "<mark" + cls + ">" + escapeHTML(text.substring(m.start, m.end)) + "</mark>";
        pos = m.end;
      }
      if (pos < text.length) html += escapeHTML(text.substring(pos));
      html += NL;
      hl.innerHTML = html;
    }

    /* ============================================================
       搜索核心
       ============================================================ */
    function scanMatches() {
      const q = searchInput.value;
      const text = taEdit.value;
      matches = [];
      currentMatch = -1;
      if (!q) return;
      const lq = q.toLowerCase();
      const lt = text.toLowerCase();
      let idx = 0, guard = 0;
      while (guard++ < 50000) {
        const at = lt.indexOf(lq, idx);
        if (at === -1) break;
        matches.push({ start: at, end: at + q.length });
        idx = at + Math.max(1, q.length);
      }
    }
    function scrollToCurrentMark() {
      const mEl = hl.querySelector("mark.pcs-cur");
      if (!mEl) return;
      const top = mEl.offsetTop;
      const h = taEdit.clientHeight;
      const mh = mEl.offsetHeight || 20;
      taEdit.scrollTop = Math.max(0, top - h / 2 + mh / 2);
      syncScroll();
    }
    function gotoMatch(n, focusIt) {
      if (matches.length === 0) {
        currentMatch = -1;
        countEl.textContent = "0/0";
        renderHighlight();
        return;
      }
      currentMatch = ((n % matches.length) + matches.length) % matches.length;
      renderHighlight();
      const m = matches[currentMatch];
      try { taEdit.setSelectionRange(m.start, m.end); } catch (e) {}
      requestAnimationFrame(function () { scrollToCurrentMark(); });
      if (focusIt !== false && isDesktop) {
        try { taEdit.focus({ preventScroll: true }); }
        catch (e) { try { taEdit.focus(); } catch (e2) {} }
      }
      countEl.textContent = (currentMatch + 1) + "/" + matches.length;
    }
    function buildDropdown() {
      if (matches.length === 0) {
        drop.innerHTML = "";
        drop.classList.remove("pcs-on");
        return;
      }
      const text = taEdit.value;
      const max = Math.min(matches.length, 200);
      let html = "";
      for (let i = 0; i < max; i++) {
        const m = matches[i];
        const lineStart = text.lastIndexOf(NL, m.start - 1) + 1;
        const lineEnd = text.indexOf(NL, m.end);
        const endAt = lineEnd === -1 ? text.length : lineEnd;
        const lineIdx = text.substring(0, m.start).split(NL).length;
        const before = text.substring(Math.max(lineStart, m.start - 20), m.start);
        const midText = text.substring(m.start, m.end);
        const after = text.substring(m.end, Math.min(endAt, m.end + 30));
        const preDot = (m.start - 20 > lineStart) ? "\u2026" : "";
        const sufDot = (m.end + 30 < endAt) ? "\u2026" : "";
        html += '<div class="pcs-drop-item" data-idx="' + i + '">' +
                  '<span class="pcs-drop-num">' + lineIdx + "</span>" +
                  escapeHTML(preDot + before) +
                  "<mark>" + escapeHTML(midText) + "</mark>" +
                  escapeHTML(after + sufDot) +
                "</div>";
      }
      drop.innerHTML = html;
      drop.classList.add("pcs-on");
    }

    searchInput.addEventListener("input", function () {
      scanMatches();
      if (matches.length > 0) {
        gotoMatch(0);
        buildDropdown();
      } else {
        countEl.textContent = "0/0";
        drop.innerHTML = "";
        drop.classList.remove("pcs-on");
        renderHighlight();
      }
    });
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (matches.length > 0) gotoMatch(currentMatch + 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (searchInput.value) {
          searchInput.value = "";
          matches = [];
          currentMatch = -1;
          countEl.textContent = "0/0";
          drop.innerHTML = "";
          drop.classList.remove("pcs-on");
          renderHighlight();
        } else {
          collapseSearch();
        }
      }
    });
    searchInput.addEventListener("focus", function () {
      if (matches.length > 0) drop.classList.add("pcs-on");
    });
    searchInput.addEventListener("blur", function () {
      setTimeout(function () { drop.classList.remove("pcs-on"); }, 200);
    });
    drop.addEventListener("mousedown", function (e) {
      const item = e.target.closest ? e.target.closest(".pcs-drop-item") : null;
      if (!item) return;
      e.preventDefault();
      const idx = parseInt(item.getAttribute("data-idx"), 10);
      if (isNaN(idx)) return;
      gotoMatch(idx);
      drop.classList.remove("pcs-on");
    });

    /* ============================================================
       编辑区输入
       ============================================================ */
    taEdit.addEventListener("input", function () {
      rawCode = taEdit.value;
      scheduleSave(rawCode);
      if (!searchInput.value) { renderHighlight(); return; }
      clearTimeout(rescanTimer);
      rescanTimer = setTimeout(function () {
        const selStart = taEdit.selectionStart;
        scanMatches();
        if (matches.length === 0) {
          countEl.textContent = "0/0";
          drop.innerHTML = "";
          drop.classList.remove("pcs-on");
          renderHighlight();
          return;
        }
        let found = -1;
        for (let i = 0; i < matches.length; i++) {
          if (matches[i].start <= selStart && selStart <= matches[i].end) { found = i; break; }
        }
        if (found >= 0) currentMatch = found;
        else if (currentMatch >= matches.length) currentMatch = matches.length - 1;
        else if (currentMatch < 0) currentMatch = 0;
        countEl.textContent = (currentMatch + 1) + "/" + matches.length;
        renderHighlight();
        if (searchInput.value) buildDropdown();
      }, 120);
    });

    /* ============================================================
       标签切换
       ============================================================ */
    function switchTab(tab) {
      if (tab === "view") {
        if (taEdit.value !== taPaste.value) taEdit.value = taPaste.value;
        rawCode = taEdit.value;
        isSearchCollapsed = false;
        requestAnimationFrame(function () {
          syncPadding();
          scanMatches();
          if (matches.length > 0) {
            gotoMatch(currentMatch >= 0 ? currentMatch : 0);
            buildDropdown();
          } else {
            renderHighlight();
            countEl.textContent = "0/0";
          }
        });
      } else {
        if (taPaste.value !== taEdit.value) taPaste.value = taEdit.value;
      }
      tabs.forEach(function (t) {
        t.classList.toggle("pcs-on", t.getAttribute("data-tab") === tab);
      });
      pages.forEach(function (p) {
        p.classList.toggle("pcs-on", p.getAttribute("data-page") === tab);
      });
      updateSearchBarVisibility();
    }
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        switchTab(t.getAttribute("data-tab"));
      });
    });

    /* ============================================================
       视口变化
       ============================================================ */
    function onResize() {
      if (!isMaximized) {
        clampWin();
        win.style.left = winL + "px";
        win.style.top = winT + "px";
        win.style.width = winW + "px";
        win.style.height = winH + "px";
      }
      clampBall();
      ball.style.transform = "translate3d(" + ballL + "px, " + ballT + "px, 0)";
      requestAnimationFrame(function () { syncPadding(); syncScroll(); });
    }
    window.addEventListener("resize", onResize);

    /* ============================================================
       初始化
       ============================================================ */
    minimizeWin();
    updateSearchBarVisibility();
    requestAnimationFrame(function () { syncPadding(); renderHighlight(); });

    /* ============================================================
       清理
       ============================================================ */
    return function () {
      try { offCss(); } catch (e) {}
      try { window.removeEventListener("resize", onResize); } catch (e) {}
      try { ball.remove(); } catch (e) {}
      try { win.remove(); } catch (e) {}
      clearTimeout(saveTimer);
      clearTimeout(rescanTimer);
      clearTimeout(idleTimer);
      clearTimeout(toastTimer);
    };
  },
};