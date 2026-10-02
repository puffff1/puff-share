const DEFAULT_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = "qwen3-omni-flash";

const DEFAULT_PROMPT = [
  "这里可填写提示词",
].join("\n");

const LABELS = {
  audioType: "类型", summary: "一句话", voiceProfile: "声音", speech: "说了什么",
  singing: "唱功", ambient: "生活背景", environment: "现场环境", emotion: "情绪",
  pace: "语速", pauses: "停顿", prosody: "语调", delivery: "表达方式",
  accompaniment: "伴奏", pitchAccuracy: "音准", rhythm: "节奏", breath: "气息",
  diction: "咬字", voiceQuality: "音色", expressiveness: "表现力", aiUnderstanding: "接话提示",
};
const TYPE_CN = {
  speech: "说话", singing: "唱歌", humming: "哼唱", ambient: "环境声", mixed: "混合", uncertain: "不确定",
};

export default {
  manifest: {
    id: "puff-voice-understand",
    name: "语音理解增强",
    engine: "puff",
    apiVersion: 1,
    version: "1.0.3",
    description: "用户发语音后，用阿里云百炼 Omni 模型听语气、情绪、唱功、声线和背景环境，把听感速记交给角色接话用",
    permissions: ["联网：阿里云百炼（dashscope.aliyuncs.com）", "读取你发出的语音附件"],
    settings: [
      { key: "enabled", label: "开启语音理解", type: "boolean", default: true, description: "未开启或未填 API Key 时，角色只看得到语音转出的文字" },
      { key: "apiKey", label: "百炼 API Key", type: "text", default: "", description: "sk- 开头，在阿里云百炼控制台的 API-KEY 页创建" },
      { key: "baseUrl", label: "兼容模式 Base URL", type: "text", default: DEFAULT_BASE },
      { key: "model", label: "语音理解模型", type: "text", default: DEFAULT_MODEL },
      { key: "prompt", label: "增强分析提示词（可选）", type: "text", default: "", description: "留空 = 用内置提示词；长文建议点下方卡片里的「编辑提示词」" },
      { key: "recent", label: "每次最多带给角色几条语音", type: "number", default: 3 },
      { key: "maxSec", label: "单条最长分析秒数", type: "number", default: 180, description: "超过部分截掉，省额度" },
      { key: "showBubble", label: "语音气泡上显示听感摘要", type: "boolean", default: true },
    ],
  },

  setup(ctx) {
    const pending = new Map();   // msgId -> Promise
    const failed = new Map();    // msgId -> 失败次数
    const bubbleEls = new Map(); // msgId -> Set<HTMLElement>
    let alive = true;

    // ---------- 小工具 ----------
    function pref(key, dflt) {
      const v = ctx.kit.prefs.get(key);
      return v === undefined || v === null || v === "" ? dflt : v;
    }
    function apiKey() { return String(pref("apiKey", "")).trim(); }
    function ready() { return pref("enabled", true) !== false && !!apiKey(); }
    function currentPrompt() { return String(pref("prompt", "")).trim() || DEFAULT_PROMPT; }
    function isVoice(m) {
      return !!m && m.role === "user" && (m.mediaType === "voice" || m.mediaType === "audio");
    }
    function withTimeout(promise, ms) {
      return Promise.race([promise, new Promise(function (r) { setTimeout(function () { r(null); }, ms); })]);
    }

    // ---------- 缓存 ----------
    function getCache(id) { return ctx.kit.kv.get("r:" + id) || null; }
    function setCache(id, rec) {
      ctx.kit.kv.set("r:" + id, rec);
      const idx = ctx.kit.kv.get("idx") || [];
      const at = idx.indexOf(id);
      if (at >= 0) idx.splice(at, 1);
      idx.push(id);
      while (idx.length > 400) ctx.kit.kv.remove("r:" + idx.shift());
      ctx.kit.kv.set("idx", idx);
    }
    function clearCache() {
      (ctx.kit.kv.get("idx") || []).forEach(function (id) { ctx.kit.kv.remove("r:" + id); });
      ctx.kit.kv.set("idx", []);
    }
    function setStatus(ok, text) {
      ctx.kit.kv.set("status", { ok: ok, text: String(text || "").slice(0, 300), at: Date.now() });
    }

    // ---------- 取音频 ----------
    async function loadBlob(msg) {
      let src = null;
      try { src = await ctx.rows.media(msg); } catch (e) { ctx.kit.log("rows.media 出错", e && e.message); }
      if (!src && msg.mediaUrl) src = msg.mediaUrl;
      if (!src) throw new Error("拿不到这条语音的附件");
      if (src instanceof Blob) return src;
      if (typeof src === "object") {
        if (src.blob instanceof Blob) return src.blob;
        src = src.dataUrl || src.url || "";
      }
      const res = await fetch(String(src));
      return await res.blob();
    }

    // 统一转成 16kHz 单声道 WAV：浏览器录的 webm/opus 等格式模型不一定认，WAV 最稳
    async function toWav16k(blob, maxSec) {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      let decoded;
      try {
        decoded = await ac.decodeAudioData((await blob.arrayBuffer()).slice(0));
      } finally {
        try { ac.close(); } catch (e) { /* ignore */ }
      }
      const rate = 16000;
      const seconds = Math.min(decoded.duration, maxSec);
      const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(seconds * rate)), rate);
      const node = off.createBufferSource();
      node.buffer = decoded;
      node.connect(off.destination);
      node.start(0);
      const out = await off.startRendering();
      return { bytes: encodeWav(out.getChannelData(0), rate), seconds: seconds };
    }
    function encodeWav(samples, rate) {
      const buf = new ArrayBuffer(44 + samples.length * 2);
      const v = new DataView(buf);
      function str(o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
      str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVE");
      str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      str(36, "data"); v.setUint32(40, samples.length * 2, true);
      for (let i = 0, o = 44; i < samples.length; i++, o += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }
      return new Uint8Array(buf);
    }
    function toBase64(bytes) {
      let s = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      return btoa(s);
    }
    function guessFormat(type) {
      const t = String(type || "").toLowerCase();
      if (t.indexOf("wav") >= 0) return "wav";
      if (t.indexOf("mpeg") >= 0 || t.indexOf("mp3") >= 0) return "mp3";
      if (t.indexOf("amr") >= 0) return "amr";
      if (t.indexOf("aac") >= 0 || t.indexOf("mp4") >= 0 || t.indexOf("m4a") >= 0) return "aac";
      if (t.indexOf("ogg") >= 0) return "ogg";
      if (t.indexOf("webm") >= 0) return "webm";
      return "mp3";
    }

    // ---------- 调百炼（Omni 模型只支持流式输出） ----------
    const MIME = { wav: "audio/wav", mp3: "audio/mpeg", amr: "audio/amr", aac: "audio/aac", ogg: "audio/ogg", webm: "audio/webm" };

    function readSseLine(line, acc) {
      if (line.indexOf("data:") !== 0) return;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") return;
      let j;
      try { j = JSON.parse(d); } catch (e) { return; }
      if (j.error) {
        if (!acc.err) acc.err = j.error.message || JSON.stringify(j.error);
        ctx.kit.log("接口返回错误", JSON.stringify(j.error));
        return;
      }
      const delta = j.choices && j.choices[0] && j.choices[0].delta;
      if (delta && typeof delta.content === "string") acc.text += delta.content;
    }

    // realtime 模型只能走 WebSocket，不能用 chat/completions；自动去掉 -realtime 后缀
    function modelName() {
      const raw = String(pref("model", DEFAULT_MODEL)).trim() || DEFAULT_MODEL;
      const fixed = raw.replace(/-realtime(?=$|-)/i, "");
      if (fixed !== raw) ctx.kit.log("模型 " + raw + " 是实时(WebSocket)版，已自动改用 " + fixed);
      return fixed;
    }
    function apiUrl() {
      const base = String(pref("baseUrl", DEFAULT_BASE)).trim().replace(/\/+$/, "");
      return /\/chat\/completions$/.test(base) ? base : base + "/chat/completions";
    }
    function audioContent(audioData, format, text) {
      return [
        { type: "input_audio", input_audio: { data: audioData, format: format } },
        { type: "text", text: text },
      ];
    }

    async function requestOnce(url, content) {
      const body = {
        model: modelName(),
        messages: [{ role: "user", content: content }],
        modalities: ["text"],
        stream: true,
        stream_options: { include_usage: true },
        enable_thinking: false,
      };
      const ctrl = new AbortController();
      const timer = setTimeout(function () { ctrl.abort(); }, 55000);
      try {
        const res = await ctx.kit.net(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey() },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const t = await res.text().catch(function () { return ""; });
          const e = new Error("HTTP " + res.status + " " + t.slice(0, 300));
          e.status = res.status;
          throw e;
        }
        const acc = { text: "", err: null };
        if (res.body && res.body.getReader) {
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            buf += dec.decode(chunk.value, { stream: true });
            let nl;
            while ((nl = buf.indexOf("\n")) >= 0) {
              readSseLine(buf.slice(0, nl).trim(), acc);
              buf = buf.slice(nl + 1);
            }
          }
          readSseLine(buf.trim(), acc);
        } else {
          (await res.text()).split("\n").forEach(function (l) { readSseLine(l.trim(), acc); });
        }
        if (!acc.text.trim()) throw new Error(acc.err || "模型没有返回内容");
        return acc.text;
      } finally {
        clearTimeout(timer);
      }
    }

    // 不同模型/地域对音频 Data URL 的写法要求不一样，依次尝试，记住第一个成功的
    async function callOmni(b64, format) {
      const url = apiUrl();
      const mime = MIME[format] || "audio/" + format;
      const variants = [
        { key: "mime", data: "data:" + mime + ";base64," + b64 },
        { key: "bare", data: "data:;base64," + b64 },
        { key: "raw", data: b64 },
      ];
      const remembered = ctx.kit.kv.get("dataStyle");
      variants.sort(function (a, b) { return (b.key === remembered) - (a.key === remembered); });
      let lastErr = null;
      for (let i = 0; i < variants.length; i++) {
        try {
          const text = await requestOnce(url, audioContent(variants[i].data, format, currentPrompt() + "\n\n请按以上要求听这段语音，只输出 JSON。"));
          if (remembered !== variants[i].key) ctx.kit.kv.set("dataStyle", variants[i].key);
          return text;
        } catch (e) {
          lastErr = e;
          const msg = String((e && e.message) || "");
          // Key 错、欠费、限流这类问题换写法也没用，直接报出来
          if (e && (e.status === 401 || e.status === 403 || e.status === 429)) throw e;
          if (/Arrearage|欠费|InvalidApiKey|Access ?denied/i.test(msg)) throw e;
          ctx.kit.log("写法 " + variants[i].key + " 失败，换下一种", msg.slice(0, 160));
        }
      }
      throw lastErr || new Error("所有写法都失败了");
    }
    function parseResult(text) {
      const s = String(text || "").replace(/```(?:json)?/gi, "").trim();
      const a = s.indexOf("{");
      const b = s.lastIndexOf("}");
      if (a >= 0 && b > a) {
        try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { /* fall through */ }
      }
      return { audioType: "uncertain", summary: s.slice(0, 40), aiUnderstanding: s.slice(0, 300) };
    }


    // ---------- 自检：一层层排查问题在哪 ----------
    function toneWav() {
      const rate = 16000, n = rate; // 1 秒 440Hz
      const a = new Float32Array(n);
      for (let i = 0; i < n; i++) a[i] = 0.3 * Math.sin(2 * Math.PI * 440 * i / rate);
      return encodeWav(a, rate);
    }
    function lastVoiceMsg() {
      let best = null;
      (ctx.threads.list() || []).forEach(function (t) {
        (ctx.rows.list(t.id) || []).forEach(function (m) {
          if (isVoice(m) && (!best || (m.createdAt || m.time || 0) >= (best.createdAt || best.time || 0))) best = m;
        });
      });
      return best;
    }
    async function selfTest(say) {
      const url = apiUrl();
      say("接口：" + url);
      say("模型：" + modelName() + (modelName() !== String(pref("model", "")).trim() ? "（已自动去掉 -realtime）" : ""));
      async function step(name, fn) {
        say("… " + name);
        try { const r = await fn(); say("✓ " + name + "：" + String(r || "").replace(/\s+/g, " ").slice(0, 60)); return true; }
        catch (e) { say("✗ " + name + "：" + String((e && e.message) || e).slice(0, 200)); return false; }
      }
      await step("1 纯文字", function () {
        return requestOnce(url, [{ type: "text", text: "只回复两个字：收到" }]);
      });
      await step("2 官方示例音频（网址）", function () {
        return requestOnce(url, audioContent("https://dashscope.oss-cn-beijing.aliyuncs.com/audios/welcome.mp3", "mp3", "用一句话说这段音频讲了什么"));
      });
      const tone = toBase64(toneWav());
      await step("3 本地生成的 1 秒 WAV（data:;base64）", function () {
        return requestOnce(url, audioContent("data:;base64," + tone, "wav", "这段音频是什么声音？一句话"));
      });
      await step("4 本地生成的 1 秒 WAV（data:audio/wav）", function () {
        return requestOnce(url, audioContent("data:audio/wav;base64," + tone, "wav", "这段音频是什么声音？一句话"));
      });
      const m = lastVoiceMsg();
      if (!m) { say("（没找到你发过的语音，跳过第 5 步）"); return; }
      await step("5 读取你最近一条语音（id " + m.id + "）", async function () {
        const blob = await loadBlob(m);
        let info = "类型 " + (blob.type || "未知") + "，" + Math.round(blob.size / 1024) + " KB";
        try { const w = await toWav16k(blob, 30); info += "，转 WAV 成功 " + Math.round(w.seconds * 10) / 10 + " 秒"; }
        catch (e) { info += "，转 WAV 失败：" + (e && e.message); }
        return info;
      });
    }
    function openSelfTest() {
      if (!apiKey()) { ctx.ui.toast("先填百炼 API Key"); return; }
      ctx.ui.dialog(function (el, h) {
        el.style.cssText = "background:Canvas;color:CanvasText;border-radius:16px;padding:16px;max-width:94vw;width:400px;max-height:76vh;overflow:auto;box-sizing:border-box;font-size:12px;line-height:1.6;";
        const t = document.createElement("div");
        t.textContent = "语音理解自检";
        t.style.cssText = "font-weight:600;font-size:15px;margin-bottom:8px;";
        el.appendChild(t);
        const out = document.createElement("div");
        out.style.cssText = "white-space:pre-wrap;word-break:break-all;";
        el.appendChild(out);
        function say(line) { out.textContent += line + "\n"; ctx.kit.log("[自检] " + line); }
        const bar = document.createElement("div");
        bar.style.cssText = "display:flex;justify-content:flex-end;margin-top:10px;";
        bar.appendChild(btn("关闭", function () { h.close(); }));
        el.appendChild(bar);
        selfTest(say).then(function () { say("—— 自检结束，截图发给作者即可 ——"); });
      });
    }

    // ---------- 主流程 ----------
    function analyze(msg, force) {
      if (!msg || !msg.id) return Promise.resolve(null);
      if (!force) {
        const hit = getCache(msg.id);
        if (hit) return Promise.resolve(hit);
        if (pending.has(msg.id)) return pending.get(msg.id);
        if ((failed.get(msg.id) || 0) >= 2) return Promise.resolve(null);
      }
      const job = (async function () {
        const t0 = Date.now();
        const blob = await loadBlob(msg);
        const maxSec = Math.max(5, Number(pref("maxSec", 180)) || 180);
        let b64, fmt, secs = null;
        try {
          const w = await toWav16k(blob, maxSec);
          b64 = toBase64(w.bytes); fmt = "wav"; secs = Math.round(w.seconds);
        } catch (e) {
          ctx.kit.log("转 WAV 失败，改发原文件", e && e.message);
          b64 = toBase64(new Uint8Array(await blob.arrayBuffer()));
          fmt = guessFormat(blob.type);
        }
        const data = parseResult(await callOmni(b64, fmt));
        const rec = { at: Date.now(), ms: Date.now() - t0, secs: secs, data: data };
        setCache(msg.id, rec);
        failed.delete(msg.id);
        setStatus(true, "听完一条（" + (secs || "?") + " 秒，用时 " + Math.round(rec.ms / 100) / 10 + " 秒）");
        ctx.kit.log("语音理解完成", msg.id, data.summary || "");
        return rec;
      })().catch(function (e) {
        failed.set(msg.id, (failed.get(msg.id) || 0) + 1);
        setStatus(false, e && e.message);
        ctx.kit.log("语音理解失败", msg.id, e && e.message);
        return null;
      }).finally(function () {
        pending.delete(msg.id);
        refreshBubble(msg.id);
      });
      pending.set(msg.id, job);
      refreshBubble(msg.id);
      return job;
    }

    function formatForRole(rec, i, total) {
      const d = rec.data || {};
      const pick = function (k) { return String(d[k] || "").trim(); };
      const head = "第" + (i + 1) + "条" + (total > 1 ? "" : "") +
        "（" + (TYPE_CN[pick("audioType")] || "语音") + (rec.secs ? "，约" + rec.secs + "秒" : "") + "）";
      const lines = [head];
      const add = function (label, val) { if (val) lines.push("- " + label + "：" + val); };
      add("听感", pick("summary"));
      add("声音", pick("voiceProfile"));
      add("内容", pick("speech"));
      add("唱功", [pick("singing"), pick("pitchAccuracy"), pick("rhythm"), pick("breath")].filter(Boolean).join("；"));
      add("生活背景", pick("ambient"));
      add("现场", [pick("environment"), pick("accompaniment")].filter(Boolean).join("；"));
      add("情绪与语气", [pick("emotion"), pick("prosody"), pick("pace"), pick("pauses")].filter(Boolean).join("；"));
      add("接话提示", pick("aiUnderstanding"));
      return lines.join("\n");
    }

    // 用户发出语音就先开始听，减少等角色回复的时间
    ctx.watch("row.saved", function (p) {
      const m = p && (p.message || p.row || p);
      if (isVoice(m) && ready()) analyze(m);
    });

    // 拼系统提示词时，把“上一条角色回复之后”的语音听感塞进去
    ctx.pipe.rewrite("prompt.hint", async function (p) {
      if (!ready() || !p.sessionId) return p;
      const rows = ctx.rows.list(p.sessionId) || [];
      let lastAssistant = -1;
      rows.forEach(function (m, i) { if (m.role === "assistant") lastAssistant = i; });
      const n = Math.max(1, Number(pref("recent", 3)) || 3);
      const targets = rows.slice(lastAssistant + 1).filter(isVoice).slice(-n);
      if (!targets.length) return p;
      const recs = await Promise.all(targets.map(function (m) { return withTimeout(analyze(m), 50000); }));
      const parts = [];
      recs.forEach(function (r, i) { if (r && r.data) parts.push(formatForRole(r, i, recs.length)); });
      if (!parts.length) return p;
      p.hint = String(p.hint || "") +
        "\n\n【用户刚发来的语音 · 你听到的感觉】\n" +
        "以下是你亲耳听这段语音的感受。自然地融进回复（比如回应语气、夸或吐槽唱得怎样、留意背景里的动静），" +
        "不要逐条复述，也不要提到“分析”“JSON”“字段”之类的词。\n" +
        parts.join("\n\n");
      return p;
    }, { order: 60, waitMs: 60000 });

    // ---------- 界面：气泡摘要 ----------
    function refreshBubble(id) {
      const set = bubbleEls.get(id);
      if (!set) return;
      set.forEach(function (el) {
        if (el.isConnected) renderBubble(el, id); else set.delete(el);
      });
      if (!set.size) bubbleEls.delete(id);
    }
    function renderBubble(el, id) {
      el.textContent = "";
      el.style.cssText = "font-size:11px;opacity:.7;margin:0 0 4px;line-height:1.4;cursor:pointer;max-width:240px;";
      const rec = getCache(id);
      if (rec && rec.data) {
        el.textContent = "🎧 " + String(rec.data.summary || rec.data.aiUnderstanding || "已听过").slice(0, 40);
        el.onclick = function () { openDetail(id); };
      } else if (pending.has(id)) {
        el.textContent = "🎧 正在听…";
        el.onclick = null;
      } else {
        el.textContent = "🎧 点一下让角色认真听";
        el.onclick = function () {
          failed.delete(id);
          const msg = findMsg(id);
          if (msg) analyze(msg, true);
        };
      }
    }
    function findMsg(id) {
      const threads = ctx.threads.list() || [];
      for (let i = 0; i < threads.length; i++) {
        const hit = (ctx.rows.list(threads[i].id) || []).find(function (m) { return m.id === id; });
        if (hit) return hit;
      }
      return null;
    }
    ctx.ui.place("bubble.meta", function (el, props) {
      const m = props && props.message;
      if (!isVoice(m) || !ready() || pref("showBubble", true) === false) return;
      if (!bubbleEls.has(m.id)) bubbleEls.set(m.id, new Set());
      bubbleEls.get(m.id).add(el);
      renderBubble(el, m.id);
    });

    // ---------- 界面：详情浮层 ----------
    function btn(text, onClick) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.style.cssText = "border:0;border-radius:999px;padding:7px 14px;background:rgba(127,127,127,.15);color:inherit;font:inherit;font-size:13px;";
      b.onclick = onClick;
      return b;
    }
    function openDetail(id) {
      const rec = getCache(id);
      if (!rec) return;
      ctx.ui.dialog(function (el, h) {
        el.style.cssText = "background:Canvas;color:CanvasText;border-radius:16px;padding:16px;max-width:92vw;width:360px;max-height:72vh;overflow:auto;box-sizing:border-box;font-size:13px;line-height:1.55;";
        const title = document.createElement("div");
        title.textContent = "语音听感" + (rec.secs ? "（约 " + rec.secs + " 秒）" : "");
        title.style.cssText = "font-weight:600;font-size:15px;margin-bottom:10px;";
        el.appendChild(title);
        Object.keys(LABELS).forEach(function (k) {
          let v = String((rec.data || {})[k] || "").trim();
          if (!v) return;
          if (k === "audioType") v = TYPE_CN[v] || v;
          const row = document.createElement("div");
          row.style.cssText = "margin:0 0 6px;";
          const b = document.createElement("b");
          b.textContent = LABELS[k] + "：";
          b.style.cssText = "opacity:.75;font-weight:600;";
          row.appendChild(b);
          row.appendChild(document.createTextNode(v));
          el.appendChild(row);
        });
        const bar = document.createElement("div");
        bar.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:12px;";
        bar.appendChild(btn("重新听", function () {
          const msg = findMsg(id);
          h.close();
          if (msg) { failed.delete(id); analyze(msg, true); ctx.ui.toast("正在重新听…", { durationMs: 1500 }); }
        }));
        bar.appendChild(btn("关闭", function () { h.close(); }));
        el.appendChild(bar);
      });
    }

    // ---------- 长按菜单 ----------
    ctx.ui.bubbleMenu({
      id: "voice-understand-redo",
      label: "语音理解：重新听",
      filter: function (msg) { return isVoice(msg); },
      onSelect: async function (msg, helpers) {
        if (!ready()) { helpers.toast("先在扩展里开启并填好百炼 API Key"); return; }
        helpers.toast("正在重新听…");
        failed.delete(msg.id);
        const rec = await analyze(msg, true);
        helpers.toast(rec ? "听完了：" + String(rec.data.summary || "").slice(0, 30) : "没听成，去插件日志看看原因");
      },
    });

    // ---------- 扩展卡片：状态 + 编辑提示词 ----------
    ctx.ui.place("ext.plugin", function (el) {
      el.style.cssText = "font-size:12px;padding:4px 0;line-height:1.5;";
      const st = ctx.kit.kv.get("status");
      const line = document.createElement("div");
      line.style.cssText = "opacity:.8;margin-bottom:8px;word-break:break-all;";
      if (!apiKey()) line.textContent = "还没填百炼 API Key，暂不生效";
      else if (!st) line.textContent = "已就绪，发一条语音试试";
      else line.textContent = (st.ok ? "✓ " : "✗ ") + st.text;
      el.appendChild(line);

      const bar = document.createElement("div");
      bar.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
      bar.appendChild(btn("自检", openSelfTest));
      bar.appendChild(btn("编辑提示词", openPromptEditor));
      bar.appendChild(btn("清空听感缓存", function () {
        clearCache();
        failed.clear();
        ctx.ui.toast("已清空", { durationMs: 1200 });
      }));
      el.appendChild(bar);
    });

    function openPromptEditor() {
      ctx.ui.dialog(function (el, h) {
        el.style.cssText = "background:Canvas;color:CanvasText;border-radius:16px;padding:16px;max-width:94vw;width:420px;box-sizing:border-box;font-size:13px;";
        const tip = document.createElement("div");
        tip.textContent = "增强分析提示词（保存后对下一条语音生效）";
        tip.style.cssText = "font-weight:600;margin-bottom:8px;";
        el.appendChild(tip);
        const box = document.createElement("textarea");
        box.value = currentPrompt();
        box.style.cssText = "width:100%;height:50vh;box-sizing:border-box;padding:10px;border-radius:12px;border:1px solid rgba(127,127,127,.3);background:transparent;color:inherit;font:inherit;font-size:12px;line-height:1.55;";
        el.appendChild(box);
        const bar = document.createElement("div");
        bar.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:10px;";
        bar.appendChild(btn("恢复默认", function () { box.value = DEFAULT_PROMPT; }));
        bar.appendChild(btn("取消", function () { h.close(); }));
        bar.appendChild(btn("保存", function () {
          const v = box.value.trim();
          ctx.kit.prefs.set("prompt", v === DEFAULT_PROMPT ? "" : v);
          h.close();
          ctx.ui.toast("提示词已保存", { durationMs: 1200 });
        }));
        el.appendChild(bar);
      });
    }

    return function () {
      alive = false;
      pending.clear();
      failed.clear();
      bubbleEls.clear();
    };
  },
};
