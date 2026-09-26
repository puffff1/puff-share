const manifest = {
  id: "puff-mock-douyin-pro",
  name: "抖音 Pro",
  engine: "puff",
  apiVersion: 1,
  version: "2.0.0",
  description: "全交互版！支持真实更换头像/签名、AI生成评论、AI团购搜索、真实交互直播间及AI主播感谢礼物。",
  settings: [
    { key: "llmApiUrl", label: "大模型 API 地址", type: "text", default: "https://api.openai.com/v1/chat/completions", description: "用于生成评论/团购/主播互动" },
    { key: "llmApiKey", label: "大模型 API Key", type: "text", default: "", description: "必填，否则无法进行 AI 互动" },
    { key: "llmModel", label: "大模型 Model", type: "text", default: "gpt-3.5-turbo" },
    { key: "imgApiUrl", label: "生图 API 地址", type: "text", default: "https://api.openai.com/v1/images/generations" },
    { key: "imgApiKey", label: "生图 API Key", type: "text", default: "" },
    { key: "imgModel", label: "生图模型", type: "text", default: "dall-e-3" }
  ],
  app: {
    name: "抖音",
    icon: 'data:image/svg+xml;utf8,<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="%23111"/><path d="M22 12V30.5C22 34.0899 19.0899 37 15.5 37C11.9101 37 9 34.0899 9 30.5C9 26.9101 11.9101 24 15.5 24C16.368 24 17.1963 24.1706 17.9543 24.4789V18.1568C17.1738 17.9152 16.3503 17.7844 15.5 17.7844C12.1664 17.7844 9.1555 19.167 7 21.391V12H13.7801C14.7371 15.8647 18.068 18.8 22 19V12Z" fill="%2325F4EE"/><path d="M24 12V30.5C24 34.0899 21.0899 37 17.5 37C13.9101 37 11 34.0899 11 30.5C11 26.9101 13.9101 24 17.5 24C18.368 24 19.1963 24.1706 19.9543 24.4789V18.1568C19.1738 17.9152 18.3503 17.7844 17.5 17.7844C14.1664 17.7844 11.1555 19.167 9 21.391V12H15.7801C16.7371 15.8647 20.068 18.8 24 19V12Z" fill="%23FE2C55"/><path d="M23 12V30.5C23 34.0899 20.0899 37 16.5 37C12.9101 37 10 34.0899 10 30.5C10 26.9101 12.9101 24 16.5 24C17.368 24 18.1963 24.1706 18.9543 24.4789V18.1568C18.1738 17.9152 17.3503 17.7844 16.5 17.7844C13.1664 17.7844 10.1555 19.167 8 21.391V12H14.7801C15.7371 15.8647 19.068 18.8 23 19V12Z" fill="%23FFF"/></svg>'
  }
};

