export default {
  manifest: {
    id: "puff-liquid-actions", 
    name: "灵动快捷胶囊 Pro",
    engine: "puff",
    apiVersion: 1,
    version: "1.4.1",
    description: "支持长按拖动及位置记忆、大小自由缩放，修复了重新进入页面时位置自动复原的问题。",
    settings: [
      { key: "capsule_scale", label: "胶囊整体大小 (填数字，默认 1，推荐 0.7~1.2)", type: "number", default: 1 },
      { key: "reset_pos", label: "🔧 重置位置 (如果不小心拖丢了，随便开关一次即可复原)", type: "boolean", default: false },
      { key: "show_emoji", label: "显示 1：表情包", type: "boolean", default: true },
      { key: "show_img", label: "显示 2：图片", type: "boolean", default: true },
      { key: "show_transfer", label: "显示 3：转账", type: "boolean", default: true },
      { key: "show_loc", label: "显示 4：定位", type: "boolean", default: false },
      { key: "show_delivery", label: "显示 5：外卖/跑腿", type: "boolean", default: false },
      { key: "show_listen", label: "显示 6：一起听", type: "boolean", default: true },
      { key: "show_couple", label: "显示 7：开通情侣空间", type: "boolean", default: false },
      { key: "show_invite", label: "显示 8：邀请共处", type: "boolean", default: false },
      { key: "show_call", label: "显示 9：语音通话", type: "boolean", default: true },
      { key: "show_video", label: "显示 10：视频通话", type: "boolean", default: false },
      { key: "show_aside", label: "显示 11：旁白", type: "boolean", default: false },
      { key: "show_rewind", label: "显示 12：重回", type: "boolean", default: false }
    ]
  },
  
  setup(ctx) {
    // ==========================================
    // 1. 注入 CSS：基于 CSS 变量的独立日夜适配及位置缩放
    // ==========================================
    const cleanCss = ctx.ui.css(`
      .puff-glass-container {
        --puff-scale: 1; 
        --puff-translate-y: 0px;
        --drag-x: 0px;
        --drag-y: 0px;
        position: absolute;
        right: 16px;
        bottom: 60px;
        z-index: 100;
        /* 变换顺序严格：先做拖拽位移(屏幕级1:1) -> 再做缩放 -> 最后做原生避让位移 */
        transform-origin: bottom right;
        transform: translate(var(--drag-x), var(--drag-y)) scale(var(--puff-scale)) translateY(var(--puff-translate-y));
        transition: opacity 0.25s ease, transform 0.25s ease;
      }
      
      .puff-glass-container.hide-for-native {
        opacity: 0 !important;
        pointer-events: none !important;
        --puff-translate-y: 15px; 
      }

      /* 拖动时的状态 */
      .puff-glass-container.dragging {
        transition: none !important; /* 拖拽时取消动画，保证绝对跟手 */
        opacity: 0.85;
      }

      .puff-glass-pill {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-start;
        gap: 8px;
        max-width: calc(100vw - 40px);
        background: var(--puff-bg);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border: 1px solid var(--puff-border);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        border-radius: 24px;
        padding: 8px 14px;
        transition: all 0.3s ease;
        touch-action: none; /* 防止拖动时浏览器误触滚动 */
        cursor: grab;
      }

      .puff-glass-pill:active {
        cursor: grabbing;
      }

      .puff-glass-container.theme-light {
        --puff-bg: rgba(245, 245, 245, 0.7);
        --puff-border: rgba(0, 0, 0, 0.08);
        --puff-icon: rgba(0, 0, 0, 0.65);
        --puff-hover: rgba(0, 0, 0, 0.08);
      }

      .puff-glass-container.theme-dark {
        --puff-bg: rgba(45, 45, 45, 0.65);
        --puff-border: rgba(255, 255, 255, 0.12);
        --puff-icon: rgba(255, 255, 255, 0.85);
        --puff-hover: rgba(255, 255, 255, 0.15);
      }

      .puff-action-btn {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0;
        transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        color: var(--puff-icon);
      }

      .puff-action-btn:hover {
        background: var(--puff-hover);
        transform: scale(1.1);
      }

      .puff-action-btn svg {
        width: 20px;
        height: 20px;
        fill: currentColor;
      }
    `);

    // ==========================================
    // 2. 全部原生功能配置库
    // ==========================================
    const allActions = [
      { id: 'emoji', key: 'show_emoji', name: '表情包', default: true, fallback: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.5 8c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zm-7 0c.83 0 1.5.67 1.5 1.5S9.33 13 8.5 13 7 12.33 7 11.5 7.67 10 8.5 10zm3.5 6.5c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z"/></svg>' },
      { id: 'img', key: 'show_img', name: '图片', default: true, fallback: '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>' },
      { id: 'transfer', key: 'show_transfer', name: '转账', default: true, fallback: '<svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.65 0 1.12-1.08 1.96-2.7 1.96-1.84 0-2.82-.96-2.9-2.2h-2.2c.11 2 1.45 3.44 3.6 3.93V21h3v-2.1c1.98-.39 3.5-1.7 3.5-3.69 0-2.61-2.27-3.48-4.7-4.31z"/></svg>' },
      { id: 'loc', key: 'show_loc', name: '定位', default: false, fallback: '<svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>' },
      { id: 'delivery', key: 'show_delivery', name: '外卖/跑腿', default: false, fallback: '<svg viewBox="0 0 24 24"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm12 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>' },
      { id: 'listen', key: 'show_listen', name: '一起听', default: true, fallback: '<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>' },
      { id: 'couple', key: 'show_couple', name: '开通情侣空间', default: false, fallback: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>' },
      { id: 'invite', key: 'show_invite', name: '邀请共处', default: false, fallback: '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>' },
      { id: 'call', key: 'show_call', name: '语音通话', default: true, fallback: '<svg viewBox="0 0 24 24"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>' },
      { id: 'video', key: 'show_video', name: '视频通话', default: false, fallback: '<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>' },
      { id: 'aside', key: 'show_aside', name: '旁白', default: false, fallback: '<svg viewBox="0 0 24 24"><path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/></svg>' },
      { id: 'rewind', key: 'show_rewind', name: '重回', default: false, fallback: '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>' }
    ];

    let renderCapsule = () => {}; 
    let preventClick = false; // 用于拖拽后防误触

    // ==========================================
    // 拖动参数变量
    // ==========================================
    let savedDragX = Number(ctx.kit.kv.get('capsule_drag_x')) || 0;
    let savedDragY = Number(ctx.kit.kv.get('capsule_drag_y')) || 0;

    ctx.ui.place("composer.rail", (el) => {
      el.innerHTML = "";
      const container = document.createElement("div");
      container.className = "puff-glass-container theme-dark"; 
      
      // 恢复上一次拖动的位置
      container.style.setProperty('--drag-x', savedDragX + 'px');
      container.style.setProperty('--drag-y', savedDragY + 'px');

      const pill = document.createElement("div");
      pill.className = "puff-glass-pill";

      // 动态渲染逻辑
      renderCapsule = () => {
        // ========== 1. 大小缩放 ==========
        let rawScale = ctx.kit.prefs.get("capsule_scale");
        if (rawScale === undefined || rawScale === null || rawScale === "") rawScale = 1;
        let scaleVal = parseFloat(rawScale);
        if (isNaN(scaleVal) || scaleVal <= 0) scaleVal = 1;
        container.style.setProperty('--puff-scale', scaleVal);

        // ========== 2. 紧急位置复位逻辑 (修复版) ==========
        const currentResetVal = String(ctx.kit.prefs.get("reset_pos")); 
        const lastResetVal = ctx.kit.kv.get("last_reset_val");

        // 仅在真实发生重置开关状态变化时才清空位置
        if (lastResetVal !== undefined && lastResetVal !== null && currentResetVal !== String(lastResetVal)) {
            ctx.kit.kv.set("last_reset_val", currentResetVal);
            // 清空位置记忆
            ctx.kit.kv.set("capsule_drag_x", 0);
            ctx.kit.kv.set("capsule_drag_y", 0);
            savedDragX = 0;
            savedDragY = 0;
            container.style.setProperty('--drag-x', '0px');
            container.style.setProperty('--drag-y', '0px');
        } else if (lastResetVal === undefined || lastResetVal === null) {
            // 第一次加载，只存开关值，不破坏拖拽坐标
            ctx.kit.kv.set("last_reset_val", currentResetVal);
        }

        // ========== 3. 生成内部按钮 ==========
        pill.innerHTML = ""; 
        const activeActions = allActions.filter(item => {
          let val = ctx.kit.prefs.get(item.key);
          return (val === undefined || val === null) ? item.default : val; 
        });

        if (activeActions.length === 0) {
          container.style.display = "none";
          return;
        } else {
          container.style.display = "block";
        }

        activeActions.forEach(item => {
          const btn = document.createElement("button");
          btn.className = "puff-action-btn";
          btn.title = item.name;
          const cachedSvg = ctx.kit.kv.get("origin_svg_" + item.id);
          btn.innerHTML = cachedSvg || item.fallback;

          btn.onclick = (e) => {
            // 【关键】如果是刚拖拽完松手，阻止点击事件触发！
            if (preventClick) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            e.preventDefault();
            const plusBtn = document.querySelector('.chat-compose-plus');
            if (!plusBtn) return;

            const isExpanded = plusBtn.getAttribute('aria-expanded') === 'true';
            if (!isExpanded) plusBtn.click(); 

            setTimeout(() => {
              const targetBtns = Array.from(document.querySelectorAll('.chat-compose-action'));
              const target = targetBtns.find(b => b.textContent && b.textContent.includes(item.name));
              
              if (target) {
                const realSvg = target.querySelector('svg');
                if (realSvg && !cachedSvg) {
                   ctx.kit.kv.set("origin_svg_" + item.id, realSvg.outerHTML);
                   btn.innerHTML = realSvg.outerHTML; 
                }
                
                target.click(); 
                setTimeout(() => {
                    const checkPlus = document.querySelector('.chat-compose-plus');
                    if (checkPlus && checkPlus.getAttribute('aria-expanded') === 'true') {
                        checkPlus.click();
                    }
                }, 50);
              } else {
                 ctx.ui.toast(`当前场景暂无 "${item.name}" 功能`);
              }
            }, 80);
          };
          pill.appendChild(btn);
        });
      };

      // ==========================================
      // 长按与拖拽核心逻辑
      // ==========================================
      let dragReady = false;
      let isDragging = false;
      let startX = 0, startY = 0;
      let initialDragX = 0, initialDragY = 0;
      let longPressTimer = null;

      pill.addEventListener('pointerdown', (e) => {
          // 只允许左键/触屏触发
          if (e.pointerType === 'mouse' && e.button !== 0) return;

          startX = e.clientX;
          startY = e.clientY;
          initialDragX = savedDragX;
          initialDragY = savedDragY;
          dragReady = false;
          isDragging = false;

          // 长按 350ms 后解锁拖动
          longPressTimer = setTimeout(() => {
              dragReady = true;
              if (navigator.vibrate) navigator.vibrate(30); // 提供震动反馈
              container.classList.add('dragging');
          }, 350); 

          try { pill.setPointerCapture(e.pointerId); } catch(err){}
      });

      pill.addEventListener('pointermove', (e) => {
          if (!longPressTimer && !dragReady && !isDragging) return;

          // 如果还没触发长按，但用户手指已经移动超过一定距离（正常滑动屏幕），则取消长按判定
          if (!dragReady && !isDragging) {
              const dx = e.clientX - startX;
              const dy = e.clientY - startY;
              if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                  clearTimeout(longPressTimer);
                  longPressTimer = null;
              }
              return;
          }

          // 正式拖拽中
          if (dragReady) {
              isDragging = true;
              e.preventDefault(); 
              const dx = e.clientX - startX;
              const dy = e.clientY - startY;
              
              savedDragX = initialDragX + dx;
              savedDragY = initialDragY + dy;
              
              container.style.setProperty('--drag-x', savedDragX + 'px');
              container.style.setProperty('--drag-y', savedDragY + 'px');
          }
      });

      const endDrag = (e) => {
          if (longPressTimer) {
              clearTimeout(longPressTimer);
              longPressTimer = null;
          }
          
          if (dragReady || isDragging) {
              container.classList.remove('dragging');
              
              // 如果发生过位移，松手时保存新位置，并阻止即将发生的 Click 事件
              if (isDragging) {
                  ctx.kit.kv.set('capsule_drag_x', savedDragX);
                  ctx.kit.kv.set('capsule_drag_y', savedDragY);
                  
                  preventClick = true;
                  setTimeout(() => { preventClick = false; }, 100); // 100ms 后解除防误触
              }
              
              dragReady = false;
              isDragging = false;
          }
          
          try {
              if (pill.hasPointerCapture(e.pointerId)) {
                  pill.releasePointerCapture(e.pointerId);
              }
          } catch(err){}
      };

      pill.addEventListener('pointerup', endDrag);
      pill.addEventListener('pointercancel', endDrag);

      renderCapsule(); 
      container.appendChild(pill);
      el.appendChild(container);
    });

    // ==========================================
    // 3. 监听器：实时测算亮度 & 原生菜单避让
    // ==========================================
    ctx.kit.every(() => {
       const container = document.querySelector('.puff-glass-container');
       if (!container) return;

       let bgColor = window.getComputedStyle(document.body).backgroundColor;
       if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
           const root = document.querySelector('#app') || document.documentElement;
           bgColor = window.getComputedStyle(root).backgroundColor;
       }
       
       const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
       if (rgbMatch) {
           const brightness = 0.299 * rgbMatch[1] + 0.587 * rgbMatch[2] + 0.114 * rgbMatch[3];
           if (brightness > 128) {
               container.classList.add('theme-light');
               container.classList.remove('theme-dark');
           } else {
               container.classList.add('theme-dark');
               container.classList.remove('theme-light');
           }
       }

       const plusBtn = document.querySelector('.chat-compose-plus');
       if (plusBtn) {
          const isExpanded = plusBtn.getAttribute('aria-expanded') === 'true';
          const popover = document.querySelector('.chat-compose-popover');
          if (isExpanded || popover) {
             container.classList.add('hide-for-native'); 
          } else {
             container.classList.remove('hide-for-native');
          }
       }
    }, 200);

    ctx.kit.prefs.onChange(() => {
       renderCapsule();
    });

    return () => {
      cleanCss();
    };
  }
};
