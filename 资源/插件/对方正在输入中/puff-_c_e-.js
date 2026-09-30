export default {
  manifest: {
    id: "puff-typing-name-css",
    name: "输入中名字替换（日夜间适配版）",
    engine: "puff",
    apiVersion: 1,
    version: "1.0.0",
    description: "打字时名字替换为“对方正在输入...”，日间黑色，夜间白色",
  },
  setup(ctx) {
    ctx.ui.css(`
      /* 1. 隐藏原本的名字 */
      .chat-msg:has(.chat-bubble-typing) h2,
      *:has(> .chat-bubble-typing) h2,
      *:has(.chat-bubble-typing) h2 {
        font-size: 0 !important;
        color: transparent !important;
        display: inline-block !important;
      }

      /* 2. 插入“对方正在输入...” —— 日间模式（黑色） */
      .chat-msg:has(.chat-bubble-typing) h2::before,
      *:has(> .chat-bubble-typing) h2::before,
      *:has(.chat-bubble-typing) h2::before {
        content: "对方正在输入..." !important;
        font-size: 12px !important;
        color: #000000 !important; /* 你要求的黑色 */
        font-weight: normal !important;
      }

      /* 3. 夜间模式（白色）—— 匹配你预设中的 data-theme="dark" */
      html[data-theme="dark"] .chat-msg:has(.chat-bubble-typing) h2::before,
      html[data-theme="dark"] *:has(> .chat-bubble-typing) h2::before,
      html[data-theme="dark"] *:has(.chat-bubble-typing) h2::before {
        color: #ffffff !important; /* 你要求的白色 */
      }
    `);
  }
};