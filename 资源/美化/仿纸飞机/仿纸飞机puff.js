/* 仿纸飞机by哦，禁二传可二改 */
// Puff apiVersion 1。只使用公开 ctx 接口和自己的插槽节点，不改聊天存档。
// 时间和群成员字段缺失时保守降级。
const TIME_FIELDS = ["createdAt", "timestamp", "time", "created_at", "ts"];
const SPEAKER_FIELDS = ["senderCharacterId", "senderId", "characterId", "senderName"];
const GAP = 121000;
const CHECK_ONE = '<svg width="13" height="11" viewBox="0 0 13 11" fill="none" aria-hidden="true"><path d="M0.750003 7.05749L3.64474 9.75001L11.75 0.750006" stroke="#2FA102" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK_TWO = '<svg width="19" height="11" viewBox="0 0 19 11" fill="none" aria-hidden="true"><path d="M0.750003 7.05749L3.64474 9.75001L11.75 0.75001" stroke="#2FA102" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.75 8.40001L9.86177 9.75001L17.75 0.75001" stroke="#2FA102" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function valueAt(object, path) {
  if (!path || !/^[\w.]+$/.test(path)) return undefined;
  return path.split(".").reduce((value, key) =>
    value && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined, object);
}
function dateValue(value) {
  if (value == null || value === "" || typeof value === "boolean") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const numeric = typeof value === "number" || /^\d{10,13}$/.test(value);
  const raw = numeric ? Number(value) : value;
  const ms = numeric && raw > 0 && raw < 1e11 ? raw * 1000 : raw;
  const date = new Date(ms);
  return Number.isFinite(date.getTime()) ? date : null;
}
function ordinary(message) {
  return !!message && ["user", "assistant"].includes(message.role)
    && (!message.mediaType || message.mediaType === "text")
    && !message.mediaUrl && typeof message.content === "string" && !!message.content.trim()
    && !message.recalled && !message.isRecalled && !message.deleted && !message.isDeleted;
}
function day(date) { return date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : ""; }

