/**
 * 记忆（puff-memory）v2.0.0 —— Puff 插件
 *
 * 增量提取 · 分层存放 · 按需注入
 *  - 后台用 ctx.model.ask 把新消息整理成记忆，分「核心档案 / 事件 / 往事」三层
 *  - 新记忆先进「待确认」，你点头才生效（设置里可关）
 *  - 聊天时在系统提示词末尾追加一小块记忆：核心档案常驻，事件按相关度挑
 *  - 桌面 App「记忆」：查看、编辑、删除、置顶、确认、撤销压缩、诊断
 *  - 长按气泡「记住这条」手动补记
 *
 * v2：补录旧记录。每批 40 条、从最早往后、批间限速、显示进度、随时暂停。
 *     补录出的记忆默认先进待确认，攒到 50 条自动暂停，你看完再继续。
 *     从 v1 升级：同 id 再导入即可，已有记忆和设置都保留。
 */

const DAY = 86400000;
const BATCH_MAX = 40;            // 一次交给模型的消息上限
const MAX_BATCHES_PER_RUN = 4;   // 一次触发最多连跑几批，防止一下子烧太多额度
const MIN_IDLE_BATCH = 6;        // 空闲 / 回来时，至少攒了几条才整理
const TAIL_GUARD_MS = 3 * 60000; // 刚聊过的最后两条先不整理，给重新生成留余地
const ARCHIVE_CAP = 400;
const PENDING_CAP = 150;
const SRC_CAP = 3000;
const DEF_OFFLINE = "offline,线下,共处";
const BACK_PAUSE_AT = 50;        // 补录出的待确认攒到这么多就暂停
const BACK_RESUME_AT = 10;       // 降到这么多以内自动继续
const BACK_GAPS = [3, 8, 15, 30, 60];

const STOP = new Set((
  "我们 你们 他们 她们 它们 咱们 一个 一下 一点 一起 一直 一样 什么 怎么 为什么 没有 就是 这个 那个 这些 那些 " +
  "这样 那样 这么 那么 自己 知道 觉得 现在 今天 还是 可以 不是 因为 所以 然后 但是 如果 已经 时候 真的 有点 " +
  "东西 不要 不会 的话 还有 只是 而且 其实 应该 可能 好像 感觉 一定 起来 出来 过来 回来 下来 你的 我的 他的 " +
  "她的 了吗 了吧 是不 是的 好的 嗯嗯 哈哈 啊啊 呜呜 一会 有没 不过 怎样 这里 那里"
).split(/\s+/).filter(Boolean));

const EXTRACT_SYSTEM =
  "你是聊天记忆整理员。你读一段聊天记录和已有记忆，判断哪些信息值得长期记住，" +
  "输出对记忆库的新增、修改、删除操作。只输出一个 JSON 对象，不要解释，不要代码块标记。";

function extractPrompt(U, C, memLines, msgLines, extra) {
  return [
    "【人物】",
    "- " + U + "：真人用户。",
    "- " + C + "：AI 扮演的角色。",
    "",
    "【已有记忆】（m 开头是已生效的，p 开头是还在等确认的）",
    memLines.length ? memLines.join("\n") : "（还没有）",
    "",
    "【新消息】（#序号 [时间 来源] 说话人：内容。线上 = 手机里聊天，线下 = 见面共处的叙事）",
    msgLines.join("\n"),
    "",
    "【值得记的】",
    "1. 关于" + U + "：喜欢和讨厌的东西、习惯、经历、身边的人、身体和情绪状况、在意的事、雷区。例：「" + U + "不喜欢吃苦瓜」「" + U + "喜欢待在没有人的地方」。",
    "2. 关于" + C + "自己：" + C + "亲口说过的关于自己的事、答应过的事、表过的态、说出口的心情。忠实于原意，以后不能自相矛盾。",
    "3. 两人之间：约定、纪念日、彼此的称呼、吵架与和好及原因、关系上的变化。",
    "4. 线下共处：写成一句完整叙述——在哪里、发生了什么、两人情绪怎么变化。例：「" + U + "和" + C + "在便利店门口躲雨，" + U + "靠着" + C + "睡着了，" + C + "一直没动」。",
    "",
    "【不要记】",
    "寒暄；没有信息量的语气和情绪词；一次性的闲聊；台词的修辞和动作描写本身；玩笑、反话、假设；和已有记忆重复的内容。" +
      C + "对" + U + "的猜测不算事实，只记" + U + "自己说出或明确表现出来的。",
    "",
    "【写法】",
    "- text：一句话，第三人称，直接写名字（" + U + "、" + C + "），不要用「我」「你」。不超过 50 字。",
    "- layer：core = 长期稳定、反复会用到的（称呼、生日、喜好、雷区、关系状态）；event = 有时间点的具体事件、承诺、经历。",
    "- subject：user = 关于" + U + "；char = 关于" + C + "；both = 两人之间。",
    "- type：偏好 / 雷区 / 习惯 / 经历 / 状态 / 人际 / 约定 / 承诺 / 心情 / 场景 / 其他，选一个。",
    "- importance：1 随口一提，3 普通，5 绝不能忘（雷区、重大承诺、关系转折）。",
    "- date：事件发生的日期 YYYY-MM-DD，按消息时间；core 可留空。",
    "- source：online 或 offline。",
    "- refs：依据的消息序号，如 [3,5]。",
    "",
    "【和已有记忆的关系】",
    "- 说的是同一件事但内容变了（如「喜欢甜的」→「最近在戒糖」）：用 update 改那一条，不要新增一条互相矛盾的。",
    "- 已有记忆被明确推翻、或证明记错了：delete。",
    "- 只是重复：什么都不做。",
    "",
    ...(extra && extra.length ? ["【这批是旧记录】"].concat(extra, [""]) : []),
    "【输出格式】",
    '{"ops":[',
    '{"op":"add","layer":"core","subject":"user","type":"偏好","text":"…","importance":4,"date":"","source":"online","refs":[3]},',
    '{"op":"update","id":"m3","text":"…","importance":3,"reason":"…"},',
    '{"op":"delete","id":"m7","reason":"…"}',
    "]}",
    '没有值得记的就输出 {"ops":[]}。宁缺毋滥。',
  ].join("\n");
}

