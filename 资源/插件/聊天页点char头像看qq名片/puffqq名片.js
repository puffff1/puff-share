// Puff 脚本：QQ 名片页
// 扩展 → 脚本 → 导入本文件。启用后桌面多一个「QQ名片」图标；
// 聊天里点 char 头像（或长按气泡 →「查看名片」）进入名片页。

const ID = "puff-qq-card";
const DAY = 86400000;

// [key, 标签, 类型]
const FIELDS = [
  ["nickname", "昵称", "text"],
  ["sign", "个性签名", "text"],
  ["gender", "性别", "text"],
  ["age", "年龄", "text"],
  ["birthday", "生日", "text"],
  ["location", "所在地", "text"],
  ["hometown", "故乡", "text"],
  ["tags", "兴趣标签", "text"],
  ["job", "职业", "text"],
  ["company", "公司", "text"],
  ["email", "邮箱", "text"],
  ["bio", "个人说明", "area"],
];
const LABEL = {
  remark: "备注", group: "分组", qq: "QQ号", intimate: "亲密关系",
  star: "特别关心", dnd: "好友消息免打扰", black: "加入黑名单",
  cover: "名片背景", photos: "精选照片",
};
FIELDS.forEach(function (f) { LABEL[f[0]] = f[1]; });

const CSS = [
  ".qqc{position:fixed;inset:0;z-index:5;overflow-y:auto;-webkit-overflow-scrolling:touch;background:var(--bg);color:var(--tx);--bg:#000;--bg2:#1c1c1e;--tx:#fff;--tx2:#8e8e93;--ln:rgba(255,255,255,.1);--ac:#1f78d1;font-size:14px;line-height:1.45}",
  "@media (prefers-color-scheme:light){.qqc{--bg:#fff;--bg2:#f2f3f5;--tx:#111;--tx2:#8a8a8e;--ln:rgba(0,0,0,.1)}}",
  ".qqc *{box-sizing:border-box}",
  ".qqc button{font:inherit;color:inherit}",
  ".qqc .cover{height:calc(150px + env(safe-area-inset-top,0px));background:linear-gradient(160deg,#4a4a52,#15151a) center/cover no-repeat;position:relative}",
  ".qqc .bar{position:absolute;left:0;right:0;top:0;padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 0;display:flex;justify-content:space-between}",
  ".qqc .rb{width:32px;height:32px;border-radius:50%;background:rgba(120,120,128,.55);color:#fff;border:0;font-size:16px;display:flex;align-items:center;justify-content:center}",
  ".qqc .panel{margin-top:-16px;position:relative;background:var(--bg);border-radius:18px 18px 0 0;padding:14px 18px 110px;min-height:60vh}",
  ".qqc .head{display:flex;gap:16px;align-items:center;margin-bottom:8px}",
  ".qqc .av{width:60px;height:60px;border-radius:50%;object-fit:cover;background:var(--bg2);flex:none}",
  ".qqc .nm{font-size:18px;font-weight:700}",
  ".qqc .sub{font-size:12px;color:var(--tx2);margin-top:2px}",
  ".qqc .row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--ln)}",
  ".qqc .row .m{color:var(--tx2)}",
  ".qqc .row .c{color:var(--tx2);font-size:20px}",
  ".qqc .sec{display:flex;justify-content:space-between;align-items:center;margin:16px 0 10px;font-weight:700;font-size:15px}",
  ".qqc .sec .lk{font-weight:400;font-size:14px;color:#6a8fd8;background:none;border:0}",
  ".qqc .ph{display:flex;flex-wrap:wrap;gap:8px}",
  ".qqc .ph .t{width:calc((100% - 24px)/4);aspect-ratio:1;border-radius:6px;background:var(--bg2) center/cover no-repeat;position:relative;border:0;padding:0}",
  ".qqc .ph .x{position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;border:0;font-size:13px;line-height:22px;padding:0}",
  ".qqc .ph .plus{display:flex;align-items:center;justify-content:center;font-size:30px;color:var(--tx2)}",
  ".qqc .tip{font-size:12px;color:var(--tx2);margin-top:14px}",
  ".qqc .bottom{position:fixed;left:0;right:0;bottom:0;display:flex;gap:10px;padding:14px 16px calc(env(safe-area-inset-bottom,0px) + 12px);background:linear-gradient(transparent,var(--bg) 35%);z-index:6}",
  ".qqc .btn{flex:1;height:40px;border-radius:12px;border:1.5px solid var(--ln);background:var(--bg);color:var(--tx);font-size:14px;font-weight:600}",
  ".qqc .btn.pri{background:var(--ac);border-color:var(--ac);color:#fff}",
  ".qqc .nav{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 10px;background:var(--bg);font-weight:700;font-size:17px}",
  ".qqc .nav .tb{background:none;border:0;font-size:24px;padding:0 6px}",
  ".qqc .nav .sv{background:var(--ac);color:#fff;border:0;border-radius:14px;padding:6px 16px;font-size:15px}",
  ".qqc .f{background:var(--bg2);border-radius:12px;padding:2px 14px;margin:10px 14px}",
  ".qqc .fi{display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid var(--ln)}",
  ".qqc .fi:last-child{border-bottom:0}",
  ".qqc .fi label{width:72px;flex:none;font-weight:600}",
  ".qqc .fi input[type=text],.qqc .fi textarea{flex:1;min-width:0;background:transparent;border:0;outline:0;color:var(--tx);font:inherit;text-align:right}",
  ".qqc .fi textarea{min-height:74px;text-align:left;resize:none}",
  ".qqc .sw{-webkit-appearance:none;appearance:none;width:50px;height:30px;border-radius:15px;background:#3a3a3c;position:relative;margin-left:auto;transition:.2s;outline:0;border:0}",
  ".qqc .sw:checked{background:var(--ac)}",
  ".qqc .sw::after{content:'';position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;transition:.2s}",
  ".qqc .sw:checked::after{left:23px}",
  ".qqc .ghost{display:block;width:calc(100% - 32px);margin:12px 16px;height:46px;border-radius:14px;border:1.5px solid var(--ln);background:transparent;color:var(--tx)}",
  ".qqc .pk{display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--ln)}",
  ".qqc .pk .pa{width:42px;height:42px;border-radius:50%;object-fit:cover;background:var(--bg2);flex:none}",
  ".qqc .vw{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:20;display:flex;align-items:center;justify-content:center}",
  ".qqc .vw img{max-width:100%;max-height:100%}",
  ".qqc .lt{display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px}",
  ".qqc .vz{flex:none;font-size:11px;padding:3px 9px;border-radius:10px;border:1px solid var(--ln);background:none;color:var(--tx2)}",
  ".qqc .vz.on{color:#6a8fd8;border-color:#6a8fd8}",
].join("\n");

