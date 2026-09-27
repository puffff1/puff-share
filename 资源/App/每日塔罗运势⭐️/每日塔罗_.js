export default {
  manifest: {
    id: "daily-tarot-puff-v2",
    name: "每日塔罗",
    engine: "puff",
    apiVersion: 1,
    version: "1.0.1",
    author: "you",
    description: "点开星星图标，抽一张传统韦特塔罗牌，看看今日运势",
    app: { name: "每日塔罗", letter: "塔" }
  },

  setup(ctx) {
    ctx.ui.css([
      ".pt-wrap{width:100%;max-width:400px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:18px;padding:26px 18px 34px;border-radius:24px;background:radial-gradient(circle at 30% 20%,#1c1b33,#0a0a16 80%);box-shadow:0 12px 40px rgba(0,0,0,.5);position:relative;overflow:hidden;box-sizing:border-box;color:#e8e0ff}",
      ".pt-stars{position:absolute;inset:0;pointer-events:none;overflow:hidden}",
      ".pt-stars span{position:absolute;display:block;border-radius:50%;background:#fff;opacity:0;animation:ptTw 4s infinite ease-in-out}",
      "@keyframes ptTw{0%,100%{opacity:0}50%{opacity:.8}}",
      ".pt-head{text-align:center;position:relative;z-index:2}",
      ".pt-head h1{font-size:22px;font-weight:600;letter-spacing:.15em;margin:0;color:#e8e0ff;text-shadow:0 0 22px rgba(160,130,255,.35)}",
      ".pt-head p{font-size:12px;color:#8a7fb0;margin:6px 0 0;letter-spacing:.08em}",
      ".pt-stage{width:210px;height:335px;perspective:1200px;position:relative;z-index:2}",
      ".pt-card{width:100%;height:100%;border-radius:16px;position:relative;transform-style:preserve-3d;transition:transform .65s cubic-bezier(.4,0,.2,1);cursor:pointer;box-shadow:0 12px 32px rgba(0,0,0,.5);will-change:transform}",
      ".pt-card.flip{transform:rotateY(180deg)}",
      ".pt-face{position:absolute;inset:0;border-radius:16px;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;transform-style:preserve-3d}",
      ".pt-back{background:linear-gradient(145deg,#2a1f4e,#1a1233 60%,#0f0a22);border:1px solid rgba(150,120,230,.25);transform:rotateY(0deg)}",
      ".pt-back-in{width:88%;height:92%;border-radius:10px;border:1px solid rgba(160,130,240,.2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:repeating-linear-gradient(45deg,rgba(255,255,255,.015) 0 2px,transparent 2px 8px)}",
      ".pt-back-in .pt-moon{font-size:44px;filter:drop-shadow(0 0 14px rgba(180,150,255,.6));animation:ptFl 3s ease-in-out infinite}",
      "@keyframes ptFl{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}",
      ".pt-back-in .pt-tag{font-size:11px;color:#a99ad6;letter-spacing:.3em;text-transform:uppercase}",
      ".pt-front{background:linear-gradient(160deg,#1e1a36,#14102a);border:1px solid rgba(170,140,255,.3);transform:rotateY(180deg);padding:20px 14px;justify-content:space-between;text-align:center}",
      ".pt-num{font-size:11px;color:#7f72a8;letter-spacing:.25em}",
      ".pt-name{font-size:24px;font-weight:600;color:#f0eaff;margin-top:6px;line-height:1.2;text-shadow:0 0 20px rgba(160,130,255,.4)}",
      ".pt-pos{display:inline-block;font-size:11px;padding:2px 10px;border-radius:999px;margin-top:8px;letter-spacing:.1em}",
      ".pt-pos.up{background:rgba(100,220,180,.15);color:#7ee8c0;border:1px solid rgba(100,220,180,.3)}",
      ".pt-pos.rev{background:rgba(230,130,150,.15);color:#f0a0b0;border:1px solid rgba(230,130,150,.3)}",
      ".pt-icon{font-size:50px;filter:drop-shadow(0 0 14px rgba(180,150,255,.5))}",
      ".pt-mean{width:100%;font-size:13px;line-height:1.7;color:#b8aed6}",
      ".pt-acts{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:10px;width:100%}",
      ".pt-btn{border:0;border-radius:999px;padding:12px 34px;font-size:15px;font-weight:600;letter-spacing:.08em;color:#fff;background:linear-gradient(135deg,#7c5cff,#b06cf0);box-shadow:0 10px 28px rgba(124,92,255,.4);cursor:pointer;font-family:inherit;transition:transform .15s,box-shadow .15s,opacity .2s}",
      ".pt-btn:active{transform:scale(.97)}",
      ".pt-btn:disabled{opacity:.5;cursor:not-allowed}",
      ".pt-hint{font-size:12px;color:#6f6590;letter-spacing:.06em;text-align:center;min-height:18px}",
      ".pt-extra{position:relative;z-index:2;width:100%;display:flex;flex-direction:column;gap:8px;animation:ptIn .6s ease forwards}",
      ".pt-extra .pt-line{height:1px;background:linear-gradient(90deg,transparent,rgba(160,130,240,.25),transparent)}",
      ".pt-extra .pt-quote{font-size:13px;color:#8f84b5;line-height:1.7;text-align:center;font-style:italic}",
      "@keyframes ptIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}"
    ].join(""));

    var MAJOR = [
      ["愚者","崭新的开始，带着信任往前跳","冒失冲动，先看清脚下再动","🃏"],
      ["魔术师","资源都在你手上，动手就能成","空想不动手，或用错了力气","🎩"],
      ["女祭司","答案在安静里，先听直觉","忽视内心的声音，被表象迷惑","🌙"],
      ["皇后","丰盛与滋养，温柔地善待自己","付出过度，忘了照顾自己","👑"],
      ["皇帝","立规矩、拿主意，把结构稳住","太过强硬，或该负责时退缩","🏛️"],
      ["教皇","遵循传统，或向过来人请教","被旧规矩绑住，形式大于真心","📜"],
      ["恋人","心动的选择，忠于真正想要的","犹豫摇摆，关系里有点失衡","💞"],
      ["战车","方向定了就冲，靠意志破局","用力过猛失控，方向该重定","⚔️"],
      ["力量","用温柔驯服，而不是硬碰硬","底气不足，被情绪牵着走","🦁"],
      ["隐士","退一步独处，答案要向内找","把自己关太久，该出来走走了","🕯️"],
      ["命运之轮","转机来了，顺势而为","卡在原地，时机还没到","🎡"],
      ["正义","因果清明，该谈的规则要谈","天平倾斜，别自欺欺人","⚖️"],
      ["倒吊人","换个角度，暂停也有意义","白耗着不肯放手，牺牲无谓","🙃"],
      ["死神","旧的结束，才有新的开始","抗拒改变，拖得自己更累","🦋"],
      ["节制","调和与耐心，别走极端","失去平衡，节奏乱掉了","🍶"],
      ["恶魔","看见执念，你其实有别的选择","越陷越深，被欲望牵着走","😈"],
      ["高塔","突然的崩塌，为重建腾地方","拖着的危机爆开，先保人","🗼"],
      ["星星","希望与疗愈，慢慢会好起来","信心不足，期待落空","⭐"],
      ["月亮","情绪起伏，别在雾里做决定","迷雾散开，看清被藏的事","🌕"],
      ["太阳","明朗顺利，值得开心的一天","高兴过头，或光被云挡一会儿","☀️"],
      ["审判","召唤与复盘，该做决定了","逃避总结，旧事反复重演","📯"],
      ["世界","一个循环圆满收官","差最后一步，别急着收尾","🌍"]
    ];
    var ROMAN = ["0","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX","XXI"];

    var SUIT = {
      "权杖":[["权杖首牌","灵感点燃，行动力涌现","想动却点不着火","🔥"],["权杖二","站在起点，谋划远方","计划搁浅，不敢迈出去","🗺️"],["权杖三","视野打开，等成果靠岸","期待落空，或好事来得慢","⛵"],["权杖四","阶段性的安稳与庆祝","家里或团队里有点小别扭","🏡"],["权杖五","小摩擦小竞争，别太当真","内耗升级，先退一步","🤺"],["权杖六","被看见的胜利与肯定","风头受挫，掌声没有来","🏆"],["权杖七","守住立场，你其实占优势","被压得喘不过气，先稳住","🛡️"],["权杖八","事情加速，消息很快到","卡顿延迟，急也没用","💨"],["权杖九","带伤坚持，就快到终点","警惕过头，疑心太重","🩹"],["权杖十","扛太多了，该卸下一些","撑不住就放下，别硬扛","🎒"],["权杖侍从","跃跃欲试的新消息","三分钟热度，消息不实","📨"],["权杖骑士","热烈出发，行动力拉满","冲动莽撞，说走就走","🏇"],["权杖王后","自信又温暖的吸引力","情绪外放，容易炸毛","🌻"],["权杖国王","掌控全局的行动派","独断专行，听不进劝","🦅"]],
      "圣杯":[["圣杯首牌","心被打开，感情泉涌","情感堵塞，提不起劲","💧"],["圣杯二","对等的连接与默契","关系失衡，一方付出更多","🤝"],["圣杯三","朋友相聚，分享快乐","社交成了负担，或被人排挤","🥂"],["圣杯四","有点倦，机会在眼前被忽略","重新提起兴趣，走出闷局","😑"],["圣杯五","为失去难过，别忘了还剩的","慢慢放下，回头看看拥有的","🍂"],["圣杯六","旧人旧事带来暖意","困在回忆里，回不到从前","🌸"],["圣杯七","选择太多，先分清幻想","拨开迷雾，看清真正要的","🌈"],["圣杯八","放下不再滋养你的关系","舍不得走，反反复复","🚶"],["圣杯九","心愿达成，好好享受","满足了却还是空，方向错了","🥰"],["圣杯十","圆满、被爱包围","表面和谐，底下有裂缝","🏠"],["圣杯侍从","细腻的心意与告白","情绪化，说话不走心","🐟"],["圣杯骑士","带着诚意的浪漫靠近","空口承诺，浪漫变泡沫","🐴"],["圣杯王后","共情与温柔的包容","过度共情，把自己耗空","👸"],["圣杯国王","情绪稳，能给人依靠","情感压抑，或情绪操控","🌊"]],
      "宝剑":[["宝剑首牌","思路一下子劈开","脑子有点乱，想不通","🗡️"],["宝剑二","回避选择，心里在拉扯","必须做决定了，别再拖","🙈"],["宝剑三","扎心的真相，允许自己疼","伤口在愈合，慢慢来","💔"],["宝剑四","该休息了，暂停不是放弃","休够了，该回到场上了","😴"],["宝剑五","赢了争执，输了关系","放下胜负，和解还有机会","🥀"],["宝剑六","离开旧水域，慢慢过渡","走不动，或旧事又拽你回去","⛵"],["宝剑七","别走捷径，坦白更省事","谎言快兜不住，早点说清","🎭"],["宝剑八","捆住你的多半是想太多","松开绳子，其实门没锁","🔗"],["宝剑九","深夜焦虑，别信最坏剧本","天亮了，恐惧比现实大","🌑"],["宝剑十","触底了，结束也是解脱","最坏的过去了，正在爬起来","🌅"],["宝剑侍从","好奇、打探、消息灵通","传话生事，说人闲话","👀"],["宝剑骑士","语速很快，先想再说","咄咄逼人，容易伤到人","🌪️"],["宝剑王后","清醒、界限分明","话说得太利，冷了人心","❄️"],["宝剑国王","理性决断，讲道理","太冷硬，忘了人情","🧊"]],
      "星币":[["星币首牌","实在的机会落到手里","机会没抓牢，或钱没到位","🪙"],["星币二","左右腾挪，维持平衡","顾此失彼，快撑不住了","⚖️"],["星币三","配合与打磨，专业被认可","团队不合，各干各的","🔨"],["星币四","抓太紧了，学会松一点","终于肯放手，或反而破财","🔒"],["星币五","手头有点紧，别独自硬撑","走出困境，有人愿意帮你","🚪"],["星币六","给予与接受要平衡","施与受不对等，欠了人情","🤲"],["星币七","耐心等收获，别急着拔苗","白忙一场，该换方向了","🌱"],["星币八","踏实练功，回报在后面","敷衍应付，或倦怠想撂挑子","🔧"],["星币九","自给自足的从容与体面","依赖别人，或太在意排场","🍇"],["星币十","长久的丰盛与家人支持","家里的事有牵绊，钱要算清","🏰"],["星币侍从","认真学一门本事","眼高手低，学一半就丢","📚"],["星币骑士","慢而稳，说到做到","太保守，机会溜走了","🐢"],["星币王后","把日子照顾得很妥帖","操心过头，累着自己","🧺"],["星币国王","稳稳的富足与掌控","太看重得失，变得固执","💎"]]
    };

    var DECK = [];
    var i, j, k, suitName, suitCards, cardArr;
    for (i = 0; i < MAJOR.length; i++) {
      cardArr = MAJOR[i];
      DECK.push({ name: cardArr[0], group: "大阿卡纳", num: ROMAN[i], icon: cardArr[3], up: cardArr[1], rev: cardArr[2] });
    }
    var suitNames = ["权杖", "圣杯", "宝剑", "星币"];
    for (k = 0; k < suitNames.length; k++) {
      suitName = suitNames[k];
      suitCards = SUIT[suitName];
      for (j = 0; j < suitCards.length; j++) {
        cardArr = suitCards[j];
        DECK.push({ name: cardArr[0], group: suitName, num: "", icon: cardArr[3], up: cardArr[1], rev: cardArr[2] });
      }
    }

    function todayKey() {
      var d = new Date();
      function p(n) { return n < 10 ? "0" + n : "" + n; }
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
    }
    function dateText() {
      var d = new Date();
      var w = ["日","一","二","三","四","五","六"][d.getDay()];
      return (d.getMonth() + 1) + "月" + d.getDate() + "日 · 周" + w;
    }
    function seedRand(seed) {
      var x = Math.sin(seed * 9999 + 1) * 10000;
      return x - Math.floor(x);
    }
    function drawForDay(key) {
      var parts = key.split("-");
      var seed = parseInt(parts[0], 10) * 10000 + parseInt(parts[1], 10) * 100 + parseInt(parts[2], 10);
      var r1 = seedRand(seed);
      var r2 = seedRand(seed + 1);
      var idx = Math.floor(r1 * DECK.length);
      if (idx >= DECK.length) idx = DECK.length - 1;
      if (idx < 0) idx = 0;
      return { reversed: r2 < 0.35, card: DECK[idx] };
    }
    function randDraw() {
      var idx = Math.floor(Math.random() * DECK.length);
      return { reversed: Math.random() < 0.35, card: DECK[idx] };
    }

    ctx.ui.appPage(function (el) {
      var wrap = document.createElement("div");
      wrap.className = "pt-wrap";
      wrap.innerHTML =
        '<div class="pt-stars"></div>' +
        '<div class="pt-head"><h1>每日塔罗</h1><p class="pt-date">静心 · 默念你的问题</p></div>' +
        '<div class="pt-stage"><div class="pt-card">' +
          '<div class="pt-face pt-back"><div class="pt-back-in"><div class="pt-moon">🌙</div><div class="pt-tag">Tarot</div></div></div>' +
          '<div class="pt-face pt-front">' +
            '<div><div class="pt-num"></div><div class="pt-name"></div><div class="pt-pos up">正位</div></div>' +
            '<div class="pt-icon">✦</div>' +
            '<div class="pt-mean"></div>' +
          '</div>' +
        '</div></div>' +
        '<div class="pt-acts"><button type="button" class="pt-btn">抽取今日运势</button><div class="pt-hint">点击卡牌或按钮开始抽牌</div></div>' +
        '<div class="pt-extra" style="display:none"><div class="pt-line"></div><div class="pt-quote"></div></div>';
      el.appendChild(wrap);

      var starBox = wrap.querySelector(".pt-stars");
      for (var s = 0; s < 36; s++) {
        var st = document.createElement("span");
        st.style.left = (Math.random() * 100) + "%";
        st.style.top = (Math.random() * 100) + "%";
        st.style.width = (Math.random() < 0.2 ? 3 : 1.5) + "px";
        st.style.height = st.style.width;
        st.style.animationDelay = (Math.random() * 4) + "s";
        st.style.animationDuration = (2 + Math.random() * 3) + "s";
        starBox.appendChild(st);
      }

      var q = function (sel) { return wrap.querySelector(sel); };
      var dateEl = q(".pt-date");
      var cardEl = q(".pt-card");
      var numEl = q(".pt-num");
      var nameEl = q(".pt-name");
      var posEl = q(".pt-pos");
      var iconEl = q(".pt-icon");
      var meanEl = q(".pt-mean");
      var btnEl = q(".pt-btn");
      var hintEl = q(".pt-hint");
      var extraEl = q(".pt-extra");
      var quoteEl = q(".pt-quote");

      var dayKey = todayKey();
      var drawn = null;
      var revealed = false;

      dateEl.textContent = dateText() + " · 静心默念你的问题";

      function paint(res) {
        var c = res.card;
        numEl.textContent = c.num ? (c.group + " · " + c.num) : c.group;
        nameEl.textContent = c.name;
        iconEl.textContent = c.icon;
        if (res.reversed) {
          posEl.textContent = "逆位";
          posEl.className = "pt-pos rev";
          meanEl.textContent = c.rev;
        } else {
          posEl.textContent = "正位";
          posEl.className = "pt-pos up";
          meanEl.textContent = c.up;
        }
      }

      function reveal(res, animate) {
        revealed = true;
        paint(res);
        cardEl.classList.add("flip");
        var after = animate ? 650 : 0;
        setTimeout(function () {
          btnEl.disabled = false;
          btnEl.textContent = "再抽一次";
          hintEl.textContent = "今日运势已揭晓";
          quoteEl.textContent = "「" + res.card.name + " · " + (res.reversed ? "逆位" : "正位") + "」" + (res.reversed ? res.card.rev : res.card.up);
          extraEl.style.display = "flex";
        }, after);
      }

      cardEl.addEventListener("click", function () {
        if (revealed) return;
        if (!drawn) drawn = drawForDay(dayKey);
        reveal(drawn, true);
      });

      btnEl.addEventListener("click", function () {
        if (!revealed && !drawn) {
          drawn = drawForDay(dayKey);
          reveal(drawn, true);
          return;
        }
        
        btnEl.disabled = true;
        btnEl.textContent = "抽牌中…";
        cardEl.classList.remove("flip");
        extraEl.style.display = "none";
        revealed = false;
        drawn = randDraw();

        setTimeout(function () {
          paint(drawn);
          setTimeout(function () {
            cardEl.classList.add("flip");
            setTimeout(function () {
              revealed = true;
              btnEl.disabled = false;
              btnEl.textContent = "再抽一次";
              hintEl.textContent = "今日运势已揭晓";
              quoteEl.textContent = "「" + drawn.card.name + " · " + (drawn.reversed ? "逆位" : "正位") + "」" + (drawn.reversed ? drawn.card.rev : drawn.card.up);
              extraEl.style.display = "flex";
            }, 650);
          }, 50);
        }, 650);
      });
    });
  }
};