function setup(ctx) {
  // --- 基础数据与状态 ---
  const kv = ctx.kit.kv;
  let profile = kv.get("dy_profile") || { name: "Puff 体验官", bio: "这个人很懒，什么都没留下。", avatar: "" };
  let commentsCache = kv.get("dy_comments") || {}; // { videoId: [] }
  let likesCache = kv.get("dy_likes") || {};       // { videoId: boolean }

  const mockVideos = [
    { id: "v1", bg: "linear-gradient(45deg, #ff9a9e, #fecfef)", user: "@Puff官方", desc: "欢迎来到 Puff 模拟抖音！点击右侧评论区试试 AI 生成评论吧～", likes: 12500, comments: 1200 },
    { id: "v2", bg: "linear-gradient(to top, #a18cd1, #fbc2eb)", user: "@风景收集者", desc: "今天的天空真的好美，治愈你的一天。☁️✨", likes: 8300, comments: 450 },
    { id: "v3", bg: "linear-gradient(120deg, #84fab0, #8fd3f4)", user: "@搞笑大王", desc: "当你试图在周一早上起床的时候... 😂", likes: 23000, comments: 3400 },
    { id: "v4", bg: "linear-gradient(to right, #4facfe, #00f2fe)", user: "@知识百科", desc: "冷知识：你知道章鱼有三颗心脏吗？🐙", likes: 1100, comments: 30 }
  ];

  const mockLives = [
    { id: "l1", bg: "#1a1a2e", name: "深夜电台主播", title: "情感树洞，进来聊聊", viewers: "1.2w" },
    { id: "l2", bg: "#4a0e4e", name: "游戏大神", title: "无伤速通挑战，失败就下播！", viewers: "5.6w" },
    { id: "l3", bg: "#0f3460", name: "助眠ASMR", title: "闭上眼睛，带你进入梦乡", viewers: "3000+" }
  ];

  // --- AI 核心调用函数 ---
  async function askAI(prompt, isJson = false) {
    const url = ctx.kit.prefs.get("llmApiUrl");
    const key = ctx.kit.prefs.get("llmApiKey");
    const model = ctx.kit.prefs.get("llmModel") || "gpt-3.5-turbo";
    if (!key) throw new Error("请先在插件设置中填写大模型 API Key");

    const res = await ctx.kit.net(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const content = data.choices[0].message.content;
    
    if (isJson) {
      try {
        const match = content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : content);
      } catch(e) {
        throw new Error("AI 返回的数据格式解析失败");
      }
    }
    return content;
  }

  // --- 主 UI 构建 ---
  return ctx.ui.appPage(function(el, helpers) {
    const style = document.createElement("style");
    style.textContent = `
      .dy-app { display: flex; flex-direction: column; height: 100%; width: 100%; background: #000; color: #fff; font-family: sans-serif; overflow: hidden; position: relative; }
      .dy-content { flex: 1; position: relative; overflow: hidden; background: #111; }
      .dy-tabbar { display: flex; justify-content: space-around; align-items: center; height: 50px; background: #000; border-top: 0.5px solid #333; padding-bottom: env(safe-area-inset-bottom); z-index: 100; }
      .dy-tab { padding: 10px; font-size: 15px; color: #888; font-weight: 500; cursor: pointer; transition: 0.2s; }
      .dy-tab:active { opacity: 0.5; }
      .dy-tab.active { color: #fff; font-weight: bold; }
      .dy-tab.active::after { content: ''; display: block; width: 20px; height: 2px; background: #fff; margin: 4px auto 0; border-radius: 2px; }
      .dy-btn { cursor: pointer; transition: 0.2s; }
      .dy-btn:active { opacity: 0.6; transform: scale(0.95); }
      
      .dy-video-container { width: 100%; height: 100%; position: absolute; top: 0; left: 0; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 20px; }
      .dy-right-bar { position: absolute; right: 10px; bottom: 80px; display: flex; flex-direction: column; align-items: center; gap: 20px; z-index: 10; }
      .dy-icon-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); cursor: pointer; }
      .dy-icon { width: 35px; height: 35px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: 0.2s; }
      .dy-icon:active { transform: scale(0.8); }
      .dy-icon.liked { color: #FE2C55; text-shadow: none; }
      
      .dy-page { width: 100%; height: 100%; overflow-y: auto; background: #f8f8f8; color: #333; display: none; position: absolute; top: 0; }
      .dy-page.dark { background: #111; color: #fff; }
      
      /* 弹窗系统 */
      .dy-modal-mask { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999; display: none; flex-direction: column; justify-content: flex-end; }
      .dy-modal-content { background: #fff; color: #333; width: 100%; height: 70%; border-radius: 12px 12px 0 0; display: flex; flex-direction: column; animation: slideUp 0.3s ease; }
      @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      
      /* 评论区 */
      .dy-comment-item { display: flex; gap: 10px; padding: 15px; border-bottom: 1px solid #eee; }
      .dy-comment-avatar { width: 36px; height: 36px; border-radius: 50%; background: #ccc; flex-shrink: 0; }
      
      /* 直播间真实互动 */
      .dy-live-room { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000; z-index: 900; display: none; flex-direction: column; }
      .dy-chat-box { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; justify-content: flex-end; gap: 8px; mask-image: linear-gradient(to bottom, transparent, black 20%); -webkit-mask-image: linear-gradient(to bottom, transparent, black 20%); }
      .dy-chat-msg { background: rgba(0,0,0,0.3); padding: 6px 12px; border-radius: 12px; width: fit-content; font-size: 14px; max-width: 80%; }
      .dy-gift-bar { display: flex; gap: 10px; padding: 10px; background: rgba(0,0,0,0.5); align-items: center; }
    `;
    el.appendChild(style);

    const appContainer = document.createElement("div");
    appContainer.className = "dy-app";
    el.appendChild(appContainer);

    const contentArea = document.createElement("div");
    contentArea.className = "dy-content";
    appContainer.appendChild(contentArea);

    // 四大页面
    const homePage = document.createElement("div"); homePage.style.cssText = "width:100%; height:100%; position:absolute; top:0; background:#000;";
    const localPage = document.createElement("div"); localPage.className = "dy-page";
    const livePage = document.createElement("div"); livePage.className = "dy-page dark";
    const mePage = document.createElement("div"); mePage.className = "dy-page dark";

    contentArea.append(homePage, localPage, livePage, mePage);

    // 底部导航
    const tabBar = document.createElement("div");
    tabBar.className = "dy-tabbar";
    tabBar.innerHTML = `
      <div class="dy-tab active" data-target="home">首页</div>
      <div class="dy-tab" data-target="local">团购</div>
      <div class="dy-tab" style="font-weight:bold; font-size:24px; color:#fff;">+</div>
      <div class="dy-tab" data-target="live">直播</div>
      <div class="dy-tab" data-target="me">我</div>
    `;
    appContainer.appendChild(tabBar);

    // 弹窗容器
    const modalMask = document.createElement("div");
    modalMask.className = "dy-modal-mask";
    appContainer.appendChild(modalMask);
    modalMask.onclick = (e) => { if (e.target === modalMask) modalMask.style.display = "none"; };

    // --- 1. 首页刷视频 ---
    let currentVideoIdx = 0;
    function renderVideo() {
      const v = mockVideos[currentVideoIdx];
      const isLiked = likesCache[v.id];
      const likeCount = isLiked ? v.likes + 1 : v.likes;
      
      homePage.innerHTML = `
        <div class="dy-video-container" style="background: ${v.bg};">
          <div style="position:absolute; top:40px; right:20px; font-size:20px; cursor:pointer; z-index:20;" id="dy-refresh-btn" class="dy-btn">🔄</div>
          <div class="dy-right-bar">
            <div style="width: 45px; height: 45px; border-radius: 50%; border: 2px solid #fff; background: #666; margin-bottom: 10px;"></div>
            <div class="dy-icon-btn" id="dy-btn-like">
              <div class="dy-icon ${isLiked ? 'liked' : ''}">${isLiked ? '❤️' : '🤍'}</div>
              <span id="dy-like-count">${likeCount}</span>
            </div>
            <div class="dy-icon-btn" id="dy-btn-comment">
              <div class="dy-icon">💬</div><span>${v.comments}</span>
            </div>
            <div class="dy-icon-btn"><div class="dy-icon">⭐</div><span>收藏</span></div>
            <div class="dy-icon-btn"><div class="dy-icon">↪️</div><span>分享</span></div>
          </div>
          <div style="padding: 15px; z-index: 10; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); width: 75%; pointer-events: none;">
            <div style="font-size: 17px; font-weight: bold; margin-bottom: 8px;">${v.user}</div>
            <div style="font-size: 14px; line-height: 1.4;">${v.desc}</div>
          </div>
        </div>
      `;

      // 点赞逻辑
      homePage.querySelector("#dy-btn-like").onclick = () => {
        likesCache[v.id] = !likesCache[v.id];
        kv.set("dy_likes", likesCache);
        renderVideo();
      };

      // 刷新逻辑(打乱)
      homePage.querySelector("#dy-refresh-btn").onclick = () => {
        ctx.ui.toast("已为您刷新推荐内容");
        currentVideoIdx = Math.floor(Math.random() * mockVideos.length);
        renderVideo();
      };

      // 评论区逻辑
      homePage.querySelector("#dy-btn-comment").onclick = () => openComments(v);
    }

    // 视频滑动逻辑
    let startY = 0;
    homePage.addEventListener("touchstart", (e) => { startY = e.touches[0].clientY; });
    homePage.addEventListener("touchend", (e) => {
      if (e.target.closest('.dy-btn') || e.target.closest('.dy-icon-btn')) return;
      const diff = startY - e.changedTouches[0].clientY;
      if (diff > 50) { currentVideoIdx = (currentVideoIdx + 1) % mockVideos.length; renderVideo(); } 
      else if (diff < -50) { currentVideoIdx = (currentVideoIdx - 1 + mockVideos.length) % mockVideos.length; renderVideo(); }
    });

    // 打开评论区
    function openComments(v) {
      modalMask.style.display = "flex";
      modalMask.innerHTML = `
        <div class="dy-modal-content">
          <div style="text-align:center; padding:15px; font-weight:bold; border-bottom:1px solid #eee; position:relative;">
            共 ${v.comments} 条评论
            <span style="position:absolute; right:15px; top:15px; color:#999; cursor:pointer;" id="dy-close-modal">✕</span>
          </div>
          <div id="dy-comment-list" style="flex:1; overflow-y:auto; background:#f9f9f9;"></div>
          <div style="padding:10px; border-top:1px solid #eee; display:flex; gap:10px; align-items:center;">
            <input type="text" placeholder="留下你的精彩评论..." style="flex:1; padding:10px; border-radius:20px; border:none; background:#f0f0f0; outline:none;">
            <button id="dy-ai-comment-btn" class="dy-btn" style="background:#FE2C55; color:#fff; border:none; padding:10px 15px; border-radius:20px; font-weight:bold;">AI 刷新评论</button>
          </div>
        </div>
      `;
      modalMask.querySelector("#dy-close-modal").onclick = () => modalMask.style.display = "none";
      
      const listEl = modalMask.querySelector("#dy-comment-list");
      const renderList = () => {
        const list = commentsCache[v.id] || [];
        if (list.length === 0) {
          listEl.innerHTML = `<div style="text-align:center; padding:40px; color:#999;">暂无评论，点击右下角让 AI 生成一些吧</div>`;
          return;
        }
        listEl.innerHTML = list.map(c => `
          <div class="dy-comment-item">
            <div class="dy-comment-avatar"></div>
            <div style="flex:1;">
              <div style="color:#666; font-size:13px; margin-bottom:4px;">${c.u}</div>
              <div style="font-size:15px; line-height:1.4;">${c.t}</div>
            </div>
          </div>
        `).join('');
      };
      renderList();

      // AI 生成评论
      modalMask.querySelector("#dy-ai-comment-btn").onclick = async function() {
        const btn = this;
        btn.textContent = "生成中..."; btn.disabled = true;
        try {
          const prompt = `你现在是抖音网友。请针对视频描述：“${v.desc}” 生成3条逼真、有趣的短评。必须返回严格的JSON数组格式：[{"u":"随机网名", "t":"评论内容"}]`;
          const res = await askAI(prompt, true);
          if (Array.isArray(res)) {
            commentsCache[v.id] = res;
            kv.set("dy_comments", commentsCache);
            renderList();
            ctx.ui.toast("评论已刷新");
          }
        } catch(e) {
          ctx.ui.toast(e.message);
        } finally {
          btn.textContent = "AI 刷新评论"; btn.disabled = false;
        }
      };
    }

    // --- 2. 团购页 (AI 生成) ---
    function renderLocal() {
      localPage.innerHTML = `
        <div style="padding: 15px; background: #fff; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid #eee;">
          <div style="display:flex; gap:10px;">
            <input id="dy-local-search" type="text" placeholder="搜你想吃的/玩的 (支持离谱脑洞)" style="flex:1; padding:10px 15px; border-radius:20px; border:none; background:#f5f5f5; outline:none;">
            <button id="dy-local-btn" class="dy-btn" style="background:#FE2C55; color:#fff; border:none; padding:0 20px; border-radius:20px; font-weight:bold;">搜索</button>
          </div>
        </div>
        <div id="dy-local-list" style="padding: 15px; display:flex; flex-direction:column; gap:15px;">
          <div style="text-align:center; padding:40px; color:#999;">试试搜索：“赛博朋克火锅” 或 “奥特曼修脚”</div>
        </div>
      `;

      localPage.querySelector("#dy-local-btn").onclick = async function() {
        const query = localPage.querySelector("#dy-local-search").value.trim() || "热门套餐";
        const listEl = localPage.querySelector("#dy-local-list");
        this.textContent = "搜索中..."; this.disabled = true;
        listEl.innerHTML = `<div style="text-align:center; padding:40px; color:#999;">AI 正在为您定制团购套餐...</div>`;
        
        try {
          const prompt = `用户在抖音团购搜索了“${query}”。请发挥想象力，生成3个相关的团购套餐。返回严格的JSON数组格式：[{"title":"套餐名","tag":"分类(两字)","price":"现价","old":"原价","icon":"一个Emoji"}]`;
          const res = await askAI(prompt, true);
          if (Array.isArray(res)) {
            listEl.innerHTML = res.map(item => `
              <div style="background:#fff; border-radius:12px; padding:15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display:flex; gap:12px;">
                <div style="width:90px; height:90px; background:#eee; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:30px;">${item.icon || '🛍️'}</div>
                <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between;">
                  <div style="font-weight:bold; font-size:16px;">${item.title}</div>
                  <div style="color:#FE2C55; font-size:12px; background:rgba(254,44,85,0.1); padding:2px 6px; border-radius:4px; width:fit-content;">${item.tag || '特惠'}</div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                    <div>
                      <span style="color:#FE2C55; font-size:20px; font-weight:bold;">¥${item.price}</span>
                      <span style="color:#999; font-size:12px; text-decoration:line-through; margin-left:4px;">¥${item.old}</span>
                    </div>
                    <button class="dy-btn" style="background:#FE2C55; color:#fff; border:none; padding:6px 16px; border-radius:20px; font-weight:bold; font-size:13px;" onclick="alert('购买成功！扣除赛博币 ${item.price}')">抢购</button>
                  </div>
                </div>
              </div>
            `).join('');
          }
        } catch(e) {
          listEl.innerHTML = `<div style="text-align:center; padding:40px; color:#FE2C55;">${e.message}</div>`;
        } finally {
          this.textContent = "搜索"; this.disabled = false;
        }
      };
    }

    // --- 3. 直播页 (滑动列表 + 真实互动直播间) ---
    const liveRoomUI = document.createElement("div");
    liveRoomUI.className = "dy-live-room";
    appContainer.appendChild(liveRoomUI);

    let currentLiveIdx = 0;
    function renderLiveList() {
      const l = mockLives[currentLiveIdx];
      livePage.innerHTML = `
        <div style="width:100%; height:100%; background:${l.bg}; display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative;">
          <div style="position:absolute; top:40px; left:20px; background:rgba(0,0,0,0.5); padding:6px 12px; border-radius:20px; font-size:14px;">上下滑动切换房间</div>
          <div style="width:100px; height:100px; border-radius:50%; background:#fff; margin-bottom:20px; display:flex; align-items:center; justify-content:center; font-size:40px;">🎙️</div>
          <h2 style="margin:0 0 10px 0;">${l.name}</h2>
          <p style="color:#ccc; margin-bottom:30px;">${l.title}</p>
          <button id="dy-enter-live" class="dy-btn" style="background:#FE2C55; color:#fff; border:none; padding:15px 40px; border-radius:30px; font-size:18px; font-weight:bold; box-shadow:0 4px 15px rgba(254,44,85,0.4);">进入直播间 (${l.viewers}人在看)</button>
        </div>
      `;

      livePage.querySelector("#dy-enter-live").onclick = () => openLiveRoom(l);
    }

    let liveStartY = 0;
    livePage.addEventListener("touchstart", (e) => { liveStartY = e.touches[0].clientY; });
    livePage.addEventListener("touchend", (e) => {
      if (e.target.closest('.dy-btn')) return;
      const diff = liveStartY - e.changedTouches[0].clientY;
      if (diff > 50) { currentLiveIdx = (currentLiveIdx + 1) % mockLives.length; renderLiveList(); } 
      else if (diff < -50) { currentLiveIdx = (currentLiveIdx - 1 + mockLives.length) % mockLives.length; renderLiveList(); }
    });

    // 真实互动直播间
    function openLiveRoom(room) {
      liveRoomUI.style.display = "flex";
      liveRoomUI.innerHTML = `
        <div style="padding:40px 15px 15px 15px; display:flex; justify-content:space-between; align-items:center; background:linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);">
          <div style="display:flex; align-items:center; gap:10px; background:rgba(0,0,0,0.4); padding:4px 12px 4px 4px; border-radius:20px;">
            <div style="width:32px; height:32px; border-radius:50%; background:#FE2C55; display:flex; align-items:center; justify-content:center; font-size:12px;">LIVE</div>
            <div>
              <div style="font-size:12px; font-weight:bold;">${room.name}</div>
              <div style="font-size:10px; color:#ccc;">${room.viewers} 观看</div>
            </div>
          </div>
          <div id="dy-close-live" class="dy-btn" style="width:30px; height:30px; background:rgba(0,0,0,0.5); border-radius:50%; display:flex; align-items:center; justify-content:center;">✕</div>
        </div>
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#666; font-size:14px; background:${room.bg};">
          <div>(脑补这里有画面)</div>
        </div>
        <div id="dy-live-chat" class="dy-chat-box">
          <div class="dy-chat-msg"><span style="color:#FE2C55;">系统</span>: 欢迎来到直播间！发个礼物试试主播反应？</div>
        </div>
        <div class="dy-gift-bar">
          <input id="dy-live-input" type="text" placeholder="说点什么..." style="flex:1; padding:10px; border-radius:20px; border:none; background:rgba(255,255,255,0.2); color:#fff; outline:none;">
          <button class="dy-btn dy-gift-btn" data-gift="🌹" style="background:transparent; border:none; font-size:24px;">🌹</button>
          <button class="dy-btn dy-gift-btn" data-gift="🚀" style="background:transparent; border:none; font-size:24px;">🚀</button>
        </div>
      `;

      liveRoomUI.querySelector("#dy-close-live").onclick = () => liveRoomUI.style.display = "none";
      
      const chatBox = liveRoomUI.querySelector("#dy-live-chat");
      const appendChat = (name, text, color="#8fd3f4") => {
        const el = document.createElement("div"); el.className = "dy-chat-msg";
        el.innerHTML = `<span style="color:${color};">${name}</span>: ${text}`;
        chatBox.appendChild(el);
        chatBox.scrollTop = chatBox.scrollHeight;
      };

      // 发言
      liveRoomUI.querySelector("#dy-live-input").addEventListener("keypress", (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
          appendChat("我", e.target.value.trim(), "#fff");
          e.target.value = '';
        }
      });

      // 刷礼物 (触发大模型互动)
      liveRoomUI.querySelectorAll(".dy-gift-btn").forEach(btn => {
        btn.onclick = async function() {
          const gift = this.getAttribute("data-gift");
          appendChat("我", `送出 ${gift}`, "#ffeb3b");
          try {
            const prompt = `你现在是抖音主播"${room.name}"。观众刚送了你一个礼物【${gift}】。请用符合你人设的、简短口语化的语言感谢他（50字以内，可包含动作描写如*比心*）。`;
            const reply = await askAI(prompt, false);
            appendChat("主播", reply, "#FE2C55");
          } catch(e) {
            appendChat("系统", e.message, "#ff5722");
          }
        };
      });
    }

    // --- 4. 真实个人主页 (更换头像/签名) ---
    function renderMe() {
      mePage.innerHTML = `
        <div style="height:150px; background:linear-gradient(to bottom, #333, #111); position:relative;">
          <div style="position:absolute; bottom:-30px; left:20px; display:flex; align-items:flex-end; gap:15px;">
            <div id="dy-avatar-btn" class="dy-btn" style="width:80px; height:80px; border-radius:50%; background-color:#888; background-image:url('${profile.avatar}'); background-size:cover; background-position:center; border:4px solid #111; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.5); font-size:12px;">${profile.avatar?'':'换头像'}</div>
            <div style="margin-bottom:5px;">
              <h2 style="margin:0; font-size:22px;">${profile.name}</h2>
              <div style="color:#aaa; font-size:12px; margin-top:4px;">抖音号: dy_user_888</div>
            </div>
          </div>
        </div>
        <div style="padding: 50px 20px 20px 20px;">
          <div style="display:flex; gap:20px; font-size:15px; margin-bottom:15px;">
            <div><span style="font-weight:bold; font-size:18px;">0</span> 获赞</div>
            <div><span style="font-weight:bold; font-size:18px;">0</span> 关注</div>
            <div><span style="font-weight:bold; font-size:18px;">0</span> 粉丝</div>
          </div>
          <p style="color:#ccc; font-size:14px;">${profile.bio}</p>
          <div style="display:flex; gap:10px; margin-top:20px;">
            <button id="dy-edit-profile" class="dy-btn" style="flex:1; background:#333; color:#fff; border:none; padding:10px; border-radius:4px; font-weight:bold;">编辑资料</button>
            <button class="dy-btn" style="flex:1; background:#333; color:#fff; border:none; padding:10px; border-radius:4px; font-weight:bold;" onclick="alert('开发中...')">添加朋友</button>
          </div>
        </div>
        <input type="file" id="dy-avatar-input" accept="image/*" style="display:none;">
      `;

      // 换头像
      const fileInput = mePage.querySelector("#dy-avatar-input");
      mePage.querySelector("#dy-avatar-btn").onclick = () => fileInput.click();
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          profile.avatar = ev.target.result;
          kv.set("dy_profile", profile);
          renderMe();
          ctx.ui.toast("头像更新成功");
        };
        reader.readAsDataURL(file);
      };

      // 改资料
      mePage.querySelector("#dy-edit-profile").onclick = () => {
        const newName = prompt("请输入新昵称", profile.name);
        if (newName !== null) profile.name = newName.trim() || profile.name;
        const newBio = prompt("请输入个性签名", profile.bio);
        if (newBio !== null) profile.bio = newBio.trim() || profile.bio;
        kv.set("dy_profile", profile);
        renderMe();
      };
    }

    // --- Tab 切换逻辑 ---
    const tabs = tabBar.querySelectorAll(".dy-tab[data-target]");
    const pages = { home: homePage, local: localPage, live: livePage, me: mePage };

    tabs.forEach(tab => {
      tab.onclick = function() {
        tabs.forEach(t => t.classList.remove("active"));
        Object.values(pages).forEach(p => p.style.display = "none");
        
        this.classList.add("active");
        const target = this.getAttribute("data-target");
        if (pages[target]) {
          pages[target].style.display = "block";
          if (target === 'home') renderVideo();
          if (target === 'local') renderLocal();
          if (target === 'live') renderLiveList();
          if (target === 'me') renderMe();
        }
      };
    });

    // 初始渲染
    renderVideo();
    homePage.style.display = "block";
  });
}

export default { manifest, setup };