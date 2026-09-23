export default {
  manifest: {
    id: "puff-code-search",
    name: "代码搜索",
    engine: "puff",
    apiVersion: 1,
    version: "2.0.0",
    author: "",
    description: "悬浮球式代码搜索编辑器。拖球自由定位、点球展开；粘贴代码，搜关键词逐个高亮，跳到位置直接改；只有缩成球时闲置才变淡。",
  },
  setup(ctx) {
    const NL = String.fromCharCode(10);
    const BALL_W = 56, BALL_H = 56;
    const MIN_W = 260, MIN_H = 300;
    const IDLE_DELAY = 3000;
    const isDesktop = (window.innerWidth || 0) >= 768;

    /* ============================================================
       样式
       ============================================================ */
    const offCss = ctx.ui.css(`
      .pcs-ball {
        position: fixed;
        width: 56px; height: 56px;
        border-radius: 50%;
        background: rgba(0,0,0,0.65);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.32);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483000;
        user-select: none;
        -webkit-user-select: none;
        touch-action: manipulation;
        transition: transform .14s ease, opacity .55s ease;
        opacity: 1;
      }
      .pcs-ball::before {
        content: '';
        position: absolute;
        width: 38px; height: 38px;
        border-radius: 50%;
        background: rgba(255,255,255,0.18);
      }
      .pcs-ball::after {
        content: '';
        position: absolute;
        width: 22px; height: 22px;
        border-radius: 50%;
        background: rgba(255,255,255,0.9);
      }
      .pcs-ball.pcs-idle { opacity: .35; }
      .pcs-ball.pcs-hidden { display: none; }

      .pcs-win {
        position: fixed;
        display: none;
        flex-direction: column;
        background: #f8f9fa;
        color: #212529;
        border-radius: 14px;
        box-shadow: 0 18px 48px rgba(0,0,0,.35), 0 0 0 1px rgba(0,0,0,.06);
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
          box-shadow: 0 18px 48px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06);
        }
      }

      .pcs-bar {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px 10px;
        border-bottom: 1px solid rgba(127,127,127,.18);
        flex-shrink: 0;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }
      .pcs-bar:active { cursor: grabbing; }
      .pcs-win.pcs-max .pcs-bar { cursor: default; }
      .pcs-title {
        flex: 1;
        font-weight: 600;
        padding-left: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pcs-bar button {
        background: transparent;
        border: 0;
        color: inherit;
        padding: 4px 8px;
        border-radius: 6px;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        white-space: nowrap;
      }
      .pcs-bar button:hover { background: rgba(127,127,127,.16); }

      .pcs-search-row {
        display: flex;
        gap: 6px;
        align-items: center;
        padding: 8px 10px;
        border-bottom: 1px solid rgba(127,127,127,.18);
        position: relative;
        flex-shrink: 0;
      }
      .pcs-search-row input {
        flex: 1;
        min-width: 0;
        padding: 6px 10px;
        border: 1px solid rgba(127,127,127,.28);
        border-radius: 8px;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 13px;
        outline: none;
      }
      .pcs-search-row input:focus { border-color: rgba(127,127,127,.65); }
      .pcs-count {
        font-size: 12px;
        color: rgba(127,127,127,1);
        min-width: 36px;
        text-align: center;
        flex-shrink: 0;
      }
      .pcs-search-row button {
        background: rgba(127,127,127,.14);
        border: 0;
        color: inherit;
        padding: 6px 9px;
        border-radius: 8px;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        flex-shrink: 0;
      }
      .pcs-search-row button:hover { background: rgba(127,127,127,.24); }

      .pcs-body {
        flex: 1;
        min-height: 0;
        position: relative;
        overflow: hidden;
      }

      .pcs-stack {
        position: absolute;
        inset: 0;
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
        color: #212529;
        background: #f8f9fa;
        overflow: hidden;
        pointer-events: none;
      }
      @media (prefers-color-scheme: dark) {
        .pcs-hl { color: #ececec; background: #1e1e20; }
      }
      .pcs-hl mark {
        background: rgba(255,193,7,.55);
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
        color: rgba(127,127,127,1);
        -webkit-text-fill-color: rgba(127,127,127,1);
        opacity: 1;
      }
      .pcs-ta::selection {
        background: rgba(13,110,253,.28);
        color: transparent;
        -webkit-text-fill-color: transparent;
      }
      .pcs-ta::-moz-selection {
        background: rgba(13,110,253,.28);
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
        border: 1px solid rgba(0,0,0,.1);
        border-radius: 8px;
        max-height: 40vh;
        overflow-y: auto;
        z-index: 10;
        box-shadow: 0 6px 20px rgba(0,0,0,.2);
        display: none;
      }
      @media (prefers-color-scheme: dark) {
        .pcs-drop {
          background: #26262a;
          color: #ececec;
          border-color: rgba(255,255,255,.12);
        }
      }
      .pcs-drop.pcs-on { display: block; }
      .pcs-drop-item {
        padding: 6px 10px;
        border-bottom: 1px solid rgba(127,127,127,.15);
        cursor: pointer;
        font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pcs-drop-item:last-child { border-bottom: none; }
      .pcs-drop-item:hover { background: rgba(127,127,127,.14); }
      .pcs-drop-num {
        color: rgba(127,127,127,1);
        margin-right: 8px;
      }
      .pcs-drop-item mark {
        background: #ffc107;
        color: #000;
        border-radius: 2px;
        padding: 0 2px;
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
        border-right: 2px solid rgba(127,127,127,.8);
        border-bottom: 2px solid rgba(127,127,127,.8);
        border-radius: 0 0 4px 0;
        opacity: .55;
        transition: opacity .15s;
      }
      .pcs-resize:hover::before { opacity: 1; }
      .pcs-win.pcs-max .pcs-resize { display: none; }
    `);

    /* ============================================================
       状态
       ============================================================ */
    let isOpen = false;
    let isMaximized = false;
    let rawCode = '';
    let matches = [];
    let currentMatch = -1;
    let saveTimer = null;
    let rescanTimer = null;
    let idleTimer = null;
    let scrollRaf = null;

    /* ============================================================
       位置（从 kv 恢复）
       ============================================================ */
    const vw0 = window.innerWidth || document.documentElement.clientWidth || 360;
    const vh0 = window.innerHeight || document.documentElement.clientHeight || 640;
    const savedBall = (function () { try { return ctx.kit.kv.get('ballPos') || {}; } catch (e) { return {}; } })();
    const savedWin = (function () { try { return ctx.kit.kv.get('winRect') || {}; } catch (e) { return {}; } })();

    let ballL = (typeof savedBall.l === 'number') ? savedBall.l : (vw0 - BALL_W - 16);
    let ballT = (typeof savedBall.t === 'number') ? savedBall.t : (vh0 - BALL_H - 120);
    let winW = (typeof savedWin.w === 'number') ? savedWin.w : 340;
    let winH = (typeof savedWin.h === 'number') ? savedWin.h : 460;
    let winL = (typeof savedWin.l === 'number') ? savedWin.l : Math.max(8, Math.floor((vw0 - winW) / 2));
    let winT = (typeof savedWin.t === 'number') ? savedWin.t : Math.max(8, Math.floor((vh0 - winH) / 2));

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

    /* ============================================================
       初始代码
       ============================================================ */
    try {
      const v = ctx.kit.kv.get('code');
      if (typeof v === 'string') rawCode = v;
    } catch (e) {}

    /* ============================================================
       DOM
       ============================================================ */
    const ball = document.createElement('div');
    ball.className = 'pcs-ball';
    ball.style.left = ballL + 'px';
    ball.style.top = ballT + 'px';
    document.body.appendChild(ball);

    const win = document.createElement('div');
    win.className = 'pcs-win';
    win.style.left = winL + 'px';
    win.style.top = winT + 'px';
    win.style.width = winW + 'px';
    win.style.height = winH + 'px';
    win.innerHTML = [
      '<div class="pcs-bar">',
      '  <span class="pcs-title">代码搜索</span>',
      '  <button type="button" data-act="clear">清空</button>',
      '  <button type="button" data-act="min">最小化</button>',
      '  <button type="button" data-act="max">最大化</button>',
      '</div>',
      '<div class="pcs-search-row">',
      '  <input type="text" class="pcs-search-input" placeholder="输入关键字，回车下一个...">',
      '  <span class="pcs-count">0/0</span>',
      '  <button type="button" data-act="prev">\u2191</button>',
      '  <button type="button" data-act="next">\u2193</button>',
      '  <div class="pcs-drop"></div>',
      '</div>',
      '<div class="pcs-body">',
      '  <div class="pcs-stack">',
      '    <pre class="pcs-hl"></pre>',
      '    <textarea class="pcs-ta" placeholder="粘贴代码后在这里编辑..." spellcheck="false" autocorrect="off" autocapitalize="off"></textarea>',
      '  </div>',
      '</div>',
      '<div class="pcs-resize"></div>',
    ].join('');
    document.body.appendChild(win);

    /* ============================================================
       元素引用
       ============================================================ */
    const ta = win.querySelector('.pcs-ta');
    const hl = win.querySelector('.pcs-hl');
    const searchInput = win.querySelector('.pcs-search-input');
    const countEl = win.querySelector('.pcs-count');
    const drop = win.querySelector('.pcs-drop');
    const bar = win.querySelector('.pcs-bar');
    const resizeEl = win.querySelector('.pcs-resize');

    ta.value = rawCode;

    /* ============================================================
       工具
       ============================================================ */
    function escapeHTML(s) {
      return String(s)
        .split('&').join('&amp;')
        .split('<').join('&lt;')
        .split('>').join('&gt;');
    }

    /* ============================================================
       闲置变暗：只对球态
       ============================================================ */
    function clearIdle() {
      clearTimeout(idleTimer);
      idleTimer = null;
      ball.classList.remove('pcs-idle');
    }
    function startIdleCountdown() {
      clearIdle();
      idleTimer = setTimeout(function () {
        if (!isOpen) ball.classList.add('pcs-idle');
      }, IDLE_DELAY);
    }
    function kickIdle() {
      ball.classList.remove('pcs-idle');
      if (!isOpen) startIdleCountdown();
      else { clearTimeout(idleTimer); idleTimer = null; }
    }
    ['pointerdown','pointermove','pointerup','pointercancel',
     'keydown','keyup','input','focusin','wheel','touchstart',
     'touchmove','touchend','scroll'].forEach(function (ev) {
      document.addEventListener(ev, kickIdle, { passive: true, capture: true });
    });

    /* ============================================================
       打开 / 最小化
       ============================================================ */
    function openWin() {
      isOpen = true;
      win.classList.add('pcs-open');
      ball.classList.add('pcs-hidden');
      clearIdle();
      requestAnimationFrame(function () { syncPadding(); syncScroll(); });
    }
    function minimizeWin() {
      isOpen = false;
      win.classList.remove('pcs-open');
      ball.classList.remove('pcs-hidden');
      startIdleCountdown();
    }

    /* ============================================================
       悬浮球：自己拖拽 + 点击展开
       ============================================================ */
    (function () {
      let drag = null;
      ball.addEventListener('pointerdown', function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        drag = {
          id: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          startL: ballL,
          startT: ballT,
          moved: false
        };
        try { ball.setPointerCapture(e.pointerId); } catch (er) {}
      });
      ball.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
        if (drag.moved) {
          ballL = drag.startL + dx;
          ballT = drag.startT + dy;
          clampBall();
          ball.style.left = ballL + 'px';
          ball.style.top = ballT + 'px';
        }
      });
      function end(e) {
        if (!drag || e.pointerId !== drag.id) return;
        const moved = drag.moved;
        drag = null;
        if (moved) {
          try { ctx.kit.kv.set('ballPos', { l: ballL, t: ballT }); } catch (er) {}
        } else {
          openWin();
        }
      }
      ball.addEventListener('pointerup', end);
      ball.addEventListener('pointercancel', end);
      ball.addEventListener('lostpointercapture', function (e) {
        if (drag && e.pointerId === drag.id) end(e);
      });
    })();

    /* ============================================================
       面板拖动：标题栏
       ============================================================ */
    (function () {
      let drag = null;
      bar.addEventListener('pointerdown', function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        if (e.target.closest && e.target.closest('button')) return;
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
      bar.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        const vw = window.innerWidth || document.documentElement.clientWidth || 360;
        const vh = window.innerHeight || document.documentElement.clientHeight || 640;
        winL = Math.max(4, Math.min(vw - 60, drag.startL + (e.clientX - drag.startX)));
        winT = Math.max(4, Math.min(vh - 40, drag.startT + (e.clientY - drag.startY)));
        win.style.left = winL + 'px';
        win.style.top = winT + 'px';
      });
      function end(e) {
        if (!drag || e.pointerId !== drag.id) return;
        drag = null;
        try { ctx.kit.kv.set('winRect', { l: winL, t: winT, w: winW, h: winH }); } catch (er) {}
      }
      bar.addEventListener('pointerup', end);
      bar.addEventListener('pointercancel', end);
      bar.addEventListener('lostpointercapture', function (e) {
        if (drag && e.pointerId === drag.id) end(e);
      });
    })();

    /* ============================================================
       面板缩放：右下角手柄
       ============================================================ */
    (function () {
      let rs = null;
      resizeEl.addEventListener('pointerdown', function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        rs = { id: e.pointerId, startX: e.clientX, startY: e.clientY, startW: winW, startH: winH };
        try { resizeEl.setPointerCapture(e.pointerId); } catch (er) {}
      });
      resizeEl.addEventListener('pointermove', function (e) {
        if (!rs || e.pointerId !== rs.id) return;
        const vw = window.innerWidth || document.documentElement.clientWidth || 360;
        const vh = window.innerHeight || document.documentElement.clientHeight || 640;
        winW = Math.max(MIN_W, Math.min(vw - winL - 4, rs.startW + (e.clientX - rs.startX)));
        winH = Math.max(MIN_H, Math.min(vh - winT - 4, rs.startH + (e.clientY - rs.startY)));
        win.style.width = winW + 'px';
        win.style.height = winH + 'px';
        syncPadding();
      });
      function end(e) {
        if (!rs || e.pointerId !== rs.id) return;
        rs = null;
        try { ctx.kit.kv.set('winRect', { l: winL, t: winT, w: winW, h: winH }); } catch (er) {}
        requestAnimationFrame(function () { syncPadding(); syncScroll(); });
      }
      resizeEl.addEventListener('pointerup', end);
      resizeEl.addEventListener('pointercancel', end);
      resizeEl.addEventListener('lostpointercapture', function (e) {
        if (rs && e.pointerId === rs.id) end(e);
      });
    })();

    /* ============================================================
       顶栏按钮
       ============================================================ */
    function applyMaximize(on) {
      if (on) {
        win.style.left = '0px';
        win.style.top = '0px';
        win.style.width = '100vw';
        win.style.height = '100vh';
        win.style.borderRadius = '0';
        win.classList.add('pcs-max');
      } else {
        clampWin();
        win.style.left = winL + 'px';
        win.style.top = winT + 'px';
        win.style.width = winW + 'px';
        win.style.height = winH + 'px';
        win.style.borderRadius = '';
        win.classList.remove('pcs-max');
      }
      requestAnimationFrame(function () { syncPadding(); syncScroll(); });
    }

    win.addEventListener('click', function (e) {
      const btn = e.target.closest ? e.target.closest('button[data-act]') : null;
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      if (act === 'min') { minimizeWin(); return; }
      if (act === 'max') {
        isMaximized = !isMaximized;
        btn.textContent = isMaximized ? '还原' : '最大化';
        applyMaximize(isMaximized);
        return;
      }
      if (act === 'clear') { clearAll(); return; }
      if (act === 'prev') { if (matches.length > 0) gotoMatch(currentMatch - 1); return; }
      if (act === 'next') { if (matches.length > 0) gotoMatch(currentMatch + 1); return; }
    });

    /* ============================================================
       清空
       ============================================================ */
    function clearAll() {
      ta.value = '';
      rawCode = '';
      try { ctx.kit.kv.set('code', ''); } catch (e) {}
      searchInput.value = '';
      matches = [];
      currentMatch = -1;
      countEl.textContent = '0/0';
      drop.innerHTML = '';
      drop.classList.remove('pcs-on');
      renderHighlight();
      try { ctx.ui.toast('已清空'); } catch (e) {}
    }

    /* ============================================================
       两层同步
       ============================================================ */
    function syncScroll() {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(function () {
        scrollRaf = null;
        hl.scrollTop = ta.scrollTop;
        hl.scrollLeft = ta.scrollLeft;
      });
    }
    function syncPadding() {
      const sbw = ta.offsetWidth - ta.clientWidth;
      hl.style.paddingRight = (12 + Math.max(0, sbw)) + 'px';
    }
    ta.addEventListener('scroll', syncScroll, { passive: true });

    /* ============================================================
       高亮渲染
       ============================================================ */
    function renderHighlight() {
      const text = ta.value;
      if (matches.length === 0) {
        hl.textContent = text + NL;
        return;
      }
      let html = '';
      let pos = 0;
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        if (m.start > pos) html += escapeHTML(text.substring(pos, m.start));
        const cls = (i === currentMatch) ? ' class="pcs-cur"' : '';
        html += '<mark' + cls + '>' + escapeHTML(text.substring(m.start, m.end)) + '</mark>';
        pos = m.end;
      }
      if (pos < text.length) html += escapeHTML(text.substring(pos));
      html += NL;
      hl.innerHTML = html;
    }

    /* ============================================================
       搜索
       ============================================================ */
    function scanMatches() {
      const q = searchInput.value;
      const text = ta.value;
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
      const mEl = hl.querySelector('mark.pcs-cur');
      if (!mEl) return;
      const top = mEl.offsetTop;
      const h = ta.clientHeight;
      const mh = mEl.offsetHeight || 20;
      ta.scrollTop = Math.max(0, top - h / 2 + mh / 2);
      syncScroll();
    }

    function gotoMatch(n, focusIt) {
      if (matches.length === 0) {
        currentMatch = -1;
        countEl.textContent = '0/0';
        renderHighlight();
        return;
      }
      currentMatch = ((n % matches.length) + matches.length) % matches.length;
      renderHighlight();
      const m = matches[currentMatch];
      try { ta.setSelectionRange(m.start, m.end); } catch (e) {}
      requestAnimationFrame(function () { scrollToCurrentMark(); });
      if (focusIt !== false && isDesktop) {
        try { ta.focus({ preventScroll: true }); }
        catch (e) { try { ta.focus(); } catch (e2) {} }
      }
      countEl.textContent = (currentMatch + 1) + '/' + matches.length;
    }

    function buildDropdown() {
      if (matches.length === 0) {
        drop.innerHTML = '';
        drop.classList.remove('pcs-on');
        return;
      }
      const text = ta.value;
      const max = Math.min(matches.length, 200);
      let html = '';
      for (let i = 0; i < max; i++) {
        const m = matches[i];
        const lineStart = text.lastIndexOf(NL, m.start - 1) + 1;
        const lineEnd = text.indexOf(NL, m.end);
        const endAt = lineEnd === -1 ? text.length : lineEnd;
        const lineIdx = text.substring(0, m.start).split(NL).length;
        const before = text.substring(Math.max(lineStart, m.start - 20), m.start);
        const midText = text.substring(m.start, m.end);
        const after = text.substring(m.end, Math.min(endAt, m.end + 30));
        const preDot = (m.start - 20 > lineStart) ? '\u2026' : '';
        const sufDot = (m.end + 30 < endAt) ? '\u2026' : '';
        html += '<div class="pcs-drop-item" data-idx="' + i + '">' +
                  '<span class="pcs-drop-num">' + lineIdx + '</span>' +
                  escapeHTML(preDot + before) +
                  '<mark>' + escapeHTML(midText) + '</mark>' +
                  escapeHTML(after + sufDot) +
                '</div>';
      }
      drop.innerHTML = html;
      drop.classList.add('pcs-on');
    }

    /* 搜索输入 */
    searchInput.addEventListener('input', function () {
      scanMatches();
      if (matches.length > 0) {
        gotoMatch(0);
        buildDropdown();
      } else {
        countEl.textContent = '0/0';
        drop.innerHTML = '';
        drop.classList.remove('pcs-on');
        renderHighlight();
      }
    });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (matches.length > 0) gotoMatch(currentMatch + 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        searchInput.value = '';
        matches = [];
        currentMatch = -1;
        countEl.textContent = '0/0';
        drop.innerHTML = '';
        drop.classList.remove('pcs-on');
        renderHighlight();
      }
    });
    searchInput.addEventListener('focus', function () {
      if (matches.length > 0) drop.classList.add('pcs-on');
    });
    searchInput.addEventListener('blur', function () {
      setTimeout(function () { drop.classList.remove('pcs-on'); }, 200);
    });

    drop.addEventListener('mousedown', function (e) {
      const item = e.target.closest ? e.target.closest('.pcs-drop-item') : null;
      if (!item) return;
      e.preventDefault();
      const idx = parseInt(item.getAttribute('data-idx'), 10);
      if (isNaN(idx)) return;
      gotoMatch(idx);
      drop.classList.remove('pcs-on');
    });

    /* ============================================================
       编辑区输入：重扫 + 重绘，不跳转
       ============================================================ */
    ta.addEventListener('input', function () {
      rawCode = ta.value;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        try { ctx.kit.kv.set('code', rawCode); } catch (e) {}
      }, 400);

      if (!searchInput.value) {
        renderHighlight();
        return;
      }
      clearTimeout(rescanTimer);
      rescanTimer = setTimeout(function () {
        const selStart = ta.selectionStart;
        scanMatches();
        if (matches.length === 0) {
          countEl.textContent = '0/0';
          drop.innerHTML = '';
          drop.classList.remove('pcs-on');
          renderHighlight();
          return;
        }
        let found = -1;
        for (let i = 0; i < matches.length; i++) {
          if (matches[i].start <= selStart && selStart <= matches[i].end) {
            found = i;
            break;
          }
        }
        if (found >= 0) currentMatch = found;
        else if (currentMatch >= matches.length) currentMatch = matches.length - 1;
        else if (currentMatch < 0) currentMatch = 0;
        countEl.textContent = (currentMatch + 1) + '/' + matches.length;
        renderHighlight();
        if (searchInput.value) buildDropdown();
      }, 120);
    });

    /* ============================================================
       视口变化
       ============================================================ */
    function onResize() {
      if (!isMaximized) {
        clampWin();
        win.style.left = winL + 'px';
        win.style.top = winT + 'px';
        win.style.width = winW + 'px';
        win.style.height = winH + 'px';
      }
      clampBall();
      ball.style.left = ballL + 'px';
      ball.style.top = ballT + 'px';
      requestAnimationFrame(function () { syncPadding(); syncScroll(); });
    }
    window.addEventListener('resize', onResize);

    /* ============================================================
       初始：球态
       ============================================================ */
    minimizeWin();

    /* ============================================================
       清理
       ============================================================ */
    return function () {
      try { offCss(); } catch (e) {}
      try { window.removeEventListener('resize', onResize); } catch (e) {}
      try { ball.remove(); } catch (e) {}
      try { win.remove(); } catch (e) {}
      clearTimeout(saveTimer);
      clearTimeout(rescanTimer);
      clearTimeout(idleTimer);
    };
  },
};