function h(tag, o, kids) {
  const e = document.createElement(tag);
  if (o) {
    for (const k in o) {
      const v = o[k];
      if (v == null) continue;
      if (k === "cls") e.className = v;
      else if (k === "css") e.style.cssText = v;
      else if (k === "text") e.textContent = v;
      else if (k === "value") e.value = v;
      else if (k === "checked") e.checked = !!v;
      else if (k.slice(0, 2) === "on") e[k] = v;
      else e.setAttribute(k, v);
    }
  }
  (kids || []).forEach(function (c) {
    if (c == null) return;
    e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return e;
}

function A(v) { return Promise.resolve(v); }
function two(n) { return n < 10 ? "0" + n : "" + n; }
function ymd(t) { const d = new Date(t); return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()); }
function fmt(v) { return typeof v === "boolean" ? (v ? "开" : "关") : String(v == null ? "" : v); }
function msgTs(m) {
  const v = m.createdAt || m.timestamp || m.time || m.ts || m.at || 0;
  const n = typeof v === "number" ? v : Date.parse(v);
  return isFinite(n) ? n : 0;
}

function toDataURL(media) {
  if (!media) return Promise.resolve("");
  if (typeof media === "string") return Promise.resolve(media);
  if (typeof Blob !== "undefined" && media instanceof Blob) {
    return new Promise(function (res) {
      const fr = new FileReader();
      fr.onload = function () { res(String(fr.result)); };
      fr.onerror = function () { res(""); };
      fr.readAsDataURL(media);
    });
  }
  return Promise.resolve(String(media.dataUrl || media.url || ""));
}

function shrink(src, max, q) {
  return new Promise(function (res) {
    if (!src) return res("");
    const im = new Image();
    im.onload = function () {
      const s = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(im.width * s));
      c.height = Math.max(1, Math.round(im.height * s));
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      try { res(c.toDataURL("image/jpeg", q)); } catch (e) { res(src); }
    };
    im.onerror = function () { res(""); };
    im.src = src;
  });
}

