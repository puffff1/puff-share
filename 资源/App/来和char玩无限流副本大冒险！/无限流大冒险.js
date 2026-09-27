export default {
  manifest: {
    id: "puff-infinite-quest",
    name: "无限流冒险",
    engine: "puff",
    apiVersion: 1,
    version: "1.3.0",
    description: "随机生成无限流冒险世界，和你的角色组队闯关。同伴的性别 / 口吻 / 行动方式跟随内置人设",
    app: { name: "冒险", letter: "险", icon: "🗺️" },
    settings: [
      { key: "difficulty", label: "难度", type: "select", default: "标准", options: ["轻松", "标准", "残酷"] },
      { key: "tease", label: "角色吐槽密度", type: "select", default: "话痨", options: ["安静", "正常", "话痨"] },
      { key: "length", label: "单回合剧情字数", type: "number", default: 200, description: "建议 150～300，太长会变慢" },
      { key: "partnerGender", label: "同伴性别", type: "select", default: "自动", options: ["自动", "男", "女", "不指定"], description: "自动 = 由 AI 根据角色人设判断" },
      { key: "genderStrict", label: "严格贴合性别口吻", type: "boolean", default: true, description: "关闭后性别只作参考，更强调性格" },
    ],
  },

  setup(ctx) {
    /* ============ CSS ============ */
    ctx.ui.css([
      ".iq-root{position:relative;display:flex;flex-direction:column;height:100%;box-sizing:border-box;padding:14px 14px 18px;gap:10px;font:14px/1.65 -apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;color:#e9e3d8;background:radial-gradient(130% 70% at 50% 0%,#1e2436 0%,#131722 58%,#0b0d13 100%);overflow:hidden;}",
      ".iq-root *{box-sizing:border-box;}",

      ".iq-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:0 0 auto;}",
      ".iq-titlebox{min-width:0;display:flex;align-items:baseline;gap:6px;}",
      ".iq-world{font-size:15px;font-weight:700;letter-spacing:.4px;color:#ffd79a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".iq-meta{font-size:11px;opacity:.55;white-space:nowrap;}",

      ".iq-btn{border:0;border-radius:11px;padding:7px 13px;font:inherit;font-size:12.5px;color:#e9e3d8;background:rgba(255,255,255,.08);cursor:pointer;touch-action:manipulation;transition:transform .12s,background .15s;}",
      ".iq-btn:active{transform:scale(.94);}",
      ".iq-btn.primary{background:linear-gradient(135deg,#ffc061,#ff8358);color:#251a0e;font-weight:700;}",

      ".iq-status{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07);flex:0 0 auto;}",
      ".iq-row{display:flex;align-items:center;gap:8px;font-size:11px;}",
      ".iq-row .lb{width:30px;opacity:.6;letter-spacing:1px;flex:0 0 auto;}",
      ".iq-track{flex:1;height:7px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;}",
      ".iq-fill{height:100%;border-radius:99px;transition:width .45s ease;}",
      ".iq-num{font-size:10.5px;opacity:.68;min-width:66px;text-align:right;font-variant-numeric:tabular-nums;}",
      ".iq-stats{font-size:11px;opacity:.6;padding-top:2px;letter-spacing:.3px;}",

      ".iq-partner{display:flex;gap:10px;padding:10px 12px;border-radius:14px;background:linear-gradient(135deg,rgba(255,180,84,.13),rgba(255,255,255,.035));border:1px solid rgba(255,180,84,.18);flex:0 0 auto;}",
      ".iq-ava{width:38px;height:38px;flex:0 0 38px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;color:#ffd79a;background:rgba(255,180,84,.18);}",
      ".iq-pinfo{flex:1;min-width:0;}",
      ".iq-pname{font-size:13px;font-weight:700;color:#ffd79a;display:flex;gap:5px;align-items:center;flex-wrap:wrap;}",
      ".iq-chip{font-size:10px;padding:1px 7px;border-radius:99px;background:rgba(255,255,255,.1);font-weight:400;color:#cfc8bb;white-space:nowrap;}",
      ".iq-chip.g{background:rgba(140,190,255,.16);color:#a9cdff;}",
      ".iq-chip.b{background:rgba(255,150,180,.16);color:#ffb3c8;}",
      ".iq-say{margin-top:6px;font-size:12.5px;line-height:1.55;color:#f4e0d2;background:rgba(0,0,0,.24);border-left:2px solid #ffb454;padding:6px 9px;border-radius:0 9px 9px 0;}",

      ".iq-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;flex:0 0 auto;}",
      ".iq-tabs::-webkit-scrollbar{display:none;}",
      ".iq-tab{flex:0 0 auto;border:0;border-radius:99px;padding:5px 13px;font:inherit;font-size:12px;background:rgba(255,255,255,.06);color:#bdb6aa;cursor:pointer;touch-action:manipulation;}",
      ".iq-tab.on{background:#ffb454;color:#251a0e;font-weight:700;}",

      ".iq-body{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding-right:3px;}",
      ".iq-body::-webkit-scrollbar{width:4px;}",
      ".iq-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:9px;}",

      ".iq-story-list{display:flex;flex-direction:column;gap:11px;}",
      ".iq-story{font-size:13.5px;line-height:1.9;color:#ded7ca;letter-spacing:.25px;white-space:pre-wrap;}",
      ".iq-npc{display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.75;color:#d6dff0;}",
      ".iq-npc .em{font-size:17px;line-height:1.4;flex:0 0 auto;}",
      ".iq-npc .who{color:#8fd0ff;font-weight:600;}",
      ".iq-charline{display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.75;color:#f5d9c4;background:rgba(255,180,84,.08);border-radius:11px;padding:8px 11px;}",
      ".iq-charline .em{flex:0 0 auto;}",
      ".iq-charact{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.75;color:#cfc9be;background:rgba(255,255,255,.045);border-radius:11px;padding:8px 11px;font-style:italic;}",
      ".iq-you{font-size:13px;color:#ffd79a;padding-left:11px;border-left:2px solid rgba(255,180,84,.55);line-height:1.7;white-space:pre-wrap;}",
      ".iq-sys{font-size:11.5px;line-height:1.7;color:#9fe8ab;background:rgba(120,255,150,.07);border-radius:10px;padding:7px 11px;white-space:pre-wrap;}",

      ".iq-opts{display:flex;flex-direction:column;gap:8px;}",
      ".iq-opt{text-align:left;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.045);border-radius:12px;padding:11px 13px;font:inherit;font-size:13px;line-height:1.6;color:#e9e3d8;cursor:pointer;touch-action:manipulation;transition:.15s;}",
      ".iq-opt:active{background:rgba(255,180,84,.18);border-color:rgba(255,180,84,.45);transform:scale(.985);}",
      ".iq-opt .idx{color:#ffb454;font-weight:700;margin-right:7px;}",

      ".iq-input{display:flex;gap:8px;}",
      ".iq-input input{flex:1;min-width:0;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.22);border-radius:12px;padding:10px 12px;font:inherit;font-size:13px;color:#e9e3d8;outline:none;}",
      ".iq-input input:focus{border-color:rgba(255,180,84,.5);}",
      ".iq-input input::placeholder{color:rgba(255,255,255,.28);}",

      ".iq-loading{display:flex;flex-direction:column;gap:10px;align-items:center;padding:20px 10px;}",
      ".iq-thinking{font-size:12.5px;opacity:.7;letter-spacing:1px;animation:iq-blink 1.4s infinite;text-align:center;}",
      ".iq-timer{font-size:11px;opacity:.5;text-align:center;}",
      "@keyframes iq-blink{0%,100%{opacity:.35}50%{opacity:.85}}",

      ".iq-cards{display:flex;flex-direction:column;gap:8px;}",
      ".iq-card{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);border-radius:13px;padding:11px 13px;}",
      ".iq-card.done{opacity:.5;}",
      ".iq-card h4{margin:0 0 5px;font-size:13px;font-weight:600;display:flex;gap:6px;align-items:center;flex-wrap:wrap;color:#f0e8da;}",
      ".iq-card p{margin:0;font-size:11.5px;line-height:1.65;opacity:.72;white-space:pre-wrap;}",

      ".iq-empty{font-size:12.5px;opacity:.55;text-align:center;padding:34px 10px;line-height:1.8;}",

      ".iq-center{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;flex:1;text-align:center;padding:26px 6px;overflow-y:auto;width:100%;}",
      ".iq-hero{font-size:52px;line-height:1;margin-bottom:14px;filter:drop-shadow(0 0 18px rgba(255,180,84,.45));}",
      ".iq-hero-t{font-size:20px;font-weight:800;letter-spacing:2px;color:#ffd79a;}",
      ".iq-hero-d{font-size:12.5px;opacity:.6;margin-top:10px;line-height:1.9;max-width:280px;white-space:pre-wrap;}",

      ".iq-h2{font-size:14px;font-weight:700;color:#ffd79a;margin-bottom:6px;width:100%;text-align:left;}",
      ".iq-hint{font-size:11.5px;opacity:.58;line-height:1.8;margin-bottom:8px;width:100%;text-align:left;}",
      ".iq-grid{display:flex;flex-direction:column;gap:8px;width:100%;}",
      ".iq-pcard{display:flex;align-items:center;gap:11px;text-align:left;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.045);border-radius:14px;padding:11px 13px;font:inherit;color:#e9e3d8;cursor:pointer;touch-action:manipulation;transition:.15s;-webkit-tap-highlight-color:transparent;}",
      ".iq-pcard:active{background:rgba(255,180,84,.16);border-color:rgba(255,180,84,.4);}",
      ".iq-pava{width:38px;height:38px;flex:0 0 38px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#ffd79a;background:rgba(255,180,84,.16);font-size:16px;}",
      ".iq-pname2{font-size:13.5px;font-weight:700;color:#ffd79a;}",
      ".iq-pdesc{font-size:11.5px;opacity:.6;margin-top:2px;line-height:1.55;}",

      ".iq-mask{position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;z-index:20;}",
      ".iq-sheet{width:100%;max-width:460px;background:#1b1f2b;border-radius:18px 18px 0 0;padding:12px 12px 20px;display:flex;flex-direction:column;gap:7px;border-top:1px solid rgba(255,255,255,.1);}",
      ".iq-sheet button{border:0;background:rgba(255,255,255,.06);color:#e9e3d8;font:inherit;font-size:14px;padding:14px;border-radius:13px;text-align:center;cursor:pointer;touch-action:manipulation;}",
      ".iq-sheet button:active{background:rgba(255,255,255,.15);}",
      ".iq-sheet button.danger{color:#ff8f8f;}",
    ].join("\n"));

    /* ============ 常量 ============ */
    const LOG_CAP = 200;
    const SAVE_KEY = "save";

    const TABS = [
      ["story", "📜 冒险"],
      ["bag", "🎒 背包"],
      ["skill", "✨ 技能"],
      ["quest", "🎯 任务"],
      ["ach", "🏆 成就"],
      ["save", "💾 存档点"],
      ["mate", "👥 同伴"],
    ];

    const WORLD_SYS = [
      "你是「无限流」冒险游戏的主持人（GM）。文字要具体、有活人气息：多写气味、温度、触感、声音、身体反应，少用空泛形容词。",
      "铁律：",
      "1. 只输出一个 JSON 对象。不要 markdown 代码块，不要任何解释文字。",
      "2. 世界观要新鲜，别套用烂大街设定；必须给玩家一个明确的、有代价的目标。",
      "3. 同行角色是个有脾气、有软肋的活人，不是工具人。",
      "4. 【性别与口吻】必须严格遵守下方「同伴档案」里给出的性别、说话方式、行动习惯。不要写成中性化的模板台词。",
      "   - 性别只决定质感和习惯，不决定刻板印象。软弱的男人、暴躁的女人都可以——以人设为主，性别只调整细节。",
      "5. 同伴不能只说话。她/他要有动作：拉住你、挡在前面、踢开东西、把水递过来、翻白眼、骂人、沉默。",
    ].join("\n");

    const TURN_SYS = [
      "你是「无限流」冒险游戏的主持人（GM）。",
      "写作要求：",
      "1. 只输出一个 JSON 对象。不要 markdown 代码块，不要任何解释文字。",
      "2. 每回合都要有推进或代价，绝不能原地打转、不能注水。",
      "3. 描写要有画面感：气味、温度、声音、疼痛、心跳、手上的触感。",
      "4. 【同伴是活人】必须严格遵守同伴档案里的性别、说话方式、行动习惯。",
      "   - 她/他的台词要一听就知道是谁在说，不是通用模板。",
      "   - 她/他要有具体动作（charAction）：拽你、挡你、抢东西、退半步、喘气、把手按在伤口上。",
      "   - 动作方式要符合性别质感和人设性格。",
      "5. 危险是真实的：给玩家有代价的选择，三个选项要真的不一样。",
      "6. NPC 用「名字 + emoji + 一句台词」出现。",
    ].join("\n");

    const WORLD_SPEC = [
      "严格只输出这个 JSON（world 字段必填）：",
      '{"partnerRead":{"gender":"男/女/不明确","voice":"说话方式，一句话","manner":"行动习惯，一句话"},',
      '"world":{"name":"世界名","emoji":"🌌","tagline":"一句话标语","rule":"隐藏规则","goal":"最终目标","desc":"两三句世界概貌"},',
      '"narration":"开场描写，150字左右",',
      '"npc":[{"who":"名","emoji":"🧙","text":"台词"}],',
      '"charThought":"同伴的第一句吐槽，符合口吻",',
      '"charAction":"同伴的一个具体动作描写",',
      '"charMood":"两个字情绪","charStatus":["状态"],',
      '"deltas":{"hp":0,"sp":0,"exp":20,"affinity":0},',
      '"items":[{"name":"道具","emoji":"🎒","desc":"效果","type":"消耗品","count":1}],',
      '"skills":[{"name":"技能","emoji":"✨","desc":"效果","cost":8}],',
      '"quests":{"new":[{"name":"主线名","desc":"要做什么","main":true}]},',
      '"options":["选项一","选项二","选项三"]}',
    ].join("\n");

    const TURN_SPEC = [
      "严格只输出这个 JSON：",
      '{"narration":"这一回合发生了什么，120字左右，要有感官细节",',
      '"npc":[{"who":"NPC名","emoji":"🧙","text":"一句台词"}],',
      '"charThought":"同伴的吐槽，口语化，符合性别口吻与人设",',
      '"charAction":"同伴的具体动作",',
      '"charMood":"两个字情绪","charStatus":["状态标签"],',
      '"deltas":{"hp":-12,"sp":-5,"exp":30,"affinity":2},',
      '"items":[{"name":"新道具","emoji":"🎒","desc":"一句话","type":"消耗品","count":1}],',
      '"skills":[{"name":"新技能","emoji":"✨","desc":"效果","cost":10}],',
      '"quests":{"new":[{"name":"任务名","desc":"一句话","main":false}],"done":["已完成的任务名"]},',
      '"achievements":[{"name":"成就名","emoji":"🏆","desc":"达成条件"}],',
      '"checkpoint":{"name":"存档点名","desc":"一句话"},',
      '"options":["选项一","选项二","选项三"]}',
      "没有内容的字段给空数组或 null。尽量精炼，不要写废话。",
    ].join("\n");

    /* ============ 小工具 ============ */
    function clone(x) { return JSON.parse(JSON.stringify(x)); }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function cut(s, n) {
      s = String(s == null ? "" : s);
      return s.length > n ? s.slice(0, n) + "…" : s;
    }
    function expNeed(lv) { return 60 + (lv - 1) * 45; }
    function uid() { return Math.random().toString(36).slice(2, 9); }

    function txtOf(res) {
      if (res == null) return "";
      if (typeof res === "string") return res;
      if (typeof res === "object") {
        if (typeof res.text === "string") return res.text;
        if (typeof res.content === "string") return res.content;
        if (Array.isArray(res.content)) {
          return res.content.map(function (c) {
            return typeof c === "string" ? c : (c && c.text) || "";
          }).join("");
        }
        if (res.message && typeof res.message.content === "string") return res.message.content;
      }
      return String(res);
    }

    function parseJSON(s) {
      if (!s) return null;
      var t = String(s).trim();
      t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      var a = t.indexOf("{");
      var b = t.lastIndexOf("}");
      if (a < 0 || b <= a) return null;
      t = t.slice(a, b + 1);
      try { return JSON.parse(t); } catch (e) {}
      try { return JSON.parse(t.replace(/,\s*([}\]])/g, "$1")); } catch (e) {}
      return null;
    }

    function div(cls) {
      var d = document.createElement("div");
      if (cls) d.className = cls;
      return d;
    }
    function btn(cls, text) {
      var b = document.createElement("button");
      if (cls) b.className = cls;
      b.type = "button";
      if (text != null) b.textContent = text;
      return b;
    }

    /* ============ 状态 ============ */
    var S = null;
    var uiEl = null;
    var tab = "story";
    var busy = false;
    var draft = "";
    var loadingStart = 0;
    var loadingTimer = null;
    var currentGenId = 0; // 生成ID，用于放弃等待

    function blank() {
      return {
        world: null,
        partner: null,
        turn: 0,
        lv: 1, exp: 0,
        hp: 100, maxHp: 100,
        sp: 100, maxSp: 100,
        affinity: 0,
        mood: "",
        status: [],
        charThought: "",
        charAction: "",
        inventory: [],
        skills: [],
        quests: [],
        achievements: [],
        checkpoints: [],
        log: [],
        options: [],
      };
    }

    function load() {
      var raw = ctx.kit.kv.get(SAVE_KEY);
      if (raw && typeof raw === "object" && raw.world && raw.partner) {
        S = raw;
        S.inventory = S.inventory || [];
        S.skills = S.skills || [];
        S.quests = S.quests || [];
        S.achievements = S.achievements || [];
        S.checkpoints = S.checkpoints || [];
        S.log = S.log || [];
        S.status = S.status || [];
        S.options = S.options || [];
        S.turn = S.turn || 0;
        S.lv = S.lv || 1;
        S.exp = S.exp || 0;
        S.hp = (S.hp == null) ? 100 : S.hp;
        S.maxHp = S.maxHp || 100;
        S.sp = (S.sp == null) ? 100 : S.sp;
        S.maxSp = S.maxSp || 100;
        S.affinity = S.affinity || 0;
        S.mood = S.mood || "";
        S.charThought = S.charThought || "";
        S.charAction = S.charAction || "";
        S.partner.gender = S.partner.gender || "";
        S.partner.voice = S.partner.voice || "";
        S.partner.manner = S.partner.manner || "";
      } else {
        S = null;
      }
    }

    function save() {
      if (S) ctx.kit.kv.set(SAVE_KEY, S);
      else ctx.kit.kv.remove(SAVE_KEY);
    }

    function pushLog(e) {
      if (!S) return;
      S.log.push(e);
      if (S.log.length > LOG_CAP) S.log = S.log.slice(-LOG_CAP);
    }

    function startLoadingTimer() {
      loadingStart = Date.now();
      if (loadingTimer) clearInterval(loadingTimer);
      loadingTimer = setInterval(function () {
        var el = document.querySelector(".iq-timer");
        if (!el) return;
        var sec = Math.floor((Date.now() - loadingStart) / 1000);
        el.textContent = "已等待 " + sec + " 秒";
      }, 1000);
    }

    function stopLoadingTimer() {
      if (loadingTimer) {
        clearInterval(loadingTimer);
        loadingTimer = null;
      }
    }

    /* ============ 数值变更 ============ */
    function addExp(n) {
      if (!n || n <= 0 || !S) return;
      S.exp += n;
      while (S.exp >= expNeed(S.lv)) {
        S.exp -= expNeed(S.lv);
        S.lv += 1;
        S.maxHp += 12; S.hp = S.maxHp;
        S.maxSp += 8;  S.sp = S.maxSp;
        pushLog({ t: "sys", text: "⬆️ 升级！Lv." + S.lv + "  体魄上限 +12，精神上限 +8，状态已回满" });
      }
    }

    function addItem(it) {
      if (!it || !it.name) return;
      var name = String(it.name).trim();
      if (!name) return;
      for (var i = 0; i < S.inventory.length; i++) {
        if (S.inventory[i].name === name) {
          S.inventory[i].count = (S.inventory[i].count || 1) + (Number(it.count) || 1);
          return;
        }
      }
      S.inventory.push({
        name: name,
        emoji: String(it.emoji || "🎒"),
        desc: String(it.desc || ""),
        type: String(it.type || "道具"),
        count: Number(it.count) || 1,
      });
    }

    function addSkill(sk) {
      if (!sk || !sk.name) return;
      var name = String(sk.name).trim();
      if (!name) return;
      for (var i = 0; i < S.skills.length; i++) {
        if (S.skills[i].name === name) return;
      }
      S.skills.push({
        name: name,
        emoji: String(sk.emoji || "✨"),
        desc: String(sk.desc || ""),
        cost: Number(sk.cost) || 0,
      });
    }

    function addQuest(q) {
      if (!q || !q.name) return;
      var name = String(q.name).trim();
      if (!name) return;
      for (var i = 0; i < S.quests.length; i++) {
        if (S.quests[i].name === name) { S.quests[i].done = false; return; }
      }
      S.quests.push({ name: name, desc: String(q.desc || ""), main: !!q.main, done: false });
    }

    function doneQuest(name) {
      var key = String(name);
      for (var i = 0; i < S.quests.length; i++) {
        if (S.quests[i].name === key) { S.quests[i].done = true; return; }
      }
    }

    function addAch(a) {
      if (!a || !a.name) return;
      var name = String(a.name).trim();
      if (!name) return;
      for (var i = 0; i < S.achievements.length; i++) {
        if (S.achievements[i].name === name) return;
      }
      S.achievements.push({
        name: name,
        emoji: String(a.emoji || "🏆"),
        desc: String(a.desc || ""),
      });
    }

    function makeSnap() {
      var s = clone(S);
      s.checkpoints = [];
      return s;
    }

    function addCheckpoint(cp) {
      if (!S) return;
      S.checkpoints.push({
        id: uid(),
        name: String(cp.name || "存档点"),
        desc: String(cp.desc || ""),
        turn: S.turn,
        time: Date.now(),
        snap: makeSnap(),
      });
      if (S.checkpoints.length > 12) S.checkpoints.shift();
      pushLog({ t: "sys", text: "💾 存档点：「" + (cp.name || "未命名") + "」" + (cp.desc ? " —— " + cp.desc : "") });
    }

    function loadCheckpoint(id) {
      if (!S) return;
      var cp = null;
      for (var i = 0; i < S.checkpoints.length; i++) {
        if (S.checkpoints[i].id === id) { cp = S.checkpoints[i]; break; }
      }
      if (!cp || !cp.snap) return;
      var kept = S.checkpoints;
      var restored = clone(cp.snap);
      restored.checkpoints = kept;
      S = restored;
      pushLog({ t: "sys", text: "↩️ 已回到存档点「" + cp.name + "」（第 " + cp.turn + " 回合）" });
      save();
      render();
    }

    /* ============ 模型调用 ============ */
    async function ask(system, prompt, maxTokens) {
      try {
        var res = await ctx.model.ask({
          system: system,
          prompt: prompt,
          temperature: 0.95,
          maxTokens: maxTokens || 1600,
        });
        return txtOf(res);
      } catch (err) {
        throw new Error("模型请求失败：" + (err && err.message ? err.message : "未知错误"));
      }
    }

    /* ============ 同伴档案 ============ */
    function genderPref() {
      return String(ctx.kit.prefs.get("partnerGender") || "自动");
    }

    function genderNow() {
      var pref = genderPref();
      if (pref === "自动") return (S && S.partner && S.partner.gender) || "";
      if (pref === "不指定") return "";
      return pref;
    }

    function partnerBlock(forWorld) {
      var p = S.partner;
      var g = genderNow();
      var lines = ["【同伴档案】", "名字：" + p.name];
      if (p.summary) lines.push("人设：" + p.summary);
      lines.push("性别：" + (g || "尚未确定" + (forWorld ? "（请你根据人设判断并填进 partnerRead.gender）" : "")));

      if (forWorld) {
        lines.push("说话方式：请你根据人设判断，填进 partnerRead.voice");
        lines.push("行动习惯：请你根据人设判断，填进 partnerRead.manner");
      } else {
        lines.push("说话方式：" + (p.voice || "按人设自行把握"));
        lines.push("行动习惯：" + (p.manner || "按人设自行把握"));
      }

      var strict = ctx.kit.prefs.get("genderStrict") !== false;
      if (g) {
        if (strict) {
          lines.push("要求：" + p.name + "是" + g + "性。台词用词、断句、动作力度、情绪表达方式都要贴合" + g + "性的质感，不要写成中性化模板。");
        } else {
          lines.push("要求：性别（" + g + "）只作参考，以人设性格为主，但细节质感仍要区分。");
        }
        lines.push("禁止刻板印象：性别决定质感，性格决定她/他怎么做。");
      } else if (!forWorld) {
        lines.push("要求：按人设自行判断性别，并用对应的口吻与行动方式。");
      }
      return lines.join("\n");
    }

    /* ============ 提示词 ============ */
    function buildWorldPrompt() {
      var diff = String(ctx.kit.prefs.get("difficulty") || "标准");
      var tease = String(ctx.kit.prefs.get("tease") || "话痨");
      var len = clamp(Number(ctx.kit.prefs.get("length")) || 200, 100, 400);
      return [
        "请生成一个全新的「无限流」冒险世界，并直接开始第一回合。",
        "",
        partnerBlock(true),
        "",
        "吐槽密度：" + tease,
        "【难度】" + diff + "（轻松=代价小；标准=有消耗有危机；残酷=随时可能重伤）",
        "",
        "【本回合要求】",
        "- 先完成 partnerRead：判断她/他的性别，写出说话方式和行动习惯。",
        "- 开场描写约 " + len + " 字。",
        "- 给出一个明确的目标和一个隐藏规则。",
        "- 至少 1 个 NPC 登场。",
        "- 发放 1 个初始道具、1 个初始技能。",
        "- 立 1 个主线任务。",
        "- 给 3 个真正不同的选项。",
        "",
        WORLD_SPEC,
      ].filter(Boolean).join("\n");
    }

    function buildTurnPrompt(action) {
      var p = S.partner;
      var diff = String(ctx.kit.prefs.get("difficulty") || "标准");
      var tease = String(ctx.kit.prefs.get("tease") || "话痨");
      var len = clamp(Number(ctx.kit.prefs.get("length")) || 200, 100, 400);

      var recent = (S.log || []).slice(-6).map(function (e) {
        if (e.t === "nar") return "【旁白】" + cut(e.text, 150);
        if (e.t === "npc") return "【" + e.who + "】" + cut(e.text, 60);
        if (e.t === "char") return "【" + p.name + "·说】" + cut(e.text, 60);
        if (e.t === "act") return "【" + p.name + "·做】" + cut(e.text, 60);
        if (e.t === "you") return "【我】" + cut(e.text, 60);
        if (e.t === "sys") return "【系统】" + cut(e.text, 60);
        return "";
      }).filter(Boolean).join("\n");

      var activeQuests = S.quests.filter(function (q) { return !q.done; })
        .map(function (q) { return (q.main ? "★ " : "· ") + q.name + "：" + q.desc; })
        .join("\n") || "（无）";

      var bag = S.inventory.map(function (i) {
        return i.emoji + i.name + "×" + (i.count || 1);
      }).join(" ") || "（空）";

      var sk = S.skills.map(function (s) { return s.emoji + s.name; }).join(" ") || "（无）";
      var st = (S.status || []).join("、") || "正常";

      return [
        "【世界】" + S.world.emoji + " " + S.world.name + " —— " + S.world.tagline,
        "【隐藏规则】" + S.world.rule,
        "【最终目标】" + S.world.goal,
        "",
        partnerBlock(false),
        "当前情绪：" + (S.mood || "平静") + "；状态：" + st,
        "上一句吐槽：" + (S.charThought || "（无）"),
        "上一个动作：" + (S.charAction || "（无）"),
        "吐槽密度：" + tease,
        "",
        "【我的状态】Lv." + S.lv + "  HP " + S.hp + "/" + S.maxHp + "  SP " + S.sp + "/" + S.maxSp + "  好感 " + S.affinity + "  经验 " + S.exp + "/" + expNeed(S.lv),
        "【背包】" + bag,
        "【技能】" + sk,
        "【进行中的任务】\n" + activeQuests,
        "",
        "【这是第 " + S.turn + " 回合】",
        "【最近的剧情】\n" + recent,
        "",
        "【我这一回合的选择】" + action,
        "",
        "【本回合要求】",
        "- 描写约 " + len + " 字。",
        "- 让结果真正发生：要么推进、要么付出代价。",
        "- charThought 必须是「" + p.name + "会说出口的话」。",
        "- charAction 必须是「" + p.name + "会做的动作」。",
        "- 难度：" + diff,
        "- 每 3～5 回合给一次 checkpoint 或一个成就。",
        "",
        TURN_SPEC,
      ].filter(Boolean).join("\n");
    }

    /* ============ 应用结果 ============ */
    function applyResult(d) {
      if (!d || typeof d !== "object") return;

      if (d.partnerRead && typeof d.partnerRead === "object" && S.partner) {
        if (!S.partner.gender && d.partnerRead.gender) {
          var g = String(d.partnerRead.gender).trim();
          if (g === "男" || g === "女") S.partner.gender = g;
        }
        if (!S.partner.voice && d.partnerRead.voice) S.partner.voice = String(d.partnerRead.voice);
        if (!S.partner.manner && d.partnerRead.manner) S.partner.manner = String(d.partnerRead.manner);
      }

      if (d.world && typeof d.world === "object" && !S.world) {
        S.world = {
          name: String(d.world.name || "无名之地"),
          emoji: String(d.world.emoji || "🌌"),
          tagline: String(d.world.tagline || ""),
          rule: String(d.world.rule || ""),
          goal: String(d.world.goal || ""),
          desc: String(d.world.desc || ""),
        };
      }

      if (d.narration) pushLog({ t: "nar", text: String(d.narration) });

      if (Array.isArray(d.npc)) {
        d.npc.forEach(function (n) {
          if (!n) return;
          var who = String(n.who || "").trim();
          var text = String(n.text || "").trim();
          if (!who && !text) return;
          pushLog({ t: "npc", emoji: String(n.emoji || "👤"), who: who || "某人", text: text });
        });
      }

      if (d.charThought) {
        S.charThought = String(d.charThought);
        pushLog({ t: "char", text: S.charThought });
      }
      if (d.charAction) {
        S.charAction = String(d.charAction);
        pushLog({ t: "act", text: S.charAction });
      }
      if (d.charMood) S.mood = String(d.charMood);
      if (Array.isArray(d.charStatus)) {
        S.status = d.charStatus.map(String).filter(Boolean).slice(0, 6);
      }

      var dd = (d.deltas && typeof d.deltas === "object") ? d.deltas : {};
      if (dd.hp) S.hp = clamp(S.hp + (Number(dd.hp) || 0), 0, S.maxHp);
      if (dd.sp) S.sp = clamp(S.sp + (Number(dd.sp) || 0), 0, S.maxSp);
      if (dd.affinity) S.affinity = clamp(S.affinity + (Number(dd.affinity) || 0), -100, 100);
      if (dd.exp) addExp(Number(dd.exp) || 0);

      if (Array.isArray(d.items)) d.items.forEach(addItem);
      if (Array.isArray(d.skills)) d.skills.forEach(addSkill);

      if (d.quests && typeof d.quests === "object") {
        if (Array.isArray(d.quests.new)) d.quests.new.forEach(addQuest);
        if (Array.isArray(d.quests.done)) d.quests.done.forEach(doneQuest);
      }

      if (Array.isArray(d.achievements)) d.achievements.forEach(addAch);

      if (d.checkpoint && typeof d.checkpoint === "object" && (d.checkpoint.name || d.checkpoint.desc)) {
        addCheckpoint(d.checkpoint);
      }

      if (Array.isArray(d.options)) {
        S.options = d.options.map(String).map(function (s) { return s.trim(); })
          .filter(Boolean).slice(0, 4);
      } else {
        S.options = [];
      }

      if (S.hp <= 0) {
        pushLog({ t: "sys", text: "💀 你倒下了。世界没有因此停下——但你可以回到上一个存档点。" });
        S.hp = Math.max(1, Math.round(S.maxHp * 0.2));
        S.options = [];
      }
    }

    /* ============ 游戏流程 ============ */
    async function startWorld(partner) {
      if (busy) {
        ctx.ui.toast("正在处理，请稍候…");
        return;
      }
      if (!partner || !partner.name) {
        ctx.ui.toast("同伴数据异常，请重新选择");
        return;
      }
      busy = true;
      var myId = ++currentGenId;
      tab = "story";
      S = blank();
      S.partner = {
        id: partner.id,
        name: partner.name || "无名",
        summary: String(partner.summary || ""),
        gender: "",
        voice: "",
        manner: "",
      };
      var pref = genderPref();
      if (pref === "男" || pref === "女") S.partner.gender = pref;
      S.turn = 1;
      render();
      startLoadingTimer();

      try {
        var raw = await ask(WORLD_SYS, buildWorldPrompt(), 1800);
        if (myId !== currentGenId) return; // 已被放弃等待
        var data = parseJSON(raw);
        if (!raw || !data) {
          throw new Error("世界生成失败，模型没有返回有效结构");
        }
        applyResult(data);
      } catch (err) {
        if (myId !== currentGenId) return;
        S = null;
        ctx.ui.toast(err.message || "生成失败，请重试");
      } finally {
        if (myId === currentGenId) {
          busy = false;
          stopLoadingTimer();
          save();
          render();
        }
      }
    }

    async function takeTurn(action) {
      if (busy || !S || !S.world) return;
      action = String(action || "").trim();
      if (!action) return;
      busy = true;
      var myId = ++currentGenId;
      S.turn += 1;
      pushLog({ t: "you", text: action });
      S.options = [];
      render();
      startLoadingTimer();

      try {
        var raw = await ask(TURN_SYS, buildTurnPrompt(action), 1600);
        if (myId !== currentGenId) return;
        if (!raw) throw new Error("模型没有回应，请检查 API 设置");
        var data = parseJSON(raw);
        if (!data) {
          pushLog({ t: "nar", text: raw });
          pushLog({ t: "sys", text: "⚠️ 这回合没有结构化结果（上面是原文）。可以继续行动。" });
        } else {
          applyResult(data);
        }
      } catch (err) {
        if (myId !== currentGenId) return;
        pushLog({ t: "sys", text: "⚠️ " + (err.message || "行动失败，请重试") });
      } finally {
        if (myId === currentGenId) {
          busy = false;
          stopLoadingTimer();
          save();
          render();
        }
      }
    }

    function abandonWait() {
      if (!busy) return;
      currentGenId++; // 让正在等待的回调失效
      busy = false;
      stopLoadingTimer();
      pushLog({ t: "sys", text: "⏹️ 已放弃等待。你可以重新行动或去其他页签看看。" });
      save();
      render();
    }

    /* ============ 渲染 ============ */
    function render() {
      if (!uiEl) return;
      var el = uiEl;
      el.innerHTML = "";
      var root = div("iq-root");

      if (!S || !S.world) {
        root.appendChild(viewStart());
        el.appendChild(root);
        return;
      }

      root.appendChild(viewTop());
      root.appendChild(viewStatus());
      root.appendChild(viewPartner());
      root.appendChild(viewTabs());

      var body = div("iq-body");
      body.appendChild(viewTabContent());
      root.appendChild(body);
      el.appendChild(root);

      if (tab === "story") {
        var b = body;
        setTimeout(function () {
          try { b.scrollTop = b.scrollHeight; } catch (e) {}
        }, 0);
      }
    }

    function viewStart() {
      var wrap = div("iq-center");

      var h = div("iq-hero"); h.textContent = "🎲";
      wrap.appendChild(h);
      var t = div("iq-hero-t"); t.textContent = "无限流冒险";
      wrap.appendChild(t);
      var d = div("iq-hero-d");
      d.textContent = "随机生成一个世界，带上你的角色一起闯。\n她/他会用自己的口吻吐槽，也会用自己的方式保护你。";
      wrap.appendChild(d);

      var list = [];
      try { list = ctx.personas.list() || []; } catch (e) { list = []; }

      if (!list.length) {
        var w = div("iq-empty");
        w.textContent = "还没有角色。先去创建一个角色，再回来冒险。";
        wrap.appendChild(w);
        return wrap;
      }

      var title = div("iq-h2");
      title.textContent = "选一个同伴";
      title.style.marginTop = "22px";
      wrap.appendChild(title);

      var hint = div("iq-hint");
      hint.textContent = "性别与说话方式由 AI 根据人设自动判断，也可以在扩展设置里手动指定。";
      wrap.appendChild(hint);

      var grid = div("iq-grid");
      list.forEach(function (p) {
        var card = btn("iq-pcard");
        var ava = div("iq-pava");
        ava.textContent = (p.name || "?").slice(0, 1);
        card.appendChild(ava);

        var info = div("iq-pinfo");
        var nm = div("iq-pname2"); nm.textContent = p.name || "无名";
        info.appendChild(nm);
        var ds = div("iq-pdesc");
        ds.textContent = cut(p.summary || "还没有人设", 60);
        info.appendChild(ds);
        card.appendChild(info);

        card.addEventListener("click", function (e) {
          e.stopPropagation();
          startWorld(p);
        });
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
      return wrap;
    }

    function viewTop() {
      var top = div("iq-top");
      var tb = div("iq-titlebox");
      var w = div("iq-world");
      w.textContent = S.world.emoji + " " + S.world.name;
      tb.appendChild(w);
      top.appendChild(tb);

      var right = div("iq-titlebox");
      var meta = div("iq-meta");
      meta.textContent = "回合 " + S.turn;
      right.appendChild(meta);

      var menu = btn("iq-btn", "☰");
      menu.onclick = openMenu;
      right.appendChild(menu);
      top.appendChild(right);
      return top;
    }

    function bar(label, cur, max, color, numText) {
      var row = div("iq-row");
      var lb = div("lb"); lb.textContent = label;
      row.appendChild(lb);
      var track = div("iq-track");
      var fill = div("iq-fill");
      var pct = max > 0 ? clamp(cur / max * 100, 0, 100) : 0;
      fill.style.width = pct + "%";
      fill.style.background = color;
      track.appendChild(fill);
      row.appendChild(track);
      var num = div("iq-num");
      num.textContent = numText || (Math.round(cur) + "/" + Math.round(max));
      row.appendChild(num);
      return row;
    }

    function viewStatus() {
      var box = div("iq-status");
      box.appendChild(bar("HP", S.hp, S.maxHp, "#ff6b6b"));
      box.appendChild(bar("SP", S.sp, S.maxSp, "#5fb8ff"));
      box.appendChild(bar("EXP", S.exp, expNeed(S.lv), "#ffc061", "Lv." + S.lv + " · " + S.exp + "/" + expNeed(S.lv)));
      var aff = div("iq-stats");
      aff.textContent = "❤️ 好感 " + S.affinity + "　📍 " + (S.world.goal || "无目标");
      box.appendChild(aff);
      return box;
    }

    function viewPartner() {
      var box = div("iq-partner");
      var ava = div("iq-ava");
      ava.textContent = (S.partner.name || "?").slice(0, 1);
      box.appendChild(ava);

      var info = div("iq-pinfo");
      var nm = div("iq-pname");
      nm.textContent = S.partner.name;

      var g = genderNow();
      if (g) {
        var chip = document.createElement("span");
        chip.className = "iq-chip " + (g === "男" ? "g" : "b");
        chip.textContent = g;
        nm.appendChild(chip);
      }
      if (S.mood) {
        var chip2 = document.createElement("span");
        chip2.className = "iq-chip";
        chip2.textContent = S.mood;
        nm.appendChild(chip2);
      }
      (S.status || []).forEach(function (st) {
        var c = document.createElement("span");
        c.className = "iq-chip";
        c.textContent = st;
        nm.appendChild(c);
      });
      info.appendChild(nm);

      if (S.charThought) {
        var say = div("iq-say");
        say.textContent = S.charThought;
        info.appendChild(say);
      }
      box.appendChild(info);
      return box;
    }

    function viewTabs() {
      var box = div("iq-tabs");
      TABS.forEach(function (pair) {
        var k = pair[0], label = pair[1];
        var b = btn("iq-tab" + (tab === k ? " on" : ""), label);
        b.onclick = function () { tab = k; render(); };
        box.appendChild(b);
      });
      return box;
    }

    function viewTabContent() {
      if (tab === "story") return viewStory();
      if (tab === "bag") return viewBag();
      if (tab === "skill") return viewSkill();
      if (tab === "quest") return viewQuest();
      if (tab === "ach") return viewAch();
      if (tab === "save") return viewSave();
      if (tab === "mate") return viewMate();
      return div("iq-empty");
    }

    function renderLogEntry(e) {
      if (e.t === "nar") {
        var d1 = div("iq-story"); d1.textContent = e.text; return d1;
      }
      if (e.t === "npc") {
        var d2 = div("iq-npc");
        var em = document.createElement("span");
        em.className = "em";
        em.textContent = e.emoji || "👤";
        d2.appendChild(em);
        var sp = document.createElement("span");
        var who = document.createElement("span");
        who.className = "who";
        who.textContent = (e.who || "某人") + "：";
        sp.appendChild(who);
        sp.appendChild(document.createTextNode(e.text || ""));
        d2.appendChild(sp);
        return d2;
      }
      if (e.t === "char") {
        var d3 = div("iq-charline");
        var em3 = document.createElement("span");
        em3.className = "em";
        em3.textContent = "💬";
        d3.appendChild(em3);
        var sp3 = document.createElement("span");
        sp3.textContent = S.partner.name + "：" + e.text;
        d3.appendChild(sp3);
        return d3;
      }
      if (e.t === "act") {
        var dA = div("iq-charact");
        var emA = document.createElement("span");
        emA.className = "em";
        emA.textContent = "🎬";
        dA.appendChild(emA);
        var spA = document.createElement("span");
        spA.textContent = S.partner.name + " " + e.text;
        dA.appendChild(spA);
        return dA;
      }
      if (e.t === "you") {
        var d4 = div("iq-you");
        d4.textContent = "你：" + e.text;
        return d4;
      }
      if (e.t === "sys") {
        var d5 = div("iq-sys");
        d5.textContent = e.text;
        return d5;
      }
      return div("iq-story");
    }

    function viewStory() {
      var wrap = div("iq-story-list");
      (S.log || []).slice(-60).forEach(function (e) {
        wrap.appendChild(renderLogEntry(e));
      });

      if (busy) {
        var ld = div("iq-loading");
        var t = div("iq-thinking");
        t.textContent = "… " + S.partner.name + " 正在看着你";
        ld.appendChild(t);
        var timer = div("iq-timer");
        ld.appendChild(timer);
        var giveup = btn("iq-btn", "放弃等待");
        giveup.onclick = abandonWait;
        ld.appendChild(giveup);
        wrap.appendChild(ld);
        return wrap;
      }

      if (S.options && S.options.length) {
        var opts = div("iq-opts");
        S.options.forEach(function (o, i) {
          var b = btn("iq-opt");
          var idx = document.createElement("span");
          idx.className = "idx";
          idx.textContent = String.fromCharCode(65 + i);
          b.appendChild(idx);
          b.appendChild(document.createTextNode(o));
          b.onclick = function () { takeTurn(o); };
          opts.appendChild(b);
        });
        wrap.appendChild(opts);
      }

      var inputRow = div("iq-input");
      var inp = document.createElement("input");
      inp.type = "text";
      inp.placeholder = "也可以自己写你要做什么…";
      inp.value = draft;
      inp.oninput = function () { draft = inp.value; };
      inp.onkeydown = function (e) {
        if (e.key === "Enter" && draft.trim()) {
          var v = draft.trim();
          draft = "";
          takeTurn(v);
        }
      };
      inputRow.appendChild(inp);

      var go = btn("iq-btn primary", "行动");
      go.onclick = function () {
        var v = draft.trim();
        if (!v) return;
        draft = "";
        takeTurn(v);
      };
      inputRow.appendChild(go);
      wrap.appendChild(inputRow);

      return wrap;
    }

    function emptyBox(emoji, text) {
      var d = div("iq-empty");
      d.textContent = emoji + " " + text;
      return d;
    }

    function viewBag() {
      if (!S.inventory.length) return emptyBox("🎒", "背包空空如也。继续探索，会有收获的。");
      var wrap = div("iq-cards");
      S.inventory.forEach(function (it) {
        var c = div("iq-card");
        var h = document.createElement("h4");
        h.textContent = it.emoji + " " + it.name;
        var tag = document.createElement("span");
        tag.className = "iq-chip";
        tag.textContent = it.type || "道具";
        h.appendChild(tag);
        if (it.count > 1) {
          var c2 = document.createElement("span");
          c2.className = "iq-chip";
          c2.textContent = "×" + it.count;
          h.appendChild(c2);
        }
        c.appendChild(h);
        if (it.desc) {
          var p = document.createElement("p");
          p.textContent = it.desc;
          c.appendChild(p);
        }
        wrap.appendChild(c);
      });
      return wrap;
    }

    function viewSkill() {
      if (!S.skills.length) return emptyBox("✨", "还没有技能。冒险中会解锁的。");
      var wrap = div("iq-cards");
      S.skills.forEach(function (sk) {
        var c = div("iq-card");
        var h = document.createElement("h4");
        h.textContent = sk.emoji + " " + sk.name;
        if (sk.cost) {
          var t = document.createElement("span");
          t.className = "iq-chip";
          t.textContent = "耗 SP " + sk.cost;
          h.appendChild(t);
        }
        c.appendChild(h);
        if (sk.desc) {
          var p = document.createElement("p");
          p.textContent = sk.desc;
          c.appendChild(p);
        }
        wrap.appendChild(c);
      });
      return wrap;
    }

    function viewQuest() {
      if (!S.quests.length) return emptyBox("🎯", "暂时没有任务。探索中会接到。");
      var wrap = div("iq-cards");
      var active = S.quests.filter(function (q) { return !q.done; });
      var done = S.quests.filter(function (q) { return q.done; });
      active.concat(done).forEach(function (q) {
        var c = div("iq-card" + (q.done ? " done" : ""));
        var h = document.createElement("h4");
        h.textContent = (q.done ? "✅" : (q.main ? "★" : "·")) + " " + q.name;
        if (q.main) {
          var t = document.createElement("span");
          t.className = "iq-chip";
          t.textContent = "主线";
          h.appendChild(t);
        }
        c.appendChild(h);
        if (q.desc) {
          var p = document.createElement("p");
          p.textContent = q.desc;
          c.appendChild(p);
        }
        wrap.appendChild(c);
      });
      return wrap;
    }

    function viewAch() {
      if (!S.achievements.length) return emptyBox("🏆", "还没有成就。做出点让人记住的事吧。");
      var wrap = div("iq-cards");
      S.achievements.forEach(function (a) {
        var c = div("iq-card");
        var h = document.createElement("h4");
        h.textContent = (a.emoji || "🏆") + " " + a.name;
        c.appendChild(h);
        if (a.desc) {
          var p = document.createElement("p");
          p.textContent = a.desc;
          c.appendChild(p);
        }
        wrap.appendChild(c);
      });
      return wrap;
    }

    function viewSave() {
      var wrap = div("iq-cards");
      var hint = div("iq-hint");
      hint.textContent = "点「回到这里」可以读档。读档只回滚剧情和数值，存档点列表会保留。";
      wrap.appendChild(hint);

      if (!S.checkpoints.length) {
        wrap.appendChild(emptyBox("💾", "还没有存档点。慢慢来，故事才刚开始。"));
        return wrap;
      }

      S.checkpoints.slice().reverse().forEach(function (cp) {
        var c = div("iq-card");
        var h = document.createElement("h4");
        h.textContent = "💾 " + cp.name;
        var tag = document.createElement("span");
        tag.className = "iq-chip";
        tag.textContent = "第 " + cp.turn + " 回合";
        h.appendChild(tag);
        c.appendChild(h);
        if (cp.desc) {
          var p = document.createElement("p");
          p.textContent = cp.desc;
          c.appendChild(p);
        }
        var loadBtn = btn("iq-btn", "回到这里");
        loadBtn.style.marginTop = "8px";
        loadBtn.onclick = function () { loadCheckpoint(cp.id); };
        c.appendChild(loadBtn);
        wrap.appendChild(c);
      });
      return wrap;
    }

    function viewMate() {
      var wrap = div("iq-cards");
      var c = div("iq-card");
      var h = document.createElement("h4");
      h.textContent = "👤 " + S.partner.name;
      var g = genderNow();
      if (g) {
        var tg = document.createElement("span");
        tg.className = "iq-chip";
        tg.textContent = g;
        h.appendChild(tg);
      }
      c.appendChild(h);

      if (S.partner.summary) {
        var p0 = document.createElement("p");
        p0.textContent = "人设：" + S.partner.summary;
        c.appendChild(p0);
      }
      var p = document.createElement("p");
      p.style.marginTop = "6px";
      p.textContent = "说话方式：" + (S.partner.voice || "（未记录）") + "\n行动习惯：" + (S.partner.manner || "（未记录）");
      c.appendChild(p);
      var p2 = document.createElement("p");
      p2.style.marginTop = "6px";
      p2.textContent = "好感 " + S.affinity + "　情绪 " + (S.mood || "平静") + "　状态 " + ((S.status || []).join("、") || "正常");
      c.appendChild(p2);
      wrap.appendChild(c);

      var restart = btn("iq-btn", "换一个世界 / 换同伴");
      restart.style.marginTop = "8px";
      restart.onclick = function () {
        confirmDialog("确定要重开吗？当前进度会丢失（已有存档点也会一起清掉）。", function () {
          S = null;
          save();
          render();
        });
      };
      wrap.appendChild(restart);
      return wrap;
    }

    /* ============ 弹层 ============ */
    function openMenu() {
      var root = uiEl.querySelector(".iq-root");
      if (!root) return;
      var mask = div("iq-mask");
      var sheet = div("iq-sheet");

      var b1 = btn("", "重新开始这一局");
      b1.onclick = function () {
        mask.remove();
        confirmDialog("重开？当前进度会丢失。", function () {
          S = null; save(); render();
        });
      };
      sheet.appendChild(b1);

      var b2 = btn("", "打开存档点");
      b2.onclick = function () { mask.remove(); tab = "save"; render(); };
      sheet.appendChild(b2);

      var b3 = btn("", "关闭");
      b3.onclick = function () { mask.remove(); };
      sheet.appendChild(b3);

      mask.appendChild(sheet);
      mask.onclick = function (e) { if (e.target === mask) mask.remove(); };
      root.appendChild(mask);
    }

    function confirmDialog(text, onYes) {
      var root = uiEl.querySelector(".iq-root");
      if (!root) return;
      var mask = div("iq-mask");
      var sheet = div("iq-sheet");

      var msg = document.createElement("div");
      msg.style.cssText = "text-align:center;padding:10px 6px;font-size:13px;opacity:.85;line-height:1.7;";
      msg.textContent = text;
      sheet.appendChild(msg);

      var yes = btn("danger", "确定");
      yes.onclick = function () { mask.remove(); if (onYes) onYes(); };
      sheet.appendChild(yes);

      var no = btn("", "取消");
      no.onclick = function () { mask.remove(); };
      sheet.appendChild(no);

      mask.appendChild(sheet);
      mask.onclick = function (e) { if (e.target === mask) mask.remove(); };
      root.appendChild(mask);
    }

    /* ============ 挂载 App ============ */
    return ctx.ui.appPage(function (el) {
      uiEl = el;
      el.style.height = "100%";
      el.style.overflow = "hidden";
      el.style.position = "relative";
      load();
      render();
    });
  },
};