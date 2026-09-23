export default {
  manifest: {
    id: "puff-xinsheng-diary",
    name: "潜台词 | 角色心声档案",
    engine: "puff",
    apiVersion: 1,
    version: "3.8.0",
    description: "多角色心声精准分类与计数归档，支持搜索、时间轴折叠、私人批注、右侧叉号二次确认删除与弹窗文本复制导出。",
    app: { 
      name: "潜词", 
      icon: "https://i.postimg.cc/wMZrhhWx/origami-crane-svgrepo-com.png" 
    },
    settings: [
      { key: "maxCount", label: "手帐最多保留条数", type: "number", default: 500 }
    ],
  },
  setup(ctx) {
    let lastActiveSessionId = "";
    ctx.watch("thread.open", (p) => {
      if (p && p.sessionId) {
        lastActiveSessionId = p.sessionId;
      }
    });

    ctx.pipe.rewrite("xinsheng.snap", (p) => {
      if (!p.innerThought && !p.deepDesire) return p;

      let sid = p.sessionId || lastActiveSessionId;
      let cid = "unknown";
      let charName = "未知角色";

      if (sid) {
        const th = ctx.threads.get(sid);
        if (th && th.characterId) {
          cid = th.characterId;
        }
      }

      if (cid !== "unknown") {
        const persona = ctx.personas.get(cid);
        if (persona && persona.name) {
          charName = persona.name;
        }
      } else {
        if (sid && sid.includes(":")) {
          const parts = sid.split(":");
          cid = parts[1] || "unknown";
          const persona = ctx.personas.get(cid);
          if (persona && persona.name) {
            charName = persona.name;
          } else {
            charName = "角色 " + cid.slice(0, 6);
          }
        }
      }

      const list = ctx.kit.kv.get("thoughts") || [];
      list.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        t: Date.now(),
        thought: p.innerThought || "",
        desire: p.deepDesire || "",
        linger: p.linger || "",
        annotation: "", 
        characterId: cid,
        characterName: charName
      });

      const max = Number(ctx.kit.prefs.get("maxCount")) || 500;
      if (list.length > max) list.length = max;

      ctx.kit.kv.set("thoughts", list);
      return p;
    });

    return ctx.ui.appPage((el) => {
      el.style.cssText = "width:100%; height:100%; background:#fcfcfc; padding:0; box-sizing:border-box; overflow-y:auto; font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif; color: #333; position:relative;";

      let currentFilterText = "";
      let currentCharId = "all";

      const header = document.createElement("div");
      header.style.cssText = "position:sticky; top:0; background:rgba(252, 252, 252, 0.9); backdrop-filter:blur(12px); padding:24px 20px 0; z-index:10; border-bottom:1px solid rgba(0,0,0,0.04);";
      
      const headerTopRow = document.createElement("div");
      headerTopRow.style.cssText = "display:flex; justify-content:space-between; align-items:flex-start;";

      const titleWrapper = document.createElement("div");
      titleWrapper.innerHTML = `
        <h2 style="margin:0 0 4px; font-size:22px; font-weight:500; letter-spacing:1px; color:#111;">Subtext.</h2>
        <p style="margin:0 0 16px; font-size:11px; color:#999; letter-spacing:1px; font-weight:300;">被折叠的潜台词与心声档案</p>
      `;

      const exportBtn = document.createElement("div");
      exportBtn.innerHTML = "⎘ 导出文本";
      exportBtn.style.cssText = "font-size:11px; color:#666; cursor:pointer; padding:6px 12px; background:#f4f4f4; border-radius:12px; font-weight:500; transition:background 0.2s;";
      exportBtn.onmouseover = () => exportBtn.style.background = "#eaeaea";
      exportBtn.onmouseout = () => exportBtn.style.background = "#f4f4f4";
      exportBtn.onclick = () => {
        let exportList = ctx.kit.kv.get("thoughts") || [];
        if (currentCharId !== "all") exportList = exportList.filter(x => x.characterId === currentCharId);
        if (currentFilterText) {
          const lower = currentFilterText.toLowerCase();
          exportList = exportList.filter(item => 
            (item.thought && item.thought.toLowerCase().includes(lower)) ||
            (item.desire && item.desire.toLowerCase().includes(lower)) ||
            (item.annotation && item.annotation.toLowerCase().includes(lower)) ||
            (item.characterName && item.characterName.toLowerCase().includes(lower))
          );
        }

        let exportText = "【 Subtext. 潜台词档案 】\n\n";
        if (exportList.length === 0) {
          exportText += "暂无内容。";
        } else {
          exportText += exportList.map(item => {
            const timeStr = new Date(item.t).toLocaleString();
            let str = `[${timeStr}] ${item.characterName}\n`;
            if (item.thought) str += `心声：${item.thought}\n`;
            const subText = item.desire || item.linger;
            if (subText) str += `余韵：${subText}\n`;
            if (item.annotation) str += `批注：${item.annotation}\n`;
            return str.trim();
          }).join('\n-------------------------\n\n');
        }

        ctx.ui.dialog((dialogEl, { close }) => {
          dialogEl.style.cssText = "padding:24px; background:#fff; border-radius:16px; width:85%; max-width:400px; max-height:80vh; display:flex; flex-direction:column; box-shadow: 0 10px 40px rgba(0,0,0,0.1); font-family:inherit;";
          
          dialogEl.innerHTML = `
            <div style="font-size:16px; color:#111; margin-bottom:12px; font-weight:500;">导出档案预览</div>
            <textarea readonly style="width:100%; height:260px; box-sizing:border-box; background:#f9f9f9; border:1px solid #eaeaea; border-radius:8px; padding:10px; font-size:12px; color:#333; outline:none; resize:none; font-family:monospace; line-height:1.4;">${exportText}</textarea>
            <div style="display:flex; gap:12px; margin-top:16px;">
              <button id="btn-copy" style="flex:1; padding:10px 0; border:none; background:#111; color:#fff; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer;">一键复制到剪贴板</button>
              <button id="btn-close" style="padding:10px 16px; border:none; background:#f4f4f4; color:#555; border-radius:8px; font-size:13px; cursor:pointer;">关闭</button>
            </div>
          `;

          dialogEl.querySelector("#btn-close").onclick = close;
          dialogEl.querySelector("#btn-copy").onclick = () => {
            const ta = document.createElement("textarea");
            ta.value = exportText;
            ta.style.cssText = "position:absolute; left:-9999px; opacity:0;";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            ctx.ui.toast("已成功复制到剪贴板！");
            close();
          };
        });
      };

      headerTopRow.appendChild(titleWrapper);
      headerTopRow.appendChild(exportBtn);

      const searchBox = document.createElement("input");
      searchBox.type = "text";
      searchBox.placeholder = "搜索记忆与批注...";
      searchBox.style.cssText = "width:100%; border:none; border-bottom:1px solid #e0e0e0; background:transparent; padding:8px 0; font-size:13px; outline:none; color:#333; font-family:inherit; transition:border-color 0.3s; margin-bottom:16px;";
      searchBox.onfocus = () => { searchBox.style.borderBottomColor = "#111"; };
      searchBox.onblur = () => { searchBox.style.borderBottomColor = "#e0e0e0"; };
      
      const charTabs = document.createElement("div");
      charTabs.style.cssText = "display:flex; gap:16px; overflow-x:auto; padding-bottom:12px; scrollbar-width:none; -ms-overflow-style:none;";
      const styleTag = document.createElement("style");
      styleTag.textContent = "::-webkit-scrollbar { display: none; }";
      el.appendChild(styleTag);

      header.appendChild(headerTopRow);
      header.appendChild(searchBox);
      header.appendChild(charTabs);
      el.appendChild(header);

      const timelineContainer = document.createElement("div");
      timelineContainer.style.cssText = "padding:24px 20px;";
      el.appendChild(timelineContainer);

      const renderTabs = () => {
        charTabs.innerHTML = "";
        const list = ctx.kit.kv.get("thoughts") || [];
        
        const counts = { all: list.length };
        const uniqueChars = [{ id: "all", name: "全部档案" }];
        const seen = new Set();
        
        list.forEach(item => {
          const cid = item.characterId || "unknown";
          if (!counts[cid]) counts[cid] = 0;
          counts[cid]++;

          if (!seen.has(cid)) {
            seen.add(cid);
            uniqueChars.push({ id: cid, name: item.characterName });
          }
        });

        uniqueChars.forEach(char => {
          const tab = document.createElement("div");
          const isActive = currentCharId === char.id;
          const count = counts[char.id] || 0;
          
          tab.innerHTML = `${char.name} <span style="font-size:10px; color:${isActive ? '#888' : '#ccc'}; margin-left:4px;">${count}</span>`;
          tab.style.cssText = `
            font-size:12px; white-space:nowrap; cursor:pointer; padding:4px 2px;
            color: ${isActive ? '#111' : '#a0a0a0'};
            font-weight: ${isActive ? '500' : '400'};
            border-bottom: 2px solid ${isActive ? '#111' : 'transparent'};
            transition: all 0.2s;
          `;
          tab.onclick = () => {
            currentCharId = char.id;
            renderTabs(); 
            renderTimeline(); 
          };
          charTabs.appendChild(tab);
        });
      };

      const renderTimeline = () => {
        timelineContainer.innerHTML = "";
        let list = ctx.kit.kv.get("thoughts") || [];
        
        if (currentCharId !== "all") {
          list = list.filter(x => x.characterId === currentCharId);
        }

        if (currentFilterText) {
          const lower = currentFilterText.toLowerCase();
          list = list.filter(item => 
            (item.thought && item.thought.toLowerCase().includes(lower)) ||
            (item.desire && item.desire.toLowerCase().includes(lower)) ||
            (item.annotation && item.annotation.toLowerCase().includes(lower)) ||
            (item.characterName && item.characterName.toLowerCase().includes(lower))
          );
        }

        if (list.length === 0) {
          timelineContainer.innerHTML = `<div style="font-size:12px; color:#bbb; text-align:center; margin-top:60px; font-weight:300; letter-spacing: 1px;">风平浪静，暂无记录。</div>`;
          return;
        }

        const groups = [];
        list.forEach(item => {
          const d = new Date(item.t);
          const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const key = d.toDateString();
          
          let group = groups.find(g => g.key === key);
          if (!group) {
            group = { key, dateStr, items: [], isToday: key === new Date().toDateString() };
            groups.push(group);
          }
          group.items.push(item);
        });

        groups.forEach(group => {
          const groupEl = document.createElement("div");
          groupEl.style.cssText = "margin-bottom: 32px;";

          const dayHeader = document.createElement("div");
          dayHeader.style.cssText = "display:flex; align-items:center; cursor:pointer; padding:8px 0; user-select:none;";
          
          const arrow = document.createElement("span");
          arrow.innerHTML = "›";
          arrow.style.cssText = "display:inline-block; margin-right:8px; color:#999; transition:transform 0.3s; font-size:16px; font-weight:300;";
          
          const dayTitle = document.createElement("span");
          dayTitle.textContent = group.isToday ? "Today" : group.dateStr;
          dayTitle.style.cssText = "font-size:14px; font-weight:500; color:#111; letter-spacing:0.5px;";
          
          dayHeader.appendChild(arrow);
          dayHeader.appendChild(dayTitle);

          const dayContent = document.createElement("div");
          dayContent.style.cssText = "margin-top:12px; margin-left:6px; padding-left:16px; border-left:1px solid #eaeaea; display:flex; flex-direction:column; gap:20px; overflow:hidden;";
          
          let isExpanded = currentFilterText !== "" || group.isToday;
          arrow.style.transform = isExpanded ? "rotate(90deg)" : "rotate(0deg)";
          dayContent.style.display = isExpanded ? "flex" : "none";

          dayHeader.onclick = () => {
            isExpanded = !isExpanded;
            arrow.style.transform = isExpanded ? "rotate(90deg)" : "rotate(0deg)";
            dayContent.style.display = isExpanded ? "flex" : "none";
          };

          group.items.forEach(item => {
            const cardWrapper = document.createElement("div");
            cardWrapper.style.cssText = "position:relative;";
            
            const dot = document.createElement("div");
            dot.style.cssText = "position:absolute; left:-20px; top:12px; width:5px; height:5px; border-radius:50%; background:#d4d4d4; border:2px solid #fcfcfc;";
            cardWrapper.appendChild(dot);

            const card = document.createElement("div");
            card.style.cssText = "background:#ffffff; border: 1px solid rgba(0,0,0,0.04); border-radius:12px; padding:16px; box-shadow: 0 4px 16px rgba(0,0,0,0.02);";
            
            const date = new Date(item.t);
            const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            const metaEl = document.createElement("div");
            metaEl.innerHTML = `<span>${timeStr}</span> <span style="margin:0 6px; color:#eee;">|</span> <span style="color:#888;">${item.characterName}</span>`;
            metaEl.style.cssText = "font-size:10px; color:#c4c4c4; font-family: 'Courier New', monospace; letter-spacing: 0.5px; margin-bottom:10px;";
            card.appendChild(metaEl);

            if (item.thought) {
              const textEl = document.createElement("div");
              textEl.textContent = item.thought;
              textEl.style.cssText = "font-size:13px; color:#2c2c2c; line-height:1.6;";
              card.appendChild(textEl);
            }

            const subText = item.desire || item.linger;
            if (subText) {
              const subEl = document.createElement("div");
              subEl.textContent = subText;
              subEl.style.cssText = "font-size:12px; color:#888; line-height:1.5; padding-left:10px; border-left:1.5px solid #ececec; margin-top: 8px; font-weight:300;";
              card.appendChild(subEl);
            }

            const annotationDisplay = document.createElement("div");
            annotationDisplay.style.cssText = "margin-top:12px; padding:8px 10px; background:#fbfbfb; border-radius:6px; font-size:12px; color:#555; line-height:1.5; font-style:italic; display:none;";
            if (item.annotation) {
              annotationDisplay.textContent = item.annotation;
              annotationDisplay.style.display = "block";
            }
            card.appendChild(annotationDisplay);

            const actionBar = document.createElement("div");
            actionBar.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:12px; border-top:1px dashed #f4f4f4;";
            
            const noteBtn = document.createElement("span");
            noteBtn.textContent = item.annotation ? "edit note" : "+ note";
            noteBtn.style.cssText = "font-size:11px; color:#aaa; cursor:pointer; transition:color 0.2s;";
            noteBtn.onmouseover = () => noteBtn.style.color = "#333";
            noteBtn.onmouseout = () => noteBtn.style.color = "#aaa";

            const deleteArea = document.createElement("div");
            deleteArea.style.cssText = "display:flex; align-items:center; gap:8px;";

            const crossBtn = document.createElement("span");
            crossBtn.innerHTML = "×";
            crossBtn.style.cssText = "font-size:16px; color:#ccc; cursor:pointer; padding:0 4px; font-weight:300; transition:color 0.2s;";
            crossBtn.onmouseover = () => crossBtn.style.color = "#ff4d4f";
            crossBtn.onmouseout = () => { if (deleteArea.children.length === 1) crossBtn.style.color = "#ccc"; };

            crossBtn.onclick = () => {
              deleteArea.innerHTML = "";

              const confirmText = document.createElement("span");
              confirmText.textContent = "确认删除";
              confirmText.style.cssText = "font-size:11px; color:#ff4d4f; cursor:pointer; font-weight:500;";

              const cancelText = document.createElement("span");
              cancelText.textContent = "取消";
              cancelText.style.cssText = "font-size:11px; color:#888; cursor:pointer;";

              cancelText.onclick = (e) => {
                e.stopPropagation();
                deleteArea.innerHTML = "";
                deleteArea.appendChild(crossBtn);
              };

              confirmText.onclick = (e) => {
                e.stopPropagation();
                const currentList = ctx.kit.kv.get("thoughts") || [];
                ctx.kit.kv.set("thoughts", currentList.filter(x => x.id !== item.id));
                cardWrapper.style.opacity = "0";
                cardWrapper.style.transition = "opacity 0.3s";
                setTimeout(() => {
                  cardWrapper.style.display = "none";
                  renderTabs(); 
                }, 300);
              };

              deleteArea.appendChild(confirmText);
              deleteArea.appendChild(cancelText);
            };

            deleteArea.appendChild(crossBtn);

            actionBar.appendChild(noteBtn);
            actionBar.appendChild(deleteArea);
            card.appendChild(actionBar);

            const noteEditorBox = document.createElement("div");
            noteEditorBox.style.cssText = "display:none; margin-top:10px;";
            
            const noteInput = document.createElement("textarea");
            noteInput.value = item.annotation || "";
            noteInput.placeholder = "写下此时的感悟...";
            noteInput.style.cssText = "width:100%; box-sizing:border-box; background:#f9f9f9; border:1px solid #eaeaea; border-radius:8px; padding:10px; font-size:12px; color:#333; outline:none; resize:vertical; min-height:60px; font-family:inherit;";
            noteInput.onfocus = () => { noteInput.style.borderColor = "#ccc"; };
            noteInput.onblur = () => { noteInput.style.borderColor = "#eaeaea"; };
            
            const editActions = document.createElement("div");
            editActions.style.cssText = "display:flex; justify-content:flex-end; gap:12px; margin-top:8px;";
            
            const clearNoteBtn = document.createElement("button");
            clearNoteBtn.textContent = "清空批注";
            clearNoteBtn.style.cssText = "border:none; background:transparent; color:#999; font-size:11px; cursor:pointer; padding:4px 0;";
            
            const saveBtn = document.createElement("button");
            saveBtn.textContent = "Save";
            saveBtn.style.cssText = "border:none; background:#111; color:#fff; border-radius:6px; padding:4px 14px; font-size:11px; cursor:pointer;";
            
            noteBtn.onclick = () => {
              noteEditorBox.style.display = noteEditorBox.style.display === "none" ? "block" : "none";
              if (noteEditorBox.style.display === "block") noteInput.focus();
            };

            clearNoteBtn.onclick = () => {
              noteInput.value = "";
              saveBtn.click(); 
            };

            saveBtn.onclick = () => {
              const text = noteInput.value.trim();
              const currentList = ctx.kit.kv.get("thoughts") || [];
              const target = currentList.find(x => x.id === item.id);
              if (target) {
                target.annotation = text;
                ctx.kit.kv.set("thoughts", currentList);
                
                if (text) {
                  annotationDisplay.textContent = text;
                  annotationDisplay.style.display = "block";
                  noteBtn.textContent = "edit note";
                } else {
                  annotationDisplay.style.display = "none";
                  noteBtn.textContent = "+ note";
                }
                noteEditorBox.style.display = "none";
              }
            };

            editActions.appendChild(clearNoteBtn);
            editActions.appendChild(saveBtn);
            noteEditorBox.appendChild(noteInput);
            noteEditorBox.appendChild(editActions);
            
            card.appendChild(noteEditorBox);
            cardWrapper.appendChild(card);
            dayContent.appendChild(cardWrapper);
          });

          groupEl.appendChild(dayHeader);
          groupEl.appendChild(dayContent);
          timelineContainer.appendChild(groupEl);
        });
      };

      searchBox.addEventListener('input', (e) => {
        currentFilterText = e.target.value.trim();
        renderTimeline();
      });

      renderTabs();
      renderTimeline();
    });
  },
};
