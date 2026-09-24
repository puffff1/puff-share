export default {
  manifest: {
    id: "puff-role-album",
    name: "相册",
    engine: "puff",
    apiVersion: 1,
    description: "为角色准备公共与专属相册。打上标签后，聊天中索要照片会优先调取本地图库原图发送，省去生图额度；相册没有对应照片时，正常支持 AI 自由生图。",
    app: { name: "相册", icon: "https://i.postimg.cc/bJfWDNSm/instagram-svgrepo-com.png" },
  },
  setup(ctx) {
    // 1. 最高优先级人设级注入：将指令直接刻入底层 System Prompt (等效修改人设)
    ctx.pipe.rewrite("model.payload", (p) => {
      const sessionId = p.sessionId || "";
      const thread = ctx.threads.get(sessionId);
      const characterId = thread ? thread.characterId : null;
      
      const album = ctx.kit.kv.get("photos") || [];
      const availablePhotos = album.filter(item => item.scope === "public" || item.targetId === characterId);
      
      if (availablePhotos.length > 0 && p.messages && p.messages.length > 0) {
        const tagList = availablePhotos.map(img => `[${img.id}] (画面描述:${img.tags.join(",")})`).join(" | ");
        
        // 结合 XML 强指令与人设 DNA 的终极版
        const personaCommand = `\n\n<system_override priority="MAX_CRITICAL">\n【核心互动：照片发送机制】\n你随身带有一部手机，里面存有真实的本地相册。当对方主动索要照片，或剧情发展需要你发送照片时：\n1. 请立刻检查以下【本地图库代码清单】。\n2. 若清单中有符合情境的照片，你**必须且只能**直接输出对应的代码（格式如：[img_xxxx]）来发送原图。绝对禁止调用任何内置画图或生图功能！\n3. 只有当对方索要的照片在本地图库里完全找不到时，你才可以正常调用画图功能。\n【本地图库代码及描述清单】：\n${tagList}\n</system_override>`;
        
        // 寻找对话的 System Prompt（底层人设），通常是第一条消息
        const systemMsg = p.messages.find(m => m.role === "system");
        
        if (systemMsg && typeof systemMsg.content === "string") {
          // 直接将规则无缝缝合在人设的最末尾，获得绝对最高权重
          systemMsg.content += personaCommand;
        } else {
          // 如果罕见地没有 system 消息，则强行插在最前面作为系统级指令
          p.messages.unshift({
            role: "system",
            content: personaCommand
          });
        }
      }
      return p;
    });

    // 2. 消息落库拦截：将带有图片代码的消息，直接转化为原生图片气泡
    ctx.pipe.rewrite("save.row", (p) => {
      const album = ctx.kit.kv.get("photos") || [];
      if (p.message && typeof p.message.content === "string") {
        const match = p.message.content.match(/\[?【?(img_\d+)】?\]?/i);
        if (match) {
          const photo = album.find(img => img.id === match[1].toLowerCase());
          if (photo) {
            p.message.mediaType = "image";
            p.message.mediaUrl = photo.url;
            p.message.content = p.message.content.replace(match[0], "").trim();
          }
        }
      }
      return p;
    });

    // 3. 桌面 App (极简 UI 绝版定型，保持不变)
    return ctx.ui.appPage((el) => {
      el.style.cssText = `
        padding: 24px 20px;
        box-sizing: border-box;
        height: 100%;
        overflow-y: auto;
        background: #fcfcfc;
        color: #111111;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      `;

      const personas = ctx.personas.list() || [];

      el.innerHTML = `
        <div style="max-width: 640px; margin: 0 auto;">
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 400; letter-spacing: -0.5px; font-family: serif;">Archive.</h1>
              <span id="total-count-badge" style="font-size: 12px; color: #999; letter-spacing: 0.5px;">共 0 张</span>
            </div>
            <div style="font-size: 11px; color: #888; margin-top: 2px;">角色专属与公共影像档案馆</div>
          </div>

          <div style="margin-bottom: 24px; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 16px;">
            <div style="font-size: 11px; font-weight: 500; color: #444; margin-bottom: 8px; letter-spacing: 0.5px; text-transform: uppercase;">添加新影像</div>
            
            <input type="file" id="photo-file" accept="image/*" style="display: none;" />
            
            <div style="display: flex; gap: 6px; align-items: center; width: 100%;">
              <div id="file-drop-area" style="flex-shrink: 0; padding: 8px 10px; background: #f5f5f7; border: 1px solid rgba(0,0,0,0.08); border-radius: 6px; text-align: center; cursor: pointer; font-size: 11px; color: #555;">
                <span id="file-tip">选择图片</span>
              </div>
              <select id="photo-scope" style="flex-shrink: 0; width: 85px; padding: 8px 4px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.08); background: #f5f5f7; font-size: 11px; color: #333; outline: none; text-overflow: ellipsis;">
                <option value="public">公共相册</option>
                ${personas.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
              </select>
              <input type="text" id="photo-tags" placeholder="标签(逗号隔开)" style="flex: 1; min-width: 0; padding: 8px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.08); background: #f5f5f7; font-size: 11px; color: #333; outline: none;" />
              <button id="upload-btn" style="flex-shrink: 0; padding: 8px 14px; background: #111111; color: #fff; border: 0; border-radius: 6px; font-size: 11px; font-weight: 500; cursor: pointer;">存入</button>
            </div>
          </div>

          <div style="border-bottom: 1px solid rgba(0,0,0,0.06); margin-bottom: 14px; display: flex; gap: 20px; overflow-x: auto; padding-bottom: 2px;" id="persona-tabs-container">
          </div>

          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 18px;" id="tag-filters-container">
          </div>
          
          <div id="photo-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; padding-bottom: 40px;"></div>
          
          <!-- 添加了专属署名 -->
          <div style="position: fixed; bottom: 16px; right: 20px; font-size: 10px; color: #ccc; pointer-events: none; user-select: none;">by Akoasm</div>
        </div>
      `;

      const fileInput = el.querySelector("#photo-file");
      const fileDropArea = el.querySelector("#file-drop-area");
      const fileTip = el.querySelector("#file-tip");
      const uploadBtn = el.querySelector("#upload-btn");
      const scopeSelect = el.querySelector("#photo-scope");
      const tagsInput = el.querySelector("#photo-tags");
      
      const personaTabsContainer = el.querySelector("#persona-tabs-container");
      const tagFiltersContainer = el.querySelector("#tag-filters-container");
      const listContainer = el.querySelector("#photo-list");
      const countBadge = el.querySelector("#total-count-badge");

      let currentPersonaFilter = "public";
      let currentTagFilter = "all";

      fileDropArea.onclick = () => fileInput.click();
      fileInput.onchange = () => {
        if (fileInput.files && fileInput.files[0]) {
          fileTip.textContent = fileInput.files[0].name;
          fileDropArea.style.background = "#e8e8ed";
        } else {
          fileTip.textContent = "选择图片";
        }
      };

      function renderPersonaTabs(list) {
        let html = `<div class="persona-tab ${currentPersonaFilter === 'public' ? 'active' : ''}" data-id="public" style="padding-bottom: 6px; font-size: 12px; font-weight: ${currentPersonaFilter === 'public' ? '600' : '400'}; color: ${currentPersonaFilter === 'public' ? '#111' : '#888'}; cursor: pointer; white-space: nowrap; border-bottom: 2px solid ${currentPersonaFilter === 'public' ? '#111' : 'transparent'}; transition: all 0.2s;">公共相册</div>`;

        personas.forEach(p => {
          const active = currentPersonaFilter === p.id;
          html += `<div class="persona-tab ${active ? 'active' : ''}" data-id="${p.id}" style="padding-bottom: 6px; font-size: 12px; font-weight: ${active ? '600' : '400'}; color: ${active ? '#111' : '#888'}; cursor: pointer; white-space: nowrap; border-bottom: 2px solid ${active ? '#111' : 'transparent'}; transition: all 0.2s;">${p.name}</div>`;
        });

        personaTabsContainer.innerHTML = html;

        personaTabsContainer.querySelectorAll(".persona-tab").forEach(tab => {
          tab.onclick = () => {
            currentPersonaFilter = tab.getAttribute("data-id");
            renderList();
          };
        });
      }

      function renderTagFilters(list) {
        const tagSet = new Set();
        list.forEach(item => {
          if (item.tags) item.tags.forEach(t => tagSet.add(t));
        });

        let html = `<div class="tag-pill ${currentTagFilter === 'all' ? 'active' : ''}" data-tag="all" style="padding: 3px 8px; border-radius: 99px; font-size: 11px; background: ${currentTagFilter === 'all' ? '#111' : '#f0f0f2'}; color: ${currentTagFilter === 'all' ? '#fff' : '#555'}; cursor: pointer; transition: all 0.2s;">全部标签</div>`;

        tagSet.forEach(tag => {
          const active = currentTagFilter === tag;
          html += `<div class="tag-pill ${active ? 'active' : ''}" data-tag="${tag}" style="padding: 3px 8px; border-radius: 99px; font-size: 11px; background: ${active ? '#111' : '#f0f0f2'}; color: ${active ? '#fff' : '#555'}; cursor: pointer; transition: all 0.2s;">#${tag}</div>`;
        });

        tagFiltersContainer.innerHTML = html;

        tagFiltersContainer.querySelectorAll(".tag-pill").forEach(pill => {
          pill.onclick = () => {
            currentTagFilter = pill.getAttribute("data-tag");
            renderList();
          };
        });
      }

      function renderList() {
        const list = ctx.kit.kv.get("photos") || [];
        countBadge.textContent = `共 ${list.length} 张`;

        renderPersonaTabs(list);
        renderTagFilters(list);

        const filteredList = list.filter(item => {
          let matchPersona = true;
          if (currentPersonaFilter === "public") {
            matchPersona = (item.scope === "public");
          } else {
            matchPersona = (item.targetId === currentPersonaFilter);
          }

          let matchTag = true;
          if (currentTagFilter !== "all") {
            matchTag = item.tags && item.tags.includes(currentTagFilter);
          }

          return matchPersona && matchTag;
        });

        if (filteredList.length === 0) {
          listContainer.innerHTML = `<div style="grid-column: 1 / -1; font-size: 12px; color: #888; text-align: center; padding: 40px; background: #fff; border-radius: 12px; border: 1px dashed rgba(0,0,0,0.06);">暂无符合条件的影像记录</div>`;
          return;
        }

        listContainer.innerHTML = "";
        filteredList.slice().reverse().forEach((item) => {
          const card = document.createElement("div");
          card.style.cssText = `
            background: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.02);
            border: 1px solid rgba(0,0,0,0.04);
            display: flex;
            flex-direction: column;
            user-select: none;
            -webkit-user-select: none;
          `;
          
          let targetName = "公共相册";
          if (item.scope !== "public") {
            const matchedPersona = personas.find(p => p.id === item.targetId);
            targetName = matchedPersona ? matchedPersona.name : "专属角色";
          }

          // 移除了按钮，改为长按提示
          card.innerHTML = `
            <div style="width: 100%; height: 120px; background-image: url('${item.url}'); background-size: cover; background-position: center; background-color: #f5f5f7;"></div>
            <div style="padding: 8px; display: flex; flex-direction: column; gap: 3px; flex: 1;">
              <div style="font-size: 11px; font-weight: 500; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${targetName}</div>
              <div style="font-size: 10px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">#${item.tags.join(" #") || "无标签"}</div>
              <div style="font-size: 9px; color: #bbb; margin-top: auto; padding-top: 4px;">长按图片删除</div>
            </div>
          `;
          
          // 长按删除逻辑 (600ms 触发)
          let pressTimer;
          const startPress = () => {
            pressTimer = setTimeout(() => {
              if (confirm("确定要删除这张照片吗？")) {
                const currentList = ctx.kit.kv.get("photos") || [];
                const newList = currentList.filter(p => p.id !== item.id);
                ctx.kit.kv.set("photos", newList);
                ctx.ui.toast("已移除");
                renderList();
              }
            }, 600);
          };
          const cancelPress = () => {
            if (pressTimer) clearTimeout(pressTimer);
          };

          // 绑定移动端触摸和PC端鼠标事件
          card.addEventListener("touchstart", startPress, { passive: true });
          card.addEventListener("touchend", cancelPress);
          card.addEventListener("touchmove", cancelPress);
          
          card.addEventListener("mousedown", startPress);
          card.addEventListener("mouseup", cancelPress);
          card.addEventListener("mouseleave", cancelPress);

          listContainer.appendChild(card);
        });
      }

      renderList();

      uploadBtn.onclick = () => {
        const file = fileInput.files[0];
        if (!file) {
          ctx.ui.toast("请先选择一张图片");
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target.result;
          const list = ctx.kit.kv.get("photos") || [];
          
          const selectedVal = scopeSelect.value;
          const isPublic = selectedVal === "public";

          list.push({
            id: "img_" + Date.now(),
            url: base64,
            scope: isPublic ? "public" : "character",
            targetId: isPublic ? null : selectedVal,
            tags: tagsInput.value.split(/[,，]/).map(t => t.trim()).filter(Boolean)
          });
          
          ctx.kit.kv.set("photos", list);
          ctx.ui.toast("存入成功");
          
          fileInput.value = "";
          fileTip.textContent = "选择图片";
          fileDropArea.style.background = "#f5f5f7";
          tagsInput.value = "";
          renderList();
        };
        reader.readAsDataURL(file);
      };
    });
  },
};
