export default {
  manifest: {
    id: "puff-french-pomoplan",
    name: "计划本",
    engine: "puff",
    apiVersion: 1,
    version: "3.6.5",
    description: "一只计划本(๑•ᴗ•๑)♡",
    app: {
      name: "计划本",
      letter: "L",
    },
    settings: [
      { key: "minimax_api_key", label: "MiniMax 语音 API Key (选填)", type: "text", default: "" },
      { key: "minimax_group_id", label: "MiniMax 语音 Group ID (选填)", type: "text", default: "" },
      { key: "vision_interval", label: "自动伴读互动间隔(分钟)", type: "number", default: 5 },
      { key: "enable_bilingual_translation", label: "开启双语翻译(外语角色适用，点击切换译文)", type: "boolean", default: true },
    ],
  },

  setup(ctx) {
    let videoStream = null;
    let timerInterval = null;
    let visionIntervalId = null;
    let currentAudio = null;

    let cameraFacing = "user"; // "user" | "environment"
    let cameraMirror = false; // 是否水平镜像

    let callVideoEl = null;
    let videoPark = null;
    let callChatListEl = null;
    let smartActionBtn = null;

    // --- 1. 双向记忆互通：将计划本伴读经历注入私聊与线下对话 ---
    ctx.pipe.rewrite("prompt.hint", (p) => {
      try {
        if (!p.characterId) return p;
        const allLogs = ctx.kit.kv.get("focus_logs_v3") || {};
        const charLogs = [];

        Object.keys(allLogs).forEach((date) => {
          const arr = Array.isArray(allLogs[date]) ? allLogs[date] : [];
          arr.forEach((item) => {
            if (item.charId === p.characterId) {
              charLogs.push({ ...item, date });
            }
          });
        });

        if (charLogs.length > 0) {
          charLogs.sort((a, b) => (b.id || 0) - (a.id || 0));
          const recent = charLogs.slice(0, 3);
          const memoLines = recent.map((r) => {
            return `- [${r.date} ${r.timeRange}] 陪伴专注事项:【${r.topic}】，历时${r.minutes}分钟。你留给他的鼓励纸条:“${r.note}”`;
          }).join("\n");

          const companionMemory = `\n【伴读与专注经历记忆】：\n你曾陪用户进行过沉浸专注伴读，你清楚记得以下陪伴经历：\n${memoLines}\n※ 极其重要规则：你完全不知道用户在计划本里的任何未公开代办/计划列表（那是用户的私人隐私），除非用户在当前对话中主动提及，否则绝对不可假装自己提前看过了计划。\n`;

          p.hint = (p.hint || "") + companionMemory;
        }
      } catch (e) {
        ctx.kit.log("计划本记忆注入私聊跳过", e);
      }
      return p;
    });

    // --- 2. 获取该角色与用户最近的私聊记录（让伴读知道之前聊了什么） ---
    function getRecentChatHistory(charId) {
      try {
        const threads = ctx.threads.list() || [];
        const th = threads.find((t) => !t.isGroup && t.characterId === charId);
        if (!th) return "";
        const rows = ctx.rows.list(th.id) || [];
        if (!rows || rows.length === 0) return "";
        const lastRows = rows.slice(-6);
        return lastRows
          .map((r) => `${r.role === "user" ? "用户" : "你"}: ${r.content || ""}`)
          .filter((line) => line.trim().length > 3)
          .join("\n");
      } catch (e) {
        return "";
      }
    }

    function getTodayString() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function formatTimeHM(ts) {
      const d = new Date(ts);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }

    function parkVideo() {
      if (!callVideoEl || !videoPark) return;
      try {
        callVideoEl.pause();
      } catch (e) {}
      try {
        if (callVideoEl.parentNode !== videoPark) videoPark.appendChild(callVideoEl);
      } catch (e) {}
    }

    function detachVideoElement() {
      parkVideo();
    }

    function stopTracks() {
      if (videoStream) {
        try {
          videoStream.getTracks().forEach((t) => {
            try { t.stop(); } catch (e) {}
          });
        } catch (e) {}
        videoStream = null;
      }
    }

    function stopCamera() {
      if (callVideoEl) {
        try {
          callVideoEl.pause();
          callVideoEl.srcObject = null;
        } catch (e) {}
      }
      stopTracks();
      if (callVideoEl && callVideoEl.parentNode) {
        try { callVideoEl.parentNode.removeChild(callVideoEl); } catch (e) {}
      }
      callVideoEl = null;
    }

    function ensureVideoEl() {
      if (callVideoEl) return callVideoEl;
      callVideoEl = document.createElement("video");
      callVideoEl.setAttribute("autoplay", "true");
      callVideoEl.setAttribute("playsinline", "true");
      callVideoEl.setAttribute("muted", "true");
      callVideoEl.setAttribute("webkit-playsinline", "true");
      callVideoEl.setAttribute("x5-playsinline", "true");
      callVideoEl.muted = true;
      callVideoEl.playsInline = true;
      callVideoEl.style.cssText = "width:100%;height:100%;object-fit:cover;background:#000;";
      if (videoPark) videoPark.appendChild(callVideoEl);
      return callVideoEl;
    }

    async function startCamera(facing = cameraFacing) {
      cameraFacing = facing;
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
        ctx.kit.log("当前环境没有摄像头接口");
        ctx.ui.toast("当前环境用不了摄像头");
        return false;
      }
      ensureVideoEl();
      stopTracks();
      const attach = () => {
        if (!callVideoEl || !videoStream) return;
        try {
          callVideoEl.srcObject = videoStream;
          const playPromise = callVideoEl.play();
          if (playPromise && playPromise.catch) playPromise.catch(() => {});
        } catch (e) {}
      };
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 320 },
            height: { ideal: 240 },
          },
          audio: false,
        });
        attach();
        return true;
      } catch (e) {
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 320 }, height: { ideal: 240 } },
            audio: false,
          });
          attach();
          return true;
        } catch (err) {
          ctx.kit.log("摄像头调起失败", err);
          videoStream = null;
          return false;
        }
      }
    }

    // 智能分析摄像头画面状态（遮挡/全黑/正常）
    function inspectCameraVisualState(cameraEnabled) {
      if (!cameraEnabled || !callVideoEl || !videoStream) {
        return "【摄像头状态】：未开启摄像头。";
      }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx2d = canvas.getContext("2d");
        if (!ctx2d) return "【摄像头状态】：已开启画面。";
        ctx2d.drawImage(callVideoEl, 0, 0, 32, 32);
        const imgData = ctx2d.getImageData(0, 0, 32, 32).data;
        let totalBrightness = 0;
        for (let i = 0; i < imgData.length; i += 4) {
          totalBrightness += (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3;
        }
        const avg = totalBrightness / (imgData.length / 4);
        if (avg < 15) {
          return "【摄像头实时状态】：画面全黑或镜头被完全遮挡（请实事求是指出画面黑/被遮挡，绝对不要盲目夸奖用户在专注）。";
        }
        return `【摄像头实时状态】：画面正常显示（方向：${cameraFacing === "user" ? "前置对准用户" : "后置对准桌面/环境"}）。请实事求是观察。`;
      } catch (e) {
        return "【摄像头实时状态】：已开启画面伴读。";
      }
    }

    function stopAudio() {
      if (currentAudio) {
        try {
          currentAudio.pause();
          const src = currentAudio.src;
          currentAudio.removeAttribute("src");
          currentAudio.load();
          if (src && src.indexOf("blob:") === 0) URL.revokeObjectURL(src);
        } catch (e) {}
        currentAudio = null;
      }
    }

    function hexAudioToBytes(hex) {
      const s = String(hex || "").replace(/[^0-9a-f]/gi, "");
      const n = Math.floor(s.length / 2);
      if (n < 16 || n > 800000) return null;
      const bytes = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        bytes[i] = parseInt(s.substr(i * 2, 2), 16);
      }
      return bytes;
    }

    // 强化版双语多气泡解析函数（宽容匹配，确保 100% 提取出翻译）
    function parseActionAndDialogue(raw) {
      if (!raw) return { action: "", items: [{ text: "", translation: "" }] };
      let text = String(raw).trim();
      let action = "";

      const matchBracket = text.match(/^[（(](.*?)[）)]\s*/);
      const matchAsterisk = text.match(/^\*(.*?)\*\s*/);

      if (matchBracket) {
        action = matchBracket[1];
        text = text.slice(matchBracket[0].length).trim();
      } else if (matchAsterisk) {
        action = matchAsterisk[1];
        text = text.slice(matchAsterisk[0].length).trim();
      }

      text = text.replace(/^[（(][^）)]*[）)]\s*/g, "").replace(/^\*[^*]*\*\s*/g, "").trim();

      const rawLines = text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 0);
      const parsedItems = [];

      rawLines.forEach((l) => {
        let cleanL = l.replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
        const trMatch = cleanL.match(/^(.*?)\s*\[(?:中文翻译|翻译|中文)[：:]\s*(.*?)\]$/i);
        if (trMatch) {
          const orig = trMatch[1].trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, "");
          const trans = trMatch[2].trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, "");
          parsedItems.push({ text: orig, translation: trans });
        } else {
          parsedItems.push({ text: cleanL, translation: "" });
        }
      });

      return {
        action: action,
        items: parsedItems.length > 0 ? parsedItems : [{ text: text || raw, translation: "" }],
      };
    }

    return ctx.ui.appPage((container, { close }) => {
      container.style.cssText = `
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: #F8F5F0;
        color: #2D2A26;
        font-family: -apple-system, "Baskerville", "Georgia", "Songti SC", "Source Han Serif SC", serif, sans-serif;
        box-sizing: border-box;
        overflow: hidden;
        position: relative;
      `;

      let activeTab = "timer"; // "timer" | "plan"
      let selectedPlanDate = getTodayString();
      let selectedFocusDate = getTodayString();

      // 番茄钟状态
      let timerMode = "countdown"; // "countdown" | "countup"
      let isFocusing = false;
      let focusTopic = "静心研习";
      let targetSeconds = 25 * 60;
      let startTimeStamp = 0;
      let cameraEnabled = false;

      // 聊天与状态
      let callMessages = [];
      let isChatExpanded = true;
      let isGenerating = false;

      const personas = ctx.personas.list() || [];
      let selectedCharId = ctx.kit.kv.get("current_char_id") || (personas[0] ? personas[0].id : "");

      function getCharConfig(charId) {
        const allConfigs = ctx.kit.kv.get("char_configs_map") || {};
        return allConfigs[charId] || { voiceId: "female-shaonv", avatarBase64: "", enableBilingual: true };
      }

      function setCharConfig(charId, conf) {
        const allConfigs = ctx.kit.kv.get("char_configs_map") || {};
        allConfigs[charId] = { ...getCharConfig(charId), ...conf };
        ctx.kit.kv.set("char_configs_map", allConfigs);
      }

      function getCurrentCharVisual() {
        const conf = getCharConfig(selectedCharId);
        if (conf.avatarBase64) return conf.avatarBase64;
        const char = ctx.personas.get(selectedCharId);
        return (char && char.avatar) ? char.avatar : "";
      }

      // MiniMax 语音播报（选填）
      async function speakMiniMax(text) {
        try {
          const apiKey = (ctx.kit.prefs.get("minimax_api_key") || "").trim();
          const groupId = (ctx.kit.prefs.get("minimax_group_id") || "").trim();
          if (!apiKey || !groupId || !text) return;

          const conf = getCharConfig(selectedCharId);
          const voiceId = conf.voiceId || "female-shaonv";

          const res = await ctx.kit.net(`https://api.minimax.chat/v1/t2a_v2?GroupId=${encodeURIComponent(groupId)}`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "speech-01-turbo",
              text: text,
              stream: false,
              voice_setting: { voice_id: voiceId, speed: 1.0, vol: 1.0, pitch: 0 },
              audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
            }),
          });
          const data = await res.json();
          if (data && data.data && typeof data.data.audio === "string" && data.data.audio.length > 0) {
            stopAudio();
            const bytes = hexAudioToBytes(data.data.audio);
            if (!bytes) return;
            const blob = new Blob([bytes], { type: "audio/mp3" });
            currentAudio = new Audio(URL.createObjectURL(blob));
            currentAudio.play().catch(() => {});
          }
        } catch (e) {
          ctx.kit.log("MiniMax 语音未配置或请求异常（安全跳过）", e);
        }
      }

      // 伴学互动请求 (直接调用用户在 PuffOS 已经接好的主模型 API)
      async function triggerCompanionSay(userExtraText = "") {
        if (isGenerating || !isFocusing) return;
        isGenerating = true;

        try {
          const char = ctx.personas.get(selectedCharId);
          const charName = char ? (char.displayName || char.name) : "伴读伙伴";
          const charSummary = char ? (char.summary || "") : "";
          
          const cfg = getCharConfig(selectedCharId);
          const isBilingual = cfg.enableBilingual !== false && (ctx.kit.prefs.get("enable_bilingual_translation") ?? true);

          const loadingMsgId = Date.now();
          callMessages.push({ id: loadingMsgId, role: "char", isLoading: true, text: "" });
          updateCallChatUI();

          const visualState = inspectCameraVisualState(cameraEnabled);
          const recentChat = getRecentChatHistory(selectedCharId);
          const chatContextPrompt = recentChat
            ? `\n【你们最近在私聊中讨论过的话题/习惯（供参考）】：\n${recentChat}\n`
            : "";

          let transInstruction = "";
          if (isBilingual) {
            transInstruction = `\n【双语格式要求】：若你的角色设定是外语输出，请在每句台词末尾附带中文翻译，格式为：[外语原文] [中文翻译: 对应的流畅中文]。`;
          }

          let promptText = "";
          if (userExtraText) {
            promptText = `${visualState}${chatContextPrompt}
用户在伴学专注【${focusTopic}】时对你说："${userExtraText}"。
请作为【${charName}】给出自然的伴读回应。若有神态或微动作请写在开头括号内如（轻抬眼眸），随后接台词。可分1-2句换行连发。控制在35字左右。${transInstruction}`;
          } else {
            promptText = `${visualState}${chatContextPrompt}
用户正在伴学专注【${focusTopic}】。
请作为【${charName}】结合当下视觉状态与人设，给出贴合性格的督促、关心或评价。若有神态或微动作请写在开头括号内如（静静凝望），随后接台词。控制在35字左右。${transInstruction}`;
          }

          const systemText = `你是${charName}。严格遵守你的人设与语言习惯：${charSummary}`;

          // 直连用户在 PuffOS 设置好的主模型 API
          const rawReply = await ctx.model.ask({
            prompt: promptText,
            system: systemText,
            temperature: 0.7,
            maxTokens: 140,
          });

          const parsed = parseActionAndDialogue(rawReply || "（温和注视）安心研读，我在身侧。");

          callMessages = callMessages.filter((m) => m.id !== loadingMsgId);

          const firstAction = parsed.action || "侧身静伴";
          let spokenText = "";

          parsed.items.forEach((item, idx) => {
            callMessages.push({
              role: "char",
              action: idx === 0 ? firstAction : "",
              text: item.text,
              translation: item.translation || "",
              showTrans: false,
            });
            if (idx === 0) spokenText = item.text;
          });

          updateCallChatUI();
          speakMiniMax(spokenText);
        } catch (globalErr) {
          ctx.kit.log("伴读请求拦截", globalErr);
          callMessages = callMessages.filter((m) => !m.isLoading);
          callMessages.push({
            role: "char",
            action: "温和注视",
            text: "专心当下，莫要分心。",
          });
          updateCallChatUI();
        } finally {
          isGenerating = false;
        }
      }

      // 鼓励小纸条生成
      async function generateEncouragementNote(topic, minutes) {
        try {
          const char = ctx.personas.get(selectedCharId);
          const charName = char ? (char.displayName || char.name) : "伴读伙伴";
          const charSummary = char ? (char.summary || "") : "";
          
          const cfg = getCharConfig(selectedCharId);
          const isBilingual = cfg.enableBilingual !== false && (ctx.kit.prefs.get("enable_bilingual_translation") ?? true);

          const focusChatLines = callMessages
            .filter((m) => !m.isLoading && m.text)
            .map((m) => `${m.role === "user" ? "用户" : charName}: ${m.text}`)
            .slice(-8)
            .join("\n");

          let interactionNote = "";
          if (focusChatLines) {
            interactionNote = `\n【本次专注期间你们的真实互动】：\n${focusChatLines}\n（重要：请在写小纸条时真实结合你们刚才的聊天或互动，绝不可脱离事实瞎夸“一直在安静学习”！）\n`;
          }

          let transInstruction = "";
          if (isBilingual) {
            transInstruction = `\n【双语格式要求】：若使用的是外语，请在文末用 [中文翻译: 对应中文] 附上中文。`;
          }

          const note = await ctx.model.ask({
            prompt: `用户刚刚完成了关于【${topic}】的 ${minutes} 分钟专注伴学。${interactionNote}
请以【${charName}】的身份，为用户手写一张鼓励或调侃小纸条，50字左右。${transInstruction}`,
            system: `你是${charName}。人设：${charSummary}`,
            temperature: 0.8,
            maxTokens: 160,
          });

          return note ? note.trim().replace(/[（(][^）)]*[）)]/g, "") : "每一次专注，都在悄然雕琢更好的你。";
        } catch (e) {
          return "今日的专注已然入账，愿你心怀从容，步履不停。";
        }
      }

      // 顶栏通用
      const topBar = document.createElement("div");
      topBar.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        background: #F8F5F0;
        border-bottom: 1px solid #E5DFD5;
      `;
      const brand = document.createElement("div");
      brand.innerHTML = `<span style="font-weight:600;letter-spacing:2px;font-size:14px;">L'ATELIER</span><span style="font-size:11px;color:#8E877E;margin-left:6px;">工坊</span>`;

      const rightBtns = document.createElement("div");
      rightBtns.style.cssText = "display: flex; gap: 8px;";

      const setBtn = document.createElement("button");
      setBtn.type = "button";
      setBtn.textContent = "角色与设置";
      setBtn.style.cssText = "background:transparent;border:1px solid #D8D0C5;border-radius:4px;padding:4px 10px;font-size:11px;color:#5C554E;cursor:pointer;";
      setBtn.onclick = () => openSettingsModal();

      const exitBtn = document.createElement("button");
      exitBtn.type = "button";
      exitBtn.textContent = "退出";
      exitBtn.style.cssText = "background:transparent;border:1px solid #D8D0C5;border-radius:4px;padding:4px 10px;font-size:11px;color:#5C554E;cursor:pointer;";
      exitBtn.onclick = () => {
        stopCamera();
        stopAudio();
        if (timerInterval) clearInterval(timerInterval);
        if (visionIntervalId) clearInterval(visionIntervalId);
        close();
      };

      rightBtns.appendChild(setBtn);
      rightBtns.appendChild(exitBtn);
      topBar.appendChild(brand);
      topBar.appendChild(rightBtns);
      container.appendChild(topBar);

      // 导航切换
      const nav = document.createElement("div");
      nav.style.cssText = "display:flex;background:#F1EBE4;border-bottom:1px solid #E5DFD5;";
      const tabTimerBtn = document.createElement("button");
      tabTimerBtn.type = "button";
      tabTimerBtn.textContent = "陪伴番茄钟";
      const tabPlanBtn = document.createElement("button");
      tabPlanBtn.type = "button";
      tabPlanBtn.textContent = "计划";

      [tabTimerBtn, tabPlanBtn].forEach((b) => {
        b.style.cssText = "flex:1;padding:10px 0;font-size:12px;border:none;background:transparent;color:#8E877E;cursor:pointer;";
      });

      tabTimerBtn.onclick = () => { activeTab = "timer"; renderMain(); };
      tabPlanBtn.onclick = () => { activeTab = "plan"; renderMain(); };

      nav.appendChild(tabTimerBtn);
      nav.appendChild(tabPlanBtn);
      container.appendChild(nav);

      const mainView = document.createElement("div");
      mainView.style.cssText = "flex:1;overflow-y:auto;position:relative;";
      container.appendChild(mainView);

      videoPark = document.createElement("div");
      videoPark.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none;left:-99px;top:0;";
      container.appendChild(videoPark);

      // --- 角色与设置弹窗 ---
      function openSettingsModal() {
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(45,42,38,0.45);display:flex;align-items:center;justify-content:center;z-index:99;";

        const modal = document.createElement("div");
        modal.style.cssText = "width:86%;max-width:360px;background:#FAF8F5;border:1px solid #D8D0C5;border-radius:8px;padding:18px;box-sizing:border-box;max-height:90%;overflow-y:auto;";

        const title = document.createElement("div");
        title.textContent = "角色形象与伴学设定";
        title.style.cssText = "font-size:13px;font-weight:600;letter-spacing:1px;margin-bottom:14px;";
        modal.appendChild(title);

        const l1 = document.createElement("div");
        l1.textContent = "选择当前陪伴角色";
        l1.style.cssText = "font-size:11px;color:#8E877E;margin-bottom:4px;";
        modal.appendChild(l1);

        const selChar = document.createElement("select");
        selChar.style.cssText = "width:100%;padding:6px;border:1px solid #D8D0C5;background:#FFFFFF;font-size:12px;margin-bottom:12px;outline:none;";
        personas.forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = p.displayName || p.name;
          if (p.id === selectedCharId) opt.selected = true;
          selChar.appendChild(opt);
        });
        modal.appendChild(selChar);

        const curConf = getCharConfig(selChar.value);

        // 双语开关在弹窗内直接可选
        const biRow = document.createElement("label");
        biRow.style.cssText = "display:flex;align-items:center;gap:6px;font-size:11px;color:#2D2A26;margin-bottom:12px;cursor:pointer;";
        const biChk = document.createElement("input");
        biChk.type = "checkbox";
        biChk.checked = curConf.enableBilingual !== false;
        biChk.style.cssText = "accent-color:#2D2A26;";
        const biSpan = document.createElement("span");
        biSpan.textContent = "开启此角色的双语翻译 (外语角色适用)";
        biRow.appendChild(biChk);
        biRow.appendChild(biSpan);
        modal.appendChild(biRow);

        const l2 = document.createElement("div");
        l2.textContent = "该角色专属 MiniMax 音色 ID (选填)";
        l2.style.cssText = "font-size:11px;color:#8E877E;margin-bottom:4px;";
        modal.appendChild(l2);

        const voiceInput = document.createElement("input");
        voiceInput.type = "text";
        voiceInput.value = curConf.voiceId || "female-shaonv";
        voiceInput.placeholder = "如 female-shaonv 或克隆音色ID";
        voiceInput.style.cssText = "width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #D8D0C5;background:#FFFFFF;font-size:12px;margin-bottom:12px;outline:none;";
        modal.appendChild(voiceInput);

        const l3 = document.createElement("div");
        l3.textContent = "该角色立绘/照片";
        l3.style.cssText = "font-size:11px;color:#8E877E;margin-bottom:4px;";
        modal.appendChild(l3);

        let tempBase64 = curConf.avatarBase64 || "";
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.style.cssText = "display:none;";

        const uploadBtn = document.createElement("button");
        uploadBtn.type = "button";
        uploadBtn.textContent = tempBase64 ? "已导入立绘 (点击替换)" : "导入本地立绘图片文件";
        uploadBtn.style.cssText = "width:100%;padding:7px;border:1px dashed #B8ADA0;background:#FFFFFF;color:#5C554E;font-size:11px;border-radius:4px;cursor:pointer;margin-bottom:6px;";
        uploadBtn.onclick = () => fileInput.click();

        fileInput.onchange = () => {
          const file = fileInput.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              tempBase64 = e.target.result;
              uploadBtn.textContent = "已就绪：本地图片已读取";
            };
            reader.readAsDataURL(file);
          }
        };

        modal.appendChild(uploadBtn);
        modal.appendChild(fileInput);

        const resetAvatarBtn = document.createElement("button");
        resetAvatarBtn.type = "button";
        resetAvatarBtn.textContent = "恢复为角色系统自带头像";
        resetAvatarBtn.style.cssText = "background:transparent;border:none;color:#A8A095;font-size:11px;cursor:pointer;margin-bottom:16px;display:block;text-align:left;padding:0;";
        resetAvatarBtn.onclick = () => {
          tempBase64 = "";
          uploadBtn.textContent = "导入本地立绘图片文件";
          ctx.ui.toast("已重置为系统头像");
        };
        modal.appendChild(resetAvatarBtn);

        selChar.onchange = () => {
          const cfg = getCharConfig(selChar.value);
          voiceInput.value = cfg.voiceId || "female-shaonv";
          tempBase64 = cfg.avatarBase64 || "";
          biChk.checked = cfg.enableBilingual !== false;
          uploadBtn.textContent = tempBase64 ? "已配置专属立绘 (点击替换)" : "导入本地立绘图片文件";
        };

        const btnRow = document.createElement("div");
        btnRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = "取消";
        cancel.style.cssText = "border:1px solid #D8D0C5;background:transparent;padding:6px 12px;font-size:12px;border-radius:4px;cursor:pointer;";
        cancel.onclick = () => overlay.remove();

        const save = document.createElement("button");
        save.type = "button";
        save.textContent = "保存配置";
        save.style.cssText = "border:none;background:#2D2A26;color:#FFFFFF;padding:6px 14px;font-size:12px;border-radius:4px;cursor:pointer;";
        save.onclick = () => {
          selectedCharId = selChar.value;
          ctx.kit.kv.set("current_char_id", selectedCharId);
          setCharConfig(selectedCharId, {
            voiceId: voiceInput.value.trim() || "female-shaonv",
            avatarBase64: tempBase64,
            enableBilingual: biChk.checked,
          });
          overlay.remove();
          renderMain();
        };

        btnRow.appendChild(cancel);
        btnRow.appendChild(save);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);
        container.appendChild(overlay);
      }

      function renderMain() {
        parkVideo();
        if (activeTab === "timer") {
          tabTimerBtn.style.color = "#2D2A26";
          tabTimerBtn.style.fontWeight = "600";
          tabTimerBtn.style.background = "#F8F5F0";
          tabPlanBtn.style.color = "#8E877E";
          tabPlanBtn.style.fontWeight = "400";
          tabPlanBtn.style.background = "#F1EBE4";
          if (isFocusing) {
            renderCallScreen();
          } else {
            renderTimerHomePage();
          }
        } else {
          tabPlanBtn.style.color = "#2D2A26";
          tabPlanBtn.style.fontWeight = "600";
          tabPlanBtn.style.background = "#F8F5F0";
          tabTimerBtn.style.color = "#8E877E";
          tabTimerBtn.style.fontWeight = "400";
          tabTimerBtn.style.background = "#F1EBE4";
          renderPlanPage();
        }
      }

      // --- 1. 番茄钟主页 ---
      function renderTimerHomePage() {
        parkVideo();
        mainView.innerHTML = "";
        const wrap = document.createElement("div");
        wrap.style.cssText = "padding:16px;display:flex;flex-direction:column;gap:16px;";

        const setupCard = document.createElement("div");
        setupCard.style.cssText = "background:#FFFFFF;border:1px solid #E5DFD5;border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:12px;";

        // 事项输入
        const topicRow = document.createElement("div");
        topicRow.style.cssText = "display:flex;flex-direction:column;gap:4px;";
        const topicLabel = document.createElement("span");
        topicLabel.textContent = "当前专注事项 (你在干什么)";
        topicLabel.style.cssText = "font-size:11px;color:#8E877E;";

        const topicInput = document.createElement("input");
        topicInput.type = "text";
        topicInput.value = focusTopic;
        topicInput.placeholder = "例如：法理学研读 / 方案策划...";
        topicInput.style.cssText = "border:1px solid #D8D0C5;background:#FAF8F5;border-radius:4px;padding:6px 10px;font-size:12px;outline:none;";
        topicInput.oninput = () => { focusTopic = topicInput.value.trim() || "静心研习"; };
        topicRow.appendChild(topicLabel);
        topicRow.appendChild(topicInput);
        setupCard.appendChild(topicRow);

        // 计时模式与时间设定
        const modeRow = document.createElement("div");
        modeRow.style.cssText = "display:flex;flex-direction:column;gap:8px;";

        const modeSwitch = document.createElement("div");
        modeSwitch.style.cssText = "display:flex;border:1px solid #D8D0C5;border-radius:4px;overflow:hidden;align-self:flex-start;";
        const cdBtn = document.createElement("button");
        cdBtn.type = "button";
        cdBtn.textContent = "倒计时模式";
        const cuBtn = document.createElement("button");
        cuBtn.type = "button";
        cuBtn.textContent = "正向计时模式";
        [cdBtn, cuBtn].forEach((b) => { b.style.cssText = "padding:5px 12px;font-size:11px;border:none;cursor:pointer;"; });

        if (timerMode === "countdown") {
          cdBtn.style.background = "#2D2A26"; cdBtn.style.color = "#FFFFFF";
          cuBtn.style.background = "#FAF8F5"; cuBtn.style.color = "#8E877E";
        } else {
          cuBtn.style.background = "#2D2A26"; cuBtn.style.color = "#FFFFFF";
          cdBtn.style.background = "#FAF8F5"; cdBtn.style.color = "#8E877E";
        }

        cdBtn.onclick = () => { timerMode = "countdown"; renderTimerHomePage(); };
        cuBtn.onclick = () => { timerMode = "countup"; renderTimerHomePage(); };
        modeSwitch.appendChild(cdBtn);
        modeSwitch.appendChild(cuBtn);
        modeRow.appendChild(modeSwitch);

        if (timerMode === "countdown") {
          const timeConfigRow = document.createElement("div");
          timeConfigRow.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;";

          [15, 25, 45, 60].forEach((m) => {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = `${m}分钟`;
            const isSel = targetSeconds === m * 60;
            b.style.cssText = `border:1px solid ${isSel ? "#2D2A26" : "#D8D0C5"};background:${isSel ? "#2D2A26" : "#FAF8F5"};color:${isSel ? "#FFFFFF" : "#5C554E"};border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;`;
            b.onclick = () => { targetSeconds = m * 60; renderTimerHomePage(); };
            timeConfigRow.appendChild(b);
          });

          const customMinInput = document.createElement("input");
          customMinInput.type = "number";
          customMinInput.placeholder = "自定";
          customMinInput.style.cssText = "width:50px;border:1px solid #D8D0C5;background:#FAF8F5;border-radius:4px;padding:3px 6px;font-size:11px;outline:none;";
          customMinInput.onchange = () => {
            const val = parseInt(customMinInput.value, 10);
            if (val > 0) {
              targetSeconds = val * 60;
              renderTimerHomePage();
            }
          };
          timeConfigRow.appendChild(customMinInput);
          modeRow.appendChild(timeConfigRow);
        }
        setupCard.appendChild(modeRow);

        const camBtn = document.createElement("button");
        camBtn.type = "button";
        camBtn.textContent = cameraEnabled && videoStream ? "摄像头伴学已开启" : "开启摄像头伴学 (可自选)";
        camBtn.style.cssText = `border:1px solid ${cameraEnabled && videoStream ? "#2D2A26" : "#D8D0C5"};background:${cameraEnabled && videoStream ? "#2D2A26" : "#FAF8F5"};color:${cameraEnabled && videoStream ? "#FFFFFF" : "#5C554E"};border-radius:4px;padding:8px;font-size:11px;cursor:pointer;`;
        camBtn.onclick = async () => {
          if (cameraEnabled && videoStream) {
            cameraEnabled = false;
            stopCamera();
            renderTimerHomePage();
            return;
          }
          camBtn.textContent = "正在打开摄像头...";
          camBtn.disabled = true;
          const ok = await startCamera();
          camBtn.disabled = false;
          cameraEnabled = ok;
          if (!ok) ctx.ui.toast("没能打开摄像头，请允许相机权限后再试");
          renderTimerHomePage();
        };
        setupCard.appendChild(camBtn);

        if (cameraEnabled && videoStream && callVideoEl) {
          const preview = document.createElement("div");
          preview.style.cssText = "width:100%;height:100px;border-radius:6px;overflow:hidden;background:#111;border:1px solid #D8D0C5;";
          callVideoEl.style.cssText = `width:100%;height:100%;object-fit:cover;transform:${cameraMirror ? "scaleX(-1)" : "none"};`;
          preview.appendChild(callVideoEl);
          try { callVideoEl.play().catch(() => {}); } catch (e) {}
          setupCard.appendChild(preview);
        }

        const startBtn = document.createElement("button");
        startBtn.type = "button";
        startBtn.textContent = "开启沉浸伴学";
        startBtn.style.cssText = "background:#2D2A26;color:#FFFFFF;border:none;border-radius:5px;padding:12px 0;font-size:13px;letter-spacing:2px;cursor:pointer;margin-top:4px;";
        startBtn.onclick = async () => {
          if (cameraEnabled && !videoStream) {
            const ok = await startCamera();
            if (!ok) {
              cameraEnabled = false;
              ctx.ui.toast("没能打开摄像头，先无画面开始");
            }
          }
          isFocusing = true;
          startTimeStamp = Date.now();
          callMessages = [];
          renderCallScreen();
        };
        setupCard.appendChild(startBtn);
        wrap.appendChild(setupCard);

        // 专注历史
        const historySection = document.createElement("div");
        historySection.style.cssText = "display:flex;flex-direction:column;gap:10px;margin-top:6px;";

        const historyHeader = document.createElement("div");
        historyHeader.style.cssText = "display:flex;align-items:center;justify-content:space-between;";

        const historyTitle = document.createElement("span");
        historyTitle.textContent = "专注足迹与鼓励纸条";
        historyTitle.style.cssText = "font-size:12px;font-weight:600;letter-spacing:1px;color:#2D2A26;";

        const datePicker = document.createElement("input");
        datePicker.type = "date";
        datePicker.value = selectedFocusDate;
        datePicker.style.cssText = "border:1px solid #D8D0C5;background:#FFFFFF;border-radius:4px;padding:2px 6px;font-size:11px;outline:none;";
        datePicker.onchange = (e) => { selectedFocusDate = e.target.value; renderTimerHomePage(); };

        historyHeader.appendChild(historyTitle);
        historyHeader.appendChild(datePicker);
        historySection.appendChild(historyHeader);

        const focusLogsMap = ctx.kit.kv.get("focus_logs_v3") || {};
        const todayLogs = Array.isArray(focusLogsMap[selectedFocusDate]) ? focusLogsMap[selectedFocusDate] : [];
        const totalMinutes = todayLogs.reduce((acc, cur) => acc + (cur.minutes || 0), 0);

        const totalCard = document.createElement("div");
        totalCard.style.cssText = "background:#F2EDE6;border-radius:6px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;";
        totalCard.innerHTML = `
          <span style="font-size:11px;color:#7A7369;">本日累计专注时长</span>
          <span style="font-size:16px;font-family:'Baskerville',serif;font-weight:600;color:#2D2A26;">${totalMinutes} <span style="font-size:11px;font-weight:normal;">MINUTES</span></span>
        `;
        historySection.appendChild(totalCard);

        if (todayLogs.length === 0) {
          const empty = document.createElement("div");
          empty.textContent = "本日暂无专注记录，完成一次番茄钟即可生成足迹。";
          empty.style.cssText = "font-size:11px;color:#A8A095;text-align:center;padding:20px 0;";
          historySection.appendChild(empty);
        } else {
          todayLogs.forEach((item, idx) => {
            const card = document.createElement("div");
            card.style.cssText = "background:#FFFFFF;border:1px solid #E5DFD5;border-radius:6px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;";

            const cTop = document.createElement("div");
            cTop.style.cssText = "display:flex;justify-content:space-between;align-items:center;";

            const leftInfo = document.createElement("div");
            leftInfo.innerHTML = `
              <div style="font-size:12px;font-weight:500;color:#2D2A26;">${item.topic}</div>
              <div style="font-size:10px;color:#9E978D;margin-top:2px;">${item.timeRange} · 历时 ${item.minutes} 分钟</div>
            `;

            const delLogBtn = document.createElement("button");
            delLogBtn.type = "button";
            delLogBtn.textContent = "删除";
            delLogBtn.style.cssText = "border:none;background:transparent;color:#B8ADA0;font-size:11px;cursor:pointer;";
            delLogBtn.onclick = () => {
              todayLogs.splice(idx, 1);
              focusLogsMap[selectedFocusDate] = todayLogs;
              ctx.kit.kv.set("focus_logs_v3", focusLogsMap);
              renderTimerHomePage();
            };

            cTop.appendChild(leftInfo);
            cTop.appendChild(delLogBtn);
            card.appendChild(cTop);

            if (item.note) {
              const noteWrap = document.createElement("div");
              noteWrap.style.cssText = "border-top:1px dashed #EBE5DC;padding-top:6px;margin-top:2px;";

              const toggleNote = document.createElement("div");
              toggleNote.textContent = "展开角色手写纸条";
              toggleNote.style.cssText = "font-size:11px;color:#7A7369;cursor:pointer;letter-spacing:0.5px;";

              let noteOrig = item.note;
              let noteTrans = "";
              const nMatch = item.note.match(/^(.*?)\s*\[(?:中文翻译|翻译|中文)[：:]\s*(.*?)\]$/is);
              if (nMatch) {
                noteOrig = nMatch[1].trim();
                noteTrans = nMatch[2].trim();
              }

              let showNoteTrans = false;
              const noteContent = document.createElement("div");
              noteContent.textContent = `“${noteOrig}” —— ${item.charName || "伴读"}`;
              noteContent.style.cssText = "font-size:11px;color:#4A453E;line-height:1.5;font-style:italic;background:#FAF8F5;padding:8px 10px;border-radius:4px;margin-top:6px;display:none;border-left:2px solid #8E877E;cursor:pointer;";

              noteContent.onclick = () => {
                if (!noteTrans) return;
                showNoteTrans = !showNoteTrans;
                const txt = showNoteTrans ? noteTrans : noteOrig;
                noteContent.textContent = `“${txt}” —— ${item.charName || "伴读"}${showNoteTrans ? " (译)" : ""}`;
              };

              let open = false;
              toggleNote.onclick = () => {
                open = !open;
                noteContent.style.display = open ? "block" : "none";
                toggleNote.textContent = open ? "收起角色手写纸条" : "展开角色手写纸条";
              };

              noteWrap.appendChild(toggleNote);
              noteWrap.appendChild(noteContent);
              card.appendChild(noteWrap);
            }

            historySection.appendChild(card);
          });
        }

        wrap.appendChild(historySection);
        mainView.appendChild(wrap);
      }

      // --- 2. 视频伴读沉浸界面 ---
      function updateCallChatUI() {
        if (!callChatListEl) return;
        callChatListEl.innerHTML = "";

        callMessages.forEach((msg) => {
          const rowWrap = document.createElement("div");
          rowWrap.style.cssText = "display: flex; flex-direction: column; width: 100%; margin-bottom: 6px;";

          if (msg.action) {
            const actionEl = document.createElement("div");
            actionEl.textContent = `— ${msg.action} —`;
            actionEl.style.cssText = `
              align-self: center;
              font-size: 10px;
              color: #D5CCC0;
              font-style: italic;
              letter-spacing: 1px;
              margin-bottom: 3px;
              text-align: center;
            `;
            rowWrap.appendChild(actionEl);
          }

          const bubbleRow = document.createElement("div");
          const isChar = msg.role === "char";
          bubbleRow.style.cssText = `
            display: flex;
            justify-content: ${isChar ? "flex-start" : "flex-end"};
            width: 100%;
          `;

          const bubble = document.createElement("div");

          if (msg.isLoading) {
            bubble.innerHTML = `<span style="letter-spacing:1px;opacity:0.8;">正在注视与思索</span> ...`;
            bubble.style.cssText = `
              max-width: 80%;
              font-size: 11px;
              font-style: italic;
              padding: 6px 12px;
              border-radius: 2px 8px 8px 8px;
              background: rgba(255, 255, 255, 0.7);
              color: #5C554E;
              backdrop-filter: blur(4px);
            `;
          } else {
            const curText = msg.showTrans && msg.translation ? msg.translation : msg.text;
            bubble.textContent = curText;
            bubble.style.cssText = `
              max-width: 82%;
              font-size: 11px;
              line-height: 1.45;
              padding: 6px 10px;
              border-radius: ${isChar ? "2px 8px 8px 8px" : "8px 2px 8px 8px"};
              background: ${isChar ? "rgba(255, 255, 255, 0.9)" : "rgba(45, 42, 38, 0.9)"};
              color: ${isChar ? "#2D2A26" : "#FAF8F5"};
              backdrop-filter: blur(4px);
              word-break: break-all;
              cursor: ${msg.translation ? "pointer" : "default"};
              position: relative;
            `;

            if (msg.translation) {
              const tip = document.createElement("span");
              tip.textContent = msg.showTrans ? " [译]" : " [原]";
              tip.style.cssText = "font-size:9px;opacity:0.6;margin-left:4px;";
              bubble.appendChild(tip);

              bubble.onclick = () => {
                msg.showTrans = !msg.showTrans;
                updateCallChatUI();
              };
            }
          }

          bubbleRow.appendChild(bubble);
          rowWrap.appendChild(bubbleRow);
          callChatListEl.appendChild(rowWrap);
        });

        callChatListEl.scrollTop = callChatListEl.scrollHeight;
      }

      function renderCallScreen() {
        try {
          detachVideoElement();
          mainView.innerHTML = "";

          const callBox = document.createElement("div");
          callBox.style.cssText = "width:100%;height:100%;background:#1A1816;position:relative;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;overflow:hidden;";

          const visualUrl = getCurrentCharVisual();
          const bgWrap = document.createElement("div");
          bgWrap.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;z-index:1;";

          if (visualUrl) {
            const img = document.createElement("img");
            img.src = visualUrl;
            img.style.cssText = "width:100%;height:100%;object-fit:cover;filter:brightness(0.72);";
            bgWrap.appendChild(img);
          } else {
            const char = ctx.personas.get(selectedCharId);
            const fallback = document.createElement("div");
            fallback.textContent = char ? (char.displayName || char.name) : "伴读者";
            fallback.style.cssText = "font-size:26px;color:#FAF8F5;letter-spacing:4px;opacity:0.6;";
            bgWrap.appendChild(fallback);
          }
          callBox.appendChild(bgWrap);

          // 顶栏状态
          const callTop = document.createElement("div");
          callTop.style.cssText = "z-index:2;padding:16px;display:flex;justify-content:space-between;align-items:flex-start;";

          const charInfo = document.createElement("div");
          const char = ctx.personas.get(selectedCharId);
          charInfo.innerHTML = `
            <div style="font-size:12px;color:#FAF8F5;letter-spacing:1px;font-weight:500;">${char ? (char.displayName || char.name) : "伴读者"}</div>
            <div style="font-size:10px;color:#D8D0C5;margin-top:2px;">正在专注：${focusTopic}</div>
          `;

          const timerClock = document.createElement("div");
          timerClock.style.cssText = "font-size:22px;font-family:'Baskerville',serif;font-weight:300;color:#FAF8F5;letter-spacing:2px;";

          callTop.appendChild(charInfo);
          callTop.appendChild(timerClock);
          callBox.appendChild(callTop);

          // 画中画
          if (cameraEnabled) {
            const pip = document.createElement("div");
            pip.style.cssText = "position:absolute;top:65px;right:16px;width:100px;height:135px;border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,0.3);z-index:3;background:#000000;box-shadow:0 4px 12px rgba(0,0,0,0.5);cursor:pointer;";

            ensureVideoEl();
            callVideoEl.style.cssText = `width:100%;height:100%;object-fit:cover;transform:${cameraMirror ? "scaleX(-1)" : "none"};`;
            if (videoStream) callVideoEl.srcObject = videoStream;
            pip.appendChild(callVideoEl);

            try {
              const playPromise = callVideoEl.play();
              if (playPromise && playPromise.catch) playPromise.catch(() => {});
            } catch (e) {}

            let showControls = false;
            const pipControls = document.createElement("div");
            pipControls.style.cssText = "position:absolute;bottom:0;left:0;right:0;display:none;background:rgba(0,0,0,0.65);padding:4px 0;justify-content:space-around;align-items:center;backdrop-filter:blur(2px);";

            const flipBtn = document.createElement("button");
            flipBtn.type = "button";
            flipBtn.textContent = "翻转";
            flipBtn.style.cssText = "background:transparent;border:none;color:#FFFFFF;font-size:10px;padding:2px 4px;cursor:pointer;";
            flipBtn.onclick = async (e) => {
              e.stopPropagation();
              const nextFacing = cameraFacing === "user" ? "environment" : "user";
              const ok = await startCamera(nextFacing);
              if (ok && callVideoEl) {
                callVideoEl.srcObject = videoStream;
                callVideoEl.play().catch(() => {});
              }
            };

            const mirrorBtn = document.createElement("button");
            mirrorBtn.type = "button";
            mirrorBtn.textContent = cameraMirror ? "已镜像" : "镜像";
            mirrorBtn.style.cssText = "background:transparent;border:none;color:#FFFFFF;font-size:10px;padding:2px 4px;cursor:pointer;";
            mirrorBtn.onclick = (e) => {
              e.stopPropagation();
              cameraMirror = !cameraMirror;
              if (callVideoEl) {
                callVideoEl.style.transform = cameraMirror ? "scaleX(-1)" : "none";
              }
              mirrorBtn.textContent = cameraMirror ? "已镜像" : "镜像";
            };

            pipControls.appendChild(flipBtn);
            pipControls.appendChild(mirrorBtn);
            pip.appendChild(pipControls);

            pip.onclick = () => {
              showControls = !showControls;
              pipControls.style.display = showControls ? "flex" : "none";
            };

            callBox.appendChild(pip);
            if (!videoStream) {
              void startCamera(cameraFacing).then((ok) => {
                if (!ok) {
                  cameraEnabled = false;
                  ctx.ui.toast("没能打开摄像头，已改为无画面伴学");
                }
              });
            }
          } else {
            parkVideo();
          }

          // 底部对话互动
          const callBottom = document.createElement("div");
          callBottom.style.cssText = "z-index:3;padding:14px;display:flex;flex-direction:column;gap:10px;background:linear-gradient(to top, rgba(0,0,0,0.88), transparent);";

          const chatContainer = document.createElement("div");
          chatContainer.style.cssText = "display:flex;flex-direction:column;gap:6px;";

          const chatToggleBtn = document.createElement("button");
          chatToggleBtn.type = "button";
          chatToggleBtn.textContent = isChatExpanded ? "收起伴读对话" : "展开伴读对话 / 互动";
          chatToggleBtn.style.cssText = "align-self:flex-start;background:rgba(255,255,255,0.2);border:none;color:#FAF8F5;font-size:10px;padding:3px 8px;border-radius:10px;cursor:pointer;";
          chatContainer.appendChild(chatToggleBtn);

          const chatBody = document.createElement("div");
          chatBody.style.cssText = `display:${isChatExpanded ? "flex" : "none"};flex-direction:column;gap:6px;`;

          callChatListEl = document.createElement("div");
          callChatListEl.style.cssText = "max-height:120px;overflow-y:auto;padding-right:4px;";
          chatBody.appendChild(callChatListEl);

          const replyRow = document.createElement("div");
          replyRow.style.cssText = "display:flex;gap:6px;";

          const replyInput = document.createElement("input");
          replyInput.type = "text";
          replyInput.placeholder = "给角色留言，或直接点右侧呼唤...";
          replyInput.style.cssText = "flex:1;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);color:#FAF8F5;border-radius:4px;padding:5px 8px;font-size:11px;outline:none;";

          smartActionBtn = document.createElement("button");
          smartActionBtn.type = "button";
          smartActionBtn.textContent = "呼唤角色";
          smartActionBtn.style.cssText = "background:#FAF8F5;color:#2D2A26;border:none;border-radius:4px;padding:5px 10px;font-size:11px;cursor:pointer;white-space:nowrap;";

          function updateSmartBtnText() {
            smartActionBtn.textContent = replyInput.value.trim().length > 0 ? "发送" : "呼唤角色";
          }

          replyInput.oninput = updateSmartBtnText;

          function handleSmartAction() {
            if (isGenerating) return;
            const txt = replyInput.value.trim();
            if (txt) {
              callMessages.push({ role: "user", text: txt });
              replyInput.value = "";
              updateSmartBtnText();
              updateCallChatUI();
              triggerCompanionSay(txt);
            } else {
              triggerCompanionSay("");
            }
          }

          smartActionBtn.onclick = handleSmartAction;
          replyInput.onkeydown = (e) => { if (e.key === "Enter") handleSmartAction(); };

          replyRow.appendChild(replyInput);
          replyRow.appendChild(smartActionBtn);
          chatBody.appendChild(replyRow);
          chatContainer.appendChild(chatBody);

          chatToggleBtn.onclick = () => {
            isChatExpanded = !isChatExpanded;
            chatBody.style.display = isChatExpanded ? "flex" : "none";
            chatToggleBtn.textContent = isChatExpanded ? "收起伴读对话" : "展开伴读对话 / 互动";
            if (isChatExpanded) updateCallChatUI();
          };

          callBottom.appendChild(chatContainer);

          const endBtn = document.createElement("button");
          endBtn.type = "button";
          endBtn.textContent = "完成专注并结算";
          endBtn.style.cssText = "width:100%;background:#B33927;color:#FAF8F5;border:none;border-radius:20px;padding:10px 0;font-size:12px;letter-spacing:1px;cursor:pointer;margin-top:4px;";

          async function finishAndSave(completedMinutes) {
            isFocusing = false;
            if (timerInterval) clearInterval(timerInterval);
            if (visionIntervalId) clearInterval(visionIntervalId);
            stopCamera();
            stopAudio();

            const startH = formatTimeHM(startTimeStamp);
            const endH = formatTimeHM(Date.now());
            const finalMin = Math.max(1, completedMinutes);

            ctx.ui.toast("正在生成角色鼓励纸条...");
            const noteText = await generateEncouragementNote(focusTopic, finalMin);

            const charObj = ctx.personas.get(selectedCharId);
            const allMap = ctx.kit.kv.get("focus_logs_v3") || {};
            const today = getTodayString();
            const list = Array.isArray(allMap[today]) ? allMap[today] : [];
            list.unshift({
              id: Date.now(),
              charId: selectedCharId,
              topic: focusTopic,
              minutes: finalMin,
              timeRange: `${startH} - ${endH}`,
              note: noteText,
              charName: charObj ? (charObj.displayName || charObj.name) : "伴读",
            });
            allMap[today] = list;
            ctx.kit.kv.set("focus_logs_v3", allMap);

            renderMain();
          }

          endBtn.onclick = () => {
            const passMin = Math.floor((Date.now() - startTimeStamp) / 1000 / 60);
            finishAndSave(passMin);
          };

          callBottom.appendChild(endBtn);
          callBox.appendChild(callBottom);
          mainView.appendChild(callBox);

          updateCallChatUI();

          function tick() {
            if (!isFocusing) return;
            const now = Date.now();
            const pass = Math.floor((now - startTimeStamp) / 1000);

            if (timerMode === "countdown") {
              const left = targetSeconds - pass;
              if (left <= 0) {
                timerClock.textContent = "00:00";
                finishAndSave(Math.floor(targetSeconds / 60));
                return;
              }
              const m = Math.floor(left / 60);
              const s = left % 60;
              timerClock.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            } else {
              const m = Math.floor(pass / 60);
              const s = pass % 60;
              timerClock.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            }
          }

          tick();
          if (timerInterval) clearInterval(timerInterval);
          timerInterval = setInterval(tick, 1000);

          const intervalMin = Number(ctx.kit.prefs.get("vision_interval")) || 5;
          if (visionIntervalId) clearInterval(visionIntervalId);
          visionIntervalId = setInterval(() => {
            if (isFocusing) triggerCompanionSay("");
          }, intervalMin * 60 * 1000);

        } catch (e) {
          ctx.kit.log("专注页面渲染异常已捕获", e);
          isFocusing = false;
          stopCamera();
          renderTimerHomePage();
          ctx.ui.toast("进入专注失败，已安全返回主页");
        }
      }

      // --- 3. 日历与计划清单 ---
      function renderPlanPage() {
        parkVideo();
        mainView.innerHTML = "";
        const pWrap = document.createElement("div");
        pWrap.style.cssText = "padding:16px;display:flex;flex-direction:column;gap:14px;";

        const dateBar = document.createElement("div");
        dateBar.style.cssText = "display:flex;align-items:center;justify-content:space-between;background:#FFFFFF;border:1px solid #E5DFD5;padding:8px 12px;border-radius:6px;";
        const dLabel = document.createElement("span");
        dLabel.textContent = "日程计划日期";
        dLabel.style.cssText = "font-size:12px;color:#8E877E;";
        const dInput = document.createElement("input");
        dInput.type = "date";
        dInput.value = selectedPlanDate;
        dInput.style.cssText = "border:1px solid #D8D0C5;background:#FAF8F5;font-size:12px;padding:3px 6px;border-radius:4px;outline:none;";
        dInput.onchange = (e) => { selectedPlanDate = e.target.value; renderPlanPage(); };
        dateBar.appendChild(dLabel);
        dateBar.appendChild(dInput);
        pWrap.appendChild(dateBar);

        const addCard = document.createElement("div");
        addCard.style.cssText = "background:#FFFFFF;border:1px solid #E5DFD5;border-radius:6px;padding:10px;display:flex;gap:6px;align-items:center;";

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.textContent = "创建";
        addBtn.style.cssText = "background:#2D2A26;color:#FFFFFF;border:none;border-radius:4px;padding:6px 10px;font-size:11px;cursor:pointer;white-space:nowrap;";

        const planInput = document.createElement("input");
        planInput.type = "text";
        planInput.placeholder = "撰写新的待办计划...";
        planInput.style.cssText = "flex:1;border:1px solid #D8D0C5;padding:5px 8px;font-size:12px;border-radius:4px;outline:none;background:#FAF8F5;";

        const prioSel = document.createElement("select");
        prioSel.style.cssText = "border:1px solid #D8D0C5;background:#FAF8F5;font-size:11px;padding:4px 2px;border-radius:4px;outline:none;";
        prioSel.innerHTML = `
          <option value="high">高</option>
          <option value="medium" selected>中</option>
          <option value="low">低</option>
        `;

        function doAdd() {
          const val = planInput.value.trim();
          if (!val) return;
          const allMap = ctx.kit.kv.get("dated_plans_v3") || {};
          const list = Array.isArray(allMap[selectedPlanDate]) ? allMap[selectedPlanDate] : [];
          list.push({ id: Date.now(), text: val, priority: prioSel.value, done: false, createdAt: Date.now() });
          allMap[selectedPlanDate] = list;
          ctx.kit.kv.set("dated_plans_v3", allMap);
          planInput.value = "";
          renderPlanPage();
        }

        addBtn.onclick = doAdd;
        planInput.onkeydown = (e) => { if (e.key === "Enter") doAdd(); };

        addCard.appendChild(addBtn);
        addCard.appendChild(planInput);
        addCard.appendChild(prioSel);
        pWrap.appendChild(addCard);

        const allMap = ctx.kit.kv.get("dated_plans_v3") || {};
        const currentList = Array.isArray(allMap[selectedPlanDate]) ? allMap[selectedPlanDate] : [];
        const prioWeights = { high: 1, medium: 2, low: 3 };

        const pending = currentList.filter((x) => !x.done).sort((a, b) => (prioWeights[a.priority] || 2) - (prioWeights[b.priority] || 2));
        const doneList = currentList.filter((x) => x.done).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        const pendSec = document.createElement("div");
        const pendTitle = document.createElement("div");
        pendTitle.textContent = `待办事项 (${pending.length})`;
        pendTitle.style.cssText = "font-size:11px;color:#8E877E;letter-spacing:1px;margin-bottom:6px;";
        pendSec.appendChild(pendTitle);

        if (pending.length === 0) {
          const emp = document.createElement("div");
          emp.textContent = "本日暂无待办事项。";
          emp.style.cssText = "font-size:12px;color:#B0A89F;padding:8px 0;text-align:center;";
          pendSec.appendChild(emp);
        } else {
          pending.forEach((it) => pendSec.appendChild(renderPlanRow(it, currentList, allMap)));
        }
        pWrap.appendChild(pendSec);

        const doneSec = document.createElement("div");
        doneSec.style.cssText = "margin-top:8px;";
        const doneTitle = document.createElement("div");
        doneTitle.textContent = `已完成归档 (${doneList.length})`;
        doneTitle.style.cssText = "font-size:11px;color:#8E877E;letter-spacing:1px;margin-bottom:6px;";
        doneSec.appendChild(doneTitle);

        if (doneList.length > 0) {
          doneList.forEach((it) => doneSec.appendChild(renderPlanRow(it, currentList, allMap)));
        }
        pWrap.appendChild(doneSec);

        mainView.appendChild(pWrap);
      }

      function renderPlanRow(item, currentList, allMap) {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;justify-content:space-between;background:#FFFFFF;border:1px solid #E5DFD5;border-radius:6px;padding:8px 12px;margin-bottom:6px;";

        const left = document.createElement("div");
        left.style.cssText = "display:flex;align-items:center;gap:8px;flex:1;";

        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = item.done;
        chk.style.cssText = "accent-color:#2D2A26;cursor:pointer;";
        chk.onchange = () => {
          item.done = chk.checked;
          allMap[selectedPlanDate] = currentList;
          ctx.kit.kv.set("dated_plans_v3", allMap);
          renderPlanPage();
        };

        const tag = document.createElement("span");
        const prioMap = { high: { l: "高", c: "#A85338", bg: "#FAF0ED" }, medium: { l: "中", c: "#7A7267", bg: "#F5F2EC" }, low: { l: "低", c: "#9E9E9E", bg: "#F1F1F1" } };
        const pConf = prioMap[item.priority] || prioMap.medium;
        tag.textContent = pConf.l;
        tag.style.cssText = `font-size:10px;padding:1px 4px;border-radius:3px;background:${pConf.bg};color:${pConf.c};`;

        const txt = document.createElement("span");
        txt.textContent = item.text;
        txt.style.cssText = `font-size:12px;color:${item.done ? "#A8A095" : "#2D2A26"};text-decoration:${item.done ? "line-through" : "none"};word-break:break-all;`;

        left.appendChild(chk);
        left.appendChild(tag);
        left.appendChild(txt);

        const del = document.createElement("button");
        del.type = "button";
        del.textContent = "移除";
        del.style.cssText = "border:none;background:transparent;color:#B5ACA1;font-size:11px;cursor:pointer;";
        del.onclick = () => {
          const idx = currentList.findIndex((x) => x.id === item.id);
          if (idx !== -1) currentList.splice(idx, 1);
          allMap[selectedPlanDate] = currentList;
          ctx.kit.kv.set("dated_plans_v3", allMap);
          renderPlanPage();
        };

        row.appendChild(left);
        row.appendChild(del);
        return row;
      }

      renderMain();

      return () => {
        isFocusing = false;
        stopCamera();
        stopAudio();
        if (timerInterval) clearInterval(timerInterval);
        if (visionIntervalId) clearInterval(visionIntervalId);
      };
    });
  },
};
