export default {
  manifest: {
    id: "puff-infinite-quest",
    name: "无限流冒险",
    engine: "puff",
    apiVersion: 1,
    version: "2.6.0",
    description: "随机生成无限流冒险世界，和你的角色组队闯关。自动读取角色完整人设",
    app: { name: "冒险", letter: "险", icon: "🗺️" },
    settings: [
      { key: "difficulty", label: "难度", type: "select", default: "标准", options: ["轻松", "标准", "残酷"] },
      { key: "tease", label: "角色吐槽密度", type: "select", default: "话痨", options: ["安静", "正常", "话痨"] },
      { key: "length", label: "单回合剧情字数", type: "number", default: 160 },
      { key: "partnerGender", label: "同伴性别", type: "select", default: "自动", options: ["自动", "男", "女", "不指定"] },
      { key: "genderStrict", label: "严格贴合性别口吻", type: "boolean", default: true },
    ],
  },

  setup(ctx) {
    var NL = String.fromCharCode(10);
    var SP = String.fromCharCode(32);
    var TAB = String.fromCharCode(9);

    function ch(cp) {
      if (cp > 0xFFFF) {
        cp -= 0x10000;
        return String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp % 1024));
      }
      return String.fromCharCode(cp);
    }
    function clone(x) { try { return JSON.parse(JSON.stringify(x)); } catch (e) { return x; } }
    function clamp(v, a, b) { if (v < a) return a; if (v > b) return b; return v; }
    function cut(s, n) {
      s = String(s == null ? "" : s);
      if (s.length <= n) return s;
      return s.slice(0, n) + "...";
    }
    function expNeed(lv) { return 60 + (lv - 1) * 45; }
    function uid() { return Math.random().toString(36).slice(2, 9); }
    function div(cls) { var d = document.createElement("div"); if (cls) d.className = cls; return d; }
    function btn(cls, text) {
      var b = document.createElement("button");
      if (cls) b.className = cls;
      b.type = "button";
      if (text != null) b.textContent = text;
      return b;
    }
    function isObj(o) { if (o == null) return false; if (typeof o !== "object") return false; return true; }
    function isArr(a) { return Array.isArray(a); }
    function joinLines(arr) { return arr.join(NL); }

    function extractPersona(partner) {
      var full = partner;
      try {
        if (partner) {
          if (partner.id) {
            var got = ctx.personas.get(partner.id);
            if (got) full = got;
          }
        }
      } catch (e) {}

      var name = "无名";
      try {
        if (full) {
          if (full.name) name = String(full.name);
          else if (partner) { if (partner.name) name = String(partner.name); }
        }
      } catch (e) {}

      var chunks = [];
      var seen = {};
      var knownFields = [
        "summary", "description", "desc", "persona", "prompt", "systemPrompt",
        "system_prompt", "intro", "background", "worldView", "worldBook",
        "world_book", "lore", "lorebook", "card", "profile", "personality",
        "setting", "settings", "info", "content", "text", "detail", "details",
        "bio", "character", "charCard", "char_card"
      ];
      var skipKeys = {
        id: 1, name: 1, avatar: 1, avatarUrl: 1, avatar_url: 1,
        createdAt: 1, updatedAt: 1, createTime: 1, updateTime: 1
      };

      function addChunk(key, v) {
        if (v == null) return;
        if (typeof v === "string") {
          var s = v.trim();
          if (!s) return;
          if (s.length < 2) return;
          if (seen[key]) return;
          seen[key] = 1;
          chunks.push(s);
        } else if (typeof v === "object") {
          if (seen[key]) return;
          seen[key] = 1;
          try {
            var js = JSON.stringify(v);
            if (js) {
              if (js.length > 2) {
                if (js.length < 30000) chunks.push(js);
              }
            }
          } catch (e) {}
        }
      }

      try {
        if (full) {
          for (var i = 0; i < knownFields.length; i++) {
            var f = knownFields[i];
            if (full[f] != null) addChunk(f, full[f]);
          }
          for (var key in full) {
            if (!Object.prototype.hasOwnProperty.call(full, key)) continue;
            if (skipKeys[key]) continue;
            var dup = false;
            for (var j = 0; j < knownFields.length; j++) {
              if (knownFields[j] === key) { dup = true; break; }
            }
            if (dup) continue;
            addChunk(key, full[key]);
          }
        }
      } catch (e) {}

      var summary = chunks.join(NL + NL);
      return { name: name, summary: summary, full: full };
    }

    var E = {
      dice: ch(0x1F3B2),
      scroll: ch(0x1F4DC),
      bag: ch(0x1F392),
      star: ch(0x2B50),
      target: ch(0x1F3AF),
      trophy: ch(0x1F3C6),
      disk: ch(0x1F4BE),
      people: ch(0x1F465),
      person: ch(0x1F464),
      speech: ch(0x1F4AC),
      clap: ch(0x1F3AC),
      heart: ch(0x2764),
      warn: ch(0x26A0),
      refresh: ch(0x1F504),
      galaxy: ch(0x1F30C),
      zap: ch(0x26A1),
      back: ch(0x21A9),
      pencil: ch(0x270F),
      check: ch(0x2705),
      pin: ch(0x1F4CC),
      male: ch(0x2642),
      female: ch(0x2640),
      skull: ch(0x1F480),
      menu: ch(0x2630),
      cross: ch(0x2715),
      stop: ch(0x23F9),
      hourglass: ch(0x23F3),
      sparkle: ch(0x2728),
      info: ch(0x2139),
    };

    var CSS = [
      ".iq-root{display:flex;flex-direction:column;height:100%;padding:14px;gap:10px;font-size:14px;line-height:1.65;color:#e9e3d8;background:#131722;overflow:hidden;box-sizing:border-box;}",
      ".iq-root *{box-sizing:border-box;}",
      ".iq-top{display:flex;justify-content:space-between;align-items:center;gap:8px;}",
      ".iq-world{font-size:15px;font-weight:700;color:#ffd79a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%;}",
      ".iq-meta{font-size:11px;opacity:.55;}",
      ".iq-btn{border:0;border-radius:8px;padding:6px 12px;font-size:12px;color:#e9e3d8;background:rgba(255,255,255,0.08);cursor:pointer;}",
      ".iq-btn.primary{background:#ffb454;color:#251a0e;font-weight:700;}",
      ".iq-status{display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:12px;background:rgba(255,255,255,0.05);}",
      ".iq-row{display:flex;align-items:center;gap:8px;font-size:11px;}",
      ".iq-row .lb{width:30px;opacity:.6;}",
      ".iq-track{flex:1;height:6px;border-radius:99px;background:rgba(255,255,255,0.1);overflow:hidden;}",
      ".iq-fill{height:100%;border-radius:99px;}",
      ".iq-num{font-size:10px;opacity:.68;min-width:64px;text-align:right;}",
      ".iq-stats{font-size:11px;opacity:.6;}",
      ".iq-partner{display:flex;gap:10px;padding:10px;border-radius:12px;background:rgba(255,180,84,0.1);border:1px solid rgba(255,180,84,0.2);}",
      ".iq-ava{width:36px;height:36px;flex:0 0 36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#ffd79a;background:rgba(255,180,84,0.2);}",
      ".iq-pinfo{flex:1;min-width:0;}",
      ".iq-pname{font-size:13px;font-weight:700;color:#ffd79a;display:flex;gap:5px;align-items:center;flex-wrap:wrap;}",
      ".iq-chip{font-size:10px;padding:1px 7px;border-radius:99px;background:rgba(255,255,255,0.1);color:#cfc8bb;}",
      ".iq-say{margin-top:6px;font-size:12.5px;color:#f4e0d2;background:rgba(0,0,0,0.24);border-left:2px solid #ffb454;padding:6px 9px;}",
      ".iq-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;}",
      ".iq-tab{border:0;border-radius:99px;padding:5px 12px;font-size:12px;background:rgba(255,255,255,0.06);color:#bdb6aa;cursor:pointer;white-space:nowrap;}",
      ".iq-tab.on{background:#ffb454;color:#251a0e;font-weight:700;}",
      ".iq-body{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;}",
      ".iq-story{font-size:13px;line-height:1.9;color:#ded7ca;white-space:pre-wrap;}",
      ".iq-npc{font-size:13px;color:#d6dff0;line-height:1.75;}",
      ".iq-npc .who{color:#8fd0ff;font-weight:600;}",
      ".iq-charline{font-size:13px;color:#f5d9c4;background:rgba(255,180,84,0.08);border-radius:10px;padding:8px 10px;line-height:1.75;}",
      ".iq-charact{font-size:12.5px;color:#cfc9be;background:rgba(255,255,255,0.05);border-radius:10px;padding:8px 10px;font-style:italic;line-height:1.75;}",
      ".iq-you{font-size:13px;color:#ffd79a;padding-left:10px;border-left:2px solid rgba(255,180,84,0.55);line-height:1.7;white-space:pre-wrap;}",
      ".iq-sys{font-size:11.5px;color:#9fe8ab;background:rgba(120,255,150,0.07);border-radius:8px;padding:6px 10px;line-height:1.7;white-space:pre-wrap;}",
      ".iq-sys.warn{color:#ffb454;background:rgba(255,180,84,0.1);}",
      ".iq-opts{display:flex;flex-direction:column;gap:8px;}",
      ".iq-opt{text-align:left;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);border-radius:10px;padding:10px;font:inherit;font-size:13px;color:#e9e3d8;cursor:pointer;line-height:1.6;}",
      ".iq-opt .idx{color:#ffb454;font-weight:700;margin-right:6px;}",
      ".iq-input{display:flex;gap:8px;}",
      ".iq-input input{flex:1;min-width:0;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.22);border-radius:10px;padding:9px;font:inherit;font-size:13px;color:#e9e3d8;outline:none;}",
      ".iq-cards{display:flex;flex-direction:column;gap:8px;}",
      ".iq-card{border:1px solid rgba(255,255,255,0.09);background:rgba(255,255,255,0.04);border-radius:10px;padding:10px;}",
      ".iq-card.done{opacity:.5;}",
      ".iq-card h4{margin:0 0 4px;font-size:13px;color:#f0e8da;display:flex;gap:6px;flex-wrap:wrap;align-items:center;}",
      ".iq-card p{margin:0;font-size:11.5px;line-height:1.65;opacity:.72;white-space:pre-wrap;}",
      ".iq-empty{font-size:12px;opacity:.55;text-align:center;padding:30px 10px;line-height:1.8;}",
      ".iq-center{display:flex;flex-direction:column;align-items:center;flex:1;text-align:center;padding:24px 6px;overflow-y:auto;width:100%;}",
      ".iq-hero{font-size:48px;line-height:1;margin-bottom:12px;}",
      ".iq-hero-t{font-size:20px;font-weight:800;letter-spacing:2px;color:#ffd79a;}",
      ".iq-hero-d{font-size:12.5px;opacity:.65;margin-top:10px;line-height:1.9;max-width:300px;white-space:pre-wrap;}",
      ".iq-h2{font-size:14px;font-weight:700;color:#ffd79a;margin-bottom:6px;width:100%;text-align:left;}",
      ".iq-hint{font-size:11.5px;opacity:.58;line-height:1.8;margin-bottom:8px;width:100%;text-align:left;}",
      ".iq-grid{display:flex;flex-direction:column;gap:8px;width:100%;}",
      ".iq-pcard{display:flex;align-items:center;gap:10px;text-align:left;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);border-radius:12px;padding:10px;font:inherit;color:#e9e3d8;cursor:pointer;}",
      ".iq-pava{width:36px;height:36px;flex:0 0 36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#ffd79a;background:rgba(255,180,84,0.16);font-size:16px;}",
      ".iq-pname2{font-size:13.5px;font-weight:700;color:#ffd79a;}",
      ".iq-pdesc{font-size:11.5px;opacity:.6;margin-top:2px;line-height:1.55;}",
      ".iq-loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#131722;z-index:30;padding:20px;}",
      ".iq-spinner{width:60px;height:60px;border-radius:50%;border:3px solid transparent;border-top-color:#ffb454;border-right-color:#ffb454;animation:iq-spin 1s linear infinite;display:flex;align-items:center;justify-content:center;font-size:22px;}",
      "@keyframes iq-spin{to{transform:rotate(360deg)}}",
      ".iq-lt{font-size:15px;font-weight:700;color:#ffd79a;}",
      ".iq-ls{font-size:11.5px;opacity:.55;}",
      ".iq-tip{font-size:11.5px;opacity:.6;text-align:center;line-height:1.75;color:#cfc8bb;max-width:280px;min-height:38px;}",
      ".iq-timer{font-size:10.5px;opacity:.35;}",
      ".iq-warn{font-size:11px;color:#ffb454;text-align:center;max-width:280px;line-height:1.7;}",
      ".iq-mask{position:absolute;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;z-index:40;}",
      ".iq-sheet{width:100%;max-width:460px;background:#1b1f2b;border-radius:16px 16px 0 0;padding:12px 12px 18px;display:flex;flex-direction:column;gap:6px;}",
      ".iq-sheet button{border:0;background:rgba(255,255,255,0.06);color:#e9e3d8;font:inherit;font-size:14px;padding:13px;border-radius:11px;cursor:pointer;}",
      ".iq-sheet button.danger{color:#ff8f8f;}",
      ".iq-thinking{font-size:22px;text-align:center;padding:16px 0;letter-spacing:8px;color:#ffb454;opacity:.8;animation:iq-pulse 1.4s ease-in-out infinite;}",
      "@keyframes iq-pulse{0%,100%{opacity:.2}50%{opacity:.9}}",
    ].join(NL);
    ctx.ui.css(CSS);

    var LOG_CAP = 80;
    var SAVE_KEY = "save";
    var CP_PREFIX = "cp_";

    var TABS = [
      ["story", E.scroll + " 冒险"],
      ["bag", E.bag + " 背包"],
      ["skill", E.sparkle + " 技能"],
      ["quest", E.target + " 任务"],
      ["ach", E.trophy + " 成就"],
      ["save", E.disk + " 存档点"],
      ["mate", E.people + " 同伴"],
    ];

    var TIPS = [
      E.dice + " 世界正在生成，慢慢来。",
      E.hourglass + " 你的同伴也在等待这一刻。",
      E.galaxy + " 无限流的世界从不重复。",
      E.sparkle + " 每次冒险都是全新的。",
      E.speech + " 同伴的性格会影响故事走向。",
      E.disk + " 存档点会在关键节点自动出现。",
    ];

    var WORLD_SYS = "无限流冒险GM。直接输出，不要思考过程。只输出一个 JSON。文笔具体有感官细节。";
    var TURN_SYS = "无限流冒险GM。直接输出，不要思考过程。只输出一个 JSON。每回合有推进或代价。同伴的口吻动作必须符合档案。";

    var WORLD_SPEC = joinLines([
      "JSON 字段：",
      "partnerRead:{gender,voice,manner}",
      "world:{name,emoji,tagline,rule,goal,desc}",
      "narration:开场描写",
      "npc:[{who,emoji,text}]",
      "charThought:同伴吐槽",
      "charAction:同伴动作",
      "charMood:两字",
      "deltas:{exp:20}",
      "items:[{name,emoji,desc,type,count}]",
      "skills:[{name,emoji,desc,cost}]",
      "quests:{new:[{name,desc,main}]}",
      "options:[A,B,C]",
    ]);

    var TURN_SPEC = joinLines([
      "JSON 字段：",
      "narration:本回合",
      "npc:[{who,emoji,text}]",
      "charThought:同伴吐槽",
      "charAction:同伴动作",
      "charMood:两字",
      "charStatus:[状态]",
      "deltas:{hp,sp,exp,affinity}",
      "items:[{name,emoji,desc,type,count}]",
      "skills:[{name,emoji,desc,cost}]",
      "quests:{new:[],done:[]}",
      "achievements:[{name,emoji,desc}]",
      "checkpoint:{name,desc}",
      "options:[A,B,C]",
      "没有的字段给空数组或 null。",
    ]);

    function kvGet(k) { try { return ctx.kit.kv.get(k); } catch (e) { return null; } }
    function kvSet(k, v) { try { ctx.kit.kv.set(k, v); return true; } catch (e) { return false; } }
    function kvRemove(k) { try { ctx.kit.kv.remove(k); } catch (e) {} }
    function prefsGet(k, d) { try { var v = ctx.kit.prefs.get(k); if (v == null) return d; return v; } catch (e) { return d; } }

    function txtOf(res) {
      if (res == null) return "";
      if (typeof res === "string") return res;
      if (isObj(res)) {
        if (typeof res.text === "string") return res.text;
        if (typeof res.content === "string") return res.content;
        if (isArr(res.content)) {
          var out = "";
          for (var i = 0; i < res.content.length; i++) {
            var c = res.content[i];
            if (typeof c === "string") { out += c; }
            else if (isObj(c)) {
              if (typeof c.text === "string") out += c.text;
            }
          }
          return out;
        }
        if (isObj(res.message)) {
          if (typeof res.message.content === "string") return res.message.content;
        }
      }
      return String(res);
    }

    function parseJSON(s) {
      if (!s) return null;
      var t = String(s).trim();
      var bq = String.fromCharCode(96);
      var triple = bq + bq + bq;
      if (t.indexOf(triple) === 0) {
        var nl = t.indexOf(NL);
        if (nl >= 0) { t = t.slice(nl + 1); }
        else { t = t.slice(3); }
      }
      if (t.length > 3) {
        if (t.slice(t.length - 3) === triple) { t = t.slice(0, t.length - 3); }
      }
      t = t.trim();
      var a = t.indexOf("{"), b = t.lastIndexOf("}");
      if (a < 0) return null;
      if (b <= a) return null;
      t = t.slice(a, b + 1);
      try { return JSON.parse(t); } catch (e) {}
      var cleaned = t;
      var out = "";
      var i = 0;
      while (i < cleaned.length) {
        var c = cleaned.charAt(i);
        if (c === ",") {
          var j = i + 1;
          while (j < cleaned.length) {
            var d = cleaned.charAt(j);
            if (d === SP) { j++; continue; }
            if (d === NL) { j++; continue; }
            if (d === TAB) { j++; continue; }
            break;
          }
          if (j < cleaned.length) {
            var nx = cleaned.charAt(j);
            if (nx === "}" || nx === "]") { i++; continue; }
          }
        }
        out += c;
        i++;
      }
      try { return JSON.parse(out); } catch (e) {}
      return null;
    }

    var S = null;
    var uiEl = null;
    var tab = "story";
    var busy = false;
    var draft = "";
    var genId = 0;
    var loadTimer = null;
    var tipTimer = null;
    var lastError = "";

    function blank() {
      return {
        world: null, partner: null, turn: 0, lv: 1, exp: 0,
        hp: 100, maxHp: 100, sp: 100, maxSp: 100, affinity: 0, mood: "",
        status: [], charThought: "", charAction: "",
        inventory: [], skills: [], quests: [], achievements: [],
        checkpoints: [], log: [], options: [],
      };
    }

    function defaultWorld() {
      var names = ["迷雾回廊", "残响都市", "不眠之森", "倒悬之塔", "回声海", "锈色荒原"];
      var tags = ["一场没有预告的冒险", "所有人都在隐瞒什么", "出口就在眼前，但你不敢走", "每一步都算数", "规则写在血里"];
      var rules = ["越安静的地方越危险", "你看到的第一个活人不一定是人", "天亮之前必须找到光源", "不要回答任何叫你名字的声音", "拿走的东西一定会以别的方式还回来"];
      var goals = ["活着走出去", "找到失踪的同行者", "弄清这个世界的真相", "活到天亮", "带走那个不该存在的东西"];
      var descs = [
        "你睁开眼，四周是一片被浓雾笼罩的走廊。空气潮湿，墙壁上有抓痕。你能听到远处有脚步声，但不属于任何人。",
        "城市的霓虹在雨里晕开，街道空无一人，只有自动售货机还在亮着。手机显示时间停在了凌晨三点零七分。",
        "你在一片没有月亮的森林里醒来。树的形状不对，它们都朝同一方向弯曲。空气里有铁锈和潮湿泥土的味道。"
      ];
      var i = Math.floor(Math.random() * names.length);
      var j = Math.floor(Math.random() * rules.length);
      var k = Math.floor(Math.random() * goals.length);
      var m = Math.floor(Math.random() * descs.length);
      var t = Math.floor(Math.random() * tags.length);
      return {
        name: names[i],
        emoji: E.galaxy,
        tagline: tags[t],
        rule: rules[j],
        goal: goals[k],
        desc: descs[m],
      };
    }

    function load() {
      S = null;
      var raw = kvGet(SAVE_KEY);
      if (!raw) return;
      if (typeof raw === "string") {
        try { raw = JSON.parse(raw); } catch (e) { return; }
      }
      if (!isObj(raw)) return;
      if (!raw.world) return;
      if (!raw.partner) return;
      S = raw;
      var arrays = ["inventory", "skills", "quests", "achievements", "checkpoints", "log", "status", "options"];
      for (var i = 0; i < arrays.length; i++) {
        if (!S[arrays[i]]) S[arrays[i]] = [];
      }
      if (!S.turn) S.turn = 0;
      if (!S.lv) S.lv = 1;
      if (!S.exp) S.exp = 0;
      if (S.hp == null) S.hp = 100;
      if (!S.maxHp) S.maxHp = 100;
      if (S.sp == null) S.sp = 100;
      if (!S.maxSp) S.maxSp = 100;
      if (!S.affinity) S.affinity = 0;
      if (!S.mood) S.mood = "";
      if (!S.charThought) S.charThought = "";
      if (!S.charAction) S.charAction = "";
      if (!S.partner.gender) S.partner.gender = "";
      if (!S.partner.voice) S.partner.voice = "";
      if (!S.partner.manner) S.partner.manner = "";
    }

    function save() {
      if (!S) { kvRemove(SAVE_KEY); return; }
      if (!S.world) { kvRemove(SAVE_KEY); return; }
      kvSet(SAVE_KEY, JSON.stringify(S));
    }

    function pushLog(e) {
      if (!S) return;
      S.log.push(e);
      if (S.log.length > LOG_CAP) S.log = S.log.slice(-LOG_CAP);
    }

    function showLoading(title, sub) {
      hideLoading();
      if (!uiEl) return;
      var old = uiEl.querySelector(".iq-loading");
      if (old) old.remove();

      var screen = div("iq-loading");
      var sp = div("iq-spinner");
      sp.textContent = E.dice;
      screen.appendChild(sp);

      var t1 = div("iq-lt");
      t1.textContent = title || "正在生成世界";
      screen.appendChild(t1);

      if (sub) {
        var t2 = div("iq-ls");
        t2.textContent = sub;
        screen.appendChild(t2);
      }

      var tip = div("iq-tip");
      var idx = Math.floor(Math.random() * TIPS.length);
      tip.textContent = TIPS[idx];
      screen.appendChild(tip);

      var timer = div("iq-timer");
      timer.textContent = "0.0 秒";
      screen.appendChild(timer);

      var warn = div("iq-warn");
      warn.style.display = "none";
      screen.appendChild(warn);

      var giveup = btn("iq-btn", E.stop + " 放弃等待");
      giveup.onclick = abandonWait;
      screen.appendChild(giveup);

      uiEl.appendChild(screen);

      var start = Date.now();
      loadTimer = setInterval(function () {
        var sec = (Date.now() - start) / 1000;
        var e1 = uiEl.querySelector(".iq-timer");
        if (e1) e1.textContent = sec.toFixed(1) + " 秒";
        if (sec > 12) {
          var w = uiEl.querySelector(".iq-warn");
          if (w) {
            if (w.style.display === "none") {
              w.style.display = "block";
              w.textContent = E.warn + " 超过 30 秒建议换一个响应更快的模型。";
            }
          }
        }
      }, 100);

      tipTimer = setInterval(function () {
        var e = uiEl.querySelector(".iq-tip");
        if (!e) return;
        idx = (idx + 1) % TIPS.length;
        e.textContent = TIPS[idx];
      }, 2800);
    }

    function hideLoading() {
      if (loadTimer) { clearInterval(loadTimer); loadTimer = null; }
      if (tipTimer) { clearInterval(tipTimer); tipTimer = null; }
      if (uiEl) {
        var el = uiEl.querySelector(".iq-loading");
        if (el) el.remove();
      }
    }

    function addExp(n) {
      if (!n) return;
      if (n <= 0) return;
      if (!S) return;
      S.exp += n;
      while (S.exp >= expNeed(S.lv)) {
        S.exp -= expNeed(S.lv);
        S.lv += 1;
        S.maxHp += 12;
        S.hp = S.maxHp;
        S.maxSp += 8;
        S.sp = S.maxSp;
        pushLog({ t: "sys", text: E.star + " 升级！Lv." + S.lv + " 体魄 +12，精神 +8，已回满" });
      }
    }

    function addItem(it) {
      if (!it) return;
      if (!it.name) return;
      if (!S) return;
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
        emoji: String(it.emoji || E.bag),
        desc: String(it.desc || ""),
        type: String(it.type || "道具"),
        count: Number(it.count) || 1,
      });
    }

    function addSkill(sk) {
      if (!sk) return;
      if (!sk.name) return;
      if (!S) return;
      var name = String(sk.name).trim();
      if (!name) return;
      for (var i = 0; i < S.skills.length; i++) {
        if (S.skills[i].name === name) return;
      }
      S.skills.push({
        name: name,
        emoji: String(sk.emoji || E.sparkle),
        desc: String(sk.desc || ""),
        cost: Number(sk.cost) || 0,
      });
    }

    function addQuest(q) {
      if (!q) return;
      if (!q.name) return;
      if (!S) return;
      var name = String(q.name).trim();
      if (!name) return;
      for (var i = 0; i < S.quests.length; i++) {
        if (S.quests[i].name === name) { S.quests[i].done = false; return; }
      }
      S.quests.push({ name: name, desc: String(q.desc || ""), main: !!q.main, done: false });
    }

    function doneQuest(name) {
      if (!S) return;
      for (var i = 0; i < S.quests.length; i++) {
        if (S.quests[i].name === String(name)) { S.quests[i].done = true; return; }
      }
    }

    function addAch(a) {
      if (!a) return;
      if (!a.name) return;
      if (!S) return;
      var name = String(a.name).trim();
      if (!name) return;
      for (var i = 0; i < S.achievements.length; i++) {
        if (S.achievements[i].name === name) return;
      }
      S.achievements.push({
        name: name,
        emoji: String(a.emoji || E.trophy),
        desc: String(a.desc || ""),
      });
    }

    function makeSnap() {
      return {
        turn: S.turn, lv: S.lv, exp: S.exp, hp: S.hp, maxHp: S.maxHp,
        sp: S.sp, maxSp: S.maxSp, affinity: S.affinity, mood: S.mood,
        status: clone(S.status), inventory: clone(S.inventory), skills: clone(S.skills),
        quests: clone(S.quests), achievements: clone(S.achievements), log: S.log.slice(-30),
      };
    }

    function addCheckpoint(cp) {
      if (!S) return;
      try {
        var id = uid();
        if (!kvSet(CP_PREFIX + id, JSON.stringify(makeSnap()))) return;
        S.checkpoints.push({
          id: id,
          name: String(cp.name || "存档点"),
          desc: String(cp.desc || ""),
          turn: S.turn,
          time: Date.now(),
        });
        if (S.checkpoints.length > 12) {
          var old = S.checkpoints.shift();
          if (old) { if (old.id) kvRemove(CP_PREFIX + old.id); }
        }
        pushLog({ t: "sys", text: E.disk + " 存档点：" + (cp.name || "未命名") });
      } catch (e) {}
    }

    function loadCheckpoint(id) {
      if (!S) return;
      var raw = kvGet(CP_PREFIX + id);
      if (!raw) { ctx.ui.toast("存档点数据丢失"); return; }
      var snap = raw;
      if (typeof raw === "string") {
        try { snap = JSON.parse(raw); } catch (e) { ctx.ui.toast("存档点解析失败"); return; }
      }
      if (!isObj(snap)) { ctx.ui.toast("存档点格式异常"); return; }
      S.turn = snap.turn || 0;
      S.lv = snap.lv || 1;
      S.exp = snap.exp || 0;
      if (snap.hp == null) S.hp = 100; else S.hp = snap.hp;
      S.maxHp = snap.maxHp || 100;
      if (snap.sp == null) S.sp = 100; else S.sp = snap.sp;
      S.maxSp = snap.maxSp || 100;
      S.affinity = snap.affinity || 0;
      S.mood = snap.mood || "";
      S.status = snap.status || [];
      S.inventory = snap.inventory || [];
      S.skills = snap.skills || [];
      S.quests = snap.quests || [];
      S.achievements = snap.achievements || [];
      S.log = snap.log || [];
      S.options = [];
      pushLog({ t: "sys", text: E.back + " 已回到存档点（第 " + S.turn + " 回合）" });
      save();
      render();
    }

    async function ask(system, prompt, maxTokens) {
      try {
        var res = await ctx.model.ask({
          system: system,
          prompt: prompt,
          temperature: 0.85,
          maxTokens: maxTokens || 1000,
        });
        return txtOf(res);
      } catch (err) {
        var msg = "未知错误";
        if (err) { if (err.message) msg = err.message; }
        throw new Error("模型请求失败：" + msg);
      }
    }

    function genderPref() { return String(prefsGet("partnerGender", "自动")); }

    function genderNow() {
      var pref = genderPref();
      if (pref === "自动") {
        if (S) { if (S.partner) return S.partner.gender || ""; }
        return "";
      }
      if (pref === "不指定") return "";
      return pref;
    }

    function partnerBlock(forWorld) {
      var p = S.partner;
      var g = genderNow();
      var lines = ["同伴：" + p.name];
      if (p.summary) {
        var ps = String(p.summary);
        if (ps.length > 6000) ps = ps.slice(0, 6000) + "...";
        lines.push("【完整人设】");
        lines.push(ps);
      }
      var gText = g;
      if (!gText) {
        if (forWorld) gText = "按人设判断，填进 partnerRead";
        else gText = "按人设判断";
      }
      lines.push("性别：" + gText);
      if (forWorld) {
        lines.push("说话方式：按人设判断，填进 partnerRead.voice");
        lines.push("行动习惯：按人设判断，填进 partnerRead.manner");
      } else {
        lines.push("说话方式：" + (p.voice || "按人设"));
        lines.push("行动习惯：" + (p.manner || "按人设"));
      }
      var strict = prefsGet("genderStrict", true);
      if (strict !== false) {
        if (g) {
          lines.push(p.name + "是" + g + "性，台词用词、动作力度、情绪方式贴合" + g + "性质感，不要中性化模板。");
        }
      } else {
        if (g) lines.push("性别（" + g + "）只作参考，以人设性格为主。");
      }
      if (!g) {
        if (!forWorld) lines.push("按人设判断性别，用对应口吻与行动方式。");
      }
      return lines.join(NL);
    }

    function buildWorldPrompt() {
      var diff = String(prefsGet("difficulty", "标准"));
      var tease = String(prefsGet("tease", "话痨"));
      var len = clamp(Number(prefsGet("length", 160)) || 160, 100, 260);
      return joinLines([
        "生成全新的无限流冒险世界，直接开始第一回合。",
        "",
        partnerBlock(true),
        "",
        "吐槽密度：" + tease + "。难度：" + diff + "。",
        "开场描写约 " + len + " 字。给一个明确目标和一个隐藏规则。",
        "发放 1 个初始道具、1 个初始技能，立 1 个主线任务。",
        "给 3 个不同的选项。",
        "",
        WORLD_SPEC,
      ]);
    }

    function buildTurnPrompt(action) {
      var p = S.partner;
      var diff = String(prefsGet("difficulty", "标准"));
      var tease = String(prefsGet("tease", "话痨"));
      var len = clamp(Number(prefsGet("length", 160)) || 160, 100, 260);

      var recent = [];
      var start = Math.max(0, S.log.length - 5);
      for (var i = start; i < S.log.length; i++) {
        var e = S.log[i];
        if (!e) continue;
        if (e.t === "nar") recent.push("旁白：" + cut(e.text, 100));
        else if (e.t === "npc") recent.push(e.who + "：" + cut(e.text, 40));
        else if (e.t === "char") recent.push(p.name + "：" + cut(e.text, 40));
        else if (e.t === "act") recent.push(p.name + "做：" + cut(e.text, 40));
        else if (e.t === "you") recent.push("我：" + cut(e.text, 40));
      }

      var activeQuests = [];
      for (var j = 0; j < S.quests.length; j++) {
        if (!S.quests[j].done) activeQuests.push((S.quests[j].main ? "*" : "-") + S.quests[j].name);
      }

      var bagNames = [];
      for (var k = 0; k < S.inventory.length; k++) bagNames.push(S.inventory[k].name);
      var skNames = [];
      for (var m = 0; m < S.skills.length; m++) skNames.push(S.skills[m].name);

      return joinLines([
        "世界：" + S.world.emoji + " " + S.world.name + " - " + S.world.tagline,
        "规则：" + S.world.rule + "。目标：" + S.world.goal,
        "",
        partnerBlock(false),
        "情绪：" + (S.mood || "平静") + "。状态：" + ((S.status || []).join("、") || "正常"),
        "上句吐槽：" + cut(S.charThought || "无", 60),
        "上个动作：" + cut(S.charAction || "无", 60),
        "",
        "我：Lv." + S.lv + " HP " + S.hp + "/" + S.maxHp + " SP " + S.sp + "/" + S.maxSp + " 好感 " + S.affinity,
        "背包：" + (bagNames.join(" ") || "空") + "。技能：" + (skNames.join(" ") || "无") + "。任务：" + (activeQuests.join(" ") || "无"),
        "",
        "第 " + S.turn + " 回合。最近：",
        recent.join(NL),
        "",
        "我的选择：" + action,
        "",
        "要求：描写约 " + len + " 字。charThought 是「" + p.name + "会说的话」，charAction 是「" + p.name + "会做的动作」。难度 " + diff + "。",
        "",
        TURN_SPEC,
      ]);
    }

    function applyResult(d) {
      if (!S) return;

      var safe = {};
      if (isObj(d)) safe = d;

      // 处理 partnerRead
      if (safe.partnerRead) {
        if (isObj(safe.partnerRead)) {
          if (S.partner) {
            if (!S.partner.gender) {
              if (safe.partnerRead.gender) {
                var g = String(safe.partnerRead.gender).trim();
                if (g === "男") S.partner.gender = g;
                else if (g === "女") S.partner.gender = g;
              }
            }
            if (!S.partner.voice) {
              if (safe.partnerRead.voice) S.partner.voice = String(safe.partnerRead.voice);
            }
            if (!S.partner.manner) {
              if (safe.partnerRead.manner) S.partner.manner = String(safe.partnerRead.manner);
            }
          }
        }
      }

      // 处理 world（必须保证进入游戏，模型没给就兜底）
      if (!S.world) {
        var hasWorld = false;
        if (safe.world) {
          if (isObj(safe.world)) {
            if (safe.world.name) hasWorld = true;
          }
        }
        if (hasWorld) {
          S.world = {
            name: String(safe.world.name || "无名之地"),
            emoji: String(safe.world.emoji || E.galaxy),
            tagline: String(safe.world.tagline || ""),
            rule: String(safe.world.rule || ""),
            goal: String(safe.world.goal || ""),
            desc: String(safe.world.desc || ""),
          };
        } else {
          // 兜底世界，保证能进游戏
          S.world = defaultWorld();
          pushLog({ t: "sys", text: E.info + " 模型没有返回完整的世界数据，已用默认世界开始冒险。" });
        }
      }

      if (safe.narration) pushLog({ t: "nar", text: String(safe.narration) });

      if (isArr(safe.npc)) {
        for (var i = 0; i < safe.npc.length; i++) {
          var n = safe.npc[i];
          if (!n) continue;
          if (!isObj(n)) continue;
          var who = String(n.who || "").trim();
          var text = String(n.text || "").trim();
          if (!who) { if (!text) continue; }
          pushLog({
            t: "npc",
            emoji: String(n.emoji || E.person),
            who: who || "某人",
            text: text,
          });
        }
      }

      if (safe.charThought) {
        S.charThought = String(safe.charThought);
        pushLog({ t: "char", text: S.charThought });
      }
      if (safe.charAction) {
        S.charAction = String(safe.charAction);
        pushLog({ t: "act", text: S.charAction });
      }
      if (safe.charMood) S.mood = String(safe.charMood);
      if (isArr(safe.charStatus)) S.status = safe.charStatus.map(String).filter(Boolean).slice(0, 6);

      var dd = {};
      if (isObj(safe.deltas)) dd = safe.deltas;
      if (dd.hp) S.hp = clamp(S.hp + (Number(dd.hp) || 0), 0, S.maxHp);
      if (dd.sp) S.sp = clamp(S.sp + (Number(dd.sp) || 0), 0, S.maxSp);
      if (dd.affinity) S.affinity = clamp(S.affinity + (Number(dd.affinity) || 0), -100, 100);
      if (dd.exp) addExp(Number(dd.exp) || 0);

      if (isArr(safe.items)) {
        for (var j = 0; j < safe.items.length; j++) addItem(safe.items[j]);
      }
      if (isArr(safe.skills)) {
        for (var k = 0; k < safe.skills.length; k++) addSkill(safe.skills[k]);
      }

      if (isObj(safe.quests)) {
        if (isArr(safe.quests.new)) {
          for (var m = 0; m < safe.quests.new.length; m++) addQuest(safe.quests.new[m]);
        }
        if (isArr(safe.quests.done)) {
          for (var p2 = 0; p2 < safe.quests.done.length; p2++) doneQuest(safe.quests.done[p2]);
        }
      }

      if (isArr(safe.achievements)) {
        for (var q2 = 0; q2 < safe.achievements.length; q2++) addAch(safe.achievements[q2]);
      }

      if (safe.checkpoint) {
        if (isObj(safe.checkpoint)) {
          var cpName = safe.checkpoint.name;
          var cpDesc = safe.checkpoint.desc;
          if (cpName) addCheckpoint(safe.checkpoint);
          else if (cpDesc) addCheckpoint(safe.checkpoint);
        }
      }

      if (isArr(safe.options)) {
        var opts = [];
        for (var r = 0; r < safe.options.length; r++) {
          var s = String(safe.options[r]).trim();
          if (s) opts.push(s);
          if (opts.length >= 4) break;
        }
        S.options = opts;
      } else {
        S.options = [];
      }

      if (S.hp <= 0) {
        pushLog({ t: "sys", text: E.skull + " 你倒下了。世界没有因此停下 - 但你可以回到上一个存档点。" });
        S.hp = Math.max(1, Math.round(S.maxHp * 0.2));
        S.options = [];
      }
    }

    async function startWorld(partner) {
      if (busy) { ctx.ui.toast("正在处理，请稍候"); return; }
      if (!partner) { ctx.ui.toast("同伴数据异常"); return; }
      if (!partner.name) { ctx.ui.toast("同伴数据异常"); return; }
      busy = true;
      var myId = ++genId;
      tab = "story";

      var prevGender = "";
      var prevVoice = "";
      var prevManner = "";
      if (S) {
        if (S.partner) {
          prevGender = S.partner.gender || "";
          prevVoice = S.partner.voice || "";
          prevManner = S.partner.manner || "";
        }
      }

      S = blank();

      var persona = { name: partner.name || "无名", summary: "" };
      try {
        persona = extractPersona(partner);
      } catch (e) {
        persona = { name: partner.name || "无名", summary: String(partner.summary || ""), full: partner };
      }

      try {
        S.partner = {
          id: partner.id,
          name: persona.name || partner.name || "无名",
          summary: persona.summary || String(partner.summary || ""),
          gender: prevGender,
          voice: prevVoice,
          manner: prevManner,
        };
      } catch (e) {
        S.partner = { id: partner.id, name: "无名", summary: "", gender: "", voice: "", manner: "" };
      }

      var pref = genderPref();
      if (pref === "男") S.partner.gender = pref;
      else if (pref === "女") S.partner.gender = pref;
      S.turn = 1;
      lastError = "";

      render();
      showLoading("正在生成世界", "和 " + S.partner.name + " 一起进入无限流");

      try {
        var raw = await ask(WORLD_SYS, buildWorldPrompt(), 1000);
        if (myId !== genId) return;
        var data = parseJSON(raw);
        if (!data) {
          // 解析失败也强行进入游戏
          pushLog({ t: "sys", text: E.warn + " 模型没有返回结构化数据，已用默认世界开始冒险。" });
          data = {};
        }
        applyResult(data);
      } catch (err) {
        if (myId !== genId) return;
        var msg = "生成失败，已用默认世界开始冒险。";
        if (err) { if (err.message) msg = err.message + " - 已用默认世界开始。"; }
        pushLog({ t: "sys", text: E.warn + " " + msg });
        // 关键：即使失败也确保有 world
        applyResult({});
      } finally {
        if (myId === genId) {
          busy = false;
          hideLoading();
          // 关键：只要 S 存在且有 world 就保存
          if (S) {
            if (!S.world) { S.world = defaultWorld(); }
            save();
          }
          render();
        }
      }
    }

    async function takeTurn(action) {
      if (busy) return;
      if (!S) return;
      if (!S.world) return;
      action = String(action || "").trim();
      if (!action) return;
      busy = true;
      var myId = ++genId;
      S.turn += 1;
      pushLog({ t: "you", text: action });
      S.options = [];
      render();   // busy=true，story 页会自动渲染「…」

      try {
        var raw = await ask(TURN_SYS, buildTurnPrompt(action), 900);
        if (myId !== genId) return;
        if (!raw) throw new Error("模型没有回应");
        var data = parseJSON(raw);
        if (!data) {
          pushLog({ t: "nar", text: raw });
          pushLog({ t: "sys", text: E.warn + " 这回合没有结构化结果。可以继续行动。" });
        } else {
          applyResult(data);
        }
      } catch (err) {
        if (myId !== genId) return;
        var msg = "行动失败，请重试";
        if (err) { if (err.message) msg = err.message; }
        pushLog({ t: "sys", text: E.warn + " " + msg });
      } finally {
        if (myId === genId) {
          busy = false;
          save();
          render();
        }
      }
    }

    function abandonWait() {
      if (!busy) return;
      genId++;
      busy = false;
      hideLoading();
      if (!S) { lastError = "已取消等待。"; }
      else if (!S.world) {
        // 关键：取消等待也进入游戏，不卡在选择界面
        S.world = defaultWorld();
        pushLog({ t: "sys", text: E.stop + " 已取消等待，用默认世界开始冒险。" });
      } else { pushLog({ t: "sys", text: E.stop + " 已放弃等待。" }); }
      save();
      render();
    }

    function render() {
      if (!uiEl) return;
      var el = uiEl;
      el.innerHTML = "";
      var root = div("iq-root");

      var hasPartner = false;
      var hasWorld = false;
      if (S) {
        if (S.partner) hasPartner = true;
        if (S.world) hasWorld = true;
      }

      if (!hasPartner) {
        root.appendChild(viewStart());
      } else if (!hasWorld) {
        // 理论上不应该进来，兜底也进游戏
        S.world = defaultWorld();
        hasWorld = true;
        root.appendChild(viewTop());
        root.appendChild(viewStatus());
        root.appendChild(viewPartner());
        root.appendChild(viewTabs());
        var body0 = div("iq-body");
        body0.appendChild(viewTabContent());
        root.appendChild(body0);
      } else {
        root.appendChild(viewTop());
        root.appendChild(viewStatus());
        root.appendChild(viewPartner());
        root.appendChild(viewTabs());
        var body = div("iq-body");
        body.appendChild(viewTabContent());
        root.appendChild(body);
        el.appendChild(root);
        if (tab === "story") {
          setTimeout(function () {
            try { body.scrollTop = body.scrollHeight; } catch (e) {}
          }, 0);
        }
        return;
      }
      el.appendChild(root);
    }

    function viewStart() {
      var wrap = div("iq-center");
      var h = div("iq-hero");
      h.textContent = E.dice;
      wrap.appendChild(h);
      var t = div("iq-hero-t");
      t.textContent = "无限流冒险";
      wrap.appendChild(t);
      var d = div("iq-hero-d");
      d.textContent = "随机生成一个世界，带上你的角色一起闯。" + NL + "她或他会用自己的口吻吐槽，也会用自己的方式保护你。";
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
      title.textContent = E.people + " 选一个同伴";
      title.style.marginTop = "22px";
      wrap.appendChild(title);
      var hint = div("iq-hint");
      hint.textContent = "性别与说话方式由 AI 根据完整人设自动判断。";
      wrap.appendChild(hint);

      var grid = div("iq-grid");
      for (var i = 0; i < list.length; i++) {
        grid.appendChild(makePartnerCard(list[i]));
      }
      wrap.appendChild(grid);
      return wrap;
    }

    function makePartnerCard(p) {
      var card = btn("iq-pcard");
      var ava = div("iq-pava");
      ava.textContent = (p.name || "?").slice(0, 1);
      card.appendChild(ava);
      var info = div("iq-pinfo");
      var nm = div("iq-pname2");
      nm.textContent = p.name || "无名";
      info.appendChild(nm);
      var ds = div("iq-pdesc");
      ds.textContent = cut(p.summary || "还没有人设", 60);
      info.appendChild(ds);
      card.appendChild(info);
      card.addEventListener("click", function (e) {
        e.stopPropagation();
        startWorld(p);
      });
      return card;
    }

    function viewError() {
      var wrap = div("iq-center");
      var h = div("iq-hero");
      h.textContent = E.warn;
      wrap.appendChild(h);
      var t = div("iq-hero-t");
      t.textContent = "生成遇到问题";
      wrap.appendChild(t);

      var d = div("iq-hero-d");
      var base = lastError;
      if (!base) base = "模型没有返回有效数据。";
      d.textContent = base + NL + NL + "同伴信息已保留，点重试不用重新选人。";
      wrap.appendChild(d);

      var grid = div("iq-grid");
      grid.style.marginTop = "22px";

      var retry = btn("iq-pcard");
      var rInfo = div("iq-pinfo");
      var rName = div("iq-pname2");
      rName.textContent = E.refresh + " 重试";
      rInfo.appendChild(rName);
      var rDesc = div("iq-pdesc");
      rDesc.textContent = "用 " + S.partner.name + " 重新生成世界";
      rInfo.appendChild(rDesc);
      retry.appendChild(rInfo);
      retry.addEventListener("click", function (e) {
        e.stopPropagation();
        startWorld(S.partner);
      });
      grid.appendChild(retry);

      var back = btn("iq-pcard");
      var bInfo = div("iq-pinfo");
      var bName = div("iq-pname2");
      bName.textContent = E.back + " 换一个同伴";
      bInfo.appendChild(bName);
      var bDesc = div("iq-pdesc");
      bDesc.textContent = "回到选择界面";
      bInfo.appendChild(bDesc);
      back.appendChild(bInfo);
      back.addEventListener("click", function (e) {
        e.stopPropagation();
        S = null;
        save();
        render();
      });
      grid.appendChild(back);

      wrap.appendChild(grid);
      return wrap;
    }

    function viewTop() {
      var top = div("iq-top");
      var w = div("iq-world");
      w.textContent = S.world.emoji + " " + S.world.name;
      top.appendChild(w);
      var right = div("iq-top");
      var meta = div("iq-meta");
      meta.textContent = "回合 " + S.turn;
      right.appendChild(meta);
      var menu = btn("iq-btn", E.menu);
      menu.onclick = openMenu;
      right.appendChild(menu);
      top.appendChild(right);
      return top;
    }

    function bar(label, cur, max, color, numText) {
      var row = div("iq-row");
      var lb = div("lb");
      lb.textContent = label;
      row.appendChild(lb);
      var track = div("iq-track");
      var fill = div("iq-fill");
      var pct = 0;
      if (max > 0) pct = clamp(cur / max * 100, 0, 100);
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
      box.appendChild(bar("EXP", S.exp, expNeed(S.lv), "#ffc061", "Lv." + S.lv + " " + S.exp + "/" + expNeed(S.lv)));
      var aff = div("iq-stats");
      aff.textContent = E.heart + " 好感 " + S.affinity + "   " + E.target + " " + (S.world.goal || "无目标");
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
        chip.className = "iq-chip";
        if (g === "男") chip.textContent = E.male + " 男";
        else chip.textContent = E.female + " 女";
        nm.appendChild(chip);
      }
      if (S.mood) {
        var c2 = document.createElement("span");
        c2.className = "iq-chip";
        c2.textContent = S.mood;
        nm.appendChild(c2);
      }
      var stArr = S.status || [];
      for (var i = 0; i < stArr.length; i++) {
        var c = document.createElement("span");
        c.className = "iq-chip";
        c.textContent = stArr[i];
        nm.appendChild(c);
      }
      info.appendChild(nm);
      if (S.charThought) {
        var say = div("iq-say");
        say.textContent = E.speech + " " + S.charThought;
        info.appendChild(say);
      }
      box.appendChild(info);
      return box;
    }

    function viewTabs() {
      var box = div("iq-tabs");
      for (var i = 0; i < TABS.length; i++) {
        box.appendChild(makeTab(TABS[i][0], TABS[i][1]));
      }
      return box;
    }

    function makeTab(k, label) {
      var cls = "iq-tab";
      if (tab === k) cls = "iq-tab on";
      var b = btn(cls, label);
      b.addEventListener("click", function () {
        tab = k;
        render();
      });
      return b;
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
        var d1 = div("iq-story");
        d1.textContent = e.text;
        return d1;
      }
      if (e.t === "npc") {
        var d2 = div("iq-npc");
        var who = document.createElement("span");
        who.className = "who";
        var prefix = e.emoji || E.person;
        who.textContent = prefix + " " + (e.who || "某人") + "：";
        d2.appendChild(who);
        d2.appendChild(document.createTextNode(e.text || ""));
        return d2;
      }
      if (e.t === "char") {
        var d3 = div("iq-charline");
        d3.textContent = E.speech + " " + S.partner.name + "：" + e.text;
        return d3;
      }
      if (e.t === "act") {
        var dA = div("iq-charact");
        dA.textContent = E.clap + " " + S.partner.name + " " + e.text;
        return dA;
      }
      if (e.t === "you") {
        var d4 = div("iq-you");
        d4.textContent = "你：" + e.text;
        return d4;
      }
      if (e.t === "sys") {
        var d5 = div("iq-sys");
        if (e.text) {
          if (e.text.indexOf(E.warn) === 0) d5.className = "iq-sys warn";
          else if (e.text.indexOf(E.info) === 0) d5.className = "iq-sys warn";
        }
        d5.textContent = e.text;
        return d5;
      }
      return div("iq-story");
    }

    function viewStory() {
      var wrap = div("iq-story-list");
      var start = Math.max(0, S.log.length - 40);
      for (var i = start; i < S.log.length; i++) {
        wrap.appendChild(renderLogEntry(S.log[i]));
      }

      // 等待模型返回时，用「…」代替选项/输入区
      if (busy) {
        var thinking = div("iq-thinking");
        thinking.textContent = "…";
        wrap.appendChild(thinking);
        return wrap;
      }

      if (S.options) {
        if (S.options.length) {
          var opts = div("iq-opts");
          for (var j = 0; j < S.options.length; j++) {
            opts.appendChild(makeOption(S.options[j], j));
          }
          wrap.appendChild(opts);
        }
      }

      var inputRow = div("iq-input");
      var inp = document.createElement("input");
      inp.type = "text";
      inp.placeholder = E.pencil + " 也可以自己写你要做什么";
      inp.value = draft;
      inp.oninput = function () { draft = inp.value; };
      inp.onkeydown = function (ev) {
        if (ev.key === "Enter") {
          if (draft.trim()) {
            var v = draft.trim();
            draft = "";
            takeTurn(v);
          }
        }
      };
      inputRow.appendChild(inp);
      var go = btn("iq-btn primary", E.zap + " 行动");
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

    function makeOption(o, idx) {
      var b = btn("iq-opt");
      var i2 = document.createElement("span");
      i2.className = "idx";
      i2.textContent = String.fromCharCode(65 + idx);
      b.appendChild(i2);
      b.appendChild(document.createTextNode(o));
      b.onclick = function () { takeTurn(o); };
      return b;
    }

    function emptyBox(text) {
      var d = div("iq-empty");
      d.textContent = text;
      return d;
    }

    function viewBag() {
      if (!S.inventory.length) return emptyBox(E.bag + " 背包空空如也。继续探索，会有收获的。");
      var wrap = div("iq-cards");
      for (var i = 0; i < S.inventory.length; i++) {
        var it = S.inventory[i];
        var c = div("iq-card");
        var h = document.createElement("h4");
        h.textContent = (it.emoji || E.bag) + " " + it.name;
        var tag = document.createElement("span");
        tag.className = "iq-chip";
        tag.textContent = it.type || "道具";
        h.appendChild(tag);
        if (it.count > 1) {
          var c2 = document.createElement("span");
          c2.className = "iq-chip";
          c2.textContent = "x" + it.count;
          h.appendChild(c2);
        }
        c.appendChild(h);
        if (it.desc) {
          var p = document.createElement("p");
          p.textContent = it.desc;
          c.appendChild(p);
        }
        wrap.appendChild(c);
      }
      return wrap;
    }

    function viewSkill() {
      if (!S.skills.length) return emptyBox(E.sparkle + " 还没有技能。冒险中会解锁的。");
      var wrap = div("iq-cards");
      for (var i = 0; i < S.skills.length; i++) {
        var sk = S.skills[i];
        var c = div("iq-card");
        var h = document.createElement("h4");
        h.textContent = (sk.emoji || E.sparkle) + " " + sk.name;
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
      }
      return wrap;
    }

    function viewQuest() {
      if (!S.quests.length) return emptyBox(E.target + " 暂时没有任务。探索中会接到。");
      var wrap = div("iq-cards");
      var active = [];
      var done = [];
      for (var i = 0; i < S.quests.length; i++) {
        if (S.quests[i].done) done.push(S.quests[i]);
        else active.push(S.quests[i]);
      }
      var all = active.concat(done);
      for (var j = 0; j < all.length; j++) {
        var q = all[j];
        var cls = "iq-card";
        if (q.done) cls = "iq-card done";
        var c = div(cls);
        var h = document.createElement("h4");
        var prefix = E.pin;
        if (q.done) prefix = E.check;
        else if (q.main) prefix = E.star;
        h.textContent = prefix + " " + q.name;
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
      }
      return wrap;
    }

    function viewAch() {
      if (!S.achievements.length) return emptyBox(E.trophy + " 还没有成就。做出点让人记住的事吧。");
      var wrap = div("iq-cards");
      for (var i = 0; i < S.achievements.length; i++) {
        var a = S.achievements[i];
        var c = div("iq-card");
        var h = document.createElement("h4");
        h.textContent = (a.emoji || E.trophy) + " " + a.name;
        c.appendChild(h);
        if (a.desc) {
          var p = document.createElement("p");
          p.textContent = a.desc;
          c.appendChild(p);
        }
        wrap.appendChild(c);
      }
      return wrap;
    }

    function viewSave() {
      var wrap = div("iq-cards");
      var hint = div("iq-hint");
      hint.textContent = E.disk + " 点回到这里可以读档。读档只回滚剧情和数值。";
      wrap.appendChild(hint);
      if (!S.checkpoints.length) {
        wrap.appendChild(emptyBox(E.disk + " 还没有存档点。慢慢来，故事才刚开始。"));
        return wrap;
      }
      var rev = S.checkpoints.slice().reverse();
      for (var i = 0; i < rev.length; i++) {
        wrap.appendChild(makeSaveCard(rev[i]));
      }
      return wrap;
    }

    function makeSaveCard(cp) {
      var c = div("iq-card");
      var h = document.createElement("h4");
      h.textContent = E.disk + " " + cp.name;
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
      var loadBtn = btn("iq-btn", E.back + " 回到这里");
      loadBtn.style.marginTop = "8px";
      loadBtn.onclick = function () { loadCheckpoint(cp.id); };
      c.appendChild(loadBtn);
      return c;
    }

    function viewMate() {
      var wrap = div("iq-cards");
      var c = div("iq-card");
      var h = document.createElement("h4");
      h.textContent = E.person + " " + S.partner.name;
      var g = genderNow();
      if (g) {
        var tg = document.createElement("span");
        tg.className = "iq-chip";
        if (g === "男") tg.textContent = E.male + " 男";
        else tg.textContent = E.female + " 女";
        h.appendChild(tg);
      }
      c.appendChild(h);

      var summaryText = S.partner.summary || "（没有读取到人设）";
      var preview = summaryText;
      if (preview.length > 400) preview = preview.slice(0, 400) + "...（完整人设已注入，共 " + summaryText.length + " 字）";
      var p0 = document.createElement("p");
      p0.textContent = "【完整人设】" + NL + preview;
      c.appendChild(p0);

      var p = document.createElement("p");
      p.style.marginTop = "6px";
      var voiceText = S.partner.voice || "（未记录）";
      var mannerText = S.partner.manner || "（未记录）";
      p.textContent = E.speech + " 说话方式：" + voiceText + NL + E.clap + " 行动习惯：" + mannerText;
      c.appendChild(p);
      var p2 = document.createElement("p");
      p2.style.marginTop = "6px";
      var statusText = (S.status || []).join("、") || "正常";
      p2.textContent = E.heart + " 好感 " + S.affinity + " 情绪 " + (S.mood || "平静") + " 状态 " + statusText;
      c.appendChild(p2);
      wrap.appendChild(c);

      var restart = btn("iq-btn", E.refresh + " 换一个世界 / 换同伴");
      restart.style.marginTop = "8px";
      restart.onclick = function () {
        confirmDialog("确定要重开吗？当前进度会丢失。", function () {
          S = null;
          save();
          render();
        });
      };
      wrap.appendChild(restart);
      return wrap;
    }

    function openMenu() {
      var root = uiEl.querySelector(".iq-root");
      if (!root) return;
      var mask = div("iq-mask");
      var sheet = div("iq-sheet");
      var b1 = btn("", E.refresh + " 重新开始这一局");
      b1.onclick = function () {
        mask.remove();
        confirmDialog("重开？当前进度会丢失。", function () {
          S = null;
          save();
          render();
        });
      };
      sheet.appendChild(b1);
      var b2 = btn("", E.disk + " 打开存档点");
      b2.onclick = function () { mask.remove(); tab = "save"; render(); };
      sheet.appendChild(b2);
      var b3 = btn("", E.cross + " 关闭");
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
      yes.onclick = function () {
        mask.remove();
        if (onYes) onYes();
      };
      sheet.appendChild(yes);
      var no = btn("", "取消");
      no.onclick = function () { mask.remove(); };
      sheet.appendChild(no);
      mask.appendChild(sheet);
      mask.onclick = function (e) { if (e.target === mask) mask.remove(); };
      root.appendChild(mask);
    }

    return ctx.ui.appPage(function (el) {
      try {
        uiEl = el;
        el.style.height = "100%";
        el.style.overflow = "hidden";
        el.style.position = "relative";
        var loadingHtml = '<div class="iq-root" style="display:flex;align-items:center;justify-content:center;height:100%;">';
        loadingHtml += '<div style="font-size:12.5px;opacity:.5;">' + E.dice + ' 正在载入...</div>';
        loadingHtml += '</div>';
        el.innerHTML = loadingHtml;
        setTimeout(function () {
          try { load(); render(); }
          catch (e) {
            el.innerHTML = '<div class="iq-root"><div class="iq-empty">载入失败，请重进。</div></div>';
          }
        }, 0);
      } catch (e) {}
    });
  },
};