export default {
  manifest: {
    id: "puff-paperplane-combined",
    name: "Puff 仿纸飞机聊天",
    engine: "puff",
    apiVersion: 1,
    version: "1.3.0",
    author: "哦",
    description: "配合纸飞机 CSS，显示时间、回复状态和连续消息分组。不修改消息内容。",
    settings: [
      { key: "showTime", label: "显示消息时间", type: "boolean", default: true },
      { key: "showChecks", label: "显示单双勾", type: "boolean", default: true,
        description: "单勾表示已保存；双勾表示此消息后已有角色发言，不代表真人已读。" },
      { key: "groupMessages", label: "连续普通文字分组", type: "boolean", default: true,
        description: "相邻、同发送者、同一天且间隔不超过121秒；缺少时间或群成员身份时不合并。" },
      { key: "timeField", label: "消息时间字段（留空自动识别）", type: "text", default: "",
        description: "自动尝试 createdAt、timestamp、time、created_at、ts。缺失时保留原生时间。" },
      { key: "speakerField", label: "群成员身份字段（留空自动识别）", type: "text", default: "",
        description: "仅影响群聊连续消息分组，支持例如 sender.id 的字段路径。" }
    ]
  },
  setup(ctx) {
    const views = new Map();
    const releases = [];
    let stopped = false;
    let queued = false;
    let scheduledOff = null;
    const pref = (key, fallback) => ctx.kit.prefs.get(key) ?? fallback;
    const keep = off => { if (typeof off === "function") releases.push(off); };

    function timeOf(message) {
      const explicit = String(pref("timeField", "")).trim();
      for (const key of explicit ? [explicit] : TIME_FIELDS) {
        const date = dateValue(valueAt(message, key));
        if (date) return date;
      }
      return null;
    }
    function speakerOf(message, isGroup) {
      if (message.role === "user") return "user";
      if (!isGroup) return "assistant";
      const explicit = String(pref("speakerField", "")).trim();
      for (const key of explicit ? [explicit] : SPEAKER_FIELDS) {
        const value = valueAt(message, key);
        if (["string", "number"].includes(typeof value) && String(value).trim()) {
          return `assistant:${key}:${value}`;
        }
      }
      return null;
    }
    function indexSession(sid, isGroup) {
      const rows = ctx.rows.list(sid);
      const index = new Map();
      if (!Array.isArray(rows)) return index;
      let pending = [];
      let run = [];
      const finish = () => {
        run.forEach((entry, i) => {
          entry.group = run.length === 1 ? "single" : i === 0 ? "first" : i === run.length - 1 ? "last" : "middle";
        });
        run = [];
      };
      for (const message of rows) {
        if (!message || (message.sessionId && message.sessionId !== sid)) { finish(); continue; }
        // 只有实际角色消息确认此前的我方消息；不把心声/日记等模型请求当作聊天回复。
        if (message.role === "assistant" && !message.recalled && !message.isRecalled && !message.deleted && !message.isDeleted) {
          pending.forEach(entry => { entry.status = "double"; });
          pending = [];
        }
        if (message.id == null) { finish(); continue; }
        const entry = {
          message, kind: ordinary(message) ? "text" : "special",
          date: timeOf(message), speaker: speakerOf(message, isGroup),
          group: "single", status: "single"
        };
        index.set(String(message.id), entry);
        if (entry.kind !== "text") { finish(); continue; }
        if (message.role === "user") pending.push(entry);
        const previous = run[run.length - 1];
        const delta = previous?.date && entry.date ? entry.date - previous.date : NaN;
        if (!pref("groupMessages", true) || !previous || !entry.speaker || previous.speaker !== entry.speaker
          || !entry.date || !previous.date || day(entry.date) !== day(previous.date)
          || !Number.isFinite(delta) || delta < 0 || delta > GAP) finish();
        run.push(entry);
      }
      finish();
      return index;
    }
    function draw(view, entry) {
      const { anchor, meta, time, checks } = view;
      const message = entry?.message || view.message;
      const isText = entry?.kind === "text" || (!entry && ordinary(message));
      const date = entry?.date || timeOf(message);
      const showTime = isText && pref("showTime", true) && !!date;
      const showChecks = isText && message.role === "user" && pref("showChecks", true);
      const status = entry?.status || "single";
      anchor.dataset.ppKind = isText ? "text" : "special";
      anchor.dataset.ppGroup = isText ? entry?.group || "single" : "single";
      anchor.dataset.ppRole = message.role || "";
      anchor.dataset.ppChat = view.isGroup ? "group" : "direct";
      anchor.dataset.ppTime = showTime ? "1" : "0";
      anchor.dataset.ppStatus = showChecks ? status : "";
      const host = anchor.closest(".chat-swipe-content");
      const name = host?.querySelector(".chat-msg-name-row .chat-msg-name, .chat-msg-name");
      const nameText = name?.textContent?.trim() || "";
      const ownerTitle = view.isGroup && message.role === "user"
        && /群主|群管|管理员|版主|创建者|owner|admin/i.test(nameText);
      // 群聊名字由首条/单条消息承载，双方规则一致；连续消息由 CSS 隐藏重复名字。
      const showGroupName = view.isGroup && isText && !!name
        && ["single", "first"].includes(anchor.dataset.ppGroup);
      anchor.dataset.ppOwnerTitle = ownerTitle ? "1" : "0";
      anchor.dataset.ppName = showGroupName ? "1" : "0";
      meta.hidden = !(showTime || showChecks);
      time.hidden = !showTime;
      checks.hidden = !showChecks;
      if (showTime) {
        time.textContent = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
        time.dateTime = date.toISOString();
      } else { time.textContent = ""; time.removeAttribute("datetime"); }
      if (showChecks) {
        if (checks.dataset.status !== status) {
          checks.innerHTML = status === "double" ? CHECK_TWO : CHECK_ONE;
          checks.dataset.status = status;
        }
        checks.setAttribute("aria-label", status === "double" ? "已有角色回复" : "消息已保存");
        checks.title = status === "double" ? "此消息后已有角色发言（不代表真人已读）" : "消息已保存，等待角色回复";
      } else { checks.replaceChildren(); delete checks.dataset.status; }
    }
    function updateMetaMode(view) {
      const host = view.anchor.closest(".chat-swipe-content");
      const bubble = host?.querySelector(":scope > .chat-bubble");
      const primary = bubble?.querySelector(".chat-bubble-primary");
      if (!primary || view.meta.hidden) {
        delete view.anchor.dataset.ppMetaMode;
        return;
      }
      const style = getComputedStyle(primary);
      const rect = primary.getBoundingClientRect();
      const probe = primary.cloneNode(true);
      probe.removeAttribute("id");
      probe.style.cssText = [
        "position:absolute", "left:-100000px", "top:0", "visibility:hidden",
        "pointer-events:none", "display:block", `width:${rect.width}px`, "max-width:none",
        `font:${style.font}`, `line-height:${style.lineHeight}`, `letter-spacing:${style.letterSpacing}`,
        `white-space:${style.whiteSpace}`, `overflow-wrap:${style.overflowWrap}`,
        `word-break:${style.wordBreak}`, `box-sizing:${style.boxSizing}`,
        `padding:${style.padding}`, `margin:${style.margin}`
      ].join(";");
      document.body.append(probe);
      const textHeight = probe.getBoundingClientRect().height;
      probe.remove();
      // 读取当前实际渲染行的宽度，不能用整段文本的 max-content 宽度，
      // 否则已经换行的长消息会把气泡再次撑到右侧。
      const walker = document.createTreeWalker(primary, NodeFilter.SHOW_TEXT);
      const lines = new Map();
      let node;
      while ((node = walker.nextNode())) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const fragment of range.getClientRects()) {
          if (!fragment.width) continue;
          const key = Math.round(fragment.top * 10) / 10;
          const line = lines.get(key) || { left: fragment.left, right: fragment.right };
          line.left = Math.min(line.left, fragment.left);
          line.right = Math.max(line.right, fragment.right);
          lines.set(key, line);
        }
      }
      const textWidth = lines.size
        ? Math.max(...Array.from(lines.values(), line => line.right - line.left))
        : rect.width;
      // 真实高度比去掉元数据伪元素后的正文高度更高，说明时间/勾已被挤到下一行。
      const wrapped = rect.height > textHeight + 1;
      // 气泡已经顶到消息母区上限时，官方规则是把正文当作第一行，
      // 元数据放到右下角；不能继续把元数据留位算进气泡宽度。
      const body = host?.closest(".chat-msg-body");
      const bodyWidth = body?.getBoundingClientRect().width || 0;
      const maxWidthText = body ? getComputedStyle(body).maxWidth.trim() : "";
      const maxWidth = /^\d+(?:\.\d+)?px$/.test(maxWidthText) ? Number.parseFloat(maxWidthText) : 0;
      const capped = maxWidth > 0 && bodyWidth >= maxWidth - 1;
      const bubbleStyle = bubble ? getComputedStyle(bubble) : null;
      const horizontalPadding = bubbleStyle
        ? Number.parseFloat(bubbleStyle.paddingLeft || 0) + Number.parseFloat(bubbleStyle.paddingRight || 0)
        : 0;
      const metaWidth = view.meta.getBoundingClientRect().width || 0;
      const inlineWidth = textWidth + horizontalPadding + metaWidth + 6;
      const needsBlock = wrapped || capped || (bodyWidth > 0 && inlineWidth > bodyWidth + 1);
      if (needsBlock) {
        view.anchor.dataset.ppMetaMode = "block";
        if (bubble) {
          const targetWidth = Math.min(textWidth + horizontalPadding, bodyWidth || textWidth + horizontalPadding);
          bubble.style.setProperty("--pp-block-width", `${Math.ceil(targetWidth)}px`);
        }
      } else {
        delete view.anchor.dataset.ppMetaMode;
        bubble?.style.removeProperty("--pp-block-width");
      }
    }
    function refresh() {
      queued = false;
      scheduledOff = null;
      if (stopped) return;
      const indexes = new Map();
      for (const [el, view] of views) {
        if (view.anchor.isConnected) view.mounted = true;
        else if (view.mounted) { views.delete(el); continue; }
        if (!indexes.has(view.sid)) {
          indexes.set(view.sid, indexSession(view.sid, view.isGroup));
        }
        const index = indexes.get(view.sid);
        const entry = index.get(String(view.message.id));
        draw(view, entry);
      }
      const measure = () => views.forEach(updateMetaMode);
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(measure);
      else setTimeout(measure, 0);
    }
    function schedule() {
      if (stopped || queued) return;
      queued = true;
      scheduledOff = ctx.kit.later(refresh, 0);
    }

    // 此插槽的位置由 Puff 规定：发言名与正文之间。仅操作传入 el 中的自有节点；1.1 CSS 会把它定位到真实气泡右下角。
    keep(ctx.ui.place("bubble.meta", (el, props = {}) => {
      const old = views.get(el);
      if (old) { old.anchor.remove(); views.delete(el); }
      const message = props.message;
      const sid = props.sessionId || message?.sessionId;
      if (!message || !sid) return;
      const anchor = document.createElement("div");
      anchor.className = "puff-paperplane-anchor";
      const meta = document.createElement("span");
      meta.className = "puff-paperplane-meta";
      const time = document.createElement("time");
      time.className = "puff-paperplane-time";
      const checks = document.createElement("span");
      checks.className = "puff-paperplane-checks";
      checks.setAttribute("role", "img");
      meta.append(time, checks);
      anchor.append(meta);
      el.append(anchor);
      const isGroup = !!props.isGroup || sid.startsWith("group:") || sid.startsWith("group-offline:");
      const view = { anchor, meta, time, checks, sid, isGroup, message, mounted: anchor.isConnected };
      views.set(el, view);
      draw(view, null);
      schedule();
    }));
    // 基本显示样式随插件停用撤回；完整视觉从独立 CSS 导入。
    keep(ctx.ui.css(`
      .puff-paperplane-anchor{font-size:11px;line-height:1.2;min-height:0}
      .puff-paperplane-meta{display:flex;justify-content:flex-end;align-items:center;gap:4px;margin:0 3px 4px;color:#718a9c;font-variant-numeric:tabular-nums}
      .puff-paperplane-checks{display:inline-flex;color:#2fa102}
      .puff-paperplane-checks svg{width:19px;height:14px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
      .puff-paperplane-anchor [hidden]{display:none!important}
    `));
    for (const event of ["host.up", "thread.open", "row.saved", "row.patched", "row.removed", "scripts.tick"]) {
      keep(ctx.watch(event, schedule));
    }
    keep(ctx.kit.prefs.onChange(schedule));
    const onResize = () => schedule();
    window.addEventListener("resize", onResize);
    keep(() => window.removeEventListener("resize", onResize));
    schedule();
    return () => {
      if (stopped) return;
      stopped = true;
      if (typeof scheduledOff === "function") scheduledOff();
      views.forEach(view => view.anchor.remove());
      views.clear();
      releases.reverse().forEach(off => { try { off(); } catch (error) { ctx.kit.log("清理：", error); } });
    };
  }
};