function parseJSON(t) {
  t = String(t || "").replace(/```json|```/g, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}

function blank() {
  return {
    remark: "", group: "", qq: "", intimate: "", star: false, dnd: false, black: false,
    nickname: "", sign: "", gender: "", age: "", birthday: "", location: "", hometown: "",
    tags: "", job: "", company: "", email: "", bio: "",
    cover: "", coverBy: "", photos: [], lastAuto: 0, edited: 0, log: [], priv: {},
  };
}

export default {
  manifest: {
    id: ID,
    name: "QQ名片页",
    engine: "puff",
    apiVersion: 1,
    version: "1.1.1",
    description: "点 char 头像进 QQ 风格名片页：编辑资料、备注/分组、精选照片、名片背景；char 可定期自己改资料",
    permissions: ["读取聊天记录（找图、生成资料）", "调用已配置的 API", "往提示词里加名片信息"],
    app: { name: "QQ名片", letter: "名", fullscreen: true },
    settings: [
      { key: "autoEdit", label: "让 char 定期自己改资料", type: "boolean", default: true },
      { key: "intervalDays", label: "自动修改间隔（天）", type: "number", default: 180, description: "默认 180 天≈半年；到期后下次打开该聊天时才会改" },
      { key: "notifyMention", label: "我改了资料后，让 char 顺口提一嘴", type: "boolean", default: true, description: "关掉＝char 知道但不主动说" },
      { key: "avatarClick", label: "点聊天里 char 头像进名片", type: "boolean", default: true },
      { key: "remarkInChat", label: "备注显示到聊天页（实验性）", type: "boolean", default: true },
      { key: "photoMax", label: "精选照片最多几张", type: "number", default: 8 },
      { key: "photoDays", label: "char 找图的范围（天）", type: "number", default: 60 },
      { key: "historyN", label: "生成资料时参考的聊天条数", type: "number", default: 60 },
      { key: "spaceTarget", label: "点空间跳转到的 App id", type: "text", default: "moments", description: "跳不过去就填对的 id；留空走自动查找“朋友圈/动态”" },
    ],
  },

  setup(ctx) {
    const cur = { sid: "" };
    const busy = {};
    const injected = {};
    let remarkMap = new Map();   // 原名 → 备注
    let avatarMap = new Map();   // 头像地址 → 角色 id
    let nameMap = new Map();     // 名字/备注 → 角色 id
    let rafFlag = false;

    function pref(k, d) {
      const v = ctx.kit.prefs.get(k);
      return v == null || v === "" ? d : v;
    }
    function kvGet(k, d) {
      try { const v = ctx.kit.kv.get(k); return v == null ? d : v; } catch (e) { return d; }
    }
    function getCard(cid) {
      const c = Object.assign(blank(), kvGet("card:" + cid, {}));
      if (!Array.isArray(c.photos)) c.photos = [];
      if (!Array.isArray(c.log)) c.log = [];
      if (!c.priv || typeof c.priv !== "object") c.priv = {};
      return c;
    }
    function saveCard(cid, c) { ctx.kit.kv.set("card:" + cid, c); }

    // ───────── 变更记录：用户改的 → char 知道 ─────────
    function pushLog(c, diffs, by) {
      diffs.forEach(function (d) { c.log.push({ t: Date.now(), by: by, k: d.k, label: d.label, from: d.from, to: d.to }); });
      if (c.log.length > 60) c.log = c.log.slice(-60);
    }
    function pushPending(cid, diffs) {
      const list = kvGet("pending:" + cid, []);
      diffs.forEach(function (d) {
        const i = list.findIndex(function (x) { return x.k === d.k; });
        if (i >= 0) {
          const from = list[i].from;
          if (from === d.to) list.splice(i, 1);
          else list[i] = { k: d.k, label: d.label, from: from, to: d.to };
        } else list.push({ k: d.k, label: d.label, from: d.from, to: d.to });
      });
      ctx.kit.kv.set("pending:" + cid, list.slice(-12));
    }
    // 用户手动保存（文字/开关类字段 + 封面）
    function commit(cid, patch) {
      const c = getCard(cid);
      const diffs = [];
      Object.keys(patch).forEach(function (k) {
        if (k === "cover" || k === "priv") return;
        const a = c[k], b = patch[k];
        if (fmt(a) !== fmt(b)) {
          diffs.push({ k: k, label: LABEL[k] || k, from: fmt(a), to: fmt(b) });
          c[k] = b;
        }
      });
      if (patch.cover !== undefined && patch.cover !== c.cover) {
        c.cover = patch.cover;
        c.coverBy = patch.cover ? "user" : "";
        diffs.push({ k: "cover", label: "名片背景", from: "", to: patch.cover ? "换了新的背景" : "去掉了背景" });
      }
      if (patch.priv) {
        Object.keys(patch.priv).forEach(function (k) {
          const nv = !!patch.priv[k], ov = !!c.priv[k];
          if (nv !== ov) {
            c.priv[k] = nv;
            diffs.push({ k: "priv_" + k, label: (LABEL[k] || k) + "可见性", from: ov ? "仅自己" : "公开", to: nv ? "仅自己" : "公开" });
          }
        });
      }
      if (!diffs.length) return 0;
      c.edited = Date.now();
      pushLog(c, diffs, "user");
      saveCard(cid, c);
      pushPending(cid, diffs);
      refreshMaps();
      return diffs.length;
    }
    function photoChanged(cid, label) {
      const diffs = [{ k: "photos", label: "精选照片", from: "", to: label }];
      const c = getCard(cid);
      c.edited = Date.now();
      pushLog(c, diffs, "user");
      saveCard(cid, c);
      pushPending(cid, diffs);
    }

    // ───────── 提示词：让 char 知道自己的名片和用户的改动 ─────────
    ctx.pipe.rewrite("prompt.hint", function (p) {
      if (p.isGroup || !p.characterId) return p;
      const cid = p.characterId;
      const c = getCard(cid);
      const L = [];
      if (c.remark) L.push("用户给你设的备注：「" + c.remark + "」");
      FIELDS.forEach(function (f) { if (c[f[0]]) L.push(f[1] + "：" + c[f[0]] + (c.priv[f[0]] ? "（仅自己可见）" : "")); });
      if (c.photos.length) L.push("精选照片：" + c.photos.length + " 张");
      const pend = kvGet("pending:" + cid, []);
      let tail = "";
      if (pend.length) {
        const s = pend.map(function (d) {
          return d.from ? d.label + "（" + d.from + " → " + d.to + "）" : d.label + "：" + d.to;
        }).join("；");
        tail = "\n用户最近改了你名片上的这些：" + s + "。你已经知道了。" +
          (pref("notifyMention", true)
            ? "可以顺口自然地提一嘴（调侃/好奇/随口一句都行），不是什么大事，别郑重其事；也可以不提。"
            : "这不是大事，你知道就行，不用主动提起。");
        injected[cid] = true;
      }
      if (!L.length && !tail) return p;
      p.hint = String(p.hint || "") + "\n\n【你的QQ名片】（用户点你头像就能看到，内容是你自己的资料，言行要与之一致）\n" + L.join("\n") + tail;
      return p;
    }, { order: 120 });

    // char 回复落库后，才算“说过/知道过”这批改动
    ctx.watch("row.saved", function (p) {
      const m = (p && p.message) || p || {};
      if (m.role !== "assistant") return;
      const th = ctx.threads.get(m.sessionId || cur.sid || "");
      const cid = th && th.characterId;
      if (cid && injected[cid]) {
        injected[cid] = false;
        ctx.kit.kv.set("pending:" + cid, []);
      }
    });

    // ───────── 一次性调用 API：char 填/改资料 + 挑图 ─────────
    async function sessionFor(cid) {
      if (cur.sid) {
        const t = ctx.threads.get(cur.sid);
        if (t && t.characterId === cid) return cur.sid;
      }
      const L = await A(ctx.threads.list());
      const t2 = (L || []).find(function (x) { return !x.isGroup && x.characterId === cid; });
      return t2 ? t2.id : "";
    }

    async function aiFill(cid) {
      if (busy[cid]) return -1;
      busy[cid] = 1;
      try {
        const p = ctx.personas.get(cid) || {};
        const c = getCard(cid);
        const sid = await sessionFor(cid);
        const rows = sid ? (await A(ctx.rows.list(sid))) || [] : [];
        const N = Math.max(10, Number(pref("historyN", 60)) || 60);
        const nameOf = function (m) { return m.role === "user" ? "用户" : (p.name || "TA"); };
        const txt = function (m) {
          const t = String(m.content || "").replace(/\s+/g, " ").trim();
          if (m.mediaType && m.mediaType !== "text") return "[" + m.mediaType + "]" + (t ? " " + t.slice(0, 60) : "");
          return t.slice(0, 120);
        };
        const recent = rows.filter(function (m) { return m.role !== "system"; }).slice(-N)
          .map(function (m) { return nameOf(m) + "：" + txt(m); }).join("\n");

        const span = Math.max(1, Number(pref("photoDays", 60)) || 60) * DAY;
        const used = {};
        c.photos.forEach(function (x) { if (x.mid) used[x.mid] = 1; });
        const cands = [];
        rows.forEach(function (m, i) {
          if (m.mediaType !== "image" || used[m.id]) return;
          const ts = msgTs(m);
          if (ts && Date.now() - ts > span) return;
          const near = [rows[i - 1], rows[i + 1]].filter(function (x) { return x && x.mediaType !== "image" && x.content; })
            .map(function (x) { return nameOf(x) + "：" + txt(x); }).join(" / ");
          cands.push({ m: m, ts: ts, near: near });
        });
        const use = cands.slice(-12);
        use.forEach(function (x, i) { x.id = "c" + (i + 1); });

        const cur0 = {};
        FIELDS.forEach(function (f) { cur0[f[0]] = c[f[0]] || ""; });
        const max = Math.max(1, Number(pref("photoMax", 8)) || 8);

        const prompt = [
          "角色名：" + (p.name || "TA"),
          "人设：" + String(p.summary || "（未填写）"),
          "今天：" + ymd(Date.now()),
          c.remark ? "用户给你的备注：" + c.remark : "",
          "当前名片：" + JSON.stringify(cur0),
          "已有精选照片（by=char 是你自己放的，可撤下；by=user 是用户放的，不要动）：",
          c.photos.length ? c.photos.map(function (x) { return x.id + " | by=" + x.by + " | " + ymd(x.t) + " | " + (x.note || ""); }).join("\n") : "（无）",
          "近期聊天里出现过的图片（候选）：",
          use.length ? use.map(function (x) { return x.id + " | " + nameOf(x.m) + "发的 | " + (x.ts ? ymd(x.ts) : "近期") + " | 前后文：" + (x.near || "无"); }).join("\n") : "（无）",
          "最近聊天记录（旧→新）：",
          recent || "（暂无）",
          "",
          "任务：以这个角色本人的身份，一次性把自己的 QQ 名片填好/更新。",
          "规则：",
          "1. 像真人填 QQ 资料一样：大多数人只填性别、年龄、生日、个性签名这几项；其余项不想填就不要写进 fields（不写＝留空）。没必要每项都填。资料要符合人设，贴合近期聊天里的状态。",
          "1b. 公司栏会挂在主页，所以有些人拿来挂名：填自己喜欢的人/角色的名字，或两三个字、有点装的短文案（别写真实公司全名）。想填再填。",
          "2. 个性签名 ≤20 字，像真人随手写的；个人说明 ≤60 字；不要出现“AI”“角色”“人设”这类词。",
          "3. 生日、性别、故乡这类基本不会变的，当前已有就保持原样；生日格式“9月27日”；年龄只写数字。",
          "4. 照片要少而精：addPhotos 最多 2 张，只从候选里选真的会拿来当精选的；keepPhotos 写你仍想留着的“by=char”照片 id，没写进去的就是你忘了/不想留了；总数不超过 " + max + " 张。",
          "5. cover 填候选 id＝把它换成名片背景；填 \"keep\"＝不动；填 \"clear\"＝撤掉背景。",
          "只输出一个 JSON：",
          "6. fields 可用的键：nickname sign gender age birthday location hometown tags job company email bio，只写你想填的；private 写你想设成“仅自己可见”的键。",
          '{"fields":{"gender":"","age":"","birthday":"","sign":"","company":""},"private":[],"keepPhotos":[],"addPhotos":[],"cover":"keep"}',
        ].filter(Boolean).join("\n");

        const r = await ctx.model.ask({
          system: "你是 QQ 名片资料生成器。只输出一个 JSON 对象，不要解释，不要代码围栏。",
          prompt: prompt, temperature: 0.9, maxTokens: 900,
        });
        const out = parseJSON(typeof r === "string" ? r : (r && (r.text || r.content)) || "");
        if (!out) { ctx.ui.toast("TA 没填好，稍后再试"); return -2; }

        const fresh = getCard(cid);
        const diffs = [];
        FIELDS.forEach(function (f) {
          const k = f[0];
          const v = out.fields && typeof out.fields[k] === "string" ? out.fields[k].trim().slice(0, k === "bio" ? 80 : 30) : null;
          if (v === null) return;
          if (v !== fresh[k]) { diffs.push({ k: k, label: f[1], from: fresh[k], to: v }); fresh[k] = v; }
        });

        if (Array.isArray(out.private)) {
          out.private.forEach(function (k) { if (FIELDS.some(function (f) { return f[0] === k; })) fresh.priv[k] = true; });
        }
        let photos = fresh.photos.slice();
        const before = photos.length;
        if (Array.isArray(out.keepPhotos)) {
          const keep = {};
          out.keepPhotos.forEach(function (i) { keep[String(i)] = 1; });
          photos = photos.filter(function (x) { return x.by !== "char" || keep[x.id]; });
        }
        const removed = before - photos.length;
        let added = 0;
        const adds = Array.isArray(out.addPhotos) ? out.addPhotos.slice(0, 2) : [];
        for (let i = 0; i < adds.length; i++) {
          const cd = use.find(function (x) { return x.id === String(adds[i]); });
          if (!cd) continue;
          try {
            const raw = await toDataURL(await A(ctx.rows.media(cd.m)));
            const src = await shrink(raw, 480, 0.72);
            if (src) {
              photos.push({ id: "p" + Date.now() + i, src: src, by: "char", t: Date.now(), mid: cd.m.id, note: String(cd.near || "").slice(0, 80) });
              added++;
            }
          } catch (e) { /* 取图失败就跳过 */ }
        }
        while (photos.length > max) {
          const i = photos.findIndex(function (x) { return x.by === "char"; });
          photos.splice(i >= 0 ? i : 0, 1);
        }
        if (added || removed) {
          fresh.photos = photos;
          diffs.push({ k: "photos", label: "精选照片", from: "", to: "+" + added + " / -" + removed });
        }

        if (out.cover && out.cover !== "keep" && fresh.coverBy !== "user") {
          if (out.cover === "clear" && fresh.cover) {
            fresh.cover = ""; fresh.coverBy = "";
            diffs.push({ k: "cover", label: "名片背景", from: "", to: "撤掉了" });
          } else {
            const cd2 = use.find(function (x) { return x.id === String(out.cover); });
            if (cd2) {
              try {
                const raw2 = await toDataURL(await A(ctx.rows.media(cd2.m)));
                const src2 = await shrink(raw2, 900, 0.75);
                if (src2) {
                  fresh.cover = src2; fresh.coverBy = "char";
                  diffs.push({ k: "cover", label: "名片背景", from: "", to: "换了新的" });
                }
              } catch (e) { /* ignore */ }
            }
          }
        }

        fresh.lastAuto = Date.now();
        pushLog(fresh, diffs, "char");
        saveCard(cid, fresh);
        return diffs.length;
      } catch (e) {
        ctx.kit.log("aiFill error", String(e && e.message || e));
        return -2;
      } finally {
        busy[cid] = 0;
      }
    }

    async function maybeAuto(sid) {
      if (!pref("autoEdit", true)) return;
      const th = ctx.threads.get(sid);
      if (!th || th.isGroup || !th.characterId) return;
      const cid = th.characterId;
      const c = getCard(cid);
      if (!c.lastAuto) { c.lastAuto = Date.now(); saveCard(cid, c); return; } // 首次只起算，不烧 API
      const iv = Math.max(1, Number(pref("intervalDays", 180)) || 180) * DAY;
      if (Date.now() - c.lastAuto < iv) return;
      await aiFill(cid);
    }

    // ───────── 聊天页：备注显示 + 点头像 ─────────
    async function refreshMaps() {
      try {
        const L = (await A(ctx.personas.list())) || [];
        const rm = new Map(), am = new Map(), nm = new Map();
        L.forEach(function (pp) {
          const c = getCard(pp.id);
          if (c.remark && pp.name) rm.set(pp.name, c.remark);
          if (pp.name) nm.set(pp.name, pp.id);
          if (c.remark) nm.set(c.remark, pp.id);
          if (pp.avatar) {
            am.set(String(pp.avatar), pp.id);
            try { am.set(new URL(String(pp.avatar), location.href).href, pp.id); } catch (e) { /* ignore */ }
          }
        });
        remarkMap = rm; avatarMap = am; nameMap = nm;
        applyRemarks(document.body);
      } catch (e) { /* ignore */ }
    }
    const NAME_SEL = ".chat-msg-name,.chat-row-title-text,.chat-thread-center h2,.chat-qq-quote-name";
    function applyRemarks(root) {
      if (!pref("remarkInChat", true) || !remarkMap.size || !root || !root.querySelectorAll) return;
      root.querySelectorAll(NAME_SEL).forEach(function (el) {
        if (el.closest(".qqc")) return;
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = w.nextNode())) {
          const t = n.nodeValue.trim();
          if (t && remarkMap.has(t)) n.nodeValue = n.nodeValue.replace(t, remarkMap.get(t));
        }
      });
    }
    const mo = new MutationObserver(function () {
      if (rafFlag) return;
      rafFlag = true;
      requestAnimationFrame(function () { rafFlag = false; applyRemarks(document.body); scrapeAvatar(); });
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });

    function cidFromEl(el) {
      for (let i = 0; i < 3 && el; i++, el = el.parentElement) {
        if (el.tagName === "IMG") {
          const a = avatarMap.get(el.currentSrc || el.src) || avatarMap.get(el.getAttribute("src") || "");
          if (a) return { cid: a, el: el };
        }
        const bg = getComputedStyle(el).backgroundImage;
        if (bg && bg.indexOf("url(") >= 0) {
          const m = bg.match(/url\(["']?(.*?)["']?\)/);
          if (m && avatarMap.get(m[1])) return { cid: avatarMap.get(m[1]), el: el };
        }
      }
      return null;
    }
    function chatAvatarCid(t) {
      const ava = t.closest(".chat-msg.is-them .chat-ava");
      if (!ava) return "";
      const th = ctx.threads.get(cur.sid || "");
      if (th && !th.isGroup && th.characterId) return th.characterId;
      const msgEl = ava.closest(".chat-msg");
      const nmEl = msgEl && msgEl.querySelector(".chat-msg-name");
      const name = nmEl ? nmEl.textContent.trim() : "";
      return name ? (nameMap.get(name) || "") : "";
    }
    function onClick(e) {
      if (!pref("avatarClick", true)) return;
      const t = e.target;
      if (!t || !t.closest || t.closest(".qqc")) return;
      let hitId = chatAvatarCid(t);
      if (!hitId && avatarMap.size) {
        const hit = cidFromEl(t);
        if (hit) {
          const r = hit.el.getBoundingClientRect();
          if (r.width <= 72 && r.width >= 16) hitId = hit.cid;
        }
      }
      if (!hitId) return;
      e.preventDefault();
      e.stopPropagation();
      const avaEl = t.closest(".chat-ava");
      A(avaEl ? grabAvatar(avaEl, hitId) : null).then(function () { openCard(hitId); }, function () { openCard(hitId); });
    }
    document.addEventListener("click", onClick, true);

    function grabAvatar(ava, cid0) {
      if (!ava || !cid0) return Promise.resolve();
      let src = "";
      const im = ava.tagName === "IMG" ? ava : ava.querySelector("img");
      if (im) src = im.currentSrc || im.src || "";
      if (!src) {
        const els = [ava].concat(Array.prototype.slice.call(ava.querySelectorAll("*")));
        for (let i = 0; i < els.length && !src; i++) {
          const bg = getComputedStyle(els[i]).backgroundImage;
          const m = bg && bg.match(/url\(["']?(.*?)["']?\)/);
          if (m) src = m[1];
        }
      }
      if (!src) return Promise.resolve();
      const holder = ava.closest(".chat-ava") || ava;
      const shape = /is-shape-square/.test(holder.className) ? "square" : "circle";
      const sig = src.length + ":" + src.slice(0, 100) + src.slice(-40) + shape;
      const old = kvGet("ava:" + cid0, null);
      if (old && old.sig === sig) return Promise.resolve();
      const job = /^(blob:|data:)/.test(src) ? shrink(src, 200, 0.85) : Promise.resolve(src);
      return job.then(function (out) {
        if (out) ctx.kit.kv.set("ava:" + cid0, { src: out, sig: sig, shape: shape });
      });
    }
    function scrapeAvatar() {
      const th = ctx.threads.get(cur.sid || "");
      if (!th || th.isGroup || !th.characterId) return;
      const all = document.querySelectorAll(".chat-msg.is-them .chat-ava");
      if (all.length) grabAvatar(all[all.length - 1], th.characterId);
    }

    function openCard(cid) {
      ctx.kit.kv.set("viewing", cid);
      ctx.os.open("extapp:" + ID);
    }

    ctx.ui.bubbleMenu({
      id: "qqcard",
      label: "查看名片",
      filter: function (msg) { return !!msg && msg.role === "assistant"; },
      onSelect: function (msg) {
        const th = ctx.threads.get(msg.sessionId || cur.sid || "");
        const cid = msg.characterId || (th && th.characterId);
        if (cid) openCard(cid);
      },
    });

    ctx.watch("thread.open", function (p) {
      cur.sid = p.sessionId || "";
      refreshMaps();
      setTimeout(scrapeAvatar, 800);
      if (!p.isGroup) maybeAuto(p.sessionId).catch(function () {});
    });
    ctx.watch("host.up", function () { refreshMaps(); });
    refreshMaps();

    // ───────── 名片 App ─────────
    function waitFor(test, cb, tries, fail) {
      let n = 0;
      (function tick() {
        const r = test();
        if (r) return cb(r);
        if (++n < (tries || 30)) setTimeout(tick, 100);
        else if (fail) fail();
      })();
    }
    function restoreThread(cid, sid) {
      const pp = ctx.personas.get(cid) || {};
      const th = sid ? ctx.threads.get(sid) : null;
      const names = [pp.name, th && th.title, getCard(cid).remark].filter(Boolean);
      waitFor(function () {
        if (document.querySelector(".chat-thread-top")) return "done";
        const ts = document.querySelectorAll(".chat-row-title-text");
        for (let i = 0; i < ts.length; i++) {
          if (names.indexOf(ts[i].textContent.trim()) >= 0) return ts[i].closest(".chat-row") || ts[i];
        }
        return null;
      }, function (r) { if (r !== "done") r.click(); }, 30);
    }
    async function fallbackSpace() {
      const t = String(pref("spaceTarget", "") || "").trim();
      try {
        const apps = (await A(ctx.os.apps())) || [];
        const hit = apps.find(function (a) { return a.id === t; }) ||
          apps.find(function (a) { return /朋友圈|动态/.test(a.name || ""); });
        ctx.os.open(hit ? hit.id : (t || "moments"));
      } catch (e) {
        ctx.ui.toast("没跳到空间，请从聊天页底部「朋友圈」进入");
      }
    }
    function openSpace(close) {
      try { close(); } catch (e) { /* ignore */ }
      ctx.os.open("chat");
      let backed = false;
      waitFor(function () {
        const bs = document.querySelectorAll(".chat-tabdock button");
        for (let i = 0; i < bs.length; i++) if (/朋友圈/.test(bs[i].textContent)) return bs[i];
        const back = document.querySelector(".chat-thread-top .chat-back");
        if (back && !backed) { backed = true; back.click(); }
        return null;
      }, function (b) { b.click(); }, 40, fallbackSpace);
    }
    function avatarEl(pp, name, cls, cid0) {
      const st = cid0 ? kvGet("ava:" + cid0, null) : null;
      const src = (st && st.src) || pp.avatar;
      if (src) {
        const im = h("img", { cls: cls || "av", src: src });
        if (st && st.src && st.shape === "square") im.style.borderRadius = "22%";
        return im;
      }
      let n = 0;
      String(name || "").split("").forEach(function (ch) { n = (n * 31 + ch.charCodeAt(0)) % 360; });
      return h("div", { cls: (cls || "av") + " lt", text: String(name || "?").slice(0, 1), css: "background:hsl(" + n + ",40%,42%)" });
    }

    function mount(el, close) {
      function leave() {
        const sid = cur.sid, c0 = cid;
        try { close(); } catch (e) { /* ignore */ }
        ctx.os.open("chat");
        restoreThread(c0, sid);
      }
      el.innerHTML = "";
      el.appendChild(h("style", { text: CSS }));
      const root = h("div", { cls: "qqc" });
      el.appendChild(root);
      let cid = String(kvGet("viewing", "") || "");
      ctx.kit.kv.set("viewing", "");
      let view = cid ? "card" : "pick";

      function go(v) { view = v; draw(); }
      function draw() {
        root.innerHTML = "";
        root.scrollTop = 0;
        ({ pick: vPick, card: vCard, edit: vEdit, set: vSet })[view]();
      }
      function pickFile(multi, cb) {
        const inp = document.createElement("input");
        inp.type = "file"; inp.accept = "image/*"; inp.multiple = !!multi;
        inp.onchange = function () { cb(Array.prototype.slice.call(inp.files || [])); };
        inp.click();
      }
      function readFile(f, max, q) {
        return toDataURL(f).then(function (d) { return shrink(d, max, q); });
      }
      function nav(title, left, right) {
        return h("div", { cls: "nav" }, [left, h("span", { text: title }), right || h("span", { css: "width:36px" })]);
      }
      function backBtn(fn) { return h("button", { cls: "tb", text: "‹", onclick: fn }); }
      function frow(label, input) { return h("div", { cls: "fi" }, [h("label", { text: label }), input]); }

      // 选角色（从桌面图标进来时）
      async function vPick() {
        root.appendChild(nav("选择名片", backBtn(function () { close(); })));
        const L = (await A(ctx.threads.list())) || [];
        const seen = {};
        let n = 0;
        L.forEach(function (t) {
          if (t.isGroup || !t.characterId || seen[t.characterId]) return;
          seen[t.characterId] = 1;
          const pp = ctx.personas.get(t.characterId) || {};
          const c = getCard(t.characterId);
          n++;
          root.appendChild(h("div", { cls: "pk", onclick: function () { cid = t.characterId; go("card"); } }, [
            avatarEl(pp, c.remark || pp.name, "pa", t.characterId),
            h("div", {}, [h("div", { text: c.remark || pp.name || t.title || "未命名" }), h("div", { cls: "sub", text: c.sign || "" })]),
          ]));
        });
        if (!n) root.appendChild(h("div", { cls: "tip", css: "padding:20px", text: "还没有单聊角色。" }));
      }

      function vCard() {
        const pp = ctx.personas.get(cid) || {};
        const c = getCard(cid);
        const V = function (k) { return c.priv[k] ? "" : c[k]; };
        const big = c.remark || V("nickname") || pp.name || "未命名";
        const cover = h("div", { cls: "cover" }, [
          h("div", { cls: "bar" }, [
            h("button", { cls: "rb", text: "‹", onclick: leave }),
            h("button", { cls: "rb", text: "⚙", onclick: function () { go("set"); } }),
          ]),
        ]);
        if (c.cover) cover.style.backgroundImage = 'url("' + c.cover + '")';

        const nick = V("nickname") || pp.name || "";
        const head = h("div", { cls: "head" }, [
          avatarEl(pp, big, null, cid),
          h("div", { css: "min-width:0" }, [
            h("div", { cls: "nm", text: big }),
            c.remark && nick ? h("div", { cls: "sub", text: "昵称: " + nick }) : null,
            c.qq ? h("div", { cls: "sub", text: "QQ: " + c.qq }) : null,
          ]),
        ]);

        const ageV = V("age");
        const age = ageV ? (/^\d+$/.test(ageV) ? ageV + "岁" : ageV) : "";
        const l1 = [V("gender"), age, V("birthday"), V("location") ? "现居" + V("location") : "", V("hometown") ? "来自" + V("hometown") : ""].filter(Boolean).join(" | ");
        const l2 = [V("company"), V("job")].filter(Boolean).join(" | ");
        function row(text, muted, fn) {
          return h("div", { cls: "row", onclick: fn }, [
            h("span", { cls: muted ? "m" : "", text: text }),
            h("span", { cls: "c", text: "›" }),
          ]);
        }
        const toEdit = function () { go("edit"); };

        const panel = h("div", { cls: "panel" }, [
          head,
          row(V("sign") || "还没有个性签名", !V("sign"), toEdit),
          l1 ? row(l1, false, toEdit) : null,
          l2 ? row(l2, false, toEdit) : null,
          V("tags") ? row("兴趣：" + V("tags"), false, toEdit) : null,
          V("bio") ? row(V("bio"), true, toEdit) : null,
          h("div", { cls: "row", css: "margin-top:10px", onclick: function () { openSpace(close); } }, [
            h("span", { css: "font-weight:700;font-size:15px", text: "TA的QQ空间" }),
            h("span", { cls: "c", text: "›" }),
          ]),
        ]);

        // 精选照片
        let manage = false;
        const phWrap = h("div", { cls: "ph" });
        const secLink = h("button", { cls: "lk", text: "管理" });
        function drawPhotos() {
          phWrap.innerHTML = "";
          const cc = getCard(cid);
          cc.photos.forEach(function (x) {
            const t = h("button", { cls: "t", onclick: function () { if (!manage) viewer(x.src); } });
            t.style.backgroundImage = 'url("' + x.src + '")';
            if (manage) {
              t.appendChild(h("button", {
                cls: "x", text: "×",
                onclick: function (ev) {
                  ev.stopPropagation();
                  const c2 = getCard(cid);
                  c2.photos = c2.photos.filter(function (y) { return y.id !== x.id; });
                  saveCard(cid, c2);
                  photoChanged(cid, "撤下了 1 张");
                  drawPhotos();
                },
              }));
            }
            phWrap.appendChild(t);
          });
          phWrap.appendChild(h("button", {
            cls: "t plus", text: "+",
            onclick: function () {
              pickFile(true, function (files) {
                Promise.all(files.map(function (f) { return readFile(f, 480, 0.72); })).then(function (arr) {
                  const c2 = getCard(cid);
                  let n = 0;
                  arr.forEach(function (src, i) {
                    if (!src || c2.photos.length >= 24) return;
                    c2.photos.push({ id: "p" + Date.now() + i, src: src, by: "user", t: Date.now(), note: "" });
                    n++;
                  });
                  if (n) { saveCard(cid, c2); photoChanged(cid, "上传了 " + n + " 张"); drawPhotos(); }
                });
              });
            },
          }));
          secLink.textContent = manage ? "完成" : "管理";
        }
        secLink.onclick = function () { manage = !manage; drawPhotos(); };
        panel.appendChild(h("div", { cls: "sec" }, [h("span", { text: "精选照片" }), secLink]));
        panel.appendChild(phWrap);
        drawPhotos();
        if (c.lastAuto) panel.appendChild(h("div", { cls: "tip", text: "TA 上次更新资料：" + ymd(c.lastAuto) }));

        const bottom = h("div", { cls: "bottom" }, [
          h("button", { cls: "btn", text: "音视频通话", onclick: function () { ctx.ui.toast("请回聊天页顶栏发起通话"); } }),
          h("button", { cls: "btn", text: "编辑资料", onclick: toEdit }),
          h("button", { cls: "btn pri", text: "发消息", onclick: leave }),
        ]);
        root.appendChild(cover);
        root.appendChild(panel);
        root.appendChild(bottom);
      }

      function viewer(src) {
        const v = h("div", { cls: "vw", onclick: function () { v.remove(); } }, [h("img", { src: src })]);
        root.appendChild(v);
      }

      function vEdit() {
        const c = getCard(cid);
        const draft = {};
        FIELDS.forEach(function (f) { draft[f[0]] = c[f[0]]; });
        draft.qq = c.qq;
        draft.cover = c.cover;
        draft.priv = Object.assign({}, c.priv);

        const save = h("button", {
          cls: "sv", text: "保存",
          onclick: function () {
            const n = commit(cid, draft);
            ctx.ui.toast(n ? "已保存" : "没有改动");
            go("card");
          },
        });
        root.appendChild(nav("编辑资料", backBtn(function () { go("card"); }), save));

        const coverPrev = h("div", { css: "height:90px;border-radius:10px;background:var(--bg) center/cover no-repeat;flex:1" });
        function showCover() { coverPrev.style.backgroundImage = draft.cover ? 'url("' + draft.cover + '")' : "none"; }
        showCover();
        root.appendChild(h("div", { cls: "f" }, [
          h("div", { cls: "fi" }, [
            h("label", { text: "名片背景" }), coverPrev,
            h("div", { css: "display:flex;flex-direction:column;gap:8px" }, [
              h("button", { text: "上传", css: "background:none;border:0;color:#6a8fd8", onclick: function () {
                pickFile(false, function (fs) { if (fs[0]) readFile(fs[0], 900, 0.75).then(function (s) { if (s) { draft.cover = s; showCover(); } }); });
              } }),
              h("button", { text: "移除", css: "background:none;border:0;color:var(--tx2)", onclick: function () { draft.cover = ""; showCover(); } }),
            ]),
          ]),
        ]));

        const form = h("div", { cls: "f" }, []);
        form.appendChild(frow("QQ号", h("input", { type: "text", value: draft.qq || "", placeholder: "仅展示", oninput: function () { draft.qq = this.value.trim(); } })));
        FIELDS.forEach(function (f) {
          const k = f[0];
          const inp = f[2] === "area"
            ? h("textarea", { placeholder: "未填写", value: draft[k] || "", oninput: function () { draft[k] = this.value.trim(); } })
            : h("input", { type: "text", placeholder: "未填写", value: draft[k] || "", oninput: function () { draft[k] = this.value.trim(); } });
          const chip = h("button", { cls: "vz", type: "button" });
          const paint = function () { chip.textContent = draft.priv[k] ? "仅自己" : "公开"; chip.className = "vz" + (draft.priv[k] ? "" : " on"); };
          chip.onclick = function () { draft.priv[k] = !draft.priv[k]; paint(); };
          paint();
          const rowEl = frow(f[1], inp);
          rowEl.appendChild(chip);
          form.appendChild(rowEl);
        });
        root.appendChild(form);

        root.appendChild(h("button", {
          cls: "ghost", text: "让 TA 自己来填 / 更新一次（调用 API）",
          onclick: function () {
            if (busy[cid]) return ctx.ui.toast("TA 正在填…");
            const tk = ctx.ui.toast("TA 正在填写名片…", { durationMs: 0 });
            aiFill(cid).then(function (n) {
              if (tk && tk.close) tk.close();
              if (n >= 0) { ctx.ui.toast(n ? "TA 更新了 " + n + " 处" : "TA 看了看，没改什么"); go("card"); }
            });
          },
        }));
        root.appendChild(h("div", { cls: "tip", css: "padding:0 20px 100px", text: "每项右边可切换「公开 / 仅自己」，设为仅自己后名片页不显示。你保存的改动 TA 都会知道。TA 自己的修改间隔在插件设置里调。" }));
      }

      function vSet() {
        const c = getCard(cid);
        const d = { remark: c.remark, group: c.group, intimate: c.intimate, star: c.star, dnd: c.dnd, black: c.black };
        const save = h("button", {
          cls: "sv", text: "保存",
          onclick: function () {
            const n = commit(cid, d);
            ctx.ui.toast(n ? "已保存" : "没有改动");
            go("card");
          },
        });
        root.appendChild(nav("设置", backBtn(function () { go("card"); }), save));
        function sw(key) {
          return h("input", { type: "checkbox", cls: "sw", checked: d[key], onchange: function () { d[key] = this.checked; } });
        }
        function tx(key, ph) {
          return h("input", { type: "text", value: d[key] || "", placeholder: ph || "", oninput: function () { d[key] = this.value.trim(); } });
        }
        root.appendChild(h("div", { cls: "f" }, [frow("备注", tx("remark", "聊天里会显示这个名字")), frow("分组", tx("group", "例如：可爱的网友们"))]));
        root.appendChild(h("div", { cls: "f" }, [
          frow("特别关心", sw("star")),
          frow("亲密关系", tx("intimate", "例如：互为闺蜜")),
          frow("好友消息免打扰", sw("dnd")),
          frow("加入黑名单", sw("black")),
        ]));
        root.appendChild(h("div", { cls: "tip", css: "padding:0 20px", text: "备注会替换聊天页里 TA 的名字（需要时刷新一下）。特别关心/免打扰/黑名单只是展示，不影响聊天。" }));
      }

      draw();
    }

    ctx.ui.appPage(mount);

    return function () {
      try { mo.disconnect(); } catch (e) { /* ignore */ }
      document.removeEventListener("click", onClick, true);
    };
  },
};
