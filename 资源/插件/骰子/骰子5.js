export default {
  manifest: {
    id: "puff-roll-dice",
    name: "骰子Roll点",
    engine: "puff",
    apiVersion: 1,
    version: "1.2.1",
    description: "输入框上方添加掷点按钮，带动画效果，支持角色同步掷点开关",
    settings: [
      {
        key: "sides",
        label: "骰子面数",
        type: "number",
        default: 100,
        description: "掷点最大数值，如100对应D100骰子"
      },
      {
        key: "autoCharRoll",
        label: "角色同步掷点",
        type: "boolean",
        default: false,
        description: "单聊时你掷点后角色自动跟着掷一次"
      }
    ]
  },
  setup(ctx) {
    // 注入全局动画与样式
    ctx.ui.css(`
      @keyframes puff-roll-fade-in {
        from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes puff-roll-fade-out {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(-12px); }
      }
      .puff-roll-toast {
        position: fixed;
        top: 22%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.78);
        color: #fff;
        padding: 22px 36px;
        border-radius: 18px;
        font-size: 34px;
        font-weight: 600;
        z-index: 9999;
        text-align: center;
        min-width: 130px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
        animation: puff-roll-fade-in 0.3s ease forwards;
        user-select: none;
      }
      .puff-roll-toast.hide {
        animation: puff-roll-fade-out 0.3s ease forwards;
      }
      .puff-roll-btn-wrap {
        display: flex;
        justify-content: flex-end;
        padding: 4px 2px 6px;
      }
      .puff-roll-btn {
        border: none;
        background: rgba(99, 102, 241, 0.12);
        color: #6366f1;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .puff-roll-btn:active {
        transform: scale(0.94);
        background: rgba(99, 102, 241, 0.22);
      }
    `);

    let isRolling = false;

    // 输入框上方常驻按钮
    ctx.ui.place("composer.rail", (el, props) => {
      el.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "puff-roll-btn-wrap";
      
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "puff-roll-btn";
      btn.textContent = "🎲";
      
      btn.onclick = () => {
        if (isRolling) return;
        isRolling = true;

        const sides = Math.max(2, parseInt(ctx.kit.prefs.get("sides")) || 100);
        const userName = "我";
        const sessionId = props.sessionId;
        const isGroup = props.isGroup;
        const autoCharRoll = ctx.kit.prefs.get("autoCharRoll") === true;

        // 生成用户掷点结果
        const userResult = Math.floor(Math.random() * sides) + 1;

        // 创建悬浮动画窗口
        const toastEl = document.createElement("div");
        toastEl.className = "puff-roll-toast";
        toastEl.textContent = "🎲";
        document.body.appendChild(toastEl);

        let interval = 50;
        let elapsed = 0;
        const totalDuration = 1600;

        function rollStep() {
          toastEl.textContent = Math.floor(Math.random() * sides) + 1;
          
          elapsed += interval;
          // 70% 进度后减速，模拟骰子停转
          if (elapsed > totalDuration * 0.7) {
            interval += 35;
          }

          if (elapsed >= totalDuration) {
            // 定格最终结果
            toastEl.textContent = `🎲 ${userResult}`;
            
            // 写入用户气泡，显式指定文本气泡类型，走完整落库渲染链路
            ctx.rows.push({
              sessionId: sessionId,
              role: "user",
              content: `${userName}🎲 掷出点数：${userResult}`,
              mediaType: "text"
            });

            // 单聊且开启同步掷点时，角色自动掷点
            if (!isGroup && autoCharRoll) {
              const thread = ctx.threads.get(sessionId);
              // 角色名兜底，获取失败则显示“对方”
              let charName = "对方";
              if (thread?.characterId) {
                const persona = ctx.personas.get(thread.characterId);
                if (persona?.name) charName = persona.name;
              }
              
              const charResult = Math.floor(Math.random() * sides) + 1;
              // 延迟模拟角色反应时间
              setTimeout(() => {
                ctx.rows.push({
                  sessionId: sessionId,
                  role: "assistant",
                  content: `${charName}🎲 掷出点数：${charResult}`,
                  mediaType: "text"
                });
              }, 600);
            }

            // 停留后淡出移除
            setTimeout(() => {
              toastEl.classList.add("hide");
              setTimeout(() => {
                toastEl.remove();
                isRolling = false;
              }, 300);
            }, 1000);
            return;
          }

          setTimeout(rollStep, interval);
        }

        // 配合淡入动画延迟启动滚动
        setTimeout(rollStep, 200);
      };

      wrap.appendChild(btn);
      el.appendChild(wrap);
    });
  }
};
