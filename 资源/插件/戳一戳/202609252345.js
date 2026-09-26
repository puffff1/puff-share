export default {
  manifest: {
    id: "puff-poke-interaction",
    name: "双向戳一戳",
    engine: "puff",
    apiVersion: 1,
    version: "1.3.0",
    description: "点击输入框上方的戳一戳按钮，即可发送一个可点击修改/删除的系统动作提示，大模型会强制对此作出反应。",
    settings: [
      { 
        key: "userName", 
        label: "你的名字（展示在提示中）", 
        type: "text", 
        default: "我" 
      },
      { 
        key: "userAction", 
        label: "你的戳一戳动作", 
        type: "text", 
        default: "打了他一下",
        description: "点击按钮时你对角色做的动作"
      }
    ]
  },
  setup(ctx) {
    // 1. UI 渲染：输入框上方的“戳一戳”按钮
    ctx.ui.place("composer.rail", (el, props) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "戳一戳";
      btn.style.cssText = "border:0; background:rgba(0,0,0,.06); border-radius:999px; padding:4px 12px; font-size:12px; color:inherit; cursor:pointer; margin:4px 0;";
      
      btn.onclick = () => {
        // 获取角色名字
        const th = ctx.threads.get(props.sessionId || "");
        let charName = "对方";
        if (th && th.characterId) {
          const char = ctx.personas.get(th.characterId);
          if (char && char.name) charName = char.name;
        }

        const userName = String(ctx.kit.prefs.get("userName") || "我").trim();
        const action = String(ctx.kit.prefs.get("userAction") || "打了他一下").trim();
        
        const msg = `“${userName}”戳一戳了“${charName}”并且“${action}”`;
        
        // 推入本地数据库（打上特定的 mediaType，方便我们自己渲染和控制）
        ctx.rows.push({
          sessionId: props.sessionId,
          role: "system",
          mediaType: "poke",
          content: msg
        });
        
        ctx.ui.toast("戳一戳已发");
      };
      
      el.appendChild(btn);
    });

    // 2. 自定义渲染与修改/删除交互
    ctx.ui.bubbleType("poke", (el, msg) => {
      // 占满整行并居中
      el.style.cssText = "display: flex; justify-content: center; width: 100%; margin: 6px 0;";
      
      // 如果已被标记为撤回，隐藏它
      if (msg.content === "*(已撤回)*") {
        el.style.display = "none";
        return;
      }

      // 画出类似系统提示的灰色小药丸
      const pill = document.createElement("div");
      pill.textContent = msg.content;
      pill.style.cssText = "font-size: 12px; color: inherit; opacity: 0.6; background: rgba(128,128,128,0.15); padding: 4px 12px; border-radius: 12px; cursor: pointer; user-select: none; max-width: 85%; text-align: center; word-break: break-word;";
      pill.title = "点击修改或删除";

      // 点击（或双击）弹出修改/删除层
      pill.onclick = () => {
        ctx.ui.dialog((dialogEl, { close }) => {
          dialogEl.style.cssText = "background: var(--surface-1, #2c2c2e); color: var(--text-1, #eee); padding: 16px; border-radius: 12px; width: 280px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; font-size: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);";
          
          const title = document.createElement("div");
          title.textContent = "修改或删除该动作";
          title.style.cssText = "font-weight: bold; text-align: center;";
          dialogEl.appendChild(title);
          
          const input = document.createElement("textarea");
          input.value = msg.content;
          input.style.cssText = "width: 100%; height: 80px; background: rgba(128,128,128,0.1); color: inherit; border: 1px solid rgba(128,128,128,0.3); border-radius: 8px; padding: 8px; box-sizing: border-box; font-family: inherit; resize: none; font-size: 13px;";
          dialogEl.appendChild(input);
          
          const btnRow = document.createElement("div");
          btnRow.style.cssText = "display: flex; gap: 12px; margin-top: 4px;";
          
          const btnDel = document.createElement("button");
          btnDel.textContent = "删除";
          btnDel.style.cssText = "background: rgba(255,69,58,0.15); color: #ff453a; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 13px; flex: 1;";
          btnDel.onclick = () => {
            // 尝试彻底删除，如果不被宿主支持则清空内容隐藏
            if (typeof ctx.rows.remove === "function") {
              ctx.rows.remove(msg.id);
            } else {
              ctx.rows.patch(msg.id, { content: "*(已撤回)*" });
            }
            close();
          };
          
          const btnSave = document.createElement("button");
          btnSave.textContent = "保存";
          btnSave.style.cssText = "background: rgba(128,128,128,0.2); color: inherit; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 13px; flex: 1;";
          btnSave.onclick = () => {
            const newVal = input.value.trim();
            if (!newVal) {
              if (typeof ctx.rows.remove === "function") ctx.rows.remove(msg.id);
              else ctx.rows.patch(msg.id, { content: "*(已撤回)*" });
            } else {
              ctx.rows.patch(msg.id, { content: newVal });
            }
            close();
          };
          
          btnRow.appendChild(btnDel);
          btnRow.appendChild(btnSave);
          dialogEl.appendChild(btnRow);
        });
      };
      
      el.appendChild(pill);
    });

    // 3. 把“戳一戳”强行塞进发送给模型的请求中
    ctx.pipe.rewrite("model.payload", (p) => {
      const rows = ctx.rows.list(p.sessionId);
      let recentPokes = [];
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].role === "assistant") break;
        // 抓取新的 poke 动作（或者兼容旧版本的系统文本动作）
        if (rows[i].mediaType === "poke" || (rows[i].role === "system" && rows[i].content.includes("戳一戳"))) {
          if (rows[i].content && rows[i].content !== "*(已撤回)*") {
            recentPokes.unshift(rows[i].content);
          }
        }
      }

      // 如果有戳一戳动作，强行拼接到请求体里
      if (recentPokes.length > 0) {
        const lastUserMsgIndex = p.messages.map(m => m.role).lastIndexOf("user");
        const pokeContext = `\n\n【系统强制提示：用户刚才对你做了以下动作：\n${recentPokes.join("\n")}\n请务必在你的回复中对此做出反应。如果你想戳回用户，请在回复的最开头使用 <poke>你的反击动作</poke> 的格式！】`;

        if (lastUserMsgIndex !== -1) {
          p.messages[lastUserMsgIndex].content += pokeContext;
        } else {
          p.messages.push({ role: "system", content: pokeContext });
        }
      }
      return p;
    });

    // 4. 教角色怎么戳回你
    ctx.pipe.rewrite("prompt.hint", (p) => {
      const instruction = "【互动规则】如果收到提示说用户戳了你，你必须根据人设做出回应。如果决定反击/戳回用户，请只在回复的最开头使用 <poke>你的动作</poke> 的格式，例如 <poke>反手捏住了你的脸</poke>。注意：标签内只写动作即可，不需要写名字。";
      p.hint = p.hint ? p.hint + "\n\n" + instruction : instruction;
      return p;
    });

    // 5. 抓取角色的反击
    ctx.pipe.rewrite("model.raw", (p) => {
      const match = p.text.match(/<poke>([\s\S]*?)<\/poke>/);
      if (match) {
        p.text = p.text.replace(match[0], "").trim();
        
        const th = ctx.threads.get(p.sessionId || "");
        let charName = "对方";
        if (th && th.characterId) {
          const char = ctx.personas.get(th.characterId);
          if (char && char.name) charName = char.name;
        }
        const userName = String(ctx.kit.prefs.get("userName") || "我").trim();
        const charAction = match[1].trim();
        
        // 同样记录为 mediaType: poke，你甚至也能点击修改/删除对方的反戳！
        const msg = `“${charName}”戳了戳“${userName}”并且“${charAction}”`;
        
        ctx.rows.push({
          sessionId: p.sessionId,
          role: "system",
          mediaType: "poke",
          content: msg
        });
        
        if (!p.text) {
          p.text = "*(给出回应)*";
        }
      }
      return p;
    });
  }
};
