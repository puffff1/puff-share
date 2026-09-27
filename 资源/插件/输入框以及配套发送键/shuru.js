export default {
  manifest: {
    id: "puff-pure-glass-composer",
    name: "输入栏",
    engine: "puff",
    apiVersion: 1,
    version: "2.5.0",
    description: "只保留核心发送逻辑与界面，删除了所有JS干扰位移的代码，交由用户自己的CSS控制。",
    settings: [
      { key: "username", label: "✨ 用户名", type: "string", default: "输入用户名" },
      { key: "subtext", label: "✨ 签名", type: "string", default: "输入签名" },
      { key: "placeholder", label: "✨ 提示语", type: "string", default: "输入输入框内占位符" }
    ]
  },

  setup(ctx) {
    // ==========================================
    // 1. CSS 样式 (纯净版：只隐身，不位移)
    // ==========================================
    const cleanCss = ctx.ui.css(`
      /* 剥夺原生容器外套与毛玻璃特效，不干涉位置 */
      .chat-compose-container, 
      .chat-compose-bar,
      #composer,
      .composer-inner {
          background: transparent !important;
          background-color: transparent !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          border: none !important;
          box-shadow: none !important;
          /* 塌陷为零高度，避免聚焦/打字时容器被撑高而露出一片空白色块；
             但保持 overflow:visible，否则点击"+"弹出的原生附件菜单
             （很可能就渲染在这个容器内）会被一并裁掉，导致菜单弹不出来 */
          height: 0 !important;
          min-height: 0 !important;
          max-height: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          overflow: visible !important;
      }
      .chat-compose-bar::before, .chat-compose-bar::after { display: none !important; }

      /* 隐藏原生的打字区和原生按钮 */
      .chat-compose-container textarea, 
      .chat-compose-bar textarea,
      button[aria-label="更多"],
      button.chat-compose-plus,
      button[aria-label="语音发送"],
      button.chat-compose-icon.is-voice,
      button[aria-label="角色回复"],
      button[aria-label="重试回复"],
      .chat-compose-send {
          opacity: 0 !important;
          position: absolute !important;
          pointer-events: none !important; 
          z-index: -1 !important;
      }

      /* 我们的纯享版容器 */
      .puff-pure-glass-wrapper {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: 92%;
          max-width: 700px;
          height: 56px;
          background: rgba(40, 40, 40, 0.55);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 40px;
          display: none; 
          align-items: center;
          padding: 6px 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          z-index: 900; 
          user-select: none;
      }

      /* 内部 UI 元素 */
      .pure-left-section { display: flex; align-items: center; gap: 12px; padding-left: 6px; cursor: pointer; min-width: 140px; }
      .pure-avatar { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; background: #333; border: 1px solid rgba(255,255,255,0.1); }
      .pure-text-group { display: flex; flex-direction: column; justify-content: center; }
      .pure-username { color: #ffffff; font-size: 15px; font-weight: 500; letter-spacing: 0.2px; line-height: 1.2; }
      .pure-subtext { color: rgba(255, 255, 255, 0.45); font-size: 12px; margin-top: 2px; }
      .pure-right-section { flex-grow: 1; height: 100%; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 30px; display: flex; align-items: center; padding: 0 16px; margin-left: 16px; }
      .pure-input { flex-grow: 1; background: transparent; border: none; outline: none; color: #ffffff; font-size: 15px; height: 100%; width: 100%; }
      .pure-input::placeholder { color: rgba(255, 255, 255, 0.4); }
      .pure-icons { display: flex; align-items: center; gap: 16px; margin-left: 12px; }
      .pure-icon { fill: #ffffff; cursor: pointer; opacity: 0.9; transition: 0.2s; display: flex; }
      .pure-icon:hover { opacity: 1; transform: scale(1.05); }
    `);

    // ==========================================
    // 2. 构建 DOM
    // ==========================================
    const wrapper = document.createElement('div');
    wrapper.className = 'puff-pure-glass-wrapper';
    const defaultAvatar = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const savedAvatar = ctx.kit.kv.get('custom_user_avatar') || defaultAvatar;

    wrapper.innerHTML = `
      <input type="file" id="pure-avatar-upload" accept="image/*" style="display: none;" />
      <div class="pure-left-section" id="pure-profile-btn">
          <img class="pure-avatar" id="pure-avatar-img" src="${savedAvatar}" />
          <div class="pure-text-group">
              <div class="pure-username" id="pure-username-text"></div>
              <div class="pure-subtext" id="pure-subtext-text"></div>
          </div>
      </div>
      <div class="pure-right-section">
          <input type="text" class="pure-input" id="pure-real-input" autocomplete="off" />
          <div class="pure-icons">
              <div class="pure-icon" id="pure-globe-btn"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"/></svg></div>
              <div class="pure-icon" id="pure-mic-btn"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg></div>
          </div>
      </div>
    `;
    document.body.appendChild(wrapper);

    // ==========================================
    // 3. 基础页面显隐控制
    // ==========================================
    // 黑名单：穷举「装扮-桌面」页与「资源集市」详情页特有的文案，
    // 命中即视为处于这两个页面，强制隐藏输入栏。
    // 注意：只用「多字长短语」做标记，不用「装扮」「资源集市」这类
    // 两三个字的通用词——它们很可能同时也是侧边抽屉/底部导航里
    // 常驻的入口文案，即使抽屉收起也往往只是用 transform 移出屏幕
    // （而非 display:none），会被误判为"当前可见"，导致输入栏在
    // 正常聊天页也被永久隐藏。
    const FORBIDDEN_PAGE_MARKERS = [
        // 装扮 - 桌面 页
        '桌面氛围',
        '先选预设或上传图片',
        '壁纸遮罩',
        // 装扮 - 聊天 页（聊天样式 CSS 编辑）
        '聊天样式',
        '消息列表 / 即时对话',
        '应用列表 CSS',
        '列表 CSS 预设',
        '.chat-inbox-top',
        '保存当前为预设',
        // 资源集市 - 详情页（不同资源的按钮文案不一样，多列几种）
        '先点赞再下载或应用',
        '赞和评论都公开',
        '自动识别类型',
        '带回本机',
        // 编辑人设 页
        '面具人设会用于聊天中的自我呈现',
        '角色只认本面具这条线',
        // 我的（个人主页）页
        '默认按原图保存',
        '仅在确实能变小才压缩',
        // 线下 - 共处（同场叙事）页
        '点下方「开场」开始下一幕',
        '收录后回到线上私聊',
        '暂离现场，可随时回来',
        // 设置 - 生成 页
        '语音与图片独立配置',
        'MEDIA SYNTHESIS',
        // 情侣空间 - 悄悄话 详情页
        '写一张纸条',
        '撕掉',
        // 情侣空间 - 写动态 页
        '写在这里...',
    ];

    // 只有当命中的文字节点「真实可见」时才判定为禁止页面，
    // 避免单页应用把已离开的旧页面 DOM 缓存在后台、
    // 导致真实聊天页被误判、输入栏无法弹出的问题。
    const isForbiddenPage = () => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
            const text = node.nodeValue;
            if (!text) continue;
            for (const marker of FORBIDDEN_PAGE_MARKERS) {
                if (text.includes(marker)) {
                    const el = node.parentElement;
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        const visible = rect.width > 0 && rect.height > 0 &&
                            rect.bottom > 0 && rect.top < window.innerHeight &&
                            rect.right > 0 && rect.left < window.innerWidth &&
                            el.offsetParent !== null;
                        if (visible) return true;
                    }
                }
            }
        }
        return false;
    };

    // 之前用「页面里随便存在一个 textarea / #composer」来判断"是否在聊天页"，
    // 但很多其他页面（写动态、编辑人设、CSS 编辑器、评论框……）里也会有普通的
    // 多行输入框，导致到处误判、只能靠黑名单一页页去堵，属于治标不治本。
    // 现在改成：必须同时具备「聊天专属容器」和「原生发送按钮」，
    // 这个组合基本只会出现在真正的单聊/群聊会话页面。
    // 上一版要求"同时有发送按钮"结果发现这个app的原生发送按钮
    // 根本不匹配我们猜测的那几个选择器，导致真实聊天页也检测不到了。
    // 退回到只看「聊天专属容器」是否存在——这几个类名本身就是这个
    // app 自定义的容器命名，不像裸 textarea 那样到处都有，足够specific。
    const isRealChatPage = () => {
        const chatContainer = document.querySelector('.chat-compose-bar, .chat-compose-container, #composer');
        return !!chatContainer;
    };

    ctx.kit.every(() => {
        const nativeBar = isRealChatPage();
        const forbidden = isForbiddenPage();
        wrapper.style.display = (nativeBar && !forbidden) ? 'flex' : 'none';
    }, 250);

    // ==========================================
    // 3.1 键盘弹出时的位置修正
    // ==========================================
    // position:fixed 的 bottom 是相对「布局视口」计算的，
    // 而移动端键盘弹出时通常只压缩「可视视口」，
    // 若不做修正，输入栏会被键盘完全遮挡在屏幕外，
    // 表现为“点击输入框时不会弹上来”。
    const updateComposerPosition = () => {
        if (window.visualViewport) {
            const vv = window.visualViewport;
            const keyboardOverlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
            wrapper.style.bottom = (keyboardOverlap + 20) + 'px';
        }
    };
    updateComposerPosition();
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateComposerPosition);
        window.visualViewport.addEventListener('scroll', updateComposerPosition);
    }

    const updateUI = () => {
        document.getElementById('pure-username-text').innerText = ctx.kit.prefs.get("username") || "Selenophilia";
        document.getElementById('pure-subtext-text').innerText = ctx.kit.prefs.get("subtext") || "記憶の片隅 ✈️";
        document.getElementById('pure-real-input').placeholder = ctx.kit.prefs.get("placeholder") || "転送メッセージ...";
    };
    updateUI();
    ctx.kit.prefs.onChange(updateUI);

    document.getElementById('pure-profile-btn').onclick = () => document.getElementById('pure-avatar-upload').click();
    document.getElementById('pure-avatar-upload').onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                document.getElementById('pure-avatar-img').src = event.target.result;
                ctx.kit.kv.set('custom_user_avatar', event.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // 智能找原生按钮触发点击
    document.getElementById('pure-globe-btn').onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        const nativePlus = document.querySelector('button.chat-compose-plus, button[aria-label="更多"], button i.icon-plus');
        if (nativePlus) nativePlus.click();
    };
    
    document.getElementById('pure-mic-btn').onclick = (e) => {
        e.preventDefault();
        const nativeMic = document.querySelector('button.chat-compose-icon.is-voice, button[aria-label="语音发送"]');
        if (nativeMic) nativeMic.click();
    };

    // ==========================================
    // 4. 发送逻辑 (仅保留文本写入和触发发送键)
    // ==========================================
    const forceInjectText = (text) => {
        const nativeTextarea = document.querySelector('textarea, input[type="text"]');
        if (!nativeTextarea) return false;
        
        const nativeSetter = Object.getOwnPropertyDescriptor(
            window[nativeTextarea.tagName === 'TEXTAREA' ? 'HTMLTextAreaElement' : 'HTMLInputElement'].prototype, 
            "value"
        ).set;
        nativeSetter.call(nativeTextarea, text);
        nativeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        nativeTextarea.dispatchEvent(new Event('change', { bubbles: true }));
        return nativeTextarea;
    };

    const myInput = document.getElementById('pure-real-input');

    myInput.addEventListener('input', (e) => forceInjectText(e.target.value));

    myInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            const textToSend = e.target.value.trim();
            if (!textToSend) return;

            const nativeTextarea = forceInjectText(textToSend);
            if (!nativeTextarea) return;

            setTimeout(() => {
                const nativeSendBtn = document.querySelector(
                    'button[aria-label="发送"], button[aria-label="Send"], button.chat-compose-icon.is-send, .chat-compose-send'
                );
                if (nativeSendBtn && !nativeSendBtn.disabled) {
                    nativeSendBtn.click();
                } else {
                    nativeTextarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                }
                myInput.value = '';
                forceInjectText(''); 
            }, 60);
        }
    });

    return () => {
        cleanCss();
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', updateComposerPosition);
            window.visualViewport.removeEventListener('scroll', updateComposerPosition);
        }
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    };
  }
};
