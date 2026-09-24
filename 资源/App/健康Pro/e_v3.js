export default {
  manifest: {
    id: "puff-health-pro",
    name: "智能健康中心 Pro",
    engine: "puff",
    apiVersion: 1,
    version: "4.1.0",
    description: "支持按份/碗/个等多单位记录食物、AI按份量估算菜肴、运动与饮水打卡、绑定固定对话分享日报及Char性格便利签留评",
    app: { name: "健康Pro", letter: "健" },
  },

  setup(ctx) {
    // ----------------------------------------------------
    // 1. 食物预设数据库 (每 100g 营养基准)
    // ----------------------------------------------------
    const PRESET_FOODS = [
      { name: "米饭", cal: 116, p: 2.6, c: 25.6, f: 0.3 },
      { name: "馒头", cal: 223, p: 7.0, c: 47.0, f: 1.1 },
      { name: "水煮鸡胸肉", cal: 133, p: 24.0, c: 2.5, f: 3.0 },
      { name: "水煮蛋", cal: 140, p: 12.6, c: 1.2, f: 9.6 },
      { name: "全脂牛奶", cal: 64, p: 3.2, c: 4.8, f: 3.6 },
      { name: "燕麦片", cal: 389, p: 15.0, c: 66.0, f: 7.0 },
      { name: "苹果", cal: 52, p: 0.3, c: 13.8, f: 0.2 },
      { name: "香蕉", cal: 89, p: 1.1, c: 22.8, f: 0.3 },
      { name: "黑咖啡", cal: 2, p: 0.1, c: 0.3, f: 0.0 },
      { name: "西兰花", cal: 34, p: 2.8, c: 6.6, f: 0.4 },
      { name: "牛肉 (瘦)", cal: 143, p: 20.0, c: 0.0, f: 6.0 },
      { name: "全麦面包", cal: 246, p: 8.8, c: 45.0, f: 3.2 }
    ];

    const PRESET_EXERCISES = [
      { name: "慢跑 (8km/h)", calPerMin: 8.5 },
      { name: "快走 (5km/h)", calPerMin: 4.5 },
      { name: "跳绳 (中速)", calPerMin: 11.0 },
      { name: "力量训练", calPerMin: 6.0 },
      { name: "骑行 (休闲)", calPerMin: 6.5 }
    ];

    // 通用份量单位换算表 (可在录入时按需微调"每单位克重")
    const UNIT_OPTIONS = [
      { unit: "克", grams: 1 },
      { unit: "两", grams: 50 },
      { unit: "斤", grams: 500 },
      { unit: "份", grams: 350 },
      { unit: "碗", grams: 300 },
      { unit: "个/只", grams: 100 },
      { unit: "块", grams: 80 },
      { unit: "杯", grams: 200 },
      { unit: "勺", grams: 15 },
      { unit: "包/袋", grams: 100 }
    ];

    // ----------------------------------------------------
    // 2. 数据计算与存储
    // ----------------------------------------------------
    function getTodayKey(offsetDays = 0) {
      const d = new Date();
      if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    function getUserProfile() {
      const p = ctx.kit.kv.get("user_profile") || {
        gender: "female", age: 25, height: 165, weight: 60, targetWeight: 55,
        activity: "light", goal: "fat_loss"
      };
      let bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.gender === "male" ? 5 : -161);
      bmr = Math.round(bmr);
      const actMult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }[p.activity] || 1.25;
      const tdee = Math.round(bmr * actMult);
      let calBudget = tdee;
      if (p.goal === "fat_loss") calBudget = Math.round(tdee - 400);
      else if (p.goal === "muscle_gain") calBudget = Math.round(tdee + 300);

      return { ...p, bmr, tdee, calBudget };
    }

    function getDayLog(dateKey) {
      return ctx.kit.kv.get("log_" + dateKey) || {
        meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
        exercises: [], weight: null, water: 0
      };
    }

    function saveDayLog(dateKey, logData) {
      ctx.kit.kv.set("log_" + dateKey, logData);
    }

    function calcDayTotals(log) {
      let calIn = 0, pIn = 0, cIn = 0, fIn = 0;
      Object.values(log.meals || {}).forEach(list => {
        (list || []).forEach(i => {
          calIn += i.cal || 0; pIn += i.p || 0; cIn += i.c || 0; fIn += i.f || 0;
        });
      });
      let calBurn = 0;
      (log.exercises || []).forEach(e => { calBurn += e.cal || 0; });
      return {
        calIn: Math.round(calIn),
        calBurn: Math.round(calBurn),
        netCal: Math.round(calIn - calBurn),
        pIn: Math.round(pIn),
        cIn: Math.round(cIn),
        fIn: Math.round(fIn)
      };
    }

    function getDayReviews(dateKey) {
      return ctx.kit.kv.get("reviews_" + dateKey) || [];
    }

    function saveDayReview(dateKey, reviewItem) {
      const list = getDayReviews(dateKey);
      list.push(reviewItem);
      ctx.kit.kv.set("reviews_" + dateKey, list);
    }

    // ----------------------------------------------------
    // 3. App 界面渲染
    // ----------------------------------------------------
    return ctx.ui.appPage((el) => {
      let currentDateKey = getTodayKey();
      let activeTab = "overview"; // "overview" | "log" | "calendar" | "profile"

      ctx.ui.css(`
        .ph-app { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1f2937; background: #f9fafb; min-height: 100%; padding: 14px; box-sizing: border-box; font-size: 13px; }
        .ph-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; background: #fff; padding: 6px 12px; border-radius: 12px; border: 1px solid #e5e7eb; }
        .ph-tabs { display: flex; gap: 4px; background: #e5e7eb; padding: 3px; border-radius: 10px; margin-bottom: 12px; }
        .ph-tab-btn { flex: 1; border: none; background: transparent; padding: 6px 0; border-radius: 8px; font-size: 12px; font-weight: 500; color: #4b5563; cursor: pointer; text-align: center; }
        .ph-tab-btn.active { background: #fff; color: #111827; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .ph-card { background: #fff; border-radius: 12px; border: 1px solid #e5e7eb; padding: 12px; margin-bottom: 12px; }
        .ph-flex-between { display: flex; align-items: center; justify-content: space-between; }
        .ph-pill { background: #f3f4f6; padding: 2px 8px; border-radius: 12px; font-size: 11px; color: #4b5563; }
        .ph-btn { border: none; border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 500; cursor: pointer; }
        .ph-btn-primary { background: #10b981; color: #fff; }
        .ph-btn-secondary { background: #f3f4f6; color: #374151; }
        .ph-btn-accent { background: #3b82f6; color: #fff; }
        .ph-input { border: 1px solid #d1d5db; border-radius: 6px; padding: 6px 8px; font-size: 12px; outline: none; width: 100%; box-sizing: border-box; }
        .ph-select { border: 1px solid #d1d5db; border-radius: 6px; padding: 6px 8px; font-size: 12px; outline: none; background: #fff; width: 100%; box-sizing: border-box; }
        
        .ph-sticky-note {
          background: #fef9c3; color: #713f12; border-radius: 6px; padding: 12px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.05); transform: rotate(-0.5deg);
          margin-top: 10px; border: 1px solid #fef08a;
        }
      `);

      function render() {
        el.innerHTML = "";
        const main = document.createElement("div");
        main.className = "ph-app";

        const prof = getUserProfile();
        const dayLog = getDayLog(currentDateKey);
        const totals = calcDayTotals(dayLog);

        // 顶栏日期
        const topNav = document.createElement("div");
        topNav.className = "ph-nav";
        topNav.innerHTML = `
          <button class="ph-btn ph-btn-secondary" style="padding:2px 8px;" id="btn-prev">‹</button>
          <span style="font-weight:600;">${currentDateKey} ${currentDateKey === getTodayKey() ? '(今天)' : ''}</span>
          <button class="ph-btn ph-btn-secondary" style="padding:2px 8px;" id="btn-next">›</button>
        `;
        main.appendChild(topNav);

        topNav.querySelector("#btn-prev").onclick = () => { currentDateKey = shiftDate(currentDateKey, -1); render(); };
        topNav.querySelector("#btn-next").onclick = () => { currentDateKey = shiftDate(currentDateKey, 1); render(); };

        // Tabs
        const tabContainer = document.createElement("div");
        tabContainer.className = "ph-tabs";
        const tabs = [
          { id: "overview", name: "概览 & 分享" },
          { id: "log", name: "记录食物/运动" },
          { id: "calendar", name: "便利签流评" },
          { id: "profile", name: "档案" }
        ];
        tabs.forEach(t => {
          const btn = document.createElement("button");
          btn.className = `ph-tab-btn ${activeTab === t.id ? 'active' : ''}`;
          btn.textContent = t.name;
          btn.onclick = () => { activeTab = t.id; render(); };
          tabContainer.appendChild(btn);
        });
        main.appendChild(tabContainer);

        const content = document.createElement("div");
        if (activeTab === "overview") renderOverview(content, prof, dayLog, totals);
        else if (activeTab === "log") renderLogTab(content, dayLog, totals);
        else if (activeTab === "calendar") renderCalendarTab(content);
        else if (activeTab === "profile") renderProfileTab(content, prof);

        main.appendChild(content);
        el.appendChild(main);
      }

      function shiftDate(baseKey, days) {
        const parts = baseKey.split('-').map(Number);
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        d.setDate(d.getDate() + days);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }

      // --------------------------------------------------
      // Tab 1: 概览与对话框分享
      // --------------------------------------------------
      function renderOverview(parent, prof, dayLog, totals) {
        const calCard = document.createElement("div");
        calCard.className = "ph-card";
        calCard.innerHTML = `
          <div class="ph-flex-between" style="margin-bottom: 8px;">
            <span style="font-weight: 600; font-size: 14px;">今日热量概览</span>
            <span class="ph-pill">${totals.netCal > prof.calBudget ? '⚠️ 超标' : '剩余 ' + (prof.calBudget - totals.netCal) + ' kcal'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; text-align: center; margin: 12px 0;">
            <div><div style="color:#6b7280; font-size: 10px;">摄入</div><div style="font-weight:700; color:#10b981;">${totals.calIn} kcal</div></div>
            <div><div style="color:#6b7280; font-size: 10px;">消耗</div><div style="font-weight:700; color:#f59e0b;">${totals.calBurn} kcal</div></div>
            <div><div style="color:#6b7280; font-size: 10px;">净热量</div><div style="font-weight:700;">${totals.netCal} kcal</div></div>
            <div><div style="color:#6b7280; font-size: 10px;">预算</div><div style="font-weight:700; color:#3b82f6;">${prof.calBudget} kcal</div></div>
          </div>
          <div style="font-size:11px; color:#6b7280; border-top:1px dashed #f3f4f6; padding-top:6px; display:flex; justify-content:space-around;">
            <span>蛋白: ${totals.pIn}g</span>
            <span>碳水: ${totals.cIn}g</span>
            <span>脂肪: ${totals.fIn}g</span>
          </div>
        `;
        parent.appendChild(calCard);

        // 分享/评价卡片
        const shareCard = document.createElement("div");
        shareCard.className = "ph-card";
        shareCard.innerHTML = `
          <div style="font-weight:600; margin-bottom:6px;">与 Char 互动分享 💬</div>
          <div style="color:#6b7280; font-size:11px; margin-bottom:12px;">直接将排版精美的日报推送到对话框，或邀请 Char 生成性格评论便利签。</div>
          <div style="display:flex; gap:8px;">
            <button class="ph-btn ph-btn-primary" id="btn-share-chat" style="flex:1;">📤 分享日报卡片到对话</button>
            <button class="ph-btn ph-btn-accent" id="btn-invite-char" style="flex:1;">✍️ 邀请 Char 评语</button>
          </div>
        `;

        // 生成日报文本（三餐显示单位+份量，不再强制只显示克重；补充运动与饮水）
        function buildMarkdownReport() {
          const mealText = (list) => (list && list.length > 0)
            ? list.map(i => {
                const portion = i.unit ? `${i.qty || 1}${i.unit}${i.weight ? `·约${i.weight}g` : ''}` : (i.weight ? `${i.weight}g` : '1份');
                return `${i.name}(${portion}:${i.cal}kcal)`;
              }).join("、")
            : "未记录";
          const exText = (dayLog.exercises && dayLog.exercises.length > 0)
            ? dayLog.exercises.map(e => `${e.name} ${e.minutes}分钟(${e.cal}kcal)`).join("、")
            : "未记录";

          return [
            `📊 **【每日健康与饮食日报】** (${currentDateKey})`,
            `────────────────────────`,
            `⚖️ **当前体重**：${dayLog.weight ? dayLog.weight + ' kg' : '未记录'}`,
            `🔥 **热量预算**：净摄入 **${totals.netCal}** / ${prof.calBudget} kcal (摄入 ${totals.calIn} | 消耗 ${totals.calBurn})`,
            `🥗 **营养摄入**：蛋白质 ${totals.pIn}g | 碳水 ${totals.cIn}g | 脂肪 ${totals.fIn}g`,
            `💧 **饮水**：${dayLog.water || 0} ml`,
            `🏃 **运动**：${exText}`,
            `────────────────────────`,
            `🍽️ **三餐明细**：`,
            `• 早餐：${mealText(dayLog.meals.breakfast)}`,
            `• 午餐：${mealText(dayLog.meals.lunch)}`,
            `• 晚餐：${mealText(dayLog.meals.dinner)}`,
            `• 加餐：${mealText(dayLog.meals.snack)}`,
            `────────────────────────`,
            `*(这份是我的今天记录，请看看并对我提出你的看法和建议吧~)*`
          ].join("\n");
        }

        function sendReportTo(threadId) {
          ctx.rows.push({
            sessionId: threadId,
            role: "user",
            content: buildMarkdownReport()
          });
          ctx.ui.toast("日报卡片已成功发至聊天框！");
        }

        function openThreadChooser(onPicked) {
          const threads = ctx.threads.list() || [];
          if (threads.length === 0) { ctx.ui.toast("当前没有打开的对话窗口"); return; }

          ctx.ui.dialog((dialogEl, { close }) => {
            dialogEl.style.cssText = "width:280px; padding:14px;";
            dialogEl.innerHTML = `<div style="font-weight:600; margin-bottom:10px;">选择发送目标对话</div><div id="thread-list"></div>`;
            const listEl = dialogEl.querySelector("#thread-list");

            threads.forEach(th => {
              const item = document.createElement("div");
              item.style.cssText = "padding:8px; border-bottom:1px solid #f3f4f6; cursor:pointer; font-size:12px;";
              item.textContent = th.title || th.id;
              item.onclick = () => {
                close();
                onPicked(th);
              };
              listEl.appendChild(item);
            });
          });
        }

        // 分享按钮：若已绑定固定对话，则直接发送，避免每次挑选不同对话/角色导致记录分散、记忆错乱；
        // 未绑定时弹出选择框，选定后自动记为绑定对话（可在【档案】页重新更换绑定）
        shareCard.querySelector("#btn-share-chat").onclick = () => {
          if (prof.boundThreadId) {
            sendReportTo(prof.boundThreadId);
            return;
          }
          openThreadChooser((th) => {
            sendReportTo(th.id);
            prof.boundThreadId = th.id;
            prof.boundThreadName = th.title || th.id;
            ctx.kit.kv.set("user_profile", prof);
            ctx.ui.toast(`已将「${prof.boundThreadName}」设为默认分享对话，可在【档案】页更换`);
          });
        };

        // 邀请 Char 生成性格便利签
        shareCard.querySelector("#btn-invite-char").onclick = () => {
          const personas = ctx.personas.list() || [];
          if (personas.length === 0) { ctx.ui.toast("未找到可用人设"); return; }

          ctx.ui.dialog((dialogEl, { close }) => {
            dialogEl.style.cssText = "width:280px; padding:14px;";
            dialogEl.innerHTML = `<div style="font-weight:600; margin-bottom:10px;">邀请哪位 Char 评价今日？</div><div id="p-list"></div>`;
            const listEl = dialogEl.querySelector("#p-list");

            personas.forEach(p => {
              const item = document.createElement("div");
              item.style.cssText = "padding:8px; border-bottom:1px solid #f3f4f6; cursor:pointer; font-size:12px;";
              item.innerHTML = `🎭 <b>${p.name}</b>`;
              item.onclick = async () => {
                close();
                ctx.ui.toast(`正在邀请 ${p.name} 翻阅日报...`);

                const portionText = (list) => (list && list.length > 0)
                  ? list.map(i => `${i.name}(${i.unit ? (i.qty||1)+i.unit : (i.weight?i.weight+'g':'1份')}, 约${i.cal}kcal)`).join("、")
                  : "未记录";
                const exerciseText = (dayLog.exercises && dayLog.exercises.length > 0)
                  ? dayLog.exercises.map(e => `${e.name} ${e.minutes}分钟(消耗${e.cal}kcal)`).join("、")
                  : "未记录";

                const prompt = [
                  `你是 ${p.name}。下面是用户今日 (${currentDateKey}) 的健康与食物记录：`,
                  `· 净热量: ${totals.netCal} kcal (预算目标: ${prof.calBudget} kcal，摄入${totals.calIn}kcal / 运动消耗${totals.calBurn}kcal)`,
                  `· 营养素: 蛋白质${totals.pIn}g / 碳水${totals.cIn}g / 脂肪${totals.fIn}g`,
                  `· 早餐: ${portionText(dayLog.meals.breakfast)}`,
                  `· 午餐: ${portionText(dayLog.meals.lunch)}`,
                  `· 晚餐: ${portionText(dayLog.meals.dinner)}`,
                  `· 加餐: ${portionText(dayLog.meals.snack)}`,
                  `· 运动: ${exerciseText}`,
                  `· 饮水: ${dayLog.water || 0} ml`,
                  `· 体重: ${dayLog.weight || '未记录'} kg`,
                  `请完全以你的性格与语气，给用户写一段简短留言（80-120字左右，符合角色语气，贴近生活，可以针对具体某样食物或运动情况发表看法）。`
                ].join("\n");

                try {
                  const comment = await ctx.model.ask({ prompt, system: p.summary || "" });
                  saveDayReview(currentDateKey, {
                    charName: p.name,
                    content: comment,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  });
                  ctx.ui.toast("留评成功！已存入【便利签流评】");
                  activeTab = "calendar";
                  render();
                } catch (e) {
                  ctx.ui.toast("生成评价失败，请稍后重试");
                }
              };
              listEl.appendChild(item);
            });
          });
        };

        parent.appendChild(shareCard);
      }

      // --------------------------------------------------
      // Tab 2: 食物克重录入 + 运动录入
      // --------------------------------------------------
      function renderLogTab(parent, dayLog, totals) {
        // 体重快速打卡
        const weightCard = document.createElement("div");
        weightCard.className = "ph-card";
        weightCard.style.cssText = "display:flex; align-items:center; gap:8px;";
        weightCard.innerHTML = `
          <span style="font-weight:600; white-space:nowrap;">⚖️ 今日体重:</span>
          <input class="ph-input" id="w-val" type="number" value="${dayLog.weight || ''}" placeholder="输入 kg">
          <button class="ph-btn ph-btn-primary" id="btn-save-w">保存</button>
        `;
        weightCard.querySelector("#btn-save-w").onclick = () => {
          dayLog.weight = parseFloat(weightCard.querySelector("#w-val").value) || null;
          saveDayLog(currentDateKey, dayLog);
          ctx.ui.toast("体重已更新");
        };
        parent.appendChild(weightCard);

        // 运动记录
        const exCard = document.createElement("div");
        exCard.className = "ph-card";
        const exList = dayLog.exercises || [];
        let exHtml = exList.map((e, idx) => `
          <div class="ph-flex-between" style="padding:4px 0; border-bottom:1px dashed #f3f4f6;">
            <div><b>${e.name}</b> <span style="color:#6b7280; font-size:11px;">(${e.minutes}分钟)</span></div>
            <div>
              <span style="font-weight:600; margin-right:8px; color:#f59e0b;">-${e.cal} kcal</span>
              <span style="color:#ef4444; cursor:pointer;" data-exdel="${idx}">✕</span>
            </div>
          </div>
        `).join("");
        exCard.innerHTML = `
          <div class="ph-flex-between" style="margin-bottom:8px;">
            <span style="font-weight:600;">🏃 今日运动</span>
            <button class="ph-btn ph-btn-secondary" style="padding:2px 6px; font-size:11px;" id="add-exercise">+ 添加运动</button>
          </div>
          <div>${exHtml || '<div style="color:#9ca3af; font-size:11px;">未记录</div>'}</div>
        `;
        exCard.querySelectorAll("[data-exdel]").forEach(btn => {
          btn.onclick = (e) => {
            const idx = parseInt(e.target.getAttribute("data-exdel"));
            dayLog.exercises.splice(idx, 1);
            saveDayLog(currentDateKey, dayLog);
            render();
          };
        });
        exCard.querySelector("#add-exercise").onclick = () => openAddExerciseModal(dayLog);
        parent.appendChild(exCard);

        // 饮水记录
        const waterCard = document.createElement("div");
        waterCard.className = "ph-card";
        waterCard.style.cssText = "display:flex; align-items:center; gap:8px;";
        waterCard.innerHTML = `
          <span style="font-weight:600; white-space:nowrap;">💧 今日饮水:</span>
          <input class="ph-input" id="water-val" type="number" value="${dayLog.water || 0}" placeholder="输入 ml">
          <button class="ph-btn ph-btn-primary" id="btn-save-water">保存</button>
        `;
        waterCard.querySelector("#btn-save-water").onclick = () => {
          dayLog.water = parseFloat(waterCard.querySelector("#water-val").value) || 0;
          saveDayLog(currentDateKey, dayLog);
          ctx.ui.toast("饮水已更新");
        };
        parent.appendChild(waterCard);

        // 三餐列表
        const mealNames = { breakfast: "早餐 🌅", lunch: "午餐 ☀️", dinner: "晚餐 🌙", snack: "加餐 🍎" };
        Object.entries(mealNames).forEach(([mealKey, label]) => {
          const card = document.createElement("div");
          card.className = "ph-card";
          const items = dayLog.meals[mealKey] || [];

          let itemsHtml = items.map((it, idx) => {
            const portion = it.unit
              ? `${it.qty || 1}${it.unit}${it.weight ? ` · 约${it.weight}g` : ''}`
              : (it.weight ? `${it.weight}g` : '1份');
            return `
            <div class="ph-flex-between" style="padding:4px 0; border-bottom:1px dashed #f3f4f6;">
              <div>
                <b>${it.name}</b> 
                <span style="color:#6b7280; font-size:11px;">(${portion})</span>
              </div>
              <div>
                <span style="font-weight:600; margin-right:8px; color:#10b981;">${it.cal} kcal</span>
                <span style="color:#ef4444; cursor:pointer;" data-del="${idx}">✕</span>
              </div>
            </div>
          `;
          }).join("");

          card.innerHTML = `
            <div class="ph-flex-between" style="margin-bottom:8px;">
              <span style="font-weight:600;">${label}</span>
              <button class="ph-btn ph-btn-secondary" style="padding:2px 6px; font-size:11px;" id="add-${mealKey}">+ 添加食物与克重</button>
            </div>
            <div>${itemsHtml || '<div style="color:#9ca3af; font-size:11px;">未记录</div>'}</div>
          `;

          // 删除
          card.querySelectorAll("[data-del]").forEach(btn => {
            btn.onclick = (e) => {
              const idx = parseInt(e.target.getAttribute("data-del"));
              dayLog.meals[mealKey].splice(idx, 1);
              saveDayLog(currentDateKey, dayLog);
              render();
            };
          });

          // 点击添加（弹出真正带克重和AI估算的选择框）
          card.querySelector(`#add-${mealKey}`).onclick = () => {
            openAddFoodModal(mealKey, dayLog);
          };

          parent.appendChild(card);
        });
      }

      // 打开【添加食物与克重】弹窗
      function openAddFoodModal(mealKey, dayLog) {
        ctx.ui.dialog((dialogEl, { close }) => {
          dialogEl.style.cssText = "width:300px; padding:16px;";
          dialogEl.innerHTML = `
            <div style="font-weight:600; margin-bottom:10px; font-size:14px;">添加食物到餐单</div>
            
            <div style="margin-bottom:10px;">
              <label style="font-size:11px; color:#6b7280;">选择预设食物或输入自定义:</label>
              <select class="ph-select" id="food-select" style="margin-top:4px;">
                <option value="">-- 自定义 / 交给 AI 估算 --</option>
                ${PRESET_FOODS.map((f, i) => `<option value="${i}">${f.name} (${f.cal}kcal/100g)</option>`).join('')}
              </select>
            </div>

            <div style="margin-bottom:10px;">
              <label style="font-size:11px; color:#6b7280;">食物名称 (自定义):</label>
              <input class="ph-input" id="food-name" placeholder="如: 沙县鸡腿饭 / 红烧肉">
            </div>

            <div style="margin-bottom:10px; display:flex; gap:6px;">
              <div style="flex:1;">
                <label style="font-size:11px; color:#6b7280;">数量:</label>
                <input class="ph-input" id="food-qty" type="number" value="1" min="0" step="0.5">
              </div>
              <div style="flex:1.4;">
                <label style="font-size:11px; color:#6b7280;">单位:</label>
                <select class="ph-select" id="food-unit">
                  ${UNIT_OPTIONS.map((u, i) => `<option value="${i}" ${u.unit === '份' ? 'selected' : ''}>${u.unit}</option>`).join('')}
                </select>
              </div>
              <div style="flex:1;">
                <label style="font-size:11px; color:#6b7280;">约克重:</label>
                <input class="ph-input" id="food-gpu" type="number" value="350">
              </div>
            </div>
            <div style="font-size:10px; color:#9ca3af; margin:-6px 0 10px;">"约克重"是每个单位约合多少克，不确定可以不填，AI估算时会自动按你选的单位帮你判断实际重量</div>

            <div style="background:#f9fafb; padding:8px; border-radius:6px; margin-bottom:12px; font-size:11px; color:#4b5563;" id="calc-preview">
              计算结果: 预估热量 <b>0</b> kcal
            </div>

            <div style="display:flex; gap:6px;">
              <button class="ph-btn ph-btn-secondary" id="btn-ai-est" style="flex:1;">🤖 AI按份量估算</button>
              <button class="ph-btn ph-btn-primary" id="btn-confirm-add" style="flex:1;">确认添加</button>
            </div>
          `;

          const sel = dialogEl.querySelector("#food-select");
          const nameInput = dialogEl.querySelector("#food-name");
          const qtyInput = dialogEl.querySelector("#food-qty");
          const unitSel = dialogEl.querySelector("#food-unit");
          const gpuInput = dialogEl.querySelector("#food-gpu");
          const preview = dialogEl.querySelector("#calc-preview");

          function currentUnit() { return UNIT_OPTIONS[unitSel.value] || UNIT_OPTIONS[0]; }
          function totalGrams() {
            const qty = parseFloat(qtyInput.value) || 0;
            const gpu = parseFloat(gpuInput.value) || currentUnit().grams;
            return qty * gpu;
          }

          function updatePreview() {
            dialogEl._aiResult = null; // 手动改动份量后，AI 估算结果失效，避免份量与结果对不上
            const grams = totalGrams();
            const selIdx = sel.value;
            if (selIdx !== "") {
              const base = PRESET_FOODS[selIdx];
              const c = Math.round((base.cal * grams) / 100);
              preview.innerHTML = `计算结果 (共${grams}g): <b>${c}</b> kcal (蛋白:${Math.round((base.p*grams)/100)}g 碳水:${Math.round((base.c*grams)/100)}g)`;
            } else {
              preview.innerHTML = `手动输入模式 (共约${grams}g) - 建议点击「AI按份量估算」`;
            }
          }

          sel.onchange = () => {
            if (sel.value !== "") {
              nameInput.value = PRESET_FOODS[sel.value].name;
              unitSel.value = UNIT_OPTIONS.findIndex(u => u.unit === "克");
              gpuInput.value = 100;
              qtyInput.value = 100;
            }
            updatePreview();
          };
          unitSel.onchange = () => {
            gpuInput.value = currentUnit().grams;
            updatePreview();
          };
          qtyInput.oninput = updatePreview;
          gpuInput.oninput = updatePreview;

          // AI 一键智能估算菜肴：直接按用户填写的"数量+单位"估算，不强制先换算成克重
          dialogEl.querySelector("#btn-ai-est").onclick = async () => {
            const fname = nameInput.value.trim();
            const qty = qtyInput.value || "1";
            const unit = currentUnit().unit;
            const gpuHint = gpuInput.value ? `（用户预估每${unit}约${gpuInput.value}克，仅供参考，可按你对这道菜的常识修正）` : "";
            if (!fname) { ctx.ui.toast("请输入食物名称"); return; }

            ctx.ui.toast("AI 正在分析食物热量与营养...");
            const prompt = `估算食物 "${fname}" 在食用份量为 "${qty}${unit}" 时的总营养成分${gpuHint}。请结合这道菜的常见做法自行判断合理总重量，仅回答严格 JSON，格式如: {"cal":650, "p":28, "c":85, "f":18, "grams":380}，grams 为你估算的总重量(克)，不要包含任何额外文字。`;

            try {
              const res = await ctx.model.ask({ prompt });
              const clean = res.replace(/```json|```/g, "").trim();
              const parsed = JSON.parse(clean);

              if (parsed.grams) gpuInput.value = Math.round(parsed.grams / (parseFloat(qty) || 1));
              preview.innerHTML = `🤖 AI估算结果 (共约${parsed.grams || totalGrams()}g): <b>${parsed.cal}</b> kcal (蛋白:${parsed.p||0}g 碳水:${parsed.c||0}g 脂肪:${parsed.f||0}g)`;
              dialogEl._aiResult = parsed;
            } catch (e) {
              ctx.ui.toast("AI 估算失败，请重试");
            }
          };

          // 确认添加
          dialogEl.querySelector("#btn-confirm-add").onclick = () => {
            const fname = nameInput.value.trim();
            const qty = parseFloat(qtyInput.value) || 1;
            const unit = currentUnit().unit;
            if (!fname) { ctx.ui.toast("请填入食物名称"); return; }

            let itemData = { name: fname, qty, unit, weight: 0, cal: 0, p: 0, c: 0, f: 0 };

            if (dialogEl._aiResult) {
              itemData.weight = Math.round(dialogEl._aiResult.grams || totalGrams());
              itemData.cal = dialogEl._aiResult.cal;
              itemData.p = dialogEl._aiResult.p || 0;
              itemData.c = dialogEl._aiResult.c || 0;
              itemData.f = dialogEl._aiResult.f || 0;
            } else if (sel.value !== "") {
              const base = PRESET_FOODS[sel.value];
              const grams = totalGrams();
              itemData.weight = Math.round(grams);
              itemData.cal = Math.round((base.cal * grams) / 100);
              itemData.p = Math.round((base.p * grams) / 100);
              itemData.c = Math.round((base.c * grams) / 100);
              itemData.f = Math.round((base.f * grams) / 100);
            } else {
              // 未使用 AI 估算时的粗略兜底
              const grams = totalGrams();
              itemData.weight = Math.round(grams);
              itemData.cal = Math.round(grams * 1.5);
            }

            if (!dayLog.meals[mealKey]) dayLog.meals[mealKey] = [];
            dayLog.meals[mealKey].push(itemData);
            saveDayLog(currentDateKey, dayLog);
            close();
            render();
          };
        });
      }

      // 打开【添加运动】弹窗
      function openAddExerciseModal(dayLog) {
        ctx.ui.dialog((dialogEl, { close }) => {
          dialogEl.style.cssText = "width:280px; padding:16px;";
          dialogEl.innerHTML = `
            <div style="font-weight:600; margin-bottom:10px; font-size:14px;">添加运动记录</div>
            <div style="margin-bottom:10px;">
              <label style="font-size:11px; color:#6b7280;">选择运动或自定义:</label>
              <select class="ph-select" id="ex-select" style="margin-top:4px;">
                <option value="">-- 自定义 --</option>
                ${PRESET_EXERCISES.map((e, i) => `<option value="${i}">${e.name} (${e.calPerMin}kcal/分钟)</option>`).join('')}
              </select>
            </div>
            <div style="margin-bottom:10px;">
              <label style="font-size:11px; color:#6b7280;">运动名称:</label>
              <input class="ph-input" id="ex-name" placeholder="如: 打羽毛球">
            </div>
            <div style="margin-bottom:10px;">
              <label style="font-size:11px; color:#6b7280;">时长 (分钟):</label>
              <input class="ph-input" id="ex-min" type="number" value="30">
            </div>
            <div style="background:#f9fafb; padding:8px; border-radius:6px; margin-bottom:12px; font-size:11px; color:#4b5563;" id="ex-preview">
              预估消耗: <b>0</b> kcal
            </div>
            <button class="ph-btn ph-btn-primary" id="btn-ex-add" style="width:100%;">确认添加</button>
          `;

          const sel = dialogEl.querySelector("#ex-select");
          const nameInput = dialogEl.querySelector("#ex-name");
          const minInput = dialogEl.querySelector("#ex-min");
          const preview = dialogEl.querySelector("#ex-preview");

          function updatePreview() {
            const min = parseFloat(minInput.value) || 0;
            if (sel.value !== "") {
              const cal = Math.round(PRESET_EXERCISES[sel.value].calPerMin * min);
              preview.innerHTML = `预估消耗: <b>${cal}</b> kcal`;
            } else {
              preview.innerHTML = `自定义运动，将按 6kcal/分钟 粗略估算，可添加后自行核对`;
            }
          }
          sel.onchange = () => {
            if (sel.value !== "") nameInput.value = PRESET_EXERCISES[sel.value].name;
            updatePreview();
          };
          minInput.oninput = updatePreview;
          updatePreview();

          dialogEl.querySelector("#btn-ex-add").onclick = () => {
            const name = nameInput.value.trim();
            const minutes = parseFloat(minInput.value) || 0;
            if (!name) { ctx.ui.toast("请填入运动名称"); return; }

            let cal;
            if (sel.value !== "") cal = Math.round(PRESET_EXERCISES[sel.value].calPerMin * minutes);
            else cal = Math.round(minutes * 6.0);

            if (!dayLog.exercises) dayLog.exercises = [];
            dayLog.exercises.push({ name, minutes, cal });
            saveDayLog(currentDateKey, dayLog);
            close();
            render();
          };
        });
      }

      // --------------------------------------------------
      // Tab 3: 便利签流评查看
      // --------------------------------------------------
      function renderCalendarTab(parent) {
        const reviews = getDayReviews(currentDateKey);

        const card = document.createElement("div");
        card.className = "ph-card";
        card.innerHTML = `
          <div class="ph-flex-between" style="margin-bottom: 8px;">
            <span style="font-weight:600;">便利签手记 (${currentDateKey})</span>
            <span class="ph-pill">${reviews.length} 条 Char 点评</span>
          </div>
          <div style="font-size:11px; color:#6b7280;">切换顶栏日期，可查看当日各个 Char 留下的贴纸点评。</div>
        `;

        if (reviews.length === 0) {
          const empty = document.createElement("div");
          empty.style.cssText = "text-align:center; color:#9ca3af; padding:20px 0; font-size:12px;";
          empty.textContent = "今日暂无留言，快去【概览】页邀请 Char 评价吧！";
          card.appendChild(empty);
        } else {
          reviews.forEach(r => {
            const note = document.createElement("div");
            note.className = "ph-sticky-note";
            note.innerHTML = `
              <div class="ph-flex-between" style="border-bottom:1px solid rgba(0,0,0,0.08); padding-bottom:4px; margin-bottom:6px;">
                <span style="font-weight:700;">📌 ${r.charName} 的留评</span>
                <span style="font-size:10px; opacity:0.6;">${r.time}</span>
              </div>
              <div style="font-size:12px; line-height:1.5; white-space:pre-wrap;">${r.content}</div>
            `;
            card.appendChild(note);
          });
        }

        parent.appendChild(card);
      }

      // --------------------------------------------------
      // Tab 4: 档案设置
      // --------------------------------------------------
      function renderProfileTab(parent, prof) {
        const card = document.createElement("div");
        card.className = "ph-card";
        card.innerHTML = `
          <div style="font-weight:600; margin-bottom:12px;">个人健康档案</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
            <div><label style="font-size:10px; color:#6b7280;">身高 (cm)</label><input class="ph-input" id="p-h" value="${prof.height}"></div>
            <div><label style="font-size:10px; color:#6b7280;">体重 (kg)</label><input class="ph-input" id="p-w" value="${prof.weight}"></div>
          </div>
          <div style="margin-bottom:8px;">
            <label style="font-size:10px; color:#6b7280;">健康目标</label>
            <select class="ph-select" id="p-goal">
              <option value="fat_loss" ${prof.goal==='fat_loss'?'selected':''}>减脂 (赤字400kcal)</option>
              <option value="maintain" ${prof.goal==='maintain'?'selected':''}>保持体重 (收支平衡)</option>
              <option value="muscle_gain" ${prof.goal==='muscle_gain'?'selected':''}>增肌 (盈余300kcal)</option>
            </select>
          </div>
          <button class="ph-btn ph-btn-primary" id="btn-save-p" style="width:100%; margin-top:8px;">保存档案</button>
        `;
        card.querySelector("#btn-save-p").onclick = () => {
          prof.height = parseFloat(card.querySelector("#p-h").value) || 165;
          prof.weight = parseFloat(card.querySelector("#p-w").value) || 60;
          prof.goal = card.querySelector("#p-goal").value;
          ctx.kit.kv.set("user_profile", prof);
          ctx.ui.toast("档案设置已成功更新");
          render();
        };
        parent.appendChild(card);

        // 默认分享对话绑定
        const bindCard = document.createElement("div");
        bindCard.className = "ph-card";
        bindCard.innerHTML = `
          <div style="font-weight:600; margin-bottom:6px;">默认分享对话</div>
          <div style="color:#6b7280; font-size:11px; margin-bottom:10px;">绑定后，【概览】页的"分享日报卡片到对话"会自动固定发到这一个对话，不会每次弹窗选择，避免同一份记录被分散发到不同角色/对话里。</div>
          <div class="ph-flex-between">
            <span class="ph-pill">${prof.boundThreadName ? '已绑定: ' + prof.boundThreadName : '尚未绑定'}</span>
            <div style="display:flex; gap:6px;">
              <button class="ph-btn ph-btn-secondary" id="btn-rebind" style="font-size:11px;">${prof.boundThreadName ? '更换' : '去绑定'}</button>
              ${prof.boundThreadName ? '<button class="ph-btn ph-btn-secondary" id="btn-unbind" style="font-size:11px;">解绑</button>' : ''}
            </div>
          </div>
        `;
        bindCard.querySelector("#btn-rebind").onclick = () => {
          const threads = ctx.threads.list() || [];
          if (threads.length === 0) { ctx.ui.toast("当前没有打开的对话窗口"); return; }
          ctx.ui.dialog((dialogEl, { close }) => {
            dialogEl.style.cssText = "width:280px; padding:14px;";
            dialogEl.innerHTML = `<div style="font-weight:600; margin-bottom:10px;">选择要绑定的对话</div><div id="bind-list"></div>`;
            const listEl = dialogEl.querySelector("#bind-list");
            threads.forEach(th => {
              const item = document.createElement("div");
              item.style.cssText = "padding:8px; border-bottom:1px solid #f3f4f6; cursor:pointer; font-size:12px;";
              item.textContent = th.title || th.id;
              item.onclick = () => {
                prof.boundThreadId = th.id;
                prof.boundThreadName = th.title || th.id;
                ctx.kit.kv.set("user_profile", prof);
                ctx.ui.toast(`已绑定「${prof.boundThreadName}」`);
                close();
                render();
              };
              listEl.appendChild(item);
            });
          });
        };
        const unbindBtn = bindCard.querySelector("#btn-unbind");
        if (unbindBtn) unbindBtn.onclick = () => {
          delete prof.boundThreadId;
          delete prof.boundThreadName;
          ctx.kit.kv.set("user_profile", prof);
          ctx.ui.toast("已解绑，下次分享将重新弹窗选择");
          render();
        };
        parent.appendChild(bindCard);
      }

      render();
    });
  }
};