export default {
  manifest: {
    id: "puff-memory",
    name: "记忆",
    engine: "puff",
    apiVersion: 1,
    version: "2.0.0",
    description:
      "从私聊（含线下共处）里自动整理关于你和角色的记忆，分核心档案、事件、往事三层存放；" +
      "聊天时按相关度挑几条带进提示词。新记忆默认先进「待确认」。可以分批补录装插件之前的旧记录。",
    permissions: [
      "读取私聊消息",
      "调用你配置的模型 API（会消耗额度）",
      "在系统提示词末尾追加记忆",
      "在本机存储记忆（含隐私）",
    ],
    settings: [
      { key: "userName", label: "你的名字", type: "text", default: "名字", description: "记忆里怎么称呼你，比如「名字不喜欢吃苦瓜」" },
      { key: "batchSize", label: "攒够几条新消息整理一次", type: "number", default: 30 },
      { key: "idleMinutes", label: "停聊几分钟后把零头也整理掉", type: "number", default: 20, description: "填 0 = 只按条数整理" },
      { key: "autoConfirm", label: "新记忆不用我确认", type: "boolean", default: false, description: "不推荐：模型会脑补，错的记忆会被后面的对话越用越深" },
      { key: "inject", label: "聊天时带上记忆", type: "boolean", default: true },
      { key: "budget", label: "每次带上的记忆字数上限", type: "number", default: 700 },
      { key: "maxEvents", label: "事件超过几条就压缩最旧的", type: "number", default: 60 },
      { key: "charAsYou", label: "带上记忆时把角色名换成「你」", type: "boolean", default: true },
      { key: "offlineKeys", label: "线下 purpose 关键词", type: "text", default: DEF_OFFLINE, description: "逗号分隔。先线上、线下各聊几句，再去「记忆 → 工具 → 诊断」看真实取值，不对就改这里" },
      { key: "skipPurposes", label: "这些 purpose 不带记忆", type: "text", default: "", description: "逗号分隔，留空 = 私聊里全都带" },
      { key: "notify", label: "整理出新记忆时提示我", type: "boolean", default: true },
    ],
    app: { name: "记忆", letter: "忆" },
  },

  setup(ctx) {
    const PID = (ctx.meta && ctx.meta.id) || "puff-memory";
    let focusSid = "";
    let alive = true;

    /* ======================= 基础工具 ======================= */

    const log = (...a) => { try { ctx.kit.log("[记忆]", ...a); } catch (_) { /* 忽略 */ } };
    const toast = (t, ms) => { try { ctx.ui.toast(t, { durationMs: ms || 2600 }); } catch (_) { /* 忽略 */ } };
    const errMsg = (e) => String((e && e.message) || e || "未知错误");
    const fmtN = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    // 可被打断的等待：插件被禁用或你点了暂停，就提前结束
    function nap(ms, token) {
      return new Promise((res) => {
        const end = Date.now() + ms;
        const tick = () => {
          if (!alive || (token && token.stop) || Date.now() >= end) { res(); return; }
          ctx.kit.later(tick, Math.max(20, Math.min(500, end - Date.now())));
        };
        tick();
      });
    }

    function pref(k, d) {
      let v;
      try { v = ctx.kit.prefs.get(k); } catch (_) { v = undefined; }
      return v === undefined || v === null ? d : v;
    }
    function prefNum(k, d, lo, hi) {
      const raw = pref(k, d);
      const n = raw === "" ? NaN : Number(raw);
      return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
    }
    function prefBool(k, d) {
      const v = pref(k, d);
      if (v === true || v === "true" || v === 1 || v === "1") return true;
      if (v === false || v === "false" || v === 0 || v === "0") return false;
      return d;
    }
    function prefList(k, d) {
      return String(pref(k, d) || "").split(/[,，、;；\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    }
    const userName = () => String(pref("userName", "名字") || "").trim() || "我";

    async function kvGet(k, d) {
      try {
        let v = await ctx.kit.kv.get(k);
        if (typeof v === "string" && d && typeof d === "object") {
          try { v = JSON.parse(v); } catch (_) { v = null; }
        }
        return v === undefined || v === null ? d : v;
      } catch (e) { log("读存储失败", k, e); return d; }
    }
    async function kvSet(k, v) {
      try { await ctx.kit.kv.set(k, v); } catch (e) { log("写存储失败", k, e); }
    }
    async function kvKeys() {
      try { const r = await ctx.kit.kv.keys(); return Array.isArray(r) ? r : []; } catch (_) { return []; }
    }
    const K_STATE = (sid) => "s:" + sid;
    const K_SRC = (sid) => "src:" + sid;
    async function knownSids() {
      return (await kvKeys()).filter((k) => typeof k === "string" && k.indexOf("s:") === 0).map((k) => k.slice(2));
    }

    const pad = (n) => String(n).padStart(2, "0");
    const ymd = (t) => { const d = new Date(t); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
    const mdhm = (t) => { const d = new Date(t); return pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
    const ymdhm = (t) => ymd(t) + " " + mdhm(t).slice(6);
    function dateMs(s) {
      if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return 0;
      const t = new Date(s + "T12:00:00").getTime();
      return Number.isFinite(t) ? t : 0;
    }
    function shortDate(s) {
      const t = dateMs(s);
      if (!t) return "";
      const d = new Date(t);
      return (d.getFullYear() === new Date().getFullYear() ? "" : d.getFullYear() + "年") + (d.getMonth() + 1) + "月" + d.getDate() + "日";
    }

    // 只处理私聊（含线下私聊）；群聊和群共处跳过
    const isPrivate = (sid) => typeof sid === "string" && sid.length > 0 && !/^group/.test(sid);

    /* ======================= 消息 ======================= */

    function pickMsg(p) {
      if (!p || typeof p !== "object") return null;
      const m = p.message || p.row || p.msg || p;
      return m && typeof m === "object" && (m.role || m.content !== undefined) ? m : null;
    }
    function msgTime(m) {
      if (!m) return 0;
      const keys = ["createdAt", "created_at", "time", "ts", "timestamp", "date"];
      for (const k of keys) {
        const v = m[k];
        if (v === undefined || v === null || v === "") continue;
        const n = typeof v === "number" ? v : Date.parse(v);
        if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
      }
      return 0;
    }
    function msgText(m) {
      let c = m.content;
      if (Array.isArray(c)) c = c.map((x) => (x && typeof x === "object" ? x.text || "" : String(x || ""))).join(" ");
      else if (c && typeof c === "object") c = c.text || "";
      c = String(c || "");
      if (/^data:/.test(c)) c = "";
      c = c.replace(/\s+/g, " ").trim();
      const mt = m.mediaType && m.mediaType !== "text" ? String(m.mediaType) : "";
      if (!mt) return c;
      const tag = mt === "image" ? "[图片]" : mt === "voice" ? "[语音]" : "[" + mt + "]";
      return c ? tag + " " + c : tag;
    }
    const validRows = (rows) => (Array.isArray(rows) ? rows : []).filter((m) => m && (m.role === "user" || m.role === "assistant"));
    async function listRows(sid) {
      try { const r = await ctx.rows.list(sid); return Array.isArray(r) ? r : []; } catch (e) { log("读消息失败", sid, e); return []; }
    }

    // 游标：记到哪条消息了（id 优先，删了就按时间，再不行按条数）
    function cursorOf(valid, idx) {
      const m = valid[idx];
      return m ? { id: m.id || null, t: msgTime(m), n: idx + 1 } : { id: null, t: 0, n: 0 };
    }
    function cursorAtEnd(rows, exceptId) {
      const valid = validRows(rows).filter((m) => !exceptId || m.id !== exceptId);
      return cursorOf(valid, valid.length - 1);
    }
    // 游标在 valid 里的下标；没有游标 = -1
    function cursorIndex(valid, c) {
      if (!c) return -1;
      if (c.id) {
        const i = valid.findIndex((m) => m.id === c.id);
        if (i >= 0) return i;
      }
      if (c.t) {
        let k = -1;
        for (let i = 0; i < valid.length; i++) { if (msgTime(valid[i]) <= c.t) k = i; else break; }
        return k;
      }
      return Math.min(c.n || 0, valid.length) - 1;
    }
    // 第一次见到这个对话：游标放到最新，同时记下「起点」——起点之前的都算旧记录，留给补录
    function initCursor(st, rows, exceptId) {
      st.cursor = cursorAtEnd(rows, exceptId);
      if (!st.origin) st.origin = Object.assign({}, st.cursor);
    }
    // v1 升级上来没有起点：从最早被自动整理引用过的那条往前算
    function ensureOrigin(st, valid) {
      if (st.origin || !st.cursor) return false;
      let first = cursorIndex(valid, st.cursor) + 1;
      const refs = new Set();
      const collect = (m) => {
        if (!m || m.source === "manual" || m.origin === "back") return;
        for (const r of m.refs || []) refs.add(r);
      };
      st.mems.forEach(collect); st.archive.forEach(collect); st.pending.forEach((p) => collect(p.fields));
      for (let i = 0; i < first; i++) { if (refs.has(valid[i].id)) { first = i; break; } }
      st.origin = cursorOf(valid, first - 1);
      log("v1 升级：补录范围定为前", first, "条");
      return true;
    }
    function sliceNew(rows, cursor) {
      const valid = validRows(rows);
      if (!cursor) return { valid, fresh: [] };
      if (cursor.id) {
        const i = valid.findIndex((m) => m.id === cursor.id);
        if (i >= 0) return { valid, fresh: valid.slice(i + 1) };
      }
      if (cursor.t) return { valid, fresh: valid.filter((m) => msgTime(m) > cursor.t) };
      return { valid, fresh: valid.slice(Math.min(cursor.n || 0, valid.length)) };
    }

    /* ======================= 轻量检索 ======================= */

    function grams(text, strip) {
      let s = String(text || "").toLowerCase();
      if (strip) for (const n of strip) if (n) s = s.split(String(n).toLowerCase()).join(" ");
      const out = new Set();
      const latin = s.match(/[a-z0-9]{2,}/g);
      if (latin) for (const w of latin) out.add(w);
      const runs = s.match(/[\u3400-\u9fff]+/g);
      if (runs) {
        for (const r of runs) {
          for (let i = 0; i + 1 < r.length; i++) {
            const b = r.slice(i, i + 2);
            if (!STOP.has(b)) out.add(b);
          }
        }
      }
      return out;
    }
    const gramCache = new WeakMap();
    function memGrams(m, strip) {
      const key = m.text + "|" + strip.join("|");
      const c = gramCache.get(m);
      if (c && c.key === key) return c.g;
      const g = grams(m.text, strip);
      gramCache.set(m, { key, g });
      return g;
    }
    function hits(a, b) { let n = 0; for (const x of a) if (b.has(x)) n++; return n; }
    function jaccard(a, b) {
      if (!a.size || !b.size) return 0;
      const n = hits(a, b);
      return n / (a.size + b.size - n);
    }
    const normText = (t) => String(t || "").replace(/[\s，。！？、,.!?；;：:“”"'‘’（）()…~～]/g, "");

    /* ======================= 状态 ======================= */
    // 每个对话一份：{ mems, pending, summaries, archive, cursor, ... }

    const cache = new Map();
    const listeners = new Set();
    const running = new Set();
    const locks = new Map();
    function withLock(sid, fn) {
      const prev = locks.get(sid) || Promise.resolve();
      let release;
      const gate = new Promise((r) => { release = r; });
      locks.set(sid, prev.then(() => gate));
      return prev.then(async () => { try { return await fn(); } finally { release(); } });
    }
    function bump() { for (const f of Array.from(listeners)) { try { f(); } catch (_) { /* 忽略 */ } } }

    function blank(sid) {
      return { v: 1, sid, seq: 0, mems: [], pending: [], summaries: [], archive: [], cursor: null,
        lastExtractAt: 0, lastError: "", fail: 0, nextTryAt: 0, runs: 0 };
    }
    async function loadState(sid) {
      if (cache.has(sid)) return cache.get(sid);
      const raw = await kvGet(K_STATE(sid), null);
      if (cache.has(sid)) return cache.get(sid);
      const st = Object.assign(blank(sid), raw && typeof raw === "object" ? raw : {});
      for (const k of ["mems", "pending", "summaries", "archive"]) if (!Array.isArray(st[k])) st[k] = [];
      st.sid = sid;
      if (st.back && (st.back.status === "running" || st.back.status === "waiting")) st.back.status = "paused";
      cache.set(sid, st);
      return st;
    }
    async function saveState(st, quiet) {
      await kvSet(K_STATE(st.sid), JSON.parse(JSON.stringify(st)));
      if (!quiet) bump();
    }
    const saveLater = new Map();
    function scheduleSave(st) {
      if (saveLater.has(st.sid)) return;
      const off = ctx.kit.later(() => { saveLater.delete(st.sid); saveState(st, true); }, 4000);
      saveLater.set(st.sid, off);
    }

    function archiveMem(st, m, why, sumId) {
      const i = st.mems.indexOf(m);
      if (i >= 0) st.mems.splice(i, 1);
      st.archive.push(Object.assign({}, m, { archivedAt: Date.now(), why: why || "", sumId: sumId || "" }));
      if (st.archive.length > ARCHIVE_CAP) st.archive.splice(0, st.archive.length - ARCHIVE_CAP);
    }
    function restoreMem(st, a) {
      const i = st.archive.indexOf(a);
      if (i >= 0) st.archive.splice(i, 1);
      const m = Object.assign({}, a);
      delete m.archivedAt; delete m.why; delete m.sumId;
      if (st.mems.some((x) => x.id === m.id)) m.id = "m" + ++st.seq;
      st.mems.push(m);
    }

    // 把一条操作落到记忆上（确认时用；自动确认也走这里）
    function applyOp(st, op, override) {
      const f = Object.assign({}, op.fields || {}, override || {});
      const now = Date.now();
      if (op.op === "add") {
        if (!f.text) return false;
        st.mems.push(Object.assign({
          id: "m" + ++st.seq, layer: "event", subject: "both", type: "", text: "", importance: 3,
          date: "", source: "online", refs: [], pinned: false, createdAt: now, updatedAt: now, lastUsedAt: 0,
        }, f));
        return true;
      }
      const m = st.mems.find((x) => x.id === op.target);
      if (op.op === "update") {
        if (!m) return f.text ? applyOp(st, { op: "add", fields: f }) : false;
        if (f.text && f.text !== m.text) m.prevText = m.text;
        Object.assign(m, f, { updatedAt: now });
        return true;
      }
      if (op.op === "delete") {
        if (!m) return false;
        archiveMem(st, m, "整理时删除" + (op.reason ? "：" + op.reason : ""));
        return true;
      }
      return false;
    }

    /* ======================= purpose 诊断与线上线下判断 ======================= */

    const diag = { purposes: {}, keys: {} };
    let diagDirty = false;
    kvGet("diag", null).then((d) => {
      if (!d || typeof d !== "object") return;
      for (const k of Object.keys(d.purposes || {})) {
        const old = d.purposes[k], cur = diag.purposes[k];
        diag.purposes[k] = cur ? Object.assign({}, old, cur, { n: (old.n || 0) + (cur.n || 0) }) : old;
      }
      for (const k of Object.keys(d.keys || {})) {
        const set = new Set([].concat(d.keys[k] || [], diag.keys[k] || []));
        diag.keys[k] = Array.from(set).slice(0, 6);
      }
    });

    const lastPurpose = new Map(); // sid -> { purpose, t }
    const mode = new Map();        // sid -> { src, t }  这个对话当前在线上还是线下
    const replyPurposes = new Set(); // 见过紧接着产出角色回复的 purpose（用来排除心声之类）
    const waitingUser = new Map();   // sid -> 上一条角色回复之后你发的消息 id

    function isOfflineWord(s) {
      const x = String(s || "").toLowerCase();
      return !!x && prefList("offlineKeys", DEF_OFFLINE).some((k) => x.indexOf(k) >= 0);
    }
    function notePurpose(sid, purpose, where) {
      const p = purpose === undefined || purpose === null || purpose === "" ? "(空)" : String(purpose);
      let d = diag.purposes[p];
      if (!d) {
        d = diag.purposes[p] = { n: 0, last: 0, where, group: false, priv: false };
        log("见到新的 purpose：", p, "来自", where, sid ? "会话 " + sid : "（无会话）");
      }
      d.n++; d.last = Date.now();
      if (sid) { if (isPrivate(sid)) d.priv = true; else d.group = true; }
      diagDirty = true;
      if (!sid) return;
      lastPurpose.set(sid, { purpose: p, t: Date.now() });
      // 你发的消息先按上一轮的模式标；这一轮回复的 purpose 一出现，就按它改判
      const ids = waitingUser.get(sid);
      if (ids && ids.length && (replyPurposes.has(p) || isOfflineWord(p))) {
        waitingUser.delete(sid);
        retag(sid, ids, isOfflineWord(p)).catch((e) => log("改判线上线下失败", e));
      }
    }
    async function retag(sid, ids, offline) {
      const map = await kvGet(K_SRC(sid), {});
      let changed = false;
      for (const id of ids) {
        if (offline && !map[id]) { map[id] = 1; changed = true; }
        if (!offline && map[id]) { delete map[id]; changed = true; }
      }
      if (changed) await kvSet(K_SRC(sid), map);
    }
    function noteKeys(m) {
      for (const k of Object.keys(m)) {
        if (k === "content" || k === "id" || k === "sessionId") continue;
        let arr = diag.keys[k];
        if (!arr) {
          if (Object.keys(diag.keys).length >= 40) continue;
          arr = diag.keys[k] = [];
          diagDirty = true;
        }
        const v = m[k];
        if ((typeof v === "string" && v.length <= 24 && !/^data:/.test(v)) || typeof v === "boolean") {
          const s = String(v);
          if (arr.indexOf(s) < 0 && arr.length < 6) { arr.push(s); diagDirty = true; }
        }
      }
    }
    function sourceFromMsg(m) {
      if (m.offline === true || m.isOffline === true) return "offline";
      const f = [m.scene, m.mode, m.channel, m.kind, m.source, m.purpose].filter((x) => typeof x === "string").join(" ");
      return f && isOfflineWord(f) ? "offline" : "";
    }
    // 消息落库时判断线上 / 线下：先看消息自带字段，再看最近一次生成的 purpose
    async function tagSource(sid, m) {
      let src = sourceFromMsg(m);
      const now = Date.now();
      if (!src) {
        if (m.role === "assistant") {
          const lp = lastPurpose.get(sid);
          if (lp && now - lp.t < 3 * 60000) src = isOfflineWord(lp.purpose) ? "offline" : "online";
        } else {
          const md = mode.get(sid);
          if (md && now - md.t < 30 * 60000) src = md.src;
        }
      }
      if (m.role === "assistant") {
        const lp = lastPurpose.get(sid);
        if (lp && now - lp.t < 3 * 60000) replyPurposes.add(lp.purpose);
        if (src) mode.set(sid, { src, t: now });
        waitingUser.delete(sid);
      } else if (m.id && !sourceFromMsg(m)) {
        const arr = waitingUser.get(sid) || [];
        arr.push(m.id);
        waitingUser.set(sid, arr.slice(-20));
      }
      if (src !== "offline" || !m.id) return;
      const map = await kvGet(K_SRC(sid), {});
      map[m.id] = 1;
      const ks = Object.keys(map);
      if (ks.length > SRC_CAP) for (const k of ks.slice(0, ks.length - SRC_CAP)) delete map[k];
      await kvSet(K_SRC(sid), map);
    }
    function srcOf(m, map) {
      const s = sourceFromMsg(m);
      if (s) return s;
      return map && m.id && map[m.id] ? "offline" : "online";
    }

    /* ======================= 名字 ======================= */

    async function namesFor(sid) {
      const user = userName();
      let char = "", charId = "";
      try {
        const th = await ctx.threads.get(sid);
        if (th) { charId = th.characterId || ""; char = th.title || ""; }
      } catch (_) { /* 忽略 */ }
      if (!charId && sid.indexOf(":") > 0) charId = sid.split(":").slice(1).join(":");
      try {
        const p = charId ? await ctx.personas.get(charId) : null;
        if (p && p.name) char = p.name;
      } catch (_) { /* 忽略 */ }
      return { user, char: String(char || "").trim() || "对方", charId };
    }

    /* ======================= 模型调用 ======================= */

    async function askModel(o) {
      const r = await ctx.model.ask(o);
      if (typeof r === "string") return r;
      if (r && typeof r === "object") {
        if (Array.isArray(r.content)) return r.content.map((x) => (x && x.text) || "").join("");
        return String(r.text || r.content || r.output || r.message || "");
      }
      return "";
    }
    function parseJSONLoose(raw) {
      let s = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      const tryP = (x) => { try { return JSON.parse(x); } catch (_) { return undefined; } };
      let v = tryP(s);
      if (v !== undefined) return v;
      for (const [L, R] of [["{", "}"], ["[", "]"]]) {
        const a = s.indexOf(L), b = s.lastIndexOf(R);
        if (a >= 0 && b > a) {
          const part = s.slice(a, b + 1);
          v = tryP(part);
          if (v === undefined) v = tryP(part.replace(/,\s*([}\]])/g, "$1"));
          if (v !== undefined) return v;
        }
      }
      return undefined;
    }
    function parseOps(raw) {
      const v = parseJSONLoose(raw);
      if (v === undefined) throw new Error("模型返回的不是 JSON：" + String(raw || "").slice(0, 60));
      const ops = Array.isArray(v) ? v : v && Array.isArray(v.ops) ? v.ops : null;
      if (!ops) throw new Error("模型返回的 JSON 里没有 ops");
      return ops.filter((o) => o && typeof o === "object");
    }
    function cleanPara(s, cap) {
      let t = String(s || "").replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
      t = t.replace(/^["“「]+|["”」]+$/g, "").replace(/\s*\n+\s*/g, " ").trim();
      return t.length > cap ? t.slice(0, cap) + "…" : t;
    }

    /* ======================= 提取 ======================= */

    const LAYERS = { core: "core", event: "event", 核心: "core", 事件: "event" };
    const SUBJ = { user: "user", char: "char", both: "both", 用户: "user", 角色: "char", 两人: "both" };
    const cleanText = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, 120);
    const clampImp = (x) => { const n = Math.round(Number(x)); return n >= 1 && n <= 5 ? n : 0; };
    const okDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? String(s) : "");

    function memLine(id, m, names, pendTag) {
      const L = m.layer === "core" ? "核心" : "事件";
      const S = { user: "关于" + names.user, char: "关于" + names.char, both: "两人" }[m.subject] || "两人";
      const bits = [(pendTag ? pendTag + "·" : "") + L, S, m.type, "重要" + (m.importance || 3), m.date, m.source === "offline" ? "线下" : ""];
      return "[" + id + "] " + bits.filter(Boolean).join("·") + "：" + m.text;
    }
    // 交给模型去重用的「已有记忆」：核心全给，事件挑和这批消息相关的 + 最近的
    function relatedLines(st, batchText, names, back) {
      const strip = [names.user, names.char];
      const q = grams(batchText, strip);
      const chosen = new Set(st.mems.filter((m) => m.layer === "core").slice(0, 60));
      const evs = st.mems.filter((m) => m.layer === "event");
      evs.map((m) => ({ m, r: hits(memGrams(m, strip), q) }))
        .filter((x) => x.r > 0)
        .sort((a, b) => b.r - a.r)
        .slice(0, 30)
        .forEach((x) => chosen.add(x.m));
      evs.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8).forEach((m) => chosen.add(m));
      const newer = (x) => (back && x.origin !== "back" ? "较新" : "");
      const lines = Array.from(chosen).map((m) => memLine(m.id, m, names, newer(m)));
      for (const p of st.pending.slice(-50)) {
        const tag = "待确认" + (back && p.from !== "back" ? "·较新" : "");
        if (p.op === "add") lines.push(memLine(p.pid, p.fields, names, tag));
        else if (p.op === "update") {
          const t = st.mems.find((x) => x.id === p.target);
          lines.push(memLine(p.pid, Object.assign({}, t || {}, p.fields), names, tag + "·改" + p.target));
        }
      }
      return lines;
    }
    function findDup(st, text, strip) {
      const nt = normText(text);
      const g = grams(text, strip);
      for (const m of st.mems) {
        if (normText(m.text) === nt) return true;
        if (g.size >= 4 && jaccard(g, memGrams(m, strip)) >= 0.8) return true;
      }
      for (const p of st.pending) {
        const t = p.fields && p.fields.text;
        if (!t) continue;
        if (normText(t) === nt) return true;
        if (g.size >= 4 && jaccard(g, grams(t, strip)) >= 0.8) return true;
      }
      return false;
    }

    // opts.back = 补录模式；opts.auto = 补录出的直接生效
    async function runBatch(st, batch, names, srcMap, opts) {
      opts = opts || {};
      const back = !!opts.back;
      const strip = [names.user, names.char];
      const knownOff = (m) => sourceFromMsg(m) === "offline" || !!(srcMap && m.id && srcMap[m.id]);
      const isOff = (m) => (back ? knownOff(m) : srcOf(m, srcMap) === "offline");
      const lines = batch.map((m, i) => {
        const t = msgTime(m);
        const off = isOff(m);
        const tag = off ? "线下" : back ? "" : "线上";   // 旧记录没有标记，交给模型按写法判断
        const who = m.role === "user" ? names.user : names.char;
        let txt = msgText(m);
        const cap = off ? 600 : back ? 450 : 300;
        if (txt.length > cap) txt = txt.slice(0, cap) + "…";
        const head = [t ? ymdhm(t) : "", tag].filter(Boolean).join(" ");
        return "#" + (i + 1) + (head ? " [" + head + "]" : "") + " " + who + "：" + (txt || "（空）");
      });
      const extra = back ? [
        "- 这是装记忆插件之前的聊天，正按时间从早往后补录。",
        "- 没标来源的消息：带动作、环境、心理描写的叙事多半是线下共处，像手机消息的是线上，source 按这个判断。",
        "- 标着「较新」的已有记忆来自更晚的聊天，以它为准，不要 update 或 delete 它。旧记录和它矛盾时，" +
          "如果当时的情况本身值得记，就作为 event 记下（如「" + names.user + "以前很喜欢吃甜的」）。",
        "- date 用消息上的日期。",
      ] : [];
      const raw = await askModel({
        system: EXTRACT_SYSTEM,
        prompt: extractPrompt(names.user, names.char, relatedLines(st, lines.join("\n"), names, back), lines, extra),
        temperature: 0.3,
        maxTokens: 1800,
      });
      const ops = parseOps(raw);

      const refMsgs = (refs) => (Array.isArray(refs) ? refs : refs === undefined || refs === null ? [] : [refs])
        .map((r) => parseInt(String(r).replace(/[^\d]/g, ""), 10))
        .filter((n) => n >= 1 && n <= batch.length)
        .map((n) => batch[n - 1]);

      const props = [];
      let guarded = 0;
      for (const o of ops) {
        const kind = String(o.op || "").toLowerCase();
        if (kind === "add") {
          const text = cleanText(o.text);
          if (!text || findDup(st, text, strip)) continue;
          if (props.some((p) => p.op === "add" && normText(p.fields.text) === normText(text))) continue;
          const rm = refMsgs(o.refs);
          const layer = LAYERS[o.layer] || "event";
          const lastRef = rm[rm.length - 1];
          const refT = lastRef ? msgTime(lastRef) : 0;
          const fields = {
            layer,
            subject: SUBJ[o.subject] || "both",
            type: String(o.type || "").trim().slice(0, 8),
            text,
            importance: clampImp(o.importance) || 3,
            date: okDate(o.date) || (layer === "event" ? ymd(refT || Date.now()) : ""),
            source: o.source === "offline" || o.source === "online" ? o.source : rm.some(isOff) ? "offline" : "online",
            refs: rm.map((m) => m.id).filter(Boolean).slice(0, 8),
          };
          if (back) fields.origin = "back";
          props.push({ op: "add", reason: cleanText(o.reason), fields });
        } else if (kind === "update" || kind === "delete") {
          const id = String(o.id || o.target || "").trim();
          if (!id) continue;
          const pend = st.pending.find((p) => p.pid === id);
          const mem = st.mems.find((m) => m.id === id);
          if (!pend && !mem) continue;
          // 补录时，旧记录不能改动来自更晚聊天的记忆
          if (back && ((pend && pend.from !== "back") || (mem && mem.origin !== "back"))) { guarded++; continue; }
          if (kind === "delete") {
            if (pend) { st.pending.splice(st.pending.indexOf(pend), 1); continue; }
            if (props.some((p) => p.target === id)) continue;
            props.push({ op: "delete", target: id, before: mem.text, reason: cleanText(o.reason) });
            continue;
          }
          const f = {};
          if (o.text) f.text = cleanText(o.text);
          if (clampImp(o.importance)) f.importance = clampImp(o.importance);
          if (LAYERS[o.layer]) f.layer = LAYERS[o.layer];
          if (SUBJ[o.subject]) f.subject = SUBJ[o.subject];
          if (okDate(o.date)) f.date = okDate(o.date);
          if (o.type) f.type = String(o.type).trim().slice(0, 8);
          if (pend) { pend.fields = Object.assign(pend.fields || {}, f); continue; }
          for (const k of Object.keys(f)) if (mem[k] === f[k]) delete f[k];
          if (!Object.keys(f).length) continue;
          if (props.some((p) => p.target === id)) continue;
          props.push({ op: "update", target: id, before: mem.text, fields: f, reason: cleanText(o.reason) });
        }
      }
      if (guarded) log("补录时挡下了", guarded, "条想改较新记忆的操作");

      if (!props.length) return 0;
      const auto = back ? !!opts.auto : prefBool("autoConfirm", false);
      if (auto) {
        for (const p of props) applyOp(st, p);
      } else {
        const now = Date.now();
        for (const p of props) st.pending.push(Object.assign({ pid: "p" + ++st.seq, at: now, from: back ? "back" : "live" }, p));
        if (st.pending.length > PENDING_CAP) {
          log("待确认太多，丢掉最旧的", st.pending.length - PENDING_CAP, "条");
          st.pending.splice(0, st.pending.length - PENDING_CAP);
        }
      }
      return props.length;
    }

    // 日常整理：同一对话同时只排一个，和补录排队执行
    const liveQueued = new Set();
    async function extract(sid, opts) {
      opts = opts || {};
      if (!isPrivate(sid)) return { ok: false, msg: "只整理私聊" };
      if (liveQueued.has(sid)) return { ok: false, msg: "已经在排队整理了" };
      liveQueued.add(sid);
      try { return await withLock(sid, () => extractNow(sid, opts)); } finally { liveQueued.delete(sid); }
    }
    async function extractNow(sid, opts) {
      const st = await loadState(sid);
      if (!opts.force && st.nextTryAt && Date.now() < st.nextTryAt) return { ok: false, msg: "上次出错，稍后自动重试" };
      running.add(sid);
      bump();
      let added = 0, batches = 0;
      try {
        const rows = await listRows(sid);
        if (!st.cursor) {
          initCursor(st, rows);
          await saveState(st, true);
          return { ok: true, n: 0, msg: "从现在开始记" };
        }
        const sl = sliceNew(rows, st.cursor);
        let fresh = sl.fresh;
        if (fresh.length < (opts.min || 1)) return { ok: true, n: 0, msg: "没有新消息要整理" };
        if (!opts.force && Date.now() - (lastAct.get(sid) || 0) < TAIL_GUARD_MS) fresh = fresh.slice(0, Math.max(0, fresh.length - 2));
        if (!fresh.length) return { ok: true, n: 0, msg: "没有新消息要整理" };

        const names = await namesFor(sid);
        const srcMap = await kvGet(K_SRC(sid), {});
        while (fresh.length && batches < MAX_BATCHES_PER_RUN) {
          const batch = fresh.slice(0, BATCH_MAX);
          added += await runBatch(st, batch, names, srcMap);
          st.cursor = cursorOf(sl.valid, sl.valid.indexOf(batch[batch.length - 1]));
          fresh = fresh.slice(BATCH_MAX);
          batches++;
          st.lastExtractAt = Date.now();
          st.runs = (st.runs || 0) + 1;
          st.lastError = ""; st.fail = 0; st.nextTryAt = 0;
          await saveState(st, true);
        }
        try { await maybeCompact(st, names); } catch (e) { log("压缩往事失败", e); }
        const auto = prefBool("autoConfirm", false);
        if (added && prefBool("notify", true)) {
          toast(auto ? "记忆：记下了 " + added + " 条" : "记忆：整理出 " + added + " 条，等你确认", 3500);
        }
        return {
          ok: true, n: added,
          msg: (added ? (auto ? "记下了 " : "整理出 ") + added + " 条" : "这段没有值得记的") + (fresh.length ? "，还剩 " + fresh.length + " 条下次整理" : ""),
        };
      } catch (e) {
        st.fail = (st.fail || 0) + 1;
        st.nextTryAt = Date.now() + Math.min(30, Math.pow(2, st.fail)) * 60000;
        st.lastError = mdhm(Date.now()) + "　" + errMsg(e).slice(0, 160);
        await saveState(st, true);
        log("整理失败", sid, e);
        return { ok: false, msg: "整理失败：" + errMsg(e).slice(0, 60) };
      } finally {
        running.delete(sid);
        bump();
      }
    }

    // 「先试试」：把游标往回拨 n 条再整理一次；起点跟着往回拨，补录就不会重复这 n 条
    async function tryRecent(sid, n) {
      const st = await loadState(sid);
      const valid = validRows(await listRows(sid));
      const idx = Math.max(-1, valid.length - 1 - (n || 40));
      st.cursor = cursorOf(valid, idx);
      if (!st.origin || cursorIndex(valid, st.origin) > idx) st.origin = cursorOf(valid, idx);
      await saveState(st, true);
      return extract(sid, { force: true, min: 1 });
    }

    /* ======================= 往事压缩 ======================= */

    async function maybeCompact(st, names) {
      const maxE = prefNum("maxEvents", 60, 15, 1000);
      const evs = st.mems.filter((m) => m.layer === "event" && !m.pinned);
      if (evs.length <= maxE) return false;
      const touch = (m) => Math.max(dateMs(m.date) || m.createdAt || 0, m.lastUsedAt || 0);
      let cand = evs.filter((m) => (m.importance || 3) <= 3);
      if (cand.length < 8) cand = evs.filter((m) => (m.importance || 3) <= 4);
      cand.sort((a, b) => touch(a) - touch(b));
      const take = cand.slice(0, Math.min(25, Math.max(8, evs.length - maxE + 10)));
      if (take.length < 5) return false;
      take.sort((a, b) => (dateMs(a.date) || a.createdAt || 0) - (dateMs(b.date) || b.createdAt || 0));
      const lines = take.map((m) => "- " + (m.date || "") + (m.source === "offline" ? "（线下）" : "") + " " + m.text);
      const out = cleanPara(await askModel({
        system: "你是聊天记忆整理员，只输出正文。",
        prompt: "下面是" + names.user + "和" + names.char + "之间一些较早的记忆，按时间排列。把它们压成一段往事概要：" +
          "按时间顺序，保留关键事件、约定、关系和情绪的转折，丢掉琐碎细节。第三人称，直接写名字，不超过 160 字，只输出这一段。\n\n" +
          lines.join("\n"),
        temperature: 0.3,
        maxTokens: 600,
      }), 320);
      if (!out) throw new Error("压缩没有返回内容");
      const sumId = "s" + ++st.seq;
      st.summaries.push({ id: sumId, text: out, from: take[0].date || "", to: take[take.length - 1].date || "",
        count: take.length, at: Date.now(), parts: [] });
      for (const m of take) archiveMem(st, m, "压缩进往事", sumId);
      if (st.summaries.length > 4) {
        try { await mergeSummaries(st, names); } catch (e) { log("合并往事失败", e); }
      }
      await saveState(st, true);
      log("压缩了", take.length, "条事件进往事", st.sid);
      return true;
    }
    async function mergeSummaries(st, names) {
      const all = st.summaries.slice();
      const out = cleanPara(await askModel({
        system: "你是聊天记忆整理员，只输出正文。",
        prompt: "把下面几段" + names.user + "和" + names.char + "的往事概要合并成一段，按时间顺序，保留最关键的事件和转折，" +
          "第三人称，直接写名字，不超过 220 字，只输出这一段。\n\n" + all.map((s) => "- " + s.text).join("\n"),
        temperature: 0.3,
        maxTokens: 700,
      }), 400);
      if (!out) return;
      const parts = [];
      for (const s of all) { parts.push(s.id); for (const p of s.parts || []) parts.push(p); }
      st.summaries = [{ id: "s" + ++st.seq, text: out, from: all[0].from, to: all[all.length - 1].to,
        count: all.reduce((n, s) => n + (s.count || 0), 0), at: Date.now(), parts }];
    }

    /* ======================= 补录旧记录 ======================= */

    const backRunners = new Map(); // sid -> { stop }
    function backDefaults(prev) {
      return { status: "idle", mode: (prev && prev.mode) || "confirm", gap: (prev && prev.gap) || 8, done: null,
        batches: 0, processed: 0, total: 0, added: 0, msPerBatch: 0, lastError: "", startedAt: 0, finishedAt: 0 };
    }
    function backOf(st) { if (!st.back) st.back = backDefaults(); return st.back; }
    const backPendingN = (st) => st.pending.filter((p) => p.from === "back").length;
    // 旧记录 = 起点及之前的消息；from = 下一条要补录的下标
    function backRange(st, valid) {
      const end = cursorIndex(valid, st.origin);
      const from = Math.min(cursorIndex(valid, st.back && st.back.done) + 1, end + 1);
      return { end, from, total: end + 1, left: Math.max(0, end - from + 1) };
    }

    async function backLoop(sid) {
      if (backRunners.has(sid) || !alive) return;
      const token = { stop: false };
      backRunners.set(sid, token);
      const st = await loadState(sid);
      const b = backOf(st);
      let tries = 0;
      try {
        ensureOrigin(st, validRows(await listRows(sid)));
        b.status = "running"; b.lastError = "";
        if (!b.startedAt) b.startedAt = Date.now();
        await saveState(st);
        while (alive && !token.stop) {
          // 逐条确认模式：补录出的待确认攒多了就停下等你
          const pn = backPendingN(st);
          if (b.mode !== "auto" && (pn >= BACK_PAUSE_AT || (b.status === "waiting" && pn > BACK_RESUME_AT))) {
            if (b.status !== "waiting") {
              b.status = "waiting";
              await saveState(st);
              if (prefBool("notify", true)) toast("补录先停一下：有 " + pn + " 条补录出的记忆等你确认", 4000);
            }
            await nap(5000, token);
            continue;
          }
          if (b.status !== "running") { b.status = "running"; await saveState(st); }

          const valid = validRows(await listRows(sid));
          const r = backRange(st, valid);
          b.total = r.total;
          if (r.left <= 0) {
            b.status = "done"; b.finishedAt = Date.now(); b.processed = r.total;
            await saveState(st);
            toast("补录完成：" + fmtN(r.total) + " 条旧记录，整理出 " + b.added + " 条", 4000);
            break;
          }
          const batch = valid.slice(r.from, r.from + Math.min(BATCH_MAX, r.left));
          const names = await namesFor(sid);
          const srcMap = await kvGet(K_SRC(sid), {});
          const t0 = Date.now();
          let n = 0;
          try {
            n = await withLock(sid, async () => {
              running.add(sid); bump();
              try { return await runBatch(st, batch, names, srcMap, { back: true, auto: b.mode === "auto" }); }
              finally { running.delete(sid); }
            });
          } catch (e) {
            tries++;
            b.lastError = mdhm(Date.now()) + "　" + errMsg(e).slice(0, 160);
            log("补录出错", sid, "第", tries, "次", e);
            if (tries >= 3) {
              b.status = "error";
              await saveState(st);
              toast("补录连续出错，先停下了。去「记忆」看看原因", 4000);
              break;
            }
            await saveState(st);
            await nap(30000 * tries, token);
            continue;
          }
          tries = 0;
          b.lastError = "";
          b.done = cursorOf(valid, r.from + batch.length - 1);
          b.batches++; b.added += n; b.processed = r.from + batch.length;
          const dt = Date.now() - t0;
          b.msPerBatch = b.msPerBatch ? Math.round(b.msPerBatch * 0.7 + dt * 0.3) : dt;
          try { await withLock(sid, () => maybeCompact(st, names)); } catch (e) { log("压缩往事失败", e); }
          await saveState(st);
          await nap((b.gap || 8) * 1000, token);
        }
      } catch (e) {
        b.status = "error"; b.lastError = mdhm(Date.now()) + "　" + errMsg(e).slice(0, 160);
        log("补录中断", sid, e);
      } finally {
        backRunners.delete(sid);
        if (b.status === "running" || b.status === "waiting") b.status = "paused";
        await saveState(st);
      }
    }
    function startBack(sid) { backLoop(sid).catch((e) => log("补录启动失败", e)); }
    function pauseBack(sid) { const t = backRunners.get(sid); if (t) { t.stop = true; bump(); } }

    /* ======================= 注入 ======================= */

    function scoreEv(m, ga, gb, strip, now) {
      const g = memGrams(m, strip);
      let a = 0, b = 0;
      for (const x of g) { if (ga.has(x)) a++; else if (gb.has(x)) b++; }
      const rel = Math.min(2, (a + 0.4 * b) / Math.sqrt(g.size + 1));
      const t = dateMs(m.date) || m.createdAt || now;
      const age = Math.max(0, (now - t) / DAY);
      const imp = m.importance || 3;
      const s = 1.5 * rel + 0.7 * (imp / 5) + 0.6 * Math.exp(-age / 21) + (m.pinned ? 3 : 0);
      const keep = !!m.pinned || rel >= 0.2 || age <= 3 || imp >= 5;
      return { m, s, keep };
    }

    async function buildInjection(sid, st) {
      const names = await namesFor(sid);
      const budget = prefNum("budget", 700, 150, 4000);
      const asYou = prefBool("charAsYou", true) && names.char !== "对方";
      const conv = (t) => (asYou ? String(t).split(names.char).join("你") : String(t));
      const strip = [names.user, names.char];

      // 检索用：你最新一句（权重高）+ 对方最新一句
      const rows = validRows(await listRows(sid));
      let qa = "", qb = "";
      for (let i = rows.length - 1; i >= 0 && (!qa || !qb); i--) {
        const m = rows[i];
        if (!qa && m.role === "user") qa = msgText(m);
        else if (!qb && m.role === "assistant") qb = msgText(m);
      }
      const ga = grams(qa, strip), gb = grams(qb, strip);
      const now = Date.now();

      const head = "【记忆】以下是你记得的、你和" + names.user + "之间的事。自然地带进对话，不要逐条复述，" +
        "也不要提「记忆」「档案」这类字眼；和眼前的对话冲突时，以眼前为准。";
      let used = head.length;
      const usedMems = [];

      // 核心档案：常驻，按置顶、重要度排，最多占预算的 55%
      const coreCap = Math.floor(budget * 0.55);
      const groups = { user: [], char: [], both: [] };
      let coreUsed = 0;
      st.mems.filter((m) => m.layer === "core")
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.importance || 3) - (a.importance || 3) || (b.updatedAt || 0) - (a.updatedAt || 0))
        .forEach((m) => {
          const t = conv(m.text);
          if (coreUsed + t.length + 1 > coreCap) return;
          (groups[m.subject] || groups.both).push(t);
          coreUsed += t.length + 1;
          usedMems.push(m);
        });
      used += coreUsed + 24;

      // 往事概要：留最近的一段
      let sumLine = "";
      if (st.summaries.length) {
        let s = st.summaries.map((x) => x.text).join(" ");
        const cap = Math.min(220, Math.floor(budget * 0.25));
        if (s.length > cap) s = "…" + s.slice(-cap);
        sumLine = conv(s);
        used += sumLine.length + 4;
      }

      // 事件：相关度 + 重要度 + 新近度，置顶必带
      const evLines = [];
      st.mems.filter((m) => m.layer === "event")
        .map((m) => scoreEv(m, ga, gb, strip, now))
        .filter((x) => x.keep)
        .sort((a, b) => b.s - a.s)
        .forEach((x) => {
          if (evLines.length >= 8) return;
          const d = shortDate(x.m.date);
          const tag = [d, x.m.source === "offline" ? "线下" : ""].filter(Boolean).join("，");
          const line = "- " + (tag ? tag + "：" : "") + conv(x.m.text);
          if (used + line.length + 1 > budget) return;
          evLines.push(line);
          used += line.length + 1;
          usedMems.push(x.m);
        });

      if (!usedMems.length && !sumLine) return "";
      const parts = [head];
      if (groups.user.length) parts.push("关于" + names.user + "：" + groups.user.join("；"));
      if (groups.char.length) parts.push((asYou ? "关于你自己" : "关于" + names.char) + "（说过的话要前后一致）：" + groups.char.join("；"));
      if (groups.both.length) parts.push("你们之间：" + groups.both.join("；"));
      if (sumLine) parts.push("往事：" + sumLine);
      if (evLines.length) parts.push("近来想起的：\n" + evLines.join("\n"));
      for (const m of usedMems) m.lastUsedAt = now;
      scheduleSave(st);
      return parts.join("\n");
    }

    ctx.pipe.rewrite("prompt.hint", async (p) => {
      try {
        notePurpose(p.sessionId, p.purpose, "prompt.hint");
        if (!prefBool("inject", true)) return p;
        const sid = p.sessionId;
        if (!isPrivate(sid) || p.isGroup) return p;
        const pur = String(p.purpose || "").toLowerCase();
        if (pur && prefList("skipPurposes", "").some((k) => pur.indexOf(k) >= 0)) return p;
        const st = await loadState(sid);
        if (!st.mems.length && !st.summaries.length) return p;
        const block = await buildInjection(sid, st);
        if (block) p.hint = (p.hint ? String(p.hint) + "\n\n" : "") + block;
      } catch (e) { log("注入失败", e); }
      return p;
    }, { order: 120 });

    // 只用来记下 purpose 的真实取值，不改请求
    ctx.pipe.rewrite("model.payload", (p) => {
      try { notePurpose(p.sessionId, p.purpose, "model.payload"); } catch (_) { /* 忽略 */ }
      return p;
    }, { order: 999 });

    /* ======================= 触发时机 ======================= */

    const lastAct = new Map(); // sid -> 最近一条消息落库的时间
    const dirty = new Set();   // 有新消息、还没被空闲检查过的对话

    async function freshCount(sid, st) {
      return sliceNew(await listRows(sid), st.cursor).fresh.length;
    }

    async function onRow(sid, m) {
      await tagSource(sid, m);
      const st = await loadState(sid);
      if (!st.cursor) {
        initCursor(st, await listRows(sid), m.id);
        await saveState(st, true);
      }
      const need = prefNum("batchSize", 30, 8, 200);
      if ((await freshCount(sid, st)) >= need) await extract(sid, { min: need });
    }

    ctx.watch("row.saved", (p) => {
      try {
        const m = pickMsg(p);
        if (!m || (m.role !== "user" && m.role !== "assistant")) return;
        const sid = m.sessionId || (p && p.sessionId);
        if (!isPrivate(sid)) return;
        noteKeys(m);
        lastAct.set(sid, Date.now());
        dirty.add(sid);
        onRow(sid, m).catch((e) => log("处理新消息失败", e));
      } catch (e) { log(e); }
    });

    // 打开对话：第一次就把游标放到最新（不补录旧记录）；隔了一段时间回来，把零头整理掉
    ctx.watch("thread.open", (p) => {
      const sid = p && p.sessionId;
      if (!isPrivate(sid) || (p && p.isGroup)) return;
      focusSid = sid;
      (async () => {
        const st = await loadState(sid);
        const rows = await listRows(sid);
        if (!st.cursor) { initCursor(st, rows); await saveState(st, true); return; }
        const idleMs = prefNum("idleMinutes", 20, 0, 1440) * 60000;
        if (!idleMs) return;
        const valid = validRows(rows);
        const lastT = Math.max(lastAct.get(sid) || 0, msgTime(valid[valid.length - 1]));
        if (lastT && Date.now() - lastT < idleMs) return;
        if (sliceNew(rows, st.cursor).fresh.length >= MIN_IDLE_BATCH) await extract(sid, { min: MIN_IDLE_BATCH });
      })().catch((e) => log("打开对话时出错", e));
    });

    // 每分钟：停聊够久的对话，把零头整理掉；顺便存一下诊断
    ctx.kit.every(() => {
      if (diagDirty) { diagDirty = false; kvSet("diag", JSON.parse(JSON.stringify(diag))); }
      const idleMs = prefNum("idleMinutes", 20, 0, 1440) * 60000;
      if (!idleMs) return;
      const now = Date.now();
      for (const sid of Array.from(dirty)) {
        if (now - (lastAct.get(sid) || 0) < idleMs) continue;
        dirty.delete(sid);
        (async () => {
          const st = await loadState(sid);
          if (st.cursor && (await freshCount(sid, st)) >= MIN_IDLE_BATCH) await extract(sid, { min: MIN_IDLE_BATCH });
        })().catch((e) => log("空闲整理出错", e));
      }
    }, 60000);

    /* ======================= 界面工具 ======================= */

    ctx.ui.css(`
.pmem{--pm-accent:#a8577a;--pm-soft:rgba(127,127,127,.10);--pm-soft2:rgba(127,127,127,.17);--pm-line:rgba(127,127,127,.30);--pm-warn:#c9473f;}
.pmem-root{box-sizing:border-box;min-height:100%;}
.pmem-app{box-sizing:border-box;max-width:640px;margin:0 auto;padding:4px 16px 56px;font-size:14px;line-height:1.6;}
.pmem-top{display:flex;align-items:center;justify-content:space-between;padding:8px 0 10px;}
.pmem-back{border:0;background:none;color:inherit;font:inherit;font-size:15px;padding:6px 2px;cursor:pointer;min-width:56px;text-align:left;}
.pmem-title{font-size:17px;font-weight:600;}
.pmem-who{width:100%;margin:0 0 10px;font-size:14px !important;padding:8px 10px !important;}
.pmem-status{border-radius:14px;padding:10px 12px;font-size:13px;background:var(--pm-soft);}
.pmem-status .pmem-row{margin-top:8px;}
.pmem-err{margin-top:6px;color:var(--pm-warn);font-size:12px;word-break:break-all;}
.pmem-tabs{display:flex;gap:6px;overflow-x:auto;padding:14px 0 8px;scrollbar-width:none;}
.pmem-tabs::-webkit-scrollbar{display:none;}
.pmem-tab{flex:none;border:0;border-radius:999px;padding:6px 13px;font:inherit;font-size:13px;color:inherit;background:var(--pm-soft);cursor:pointer;}
.pmem-tab.on{background:var(--pm-accent);color:#fff;}
.pmem-filter{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:2px 0 4px;}
.pmem-chip{border:1px solid var(--pm-line);background:none;color:inherit;border-radius:999px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer;}
.pmem-chip.on{border-color:var(--pm-accent);color:var(--pm-accent);}
.pmem-search{flex:1;min-width:120px;}
.pmem-tip{font-size:12px;opacity:.62;margin:6px 2px;}
.pmem-card{border-radius:14px;padding:10px 12px;margin:8px 0;background:var(--pm-soft);}
.pmem-card.pin{box-shadow:inset 3px 0 0 var(--pm-accent);}
.pmem-text{white-space:pre-wrap;word-break:break-word;}
.pmem-text.del{text-decoration:line-through;opacity:.7;}
.pmem-sub{font-size:12px;opacity:.62;margin-top:4px;word-break:break-word;}
.pmem-op{font-size:12px;font-weight:600;margin-bottom:3px;color:var(--pm-accent);}
.pmem-op.op-delete{color:var(--pm-warn);}
.pmem-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px;}
.pmem-tags span{font-size:11px;padding:1px 7px;border-radius:999px;background:var(--pm-soft2);opacity:.85;}
.pmem-tags span.hot{background:var(--pm-accent);color:#fff;opacity:1;}
.pmem-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
.pmem-row.end{justify-content:flex-end;}
.pmem-acts{display:flex;gap:6px;justify-content:flex-end;margin-top:8px;flex-wrap:wrap;}
.pmem-btn{border:0;border-radius:999px;padding:5px 12px;font:inherit;font-size:12.5px;color:inherit;background:var(--pm-soft2);cursor:pointer;}
.pmem-btn.pri{background:var(--pm-accent);color:#fff;}
.pmem-btn.warn{color:var(--pm-warn);}
.pmem-btn:disabled{opacity:.45;cursor:default;}
.pmem-btn:focus-visible,.pmem-tab:focus-visible,.pmem-chip:focus-visible{outline:2px solid var(--pm-accent);outline-offset:2px;}
.pmem input,.pmem select,.pmem textarea{font:inherit;font-size:13px;color:inherit;background:transparent;border:1px solid var(--pm-line);border-radius:10px;padding:6px 8px;box-sizing:border-box;max-width:100%;}
.pmem select option{color:#222;background:#fff;}
.pmem-ta{width:100%;resize:vertical;line-height:1.5;}
.pmem-editor{display:flex;flex-direction:column;gap:8px;}
.pmem-empty{text-align:center;opacity:.6;padding:36px 12px;font-size:13px;}
.pmem-sec{font-size:13px;font-weight:600;margin:20px 2px 6px;}
.pmem-small{font-size:12px;opacity:.7;line-height:1.55;}
.pmem-table{width:100%;border-collapse:collapse;font-size:12px;}
.pmem-table td{padding:4px 6px;border-bottom:1px solid var(--pm-line);vertical-align:top;word-break:break-all;}
.pmem-dialog{padding:2px;width:min(84vw,420px);}
.pmem-dtitle{font-size:16px;font-weight:600;margin-bottom:8px;}
.pmem-quote{font-size:12.5px;opacity:.72;background:var(--pm-soft);border-radius:10px;padding:8px 10px;margin-bottom:10px;max-height:120px;overflow:auto;}
.pmem-strip{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;padding:4px 0 10px;}
.pmem-mini{font-size:12px;opacity:.8;margin:2px 0 6px;}
.pmem-backcard{margin-top:8px;}
.pmem-backcard b{font-weight:600;}
.pmem-backcard select{width:100%;margin-top:6px;}
.pmem-bar{height:6px;border-radius:999px;background:var(--pm-soft2);overflow:hidden;margin:10px 0 6px;}
.pmem-bar i{display:block;height:100%;border-radius:999px;background:var(--pm-accent);transition:width .4s ease;}
@media (prefers-reduced-motion:reduce){.pmem-bar i{transition:none;}}
`);

    function h(tag, props) {
      const el = document.createElement(tag);
      let val;
      if (props) {
        for (const k of Object.keys(props)) {
          const v = props[k];
          if (v === undefined || v === null || v === false) continue;
          if (k === "class") el.className = v;
          else if (k === "style") el.style.cssText = v;
          else if (k === "value") val = v;
          else if (k.indexOf("on") === 0 && typeof v === "function") el.addEventListener(k.slice(2), v);
          else el.setAttribute(k, v === true ? "" : String(v));
        }
      }
      const kids = [].slice.call(arguments, 2);
      (function add(list) {
        for (const c of list) {
          if (c === undefined || c === null || c === false) continue;
          if (Array.isArray(c)) add(c);
          else el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
        }
      })(kids);
      if (val !== undefined) el.value = val;
      return el;
    }
    function btn(label, fn, cls, disabled) {
      const b = h("button", { type: "button", class: "pmem-btn" + (cls ? " " + cls : "") }, label);
      if (disabled) b.disabled = true;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        try { const r = fn(e); if (r && r.catch) r.catch((er) => log(er)); } catch (er) { log(er); }
      });
      return b;
    }
    // 危险操作点两下：第一下变成「再点一次…」，3 秒内再点才执行
    function twoTap(label, confirmLabel, fn, cls) {
      let armed = false, timer = 0;
      const b = btn(label, () => {
        if (!armed) {
          armed = true; b.textContent = confirmLabel;
          timer = setTimeout(() => { armed = false; b.textContent = label; }, 3000);
          return undefined;
        }
        clearTimeout(timer);
        return fn();
      }, cls || "warn");
      return b;
    }
    function mkSelect(pairs, value, onChange) {
      const s = h("select", null, pairs.map((p) => h("option", { value: p[0] }, p[1])));
      s.value = value;
      if (onChange) s.addEventListener("change", () => onChange(s.value));
      return s;
    }
    function subjLabel(s, names) {
      return { user: "关于" + names.user, char: "关于" + names.char, both: "两人之间" }[s] || "两人之间";
    }
    function editor(init, names) {
      const ta = h("textarea", { class: "pmem-ta", rows: 3, placeholder: "一句话，比如：" + names.user + "不喜欢吃苦瓜" });
      ta.value = init.text || "";
      const subj = mkSelect([["user", subjLabel("user", names)], ["char", subjLabel("char", names)], ["both", "两人之间"]], init.subject || "user");
      const layer = mkSelect([["core", "核心档案"], ["event", "事件"]], init.layer || "core");
      const imp = mkSelect([1, 2, 3, 4, 5].map((n) => [String(n), "重要度 " + n]), String(init.importance || 3));
      const typ = h("input", { placeholder: "类型（可空）", style: "width:7.5em" });
      typ.value = init.type || "";
      const date = h("input", { type: "date" });
      date.value = init.date || "";
      return {
        ta,
        el: h("div", { class: "pmem-editor" }, ta, h("div", { class: "pmem-row" }, subj, layer, imp), h("div", { class: "pmem-row" }, typ, date)),
        read: () => ({
          text: ta.value.replace(/\s+/g, " ").trim().slice(0, 200),
          subject: subj.value, layer: layer.value, importance: Number(imp.value) || 3,
          type: typ.value.trim().slice(0, 8), date: okDate(date.value),
        }),
      };
    }
    function tagLine(m, names, extra) {
      const tags = [subjLabel(m.subject, names)];
      if (m.type) tags.push(m.type);
      tags.push("重要 " + (m.importance || 3));
      if (m.date) tags.push(shortDate(m.date) || m.date);
      if (m.source === "offline") tags.push("线下");
      if (m.source === "manual") tags.push("手动");
      if (m.origin === "back") tags.push("补录");
      if (m.lastUsedAt) tags.push("上次用到 " + mdhm(m.lastUsedAt));
      return h("div", { class: "pmem-tags" },
        m.pinned ? h("span", { class: "hot" }, "置顶") : null,
        tags.map((t) => h("span", null, t)),
        (extra || []).map((t) => h("span", null, t)));
    }
    function openApp(sid) {
      if (sid) focusSid = sid;
      try { ctx.os.open("extapp:" + PID); } catch (e) { log("打不开记忆页", e); }
    }

    /* ======================= 嵌在宿主里的小条 ======================= */

    ctx.ui.place("ext.plugin", (el) => {
      el.classList.add("pmem");
      el.textContent = "读取中…";
      (async () => {
        const sids = await knownSids();
        let core = 0, ev = 0, pend = 0;
        for (const sid of sids) {
          const st = await loadState(sid);
          for (const m of st.mems) { if (m.layer === "core") core++; else ev++; }
          pend += st.pending.length;
        }
        const ps = Object.keys(diag.purposes).sort((a, b) => diag.purposes[b].n - diag.purposes[a].n).slice(0, 6)
          .map((k) => k + (isOfflineWord(k) ? "（算线下）" : ""));
        el.textContent = "";
        el.appendChild(h("div", { class: "pmem-mini" },
          sids.length + " 个对象，核心 " + core + " 条，事件 " + ev + " 条" + (pend ? "，待确认 " + pend + " 条" : "")));
        el.appendChild(h("div", { class: "pmem-mini" }, ps.length ? "见过的 purpose：" + ps.join("、") : "还没见过 purpose，聊几句再看"));
        if (backRunners.size) el.appendChild(h("div", { class: "pmem-mini" }, "正在补录 " + backRunners.size + " 个对象"));
        el.appendChild(btn("打开记忆", () => openApp(focusSid), "pri"));
      })().catch((e) => { el.textContent = "读取失败：" + errMsg(e); });
    });

    ctx.ui.place("thread.panel", (el, props) => {
      const sid = props && props.sessionId;
      if (!isPrivate(sid) || (props && props.isGroup)) return;
      el.classList.add("pmem");
      (async () => {
        const st = await loadState(sid);
        const core = st.mems.filter((m) => m.layer === "core").length;
        const ev = st.mems.length - core;
        el.textContent = "";
        el.appendChild(h("div", { class: "pmem-strip" },
          h("span", null, "记忆：核心 " + core + "，事件 " + ev + (st.pending.length ? "，待确认 " + st.pending.length : "") +
            (backRunners.has(sid) && st.back && st.back.total ? "，补录 " + Math.floor(st.back.processed / st.back.total * 100) + "%" : "")),
          btn("管理", () => openApp(sid))));
      })().catch((e) => log(e));
    });

    /* ======================= 长按「记住这条」 ======================= */

    ctx.ui.bubbleMenu({
      id: "remember",
      label: "记住这条",
      filter: (msg) => {
        try { const sid = msg && msg.sessionId; return !sid || isPrivate(sid); } catch (_) { return true; }
      },
      onSelect: (msg, helpers) => {
        rememberDialog(msg, helpers).catch((e) => log("记住这条出错", e));
      },
    });

    async function rememberDialog(msg, helpers) {
      const say = (t) => { try { (helpers && helpers.toast ? helpers.toast : toast)(t); } catch (_) { toast(t); } };
      const sid = (msg && msg.sessionId) || focusSid;
      if (!isPrivate(sid)) { say("群聊里先不记，私聊里可以"); return; }
      const st = await loadState(sid);
      const names = await namesFor(sid);
      const speaker = msg.role === "user" ? names.user : names.char;
      const raw = msgText(msg);
      const t = msgTime(msg);
      ctx.ui.dialog((el, d) => {
        const close = () => { try { if (d && d.close) d.close(); } catch (_) { /* 忽略 */ } };
        el.classList.add("pmem", "pmem-dialog");
        const ed = editor({
          text: raw.slice(0, 120),
          subject: msg.role === "user" ? "user" : "char",
          layer: "core", importance: 4,
          date: ymd(t || Date.now()),
        }, names);
        const aiLabel = "让 AI 写成一句";
        const aiBtn = btn(aiLabel, async () => {
          aiBtn.disabled = true; aiBtn.textContent = "在写…";
          try {
            const out = cleanPara(await askModel({
              system: "你是聊天记忆整理员，只输出一句话。",
              prompt: "把下面这句话整理成一条记忆：一句话，第三人称，直接用名字（" + names.user + "、" + names.char +
                "），不超过 40 字。只输出这一句。\n\n" + speaker + "：" + raw.slice(0, 600),
              temperature: 0.3, maxTokens: 200,
            }), 120);
            if (out) ed.ta.value = out;
          } catch (e) { say("没写成：" + errMsg(e).slice(0, 40)); }
          aiBtn.disabled = false; aiBtn.textContent = aiLabel;
        });
        el.appendChild(h("div", { class: "pmem-dtitle" }, "记住这条"));
        el.appendChild(h("div", { class: "pmem-quote" }, speaker + "：" + (raw.slice(0, 240) || "（没有文字）")));
        el.appendChild(ed.el);
        el.appendChild(h("div", { class: "pmem-row end", style: "margin-top:10px" },
          aiBtn,
          btn("取消", close),
          btn("记住", async () => {
            const f = ed.read();
            if (!f.text) { say("先写一句"); return; }
            applyOp(st, { op: "add", fields: Object.assign(f, { source: "manual", refs: msg.id ? [msg.id] : [] }) });
            await saveState(st);
            close();
            say("记住了");
          }, "pri")));
      });
    }

    /* ======================= 桌面 App：记忆 ======================= */

    async function sessionOptions() {
      const map = new Map();
      let ths = [];
      try { ths = (await ctx.threads.list()) || []; } catch (_) { ths = []; }
      for (const t of ths) {
        if (!t || !isPrivate(t.id) || t.isGroup) continue;
        map.set(t.id, { sid: t.id, title: t.title || "", charId: t.characterId || "" });
      }
      for (const sid of await knownSids()) if (!map.has(sid)) map.set(sid, { sid, title: "", charId: "" });
      const out = [];
      for (const o of map.values()) {
        let name = o.title;
        try {
          const p = o.charId ? await ctx.personas.get(o.charId) : null;
          if (p && p.name) name = p.name;
        } catch (_) { /* 忽略 */ }
        const st = await loadState(o.sid);
        const n = st.mems.length, pn = st.pending.length;
        out.push({ sid: o.sid, label: (name || o.sid) + (n || pn ? "（" + n + " 条" + (pn ? "，待确认 " + pn : "") + "）" : ""), score: n + pn });
      }
      out.sort((a, b) => b.score - a.score);
      return out;
    }

    ctx.ui.appPage((root, api) => {
      const close = () => { try { if (api && api.close) api.close(); } catch (_) { /* 忽略 */ } };
      const ui = { sid: focusSid || "", tab: "pending", subj: "all", pfrom: "all", q: "", editing: null, exportText: "", openSum: "" };
      root.classList.add("pmem", "pmem-root");
      let drawing = false, again = false, cur = null, body = null;

      const onBump = () => {
        if (!root.isConnected) { listeners.delete(onBump); return; }
        if (ui.editing) return;
        draw();
      };
      listeners.add(onBump);

      function swap(node) {
        if (root.replaceChildren) root.replaceChildren(node);
        else { root.textContent = ""; root.appendChild(node); }
      }
      async function draw() {
        if (drawing) { again = true; return; }
        drawing = true;
        try { await drawNow(); } catch (e) { log("画页面出错", e); swap(h("div", { class: "pmem-app" }, "页面出错：" + errMsg(e))); }
        drawing = false;
        if (again) { again = false; draw(); }
      }
      const go = (patch) => { Object.assign(ui, patch); draw(); };

      async function drawNow() {
        const opts = await sessionOptions();
        if (!opts.some((o) => o.sid === ui.sid)) ui.sid = opts.length ? opts[0].sid : "";
        const sid = ui.sid;
        const wrap = h("div", { class: "pmem-app" },
          h("div", { class: "pmem-top" },
            h("button", { class: "pmem-back", type: "button", onclick: close }, "‹ 返回"),
            h("div", { class: "pmem-title" }, "记忆"),
            h("div", { style: "min-width:56px" })));
        if (!sid) {
          wrap.appendChild(h("div", { class: "pmem-empty" }, "还没有私聊对象。先去和角色聊几句，这里就会出现。"));
          swap(wrap);
          return;
        }
        const st = await loadState(sid);
        const names = await namesFor(sid);
        const rows = await listRows(sid);
        const valid = validRows(rows);
        if (!st.cursor) { initCursor(st, rows); await saveState(st, true); }
        if (ensureOrigin(st, valid)) await saveState(st, true);
        const freshN = sliceNew(rows, st.cursor).fresh.length;
        const br = backRange(st, valid);
        cur = { st, names };

        wrap.appendChild(Object.assign(mkSelect(opts.map((o) => [o.sid, o.label]), sid, (v) => go({ sid: v, editing: null, exportText: "", openSum: "" })), { className: "pmem-who" }));

        const busy = running.has(sid);
        const status = h("div", { class: "pmem-status" },
          h("div", null, busy ? "正在整理…" : "上次整理：" + (st.lastExtractAt ? mdhm(st.lastExtractAt) : "还没有") + "　还有 " + freshN + " 条新消息没整理"),
          h("div", { class: "pmem-row" },
            btn("现在整理", async () => { const p = extract(sid, { force: true, min: 1 }); draw(); toast((await p).msg); }, "pri", busy),
            st.runs || st.back ? null : btn("先试试：整理最近 40 条", async () => { const p = tryRecent(sid, 40); draw(); toast((await p).msg); }, "", busy)));
        if (st.lastError) status.appendChild(h("div", { class: "pmem-err" }, "上次出错：" + st.lastError));
        wrap.appendChild(status);
        const bc = backCard(st, br, sid);
        if (bc) wrap.appendChild(bc);

        const coreN = st.mems.filter((m) => m.layer === "core").length;
        const tabs = [
          ["pending", "待确认", st.pending.length], ["core", "核心档案", coreN], ["event", "事件", st.mems.length - coreN],
          ["summary", "往事", st.summaries.length], ["archive", "归档", st.archive.length], ["tools", "工具", 0],
        ];
        wrap.appendChild(h("div", { class: "pmem-tabs" }, tabs.map((t) =>
          h("button", { type: "button", class: "pmem-tab" + (ui.tab === t[0] ? " on" : ""), onclick: () => go({ tab: t[0], editing: null }) },
            t[1] + (t[2] ? " " + t[2] : "")))));

        if (ui.tab === "core" || ui.tab === "event" || ui.tab === "archive") {
          const chips = [["all", "全部"], ["user", names.user], ["char", names.char], ["both", "两人"]];
          const search = h("input", { class: "pmem-search", placeholder: "搜索", value: ui.q });
          search.addEventListener("input", () => { ui.q = search.value; fillBody(); });
          wrap.appendChild(h("div", { class: "pmem-filter" },
            chips.map((c) => h("button", { type: "button", class: "pmem-chip" + (ui.subj === c[0] ? " on" : ""), onclick: () => go({ subj: c[0] }) }, c[1])),
            search));
        }
        body = h("div");
        wrap.appendChild(body);
        fillBody();
        swap(wrap);
      }

      function fillBody() {
        if (!body || !cur) return;
        const { st, names } = cur;
        body.textContent = "";
        const add = (x) => body.appendChild(x);
        const save = () => saveState(st);
        const match = (m) => (ui.subj === "all" || m.subject === ui.subj) && (!ui.q || String(m.text).indexOf(ui.q) >= 0);

        if (ui.tab === "pending") {
          if (!st.pending.length) { add(h("div", { class: "pmem-empty" }, "没有待确认的。新整理出来的记忆会先放在这里，你确认了才会用上。")); return; }
          const backN = backPendingN(st);
          if (!backN) ui.pfrom = "all";
          if (backN) {
            const fc = [["all", "全部 " + st.pending.length], ["live", "新聊的 " + (st.pending.length - backN)], ["back", "补录 " + backN]];
            add(h("div", { class: "pmem-filter" }, fc.map((c) =>
              h("button", { type: "button", class: "pmem-chip" + (ui.pfrom === c[0] ? " on" : ""), onclick: () => { ui.pfrom = c[0]; fillBody(); } }, c[1]))));
          }
          const shown = st.pending.filter((p) => ui.pfrom === "all" || (ui.pfrom === "back" ? p.from === "back" : p.from !== "back"));
          if (!shown.length) { add(h("div", { class: "pmem-empty" }, "这一类没有待确认的。")); return; }
          const word = ui.pfrom === "all" ? "全部" : "这些";
          add(h("div", { class: "pmem-row" },
            btn(word + "确认", async () => {
              for (const p of shown) applyOp(st, p);
              st.pending = st.pending.filter((p) => shown.indexOf(p) < 0);
              await save(); toast("已确认 " + shown.length + " 条");
            }, "pri"),
            twoTap(word + "不要", "再点一次，丢掉 " + shown.length + " 条", async () => {
              st.pending = st.pending.filter((p) => shown.indexOf(p) < 0);
              await save();
            })));
          if (backN && backRunners.has(st.sid) && st.back && st.back.status === "waiting") {
            add(h("div", { class: "pmem-tip" }, "补录在等你：补录出的待确认降到 " + BACK_RESUME_AT + " 条以内会自动继续。"));
          }
          for (const p of shown.slice().reverse()) add(pendCard(st, p, names));
          return;
        }

        if (ui.tab === "core" || ui.tab === "event") {
          add(h("div", { class: "pmem-tip" }, ui.tab === "core"
            ? "核心档案每次聊天都会带上，按置顶和重要度排，超出字数上限的会被挤掉。"
            : "事件每次按「和最新一句的相关度、重要度、新近程度」挑几条带上。置顶的一定带上，也不会被压缩进往事。"));
          if (ui.editing === "__new") {
            const ed = editor({ layer: ui.tab, subject: "user", importance: ui.tab === "core" ? 4 : 3, date: ui.tab === "event" ? ymd(Date.now()) : "" }, names);
            add(h("div", { class: "pmem-card" }, ed.el, h("div", { class: "pmem-acts" },
              btn("取消", () => { ui.editing = null; fillBody(); }),
              btn("保存", async () => {
                const f = ed.read();
                if (!f.text) { toast("先写一句"); return; }
                applyOp(st, { op: "add", fields: Object.assign(f, { source: "manual" }) });
                ui.editing = null; await save();
              }, "pri"))));
          } else {
            add(h("div", { class: "pmem-row end" }, btn("手动加一条", () => { ui.editing = "__new"; fillBody(); })));
          }
          const list = st.mems.filter((m) => m.layer === ui.tab && match(m));
          list.sort(ui.tab === "core"
            ? (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.importance || 3) - (a.importance || 3) || (b.updatedAt || 0) - (a.updatedAt || 0)
            : (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (dateMs(b.date) || b.createdAt || 0) - (dateMs(a.date) || a.createdAt || 0));
          if (!list.length) add(h("div", { class: "pmem-empty" }, ui.q || ui.subj !== "all" ? "没有符合条件的。" : "这里还是空的。"));
          for (const m of list) add(memCard(st, m, names));
          return;
        }

        if (ui.tab === "summary") {
          add(h("div", { class: "pmem-tip" }, "事件太多时，最旧、最不重要的会被压成一段往事，原条目进归档。撤销压缩会把它们放回事件。"));
          if (!st.summaries.length) { add(h("div", { class: "pmem-empty" }, "还没有往事。事件超过设置里的条数才会开始压缩。")); return; }
          for (const s of st.summaries.slice().reverse()) add(sumCard(st, s));
          return;
        }

        if (ui.tab === "archive") {
          add(h("div", { class: "pmem-tip" }, "删掉的、被压缩的记忆都在这里，可以恢复。最多留 " + ARCHIVE_CAP + " 条。"));
          const list = st.archive.filter(match).slice().reverse();
          if (!list.length) { add(h("div", { class: "pmem-empty" }, "归档是空的。")); return; }
          add(h("div", { class: "pmem-row end" }, twoTap("清空归档", "再点一次，清空归档", async () => { st.archive = []; await save(); })));
          for (const a of list) {
            add(h("div", { class: "pmem-card" },
              h("div", { class: "pmem-text" }, a.text),
              tagLine(a, names, [a.why || "已归档", a.archivedAt ? mdhm(a.archivedAt) : ""].filter(Boolean)),
              h("div", { class: "pmem-acts" }, btn("恢复", async () => { restoreMem(st, a); await save(); toast("已恢复"); }))));
          }
          return;
        }

        if (ui.tab === "tools") fillTools(st, names, add);
      }

      function memCard(st, m, names) {
        if (ui.editing === m.id) {
          const ed = editor(m, names);
          return h("div", { class: "pmem-card" }, ed.el, h("div", { class: "pmem-acts" },
            btn("取消", () => { ui.editing = null; fillBody(); }),
            btn("保存", async () => {
              const f = ed.read();
              if (!f.text) { toast("不能是空的"); return; }
              if (f.text !== m.text) m.prevText = m.text;
              Object.assign(m, f, { updatedAt: Date.now() });
              ui.editing = null; await saveState(st);
            }, "pri")));
        }
        return h("div", { class: "pmem-card" + (m.pinned ? " pin" : "") },
          h("div", { class: "pmem-text" }, m.text),
          m.prevText ? h("div", { class: "pmem-sub" }, "改之前：" + m.prevText) : null,
          tagLine(m, names),
          h("div", { class: "pmem-acts" },
            btn(m.pinned ? "取消置顶" : "置顶", async () => { m.pinned = !m.pinned; m.updatedAt = Date.now(); await saveState(st); }),
            btn("编辑", () => { ui.editing = m.id; fillBody(); }),
            btn("删除", async () => { archiveMem(st, m, "手动删除"); await saveState(st); toast("已删除，可以在归档里恢复"); }, "warn")));
      }

      function backCard(st, br, sid) {
        if (br.total <= 0 && !st.back) return null;
        const b = st.back || backDefaults();
        const tok = backRunners.get(sid);
        const card = h("div", { class: "pmem-status pmem-backcard" });
        let state = "";
        if (tok && tok.stop) state = "正在暂停，等这一批做完";
        else if (tok && b.status === "waiting") state = "等你确认";
        else if (tok) state = "进行中";
        else if (b.status === "done") state = "已完成";
        else if (b.status === "error") state = "出错停下了";
        else if (b.batches) state = "已暂停";
        card.appendChild(h("div", { class: "pmem-row", style: "justify-content:space-between" },
          h("b", null, "补录旧记录"), state ? h("span", { class: "pmem-small" }, state) : null));

        if (b.status === "done" && br.left === 0) {
          card.appendChild(h("div", { class: "pmem-small", style: "margin-top:4px" },
            "补录完成：" + fmtN(br.total) + " 条旧记录，整理出 " + b.added + " 条记忆。"));
          return card;
        }
        if (br.total <= 0) {
          card.appendChild(h("div", { class: "pmem-small", style: "margin-top:4px" }, "这个对话没有装插件之前的旧记录。"));
          return card;
        }

        const leftCalls = Math.ceil(br.left / BATCH_MAX);
        const mins = Math.max(1, Math.ceil(leftCalls * ((b.msPerBatch || 20000) + (b.gap || 8) * 1000) / 60000));
        const started = !!(tok || b.batches);
        if (!started) {
          card.appendChild(h("div", { class: "pmem-small", style: "margin-top:4px" },
            "这个对话里有 " + fmtN(br.total) + " 条装插件之前的消息。按 " + BATCH_MAX + " 条一批、从最早往后整理，" +
            "大约 " + leftCalls + " 次模型调用（会消耗额度），" + mins + " 分钟左右，随时可以暂停。"));
        } else {
          const pct = Math.floor(br.from / br.total * 100);
          card.appendChild(h("div", { class: "pmem-bar" }, h("i", { style: "width:" + pct + "%" })));
          card.appendChild(h("div", { class: "pmem-small" },
            fmtN(br.from) + " / " + fmtN(br.total) + " 条（" + pct + "%），已整理出 " + b.added + " 条" +
            (br.left ? "；还剩约 " + leftCalls + " 次调用、" + mins + " 分钟" : "")));
        }
        if (tok && b.status === "waiting") {
          card.appendChild(h("div", { class: "pmem-small", style: "margin-top:4px" },
            "补录出的待确认攒到 " + BACK_PAUSE_AT + " 条了，先停在这里。确认或丢掉到剩 " + BACK_RESUME_AT + " 条以内，会自动接着补。"));
        }
        if (b.lastError) card.appendChild(h("div", { class: "pmem-err" }, "出错：" + b.lastError));

        const st2 = st;
        const modeSel = mkSelect([
          ["confirm", "补录出的先放进待确认（攒到 " + BACK_PAUSE_AT + " 条暂停，等你看完）"],
          ["auto", "补录出的直接生效（快，错的要你事后自己删）"],
        ], b.mode || "confirm", async (v) => { backOf(st2).mode = v; await saveState(st2); });
        const gapSel = mkSelect(BACK_GAPS.map((g) => [String(g), "每批之间歇 " + g + " 秒"]), String(b.gap || 8),
          async (v) => { backOf(st2).gap = Number(v) || 8; await saveState(st2); });
        card.appendChild(modeSel);
        card.appendChild(gapSel);

        const row = h("div", { class: "pmem-row", style: "margin-top:8px" });
        if (tok) {
          row.appendChild(btn(tok.stop ? "正在暂停…" : "暂停", () => pauseBack(sid), "", tok.stop));
          if (b.status === "waiting") row.appendChild(btn("去确认", () => go({ tab: "pending", pfrom: "back", editing: null }), "pri"));
        } else {
          row.appendChild(btn(started ? "继续补录" : "开始补录", () => { startBack(sid); draw(); }, "pri"));
          if (started) {
            row.appendChild(twoTap("从头重来", "再点一次，从最早重新补", async () => {
              st.back = backDefaults(st.back);
              await saveState(st);
              toast("补录进度清零了；已有记忆不动，重复的会自动跳过");
            }));
          }
        }
        card.appendChild(row);
        return card;
      }

      function pendCard(st, p, names) {
        const target = p.target ? st.mems.find((x) => x.id === p.target) : null;
        const shown = Object.assign({}, target || {}, p.fields || {});
        const label = { add: "新增", update: "修改", delete: "删除" }[p.op] || p.op;
        const layerName = shown.layer === "core" ? "核心档案" : "事件";
        const drop = async () => { st.pending.splice(st.pending.indexOf(p), 1); await saveState(st); };
        const ok = async (override) => {
          applyOp(st, p, override);
          st.pending.splice(st.pending.indexOf(p), 1);
          ui.editing = null;
          await saveState(st);
        };
        if (ui.editing === p.pid) {
          const ed = editor(shown, names);
          return h("div", { class: "pmem-card" },
            h("div", { class: "pmem-op" }, label + "到" + layerName + "，改一下再确认"),
            ed.el,
            h("div", { class: "pmem-acts" }, btn("取消", () => { ui.editing = null; fillBody(); }), btn("确认", () => ok(ed.read()), "pri")));
        }
        return h("div", { class: "pmem-card" },
          h("div", { class: "pmem-op op-" + p.op }, label + (p.op === "delete" ? "" : "到" + layerName) + (p.from === "back" ? "（补录）" : "")),
          p.op === "delete"
            ? h("div", { class: "pmem-text del" }, p.before || (target && target.text) || "（原记忆已经不在了）")
            : h("div", { class: "pmem-text" }, shown.text || ""),
          p.op === "update" && p.before && p.before !== shown.text ? h("div", { class: "pmem-sub" }, "原来是：" + p.before) : null,
          p.reason ? h("div", { class: "pmem-sub" }, "理由：" + p.reason) : null,
          p.op === "delete" ? null : tagLine(shown, names),
          h("div", { class: "pmem-acts" },
            btn("不要", drop, "warn"),
            p.op === "delete" ? null : btn("改一下", () => { ui.editing = p.pid; fillBody(); }),
            btn("确认", () => ok(), "pri")));
      }

      function sumCard(st, s) {
        const range = [shortDate(s.from), shortDate(s.to)].filter(Boolean).join(" 到 ");
        const ids = [s.id].concat(s.parts || []);
        const from = st.archive.filter((a) => a.sumId && ids.indexOf(a.sumId) >= 0);
        if (ui.editing === s.id) {
          const ta = h("textarea", { class: "pmem-ta", rows: 5 });
          ta.value = s.text;
          return h("div", { class: "pmem-card" }, ta, h("div", { class: "pmem-acts" },
            btn("取消", () => { ui.editing = null; fillBody(); }),
            btn("保存", async () => { s.text = ta.value.trim() || s.text; ui.editing = null; await saveState(st); }, "pri")));
        }
        return h("div", { class: "pmem-card" },
          h("div", { class: "pmem-text" }, s.text),
          h("div", { class: "pmem-tags" }, range ? h("span", null, range) : null, h("span", null, "由 " + (s.count || from.length) + " 条事件压成")),
          ui.openSum === s.id ? h("div", { class: "pmem-sub" }, from.length ? from.map((a) => "· " + a.text).join("\n") : "原条目已不在归档里") : null,
          h("div", { class: "pmem-acts" },
            btn(ui.openSum === s.id ? "收起原条目" : "看原条目", () => { ui.openSum = ui.openSum === s.id ? "" : s.id; fillBody(); }),
            btn("编辑", () => { ui.editing = s.id; fillBody(); }),
            twoTap("撤销压缩", "再点一次，放回事件", async () => {
              for (const a of from) restoreMem(st, a);
              st.summaries.splice(st.summaries.indexOf(s), 1);
              await saveState(st);
              toast("已放回 " + from.length + " 条事件");
            })));
      }

      function fillTools(st, names, add) {
        add(h("div", { class: "pmem-sec" }, "导出"));
        add(h("div", { class: "pmem-small" }, "导出内容含隐私（你和角色的私事）。只复制到你自己信得过的地方。"));
        add(h("div", { class: "pmem-row", style: "margin:6px 0" },
          btn("生成导出内容", () => {
            ui.exportText = JSON.stringify({ app: "puff-memory", v: 1, sid: st.sid, at: Date.now(),
              mems: st.mems, summaries: st.summaries, pending: st.pending }, null, 1);
            fillBody();
          }),
          ui.exportText ? btn("复制", async () => {
            try { await navigator.clipboard.writeText(ui.exportText); toast("已复制"); }
            catch (_) { toast("复制不了，请长按下面的文字手动复制"); }
          }, "pri") : null));
        if (ui.exportText) {
          const ta = h("textarea", { class: "pmem-ta", rows: 6, readonly: true });
          ta.value = ui.exportText;
          add(ta);
        }

        add(h("div", { class: "pmem-sec" }, "导入"));
        add(h("div", { class: "pmem-small" }, "粘贴之前导出的内容，合并进当前对象；文字一样的会跳过。导入的直接生效。"));
        const imp = h("textarea", { class: "pmem-ta", rows: 4, placeholder: "粘贴到这里" });
        add(imp);
        add(h("div", { class: "pmem-row end", style: "margin-top:6px" }, btn("导入", async () => {
          const v = parseJSONLoose(imp.value);
          const list = Array.isArray(v) ? v : v && Array.isArray(v.mems) ? v.mems : null;
          if (!list) { toast("看不懂这段内容"); return; }
          let n = 0;
          for (const m of list) {
            const text = cleanText(m && m.text);
            if (!text || st.mems.some((x) => normText(x.text) === normText(text))) continue;
            applyOp(st, { op: "add", fields: {
              layer: LAYERS[m.layer] || "event", subject: SUBJ[m.subject] || "both", type: String(m.type || "").slice(0, 8),
              text, importance: clampImp(m.importance) || 3, date: okDate(m.date),
              source: m.source === "offline" || m.source === "manual" ? m.source : "online", pinned: !!m.pinned,
            } });
            n++;
          }
          if (v && Array.isArray(v.summaries)) {
            for (const s of v.summaries) {
              if (s && s.text && !st.summaries.some((x) => x.text === s.text)) {
                st.summaries.push({ id: "s" + ++st.seq, text: String(s.text).slice(0, 400), from: okDate(s.from), to: okDate(s.to), count: s.count || 0, at: Date.now(), parts: [] });
              }
            }
          }
          await saveState(st);
          toast("导入了 " + n + " 条");
        }, "pri")));

        add(h("div", { class: "pmem-sec" }, "清空"));
        add(h("div", { class: "pmem-row" }, twoTap("清空这个对象的全部记忆", "再点一次，真的清空", async () => {
          pauseBack(st.sid);
          st.mems = []; st.pending = []; st.summaries = []; st.archive = [];
          if (st.back) st.back = backDefaults(st.back);
          await saveState(st);
          toast("已清空");
        })));

        add(h("div", { class: "pmem-sec" }, "诊断"));
        add(h("div", { class: "pmem-small" },
          "线上和线下私聊的会话 id 一样，只能靠 purpose 区分。先线上、线下各聊几句，看下面哪个是线下，" +
          "再到扩展页本插件的设置里改「线下 purpose 关键词」。现在的关键词：" + prefList("offlineKeys", DEF_OFFLINE).join("、")));
        const ps = Object.keys(diag.purposes).sort((a, b) => diag.purposes[b].last - diag.purposes[a].last);
        add(ps.length
          ? h("table", { class: "pmem-table" }, ps.map((k) => {
            const d = diag.purposes[k];
            return h("tr", null,
              h("td", null, k),
              h("td", null, d.n + " 次"),
              h("td", null, (d.priv ? "私聊" : "") + (d.group ? (d.priv ? "、" : "") + "群聊" : "") || "无会话"),
              h("td", null, isOfflineWord(k) ? "算线下" : "算线上"),
              h("td", null, d.last ? mdhm(d.last) : ""));
          }))
          : h("div", { class: "pmem-small" }, "还没见过 purpose。"));
        const ks = Object.keys(diag.keys);
        if (ks.length) {
          add(h("div", { class: "pmem-small", style: "margin-top:10px" }, "消息上见过的字段（如果有字段能直接区分线下，告诉作者）："));
          add(h("table", { class: "pmem-table" }, ks.map((k) => h("tr", null, h("td", null, k), h("td", null, (diag.keys[k] || []).join("、"))))));
        }
        add(h("div", { class: "pmem-small", style: "margin-top:10px" },
          "本对象：会话 " + st.sid + "；角色名「" + names.char + "」；已整理 " + (st.runs || 0) + " 批；游标 " +
          (st.cursor ? (st.cursor.id || "无 id") + "，第 " + st.cursor.n + " 条" : "未开始") +
          "；旧记录范围：前 " + (st.origin ? st.origin.n : 0) + " 条" + (st.back ? "，补录到第 " + (st.back.processed || 0) + " 条" : "")));
      }

      draw();
    });

    /* ======================= 禁用时 ======================= */

    return () => {
      for (const sid of Array.from(saveLater.keys())) {
        const st = cache.get(sid);
        if (st) kvSet(K_STATE(sid), JSON.parse(JSON.stringify(st)));
      }
      saveLater.clear();
      if (diagDirty) kvSet("diag", JSON.parse(JSON.stringify(diag)));
      listeners.clear();
      alive = false;
      for (const t of backRunners.values()) t.stop = true;
    };
  },
};
