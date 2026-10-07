export default {
  manifest: {
    id: "puff-setting-helper",
    name: "设定小助手",
    engine: "puff",
    apiVersion: 1,
    version: "1.0.2",
    description: "用大白话生成世界观 / 角色(NPC) / 玩家 / 联动设定，支持多存档与自定义模板",
    app: { name: "设定小助手", letter: "设" },
  },

  setup(ctx) {
    const kv = ctx.kit.kv;

    /* ------------------------------------------------------------------ */
    /* 默认模板                                                            */
    /* ------------------------------------------------------------------ */
    const DEFAULT_TEMPLATES = {
      world:
        "你是一个专业的设定生成助手。用户会给你一些零散的描述（大白话或草稿），请你将其提炼、扩写并整理成结构化的模板。必须使用中文。不要输出任何思考过程，直接输出最终的设定内容。\n" +
        "请整理成【世界观设定】，包含以下板块（如果用户没提可以合理脑补）：\n" +
        "【世界名称】\n【核心背景】\n【基本规则/设定】\n【主要势力/地区】\n【特色元素】",
      npc:
        "你是一个专业的设定生成助手。用户会给你一些零散的描述（大白话或草稿），请你将其提炼、扩写并整理成结构化的模板。必须使用中文。不要输出任何思考过程，直接输出最终的设定内容。\n" +
        "请整理成【角色(NPC)设定】，包含以下板块（如果用户没提可以合理脑补）：\n" +
        "【姓名/称号】\n【身份/职业】\n【外貌特征】\n【性格特点】\n【背景故事】\n【能力/特长】",
      user:
        "你是一个专业的设定生成助手。用户会给你一些零散的描述（大白话或草稿），请你将其提炼、扩写并整理成结构化的模板。必须使用中文。不要输出任何思考过程，直接输出最终的设定内容。\n" +
        "请整理成【玩家设定】，包含以下板块（如果用户没提可以合理脑补）：\n" +
        "【姓名】\n【身份/地位】\n【外貌特征】\n【性格特点】\n【过往经历】\n【核心动机/目标】",
      combo:
        "你是一个专业的设定生成助手。用户会给你一些零散的描述（大白话或草稿），请你将其提炼、扩写并整理成结构化的模板。必须使用中文。不要输出任何思考过程，直接输出最终的设定内容。\n" +
        "请从中提取信息，同时生成配套的设定，分为三大板块：\n" +
        "一、世界观设定（名称、背景、规则等）\n" +
        "二、玩家设定（姓名、身份、外貌、性格等）\n" +
        "三、重要NPC设定（姓名、身份、与玩家的关系等）",
    };

    const TYPES = [
      { value: "world", label: "世界观" },
      { value: "npc", label: "角色(NPC)" },
      { value: "user", label: "玩家设定" },
      { value: "combo", label: "联动生成" },
    ];

    const WELCOME =
      "你好！我是设定生成助手。你可以用大白话描述你想要的设定，或者直接把草稿发给我，我会帮你提炼并整理成标准的设定模板。\n\n" +
      "你也可以参考以下格式提供信息：\n【名称】\n【身份/背景】\n【核心特征】\n【其他补充】\n\n" +
      "支持生成：世界观、角色(NPC)、玩家设定，或者联动生成！点击左下角「+」还可以直接导入本地的 txt / md 文本文件哦。";

    /* ------------------------------------------------------------------ */
    /* 样式                                                                */
    /* ------------------------------------------------------------------ */
    const CSS = `
      .sh-page, .sh-page * { box-sizing: border-box; }

      .sh-page {
        position: absolute;
        top: 0; right: 0; bottom: 0; left: 0;
        display: flex; flex-direction: column;
        font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
        color: inherit;
        background: transparent;
        overflow: hidden;
      }
      .sh-view { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }

      /* 顶栏 */
      .sh-head {
        flex: 0 0 auto; display: flex; align-items: center; gap: 2px;
        padding: 8px 10px;
        padding-top: calc(8px + env(safe-area-inset-top, 0px));
        border-bottom: 1px solid rgba(127,127,127,.18);
      }
      .sh-head-side { flex: 0 0 auto; display: flex; gap: 2px; min-width: 72px; }
      .sh-right { justify-content: flex-end; }
      .sh-icon {
        width: 34px; height: 34px; padding: 0; border: 0; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        background: transparent; color: inherit; font-size: 17px; line-height: 1;
        cursor: pointer; -webkit-tap-highlight-color: transparent;
      }
      .sh-icon:active { background: rgba(127,127,127,.16); }
      .sh-title {
        flex: 1 1 auto; text-align: center; font-size: 15px; font-weight: 600;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }

      /* 聊天区 */
      .sh-chat {
        flex: 1 1 auto; min-height: 0; overflow-y: auto;
        padding: 14px 12px 6px; display: flex; flex-direction: column;
        -webkit-overflow-scrolling: touch;
      }
      .sh-msg { display: flex; flex-direction: column; max-width: 86%; margin-bottom: 14px; }
      .sh-user { align-self: flex-end; align-items: flex-end; }
      .sh-ai { align-self: flex-start; align-items: flex-start; }
      .sh-bubble {
        padding: 10px 13px; border-radius: 15px;
        font-size: 14px; line-height: 1.6;
        white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere;
      }
      .sh-user .sh-bubble {
        background: var(--accent, #4a7dff); color: var(--on-accent, #fff);
        border-bottom-right-radius: 5px;
      }
      .sh-ai .sh-bubble {
        background: rgba(127,127,127,.14); color: inherit;
        border-bottom-left-radius: 5px;
      }
      .sh-acts { display: flex; gap: 6px; margin-top: 6px; }
      .sh-mini {
        padding: 3px 10px; border-radius: 999px; cursor: pointer;
        border: 1px solid rgba(127,127,127,.3); background: transparent;
        color: inherit; opacity: .78; font-size: 12px; font-family: inherit;
        -webkit-tap-highlight-color: transparent;
      }
      .sh-mini:active { opacity: 1; background: rgba(127,127,127,.14); }
      .sh-mini.sh-primary {
        background: var(--accent, #4a7dff); color: var(--on-accent, #fff);
        border-color: transparent; opacity: 1;
      }

      /* 构思中 */
      .sh-thinking {
        display: flex; align-items: center; justify-content: center; gap: 8px;
        align-self: flex-start;
        margin: 2px 0 14px;
        padding: 8px 14px;
        border-radius: 14px;
        background: rgba(127,127,127,.14);
        color: inherit;
        font-size: 13px;
        opacity: .85;
      }
      .sh-spinner {
        width: 14px; height: 14px; border-radius: 50%;
        border: 2px solid rgba(127,127,127,.35);
        border-top-color: var(--accent, #4a7dff);
        animation: shSpin .8s linear infinite;
      }
      @keyframes shSpin { to { transform: rotate(360deg) } }

      /* 底部输入区 */
      .sh-foot {
        flex: 0 0 auto;
        padding: 8px 12px calc(10px + env(safe-area-inset-bottom, 0px));
        border-top: 1px solid rgba(127,127,127,.18);
      }
      .sh-types { display: flex; gap: 14px; overflow-x: auto; padding: 0 2px 8px; }
      .sh-types::-webkit-scrollbar { display: none; }
      .sh-type {
        display: flex; align-items: center; gap: 4px; white-space: nowrap;
        font-size: 13px; opacity: .7; cursor: pointer;
      }
      .sh-type input { accent-color: var(--accent, #4a7dff); }
      .sh-type.on { opacity: 1; font-weight: 600; }
      .sh-inputbar { display: flex; align-items: flex-end; gap: 6px; }
      .sh-plus {
        flex: 0 0 auto; width: 36px; height: 36px; padding: 0; border-radius: 50%;
        border: 1px solid rgba(127,127,127,.3); background: transparent;
        color: inherit; font-size: 20px; line-height: 1; cursor: pointer;
      }
      .sh-ta {
        flex: 1 1 auto; min-height: 36px; max-height: 110px; resize: none;
        padding: 8px 12px; border-radius: 16px; outline: none;
        border: 1px solid rgba(127,127,127,.3); background: rgba(127,127,127,.08);
        color: inherit; font-size: 14px; line-height: 1.45; font-family: inherit;
      }
      .sh-send {
        flex: 0 0 auto; height: 36px; padding: 0 16px; border: 0; border-radius: 16px;
        background: var(--accent, #4a7dff); color: var(--on-accent, #fff);
        font-size: 13px; font-family: inherit; cursor: pointer;
      }
      .sh-send:disabled { opacity: .5; cursor: not-allowed; }

      /* 设置视图 */
      .sh-setbody {
        flex: 1 1 auto; min-height: 0; overflow-y: auto;
        padding: 14px 14px calc(26px + env(safe-area-inset-bottom, 0px));
      }
      .sh-tip { font-size: 12.5px; opacity: .6; line-height: 1.55; margin-bottom: 14px; }
      .sh-field { margin-bottom: 16px; }
      .sh-label { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
      .sh-tpl {
        width: 100%; min-height: 96px; resize: vertical;
        padding: 10px; border-radius: 10px; outline: none;
        border: 1px solid rgba(127,127,127,.28); background: rgba(127,127,127,.08);
        color: inherit; font-size: 13px; line-height: 1.55; font-family: inherit;
      }
      .sh-setrow { display: flex; gap: 10px; margin-top: 8px; }
      .sh-btn {
        flex: 1 1 0; padding: 11px; border-radius: 10px; cursor: pointer;
        border: 1px solid rgba(127,127,127,.3); background: transparent;
        color: inherit; font-size: 14px; font-family: inherit;
        -webkit-tap-highlight-color: transparent;
      }
      .sh-btn:active { background: rgba(127,127,127,.14); }
      .sh-btn.sh-primary {
        background: var(--accent, #4a7dff); color: var(--on-accent, #fff);
        border-color: transparent;
      }

      /* 抽屉 */
      .sh-drawer-wrap { position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: 50; }
      .sh-drawer-mask {
        position: absolute; top: 0; right: 0; bottom: 0; left: 0;
        background: rgba(0,0,0,.28);
      }
      .sh-drawer {
        position: absolute; top: 0; bottom: 0; left: 0;
        width: 78%; max-width: 320px;
        display: flex; flex-direction: column;
        transform: translateX(-100%); transition: transform .26s ease;
        background: #f7f7f9; color: #1c1c1e;
        border-right: 1px solid rgba(127,127,127,.24);
        box-shadow: 4px 0 24px rgba(0,0,0,.22);
        padding-top: env(safe-area-inset-top, 0px);
      }
      .sh-drawer-wrap.open .sh-drawer { transform: translateX(0); }
      .sh-drawer-head {
        flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between;
        padding: 10px 8px 10px 16px; border-bottom: 1px solid rgba(127,127,127,.22);
      }
      .sh-drawer-title { font-size: 15px; font-weight: 600; }
      .sh-drawer-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 10px; }
      .sh-drawer-foot {
        flex: 0 0 auto; padding: 12px;
        padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
        border-top: 1px solid rgba(127,127,127,.22);
      }
      .sh-arc {
        display: flex; align-items: center; gap: 8px;
        padding: 11px 12px; margin-bottom: 8px; border-radius: 10px;
        border: 1px solid rgba(127,127,127,.22);
        background: rgba(127,127,127,.08);
        cursor: pointer;
      }
      .sh-arc.active {
        border-color: var(--accent, #4a7dff);
        background: rgba(74,125,255,.14);
      }
      .sh-arc-name {
        flex: 1 1 auto; font-size: 14px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .sh-arc-tools { flex: 0 0 auto; display: flex; gap: 4px; }
      .sh-arc .sh-mini {
        border-color: rgba(127,127,127,.32);
        color: inherit; opacity: .82;
      }

      /* 弹窗 */
      .sh-mask {
        position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: 80;
        padding: 22px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,.32);
        animation: shFade .16s ease;
      }
      @keyframes shFade { from { opacity: 0 } to { opacity: 1 } }

      .sh-modal {
        width: 100%; max-width: 330px; padding: 18px;
        border-radius: 16px;
        background: #ffffff; color: #1c1c1e;
        box-shadow: 0 18px 48px rgba(0,0,0,.3);
      }
      .sh-modal-title { font-size: 15px; font-weight: 600; margin-bottom: 10px; }
      .sh-modal-msg { font-size: 13.5px; line-height: 1.55; margin-bottom: 14px; opacity: .85; }
      .sh-modal-input {
        width: 100%; padding: 9px 11px; margin-bottom: 14px; border-radius: 9px;
        border: 1px solid rgba(60,60,67,.22);
        background: rgba(120,120,128,.1);
        color: inherit; font-size: 14px; font-family: inherit;
        outline: none; resize: vertical; line-height: 1.5;
      }
      .sh-modal-row { display: flex; justify-content: flex-end; gap: 8px; }
      .sh-modal .sh-mini { border-color: rgba(60,60,67,.24); opacity: .9; }

      @media (prefers-color-scheme: dark) {
        .sh-drawer {
          background: #1c1c1e; color: #f2f2f7;
          border-right-color: rgba(235,235,245,.18);
        }
        .sh-drawer-mask { background: rgba(0,0,0,.5); }
        .sh-drawer-head,
        .sh-drawer-foot { border-color: rgba(235,235,245,.16); }
        .sh-arc {
          border-color: rgba(235,235,245,.18);
          background: rgba(120,120,128,.24);
        }
        .sh-arc .sh-mini { border-color: rgba(235,235,245,.26); }

        .sh-modal {
          background: #2c2c2e; color: #f2f2f7;
          box-shadow: 0 18px 48px rgba(0,0,0,.5);
        }
        .sh-modal-input {
          border-color: rgba(235,235,245,.22);
          background: rgba(120,120,128,.28);
        }
        .sh-modal .sh-mini { border-color: rgba(235,235,245,.26); }
      }
    `;

    ctx.ui.css(CSS);

    /* ------------------------------------------------------------------ */
    /* 工具                                                                */
    /* ------------------------------------------------------------------ */
    function el(tag, cls, txt) {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (txt != null) n.textContent = txt;
      return n;
    }

    function icon(path, size) {
      const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      s.setAttribute("viewBox", "0 0 24 24");
      s.setAttribute("width", size || 20);
      s.setAttribute("height", size || 20);
      s.setAttribute("fill", "none");
      s.setAttribute("stroke", "currentColor");
      s.setAttribute("stroke-width", "2");
      s.setAttribute("stroke-linecap", "round");
      s.setAttribute("stroke-linejoin", "round");
      s.innerHTML = path;
      return s;
    }

    const P_ARROW = '<polyline points="15 18 9 12 15 6"></polyline>';
    const P_MENU =
      '<line x1="3" y1="6" x2="21" y2="6"></line>' +
      '<line x1="3" y1="12" x2="21" y2="12"></line>' +
      '<line x1="3" y1="18" x2="21" y2="18"></line>';
    const P_GEAR =
      '<circle cx="12" cy="12" r="3"></circle>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>';
    const P_CLOSE =
      '<line x1="18" y1="6" x2="6" y2="18"></line>' +
      '<line x1="6" y1="6" x2="18" y2="18"></line>';

    /* ------------------------------------------------------------------ */
    /* 存储读写                                                            */
    /* ------------------------------------------------------------------ */
    function readArchives() {
      let list = kv.get("archives");
      if (!Array.isArray(list) || list.length === 0) {
        list = [{ id: "default", name: "默认存档" }];
        kv.set("archives", list);
      }
      return list;
    }

    function readCurrentId(list) {
      let id = kv.get("current_archive_id");
      if (!id || !list.some(function (a) { return a.id === id; })) {
        id = list[0].id;
        kv.set("current_archive_id", id);
      }
      return id;
    }

    function readTemplates() {
      const saved = kv.get("templates");
      return Object.assign({}, DEFAULT_TEMPLATES, saved && typeof saved === "object" ? saved : {});
    }

    function readHistory(id) {
      const h = kv.get("chat_" + id);
      return Array.isArray(h) ? h : [];
    }

    /* ------------------------------------------------------------------ */
    /* 全屏页                                                              */
    /* ------------------------------------------------------------------ */
    const offPage = ctx.ui.appPage(function (root, helpers) {
      root.innerHTML = "";
      root.style.position = "relative";
      root.style.display = "block";
      root.style.width = "100%";
      root.style.height = "100%";
      root.style.minHeight = "0";
      root.style.overflow = "hidden";

      /* ---- 会话状态 ---- */
      let archives = readArchives();
      let currentId = readCurrentId(archives);
      let templates = readTemplates();
      let history = readHistory(currentId);
      let type = TYPES[0].value;
      let busy = false;      // 请求进行中（防重复发送）
      let pending = false;   // 是否展示"构思中"

      /* ---- 骨架 ---- */
      const page = el("div", "sh-page");
      root.appendChild(page);

      /* ================= 主视图 ================= */
      const mainView = el("div", "sh-view");

      const head = el("div", "sh-head");
      const headL = el("div", "sh-head-side");
      const headR = el("div", "sh-head-side sh-right");

      const btnBack = el("button", "sh-icon");
      btnBack.type = "button";
      btnBack.title = "返回";
      btnBack.appendChild(icon(P_ARROW));
      btnBack.onclick = function () {
        if (helpers && typeof helpers.close === "function") helpers.close();
      };

      const btnMenu = el("button", "sh-icon");
      btnMenu.type = "button";
      btnMenu.title = "存档";
      btnMenu.appendChild(icon(P_MENU));
      btnMenu.onclick = openDrawer;

      const titleEl = el("div", "sh-title", "设定小助手");

      const btnGear = el("button", "sh-icon");
      btnGear.type = "button";
      btnGear.title = "模板设置";
      btnGear.appendChild(icon(P_GEAR, 19));
      btnGear.onclick = openSettings;

      headL.appendChild(btnBack);
      headL.appendChild(btnMenu);
      headR.appendChild(btnGear);
      head.appendChild(headL);
      head.appendChild(titleEl);
      head.appendChild(headR);

      const chatBox = el("div", "sh-chat");

      /* ---- 底部输入区 ---- */
      const foot = el("div", "sh-foot");
      const typesRow = el("div", "sh-types");
      const typeRefs = [];

      TYPES.forEach(function (t) {
        const lab = el("label", "sh-type");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "sh-gtype";
        radio.value = t.value;
        if (t.value === type) radio.checked = true;
        radio.onchange = function () {
          type = t.value;
          syncTypes();
        };
        lab.appendChild(radio);
        lab.appendChild(document.createTextNode(t.label));
        typesRow.appendChild(lab);
        typeRefs.push({ el: lab, radio: radio });
      });

      function syncTypes() {
        typeRefs.forEach(function (r) {
          r.el.classList.toggle("on", r.radio.checked);
        });
      }
      syncTypes();

      const inputBar = el("div", "sh-inputbar");

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".txt,.md,.json";
      fileInput.style.display = "none";
      fileInput.onchange = function () {
        const f = fileInput.files && fileInput.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = function (e) {
          const text = String(e.target.result || "");
          ta.value = ta.value ? ta.value + "\n\n" + text : text;
          autoResize();
          fileInput.value = "";
        };
        reader.readAsText(f);
      };

      const btnPlus = el("button", "sh-plus", "+");
      btnPlus.type = "button";
      btnPlus.title = "导入 txt / md";
      btnPlus.onclick = function () { fileInput.click(); };

      const ta = el("textarea", "sh-ta");
      ta.rows = 1;
      ta.placeholder = "输入灵感、大白话或草稿…";
      ta.oninput = autoResize;
      ta.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      });

      const btnSend = el("button", "sh-send", "发送");
      btnSend.type = "button";
      btnSend.onclick = send;

      inputBar.appendChild(fileInput);
      inputBar.appendChild(btnPlus);
      inputBar.appendChild(ta);
      inputBar.appendChild(btnSend);

      foot.appendChild(typesRow);
      foot.appendChild(inputBar);

      mainView.appendChild(head);
      mainView.appendChild(chatBox);
      mainView.appendChild(foot);

      /* ================= 设置视图 ================= */
      const setView = el("div", "sh-view");
      setView.style.display = "none";

      const setHead = el("div", "sh-head");
      const setHeadL = el("div", "sh-head-side");
      const setBack = el("button", "sh-icon");
      setBack.type = "button";
      setBack.appendChild(icon(P_ARROW));
      setBack.onclick = function () { showView("chat"); };
      setHeadL.appendChild(setBack);
      const setHeadR = el("div", "sh-head-side sh-right");
      setHead.appendChild(setHeadL);
      setHead.appendChild(el("div", "sh-title", "模板设置"));
      setHead.appendChild(setHeadR);

      const setBody = el("div", "sh-setbody");
      setBody.appendChild(
        el(
          "div",
          "sh-tip",
          "以下模板会作为隐藏提示词发送给 AI，指导它按你的格式输出。修改后点击「保存修改」生效。"
        )
      );

      const fields = {};
      [
        ["world", "世界观模板"],
        ["npc", "角色(NPC)模板"],
        ["user", "玩家设定模板"],
        ["combo", "联动生成模板"],
      ].forEach(function (pair) {
        const f = el("div", "sh-field");
        f.appendChild(el("div", "sh-label", pair[1]));
        const box = el("textarea", "sh-tpl");
        f.appendChild(box);
        setBody.appendChild(f);
        fields[pair[0]] = box;
      });

      const setRow = el("div", "sh-setrow");
      const btnReset = el("button", "sh-btn", "恢复默认");
      btnReset.type = "button";
      btnReset.onclick = function () {
        askConfirm("确定恢复系统默认模板吗？", function (ok) {
          if (!ok) return;
          fields.world.value = DEFAULT_TEMPLATES.world;
          fields.npc.value = DEFAULT_TEMPLATES.npc;
          fields.user.value = DEFAULT_TEMPLATES.user;
          fields.combo.value = DEFAULT_TEMPLATES.combo;
        });
      };
      const btnSave = el("button", "sh-btn sh-primary", "保存修改");
      btnSave.type = "button";
      btnSave.onclick = function () {
        templates = {
          world: fields.world.value,
          npc: fields.npc.value,
          user: fields.user.value,
          combo: fields.combo.value,
        };
        kv.set("templates", templates);
        ctx.ui.toast("模板已保存");
        showView("chat");
      };
      setRow.appendChild(btnReset);
      setRow.appendChild(btnSave);
      setBody.appendChild(setRow);

      setView.appendChild(setHead);
      setView.appendChild(setBody);

      /* ================= 抽屉 ================= */
      const drawerWrap = el("div", "sh-drawer-wrap");
      drawerWrap.style.display = "none";
      const dMask = el("div", "sh-drawer-mask");
      dMask.onclick = closeDrawer;

      const dPanel = el("div", "sh-drawer");
      const dHead = el("div", "sh-drawer-head");
      dHead.appendChild(el("div", "sh-drawer-title", "存档管理"));
      const dClose = el("button", "sh-icon");
      dClose.type = "button";
      dClose.appendChild(icon(P_CLOSE, 18));
      dClose.onclick = closeDrawer;
      dHead.appendChild(dClose);

      const dList = el("div", "sh-drawer-list");

      const dFoot = el("div", "sh-drawer-foot");
      const btnNew = el("button", "sh-btn sh-primary", "+ 新建存档");
      btnNew.type = "button";
      btnNew.onclick = createArchive;
      dFoot.appendChild(btnNew);

      dPanel.appendChild(dHead);
      dPanel.appendChild(dList);
      dPanel.appendChild(dFoot);
      drawerWrap.appendChild(dMask);
      drawerWrap.appendChild(dPanel);

      page.appendChild(mainView);
      page.appendChild(setView);
      page.appendChild(drawerWrap);

      /* ================================================================ */
      /* 视图切换                                                          */
      /* ================================================================ */
      function showView(name) {
        mainView.style.display = name === "chat" ? "flex" : "none";
        setView.style.display = name === "settings" ? "flex" : "none";
        if (name === "chat") {
          requestAnimationFrame(scrollBottom);
        }
      }

      function openSettings() {
        fields.world.value = templates.world;
        fields.npc.value = templates.npc;
        fields.user.value = templates.user;
        fields.combo.value = templates.combo;
        showView("settings");
      }

      /* ================================================================ */
      /* 消息渲染                                                          */
      /* ================================================================ */
      function scrollBottom() {
        chatBox.scrollTop = chatBox.scrollHeight;
      }

      function autoResize() {
        ta.style.height = "auto";
        ta.style.height = Math.max(36, Math.min(ta.scrollHeight, 110)) + "px";
      }

      function buildMsg(m, index) {
        const wrap = el("div", "sh-msg " + (m.role === "user" ? "sh-user" : "sh-ai"));
        wrap.appendChild(el("div", "sh-bubble", String(m.content || "")));

        const acts = el("div", "sh-acts");

        if (m.role === "ai") {
          const c = el("button", "sh-mini", "复制");
          c.type = "button";
          c.onclick = function () { copyText(m.content); };
          acts.appendChild(c);
        }

        const e = el("button", "sh-mini", "修改");
        e.type = "button";
        e.onclick = function () { editMsg(index); };
        acts.appendChild(e);

        const d = el("button", "sh-mini", "删除");
        d.type = "button";
        d.onclick = function () { delMsg(index); };
        acts.appendChild(d);

        wrap.appendChild(acts);
        return wrap;
      }

      function renderChat() {
        chatBox.innerHTML = "";

        // 欢迎语
        const w = el("div", "sh-msg sh-ai");
        w.appendChild(el("div", "sh-bubble", WELCOME));
        chatBox.appendChild(w);

        // 历史消息
        history.forEach(function (m, i) {
          chatBox.appendChild(buildMsg(m, i));
        });

        // 构思中（由状态驱动，不会被后续渲染清掉）
        if (pending) {
          const t = el("div", "sh-thinking");
          t.appendChild(el("div", "sh-spinner"));
          t.appendChild(document.createTextNode("助手正在构思中…"));
          chatBox.appendChild(t);
        }

        requestAnimationFrame(scrollBottom);
      }

      function updateTitle() {
        const cur = archives.filter(function (a) { return a.id === currentId; })[0];
        titleEl.textContent = cur ? cur.name : "设定小助手";
      }

      /* ================================================================ */
      /* 复制 / 编辑 / 删除                                                */
      /* ================================================================ */
      function copyText(text) {
        const done = function () { ctx.ui.toast("已复制"); };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(String(text)).then(done, function () {
              fallbackCopy(text, done);
            });
            return;
          }
        } catch (e) {}
        fallbackCopy(text, done);
      }

      function fallbackCopy(text, done) {
        const box = document.createElement("textarea");
        box.value = String(text);
        box.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
        document.body.appendChild(box);
        box.select();
        try {
          document.execCommand("copy");
          done();
        } catch (e) {
          ctx.ui.toast("复制失败，请手动复制");
        }
        document.body.removeChild(box);
      }

      function editMsg(index) {
        overlay(function (box, close) {
          box.appendChild(el("div", "sh-modal-title", "修改内容"));
          const t = el("textarea", "sh-modal-input");
          t.style.minHeight = "150px";
          t.value = history[index].content;
          box.appendChild(t);

          const row = el("div", "sh-modal-row");
          const cancel = el("button", "sh-mini", "取消");
          cancel.type = "button";
          cancel.onclick = close;
          const ok = el("button", "sh-mini sh-primary", "保存");
          ok.type = "button";
          ok.onclick = function () {
            const v = t.value.trim();
            if (v && v !== history[index].content) {
              history[index].content = v;
              saveHistory();
              renderChat();
            }
            close();
          };
          row.appendChild(cancel);
          row.appendChild(ok);
          box.appendChild(row);
        });
      }

      function delMsg(index) {
        askConfirm("确定要删除这条记录吗？", function (ok) {
          if (!ok) return;
          history.splice(index, 1);
          saveHistory();
          renderChat();
        });
      }

      /* ================================================================ */
      /* 发送                                                              */
      /* ================================================================ */
      function saveHistory() {
        if (history.length > 60) history = history.slice(history.length - 60);
        kv.set("chat_" + currentId, history);
      }

      async function send() {
        if (busy) return;
        const text = ta.value.trim();
        if (!text) return;

        busy = true;
        btnSend.disabled = true;
        ta.value = "";
        autoResize();

        history.push({ role: "user", content: text, type: type });
        saveHistory();

        // 打开"构思中"
        pending = true;
        renderChat();

        try {
          const sys = templates[type] || DEFAULT_TEMPLATES[type];
          let out = await ctx.model.ask({
            system: sys,
            prompt: text,
            temperature: 0.85,
          });

          if (out && typeof out === "object") out = out.text || out.content || "";
          out = String(out || "")
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            .trim();
          if (!out) out = "（模型没有返回内容，请重试）";

          history.push({ role: "ai", content: out });
          saveHistory();
        } catch (err) {
          history.push({
            role: "ai",
            content: "生成失败：" + (err && err.message ? err.message : String(err)),
          });
          saveHistory();
        } finally {
          pending = false;
          busy = false;
          btnSend.disabled = false;
          renderChat();
        }
      }

      /* ================================================================ */
      /* 弹窗                                                              */
      /* ================================================================ */
      function overlay(build) {
        const mask = el("div", "sh-mask");
        const box = el("div", "sh-modal");
        mask.appendChild(box);
        page.appendChild(mask);

        let closed = false;
        function close() {
          if (closed) return;
          closed = true;
          if (mask.parentNode) mask.parentNode.removeChild(mask);
        }

        mask.addEventListener("click", function (e) {
          if (e.target === mask) close();
        });

        build(box, close);
        return close;
      }

      function askInput(title, def, cb) {
        overlay(function (box, close) {
          box.appendChild(el("div", "sh-modal-title", title));
          const input = el("input", "sh-modal-input");
          input.type = "text";
          input.value = def || "";
          box.appendChild(input);

          const row = el("div", "sh-modal-row");
          const cancel = el("button", "sh-mini", "取消");
          cancel.type = "button";
          cancel.onclick = function () { close(); cb(null); };
          const ok = el("button", "sh-mini sh-primary", "确定");
          ok.type = "button";
          ok.onclick = function () { const v = input.value.trim(); close(); cb(v); };

          row.appendChild(cancel);
          row.appendChild(ok);
          box.appendChild(row);

          setTimeout(function () { input.focus(); input.select(); }, 60);
          input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") ok.click();
          });
        });
      }

      function askConfirm(msg, cb) {
        overlay(function (box, close) {
          box.appendChild(el("div", "sh-modal-title", "提示"));
          box.appendChild(el("div", "sh-modal-msg", msg));

          const row = el("div", "sh-modal-row");
          const cancel = el("button", "sh-mini", "取消");
          cancel.type = "button";
          cancel.onclick = function () { close(); cb(false); };
          const ok = el("button", "sh-mini sh-primary", "确定");
          ok.type = "button";
          ok.onclick = function () { close(); cb(true); };

          row.appendChild(cancel);
          row.appendChild(ok);
          box.appendChild(row);
        });
      }

      /* ================================================================ */
      /* 存档                                                              */
      /* ================================================================ */
      function openDrawer() {
        renderArchives();
        drawerWrap.style.display = "";
        requestAnimationFrame(function () {
          drawerWrap.classList.add("open");
        });
      }

      function closeDrawer() {
        drawerWrap.classList.remove("open");
        setTimeout(function () {
          drawerWrap.style.display = "none";
        }, 260);
      }

      function renderArchives() {
        dList.innerHTML = "";
        archives.forEach(function (a) {
          const item = el("div", "sh-arc" + (a.id === currentId ? " active" : ""));
          item.appendChild(el("div", "sh-arc-name", a.name));

          const tools = el("div", "sh-arc-tools");

          const e = el("button", "sh-mini", "改名");
          e.type = "button";
          e.onclick = function (ev) {
            ev.stopPropagation();
            renameArchive(a);
          };

          const d = el("button", "sh-mini", "删除");
          d.type = "button";
          d.onclick = function (ev) {
            ev.stopPropagation();
            removeArchive(a);
          };

          tools.appendChild(e);
          tools.appendChild(d);
          item.appendChild(tools);

          item.onclick = function () { switchArchive(a.id); };
          dList.appendChild(item);
        });
      }

      function switchArchive(id) {
        if (id === currentId) {
          closeDrawer();
          return;
        }
        currentId = id;
        kv.set("current_archive_id", id);
        history = readHistory(id);
        updateTitle();
        renderChat();
        renderArchives();
        closeDrawer();
      }

      function createArchive() {
        askInput("请输入新存档名称", "新存档", function (name) {
          if (!name) return;
          const id = "arc_" + Date.now();
          archives.push({ id: id, name: name });
          kv.set("archives", archives);
          currentId = id;
          kv.set("current_archive_id", id);
          history = [];
          kv.set("chat_" + id, history);
          updateTitle();
          renderChat();
          renderArchives();
          closeDrawer();
        });
      }

      function renameArchive(a) {
        askInput("重命名存档", a.name, function (name) {
          if (!name || name === a.name) return;
          a.name = name;
          kv.set("archives", archives);
          updateTitle();
          renderArchives();
        });
      }

      function removeArchive(a) {
        askConfirm('确定要删除存档「' + a.name + '」吗？记录将无法恢复。', function (ok) {
          if (!ok) return;

          kv.remove("chat_" + a.id);
          archives = archives.filter(function (x) { return x.id !== a.id; });

          if (archives.length === 0) {
            const nid = "arc_" + Date.now();
            archives = [{ id: nid, name: "新存档" }];
            currentId = nid;
            history = [];
          } else if (currentId === a.id) {
            currentId = archives[0].id;
            history = readHistory(currentId);
          }

          kv.set("archives", archives);
          kv.set("current_archive_id", currentId);

          updateTitle();
          renderChat();
          renderArchives();
        });
      }

      /* ================================================================ */
      /* 启动                                                              */
      /* ================================================================ */
      updateTitle();
      renderChat();
      showView("chat");
    });

    return offPage;
  },
};