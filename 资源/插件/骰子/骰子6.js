export default {
  manifest: {
    id: "puff-roll-dice",
    name: "骰子Roll点",
    engine: "puff",
    apiVersion: 1,
    version: "1.3.0",
    description: "输入框上方掷点按钮+/roll指令，带动画效果，支持角色同步掷点开关",
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
        description: "单聊时你掷点后角色自动跟着掷一次（结果落库，气泡需重进会话查看）"
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

    // 工具：生成掷点文本
    function rollText(name, sides) {
      const result = Math.floor(Math.random() * sides) + 1;
      return { result, text: `${name}🎲 掷出点数：${result}` };
    }

    // 工具：角色掷点并落库
    function charRoll(sessionId, sides) {
      const thread = ctx.threads.get(sessionId);
      let charName = "对方";
      if (thread?.characterId) {
        const persona = ctx.personas.get(thread.characterId);
        if (persona?.name) charName = persona.name;
      }
      const { text, result } = rollText(charName, sides);
      ctx.rows.push({
        sessionId: sessionId,
        role: "assistant",
        content: text,
        mediaType: "text"
      });
      return { charName, result, text };
    }

    // 模式1：输入 /roll 指令发送，走正常流程气泡即时显示
    ctx.pipe.rewrite("compose.send", (p) => {
      const sides = Math.max(2, parseInt(ctx.kit.prefs.get("sides")) || 100);
      const autoCharRoll = ctx.kit.prefs.get("autoCharRoll") === true;
      const text = p.text.trim();

      // 匹配 /roll 或 /roll 数字
      if (text === "/roll" || text.startsWith("/roll ")) {
        const customSides = parseInt(text.split(" ")[1]);
        const finalSides = customSides > 1 ? customSides : sides;
        const { text: rollResultText } = rollText("我", finalSides);
        p.text = rollResultText;

        // 单聊开启同步则延迟执行角色掷点（落库，气泡需重进可见）
        if (!p.isGroup && autoCharRoll) {
          setTimeout(() => {
            charRoll(p.sessionId, finalSides);
          }, 600);
        }
      }
      return p;
    }, { order: 50 });

    // 模式2：按钮点击快速掷点，动画+落库
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
        const autoCharRoll = ctx.kit.prefs.get("autoCharRoll") === true;
        const sessionId = props.sessionId;
        const isGroup = props.isGroup;

        const { result: userResult, text: userText } = rollText("我", sides);

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
          if (elapsed > totalDuration * 0.7) {
            interval += 35;
          }

          if (elapsed >= totalDuration) {
            toastEl.textContent = `🎲 ${userResult}`;
            
            // 落库保存
            ctx.rows.push({
              sessionId: sessionId,
              role: "user",
              content: userText,
              mediaType: "text"
            });

            // 角色同步掷点
            if (!isGroup && autoCharRoll) {
              setTimeout(() => {
                const { result: charResult } = charRoll(sessionId, sides);
                ctx.ui.toast(`对方掷出：${charResult}`, { durationMs: 1500 });
              }, 800);
            }

            // 淡出移除
            setTimeout(() => {
              toastEl.classList.add("hide");
              setTimeout(() => {
                toastEl.remove();
                isRolling = false;
              }, 300);
            }, 1200);
            return;
          }

          setTimeout(rollStep, interval);
        }

        setTimeout(rollStep, 200);
      };

      wrap.appendChild(btn);
      el.appendChild(wrap);
    });
  }
};
