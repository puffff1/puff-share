export default {
  manifest: {
    id: "puff-chat-search",
    name: "历史消息搜索与定位",
    engine: "puff",
    apiVersion: 1,
    version: "1.4.0",
    description: "输入框左上角快捷入口，支持倒序查看、群聊多角色昵称精准区分、关键词高亮、全量上下文定位及长按复制。",
  },
  setup(ctx) {
    let currentSessionId = "";

    // 监听进入会话
    ctx.watch("thread.open", (p) => {
      currentSessionId = p.sessionId || "";
    });

    // HTML 转义（防止聊天中的 <内心> 等标签被浏览器吞掉）
    function escapeHtml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    // 安全高亮文本
    function highlightText(rawText, keyword) {
      const text = String(rawText || "");
      if (!keyword) return escapeHtml(text);
      const escapedKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const reg = new RegExp(`(${escapedKw})`, "gi");
      const parts = text.split(reg);
      return parts
        .map((part, i) =>
          i % 2 === 1
            ? `<mark style="background:#ffe58f; color:#000; padding:1px 3px; border-radius:3px;">${escapeHtml(part)}</mark>`
            : escapeHtml(part)
        )
        .join("");
    }

    // 为群聊不同角色生成稳定区分色
    const ROLE_PALETTE = [
      "#34c759",
      "#ff9500",
      "#af52de",
      "#ff2d55",
      "#5856d6",
      "#00abc0",
      "#d97706",
      "#0d9488",
    ];
    function getRoleColor(role, name) {
      if (role === "user") return "#007aff";
      if (role === "system") return "#8e8e93";
      let hash = 0;
      const s = String(name || "");
      for (let i = 0; i < s.length; i++) {
        hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
      }
      return ROLE_PALETTE[hash % ROLE_PALETTE.length];
    }

    // 构建角色 ID -> 角色昵称映射表
    function buildPersonaMap() {
      const map = new Map();
      if (ctx.personas && typeof ctx.personas.list === "function") {
        try {
          const list = ctx.personas.list() || [];
          list.forEach((p) => {
            if (p && p.id != null) {
              const name = p.name || p.displayName || p.title || "";
              if (name) map.set(String(p.id), String(name));
            }
          });
        } catch (e) {}
      }
      return map;
    }

    function lookupPersonaName(rawId, personaMap) {
      if (rawId == null || rawId === "") return "";
      const idStr = String(rawId).trim();
      if (!idStr) return "";

      if (personaMap.has(idStr)) return personaMap.get(idStr);

      if (ctx.personas && typeof ctx.personas.get === "function") {
        try {
          const p = ctx.personas.get(idStr);
          if (p && (p.name || p.displayName)) {
            const n = String(p.name || p.displayName);
            personaMap.set(idStr, n);
            return n;
          }
        } catch (e) {}
      }

      // 兼容形如 char:xxx 或 member:xxx 的复合 ID
      if (idStr.includes(":")) {
        const tail = idStr.split(":").pop();
        if (tail && personaMap.has(tail)) return personaMap.get(tail);
        if (tail && ctx.personas && typeof ctx.personas.get === "function") {
          try {
            const p = ctx.personas.get(tail);
            if (p && (p.name || p.displayName)) {
              const n = String(p.name || p.displayName);
              personaMap.set(tail, n);
              return n;
            }
          } catch (e) {}
        }
      }
      return "";
    }

    // 从单条消息对象深度提取角色名（兼容群聊/私聊各种字段命名）
    function extractSpeakerFromRecord(rec, personaMap) {
      if (!rec || typeof rec !== "object") return "";

      const candidates = [rec];
      ["meta", "extra", "speaker", "sender", "author", "persona", "character", "data", "payload"].forEach((k) => {
        if (rec[k] && typeof rec[k] === "object") candidates.push(rec[k]);
      });

      // 1. 优先检查常见发言人/角色 ID 字段并反查角色卡昵称
      const idKeys = [
        "speakerCharacterId",
        "speakerId",
        "speakerPersonaId",
        "characterId",
        "personaId",
        "memberCharacterId",
        "memberId",
        "actorCharacterId",
        "actorId",
        "fromCharacterId",
        "fromId",
        "senderCharacterId",
        "senderId",
        "charId",
        "assistantId",
        "botId",
        "targetCharacterId",
      ];
      for (const obj of candidates) {
        for (const k of idKeys) {
          if (obj[k] != null && obj[k] !== "") {
            const found = lookupPersonaName(obj[k], personaMap);
            if (found) return found;
          }
        }
      }

      // 2. 优先检查直接存储的昵称字段
      const nameKeys = [
        "speakerName",
        "characterName",
        "personaName",
        "memberName",
        "groupNickname",
        "charName",
        "actorName",
        "fromName",
        "senderName",
        "authorName",
        "displayName",
        "nickname",
        "nick",
        "alias",
        "cardName",
        "name",
      ];
      const invalidNames = new Set(["assistant", "user", "system", "bot", "ai", "model", "对方"]);
      for (const obj of candidates) {
        if (typeof obj.speaker === "string" && obj.speaker.trim() && !invalidNames.has(obj.speaker.trim().toLowerCase())) {
          const byId = lookupPersonaName(obj.speaker, personaMap);
          return byId || obj.speaker.trim();
        }
        for (const k of nameKeys) {
          if (typeof obj[k] === "string") {
            const v = obj[k].trim();
            if (v && !invalidNames.has(v.toLowerCase())) return v;
          }
        }
      }

      // 3. 扫描任意属性值是否命中已知角色卡 ID
      const skipKeys = new Set(["id", "sessionId", "threadId", "content", "text", "mediaUrl", "mediaType", "role"]);
      for (const obj of candidates) {
        for (const [k, v] of Object.entries(obj)) {
          if (skipKeys.has(k)) continue;
          if (typeof v === "string" || typeof v === "number") {
            const s = String(v).trim();
            if (s && personaMap.has(s)) {
              return personaMap.get(s);
            }
          }
        }
      }

      return "";
    }

    // 从当前打开的聊天页面 DOM (.chat-msg / .chat-msg-name 及挂载属性) 提取发言人映射
    function collectDomSpeakerHints(rawMessages, personaMap) {
      const byId = new Map();
      const byIndex = new Map();
      try {
        const msgEls = Array.from(document.querySelectorAll(".chat-msg"));
        if (msgEls.length === 0) return { byId, byIndex, msgEls };

        const domItems = msgEls.map((el) => {
          const nameEl = el.querySelector(".chat-msg-name");
          const bubbleEl = el.querySelector(".chat-bubble-primary, .chat-bubble");
          let domName = nameEl ? String(nameEl.textContent || "").trim() : "";
          let msgId =
            el.getAttribute("data-id") ||
            el.getAttribute("data-msg-id") ||
            el.getAttribute("data-row-id") ||
            el.getAttribute("data-message-id") ||
            "";

          // 检查框架组件实例上挂载的原始 message 对象（若有被 ctx.rows.list 裁剪的字段可在此直接拿到）
          for (const key of Object.keys(el)) {
            if (key.startsWith("__reactFiber$") || key.startsWith("__reactProps$")) {
              let cur = el[key];
              let depth = 0;
              while (cur && depth < 6) {
                const props = cur.memoizedProps || cur.pendingProps || cur;
                if (props && typeof props === "object") {
                  for (const pv of Object.values(props)) {
                    if (pv && typeof pv === "object" && (pv.role || pv.content != null)) {
                      if (!msgId && pv.id) msgId = String(pv.id);
                      if (!domName) domName = extractSpeakerFromRecord(pv, personaMap);
                    }
                  }
                }
                cur = cur.return;
                depth++;
              }
            } else if (key === "__vueParentComponent" || key === "__vnode") {
              let comp = el.__vueParentComponent;
              let depth = 0;
              while (comp && depth < 5) {
                const sources = [comp.props, comp.setupState, comp.ctx];
                for (const src of sources) {
                  if (!src || typeof src !== "object") continue;
                  for (const pv of Object.values(src)) {
                    if (pv && typeof pv === "object" && (pv.role || pv.content != null)) {
                      if (!msgId && pv.id) msgId = String(pv.id);
                      if (!domName) domName = extractSpeakerFromRecord(pv, personaMap);
                    }
                  }
                }
                comp = comp.parent;
                depth++;
              }
            }
          }

          if (msgId && domName) {
            byId.set(String(msgId), domName);
          }

          return {
            el,
            msgId,
            domName,
            isMe: el.classList.contains("is-me"),
            text: bubbleEl ? String(bubbleEl.textContent || "").trim() : "",
          };
        });

        // 若页面渲染条数与历史消息条数一致，直接一对一映射序号
        if (domItems.length === rawMessages.length) {
          domItems.forEach((it, idx) => {
            if (it.domName) byIndex.set(idx, it.domName);
          });
        } else {
          // 按尾部及文本顺序对齐当前已渲染的消息
          let rawPtr = rawMessages.length - 1;
          for (let d = domItems.length - 1; d >= 0 && rawPtr >= 0; d--) {
            const dit = domItems[d];
            if (!dit.domName) continue;
            for (let r = rawPtr; r >= Math.max(0, rawPtr - 8); r--) {
              const m = rawMessages[r];
              if ((m.role === "user") !== dit.isMe) continue;
              const mText = String(m.content || "").trim();
              if ((m.id && dit.msgId && String(m.id) === dit.msgId) || (mText && dit.text && (dit.text.includes(mText.slice(0, 16)) || mText.includes(dit.text.slice(0, 16))))) {
                byIndex.set(r, dit.domName);
                rawPtr = r - 1;
                break;
              }
            }
          }
        }

        return { byId, byIndex, msgEls };
      } catch (e) {
        return { byId, byIndex, msgEls: [] };
      }
    }

    // 底层只读存储兜底：若群聊历史被 ctx.rows.list 裁剪了发言人字段且不在当前可视 DOM 中，从本地库只读回查
    async function hydrateSpeakersFromStorage(sid, rawMessages, personaMap, byIdMap) {
      const missingIds = new Set();
      rawMessages.forEach((m) => {
        if (m.role !== "user" && m.role !== "system" && m.id && !byIdMap.has(String(m.id))) {
          missingIds.add(String(m.id));
        }
      });
      if (missingIds.size === 0) return false;

      let updated = false;

      // 1. 尝试扫描 localStorage
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          const raw = localStorage.getItem(k);
          if (!raw || (!raw.includes(sid) && raw.length < 20)) continue;
          if (raw[0] !== "{" && raw[0] !== "[") continue;
          try {
            const parsed = JSON.parse(raw);
            const walk = (node, depth) => {
              if (!node || typeof node !== "object" || depth > 5) return;
              if (Array.isArray(node)) {
                for (const item of node) walk(item, depth + 1);
                return;
              }
              if (node.id && missingIds.has(String(node.id))) {
                const sp = extractSpeakerFromRecord(node, personaMap);
                if (sp) {
                  byIdMap.set(String(node.id), sp);
                  missingIds.delete(String(node.id));
                  updated = true;
                }
              }
              for (const v of Object.values(node)) {
                if (v && typeof v === "object") walk(v, depth + 1);
              }
            };
            walk(parsed, 0);
          } catch (e) {}
          if (missingIds.size === 0) return updated;
        }
      } catch (e) {}

      // 2. 尝试只读扫描 IndexedDB（不传版本号，绝不改动数据库结构）
      if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
        try {
          const dbs = await indexedDB.databases();
          for (const dbInfo of dbs) {
            if (!dbInfo || !dbInfo.name) continue;
            await new Promise((resolve) => {
              let req;
              try {
                req = indexedDB.open(dbInfo.name);
              } catch (e) {
                resolve();
                return;
              }
              req.onerror = () => resolve();
              req.onsuccess = () => {
                const db = req.result;
                const storeNames = Array.from(db.objectStoreNames || []);
                if (storeNames.length === 0) {
                  db.close();
                  resolve();
                  return;
                }
                let pending = storeNames.length;
                const doneOne = () => {
                  pending--;
                  if (pending <= 0) {
                    db.close();
                    resolve();
                  }
                };
                storeNames.forEach((sName) => {
                  try {
                    const tx = db.transaction(sName, "readonly");
                    const store = tx.objectStore(sName);
                    const getAllReq = store.getAll();
                    getAllReq.onsuccess = () => {
                      const rows = getAllReq.result || [];
                      for (const r of rows) {
                        if (!r || typeof r !== "object") continue;
                        if (r.id && missingIds.has(String(r.id))) {
                          const sp = extractSpeakerFromRecord(r, personaMap);
                          if (sp) {
                            byIdMap.set(String(r.id), sp);
                            missingIds.delete(String(r.id));
                            updated = true;
                          }
                        } else if (Array.isArray(r.messages)) {
                          for (const m of r.messages) {
                            if (m && m.id && missingIds.has(String(m.id))) {
                              const sp = extractSpeakerFromRecord(m, personaMap);
                              if (sp) {
                                byIdMap.set(String(m.id), sp);
                                missingIds.delete(String(m.id));
                                updated = true;
                              }
                            }
                          }
                        }
                      }
                      doneOne();
                    };
                    getAllReq.onerror = doneOne;
                  } catch (e) {
                    doneOne();
                  }
                });
              };
            });
            if (missingIds.size === 0) break;
          }
        } catch (e) {}
      }

      return updated;
    }

    // 核心搜索与定位弹窗
    function openSearchDialog(sessionId) {
      const sid = sessionId || currentSessionId;
      if (!sid) {
        ctx.ui.toast("未检测到当前会话");
        return;
      }

      const rawMessages = ctx.rows.list(sid) || [];
      if (rawMessages.length === 0) {
        ctx.ui.toast("暂无历史消息");
        return;
      }

      let threadInfo = null;
      if (ctx.threads && typeof ctx.threads.get === "function") {
        try {
          threadInfo = ctx.threads.get(sid);
        } catch (e) {}
      }
      const isGroupChat = Boolean(
        (threadInfo && threadInfo.isGroup) ||
          sid.startsWith("group:") ||
          sid.startsWith("group-offline:")
      );

      const personaMap = buildPersonaMap();
      const domHints = collectDomSpeakerHints(rawMessages, personaMap);
      const speakerById = new Map(domHints.byId);

      // 统一解析某条消息的显示昵称
      function resolveSenderName(msg, index) {
        if (msg.role === "user") return "我";
        if (msg.role === "system") return "系统";

        // 1. 从消息对象自身提取
        const fromMsg = extractSpeakerFromRecord(msg, personaMap);
        if (fromMsg) return fromMsg;

        // 2. 从 ID 缓存或 DOM 映射提取
        if (msg.id && speakerById.has(String(msg.id))) {
          return speakerById.get(String(msg.id));
        }
        if (domHints.byIndex.has(index)) {
          return domHints.byIndex.get(index);
        }

        // 3. 私聊场景兜底：会话绑定角色 ID 或私聊 sessionId (用户id:角色id)
        if (!isGroupChat) {
          if (threadInfo && threadInfo.characterId) {
            const pName = lookupPersonaName(threadInfo.characterId, personaMap);
            if (pName) return pName;
          }
          if (sid.includes(":")) {
            const charPart = sid.split(":").pop();
            const pName = lookupPersonaName(charPart, personaMap);
            if (pName) return pName;
          }
          if (threadInfo && threadInfo.title) {
            return String(threadInfo.title);
          }
        }

        return "对方";
      }

      ctx.ui.dialog((container, { close }) => {
        container.style.cssText = `
          width: 92vw;
          max-width: 460px;
          height: 82vh;
          max-height: 680px;
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 16px 36px rgba(0,0,0,0.2);
          font-family: inherit;
          color: #2c3e50;
          box-sizing: border-box;
          overflow: hidden;
        `;

        // 顶栏
        const topBar = document.createElement("div");
        topBar.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;";

        const titleEl = document.createElement("div");
        titleEl.style.cssText = "font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 6px;";
        titleEl.innerHTML = `<span>🔍 历史消息</span> <span style="font-size: 12px; color: #888; font-weight: normal;">(共 ${rawMessages.length} 条)</span>`;

        const closeBtn = document.createElement("button");
        closeBtn.innerHTML = "✕";
        closeBtn.style.cssText = "border: none; background: transparent; font-size: 18px; cursor: pointer; padding: 2px 6px; color: #999;";
        closeBtn.onclick = close;

        topBar.appendChild(titleEl);
        topBar.appendChild(closeBtn);
        container.appendChild(topBar);

        // 搜索输入栏
        const searchBar = document.createElement("div");
        searchBar.style.cssText = "display: flex; gap: 8px; margin-bottom: 8px;";
        const searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.placeholder = "输入关键词搜索... (点击定位上下文 / 长按复制)";
        searchInput.style.cssText = `
          flex: 1;
          box-sizing: border-box;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #dcdfe6;
          outline: none;
          font-size: 13px;
        `;
        searchBar.appendChild(searchInput);
        container.appendChild(searchBar);

        // 状态与快捷导航栏
        const statusBar = document.createElement("div");
        statusBar.style.cssText = "display: flex; justify-content: space-between; align-items: center; gap: 6px; font-size: 12px; color: #8c939d; margin-bottom: 8px; min-height: 24px; flex-wrap: wrap;";

        const statusText = document.createElement("span");
        statusText.textContent = "按最新时间倒序展示";

        const navGroup = document.createElement("div");
        navGroup.style.cssText = "display: none; align-items: center; gap: 4px;";

        const makeMiniBtn = (label, primary = false) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = label;
          b.style.cssText = `
            border: none;
            background: ${primary ? "#eef2f8" : "#f4f5f7"};
            color: ${primary ? "#007aff" : "#555"};
            border-radius: 4px;
            padding: 2px 7px;
            font-size: 11px;
            cursor: pointer;
          `;
          return b;
        };

        const jumpFirstBtn = makeMiniBtn("⬆️首条");
        const jumpLastBtn = makeMiniBtn("⬇️最新");
        const backBtn = makeMiniBtn("← 返回搜索", true);

        navGroup.appendChild(jumpFirstBtn);
        navGroup.appendChild(jumpLastBtn);
        navGroup.appendChild(backBtn);

        statusBar.appendChild(statusText);
        statusBar.appendChild(navGroup);
        container.appendChild(statusBar);

        // 消息列表滚动区
        const listContainer = document.createElement("div");
        listContainer.style.cssText = `
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-right: 4px;
        `;
        container.appendChild(listContainer);

        // 刷新已渲染卡片上的发言人昵称（供异步存储兜底完成后热更新）
        function refreshRenderedSpeakerLabels() {
          const spans = listContainer.querySelectorAll("[data-speaker-idx]");
          spans.forEach((sp) => {
            const idx = Number(sp.getAttribute("data-speaker-idx"));
            if (!Number.isNaN(idx) && rawMessages[idx]) {
              const newName = resolveSenderName(rawMessages[idx], idx);
              sp.textContent = newName;
              sp.style.color = getRoleColor(rawMessages[idx].role, newName);
            }
          });
        }

        // 若群聊仍有未识别出具体昵称的消息，启动只读存储回查并自动热更新显示
        const hasUnresolvedGroupSpeaker =
          isGroupChat &&
          rawMessages.some(
            (m, idx) => m.role !== "user" && m.role !== "system" && resolveSenderName(m, idx) === "对方"
          );
        if (hasUnresolvedGroupSpeaker) {
          hydrateSpeakersFromStorage(sid, rawMessages, personaMap, speakerById).then((changed) => {
            if (changed) refreshRenderedSpeakerLabels();
          });
        }

        // 长按复制（滑动时自动取消，避免上下翻阅误触发复制）
        function bindLongPressCopy(element, text) {
          let timer = null;
          let isLongPress = false;
          let startX = 0;
          let startY = 0;

          const start = (x, y) => {
            isLongPress = false;
            startX = x;
            startY = y;
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
              isLongPress = true;
              if (navigator.vibrate) navigator.vibrate(40);
              navigator.clipboard
                .writeText(text)
                .then(() => ctx.ui.toast("已复制消息文本"))
                .catch(() => ctx.ui.toast("复制失败"));
            }, 500);
          };

          const cancel = () => {
            if (timer) {
              clearTimeout(timer);
              timer = null;
            }
          };

          element.addEventListener(
            "touchstart",
            (e) => {
              const t = e.touches && e.touches[0];
              start(t ? t.clientX : 0, t ? t.clientY : 0);
            },
            { passive: true }
          );
          element.addEventListener(
            "touchmove",
            (e) => {
              const t = e.touches && e.touches[0];
              if (t && (Math.abs(t.clientX - startX) > 8 || Math.abs(t.clientY - startY) > 8)) {
                cancel();
              }
            },
            { passive: true }
          );
          element.addEventListener("touchend", cancel);
          element.addEventListener("touchcancel", cancel);
          element.addEventListener("mousedown", (e) => {
            if (e.button === 0) start(e.clientX, e.clientY);
          });
          element.addEventListener("mousemove", (e) => {
            if (timer && (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8)) {
              cancel();
            }
          });
          element.addEventListener("mouseup", cancel);
          element.addEventListener("mouseleave", cancel);

          return () => isLongPress;
        }

        // 创建单条消息卡片
        function createMsgCard(msg, index, keyword = "", isTarget = false, inContextMode = false) {
          const card = document.createElement("div");
          card.id = `msg-card-${index}`;
          card.setAttribute("data-msg-idx", String(index));
          card.style.cssText = `
            background: ${isTarget ? "#e8f4ff" : "#f7f8fa"};
            border: ${isTarget ? "1.5px solid #007aff" : "1px solid #edf0f5"};
            border-radius: 10px;
            padding: 10px 12px;
            font-size: 13px;
            cursor: pointer;
            user-select: none;
            -webkit-user-select: none;
            transition: background-color 0.25s ease, border-color 0.25s ease;
            flex-shrink: 0;
          `;

          const roleName = resolveSenderName(msg, index);
          const roleColor = getRoleColor(msg.role, roleName);

          const rawContent = String(msg.content || "");
          let bodyHtml = "";
          if (rawContent.trim()) {
            bodyHtml = highlightText(rawContent, keyword);
          } else if (msg.mediaType) {
            const mediaLabel =
              msg.mediaType === "image"
                ? "[图片]"
                : msg.mediaType === "sticker"
                ? "[表情]"
                : msg.mediaType === "voice"
                ? "[语音]"
                : `[${escapeHtml(msg.mediaType)}]`;
            bodyHtml = `<span style="color:#999;font-style:italic;">${mediaLabel}</span>`;
          } else {
            bodyHtml = `<span style="color:#bbb;">(空消息)</span>`;
          }

          card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; align-items:center;">
              <span data-speaker-idx="${index}" style="font-weight:600; font-size:12px; color:${roleColor};">${escapeHtml(roleName)}</span>
              <span style="font-size:11px; color:#aaa;">#${index + 1}</span>
            </div>
            <div style="line-height:1.5; word-break:break-word; white-space:pre-wrap;">${bodyHtml}</div>
          `;

          const checkLongPress = bindLongPressCopy(card, rawContent);

          card.addEventListener("click", () => {
            if (checkLongPress()) return;
            if (!inContextMode || !isTarget) {
              showContext(index);
            }
          });

          return card;
        }

        // 清理当前滚动加载监听
        let activeScrollHandler = null;
        function setScrollHandler(fn) {
          if (activeScrollHandler) {
            listContainer.removeEventListener("scroll", activeScrollHandler);
          }
          activeScrollHandler = fn;
          if (fn) {
            listContainer.addEventListener("scroll", fn, { passive: true });
          }
        }

        // 模式一：倒序渲染搜索结果 / 全部历史（支持大数据量顺滑滚动加载全部）
        function renderList(keyword = "") {
          setScrollHandler(null);
          listContainer.innerHTML = "";
          navGroup.style.display = "none";

          const kw = keyword.trim();
          const indexed = rawMessages.map((m, idx) => ({ msg: m, originalIndex: idx }));

          let filtered = indexed;
          if (kw) {
            const lowerKw = kw.toLowerCase();
            filtered = indexed.filter((item) =>
              String(item.msg.content || "").toLowerCase().includes(lowerKw)
            );
            statusText.textContent = `找到 ${filtered.length} 条符合条件的消息`;
          } else {
            statusText.textContent = `按最新时间倒序展示 (共 ${rawMessages.length} 条)`;
          }

          if (filtered.length === 0) {
            const empty = document.createElement("div");
            empty.style.cssText = "text-align: center; color: #999; font-size: 13px; padding: 40px 0;";
            empty.textContent = "未找到符合条件的消息";
            listContainer.appendChild(empty);
            return;
          }

          const reversed = [...filtered].reverse();
          const PAGE_SIZE = 80;
          let renderedCount = 0;

          function appendNextBatch() {
            if (renderedCount >= reversed.length) return;
            const frag = document.createDocumentFragment();
            const end = Math.min(reversed.length, renderedCount + PAGE_SIZE);
            for (let i = renderedCount; i < end; i++) {
              const item = reversed[i];
              frag.appendChild(createMsgCard(item.msg, item.originalIndex, kw, false, false));
            }
            listContainer.appendChild(frag);
            renderedCount = end;
          }

          appendNextBatch();
          listContainer.scrollTop = 0;

          if (reversed.length > PAGE_SIZE) {
            setScrollHandler(() => {
              if (
                listContainer.scrollHeight - listContainer.scrollTop - listContainer.clientHeight <
                220
              ) {
                appendNextBatch();
              }
            });
          }
        }

        // 同步联动背后的主聊天窗口滚动到对应消息
        function syncBackgroundChatScroll(targetIndex) {
          try {
            const targetMsg = rawMessages[targetIndex];
            const chatRows = Array.from(document.querySelectorAll(".chat-msg"));
            if (chatRows.length === 0) return;

            let targetDom = null;
            if (targetMsg && targetMsg.id) {
              const sidAttr = String(targetMsg.id);
              targetDom = chatRows.find(
                (el) =>
                  el.getAttribute("data-id") === sidAttr ||
                  el.getAttribute("data-msg-id") === sidAttr ||
                  el.getAttribute("data-row-id") === sidAttr
              );
            }
            if (!targetDom && chatRows.length === rawMessages.length) {
              targetDom = chatRows[targetIndex];
            }
            if (!targetDom && targetMsg && targetMsg.content) {
              const snippet = String(targetMsg.content).trim().slice(0, 20);
              if (snippet) {
                targetDom = chatRows.find((el) => String(el.textContent || "").includes(snippet));
              }
            }
            if (targetDom) {
              targetDom.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          } catch (e) {}
        }

        // 模式二：定位到目标消息并开放【全部消息 #1 ~ #N】自由上下浏览
        function showContext(targetIndex) {
          setScrollHandler(null);
          listContainer.innerHTML = "";
          navGroup.style.display = "inline-flex";

          const kw = searchInput.value.trim();
          backBtn.textContent = kw ? "← 返回搜索" : "← 返回倒序";
          statusText.textContent = `定位至 #${targetIndex + 1} / 共 ${rawMessages.length} 条 (可上下浏览全部)`;

          const CHUNK = 60;
          // 消息总数较少时一次性渲染全部；超大记录采用双向无感滚动分页，同样可从 #1 滑到最后一条
          let winStart = rawMessages.length <= 240 ? 0 : Math.max(0, targetIndex - CHUNK);
          let winEnd =
            rawMessages.length <= 240
              ? rawMessages.length
              : Math.min(rawMessages.length, targetIndex + CHUNK + 1);

          function renderInitialWindow() {
            listContainer.innerHTML = "";
            const frag = document.createDocumentFragment();
            for (let i = winStart; i < winEnd; i++) {
              frag.appendChild(
                createMsgCard(rawMessages[i], i, kw, i === targetIndex, true)
              );
            }
            listContainer.appendChild(frag);
          }

          renderInitialWindow();

          let isAdjusting = false;
          setScrollHandler(() => {
            if (isAdjusting) return;

            // 上滑接近顶部时，无缝向前加载更早的消息（锁定阅读视口位置不跳屏）
            if (listContainer.scrollTop < 180 && winStart > 0) {
              isAdjusting = true;
              const newStart = Math.max(0, winStart - CHUNK);
              const frag = document.createDocumentFragment();
              for (let i = newStart; i < winStart; i++) {
                frag.appendChild(
                  createMsgCard(rawMessages[i], i, kw, i === targetIndex, true)
                );
              }
              const prevHeight = listContainer.scrollHeight;
              const prevTop = listContainer.scrollTop;
              listContainer.insertBefore(frag, listContainer.firstChild);
              listContainer.scrollTop = prevTop + (listContainer.scrollHeight - prevHeight);
              winStart = newStart;
              isAdjusting = false;
            }

            // 下滑接近底部时，无缝向后加载更新的消息直到最新一条
            if (
              listContainer.scrollHeight - listContainer.scrollTop - listContainer.clientHeight <
                180 &&
              winEnd < rawMessages.length
            ) {
              isAdjusting = true;
              const newEnd = Math.min(rawMessages.length, winEnd + CHUNK);
              const frag = document.createDocumentFragment();
              for (let i = winEnd; i < newEnd; i++) {
                frag.appendChild(
                  createMsgCard(rawMessages[i], i, kw, i === targetIndex, true)
                );
              }
              listContainer.appendChild(frag);
              winEnd = newEnd;
              isAdjusting = false;
            }
          });

          // 快捷跳到第 #1 条 / 最新一条 / 返回列表
          jumpFirstBtn.onclick = () => showContext(0);
          jumpLastBtn.onclick = () => showContext(rawMessages.length - 1);
          backBtn.onclick = () => renderList(searchInput.value);

          // 滚动居中定位并高亮闪烁提醒
          requestAnimationFrame(() => {
            const targetEl = document.getElementById(`msg-card-${targetIndex}`);
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: "auto", block: "center" });
              targetEl.style.backgroundColor = "#fff3cd";
              setTimeout(() => {
                targetEl.style.backgroundColor = "#e8f4ff";
              }, 650);
            }
          });

          syncBackgroundChatScroll(targetIndex);
        }

        // 输入防抖搜索
        let searchTimer = null;
        searchInput.addEventListener("input", (e) => {
          if (searchTimer) clearTimeout(searchTimer);
          searchTimer = setTimeout(() => {
            renderList(e.target.value);
          }, 150);
        });

        // 默认载入倒序全部消息
        renderList("");
        setTimeout(() => searchInput.focus(), 60);
      });
    }

    // 挂载左上角「🔍历史消息」快捷按钮，保持与右侧其他插件同排水平对齐
    ctx.ui.place("composer.rail", (el, props) => {
      if (props && props.sessionId) {
        currentSessionId = props.sessionId;
      }

      if (el.parentElement) {
        el.parentElement.style.display = "flex";
        el.parentElement.style.flexDirection = "row";
        el.parentElement.style.alignItems = "center";
        el.parentElement.style.justifyContent = "space-between";
        el.parentElement.style.width = "100%";
      }

      el.innerHTML = "";
      el.style.cssText = `
        display: inline-flex;
        align-items: center;
        margin-right: auto;
        padding: 0;
      `;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = `<span style="font-weight: 500; font-size: 12px;">🔍历史消息</span>`;
      btn.style.cssText = `
        display: inline-flex;
        align-items: center;
        border: 1px solid rgba(0,0,0,0.08);
        background: rgba(0,0,0,0.04);
        border-radius: 8px;
        padding: 4px 10px;
        font-size: 12px;
        color: inherit;
        cursor: pointer;
        outline: none;
        box-sizing: border-box;
      `;
      btn.onclick = () => openSearchDialog(props.sessionId || currentSessionId);
      el.appendChild(btn);
    });

    // 后台快捷键 Ctrl+F / Cmd+F
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
        if (currentSessionId) {
          e.preventDefault();
          openSearchDialog(currentSessionId);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  },
};
