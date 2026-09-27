export default {
  manifest: {
    id: "puff-step1-custom-send",
    name: "发送键",
    engine: "puff",
    apiVersion: 1,
    version: "1.2.1",
    description: "一直显示的液态玻璃发送胶囊。打开更多菜单时自动隐藏防遮挡，支持长按拖拽和缩放，修复了重新进入位置重置的问题。",
    settings: [
      { key: "btn_text", label: "✨ 按钮文字", type: "string", default: "sendmessage" },
      { key: "btn_scale", label: "✨ 按钮大小缩放 (默认1，支持小数)", type: "number", default: 1 },
      { key: "reset_pos", label: "🔧 找不到按钮了？(随便开关一次重置位置)", type: "boolean", default: false }
    ]
  },
  
  setup(ctx) {
    // ==========================================
    // 1. 注入 CSS (隐藏原生键 + 悬浮键常驻显示)
    // ==========================================
    const cleanCss = ctx.ui.css(`
      /* 精准隐藏原生按键，保留DOM使其可被点击 */
      button.chat-compose-icon.is-reply,
      button[aria-label="角色回复"],
      button.chat-compose-icon.is-send,
      button[aria-label="重试回复"],
      .chat-compose-send {
          opacity: 0 !important;
          position: absolute !important;
          width: 0 !important;
          height: 0 !important;
          overflow: hidden !important;
          pointer-events: none !important;
      }

      /* 我们的液态玻璃容器 */
      .puff-custom-send-container {
          --drag-x: 0px;
          --drag-y: 0px;
          --btn-scale: 1;
          position: absolute;
          left: 16px;       /* 默认在左侧 */
          bottom: 75px;     /* 默认在输入框上方 */
          z-index: 1000;
          transform-origin: center center;
          /* 组合：位移 + 用户自定义缩放 */
          transform: translate(var(--drag-x), var(--drag-y)) scale(var(--btn-scale));
          
          /* 默认可见和可点击 */
          opacity: 1;
          pointer-events: auto;
          display: block; /* 用于后续切换显示/隐藏 */
      }

      /* 拖拽时的跟手状态 */
      .puff-custom-send-container.dragging {
          opacity: 0.85;
      }

      /* 胶囊本体样式：液态玻璃 */
      .puff-custom-send-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 18px;
          background: rgba(45, 45, 45, 0.7);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 24px;
          color: #fff;
          font-size: 15px;
          font-weight: 500;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          cursor: pointer;
          user-select: none;
          touch-action: none;
      }

      /* 浅色模式适配 */
      body.puff-theme-light .puff-custom-send-btn {
          background: rgba(245, 245, 245, 0.8);
          border: 1px solid rgba(0, 0, 0, 0.08);
          color: #000;
      }
    `);

    // ==========================================
    // 2. 状态与位置记忆
    // ==========================================
    let savedDragX = Number(ctx.kit.kv.get('send_drag_x')) || 0;
    let savedDragY = Number(ctx.kit.kv.get('send_drag_y')) || 0;
    let preventClick = false;
    
    // 把容器提出来，方便全局探测器控制它的隐藏/显示
    let sendBtnContainer = null;

    // ==========================================
    // 3. 构建并注入 UI
    // ==========================================
    ctx.ui.place("composer.rail", (el) => {
      sendBtnContainer = document.createElement("div");
      sendBtnContainer.className = "puff-custom-send-container";
      
      sendBtnContainer.style.setProperty('--drag-x', savedDragX + 'px');
      sendBtnContainer.style.setProperty('--drag-y', savedDragY + 'px');

      const btn = document.createElement("div");
      btn.className = "puff-custom-send-btn";
      sendBtnContainer.appendChild(btn);
      el.appendChild(sendBtnContainer);

      // --- 渲染及更新函数 ---
      const updateSettings = () => {
          const text = ctx.kit.prefs.get("btn_text") || "sendmessage";
          let scale = parseFloat(ctx.kit.prefs.get("btn_scale"));
          if (isNaN(scale) || scale <= 0) scale = 1;
          
          btn.innerText = text;
          sendBtnContainer.style.setProperty('--btn-scale', scale);

          // === 修复后的位置重置逻辑 ===
          const currentResetVal = String(ctx.kit.prefs.get("reset_pos")); 
          const lastResetVal = ctx.kit.kv.get("send_last_reset");

          if (lastResetVal !== undefined && lastResetVal !== null && currentResetVal !== String(lastResetVal)) {
              ctx.kit.kv.set("send_last_reset", currentResetVal);
              ctx.kit.kv.set("send_drag_x", 0);
              ctx.kit.kv.set("send_drag_y", 0);
              savedDragX = 0; savedDragY = 0;
              sendBtnContainer.style.setProperty('--drag-x', '0px');
              sendBtnContainer.style.setProperty('--drag-y', '0px');
          } else if (lastResetVal === undefined || lastResetVal === null) {
              ctx.kit.kv.set("send_last_reset", currentResetVal);
          }
      };
      
      updateSettings();
      ctx.kit.prefs.onChange(updateSettings);

      // --- 点击触发发送逻辑 ---
      btn.onclick = (e) => {
          if (preventClick) {
              e.preventDefault();
              e.stopPropagation();
              return;
          }
          // 精准定位特定前端发送按钮
          const nativeSend = document.querySelector('button[aria-label="角色回复"]') || 
                             document.querySelector('button.chat-compose-icon.is-reply') ||
                             document.querySelector('button[aria-label="重试回复"]') ||
                             document.querySelector('.chat-compose-send');
          if (nativeSend) {
              nativeSend.click();
          }
      };

      // --- 长按拖拽核心逻辑 ---
      let startX = 0, startY = 0, initialDragX = 0, initialDragY = 0;
      let dragReady = false, isDragging = false, longPressTimer = null;

      btn.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          startX = e.clientX; startY = e.clientY;
          initialDragX = savedDragX; initialDragY = savedDragY;
          dragReady = false; isDragging = false;
          
          longPressTimer = setTimeout(() => {
              dragReady = true;
              if (navigator.vibrate) navigator.vibrate(30); 
              sendBtnContainer.classList.add('dragging');
          }, 350); 
          try { btn.setPointerCapture(e.pointerId); } catch(err){}
      });

      btn.addEventListener('pointermove', (e) => {
          if (!longPressTimer && !dragReady && !isDragging) return;
          if (!dragReady && !isDragging) {
              if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) {
                  clearTimeout(longPressTimer); longPressTimer = null;
              }
              return;
          }
          if (dragReady) {
              isDragging = true; e.preventDefault(); 
              savedDragX = initialDragX + (e.clientX - startX);
              savedDragY = initialDragY + (e.clientY - startY);
              sendBtnContainer.style.setProperty('--drag-x', savedDragX + 'px');
              sendBtnContainer.style.setProperty('--drag-y', savedDragY + 'px');
          }
      });

      const endDrag = (e) => {
          if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
          if (dragReady || isDragging) {
              sendBtnContainer.classList.remove('dragging');
              if (isDragging) {
                  ctx.kit.kv.set('send_drag_x', savedDragX);
                  ctx.kit.kv.set('send_drag_y', savedDragY);
                  preventClick = true; 
                  setTimeout(() => { preventClick = false; }, 100); 
              }
              dragReady = false; isDragging = false;
          }
          try { if (btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId); } catch(err){}
      };

      btn.addEventListener('pointerup', endDrag);
      btn.addEventListener('pointercancel', endDrag);
    });

    // ==========================================
    // 4. 全局探测：主题监听 + 智能避让菜单
    // ==========================================
    ctx.kit.every(() => {
       // --- 功能1：主题变色监听 ---
       let bgColor = window.getComputedStyle(document.body).backgroundColor;
       if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
           const root = document.querySelector('#app') || document.documentElement;
           bgColor = window.getComputedStyle(root).backgroundColor;
       }
       const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
       if (rgbMatch) {
           const brightness = 0.299 * rgbMatch[1] + 0.587 * rgbMatch[2] + 0.114 * rgbMatch[3];
           if (brightness > 128) document.body.classList.add('puff-theme-light');
           else document.body.classList.remove('puff-theme-light');
       }

       // --- 功能2：弹窗智能避让 (大傻春修复补丁) ---
       if (sendBtnContainer) {
           // 检测“更多”按钮的 aria-expanded 属性是否变成了 true (即菜单已展开)
           const plusBtn = document.querySelector('button.chat-compose-plus, button[aria-label="更多"]');
           const isMenuOpen = plusBtn && plusBtn.getAttribute('aria-expanded') === 'true';

           if (isMenuOpen) {
               sendBtnContainer.style.display = 'none'; // 菜单展开时隐藏发送键
           } else {
               sendBtnContainer.style.display = 'block'; // 菜单收起时恢复原样
           }
       }

    }, 200); // 稍微提高一点点检测频率，让隐藏更敏捷

    return () => { cleanCss(); };
  }
};
