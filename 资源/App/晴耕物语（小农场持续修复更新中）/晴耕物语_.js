export default {
  manifest: {
    id: "puff-farm-tale",
    name: "晴耕物语",
    engine: "puff",
    apiVersion: 1,
    version: "1.7.0",
    author: "Puff",
    description: "和内置角色一起种菜养花、钓鱼赶集，把家园一点一点布置成喜欢的样子。",
    permissions: ["读取角色人设", "本地保存游戏进度"],
    app: { name: "晴耕物语", letter: "耕" },
    settings: [
      { key: "partner", label: "固定伙伴（填角色 ID，留空则每次打开手动选）", type: "text", default: "" },
      { key: "fast", label: "快速成长（作物一天成熟）", type: "boolean", default: false },
      { key: "mapUrl", label: "自定义农场背景图（可选）", type: "text", default: "" },
      { key: "showTalk", label: "角色随行动说话", type: "boolean", default: true },
      { key: "autoAct", label: "角色在你不来时也会干活", type: "boolean", default: true },
    ],
  },
  setup(ctx) {
    var kv = ctx.kit.kv;
    var prefs = ctx.kit.prefs;
    function pref(k, d) { var v = prefs.get(k); return v === undefined || v === null ? d : v; }

    var CROPS = [
      { id: "carrot", name: "胡萝卜", kind: "veg", type: "root", seed: 12, days: 3, sell: 34, leaf: "#7ec86a", fruit: "#f79256", flower: "#fff6da" },
      { id: "tomato", name: "番茄", kind: "veg", type: "bush", seed: 20, days: 4, sell: 58, leaf: "#6fc06b", fruit: "#ef6b6b", flower: "#ffd84a" },
      { id: "corn", name: "玉米", kind: "veg", type: "stalk", seed: 26, days: 4, sell: 74, leaf: "#84c96f", fruit: "#f4d05a", flower: "#e8d58a" },
      { id: "pumpkin", name: "南瓜", kind: "veg", type: "vine", seed: 34, days: 5, sell: 102, leaf: "#5fae5e", fruit: "#f0a03c", flower: "#ffd84a" },
      { id: "strawberry", name: "草莓", kind: "veg", type: "bush", seed: 44, days: 5, sell: 128, leaf: "#6cbd67", fruit: "#f0648a", flower: "#fff8f0" },
      { id: "daisy", name: "雏菊", kind: "flower", type: "flower", seed: 16, days: 3, sell: 48, leaf: "#78c46e", fruit: "#fff4dc", flower: "#fff4dc" },
      { id: "tulip", name: "郁金香", kind: "flower", type: "flower", seed: 24, days: 4, sell: 72, leaf: "#74c26c", fruit: "#f272a8", flower: "#f272a8" },
      { id: "sunflower", name: "向日葵", kind: "flower", type: "flower", seed: 30, days: 4, sell: 90, leaf: "#6cbb63", fruit: "#ffd24a", flower: "#ffd24a" },
      { id: "lavender", name: "薰衣草", kind: "flower", type: "flower", seed: 32, days: 5, sell: 96, leaf: "#8cc98a", fruit: "#b18ce0", flower: "#b18ce0" },
      { id: "rose", name: "玫瑰", kind: "flower", type: "flower", seed: 48, days: 5, sell: 140, leaf: "#63b25f", fruit: "#e5566f", flower: "#e5566f" },
    ];
    var CROP = {}; CROPS.forEach(function (c) { CROP[c.id] = c; });

    var SEASONS = [
      { name: "春", bg: "linear-gradient(180deg,#d6ecff 0%,#eaf8e2 48%,#d3efbd 100%)" },
      { name: "夏", bg: "linear-gradient(180deg,#c6e8ff 0%,#e6f8dd 48%,#c6ecae 100%)" },
      { name: "秋", bg: "linear-gradient(180deg,#ffe7c9 0%,#f8f0d4 48%,#e5e4ab 100%)" },
      { name: "冬", bg: "linear-gradient(180deg,#dfeaf6 0%,#f1f6fb 48%,#e6eef6 100%)" },
    ];
    var WEATHER = { sunny: { name: "晴", icon: "☀️" }, cloud: { name: "多云", icon: "⛅" }, rain: { name: "雨", icon: "🌧️" } };

    var DEX = [
      { id: "dew", name: "晨露", desc: "草叶尖上挂着一颗，亮得像小玻璃珠。" },
      { id: "snail", name: "小蜗牛", desc: "背着壳慢慢爬，一点都不着急。" },
      { id: "kite", name: "断线纸鸢", desc: "不知是谁放的，线断了，还挂在树梢上。" },
      { id: "bluebird", name: "蓝羽鸟", desc: "叫了两声就飞走了，尾巴划过一道蓝。" },
      { id: "mushroom", name: "红伞菇", desc: "长在树根背面，圆滚滚的，别乱吃。" },
      { id: "creek", name: "浅溪", desc: "水很凉，石头被磨得滑溜溜的。" },
      { id: "firefly", name: "萤火", desc: "天黑下来才出现，一闪一闪地飘。" },
      { id: "acorn", name: "橡果", desc: "踩上去咔哒一声，可以攒着玩。" },
      { id: "fern", name: "蕨叶", desc: "卷起来的时候像个问号。" },
      { id: "dandelion", name: "蒲公英", desc: "吹一下，全散了，风比你有耐心。" },
      { id: "hedgehog", name: "刺猬", desc: "听见脚步就缩成一团，装成一颗栗子。" },
      { id: "rainbow", name: "雨后虹", desc: "只出现了一小会儿，但你们都没错过。" },
      { id: "dragonfly", name: "蜻蜓", desc: "停在草尖上，翅膀薄得几乎透明。" },
      { id: "ladybug", name: "瓢虫", desc: "七星瓢虫，是益虫，会帮你吃蚜虫。" },
      { id: "butterfly", name: "蝴蝶", desc: "落在花上停了几秒，你屏住了呼吸。" },
      { id: "bee", name: "蜜蜂", desc: "嗡嗡地忙，别打扰它就好。" },
    ];
    var DEXMAP = {}; DEX.forEach(function (d) { DEXMAP[d.id] = d; });

    var SCENES = [
      { id: "pine", name: "松林小径", icon: "🌲", bg: "linear-gradient(180deg,#d6ecff 0%,#c8e6c0 58%,#a7d49b 100%)", desc: "松针铺了厚厚一层，脚踩上去软软的。", flavor: ["露水从枝头落进领口。", "远处有松鼠抱着松果看了你们一眼。"], dexPool: ["snail", "mushroom", "fern", "acorn", "hedgehog"] },
      { id: "creek", name: "溪畔石滩", icon: "💧", bg: "linear-gradient(180deg,#dff2ff 0%,#cbe8e0 58%,#b7dcc7 100%)", desc: "水很浅，能看见底下圆滚滚的石子。", flavor: ["水流从你们脚边绕过去，凉得厉害。", "有人把脚泡进去，打了个哆嗦。"], dexPool: ["creek", "dew", "rainbow", "dragonfly"] },
      { id: "bloom", name: "野花坡", icon: "🌸", bg: "linear-gradient(180deg,#ffe8f2 0%,#f6f0d6 58%,#d8eec4 100%)", desc: "坡上开满了叫不出名字的花，风一过就晃。", flavor: ["蝴蝶多得像花会飞。", "你们并排坐了一会儿，谁都没提要走。"], dexPool: ["dandelion", "bluebird", "dew", "rainbow", "butterfly", "bee"] },
      { id: "hill", name: "山顶草甸", icon: "⛰️", bg: "linear-gradient(180deg,#d9ecff 0%,#e8f4e0 55%,#c7e7b5 100%)", desc: "风比坡下大，草伏成一片一片的浪。", flavor: ["从这儿能看见你们那块地。", "云影从山脊上慢慢推过去。"], dexPool: ["kite", "rainbow", "bluebird"] },
      { id: "firefly", name: "萤火夜林", icon: "✨", bg: "linear-gradient(180deg,#28304a 0%,#3b4a5a 55%,#4e5e52 100%)", desc: "天刚暗下来，林子里就浮起点点绿光。", flavor: ["你们放轻脚步，怕惊了它们。", "有一只在你们之间停了半秒，又飞走了。"], dexPool: ["firefly", "rainbow"] },
    ];
    var SCENEMAP = {}; SCENES.forEach(function (sc) { SCENEMAP[sc.id] = sc; });

    var ANIMALS = [
      { id: "squirrel", name: "松鼠", icon: "🐿️" },
      { id: "rabbit", name: "兔子", icon: "🐰" },
      { id: "hedgehog", name: "刺猬", icon: "🦔" },
      { id: "deer", name: "小鹿", icon: "🦌" },
      { id: "fox", name: "狐狸", icon: "🦊" },
      { id: "bird", name: "山雀", icon: "🐦" },
    ];
    var ANIMALMAP = {}; ANIMALS.forEach(function (a) { ANIMALMAP[a.id] = a; });

    var ITEMS = {
      fert: { name: "有机肥", icon: "💩", price: 30, desc: "提高土壤肥力，加快生长" },
      spray: { name: "驱虫剂", icon: "🧴", price: 25, desc: "清除作物上的虫害" },
      weed: { name: "除草剂", icon: "🧪", price: 20, desc: "清理田里的杂草" },
    };

    var MATS = {
      wood: { name: "木料", icon: "🪵" }, stone: { name: "石料", icon: "🪨" },
      cloth: { name: "布料", icon: "🧵" }, shell: { name: "贝壳", icon: "🐚" }, gem: { name: "晶石", icon: "💎" },
    };
    var MATKEYS = ["wood", "stone", "cloth", "shell", "gem"];

    var FURN = [
      // ===== 地面 · 座椅 =====
      { id: "stool", name: "圆凳", area: "floor", rar: 1, price: 80, mats: { wood: 2 }, desc: "随手就能搬。" },
      { id: "chair", name: "木椅", area: "floor", rar: 1, price: 110, mats: { wood: 3 }, desc: "配桌子正好。" },
      { id: "bench", name: "长木凳", area: "floor", rar: 2, price: 200, mats: { wood: 6 }, desc: "坐下来歇脚。" },
      { id: "armchair", name: "扶手椅", area: "floor", rar: 2, price: 400, mats: { cloth: 6, wood: 3 }, desc: "一个人的位置。" },
      { id: "sofa", name: "布艺沙发", area: "floor", rar: 2, price: 520, mats: { cloth: 8, wood: 3 }, desc: "一坐就陷进去。" },
      { id: "rocking", name: "摇椅", area: "floor", rar: 2, price: 340, mats: { wood: 5 }, desc: "一晃一晃的。" },
      { id: "beanbag", name: "懒人沙发", area: "floor", rar: 2, price: 380, mats: { cloth: 7 }, desc: "塌成一团。" },
      { id: "pouf", name: "蒲团", area: "floor", rar: 1, price: 120, mats: { cloth: 3 }, desc: "盘腿坐。" },

      // ===== 地面 · 桌几 =====
      { id: "table", name: "木桌", area: "floor", top: true, rar: 1, price: 220, mats: { wood: 6 }, desc: "桌面空着，可以摆点小东西。" },
      { id: "coffee", name: "矮几", area: "floor", top: true, rar: 2, price: 260, mats: { wood: 5 }, desc: "矮矮的，放茶杯正好。" },
      { id: "desk", name: "书桌", area: "floor", top: true, rar: 2, price: 340, mats: { wood: 8, cloth: 2 }, desc: "抽屉里塞着没写完的纸。" },
      { id: "roundtable", name: "圆桌", area: "floor", top: true, rar: 2, price: 320, mats: { wood: 7 }, desc: "桌布上有小花。" },
      { id: "sidetable", name: "边几", area: "floor", top: true, rar: 2, price: 180, mats: { wood: 4 }, desc: "沙发旁边放一个。" },
      { id: "nightstand", name: "床头柜", area: "floor", top: true, rar: 2, price: 200, mats: { wood: 5 }, desc: "抽屉里放着旧票根。" },
      { id: "workbench", name: "工作台", area: "floor", top: true, rar: 3, price: 460, mats: { wood: 10, stone: 3 }, desc: "木头屑还没扫。" },

      // ===== 地面 · 收纳 =====
      { id: "shelf", name: "置物架", area: "floor", rar: 2, price: 300, mats: { wood: 6 }, desc: "格子多，什么都往里塞。" },
      { id: "cabinet", name: "木柜", area: "floor", top: true, rar: 2, price: 380, mats: { wood: 8 }, desc: "柜顶空着，可以放东西。" },
      { id: "bookshelf", name: "书架", area: "floor", rar: 2, price: 420, mats: { wood: 8, cloth: 3 }, desc: "书摆得歪歪的。" },
      { id: "wardrobe", name: "衣橱", area: "floor", rar: 3, price: 620, mats: { wood: 12, cloth: 4 }, desc: "门缝里掉出一只袜子。" },
      { id: "drawers", name: "抽屉柜", area: "floor", top: true, rar: 2, price: 340, mats: { wood: 8 }, desc: "一格一格分得很清楚。" },
      { id: "showcase", name: "展示柜", area: "floor", rar: 3, price: 540, mats: { wood: 8, gem: 3 }, desc: "玻璃擦得很亮。" },
      { id: "shoe", name: "鞋柜", area: "floor", rar: 1, price: 180, mats: { wood: 4 }, desc: "两双鞋叠着放。" },

      // ===== 地面 · 床铺 =====
      { id: "bed", name: "小床", area: "floor", rar: 3, price: 760, mats: { wood: 10, cloth: 8 }, desc: "铺得很整齐。" },
      { id: "bunk", name: "双层床", area: "floor", rar: 4, price: 1400, mats: { wood: 16, cloth: 12 }, desc: "上面那层睡过几次。" },
      { id: "hammock", name: "吊床", area: "floor", rar: 3, price: 480, mats: { cloth: 8, wood: 4 }, desc: "系在两棵树之间。" },

      // ===== 地面 · 装饰 =====
      { id: "rug", name: "编织毯", area: "floor", rar: 1, price: 140, mats: { cloth: 4 }, desc: "踩上去软软的。" },
      { id: "sign", name: "木牌", area: "floor", rar: 1, price: 60, mats: { wood: 2 }, desc: "写上点什么。" },
      { id: "fence", name: "木栅栏", area: "floor", rar: 1, price: 120, mats: { wood: 4 }, desc: "围着田转一圈。" },
      { id: "potted", name: "陶盆绿植", area: "floor", rar: 1, price: 90, mats: { wood: 2, cloth: 1 }, desc: "摆在门口，看着就精神。" },
      { id: "basket", name: "藤编篮", area: "floor", rar: 1, price: 110, mats: { wood: 3 }, desc: "装点果子正好。" },
      { id: "lamp", name: "小路灯", area: "floor", rar: 2, price: 260, mats: { wood: 4, stone: 3 }, desc: "天黑也看得见路。" },
      { id: "floorlamp", name: "落地灯", area: "floor", rar: 2, price: 300, mats: { wood: 3, gem: 1 }, desc: "灯罩歪了一点。" },
      { id: "birdhouse", name: "鸟窝", area: "floor", rar: 2, price: 300, mats: { wood: 5, cloth: 2 }, desc: "给路过的小鸟一个歇脚处。" },
      { id: "pond", name: "小池塘", area: "floor", rar: 2, price: 360, mats: { stone: 6, shell: 3 }, desc: "养两条鱼。" },
      { id: "mirror", name: "立镜", area: "floor", rar: 2, price: 480, mats: { stone: 4, gem: 2 }, desc: "照一照，有点恍惚。" },
      { id: "guitar", name: "木吉他", area: "floor", rar: 3, price: 560, mats: { wood: 8, cloth: 4 }, desc: "弦松了，还能弹。" },
      { id: "screen", name: "屏风", area: "floor", rar: 3, price: 520, mats: { wood: 6, cloth: 5 }, desc: "挡一挡风。" },
      { id: "teddy", name: "布偶熊", area: "floor", rar: 3, price: 620, mats: { cloth: 8, gem: 2 }, desc: "不知道是谁留下的。" },
      { id: "clock", name: "落地钟", area: "floor", rar: 3, price: 680, mats: { wood: 10, stone: 6 }, desc: "走得很稳。" },
      { id: "lantern", name: "灯笼", area: "floor", rar: 3, price: 540, mats: { cloth: 6, wood: 4 }, desc: "挂起来，晚上是暖色的。" },
      { id: "camera", name: "旧相机", area: "floor", rar: 3, price: 700, mats: { stone: 4, gem: 5 }, desc: "快门还能响。" },
      { id: "gramophone", name: "留声机", area: "floor", rar: 3, price: 720, mats: { wood: 6, gem: 3 }, desc: "唱片还转得动。" },
      { id: "telescope", name: "望远镜", area: "floor", rar: 3, price: 640, mats: { stone: 3, gem: 4 }, desc: "镜筒对着天窗。" },
      { id: "flowerstand", name: "花架", area: "floor", rar: 2, price: 280, mats: { wood: 4 }, desc: "三层，藤蔓垂下来。" },
      { id: "sculpture", name: "石雕", area: "floor", rar: 3, price: 600, mats: { stone: 10 }, desc: "不知道雕的是什么。" },
      { id: "well", name: "水井", area: "floor", rar: 3, price: 580, mats: { stone: 8, wood: 4 }, desc: "桶还在绳上晃。" },
      { id: "scarecrow", name: "稻草人", area: "floor", rar: 2, price: 260, mats: { cloth: 4, wood: 3 }, desc: "帽檐压得很低。" },
      { id: "giftbox", name: "礼物盒", area: "floor", rar: 2, price: 180, mats: { cloth: 3 }, desc: "蝴蝶结扎得很紧。" },
      { id: "mushroomlamp", name: "蘑菇灯", area: "floor", rar: 3, price: 420, mats: { wood: 3, gem: 2 }, desc: "晚上会亮一下。" },
      { id: "toyhorse", name: "木马", area: "floor", rar: 2, price: 320, mats: { wood: 6 }, desc: "晃一晃，会有吱呀声。" },
      { id: "globe", name: "地球仪", area: "floor", rar: 3, price: 480, mats: { wood: 3, gem: 2 }, desc: "有一颗星标着你们。" },
      { id: "starlamp", name: "星灯", area: "floor", rar: 4, price: 980, mats: { gem: 8, cloth: 6 }, desc: "亮起来的时候像一小片夜空。" },
      { id: "fireplace", name: "壁炉", area: "floor", rar: 4, price: 1100, mats: { stone: 12, wood: 8 }, desc: "冬天就靠它了。" },
      { id: "piano", name: "旧钢琴", area: "floor", rar: 4, price: 1400, mats: { wood: 14, gem: 6 }, desc: "有几个键不响了。" },
      { id: "fountain", name: "许愿池", area: "floor", rar: 4, price: 1600, mats: { stone: 14, shell: 6 }, desc: "水底有几枚硬币。" },

      // ===== 桌面小物 =====
      { id: "cup", name: "茶杯", area: "surface", rar: 1, price: 40, mats: { cloth: 1 }, desc: "茶还温着。" },
      { id: "coffeecup", name: "咖啡杯", area: "surface", rar: 1, price: 50, mats: { cloth: 1 }, desc: "放了两块方糖。" },
      { id: "teapot", name: "茶壶", area: "surface", rar: 2, price: 120, mats: { wood: 1 }, desc: "壶嘴上挂着一滴。" },
      { id: "bookstack", name: "书堆", area: "surface", rar: 1, price: 60, mats: { cloth: 2 }, desc: "随手摞起来的。" },
      { id: "succulent", name: "多肉", area: "surface", rar: 1, price: 70, mats: { wood: 1 }, desc: "很省心的小植物。" },
      { id: "cactus", name: "小仙人掌", area: "surface", rar: 1, price: 80, mats: { wood: 1 }, desc: "别碰它。" },
      { id: "bowl", name: "果盘", area: "surface", rar: 1, price: 80, mats: { wood: 2 }, desc: "今天洗了果子。" },
      { id: "cake", name: "点心", area: "surface", rar: 2, price: 100, mats: { cloth: 1 }, desc: "草莓的那块。" },
      { id: "vase", name: "花瓶", area: "surface", rar: 2, price: 150, mats: { cloth: 2 }, desc: "插两枝就很好看。" },
      { id: "tealamp", name: "小台灯", area: "surface", rar: 2, price: 200, mats: { wood: 2, gem: 1 }, desc: "光线是暖的。" },
      { id: "fishbowl", name: "鱼缸", area: "surface", rar: 2, price: 220, mats: { wood: 1, shell: 2 }, desc: "两条小鱼。" },
      { id: "clockmini", name: "小闹钟", area: "surface", rar: 2, price: 160, mats: { wood: 2 }, desc: "总慢一分钟。" },
      { id: "jar", name: "玻璃罐", area: "surface", rar: 2, price: 130, mats: { wood: 1 }, desc: "攒着彩色的糖。" },
      { id: "incense", name: "香薰", area: "surface", rar: 3, price: 380, mats: { cloth: 2, gem: 1 }, desc: "点一会儿就飘烟。" },
      { id: "music", name: "八音盒", area: "surface", rar: 3, price: 420, mats: { wood: 4, gem: 2 }, desc: "转起来会响一小段。" },

      // ===== 墙面 =====
      { id: "wallclock", name: "挂钟", area: "wall", rar: 1, price: 180, mats: { wood: 3 }, desc: "秒针走得很轻。" },
      { id: "photo", name: "相框", area: "wall", rar: 1, price: 120, mats: { wood: 2 }, desc: "里面还没放照片。" },
      { id: "curtain", name: "窗帘", area: "wall", rar: 1, price: 200, mats: { cloth: 4 }, desc: "拉开就是白天。" },
      { id: "calendar", name: "日历", area: "wall", rar: 1, price: 90, mats: { cloth: 1 }, desc: "停在上个月。" },
      { id: "painting", name: "挂画", area: "wall", rar: 2, price: 320, mats: { wood: 3, cloth: 2 }, desc: "画的是山和太阳。" },
      { id: "walllamp", name: "壁灯", area: "wall", rar: 2, price: 280, mats: { stone: 2, gem: 1 }, desc: "晚上留一盏。" },
      { id: "wreath", name: "花环", area: "wall", rar: 2, price: 260, mats: { cloth: 3 }, desc: "用干花编的。" },
      { id: "mirrorwall", name: "壁镜", area: "wall", rar: 2, price: 340, mats: { wood: 3, gem: 2 }, desc: "照得有点变形。" },
      { id: "noteboard", name: "留言板", area: "wall", rar: 2, price: 220, mats: { wood: 2, cloth: 1 }, desc: "钉着几张纸条。" },
      { id: "dryflower", name: "干花", area: "wall", rar: 2, price: 240, mats: { cloth: 2 }, desc: "倒挂着晾的。" },
      { id: "photowall", name: "照片墙", area: "wall", rar: 3, price: 480, mats: { wood: 3, cloth: 2 }, desc: "九宫格，还差几张。" },
      { id: "windchime", name: "风铃", area: "wall", rar: 3, price: 360, mats: { shell: 4, cloth: 1 }, desc: "有风就响一声。" },
      { id: "balloon", name: "气球", area: "wall", rar: 2, price: 150, mats: { cloth: 1 }, desc: "不知道什么时候飘进来的。" },
      { id: "tapestry", name: "挂毯", area: "wall", rar: 3, price: 520, mats: { cloth: 6 }, desc: "织了很久。" },
    ];
    var FURNMAP = {}; FURN.forEach(function (f) { FURNMAP[f.id] = f; });

    var PAPERS = [
      { id: "cream", name: "米白", css: "linear-gradient(180deg,#fdf7ea,#f3e7d2)" },
      { id: "sage", name: "鼠尾草", css: "linear-gradient(180deg,#ecf3e4,#d8e6ce)" },
      { id: "sky", name: "晴空", css: "linear-gradient(180deg,#e4f1fb,#cde3f4)" },
      { id: "rose", name: "藕粉", css: "linear-gradient(180deg,#fcebf0,#f2d8e0)" },
      { id: "latte", name: "奶咖", css: "linear-gradient(180deg,#f5e8d8,#e6d3ba)" },
      { id: "stripe", name: "细条", css: "repeating-linear-gradient(90deg,rgba(190,170,140,.18) 0 2px,transparent 2px 14px),linear-gradient(180deg,#faf3e6,#f0e4d0)" },
      { id: "dot", name: "小点", css: "radial-gradient(circle at 5px 5px,rgba(180,160,130,.25) 1.4px,transparent 1.9px) 0 0/16px 16px,linear-gradient(180deg,#fbf5ea,#f2e8d8)" },
      { id: "plaid", name: "格纹", css: "repeating-linear-gradient(0deg,rgba(170,180,160,.16) 0 2px,transparent 2px 16px),repeating-linear-gradient(90deg,rgba(170,180,160,.16) 0 2px,transparent 2px 16px),linear-gradient(180deg,#f7f2e6,#eee6d6)" },
    ];
    var PAPERMAP = {}; PAPERS.forEach(function (p) { PAPERMAP[p.id] = p; });

    var FLOOR_COLS = 5, FLOOR_ROWS = 3;
    var WALL_COLS = 5, WALL_ROWS = 2;
    var HOME_SLOTS = FLOOR_COLS * FLOOR_ROWS;
    var WALL_SLOTS = WALL_COLS * WALL_ROWS;

    var FISH = [
      { id: "minnow", name: "小杂鱼", rar: 1, price: 14, body: "#b8d8e6", acc: "#8fbdd2", desc: "一网能捞好几条，刺多。" },
      { id: "crucian", name: "鲫鱼", rar: 1, price: 22, body: "#d8c8a0", acc: "#bba77c", desc: "汤煮得白白的，很鲜。" },
      { id: "boot", name: "旧胶靴", rar: 1, price: 3, body: "#8a8a8a", acc: "#6b6b6b", desc: "……谁把靴子扔水里的。" },
      { id: "grasscarp", name: "草鱼", rar: 2, price: 50, body: "#9ab88a", acc: "#78975f", desc: "吃草长大的，肉厚。" },
      { id: "carp", name: "鲤鱼", rar: 2, price: 45, body: "#e8b070", acc: "#c98d4b", desc: "力气大，差点把竿拽走。" },
      { id: "bass", name: "鲈鱼", rar: 2, price: 55, body: "#a8b888", acc: "#849666", desc: "在石头缝里蹲着，冷不丁咬钩。" },
      { id: "trout", name: "鳟鱼", rar: 3, price: 90, body: "#f0a8a8", acc: "#d47878", desc: "身上有细碎的斑点，很漂亮。" },
      { id: "catfish", name: "鲶鱼", rar: 3, price: 100, body: "#8a8a78", acc: "#66665a", desc: "滑溜溜的，得用两只手抱。" },
      { id: "koi", name: "锦鲤", rar: 3, price: 160, body: "#f4a07a", acc: "#e05838", desc: "红的白的，游起来像一匹缎子。" },
      { id: "goldfish", name: "金鱼", rar: 3, price: 130, body: "#ffc86a", acc: "#e89428", desc: "尾巴散开像朵花。" },
      { id: "eel", name: "鳗鱼", rar: 3, price: 145, body: "#7a7a68", acc: "#54544a", desc: "缠在竿上，解了半天。" },
      { id: "puffer", name: "河豚", rar: 3, price: 120, body: "#e0c878", acc: "#bfa64e", desc: "一碰就鼓起来，气呼呼的。" },
      { id: "lantern", name: "灯笼鱼", rar: 4, price: 260, body: "#6a8aa8", acc: "#3f6a8a", desc: "头顶一盏小灯，夜里能看见。" },
      { id: "moonfish", name: "月光鱼", rar: 4, price: 320, body: "#e4eefc", acc: "#a8c2e4", desc: "鳞片泛着月色，只在夜里咬钩。" },
      { id: "chest", name: "沉船木箱", rar: 4, price: 200, body: "#a8864a", acc: "#7a5c2e", desc: "锈得厉害，里面居然还有东西。" },
    ];
    var FISHMAP = {}; FISH.forEach(function (f) { FISHMAP[f.id] = f; });

    var LINES = {
      plant: ["{n}蹲在田边，认真看着你把{c}种子按进土里。", "“埋浅一点，不然它钻不出来。”{n}在旁边小声提醒。", "{n}把袖子挽起来：“我来挖坑，你来放种子。”"],
      water: ["“水别浇太多，根会烂的。”{n}伸手挡了一下你的水壶。", "{n}提着小桶跟在后面，一路把水洒在了自己鞋上。", "水珠滚过叶面，{n}看得眼睛都不眨。"],
      fert: ["“闻着像雨后的土。”{n}蹲下来，把肥料轻轻翻进土里。", "{n}递过来一小袋肥：“够用两次了。”"],
      spray: ["{n}把袖子拉下来挡住口鼻：“快喷快走。”", "“喷完别摸眼睛。”{n}在旁边叮嘱。"],
      weed: ["{n}一根一根拔着草：“这些长得比菜还快。”", "草根带出一小团土，{n}把它抖回田里。"],
      harvest: ["{c}从土里滚出来的一瞬间，{n}“哇”了一声。", "{n}把最大的那颗{c}擦了擦，塞进你手里。", "“我们种出来了。”{n}说这话的时候，语气比平时软很多。"],
      sleep: ["{n}把工具一件一件收好，回头看你：“明天早点来。”", "灯灭了。{n}在门口站了一会儿才走。", "“晚安，田里的事明天再说。”"],
      explore: ["{n}走在你前面，时不时回头看你有没有跟上。", "“这条路我小时候走过。”{n}说。", "{n}摘了片叶子叼在嘴里，一路没怎么说话。"],
      talk: ["“你种的东西，长得比我想的快。”{n}说。", "{n}递过来一杯凉水。", "“累了就歇会儿，地又不会跑。”", "{n}拨了拨你额前的头发：“脸上有泥。”", "“等这片地开满花，我们拍张照吧。”"],
      idle: ["{n}坐在田埂上晃着腿。", "“今天风挺好的。”", "{n}看着远处的云发呆。"],
      autoPlant: ["{n}不知什么时候自己动了手，田里多了几株苗。"],
      autoHarvest: ["{n}把熟了的都收了，整整齐齐码在门口。"],
      autoExplore: ["{n}自己出门转了一圈，回来的时候鞋上都是泥。"],
      animalGive: ["门口多了点东西，像是谁偷偷放下的。"],
      animalSteal: ["“咦，少了一份。”{n}皱了皱眉，又笑了，“算啦。”"],
      wither: ["“这块忘了浇水……”{n}蹲下来看了看枯掉的苗。"],
      pest: ["{n}捏起一片叶子：“有虫子。”", "“得喷药了。”{n}说。"],
      good: ["{n}把今天最好的一颗挑出来放在窗台上。", "“这颗留着。”"],
      fishCast: ["{n}把线甩出去，水面“咚”地响了一声。", "“别说话，鱼会听见。”{n}压低声音。"],
      fishWin: ["{n}蹲下来看桶里：“这条真好看。”", "“今晚加菜。”{n}说，眼睛亮亮的。"],
      fishLose: ["{n}笑了一声：“手慢了。”", "“再来一次，这次稳一点。”"],
      decorPut: ["{n}把家具搬进屋，摆好之后退后两步看了看。", "“放这儿吧，光线好。”{n}说。", "{n}伸手把摆歪的那件扶正了一点。", "“再挪一点点就好。”{n}眯着眼比划。"],
      market: ["{n}在摊子前蹲下来翻东西，翻得很认真。"],
      craft: ["{n}找了张纸把图纸铺平：“这个能做。”", "“还差一点木料。”{n}数了数。"],
    };

    var PLOTS = 20;
    function blankPlot() { return { crop: null, grown: 0, water: 55, fert: 15, pest: 0, weed: false, dry: 0, withered: false }; }
    function blank() {
      return {
        day: 1, coins: 200, energy: 100, maxEnergy: 100, weather: "sunny",
        plots: Array.from({ length: PLOTS }, blankPlot),
        seeds: { carrot: 4, daisy: 3 },
        items: { fert: 3, spray: 3, weed: 2 },
        barn: {}, bond: 0, dex: {}, decor: {}, animals: {},
        home: new Array(HOME_SLOTS).fill(null),
        wall: new Array(WALL_SLOTS).fill(null),
        wallpaper: "cream",
        fish: {}, mats: { wood: 8, stone: 4, cloth: 3, shell: 0, gem: 0 },
        blueprints: {
          potted: true, sign: true, fence: true, rug: true,
          chair: true, stool: true, table: true, coffee: true,
          basket: true, pouf: true,
          cup: true, bookstack: true, succulent: true, bowl: true,
          wallclock: true, photo: true, curtain: true, calendar: true,
        },
        market: null, log: [], born: Date.now(), lastVisit: Date.now(),
      };
    }
    function keyOf(id) { return "farm:" + id; }
    function loadSave(id) {
      var s = kv.get(keyOf(id));
      if (!s || typeof s !== "object" || !Array.isArray(s.plots)) s = blank();
      while (s.plots.length < PLOTS) s.plots.push(blankPlot());
      s.plots.forEach(function (p) {
        if (typeof p.water !== "number") p.water = 55;
        if (typeof p.fert !== "number") p.fert = 15;
        if (typeof p.pest !== "number") p.pest = 0;
        if (typeof p.weed !== "boolean") p.weed = false;
        if (typeof p.dry !== "number") p.dry = 0;
        if (typeof p.withered !== "boolean") p.withered = false;
      });
      if (!s.seeds) s.seeds = {};
      if (!s.items) s.items = { fert: 3, spray: 3, weed: 2 };
      ["fert", "spray", "weed"].forEach(function (k) { if (typeof s.items[k] !== "number") s.items[k] = 0; });
      if (!s.barn) s.barn = {};
      if (!s.dex) s.dex = {};
      if (!s.decor) s.decor = {};
      Object.keys(s.decor).forEach(function (k) {
        if (s.decor[k] === true) s.decor[k] = 1;
        if (typeof s.decor[k] !== "number") s.decor[k] = 0;
        if (!FURNMAP[k]) delete s.decor[k];
      });
      if (!s.animals) s.animals = {};

      // home 迁移：旧的字符串数组 -> {b,t} 对象数组，清理孤立小物
      if (!Array.isArray(s.home)) s.home = [];
      s.home = s.home.slice(0, HOME_SLOTS).map(function (x) {
        if (x && typeof x === "object") {
          var b = (typeof x.b === "string" && FURNMAP[x.b] && FURNMAP[x.b].area === "floor") ? x.b : null;
          var t = (typeof x.t === "string" && FURNMAP[x.t] && FURNMAP[x.t].area === "surface") ? x.t : null;
          if (!b) { t = null; return null; }
          if (!FURNMAP[b].top) t = null;
          return { b: b, t: t };
        }
        if (typeof x === "string" && FURNMAP[x] && FURNMAP[x].area === "floor") {
          return { b: x, t: null };
        }
        return null;
      });
      while (s.home.length < HOME_SLOTS) s.home.push(null);

      if (!Array.isArray(s.wall)) s.wall = [];
      s.wall = s.wall.slice(0, WALL_SLOTS).map(function (x) {
        return (typeof x === "string" && FURNMAP[x] && FURNMAP[x].area === "wall") ? x : null;
      });
      while (s.wall.length < WALL_SLOTS) s.wall.push(null);

      if (typeof s.wallpaper !== "string" || !PAPERMAP[s.wallpaper]) s.wallpaper = "cream";

      if (!s.fish || typeof s.fish !== "object") s.fish = {};
      Object.keys(s.fish).forEach(function (k) { if (!FISHMAP[k] || typeof s.fish[k] !== "number") delete s.fish[k]; });
      if (!s.mats || typeof s.mats !== "object") s.mats = { wood: 0, stone: 0, cloth: 0, shell: 0, gem: 0 };
      MATKEYS.forEach(function (k) { if (typeof s.mats[k] !== "number") s.mats[k] = 0; });
      if (!s.blueprints || typeof s.blueprints !== "object") s.blueprints = {};
      Object.keys(s.blueprints).forEach(function (k) { if (!FURNMAP[k]) delete s.blueprints[k]; });
      if (!Array.isArray(s.log)) s.log = [];
      if (typeof s.bond !== "number") s.bond = 0;
      if (typeof s.coins !== "number") s.coins = 150;
      if (typeof s.energy !== "number") s.energy = 100;
      if (typeof s.maxEnergy !== "number") s.maxEnergy = 100;
      if (typeof s.day !== "number") s.day = 1;
      if (!s.weather) s.weather = "sunny";
      if (!s.lastVisit) s.lastVisit = Date.now();
      return s;
    }
    function saveSave(id, s) { kv.set(keyOf(id), s); }
    function seasonOf(s) { return Math.floor((s.day - 1) / 7) % 4; }
    function daysOf(c) { return pref("fast", false) ? 1 : c.days; }
    function matured(s, p) { return !!p.crop && !p.withered && p.grown >= daysOf(CROP[p.crop]); }
    function stageOf(s, p) {
      if (!p.crop) return -1;
      if (p.withered) return 4;
      var d = daysOf(CROP[p.crop]);
      if (p.grown >= d) return 3;
      if (p.grown >= Math.max(2, Math.ceil(d * 0.6))) return 2;
      if (p.grown >= 1) return 1;
      return 0;
    }
    function assess(s, p) {
      var c = CROP[p.crop]; var d = daysOf(c); var progress = p.grown / d;
      var tags = []; var score = 0;
      if (p.water >= 70) { tags.push("水润"); score += 0.25; }
      else if (p.water >= 30) { tags.push("水分正常"); score += 0.15; }
      else if (p.water > 0) { tags.push("有点干"); }
      else { tags.push("干裂"); score -= 0.15; }
      if (p.fert >= 70) { tags.push("肥力充足"); score += 0.25; }
      else if (p.fert >= 30) { tags.push("肥力尚可"); score += 0.10; }
      else { tags.push("缺肥"); }
      if (p.pest >= 70) { tags.push("虫害严重"); score -= 0.35; }
      else if (p.pest >= 35) { tags.push("有虫"); score -= 0.15; }
      else { tags.push("无虫"); score += 0.05; }
      if (p.weed) { tags.push("有杂草"); score -= 0.15; }
      if (progress >= 0.5) score += 0.05;
      var level;
      if (p.withered) level = "枯死";
      else if (matured(s, p)) level = score >= 0.6 ? "饱满" : score >= 0.3 ? "成熟" : "勉强成熟";
      else if (score >= 0.6) level = "状态极佳";
      else if (score >= 0.3) level = "状态尚可";
      else if (score >= 0) level = "需要照料";
      else level = "状况堪忧";
      return { score: score, tags: tags, level: level };
    }
    function addLog(s, t) { s.log.unshift("D" + s.day + " · " + t); if (s.log.length > 80) s.log.length = 80; }
    function pickSeed(s) { var o = Object.keys(s.seeds).filter(function (k) { return s.seeds[k] > 0 && CROP[k]; }); if (!o.length) return null; return o[Math.floor(Math.random() * o.length)]; }
    function charPlant(s, seedId) {
      if (!seedId || !s.seeds[seedId] || s.seeds[seedId] <= 0) return null;
      var slot = s.plots.filter(function (p) { return !p.crop; })[0];
      if (!slot) return null;
      s.seeds[seedId] -= 1;
      slot.crop = seedId; slot.grown = 0; slot.water = 55; slot.fert = 15;
      slot.pest = 0; slot.weed = false; slot.dry = 0; slot.withered = false;
      return CROP[seedId];
    }
    function harvestPlot(s, i) {
      var p = s.plots[i];
      if (!matured(s, p)) return null;
      var c = CROP[p.crop]; var a = assess(s, p);
      var count = 1;
      if (a.score >= 0.5) count += 1;
      if (a.score >= 0.85) count += 1;
      if (a.score < 0.1) count = Math.max(1, count - 1);
      s.barn[c.id] = (s.barn[c.id] || 0) + count;
      p.crop = null; p.grown = 0; p.water = 55; p.fert = 15; p.pest = 0; p.weed = false; p.dry = 0;
      s.bond += 1;
      return { crop: c, count: count, level: a.level, score: a.score };
    }
    function charHarvestOne(s) {
      var ripe = [];
      for (var i = 0; i < s.plots.length; i++) if (matured(s, s.plots[i])) ripe.push(i);
      if (!ripe.length) return null;
      var r = harvestPlot(s, ripe[0]);
      return r ? r.crop : null;
    }
    function giveMat(s, key, n) { s.mats[key] = (s.mats[key] || 0) + n; }
    function randomMat() { return MATKEYS[Math.floor(Math.random() * MATKEYS.length)]; }
    function tryUnlockBlueprint(s, silent) {
      var locked = FURN.filter(function (f) { return !s.blueprints[f.id]; });
      if (!locked.length) return null;
      var lf = locked[Math.floor(Math.random() * locked.length)];
      s.blueprints[lf.id] = true;
      return lf;
    }
    function exploreReward(s, sceneId, silent) {
      var sc = SCENEMAP[sceneId] || SCENES[0];
      var r = Math.random();
      if (r < 0.06 && !silent) { s.bond += 3; return "和TA走了一段路，谁都没说话，但心里挺暖"; }
      if (r < 0.28) { var mk = randomMat(); var n = 1 + Math.floor(Math.random() * 3); giveMat(s, mk, n); return "捡到 " + n + " 份" + MATS[mk].name; }
      if (r < 0.48) { var c = CROPS[Math.floor(Math.random() * CROPS.length)]; var cn = 1 + Math.floor(Math.random() * 2); s.seeds[c.id] = (s.seeds[c.id] || 0) + cn; return "捡到 " + cn + " 颗" + c.name + "种子"; }
      if (r < 0.66) { var m = 18 + Math.floor(Math.random() * 50); s.coins += m; return "摸到 " + m + " 枚金币"; }
      if (r < 0.72) { var bp = tryUnlockBlueprint(s, silent); if (bp) return "在石头底下压着一张图纸：「" + bp.name + "」"; }
      var pool = (sc.dexPool || []).filter(function (id) { return DEXMAP[id]; });
      var did = pool.length ? pool[Math.floor(Math.random() * pool.length)] : DEX[0].id;
      var d = DEXMAP[did]; s.dex[d.id] = (s.dex[d.id] || 0) + 1; s.coins += 10;
      return "遇见了「" + d.name + "」—— " + d.desc;
    }
    function animalVisit(s) {
      var a = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
      var friend = s.animals[a.id] || 0;
      var stealChance = Math.max(0.12, 0.38 - friend * 0.06);
      if (Math.random() < stealChance) {
        var keys = Object.keys(s.barn).filter(function (k) { return s.barn[k] > 0 && CROP[k]; });
        if (keys.length) {
          var k = keys[Math.floor(Math.random() * keys.length)];
          s.barn[k] -= 1; if (s.barn[k] <= 0) delete s.barn[k];
          s.animals[a.id] = Math.max(0, friend - 1);
          return { kind: "steal", text: a.icon + " " + a.name + "悄悄摸走了一份" + CROP[k].name };
        }
      }
      s.animals[a.id] = friend + 1;
      var r = Math.random();
      if (r < 0.30) { var c = CROPS[Math.floor(Math.random() * CROPS.length)]; var n = 1 + Math.floor(Math.random() * 2); s.seeds[c.id] = (s.seeds[c.id] || 0) + n; return { kind: "give", text: a.icon + " " + a.name + "叼来了 " + n + " 颗" + c.name + "种子" }; }
      if (r < 0.50) { var m = 15 + Math.floor(Math.random() * 40); s.coins += m; return { kind: "give", text: a.icon + " " + a.name + "在门口留下 " + m + " 枚金币" }; }
      if (r < 0.62) { var mk = randomMat(); var mn = 1 + Math.floor(Math.random() * 3); giveMat(s, mk, mn); return { kind: "give", text: a.icon + " " + a.name + "叼来 " + mn + " 份" + MATS[mk].name }; }
      if (r < 0.90) { var ik = Math.random() < 0.4 ? "fert" : Math.random() < 0.6 ? "spray" : "weed"; s.items[ik] = (s.items[ik] || 0) + 1; return { kind: "give", text: a.icon + " " + a.name + "带来了一份" + ITEMS[ik].name }; }
      var d = DEX[Math.floor(Math.random() * DEX.length)]; s.dex[d.id] = (s.dex[d.id] || 0) + 1;
      return { kind: "give", text: a.icon + " " + a.name + "引你们看到了「" + d.name + "」" };
    }
    function autoAct(s, ch) {
      var r = Math.random(); var name = ch ? ch.name : "TA";
      var trouble = s.plots.filter(function (p) { return p.crop && !p.withered && (p.pest >= 50 || p.water <= 10 || p.weed); });
      if (trouble.length && Math.random() < 0.5) {
        var tp = trouble[0];
        if (tp.pest >= 50 && s.items.spray > 0) { s.items.spray -= 1; tp.pest = 0; return { text: name + "帮你喷了药", talk: "spray" }; }
        if (tp.water <= 10) { tp.water = 70; return { text: name + "顺手浇了水", talk: "water" }; }
        if (tp.weed && s.items.weed > 0) { s.items.weed -= 1; tp.weed = false; return { text: name + "清了田里的草", talk: "weed" }; }
      }
      if (r < 0.26) {
        var seed = pickSeed(s);
        if (seed) { var c = charPlant(s, seed); if (c) { s.bond += 1; return { text: name + "自己种下了一株" + c.name, talk: "autoPlant" }; } }
      } else if (r < 0.44) {
        var hc = charHarvestOne(s); if (hc) return { text: name + "自己收了 1 份" + hc.name, talk: "autoHarvest" };
      } else if (r < 0.70) {
        var sc = SCENES[Math.floor(Math.random() * SCENES.length)]; var txt = exploreReward(s, sc.id, true); s.bond += 1;
        return { text: name + "去" + sc.name + "转了一圈：" + txt, talk: "autoExplore" };
      } else if (r < 0.86) {
        var ev = animalVisit(s); return { text: ev.text, talk: ev.kind === "steal" ? "animalSteal" : "animalGive" };
      } else {
        var mk = randomMat(); giveMat(s, mk, 1);
        return { text: name + "不知从哪儿带回来一份" + MATS[mk].name, talk: "autoExplore" };
      }
      return null;
    }

    function homeCount(s, id) {
      var n = 0;
      s.home.forEach(function (sl) {
        if (!sl) return;
        if (sl.b === id) n++;
        if (sl.t === id) n++;
      });
      if (Array.isArray(s.wall)) s.wall.forEach(function (x) { if (x === id) n++; });
      return n;
    }
    function freeCount(s, id) { return (s.decor[id] || 0) - homeCount(s, id); }

    function genMarket(s) {
      var items = []; var n = 3 + Math.floor(Math.random() * 3);
      for (var i = 0; i < n; i++) {
        var r = Math.random();
        if (r < 0.34) { var mk = randomMat(); var amt = 1 + Math.floor(Math.random() * 4); items.push({ kind: "mat", id: mk, n: amt, price: Math.round((12 + Math.random() * 20) * amt), sold: false }); }
        else if (r < 0.60) { var pool = FURN.filter(function (f) { return f.rar >= 3; }); var f = pool[Math.floor(Math.random() * pool.length)]; items.push({ kind: "furn", id: f.id, price: Math.round(f.price * (0.65 + Math.random() * 0.5)), sold: false }); }
        else if (r < 0.82) {
          var locked = FURN.filter(function (ff) { return !s.blueprints[ff.id]; });
          if (locked.length) { var lf = locked[Math.floor(Math.random() * locked.length)]; items.push({ kind: "blueprint", id: lf.id, price: Math.round(lf.price * 0.42), sold: false }); }
          else { var mk2 = randomMat(); items.push({ kind: "mat", id: mk2, n: 3, price: 60, sold: false }); }
        } else { var c = CROPS[Math.floor(Math.random() * CROPS.length)]; items.push({ kind: "seed", id: c.id, n: 2, price: Math.round(c.seed * 1.6), sold: false }); }
      }
      s.market = { day: s.day, items: items };
      return items;
    }
    function marketStock(s) { if (!s.market || s.market.day !== s.day) return genMarket(s); return s.market.items; }

    ctx.ui.css([
      ".ft-btn{border:0;border-radius:14px;padding:8px 4px;font:inherit;font-size:10.5px;font-weight:600;color:#3f4a3d;background:rgba(255,255,255,.86);box-shadow:0 2px 8px rgba(90,110,70,.16);cursor:pointer;transition:transform .12s ease;display:flex;flex-direction:column;align-items:center;gap:2px;line-height:1.15;}",
      ".ft-btn:active{transform:scale(.93);}",
      ".ft-btn.on{background:linear-gradient(160deg,#9ad97f,#78c163);color:#fff;box-shadow:0 4px 12px rgba(110,180,90,.38);}",
      ".ft-btn .ic{font-size:15px;line-height:1;}",
      ".ft-plot{position:relative;aspect-ratio:1/1;border-radius:16px;display:flex;align-items:flex-end;justify-content:center;padding:2px;cursor:pointer;overflow:hidden;transition:transform .12s ease,box-shadow .16s ease;background:radial-gradient(circle at 30% 22%,rgba(255,255,255,.20),transparent 58%),linear-gradient(170deg,#cfa276 0%,#bd8e60 48%,#a97b4f 100%);box-shadow:inset 0 -4px 0 rgba(120,80,45,.18),inset 0 2px 0 rgba(255,255,255,.22),0 3px 8px rgba(80,55,30,.18);}",
      ".ft-plot::before{content:'';position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle at 20% 36%,rgba(115,75,40,.30) 0 1.5px,transparent 2px),radial-gradient(circle at 62% 58%,rgba(115,75,40,.24) 0 1.3px,transparent 1.8px),radial-gradient(circle at 78% 26%,rgba(115,75,40,.22) 0 1.2px,transparent 1.6px);}",
      ".ft-plot.empty{background:radial-gradient(circle at 30% 22%,rgba(255,255,255,.22),transparent 58%),linear-gradient(170deg,#d8b28c 0%,#c9a075 48%,#b98d61 100%);}",
      ".ft-plot:active{transform:scale(.94);}",
      ".ft-plot.ripe{box-shadow:inset 0 -4px 0 rgba(120,80,45,.18),0 0 0 2px #ffe082,0 5px 16px rgba(255,205,80,.6);animation:ftpulse 1.9s ease-in-out infinite;}",
      ".ft-plot.withered{background:radial-gradient(circle at 30% 22%,rgba(255,255,255,.14),transparent 58%),linear-gradient(170deg,#a09080 0%,#8d7e6d 48%,#786a5b 100%);}",
      ".ft-tag{position:absolute;top:3px;right:3px;font-size:11px;pointer-events:none;z-index:2;}",
      ".ft-empty-mark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:19px;color:rgba(255,255,255,.38);font-weight:300;pointer-events:none;}",
      "@keyframes ftpulse{0%,100%{transform:translateY(0);}50%{transform:translateY(-3px);}}",
      ".ft-roll{animation:ftroll .45s ease;}",
      "@keyframes ftroll{0%{transform:translateY(10px);opacity:0;}100%{transform:translateY(0);opacity:1;}}",
      ".ft-scroll::-webkit-scrollbar{width:0;height:0;}",
      ".ft-scene{position:relative;overflow:hidden;}",
      ".ft-float{position:absolute;opacity:.85;animation:ftfloat 5.6s ease-in-out infinite;pointer-events:none;}",
      "@keyframes ftfloat{0%,100%{transform:translateY(0) rotate(0deg);}50%{transform:translateY(-12px) rotate(6deg);}}",
      ".ft-animal{display:inline-block;font-size:18px;margin-right:3px;}",
      ".ft-bar{position:relative;height:8px;border-radius:999px;background:rgba(200,200,190,.4);overflow:hidden;flex:1;}",
      ".ft-bar > i{display:block;height:100%;border-radius:999px;}",
      ".ft-tab{padding:7px 14px;border-radius:999px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .14s ease;}",
      ".ft-tab.on{background:linear-gradient(160deg,#9ad97f,#78c163);color:#fff;box-shadow:0 3px 10px rgba(110,180,90,.32);}",
      ".ft-tab.off{background:rgba(255,255,255,.72);color:#71806a;}",
      ".ft-water{position:absolute;inset:0;background:linear-gradient(180deg,rgba(180,230,255,.45),rgba(90,170,210,.35));}",
      ".ft-wave{position:absolute;left:-50%;width:200%;height:14px;border-radius:50%;background:rgba(255,255,255,.35);animation:ftwave 6s linear infinite;}",
      "@keyframes ftwave{0%{transform:translateX(0);}100%{transform:translateX(50%);}}",

      ".ft-room{position:relative;border-radius:20px;overflow:hidden;box-shadow:0 12px 30px rgba(110,85,55,.26),inset 0 0 0 1px rgba(255,255,255,.35);}",
      ".ft-wall-layer{position:absolute;inset:0;pointer-events:none;z-index:5;background:linear-gradient(180deg,rgba(70,50,30,.16) 0%,transparent 22%,transparent 74%,rgba(70,50,30,.10) 100%);}",
      ".ft-wall-base{height:10px;margin:9px -9px 0;background:linear-gradient(180deg,#e3d0ae 0%,#c8a97c 55%,#a8895c 100%);box-shadow:0 1px 0 rgba(255,255,255,.55) inset,0 -2px 6px rgba(120,90,60,.28),0 3px 6px rgba(60,40,20,.20);}",
      ".ft-floor-layer{position:absolute;inset:0;pointer-events:none;z-index:6;background:linear-gradient(180deg,rgba(50,32,16,.24) 0%,rgba(60,40,20,.08) 18%,transparent 42%,transparent 74%,rgba(255,246,220,.16) 100%);}",
      ".ft-cell{position:relative;border-radius:12px;transition:transform .12s ease;}",
      ".ft-cell::after{content:'';position:absolute;inset:0;border-radius:12px;border:1.5px dashed rgba(160,140,110,.34);pointer-events:none;opacity:0;transition:opacity .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease;}",
      ".ft-cell.empty::after{opacity:1;}",
      ".ft-cell.ft-can::after{opacity:1;border-style:solid;border-color:rgba(120,190,100,.62);background:rgba(154,217,127,.16);}",
      ".ft-cell.ft-on::after{opacity:1;border-style:solid;border-width:2px;border-color:#5fbf6a;background:rgba(154,217,127,.42);box-shadow:0 0 0 3px rgba(154,217,127,.22);}",
      ".ft-cell.ft-bad::after{opacity:1;border-style:solid;border-color:#e09090;background:rgba(240,150,150,.24);}",
      ".ft-wallcell{aspect-ratio:1/1.02;display:flex;align-items:center;justify-content:center;cursor:pointer;}",
      ".ft-floorcell{aspect-ratio:1/1;display:flex;align-items:flex-end;justify-content:center;cursor:pointer;position:relative;}",
      ".ft-wallcell.full{background:rgba(255,255,255,.42);box-shadow:0 2px 6px rgba(120,100,70,.14);}",
      ".ft-floorcell.full{background:rgba(255,255,255,.32);box-shadow:0 2px 6px rgba(120,100,70,.12);}",
      ".ft-tray{width:62px;flex:0 0 62px;padding:6px 4px 5px;border-radius:14px;background:#fff;box-shadow:0 3px 10px rgba(120,100,70,.14);text-align:center;cursor:grab;touch-action:pan-x;user-select:none;-webkit-user-select:none;}",
      ".ft-tray:active{cursor:grabbing;}",
      ".ft-tray.sel{outline:2px solid #78c163;outline-offset:1px;}",
      ".ft-topitem{position:absolute;left:22%;top:0;width:56%;height:48%;display:flex;align-items:flex-end;justify-content:center;cursor:grab;touch-action:none;z-index:3;}",
      ".ft-topitem:active{cursor:grabbing;}",
    ].join(""));

    function svgWrap(inner, align) {
      return '<svg viewBox="0 0 60 60" width="100%" height="100%" preserveAspectRatio="' + (align || "xMidYMax meet") + '" style="display:block;overflow:visible;filter:drop-shadow(2px 3px 2.4px rgba(40,25,10,.24))">' + inner + "</svg>";
    }
    function petals(cx, cy, n, r, color, rx, ry) {
      var out = [];
      for (var i = 0; i < n; i++) {
        var a = (i * 360) / n; var rad = (a * Math.PI) / 180;
        var px = cx + Math.cos(rad) * r; var py = cy + Math.sin(rad) * r;
        out.push('<ellipse cx="' + px + '" cy="' + py + '" rx="' + rx + '" ry="' + ry + '" fill="' + color + '" transform="rotate(' + a + " " + px + " " + py + ')"/>');
      }
      return out.join("");
    }
    function soilShadow() { return '<ellipse cx="30" cy="55" rx="14" ry="4" fill="rgba(90,60,30,.20)"/>'; }
    function drawSeed() {
      return svgWrap('<ellipse cx="30" cy="53.5" rx="15" ry="4.5" fill="rgba(90,60,30,.24)"/><path d="M15 53.5 Q30 44 45 53.5 Z" fill="#b5875a"/><ellipse cx="30" cy="48.4" rx="4" ry="2.9" fill="#8b5f38"/><ellipse cx="28.7" cy="47.4" rx="1.5" ry="1" fill="#d2a678" opacity=".8"/>');
    }
    function drawSprout(L) {
      return svgWrap(soilShadow() + '<path d="M30 54 C 30 50 30 48 30 43" stroke="' + L + '" stroke-width="2.6" stroke-linecap="round" fill="none"/><ellipse cx="22.5" cy="44.5" rx="7" ry="4.6" fill="' + L + '" transform="rotate(-22 22.5 44.5)"/><ellipse cx="37.5" cy="44.5" rx="7" ry="4.6" fill="' + L + '" transform="rotate(22 37.5 44.5)"/><ellipse cx="30" cy="42" rx="2.6" ry="3.4" fill="' + L + '"/><ellipse cx="29.2" cy="41.2" rx="1" ry="1.5" fill="#fff" opacity=".45"/>');
    }
    function drawWither() {
      var W = "#c2b29a", WD = "#8e7d61";
      return svgWrap('<ellipse cx="30" cy="55" rx="13" ry="3.6" fill="rgba(90,60,30,.16)"/><path d="M30 55 C 29 48 25 44 20 42" stroke="' + WD + '" stroke-width="2.3" stroke-linecap="round" fill="none"/><ellipse cx="18.5" cy="45" rx="6" ry="3.2" fill="' + W + '" transform="rotate(-42 18.5 45)"/><path d="M30 55 C 31 47 35 43 40 41" stroke="' + WD + '" stroke-width="2.1" stroke-linecap="round" fill="none"/><ellipse cx="41.5" cy="44" rx="5.6" ry="3" fill="' + W + '" transform="rotate(40 41.5 44)"/><path d="M30 55 L30 45" stroke="' + WD + '" stroke-width="2.1" stroke-linecap="round"/><ellipse cx="30" cy="43.5" rx="4.2" ry="2.6" fill="' + W + '"/>');
    }
    function drawRoot(crop, ripe) {
      var L = crop.leaf, F = crop.fruit, FL = crop.flower;
      var out = [soilShadow()]; var angs = [-52, -26, 0, 26, 52];
      angs.forEach(function (a, i) {
        var rad = (a * Math.PI) / 180; var d = 11 + (i === 2 ? 3 : 0);
        var cx = 30 + Math.sin(rad) * d; var cy = 53 - Math.cos(rad) * d;
        var len = i === 2 ? 16 : 13;
        out.push('<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (len * 0.19) + '" ry="' + (len * 0.56) + '" fill="' + L + '" transform="rotate(' + a + " " + cx + " " + cy + ')"/>');
      });
      if (!ripe) { out.push('<ellipse cx="30" cy="33" rx="8" ry="5.6" fill="' + FL + '" opacity=".94"/><circle cx="26.8" cy="32" r="1.6" fill="#fff" opacity=".78"/>'); }
      else { out.push('<ellipse cx="30" cy="51.5" rx="7.5" ry="5.5" fill="' + F + '"/><ellipse cx="27.4" cy="50" rx="2" ry="3" fill="#fff" opacity=".3"/>'); }
      return svgWrap(out.join(""));
    }
    function drawBush(crop, ripe) {
      var L = crop.leaf, F = crop.fruit, FL = crop.flower;
      var out = [soilShadow()];
      out.push('<path d="M30 54 L30 42" stroke="' + L + '" stroke-width="3" stroke-linecap="round"/>');
      out.push('<ellipse cx="21" cy="45" rx="9" ry="5.8" fill="' + L + '" transform="rotate(-24 21 45)"/>');
      out.push('<ellipse cx="39" cy="45" rx="9" ry="5.8" fill="' + L + '" transform="rotate(24 39 45)"/>');
      out.push('<ellipse cx="23" cy="36" rx="8" ry="5.4" fill="' + L + '" transform="rotate(-30 23 36)"/>');
      out.push('<ellipse cx="37" cy="36" rx="8" ry="5.4" fill="' + L + '" transform="rotate(30 37 36)"/>');
      out.push('<ellipse cx="30" cy="32" rx="7.5" ry="6" fill="' + L + '"/>');
      if (!ripe) { [[23, 34], [37, 33], [30, 27]].forEach(function (p) { out.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.3" fill="' + FL + '"/>'); }); }
      else if (crop.id === "strawberry") {
        [[23, 40], [37, 39], [30, 35]].forEach(function (p) {
          out.push('<path d="M' + p[0] + " " + (p[1] - 3.5) + " C " + (p[0] + 4) + " " + (p[1] - 3) + ", " + (p[0] + 4.2) + " " + (p[1] + 3) + ", " + p[0] + " " + (p[1] + 4.8) + " C " + (p[0] - 4.2) + " " + (p[1] + 3) + ", " + (p[0] - 4) + " " + (p[1] - 3) + ", " + p[0] + " " + (p[1] - 3.5) + ' Z" fill="' + F + '"/>');
          out.push('<path d="M' + (p[0] - 3) + " " + (p[1] - 3) + " L" + p[0] + " " + (p[1] - 4.6) + " L" + (p[0] + 3) + " " + (p[1] - 3) + '" stroke="#5fae57" stroke-width="1.4" fill="none" stroke-linecap="round"/>');
        });
      } else { [[22, 39], [38, 38], [30, 33]].forEach(function (p) { out.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="5.4" fill="' + F + '"/><circle cx="' + (p[0] - 1.7) + '" cy="' + (p[1] - 1.7) + '" r="1.7" fill="#fff" opacity=".34"/>'); }); }
      return svgWrap(out.join(""));
    }
    function drawStalk(crop, ripe) {
      var L = crop.leaf, F = crop.fruit, FL = crop.flower;
      var out = [soilShadow()];
      out.push('<path d="M30 54 L30 16" stroke="' + L + '" stroke-width="3.2" stroke-linecap="round"/>');
      [46, 39, 32, 25].forEach(function (y, i) {
        var dir = i % 2 === 0 ? -1 : 1; var cx = 30 + dir * 11;
        out.push('<ellipse cx="' + cx + '" cy="' + y + '" rx="11.5" ry="4.4" fill="' + L + '" transform="rotate(' + dir * 26 + " " + cx + " " + y + ')"/>');
      });
      if (!ripe) { out.push('<ellipse cx="30" cy="13" rx="3.2" ry="6" fill="' + FL + '"/>'); }
      else {
        out.push('<ellipse cx="38" cy="32" rx="5.4" ry="10" fill="' + F + '" transform="rotate(12 38 32)"/>');
        out.push('<path d="M38 22 Q40 17 44 15" stroke="#c9a96a" stroke-width="1.6" fill="none" stroke-linecap="round"/>');
        out.push('<ellipse cx="22" cy="34" rx="4.6" ry="8.4" fill="' + F + '" transform="rotate(-12 22 34)" opacity=".92"/>');
      }
      return svgWrap(out.join(""));
    }
    function drawVine(crop, ripe) {
      var L = crop.leaf, F = crop.fruit, FL = crop.flower;
      var out = [soilShadow()];
      out.push('<path d="M14 53 Q30 47 46 53" stroke="' + L + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>');
      [[19, 49, -1], [41, 49, 1], [30, 46, 0]].forEach(function (p) {
        out.push('<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="8.5" ry="6" fill="' + L + '" transform="rotate(' + (p[2] * 22) + " " + p[0] + " " + p[1] + ')"/>');
      });
      if (!ripe) { out.push('<circle cx="30" cy="36" r="6" fill="' + FL + '"/>'); }
      else {
        out.push('<ellipse cx="30" cy="43" rx="14" ry="10.5" fill="' + F + '"/>');
        out.push('<ellipse cx="30" cy="43" rx="9" ry="10.5" fill="none" stroke="rgba(180,90,20,.3)" stroke-width="1.1"/>');
        out.push('<path d="M30 32 Q30 26 35 24" stroke="#5fae57" stroke-width="2.4" fill="none" stroke-linecap="round"/>');
      }
      return svgWrap(out.join(""));
    }
    function drawFlower(crop, ripe) {
      var L = crop.leaf, FL = crop.flower;
      var out = [soilShadow()];
      var tall = crop.id === "sunflower" ? 1 : 0; var topY = tall ? 17 : 27;
      out.push('<path d="M30 54 C 29 42 31 34 30 ' + topY + '" stroke="' + L + '" stroke-width="2.8" stroke-linecap="round" fill="none"/>');
      out.push('<ellipse cx="22" cy="45" rx="8.5" ry="5.4" fill="' + L + '" transform="rotate(-26 22 45)"/>');
      out.push('<ellipse cx="38" cy="45" rx="8.5" ry="5.4" fill="' + L + '" transform="rotate(26 38 45)"/>');
      if (!ripe) {
        out.push('<ellipse cx="30" cy="' + (topY - 1) + '" rx="4.6" ry="6.6" fill="' + L + '"/>');
        out.push('<path d="M30 ' + (topY - 7.5) + " Q 33 " + (topY - 4) + " 30 " + (topY + 4.5) + '" stroke="' + FL + '" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".92"/>');
      } else {
        var cx = 30, cy = topY;
        if (crop.id === "sunflower") { out.push(petals(cx, cy, 10, 8.6, FL, 5.6, 3.2)); out.push('<circle cx="' + cx + '" cy="' + cy + '" r="6" fill="#8a5f2e"/><circle cx="' + cx + '" cy="' + cy + '" r="3.4" fill="#6d4a22"/>'); }
        else if (crop.id === "lavender") { for (var i = 0; i < 9; i++) { var yy = cy - 9 + i * 2.4; var w = i < 4 ? i * 0.9 + 1.6 : (8 - i) * 0.9 + 1.6; out.push('<ellipse cx="' + (cx - w) + '" cy="' + yy + '" rx="2.2" ry="2.6" fill="' + FL + '"/><ellipse cx="' + (cx + w) + '" cy="' + yy + '" rx="2.2" ry="2.6" fill="' + FL + '"/>'); } }
        else if (crop.id === "tulip") { out.push('<path d="M' + (cx - 6) + " " + (cy + 2) + " Q" + (cx - 6) + " " + (cy - 10) + " " + cx + " " + (cy - 10) + " Q" + (cx + 6) + " " + (cy - 10) + " " + (cx + 6) + " " + (cy + 2) + " Q" + cx + " " + (cy + 7) + " " + (cx - 6) + " " + (cy + 2) + ' Z" fill="' + FL + '"/>'); }
        else if (crop.id === "rose") { out.push(petals(cx, cy, 7, 7.4, FL, 5.4, 3.6)); out.push('<circle cx="' + cx + '" cy="' + cy + '" r="4.6" fill="' + FL + '"/>'); }
        else { out.push(petals(cx, cy, 8, 7, FL, 5, 2.8)); out.push('<circle cx="' + cx + '" cy="' + cy + '" r="3.8" fill="#ffd54a"/>'); }
      }
      return svgWrap(out.join(""));
    }
    function plantSVG(crop, stage) {
      if (stage === 4) return drawWither();
      if (stage === 0) return drawSeed();
      if (stage === 1) return drawSprout(crop.leaf);
      var ripe = stage === 3;
      if (crop.type === "root") return drawRoot(crop, ripe);
      if (crop.type === "bush") return drawBush(crop, ripe);
      if (crop.type === "stalk") return drawStalk(crop, ripe);
      if (crop.type === "vine") return drawVine(crop, ripe);
      if (crop.type === "flower") return drawFlower(crop, ripe);
      return svgWrap(soilShadow());
    }
    function fishSVG(f) {
      var b = f.body || "#b8d8e6"; var a = f.acc || "#8fbdd2";
      if (f.id === "boot") {
        return svgWrap('<ellipse cx="30" cy="50" rx="14" ry="4" fill="rgba(60,60,60,.14)"/><path d="M22 20 L22 40 Q22 48 32 48 L40 48 Q42 48 42 44 L42 40 Q42 34 34 32 L30 30 L30 20 Q30 17 26 17 Q22 17 22 20 Z" fill="' + b + '" stroke="' + a + '" stroke-width="1.4"/><rect x="21" y="18" width="10" height="5" rx="2" fill="' + a + '"/>');
      }
      if (f.id === "chest") {
        return svgWrap('<ellipse cx="30" cy="50" rx="15" ry="4" fill="rgba(60,40,10,.18)"/><rect x="14" y="30" width="32" height="18" rx="4" fill="' + b + '" stroke="' + a + '" stroke-width="1.6"/><path d="M14 32 Q30 20 46 32" fill="' + b + '" stroke="' + a + '" stroke-width="1.6"/><rect x="27" y="34" width="6" height="9" rx="2" fill="#e8c86a" stroke="' + a + '" stroke-width="1"/><circle cx="30" cy="38" r="1.6" fill="#6b5220"/>');
      }
      var out = [];
      out.push('<ellipse cx="30" cy="52" rx="16" ry="4" fill="rgba(30,80,110,.14)"/>');
      out.push('<path d="M40 34 L52 24 Q54 34 52 44 Z" fill="' + a + '"/>');
      out.push('<ellipse cx="26" cy="34" rx="16" ry="10" fill="' + b + '"/>');
      out.push('<path d="M18 26 Q24 18 34 25" stroke="' + a + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>');
      out.push('<path d="M22 41 Q30 46 40 40" stroke="' + a + '" stroke-width="1.4" fill="none" opacity=".55"/>');
      out.push('<ellipse cx="24" cy="37" rx="9" ry="3.6" fill="#fff" opacity=".22"/>');
      out.push('<circle cx="17" cy="31" r="2.6" fill="#333"/>');
      out.push('<circle cx="16.2" cy="30.2" r="1" fill="#fff"/>');
      return svgWrap(out.join(""));
    }
    function furnSVG(id, align) {
      var inner = ""; var shadow = '<ellipse cx="30" cy="55" rx="14" ry="3" fill="rgba(80,50,30,.18)"/>';
      switch (id) {
        // ===== 地面 · 座椅 =====
        case "stool": inner = shadow + '<path d="M23 34 L19 54 M30 34 L30 54 M37 34 L41 54" stroke="#a06a3a" stroke-width="3" stroke-linecap="round"/><ellipse cx="30" cy="34" rx="14" ry="5.5" fill="#c99460"/><ellipse cx="30" cy="32.6" rx="13" ry="4.4" fill="#e0b07a"/>'; break;
        case "chair": inner = shadow + '<rect x="19" y="18" width="4" height="32" rx="1.5" fill="#a06a3a"/><rect x="19" y="18" width="22" height="4" rx="1.5" fill="#b88050"/><rect x="19" y="27" width="20" height="3" rx="1.2" fill="#b88050"/><rect x="17" y="34" width="26" height="4.5" rx="2" fill="#c99460"/><rect x="18" y="38.5" width="3.4" height="15" rx="1" fill="#a06a3a"/><rect x="39" y="38.5" width="3.4" height="15" rx="1" fill="#a06a3a"/>'; break;
        case "bench": inner = shadow + '<rect x="8" y="30" width="44" height="6" rx="2" fill="#c0905a"/><rect x="8" y="30" width="44" height="2" rx="1" fill="#e0b07a"/><rect x="12" y="36" width="5" height="18" fill="#a06a3a"/><rect x="43" y="36" width="5" height="18" fill="#a06a3a"/>'; break;
        case "armchair": inner = shadow + '<rect x="13" y="22" width="34" height="22" rx="7" fill="#c8956e"/><rect x="9" y="32" width="8" height="16" rx="4" fill="#b07f58"/><rect x="43" y="32" width="8" height="16" rx="4" fill="#b07f58"/><rect x="16" y="40" width="28" height="10" rx="4" fill="#dba87e"/><rect x="19" y="50" width="4.5" height="5" rx="1" fill="#8a6a4a"/><rect x="36.5" y="50" width="4.5" height="5" rx="1" fill="#8a6a4a"/>'; break;
        case "sofa": inner = shadow + '<rect x="9" y="24" width="42" height="20" rx="7" fill="#7fa8c8"/><rect x="11" y="30" width="38" height="4" rx="2" fill="#93bcd8"/><rect x="5" y="33" width="9" height="18" rx="4.5" fill="#6f98b8"/><rect x="46" y="33" width="9" height="18" rx="4.5" fill="#6f98b8"/><rect x="12" y="40" width="36" height="10" rx="4" fill="#8fb8d8"/><rect x="16" y="50" width="5" height="5" rx="1" fill="#8a6a4a"/><rect x="39" y="50" width="5" height="5" rx="1" fill="#8a6a4a"/><path d="M20 32 L40 32" stroke="#a8cce8" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>'; break;
        case "rocking": inner = shadow + '<path d="M8 52 Q30 46 52 52" stroke="#8a5a30" stroke-width="2.6" fill="none" stroke-linecap="round"/><rect x="17" y="22" width="4" height="24" rx="1.5" fill="#b88050"/><path d="M17 22 Q14 34 17 46" stroke="#b88050" stroke-width="3.2" fill="none" stroke-linecap="round"/><rect x="17" y="22" width="22" height="4" rx="1.5" fill="#c99460"/><rect x="17" y="31" width="20" height="3" rx="1.2" fill="#c99460"/><rect x="15" y="38" width="28" height="5" rx="2" fill="#c99460"/><rect x="20" y="43" width="3" height="9" rx="1" fill="#a06a3a"/><rect x="37" y="43" width="3" height="9" rx="1" fill="#a06a3a"/>'; break;
        case "beanbag": inner = '<ellipse cx="30" cy="52" rx="16" ry="3.6" fill="rgba(70,40,50,.24)"/><path d="M11 50 Q9 30 20 25 Q30 20 40 25 Q51 30 49 50 Z" fill="#c288a0"/><path d="M15 46 Q16 32 24 27" stroke="rgba(255,255,255,.34)" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M45 46 Q44 32 36 27" stroke="rgba(120,60,90,.30)" stroke-width="1.6" fill="none" stroke-linecap="round"/><ellipse cx="30" cy="40" rx="12" ry="3.4" fill="rgba(255,255,255,.16)"/>'; break;
        case "pouf": inner = shadow + '<ellipse cx="30" cy="46" rx="20" ry="9" fill="#8e6b50"/><ellipse cx="30" cy="44" rx="19" ry="8.4" fill="#a8825e"/><ellipse cx="30" cy="43" rx="15" ry="6" fill="#c69a70"/><ellipse cx="26" cy="41" rx="7" ry="2.4" fill="rgba(255,240,220,.36)"/>'; break;

        // ===== 地面 · 桌几 =====
        case "table": inner = shadow + '<rect x="24" y="30" width="4" height="22" rx="1" fill="#a06a3a"/><rect x="32" y="30" width="4" height="22" rx="1" fill="#a06a3a"/><rect x="10" y="25" width="40" height="6" rx="2" fill="#c99460"/><rect x="10" y="25" width="40" height="2.5" rx="1" fill="#e0b07a"/><line x1="14" y1="28.5" x2="46" y2="28.5" stroke="rgba(140,100,60,.28)" stroke-width="0.8"/>'; break;
        case "coffee": inner = shadow + '<rect x="12" y="37" width="36" height="5.5" rx="2" fill="#c99460"/><rect x="12" y="37" width="36" height="2" rx="1" fill="#e0b07a"/><rect x="14" y="42.5" width="3.6" height="11" rx="1" fill="#a06a3a"/><rect x="42.4" y="42.5" width="3.6" height="11" rx="1" fill="#a06a3a"/>'; break;
        case "desk": inner = shadow + '<rect x="8" y="23" width="44" height="7" rx="2" fill="#b8814a"/><rect x="8" y="23" width="44" height="2.6" rx="1" fill="#d6a06a"/><rect x="10" y="30" width="18" height="12" rx="1.5" fill="#a06a3a"/><rect x="32" y="30" width="18" height="12" rx="1.5" fill="#a06a3a"/><rect x="11" y="30.5" width="16" height="11" rx="1.5" fill="#b0764a"/><rect x="33" y="30.5" width="16" height="11" rx="1.5" fill="#b0764a"/><circle cx="19" cy="36" r="1.6" fill="#e8c86a"/><circle cx="41" cy="36" r="1.6" fill="#e8c86a"/><rect x="11" y="42" width="3.6" height="12" rx="1" fill="#8a5a30"/><rect x="45.4" y="42" width="3.6" height="12" rx="1" fill="#8a5a30"/>'; break;
        case "roundtable": inner = shadow + '<rect x="28" y="30" width="4" height="22" rx="1" fill="#a06a3a"/><ellipse cx="30" cy="50" rx="10" ry="2.6" fill="#8a5a30"/><ellipse cx="30" cy="27" rx="22" ry="7" fill="#c99460"/><ellipse cx="30" cy="25.4" rx="21" ry="6" fill="#e0b07a"/><circle cx="24" cy="25" r="1.4" fill="#e8566a"/><circle cx="30" cy="24" r="1.4" fill="#f0c85a"/><circle cx="36" cy="25" r="1.4" fill="#7ec860"/>'; break;
        case "sidetable": inner = shadow + '<rect x="14" y="27" width="32" height="5" rx="2" fill="#c99460"/><rect x="14" y="27" width="32" height="2" rx="1" fill="#e0b07a"/><rect x="17" y="32" width="3.6" height="22" rx="1" fill="#a06a3a"/><rect x="39.4" y="32" width="3.6" height="22" rx="1" fill="#a06a3a"/><rect x="17" y="38" width="26" height="3" rx="1" fill="#b88050"/>'; break;
        case "nightstand": inner = shadow + '<rect x="15" y="25" width="30" height="28" rx="2.5" fill="#b88050"/><rect x="15" y="25" width="30" height="3" rx="1.5" fill="#d0a070"/><rect x="17" y="30" width="26" height="9" rx="1.5" fill="#c08a58"/><rect x="17" y="41" width="26" height="10" rx="1.5" fill="#c08a58"/><circle cx="30" cy="34.5" r="1.5" fill="#e8c86a"/><circle cx="30" cy="46" r="1.5" fill="#e8c86a"/><rect x="16" y="53" width="4" height="3" fill="#8a5a30"/><rect x="40" y="53" width="4" height="3" fill="#8a5a30"/>'; break;
        case "workbench": inner = shadow + '<rect x="9" y="22" width="42" height="6" rx="2" fill="#a87048"/><rect x="9" y="22" width="42" height="2.4" rx="1" fill="#c99460"/><rect x="11" y="28" width="4" height="26" rx="1" fill="#7a4a20"/><rect x="45" y="28" width="4" height="26" rx="1" fill="#7a4a20"/><rect x="15" y="34" width="30" height="3" rx="1" fill="#8a5a30"/><rect x="18" y="15" width="10" height="4" rx="1" fill="#c99460"/><circle cx="20" cy="17" r="1" fill="#7a4a20"/><rect x="34" y="14" width="3" height="7" fill="#7a8290"/><path d="M34 14 L37 11 L40 14 Z" fill="#a8b0b8"/>'; break;

        // ===== 地面 · 收纳 =====
        case "shelf": inner = shadow + '<rect x="13" y="15" width="4" height="40" fill="#a06a3a"/><rect x="43" y="15" width="4" height="40" fill="#a06a3a"/><rect x="13" y="19" width="34" height="3" rx="1" fill="#c99460"/><rect x="13" y="33" width="34" height="3" rx="1" fill="#c99460"/><rect x="13" y="47" width="34" height="3" rx="1" fill="#c99460"/><rect x="19" y="12" width="4" height="7" rx="0.8" fill="#e05a5a"/><rect x="25" y="13" width="4" height="6" rx="0.8" fill="#5a90e0"/><circle cx="39" cy="30" r="3" fill="#7ec860"/><rect x="35" y="44" width="9" height="3" rx="1" fill="#e8b050"/>'; break;
        case "cabinet": inner = shadow + '<rect x="14" y="21" width="32" height="33" rx="2.5" fill="#b88050"/><rect x="14" y="21" width="32" height="3" rx="1.5" fill="#d0a070"/><line x1="30" y1="24" x2="30" y2="54" stroke="#8a5a30" stroke-width="1.4"/><rect x="16" y="26" width="12" height="25" rx="1.5" fill="#c08a58"/><rect x="32" y="26" width="12" height="25" rx="1.5" fill="#c08a58"/><circle cx="25.5" cy="38" r="1.6" fill="#e8c86a"/><circle cx="34.5" cy="38" r="1.6" fill="#e8c86a"/><rect x="15" y="54" width="4" height="3" fill="#8a5a30"/><rect x="41" y="54" width="4" height="3" fill="#8a5a30"/>'; break;
        case "bookshelf": inner = shadow + '<rect x="12" y="14" width="36" height="42" rx="2" fill="#a0703a"/><rect x="14" y="16" width="32" height="12" fill="#8a5a2a"/><rect x="14" y="30" width="32" height="12" fill="#8a5a2a"/><rect x="14" y="44" width="32" height="10" fill="#8a5a2a"/><rect x="16" y="17" width="4" height="10" fill="#e05a5a"/><rect x="21" y="18" width="4" height="9" fill="#5a90e0"/><rect x="26" y="17" width="4" height="10" fill="#e0b050"/><rect x="31" y="18" width="4" height="9" fill="#7ec860"/><rect x="16" y="31" width="4" height="10" fill="#b070d0"/><rect x="21" y="32" width="4" height="9" fill="#e88a50"/><rect x="16" y="45" width="4" height="8" fill="#5ad8c0"/><rect x="21" y="46" width="4" height="7" fill="#e05a8a"/>'; break;
        case "wardrobe": inner = shadow + '<rect x="14" y="12" width="32" height="42" rx="2.5" fill="#a0703a"/><rect x="14" y="12" width="32" height="4" rx="2" fill="#c08a58"/><line x1="30" y1="16" x2="30" y2="54" stroke="#7a4a20" stroke-width="1.4"/><rect x="16" y="18" width="12" height="34" rx="1.2" fill="#b88050"/><rect x="32" y="18" width="12" height="34" rx="1.2" fill="#b88050"/><circle cx="26" cy="35" r="1.6" fill="#e8c86a"/><circle cx="34" cy="35" r="1.6" fill="#e8c86a"/><rect x="15" y="54" width="4" height="3" fill="#8a5a30"/><rect x="41" y="54" width="4" height="3" fill="#8a5a30"/>'; break;
        case "drawers": inner = shadow + '<rect x="15" y="18" width="30" height="36" rx="2.5" fill="#b88050"/><rect x="15" y="18" width="30" height="3" rx="1.5" fill="#d0a070"/><rect x="17" y="23" width="26" height="8" rx="1.4" fill="#c08a58"/><rect x="17" y="33" width="26" height="8" rx="1.4" fill="#c08a58"/><rect x="17" y="43" width="26" height="8" rx="1.4" fill="#c08a58"/><rect x="26" y="26" width="8" height="2" rx="1" fill="#7a4a20"/><rect x="26" y="36" width="8" height="2" rx="1" fill="#7a4a20"/><rect x="26" y="46" width="8" height="2" rx="1" fill="#7a4a20"/><rect x="16" y="54" width="4" height="3" fill="#8a5a30"/><rect x="40" y="54" width="4" height="3" fill="#8a5a30"/>'; break;
        case "showcase": inner = shadow + '<rect x="13" y="13" width="34" height="42" rx="2.5" fill="#8a5a30"/><rect x="16" y="16" width="28" height="36" rx="1.5" fill="#c8e0ec" opacity=".82"/><line x1="16" y1="28" x2="44" y2="28" stroke="#8a5a30" stroke-width="1.4"/><line x1="16" y1="40" x2="44" y2="40" stroke="#8a5a30" stroke-width="1.4"/><rect x="22" y="20" width="6" height="7" rx="1" fill="#e8c86a"/><rect x="30" y="20" width="6" height="7" rx="1" fill="#e8566a"/><circle cx="26" cy="34" r="3" fill="#7ec860"/><circle cx="34" cy="34" r="3" fill="#f09238"/><rect x="24" y="44" width="4" height="6" rx="1" fill="#a8c8e0"/><rect x="32" y="44" width="4" height="6" rx="1" fill="#c288a0"/><rect x="19" y="19" width="2" height="30" fill="rgba(255,255,255,.5)"/>'; break;
        case "shoe": inner = shadow + '<rect x="12" y="32" width="36" height="21" rx="2.5" fill="#b88050"/><rect x="12" y="32" width="36" height="3" rx="1.5" fill="#d0a070"/><rect x="14" y="36" width="16" height="7" rx="1.2" fill="#c08a58"/><rect x="31" y="36" width="16" height="7" rx="1.2" fill="#c08a58"/><rect x="14" y="44" width="16" height="7" rx="1.2" fill="#c08a58"/><rect x="31" y="44" width="16" height="7" rx="1.2" fill="#c08a58"/><ellipse cx="20" cy="40" rx="5" ry="2.4" fill="#8a5a30"/><ellipse cx="36" cy="40" rx="5" ry="2.4" fill="#5a90e0"/><rect x="13" y="53" width="4" height="3" fill="#8a5a30"/><rect x="43" y="53" width="4" height="3" fill="#8a5a30"/>'; break;

        // ===== 地面 · 床铺 =====
        case "bed": inner = shadow + '<rect x="8" y="34" width="44" height="14" rx="3" fill="#c99460"/><rect x="8" y="18" width="9" height="30" rx="3" fill="#b88050"/><rect x="13" y="23" width="13" height="8" rx="3.5" fill="#fdf8ee"/><rect x="8" y="30" width="44" height="7" rx="3" fill="#e8e0d0"/><rect x="24" y="30" width="28" height="8" rx="3" fill="#a8c8e0"/><rect x="10" y="48" width="4" height="6" rx="1" fill="#8a5a30"/><rect x="46" y="48" width="4" height="6" rx="1" fill="#8a5a30"/>'; break;
        case "bunk": inner = shadow + '<rect x="10" y="10" width="4" height="46" fill="#8a5a30"/><rect x="46" y="10" width="4" height="46" fill="#8a5a30"/><rect x="12" y="22" width="36" height="4" rx="1.5" fill="#c99460"/><rect x="12" y="44" width="36" height="4" rx="1.5" fill="#c99460"/><rect x="14" y="14" width="30" height="10" rx="2" fill="#e8e0d0"/><rect x="30" y="14" width="14" height="10" rx="2" fill="#a8c8e0"/><rect x="14" y="36" width="30" height="10" rx="2" fill="#e8e0d0"/><rect x="30" y="36" width="14" height="10" rx="2" fill="#a8c8e0"/><rect x="16" y="18" width="9" height="5" rx="2.5" fill="#fdf8ee"/><rect x="16" y="40" width="9" height="5" rx="2.5" fill="#fdf8ee"/>'; break;
        case "hammock": inner = shadow + '<rect x="6" y="14" width="3.6" height="42" fill="#8a5a30"/><rect x="50.4" y="14" width="3.6" height="42" fill="#8a5a30"/><path d="M9 20 Q30 46 51 20" stroke="#a87048" stroke-width="2" fill="none"/><path d="M10 22 Q30 54 50 22" stroke="#c99460" stroke-width="1.6" fill="none"/><ellipse cx="30" cy="38" rx="16" ry="7" fill="#e8c8d0"/><ellipse cx="30" cy="36" rx="14" ry="5.4" fill="#f0dce4"/><path d="M20 36 L24 26 M30 37 L30 26 M40 36 L36 26" stroke="rgba(140,100,80,.4)" stroke-width="1"/>'; break;

        // ===== 地面 · 装饰 =====
        case "rug": inner = shadow + '<ellipse cx="30" cy="45" rx="22" ry="10" fill="#c97a5a"/><ellipse cx="30" cy="45" rx="18" ry="7.5" fill="#e0a080"/><ellipse cx="30" cy="45" rx="13" ry="5" fill="#d4906e"/><ellipse cx="30" cy="45" rx="7" ry="2.5" fill="#f2c5a8"/>'; break;
        case "sign": inner = shadow + '<rect x="27" y="32" width="6" height="24" fill="#a67038"/><rect x="12" y="18" width="36" height="18" rx="3" fill="#c48c50"/><rect x="12" y="18" width="36" height="4" rx="2" fill="#a67038"/><line x1="17" y1="26" x2="43" y2="26" stroke="#7a4a20" stroke-width="1.5" stroke-linecap="round"/><line x1="17" y1="31" x2="38" y2="31" stroke="#7a4a20" stroke-width="1.5" stroke-linecap="round"/>'; break;
        case "fence": inner = shadow + '<rect x="14" y="20" width="5" height="35" rx="1.5" fill="#b88050"/><rect x="41" y="20" width="5" height="35" rx="1.5" fill="#b88050"/><rect x="10" y="26" width="40" height="5" rx="1.5" fill="#c99460"/><rect x="10" y="40" width="40" height="5" rx="1.5" fill="#c99460"/><path d="M14 20 L16.5 14 L19 20 Z" fill="#b88050"/><path d="M41 20 L43.5 14 L46 20 Z" fill="#b88050"/>'; break;
        case "potted": inner = shadow + '<path d="M30 42 C 22 36 18 26 22 16 C 26 24 30 32 30 42 Z" fill="#6fc06b"/><path d="M30 42 C 38 36 42 26 38 16 C 34 24 30 32 30 42 Z" fill="#8bd97f"/><ellipse cx="30" cy="22" rx="5" ry="10" fill="#5fb85c"/><rect x="17" y="40" width="26" height="5" rx="2.5" fill="#d59a5f"/><path d="M19 45 L41 45 L38 55 Q37 57 35 57 L25 57 Q23 57 22 55 Z" fill="#c47b45"/><ellipse cx="30" cy="40" rx="13" ry="2.5" fill="#a05a2c" opacity=".25"/>'; break;
        case "basket": inner = shadow + '<path d="M14 30 L46 30 L43 52 Q42 55 39 55 L21 55 Q18 55 17 52 Z" fill="#d8a86a"/><line x1="14" y1="36" x2="46" y2="36" stroke="#a87a42" stroke-width="1.2"/><line x1="15" y1="42" x2="45" y2="42" stroke="#a87a42" stroke-width="1.2"/><line x1="16" y1="48" x2="44" y2="48" stroke="#a87a42" stroke-width="1.2"/><path d="M20 30 Q30 18 40 30" stroke="#a87a42" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="25" cy="27" r="4" fill="#e8564a"/><circle cx="33" cy="26" r="4.5" fill="#f09238"/>'; break;
        case "lamp": inner = shadow + '<rect x="28" y="30" width="4" height="25" fill="#4a5060"/><ellipse cx="30" cy="55" rx="8" ry="2.5" fill="#3a4050"/><path d="M20 22 L22 30 L38 30 L40 22 Z" fill="#6a7080"/><path d="M22 30 L38 30 L38 32 L22 32 Z" fill="#505868"/><circle cx="30" cy="27" r="4" fill="#fff4b0"/><circle cx="30" cy="27" r="6" fill="#fff4b0" opacity=".3"/><path d="M20 22 L30 18 L40 22 Z" fill="#505868"/>'; break;
        case "floorlamp": inner = shadow + '<ellipse cx="30" cy="55" rx="9" ry="2.6" fill="#3a4050"/><rect x="28.6" y="22" width="2.8" height="33" fill="#7a8290"/><path d="M18 22 L24 6 L36 6 L42 22 Z" fill="#f0d8a0"/><path d="M18 22 L42 22 L42 24 L18 24 Z" fill="#d8b878"/><ellipse cx="30" cy="26" rx="12" ry="4" fill="#fff4b0" opacity=".38"/><circle cx="30" cy="22" r="3.6" fill="#fff8d0"/><circle cx="30" cy="22" r="6" fill="#fff8d0" opacity=".34"/>'; break;
        case "birdhouse": inner = shadow + '<path d="M14 26 L30 14 L46 26 Z" fill="#c2524a"/><rect x="18" y="26" width="24" height="24" fill="#e8d8b8"/><circle cx="30" cy="36" r="5" fill="#5a4030"/><rect x="28" y="42" width="4" height="3" fill="#8a5a30"/><circle cx="30" cy="20" r="3" fill="#e8b050"/><path d="M33 20 L36 19 L33 18 Z" fill="#e87020"/>'; break;
        case "pond": inner = '<ellipse cx="30" cy="42" rx="24" ry="12" fill="#3f7a9c" opacity=".25"/><ellipse cx="30" cy="40" rx="22" ry="10" fill="#6bb8dc"/><ellipse cx="30" cy="40" rx="18" ry="7" fill="#8cd4f0"/><ellipse cx="22" cy="38" rx="5" ry="3" fill="#7ec860"/><path d="M22 38 L22 34" stroke="#5fa840" stroke-width="0.8"/><circle cx="22" cy="33" r="1.5" fill="#ff90b8"/><path d="M36 38 Q40 36 44 38" stroke="#fff" stroke-width="1" fill="none" opacity=".6"/><path d="M14 44 Q18 42 22 44" stroke="#fff" stroke-width="1" fill="none" opacity=".6"/>'; break;
        case "mirror": inner = shadow + '<path d="M18 54 Q14 46 14 32 Q14 14 30 14 Q46 14 46 32 Q46 46 42 54 Z" fill="#c9a06a"/><path d="M20 52 Q17 45 17 32 Q17 17 30 17 Q43 17 43 32 Q43 45 40 52 Z" fill="#c8e0ec"/><path d="M22 30 Q22 21 30 20" stroke="#fff" stroke-width="2" fill="none" opacity=".7" stroke-linecap="round"/><ellipse cx="30" cy="54" rx="14" ry="2" fill="#8a6a3a"/>'; break;
        case "guitar": inner = shadow + '<ellipse cx="30" cy="40" rx="14" ry="12" fill="#c48c50"/><ellipse cx="30" cy="26" rx="10" ry="9" fill="#c48c50"/><circle cx="30" cy="34" r="4" fill="#5a3a20"/><rect x="28" y="8" width="4" height="14" fill="#8a5a30"/><rect x="26" y="5" width="8" height="5" rx="1" fill="#6a4020"/><line x1="29" y1="10" x2="29" y2="48" stroke="#f0e8d0" stroke-width="0.5"/><line x1="31" y1="10" x2="31" y2="48" stroke="#f0e8d0" stroke-width="0.5"/><rect x="27" y="45" width="6" height="2" fill="#5a3a20"/>'; break;
        case "screen": inner = shadow + '<path d="M7 54 L11 17 L23 17 L23 54 Z" fill="#f2e4ce" stroke="#c08a52" stroke-width="1.4"/><path d="M23 54 L27 17 L39 17 L39 54 Z" fill="#fbf3e4" stroke="#c08a52" stroke-width="1.4"/><path d="M39 54 L43 17 L53 17 L53 54 Z" fill="#f2e4ce" stroke="#c08a52" stroke-width="1.4"/><path d="M14 24 L20 24 M30 24 L36 24 M46 24 L50 24" stroke="rgba(160,120,80,.35)" stroke-width="1.2" stroke-linecap="round"/>'; break;
        case "teddy": inner = shadow + '<circle cx="20" cy="20" r="5" fill="#c49a68"/><circle cx="40" cy="20" r="5" fill="#c49a68"/><circle cx="20" cy="20" r="2.5" fill="#e8c8a0"/><circle cx="40" cy="20" r="2.5" fill="#e8c8a0"/><circle cx="30" cy="26" r="11" fill="#d8b088"/><ellipse cx="30" cy="30" rx="5" ry="4" fill="#f0d8b8"/><circle cx="26" cy="24" r="1.5" fill="#3a2a1a"/><circle cx="34" cy="24" r="1.5" fill="#3a2a1a"/><ellipse cx="30" cy="29" rx="1.5" ry="1" fill="#3a2a1a"/><ellipse cx="30" cy="45" rx="12" ry="11" fill="#d8b088"/><ellipse cx="30" cy="46" rx="7" ry="7" fill="#f0d8b8"/>'; break;
        case "clock": inner = shadow + '<rect x="18" y="8" width="24" height="46" rx="3" fill="#8a5a30"/><rect x="18" y="8" width="24" height="6" rx="3" fill="#a06a3a"/><circle cx="30" cy="20" r="8" fill="#f8ecc8"/><circle cx="30" cy="20" r="7" fill="#fdf8e0"/><line x1="30" y1="20" x2="30" y2="15" stroke="#3a2a1a" stroke-width="1.5"/><line x1="30" y1="20" x2="34" y2="22" stroke="#3a2a1a" stroke-width="1.5"/><rect x="22" y="32" width="16" height="18" rx="2" fill="#5a3a20"/><ellipse cx="30" cy="42" rx="4" ry="4" fill="#e8c86a"/><line x1="30" y1="32" x2="30" y2="42" stroke="#e8c86a" stroke-width="1"/>'; break;
        case "lantern": inner = shadow + '<rect x="18" y="12" width="24" height="4" rx="1" fill="#8a3a2a"/><ellipse cx="30" cy="32" rx="14" ry="16" fill="#d8483a"/><ellipse cx="30" cy="32" rx="14" ry="16" fill="none" stroke="#a03020" stroke-width="1.5"/><line x1="30" y1="16" x2="30" y2="48" stroke="#a03020" stroke-width="1" opacity=".5"/><path d="M16 28 Q30 24 44 28" stroke="#a03020" stroke-width="1" fill="none" opacity=".5"/><path d="M16 36 Q30 40 44 36" stroke="#a03020" stroke-width="1" fill="none" opacity=".5"/><rect x="22" y="48" width="16" height="3" rx="1" fill="#8a3a2a"/><line x1="26" y1="51" x2="25" y2="57" stroke="#e8b050" stroke-width="1.5"/><line x1="30" y1="51" x2="30" y2="58" stroke="#e8b050" stroke-width="1.5"/><line x1="34" y1="51" x2="35" y2="57" stroke="#e8b050" stroke-width="1.5"/>'; break;
        case "camera": inner = shadow + '<rect x="10" y="22" width="40" height="26" rx="3" fill="#4a4a52"/><rect x="10" y="22" width="40" height="6" rx="3" fill="#5a5a62"/><rect x="22" y="16" width="16" height="6" rx="1" fill="#3a3a42"/><circle cx="30" cy="36" r="9" fill="#2a2a32"/><circle cx="30" cy="36" r="7" fill="#5a6a80"/><circle cx="30" cy="36" r="4" fill="#3a4a60"/><circle cx="28" cy="33" r="1.5" fill="#b8d0e8"/><rect x="38" y="26" width="6" height="4" rx="1" fill="#e8d878"/>'; break;
        case "gramophone": inner = shadow + '<rect x="14" y="30" width="30" height="22" rx="2.5" fill="#7a4a20"/><rect x="14" y="30" width="30" height="3" rx="1.5" fill="#a87048"/><path d="M28 30 L36 12 L48 8 Q52 14 44 20 Z" fill="#c99460"/><path d="M36 12 Q42 12 44 18 Q40 22 34 20 Z" fill="#a87048"/><circle cx="24" cy="42" r="5" fill="#3a2a1a"/><circle cx="24" cy="42" r="1.6" fill="#c99460"/><rect x="16" y="52" width="4" height="3" fill="#5a3a20"/><rect x="38" y="52" width="4" height="3" fill="#5a3a20"/>'; break;
        case "telescope": inner = shadow + '<path d="M22 54 L30 26 M30 54 L30 26 M38 54 L30 26" stroke="#6a7280" stroke-width="2.6" stroke-linecap="round"/><rect x="22" y="20" width="22" height="7" rx="3" fill="#8a9298" transform="rotate(-25 30 22)"/><rect x="38" y="12" width="10" height="5" rx="2" fill="#5a6268" transform="rotate(-25 30 22)"/><circle cx="26" cy="26" r="4" fill="#5a6268"/><circle cx="26" cy="26" r="2" fill="#b8d0e8"/>'; break;
        case "flowerstand": inner = shadow + '<rect x="14" y="14" width="3.4" height="40" fill="#a06a3a"/><rect x="42.6" y="14" width="3.4" height="40" fill="#a06a3a"/><rect x="14" y="18" width="32" height="3" rx="1" fill="#c99460"/><rect x="14" y="32" width="32" height="3" rx="1" fill="#c99460"/><rect x="14" y="46" width="32" height="3" rx="1" fill="#c99460"/><ellipse cx="24" cy="16" rx="6" ry="2" fill="#6fa858"/><circle cx="20" cy="12" r="3.4" fill="#f272a8"/><circle cx="28" cy="12" r="3" fill="#ffd24a"/><ellipse cx="38" cy="42" rx="5" ry="2" fill="#6fa858"/><circle cx="38" cy="38" r="3" fill="#e8566a"/><path d="M22 18 Q24 26 20 32" stroke="#5fa840" stroke-width="1.4" fill="none"/>'; break;
        case "sculpture": inner = shadow + '<path d="M20 54 Q14 40 24 30 Q30 26 34 22 Q42 26 40 38 Q38 48 34 54 Z" fill="#a8a098"/><path d="M20 54 Q18 44 24 34" stroke="rgba(60,60,60,.28)" stroke-width="1.6" fill="none"/><path d="M34 24 Q40 30 38 40" stroke="rgba(255,255,255,.28)" stroke-width="1.4" fill="none"/><ellipse cx="30" cy="54" rx="14" ry="2.4" fill="#7a7268"/>'; break;
        case "well": inner = shadow + '<ellipse cx="30" cy="50" rx="20" ry="7" fill="#5a5048"/><ellipse cx="30" cy="48" rx="18" ry="5.6" fill="#3a3028"/><path d="M12 48 L12 32 Q30 26 48 32 L48 48" fill="#8a7a6a" stroke="#5a5048" stroke-width="1.4"/><line x1="14" y1="36" x2="46" y2="36" stroke="#5a5048" stroke-width="1"/><line x1="14" y1="42" x2="46" y2="42" stroke="#5a5048" stroke-width="1"/><line x1="14" y1="47" x2="46" y2="47" stroke="#5a5048" stroke-width="1"/><rect x="14" y="16" width="3" height="16" fill="#7a4a20"/><rect x="43" y="16" width="3" height="16" fill="#7a4a20"/><rect x="12" y="12" width="36" height="4" rx="1.5" fill="#a87048"/><path d="M30 14 L30 40" stroke="#3a2a1a" stroke-width="1"/><rect x="26" y="36" width="8" height="6" rx="1" fill="#a87048"/>'; break;
        case "scarecrow": inner = shadow + '<rect x="28.4" y="20" width="3.2" height="34" fill="#8a5a30"/><rect x="14" y="30" width="32" height="3" rx="1" fill="#8a5a30"/><path d="M22 26 L30 16 L38 26 L38 46 L22 46 Z" fill="#c99460"/><path d="M22 30 L14 30 M38 30 L46 30" stroke="#8a5a30" stroke-width="2.4" stroke-linecap="round"/><circle cx="30" cy="24" r="4.6" fill="#e8c86a"/><circle cx="28" cy="23" r="0.7" fill="#3a2a1a"/><circle cx="32" cy="23" r="0.7" fill="#3a2a1a"/><path d="M18 24 Q30 18 42 24 L40 20 Q30 14 20 20 Z" fill="#a87048"/><path d="M30 46 L30 52" stroke="#8a5a30" stroke-width="2"/><path d="M26 52 L30 48 L34 52" stroke="#8a5a30" stroke-width="2" fill="none"/>'; break;
        case "giftbox": inner = shadow + '<rect x="14" y="26" width="32" height="26" rx="2" fill="#e8566a"/><rect x="14" y="26" width="32" height="4" rx="1.6" fill="#f07080"/><rect x="26" y="26" width="8" height="26" fill="#e8c86a"/><rect x="14" y="36" width="32" height="4" fill="#e8c86a"/><path d="M26 26 Q20 18 26 14 Q30 14 30 22" fill="#e8c86a"/><path d="M34 26 Q40 18 34 14 Q30 14 30 22" fill="#e8c86a"/><circle cx="30" cy="22" r="2.4" fill="#c99460"/>'; break;
        case "mushroomlamp": inner = shadow + '<path d="M24 54 L24 38 Q22 34 22 30 Q22 22 30 20 Q38 22 38 30 Q38 34 36 38 L36 54 Z" fill="#f0e0c0"/><path d="M14 22 Q14 10 30 10 Q46 10 46 22 Z" fill="#e8566a"/><ellipse cx="30" cy="22" rx="16" ry="3" fill="#c04050"/><circle cx="22" cy="16" r="2.4" fill="#fff6dc"/><circle cx="34" cy="14" r="2" fill="#fff6dc"/><circle cx="40" cy="18" r="1.6" fill="#fff6dc"/><ellipse cx="30" cy="28" rx="9" ry="3" fill="#fff4b0" opacity=".5"/>'; break;
        case "toyhorse": inner = shadow + '<path d="M10 52 Q30 46 50 52" stroke="#8a5a30" stroke-width="2.6" fill="none" stroke-linecap="round"/><rect x="26" y="34" width="8" height="14" rx="2" fill="#c99460"/><ellipse cx="30" cy="30" rx="9" ry="7" fill="#c99460"/><ellipse cx="30" cy="28" rx="7" ry="5" fill="#e0b07a"/><path d="M22 28 Q26 18 32 22" fill="#c99460"/><path d="M22 28 L20 24 L24 25 Z" fill="#a87048"/><circle cx="27" cy="26" r="1" fill="#3a2a1a"/><path d="M34 22 Q40 20 40 26" stroke="#8a5a30" stroke-width="1.8" fill="none"/><path d="M20 36 L24 32 M40 36 L36 32" stroke="#8a5a30" stroke-width="1.8" stroke-linecap="round"/>'; break;
        case "globe": inner = shadow + '<ellipse cx="30" cy="55" rx="12" ry="2.6" fill="#5a3a20"/><path d="M22 54 L30 44 L38 54 Z" fill="#8a5a30"/><path d="M18 52 L42 52" stroke="#5a3a20" stroke-width="2" stroke-linecap="round"/><circle cx="30" cy="26" r="18" fill="#5a90e0"/><path d="M14 22 Q30 18 46 22 M14 32 Q30 28 46 32 M22 12 Q26 26 22 42 M38 12 Q34 26 38 42" stroke="#a8c8e0" stroke-width="1" fill="none" opacity=".7"/><circle cx="24" cy="22" r="3.4" fill="#7ec860"/><circle cx="38" cy="30" r="3" fill="#8fc47a"/><circle cx="34" cy="14" r="2.4" fill="#a8c8e0"/><path d="M18 26 L42 26" stroke="#3a2a1a" stroke-width="0.8" fill="none" opacity=".5"/>'; break;
        case "starlamp": inner = shadow + '<rect x="29" y="30" width="2" height="25" fill="#4a5060"/><ellipse cx="30" cy="55" rx="7" ry="2" fill="#3a4050"/><path d="M30 8 L33 20 L45 22 L36 30 L39 42 L30 36 L21 42 L24 30 L15 22 L27 20 Z" fill="#ffd45a"/><circle cx="30" cy="24" r="4" fill="#fff8d0"/><circle cx="30" cy="24" r="7" fill="#fff8d0" opacity=".4"/>'; break;
        case "fireplace": inner = shadow + '<rect x="8" y="14" width="44" height="42" rx="2" fill="#8a7a6a"/><rect x="8" y="14" width="44" height="8" rx="2" fill="#9a8a78"/><line x1="8" y1="26" x2="52" y2="26" stroke="#6a5a4a" stroke-width="1"/><line x1="8" y1="36" x2="52" y2="36" stroke="#6a5a4a" stroke-width="1"/><line x1="8" y1="46" x2="52" y2="46" stroke="#6a5a4a" stroke-width="1"/><line x1="20" y1="22" x2="20" y2="26" stroke="#6a5a4a" stroke-width="1"/><line x1="36" y1="22" x2="36" y2="26" stroke="#6a5a4a" stroke-width="1"/><line x1="28" y1="36" x2="28" y2="46" stroke="#6a5a4a" stroke-width="1"/><rect x="18" y="34" width="24" height="22" rx="2" fill="#2a1a10"/><path d="M30 48 C 26 44 26 40 30 36 C 34 40 34 44 30 48 Z" fill="#ff8a3a"/><path d="M30 46 C 28 43 28 41 30 39 C 32 41 32 43 30 46 Z" fill="#ffd45a"/><rect x="20" y="50" width="8" height="3" rx="1" fill="#5a3a20" transform="rotate(-10 24 51)"/><rect x="32" y="50" width="8" height="3" rx="1" fill="#5a3a20" transform="rotate(10 36 51)"/>'; break;
        case "piano": inner = shadow + '<rect x="10" y="24" width="40" height="30" rx="2" fill="#3a2a1a"/><rect x="10" y="24" width="40" height="4" rx="2" fill="#4a3a2a"/><rect x="14" y="30" width="32" height="10" fill="#f8f4e8"/><line x1="18" y1="30" x2="18" y2="40" stroke="#3a2a1a" stroke-width="0.8"/><line x1="22" y1="30" x2="22" y2="40" stroke="#3a2a1a" stroke-width="0.8"/><line x1="26" y1="30" x2="26" y2="40" stroke="#3a2a1a" stroke-width="0.8"/><line x1="30" y1="30" x2="30" y2="40" stroke="#3a2a1a" stroke-width="0.8"/><line x1="34" y1="30" x2="34" y2="40" stroke="#3a2a1a" stroke-width="0.8"/><line x1="38" y1="30" x2="38" y2="40" stroke="#3a2a1a" stroke-width="0.8"/><line x1="42" y1="30" x2="42" y2="40" stroke="#3a2a1a" stroke-width="0.8"/><rect x="19" y="30" width="2" height="6" fill="#1a1a1a"/><rect x="25" y="30" width="2" height="6" fill="#1a1a1a"/><rect x="31" y="30" width="2" height="6" fill="#1a1a1a"/><rect x="37" y="30" width="2" height="6" fill="#1a1a1a"/><rect x="12" y="54" width="3" height="3" fill="#2a1a10"/><rect x="45" y="54" width="3" height="3" fill="#2a1a10"/>'; break;
        case "fountain": inner = '<ellipse cx="30" cy="50" rx="24" ry="7" fill="rgba(30,80,110,.24)"/><ellipse cx="30" cy="46" rx="22" ry="8" fill="#a09080"/><ellipse cx="30" cy="44" rx="20" ry="7" fill="#7ab8d0"/><ellipse cx="30" cy="43" rx="17" ry="5.6" fill="#a0d8e8"/><path d="M30 40 L28 26 Q30 22 32 26 L30 40" stroke="#a09080" stroke-width="2" fill="none"/><path d="M22 32 Q30 18 38 32" stroke="#a09080" stroke-width="1.6" fill="none"/><ellipse cx="26" cy="38" rx="3" ry="1.6" fill="#c0e8f4"/><ellipse cx="34" cy="40" rx="2.6" ry="1.4" fill="#c0e8f4"/><circle cx="24" cy="45" r="1.2" fill="#e8c86a"/><circle cx="36" cy="46" r="1" fill="#c99460"/>'; break;

        // ===== 桌面小物 =====
        case "cup": inner = '<ellipse cx="30" cy="50" rx="13" ry="3" fill="rgba(60,50,40,.16)"/><path d="M19 30 L21.5 47 Q22.5 51 30 51 Q37.5 51 38.5 47 L41 30 Z" fill="#fdf8ee"/><path d="M19 30 L41 30 L40 36 L20 36 Z" fill="#f5ece0"/><ellipse cx="30" cy="30" rx="11" ry="4" fill="#efe3d0"/><ellipse cx="30" cy="30" rx="8.4" ry="2.8" fill="#a8703a"/><path d="M41 34 Q47 34 47 39 Q47 44 41 44" stroke="#fdf8ee" stroke-width="2.6" fill="none" stroke-linecap="round"/>'; break;
        case "coffeecup": inner = '<ellipse cx="30" cy="50" rx="12" ry="2.6" fill="rgba(60,40,30,.20)"/><ellipse cx="30" cy="49" rx="11" ry="2.4" fill="#efe3d0"/><path d="M20 32 L22 46 Q22.6 49 30 49 Q37.4 49 38 46 L40 32 Z" fill="#f0e0c0"/><ellipse cx="30" cy="32" rx="10" ry="3.4" fill="#e0cba8"/><ellipse cx="30" cy="32" rx="7.6" ry="2.4" fill="#6a4020"/><path d="M40 36 Q46 36 46 41 Q46 46 40 46" stroke="#f0e0c0" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="27" cy="33" r="1.6" fill="#3a2a1a"/><circle cx="33" cy="33" r="1.6" fill="#3a2a1a"/>'; break;
        case "teapot": inner = '<ellipse cx="30" cy="50" rx="14" ry="3" fill="rgba(60,50,40,.20)"/><path d="M18 34 Q18 26 30 26 Q42 26 42 34 Q42 46 30 46 Q18 46 18 34 Z" fill="#a8c8e0"/><ellipse cx="30" cy="26" rx="9" ry="2.6" fill="#c0d8e8"/><ellipse cx="30" cy="26" rx="4" ry="1.4" fill="#7a9ab0"/><path d="M42 32 Q48 32 48 38 Q48 42 42 42" stroke="#a8c8e0" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M18 32 Q12 30 12 36" stroke="#a8c8e0" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="12" cy="37" r="1.4" fill="#a8c8e0"/>'; break;
        case "bookstack": inner = '<ellipse cx="30" cy="50" rx="14" ry="3" fill="rgba(60,50,40,.16)"/><rect x="16" y="41" width="28" height="8" rx="1.5" fill="#5a90e0"/><rect x="18" y="34" width="26" height="7" rx="1.5" fill="#e05a5a"/><rect x="17" y="27" width="24" height="7" rx="1.5" fill="#e0b050"/><rect x="20" y="42.5" width="20" height="1.2" fill="rgba(255,255,255,.5)"/><rect x="22" y="35.5" width="18" height="1.2" fill="rgba(255,255,255,.5)"/>'; break;
        case "succulent": inner = '<ellipse cx="30" cy="52" rx="11" ry="3" fill="rgba(60,50,40,.16)"/><path d="M20 36 L22 50 Q23 52 30 52 Q37 52 38 50 L40 36 Z" fill="#d49a68"/><ellipse cx="30" cy="36" rx="10" ry="3" fill="#b8814a"/><ellipse cx="30" cy="33" rx="3.2" ry="5.4" fill="#7ec860"/><ellipse cx="23" cy="35" rx="3.6" ry="4.6" fill="#8fd470" transform="rotate(-32 23 35)"/><ellipse cx="37" cy="35" rx="3.6" ry="4.6" fill="#8fd470" transform="rotate(32 37 35)"/><ellipse cx="30" cy="38" rx="6" ry="3.2" fill="#6cb858"/><circle cx="30" cy="32" r="1.8" fill="#fff" opacity=".4"/>'; break;
        case "cactus": inner = '<ellipse cx="30" cy="52" rx="10" ry="2.4" fill="rgba(60,40,30,.20)"/><path d="M21 38 L22 50 Q22.6 52 30 52 Q37.4 52 38 50 L39 38 Z" fill="#d49a68"/><ellipse cx="30" cy="38" rx="9" ry="2.6" fill="#b8814a"/><ellipse cx="30" cy="30" rx="4.6" ry="9" fill="#7ec860"/><ellipse cx="22" cy="32" rx="3" ry="5" fill="#8fd470" transform="rotate(-22 22 32)"/><ellipse cx="38" cy="33" rx="3" ry="4.6" fill="#8fd470" transform="rotate(22 38 33)"/><ellipse cx="30" cy="28" rx="1.8" ry="3.4" fill="#a0e08a" opacity=".5"/>'; break;
        case "bowl": inner = '<ellipse cx="30" cy="50" rx="14" ry="3" fill="rgba(60,50,40,.16)"/><circle cx="22" cy="38" r="6" fill="#e8564a"/><circle cx="31" cy="36" r="6.4" fill="#f09238"/><circle cx="39" cy="39" r="5.4" fill="#8cc45a"/><path d="M14 41 Q30 57 46 41 Z" fill="#d8c8a8"/><ellipse cx="30" cy="41" rx="16" ry="4" fill="#e8dcc0"/><ellipse cx="30" cy="41.5" rx="12" ry="2.6" fill="#d0c0a0"/>'; break;
        case "cake": inner = '<ellipse cx="30" cy="50" rx="12" ry="3" fill="rgba(60,50,40,.20)"/><ellipse cx="30" cy="49" rx="13" ry="3" fill="#f8f0e0"/><path d="M17 32 L43 32 L41 46 Q40 48 30 48 Q20 48 19 46 Z" fill="#f8e0c8"/><path d="M18 32 L42 32 L42 36 Q30 39 18 36 Z" fill="#f0c8a8"/><path d="M22 26 Q22 20 30 20 Q38 20 38 26 Q38 32 30 32 Q22 32 22 26 Z" fill="#f8e0c8"/><circle cx="30" cy="19" r="3.4" fill="#e8566a"/><circle cx="29" cy="18" r="1" fill="#c04050"/>'; break;
        case "vase": inner = '<ellipse cx="30" cy="52" rx="11" ry="3" fill="rgba(60,50,40,.16)"/><path d="M25 28 L23 45 Q23 53 30 53 Q37 53 37 45 L35 28 Z" fill="#a8c8e0"/><ellipse cx="30" cy="28" rx="5" ry="2" fill="#8fb0cc"/><path d="M30 28 L30 15" stroke="#6fa858" stroke-width="2" stroke-linecap="round"/><path d="M30 21 Q24 19 22 12" stroke="#6fa858" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M30 19 Q36 17 38 11" stroke="#6fa858" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="21.5" cy="11" r="3.4" fill="#f272a8"/><circle cx="38.5" cy="10" r="3.2" fill="#ffd24a"/><circle cx="30" cy="13" r="3" fill="#e8566a"/>'; break;
        case "tealamp": inner = '<ellipse cx="30" cy="52" rx="12" ry="3" fill="rgba(60,50,40,.16)"/><ellipse cx="30" cy="50" rx="9" ry="3" fill="#6a7080"/><rect x="28.5" y="30" width="3" height="20" fill="#7a8290"/><path d="M18 30 L22 17 L38 17 L42 30 Z" fill="#f0c86a"/><path d="M18 30 L42 30 L42 32 L18 32 Z" fill="#d8a84a"/><ellipse cx="30" cy="35" rx="13" ry="5" fill="#fff4b0" opacity=".45"/>'; break;
        case "fishbowl": inner = '<ellipse cx="30" cy="52" rx="13" ry="2.8" fill="rgba(60,50,40,.22)"/><ellipse cx="30" cy="50" rx="13" ry="2.4" fill="#a8c8e0"/><circle cx="30" cy="34" r="15" fill="#b8e0f0" opacity=".82"/><circle cx="30" cy="34" r="15" fill="none" stroke="#a8c8e0" stroke-width="1.4"/><path d="M22 40 Q30 46 38 40" stroke="#7ab8d0" stroke-width="1" fill="none" opacity=".7"/><ellipse cx="25" cy="34" rx="5" ry="3" fill="#f09238"/><path d="M20 32 L18 30 L18 36 Z" fill="#f09238"/><circle cx="23" cy="33" r="0.8" fill="#3a2a1a"/><ellipse cx="36" cy="38" rx="4" ry="2.4" fill="#e8566a"/><path d="M40 37 L42 35 L42 39 Z" fill="#e8566a"/><circle cx="37.5" cy="37.4" r="0.7" fill="#3a2a1a"/><ellipse cx="27" cy="22" rx="4" ry="2" fill="rgba(255,255,255,.5)"/>'; break;
        case "clockmini": inner = '<ellipse cx="30" cy="50" rx="13" ry="2.6" fill="rgba(60,50,40,.20)"/><circle cx="30" cy="32" r="15" fill="#a87048"/><circle cx="30" cy="32" r="13" fill="#fdf8ec"/><circle cx="30" cy="32" r="13" fill="none" stroke="#e0c8a0" stroke-width="0.8"/><line x1="30" y1="32" x2="30" y2="23" stroke="#3a2a1a" stroke-width="1.6" stroke-linecap="round"/><line x1="30" y1="32" x2="36" y2="36" stroke="#3a2a1a" stroke-width="1.6" stroke-linecap="round"/><circle cx="30" cy="32" r="1.4" fill="#a87048"/><path d="M21 42 L24 50 L19 50 Z" fill="#a87048"/><path d="M39 42 L36 50 L41 50 Z" fill="#a87048"/><circle cx="30" cy="15" r="1.6" fill="#a87048"/>'; break;
        case "jar": inner = '<ellipse cx="30" cy="52" rx="11" ry="2.4" fill="rgba(60,50,40,.20)"/><path d="M22 22 L22 48 Q22 52 30 52 Q38 52 38 48 L38 22 Z" fill="#d8e8f0" opacity=".82"/><path d="M22 22 L22 48 Q22 52 30 52 Q38 52 38 48 L38 22 Z" fill="none" stroke="#a8c8e0" stroke-width="1.4"/><rect x="20" y="18" width="20" height="5" rx="2" fill="#c99460"/><circle cx="26" cy="42" r="2.4" fill="#e8566a"/><circle cx="34" cy="44" r="2" fill="#f0c85a"/><circle cx="30" cy="38" r="2.2" fill="#7ec860"/><circle cx="24" cy="34" r="1.8" fill="#f09238"/><ellipse cx="26" cy="26" rx="3" ry="1.6" fill="rgba(255,255,255,.6)"/>'; break;
        case "incense": inner = '<ellipse cx="30" cy="50" rx="11" ry="2.6" fill="rgba(60,50,40,.20)"/><ellipse cx="30" cy="48" rx="10" ry="2.6" fill="#c99460"/><ellipse cx="30" cy="47" rx="8" ry="2" fill="#a87048"/><rect x="28.6" y="30" width="2.8" height="18" fill="#e8d8c0"/><ellipse cx="30" cy="30" rx="2" ry="1.4" fill="#f09238"/><path d="M30 28 Q26 22 32 16 Q34 12 30 8" stroke="rgba(220,200,180,.7)" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M31 26 Q34 20 29 15" stroke="rgba(220,200,180,.5)" stroke-width="1.2" fill="none" stroke-linecap="round"/>'; break;
        case "music": inner = '<ellipse cx="30" cy="52" rx="13" ry="3" fill="rgba(60,50,40,.16)"/><rect x="16" y="34" width="28" height="16" rx="3" fill="#8a5a3a"/><rect x="16" y="34" width="28" height="4" rx="2" fill="#a87048"/><circle cx="30" cy="44" r="5.5" fill="#e8c86a"/><circle cx="30" cy="44" r="2.2" fill="#8a5a3a"/><path d="M18 30 Q30 23 42 30" stroke="#c99460" stroke-width="1.6" fill="none"/><circle cx="30" cy="28" r="1.6" fill="#c99460"/>'; break;

        // ===== 墙面 =====
        case "wallclock": inner = '<circle cx="30" cy="31" r="19" fill="#c99460"/><circle cx="30" cy="31" r="16" fill="#fdf8ec"/><circle cx="30" cy="31" r="16" fill="none" stroke="#e0c8a0" stroke-width="1"/><line x1="30" y1="31" x2="30" y2="20" stroke="#3a2a1a" stroke-width="2" stroke-linecap="round"/><line x1="30" y1="31" x2="38" y2="35" stroke="#3a2a1a" stroke-width="2" stroke-linecap="round"/><circle cx="30" cy="31" r="1.8" fill="#c99460"/><circle cx="30" cy="17" r="1" fill="#b89a6a"/><circle cx="44" cy="31" r="1" fill="#b89a6a"/><circle cx="30" cy="45" r="1" fill="#b89a6a"/><circle cx="16" cy="31" r="1" fill="#b89a6a"/>'; break;
        case "photo": inner = '<rect x="16" y="13" width="28" height="35" rx="2" fill="#d8b088"/><rect x="19" y="16" width="22" height="25" fill="#f4ece0"/><circle cx="30" cy="25" r="5" fill="#a8c8e0"/><path d="M19 41 Q30 31 41 41 Z" fill="#8fc47a"/><rect x="16" y="13" width="28" height="35" rx="2" fill="none" stroke="#a87a4a" stroke-width="1.4"/><path d="M16 48 L22 48 L22 52 L16 52 Z" fill="#c0a070" opacity=".7"/>'; break;
        case "curtain": inner = '<rect x="6" y="6" width="48" height="4.5" rx="2" fill="#a06a3a"/><path d="M10 10.5 Q15 32 10 56 L23 56 Q21 32 23 10.5 Z" fill="#e8c8d0"/><path d="M50 10.5 Q45 32 50 56 L37 56 Q39 32 37 10.5 Z" fill="#e8c8d0"/><path d="M16 12 Q19 32 16 54" stroke="#d8b0bc" stroke-width="1.1" fill="none"/><path d="M44 12 Q41 32 44 54" stroke="#d8b0bc" stroke-width="1.1" fill="none"/><path d="M23 10.5 L23 56" stroke="#d0a8b4" stroke-width="1.2" fill="none"/><path d="M37 10.5 L37 56" stroke="#d0a8b4" stroke-width="1.2" fill="none"/>'; break;
        case "calendar": inner = '<rect x="12" y="12" width="36" height="38" rx="2" fill="#fdf8ec"/><rect x="12" y="12" width="36" height="9" rx="2" fill="#e8566a"/><rect x="12" y="16" width="36" height="5" fill="#e8566a"/><path d="M20 8 L20 15 M40 8 L40 15" stroke="#7a4a20" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="28" r="2" fill="#e8c86a"/><circle cx="28" cy="28" r="2" fill="#e8c86a"/><circle cx="36" cy="28" r="2" fill="#e8c86a"/><circle cx="20" cy="36" r="2" fill="#a8c8e0"/><circle cx="28" cy="36" r="2" fill="#7ec860"/><circle cx="36" cy="36" r="2" fill="#e8c86a"/><circle cx="20" cy="44" r="2" fill="#a8c8e0"/><circle cx="28" cy="44" r="2" fill="#a8c8e0"/><circle cx="36" cy="44" r="2" fill="#e8566a"/>'; break;
        case "painting": inner = '<rect x="9" y="12" width="42" height="36" rx="2.5" fill="#b88050"/><rect x="12.5" y="15.5" width="35" height="29" fill="#cfe8f4"/><circle cx="39" cy="23" r="4.5" fill="#ffe08a"/><path d="M12.5 44.5 L24 27 L32 37 L40 25 L47.5 44.5 Z" fill="#8fc47a"/><path d="M12.5 44.5 L22 33 L28 40 L34 32 L47.5 44.5 Z" fill="#6fa858"/><rect x="9" y="12" width="42" height="36" rx="2.5" fill="none" stroke="#8a5a30" stroke-width="1.6"/>'; break;
        case "walllamp": inner = '<rect x="27" y="12" width="6" height="9" rx="1" fill="#6a7080"/><path d="M17 23 L43 23 L38 36 L22 36 Z" fill="#7a8090"/><path d="M22 36 L38 36 L38 38.5 L22 38.5 Z" fill="#5a6270"/><ellipse cx="30" cy="42" rx="11" ry="5.5" fill="#fff4b0" opacity=".5"/><circle cx="30" cy="39" r="4" fill="#fff8d0"/><circle cx="30" cy="39" r="7" fill="#fff8d0" opacity=".35"/>'; break;
        case "wreath": inner = '<circle cx="30" cy="31" r="18" fill="none" stroke="#6fa858" stroke-width="7"/><circle cx="30" cy="31" r="18" fill="none" stroke="#8cc06e" stroke-width="3.6"/><circle cx="30" cy="13" r="3.6" fill="#e8566a"/><circle cx="44" cy="24" r="3" fill="#f2a0b8"/><circle cx="42" cy="43" r="3.2" fill="#ffd24a"/><circle cx="20" cy="45" r="3" fill="#f272a8"/><circle cx="15" cy="25" r="3.2" fill="#fff4dc"/><circle cx="30" cy="49" r="3" fill="#e8a0c0"/><path d="M27 48 L30 55 L33 48 Z" fill="#e8566a"/>'; break;
        case "mirrorwall": inner = '<ellipse cx="30" cy="30" rx="20" ry="24" fill="#a87048"/><ellipse cx="30" cy="30" rx="17" ry="21" fill="#c8e0ec"/><ellipse cx="30" cy="30" rx="17" ry="21" fill="none" stroke="#a8c8e0" stroke-width="0.8"/><path d="M20 26 Q20 14 28 12" stroke="#fff" stroke-width="2.4" fill="none" opacity=".7" stroke-linecap="round"/><circle cx="30" cy="4" r="1.6" fill="#7a4a20"/>'; break;
        case "noteboard": inner = '<rect x="10" y="12" width="40" height="34" rx="2" fill="#c99460"/><rect x="12" y="14" width="36" height="30" fill="#e0c8a8"/><rect x="16" y="20" width="10" height="10" fill="#fff4b0" transform="rotate(-6 21 25)"/><rect x="32" y="22" width="10" height="10" fill="#a8e0c0" transform="rotate(8 37 27)"/><rect x="22" y="32" width="10" height="8" fill="#f0c8d8" transform="rotate(-4 27 36)"/><circle cx="21" cy="20" r="1.2" fill="#e8566a"/><circle cx="37" cy="22" r="1.2" fill="#7ec860"/><circle cx="27" cy="32" r="1.2" fill="#f09238"/>'; break;
        case "dryflower": inner = '<path d="M30 6 L30 22" stroke="#a87048" stroke-width="1.4"/><path d="M22 12 Q30 8 38 12" stroke="#a87048" stroke-width="1.2" fill="none"/><path d="M30 14 L22 26 M30 14 L30 26 M30 14 L38 26" stroke="#8a6a48" stroke-width="1" fill="none"/><ellipse cx="22" cy="28" rx="3" ry="5" fill="#c288a0"/><ellipse cx="30" cy="30" rx="3" ry="6" fill="#c890a8"/><ellipse cx="38" cy="28" rx="3" ry="5" fill="#c288a0"/><ellipse cx="25" cy="24" rx="3" ry="4" fill="#e8b0c0" transform="rotate(-20 25 24)"/><ellipse cx="35" cy="24" rx="3" ry="4" fill="#e8b0c0" transform="rotate(20 35 24)"/>'; break;
        case "photowall": inner = '<rect x="8" y="10" width="14" height="12" rx="1" fill="#c99460" transform="rotate(-4 15 16)"/><rect x="24" y="8" width="12" height="14" rx="1" fill="#e8d8b8"/><rect x="38" y="12" width="14" height="12" rx="1" fill="#a87048" transform="rotate(3 45 18)"/><rect x="10" y="26" width="12" height="14" rx="1" fill="#e8d8b8"/><rect x="26" y="28" width="14" height="12" rx="1" fill="#c99460"/><rect x="36" y="30" width="12" height="12" rx="1" fill="#e8d8b8" transform="rotate(-5 42 36)"/><rect x="14" y="44" width="12" height="10" rx="1" fill="#a87048"/><rect x="30" y="44" width="14" height="10" rx="1" fill="#c99460"/><circle cx="15" cy="16" r="2" fill="#a8c8e0"/><path d="M10 22 L18 18 L22 22 Z" fill="#8fc47a"/><circle cx="30" cy="14" r="2" fill="#e8566a"/><path d="M25 20 L30 15 L35 20 Z" fill="#f0c85a"/>'; break;
        case "windchime": inner = '<circle cx="30" cy="6" r="3" fill="#a87048"/><path d="M30 9 L30 14" stroke="#8a5a30" stroke-width="1"/><ellipse cx="30" cy="14" rx="11" ry="2" fill="#c99460"/><path d="M20 16 L20 40 M26 16 L26 44 M30 16 L30 46 M34 16 L34 44 M40 16 L40 40" stroke="#a8c8e0" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="42" r="2" fill="#c99460"/><circle cx="26" cy="46" r="2" fill="#c99460"/><circle cx="30" cy="48" r="2" fill="#c99460"/><circle cx="34" cy="46" r="2" fill="#c99460"/><circle cx="40" cy="42" r="2" fill="#c99460"/><path d="M38 20 L42 30 L40 32 L42 42" stroke="#8a5a30" stroke-width="1" fill="none"/>'; break;
        case "balloon": inner = '<path d="M30 8 L30 24" stroke="#8a5a30" stroke-width="1"/><ellipse cx="30" cy="18" rx="10" ry="12" fill="#e8566a"/><ellipse cx="30" cy="18" rx="10" ry="12" fill="none" stroke="#c04050" stroke-width="0.8"/><path d="M30 30 L30 38" stroke="#8a5a30" stroke-width="0.8"/><path d="M30 38 Q26 42 30 46 Q34 50 30 54" stroke="#8a5a30" stroke-width="0.8" fill="none"/><ellipse cx="26" cy="14" rx="2.6" ry="3.6" fill="rgba(255,255,255,.5)"/><ellipse cx="30" cy="30" rx="2" ry="1.6" fill="#c04050"/>'; break;
        case "tapestry": inner = '<rect x="13" y="9" width="34" height="42" rx="2" fill="#c8a0b0"/><rect x="16.5" y="12.5" width="27" height="35" fill="#dbb8c8"/><path d="M23 26 L30 18 L37 26 L34 38 L26 38 Z" fill="#e8d0a0"/><circle cx="30" cy="27" r="3" fill="#a8789a"/><path d="M13 51 L47 51" stroke="#a8889a" stroke-width="1.6"/><path d="M16 51 L16 56 M20 51 L20 56 M24 51 L24 56 M28 51 L28 56 M32 51 L32 56 M36 51 L36 56 M40 51 L40 56 M44 51 L44 56" stroke="#c8a0b0" stroke-width="1.6" stroke-linecap="round"/>'; break;

        default: inner = shadow + '<rect x="18" y="18" width="24" height="24" rx="4" fill="#c9a06a"/>';
      }
      return svgWrap(inner, align === "wall" ? "xMidYMid meet" : null);
    }

    ctx.kit.every(function () {
      if (pref("autoAct", true) === false) return;
      if (kv.get("appOpen")) return;
      var lastId = kv.get("lastChar");
      if (!lastId) return;
      var st = loadSave(lastId);
      var now = Date.now();
      if (now - (st.lastVisit || 0) < 90000) return;
      var ps = ctx.personas.list() || [];
      var chp = ps.filter(function (p) { return p.id === lastId; })[0] || null;
      var ev = autoAct(st, chp);
      st.lastVisit = now;
      if (ev) addLog(st, ev.text);
      saveSave(lastId, st);
    }, 90000);

    var prevMove = null, prevUp = null;

    return ctx.ui.appPage(function (root, api) {
      root.style.position = "relative";
      root.style.width = "100%";
      root.style.height = "100%";
      root.style.overflow = "hidden";
      root.style.boxSizing = "border-box";
      root.style.fontFamily = '-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
      root.style.color = "#3f4a3d";
      root.style.WebkitTapHighlightColor = "transparent";
      kv.set("appOpen", true);

      if (prevMove) document.removeEventListener("pointermove", prevMove);
      if (prevUp) { document.removeEventListener("pointerup", prevUp); document.removeEventListener("pointercancel", prevUp); }

      var ch = null; var s = null;
      var view = "farm"; var currentScene = "pine";
      var shopTab = "seed"; var dexTab = "nature";
      var picking = -1; var detailPlot = -1;
      var bubble = ""; var flash = ""; var flashTimer = null;
      var lastExplore = ""; var offlineMsgs = []; var rendering = false;
      var fishing = { active: false, pos: 0, dir: 1, speed: 2.6, target: 50, width: 24, catchFish: null, result: null, hook: null, timer: null };

      var holding = null;
      var drag = { on: false, id: null, from: null, sx: 0, sy: 0, moved: false, ghost: null, hover: null, pid: null, cancelled: false };

      function h(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }
      function toast(t) { flash = t; if (flashTimer) clearTimeout(flashTimer); flashTimer = setTimeout(function () { flash = ""; render(); }, 2100); }
      function persist() { if (ch && s) saveSave(ch.id, s); }
      function say(kind, crop) {
        if (pref("showTalk", true) === false) return;
        var n = ch ? ch.name : "TA";
        var pool = LINES[kind] || LINES.idle;
        var t = pool[Math.floor(Math.random() * pool.length)];
        t = t.replace(/\{n\}/g, n).replace(/\{c\}/g, crop ? crop.name : "它");
        bubble = t;
      }
      function offlineResolve() {
        if (!ch || !s) return;
        var now = Date.now(); var gap = now - (s.lastVisit || now);
        if (gap < 60000) return;
        var times = Math.min(4, Math.floor(gap / 60000)); var out = [];
        for (var i = 0; i < times; i++) { var ev = autoAct(s, ch); if (ev) out.push(ev.text); }
        if (out.length) { out.forEach(function (t) { addLog(s, t); }); offlineMsgs = out; }
        s.lastVisit = now; persist();
      }

      function parseSlotEl(el) {
        var d = (el && el.dataset) ? el.dataset.slot : null;
        if (!d) return null;
        var p = String(d).split(":");
        return { area: p[0], idx: +p[1] };
      }
      function getSlotItem(area, idx) {
        if (area === "w") return s.wall[idx] || null;
        var sl = s.home[idx];
        if (!sl) return null;
        return sl.t || sl.b || null;
      }
      function resolveLayer(area, idx, f) {
        if (!f) return null;
        if (area === "w") return f.area === "wall" ? "wall" : null;
        if (f.area === "wall") return null;
        if (f.area === "surface") {
          var sl = s.home[idx];
          if (sl && sl.b && FURNMAP[sl.b] && FURNMAP[sl.b].top) return "t";
          return null;
        }
        return "b";
      }
      function removeFrom(from) {
        if (!from || from === "tray") return null;
        if (from.area === "w") {
          if (s.wall[from.idx] === from.id) s.wall[from.idx] = null;
          return null;
        }
        var sl = s.home[from.idx];
        if (!sl) return null;
        if (sl.t === from.id) {
          sl.t = null;
          if (!sl.b) s.home[from.idx] = null;
          return null;
        }
        if (sl.b === from.id) {
          var top = sl.t || null;
          sl.b = null; sl.t = null;
          s.home[from.idx] = null;
          return top;
        }
        return null;
      }
      function markCanDrop(id) {
        var f = FURNMAP[id]; if (!f) return;
        var cells = root.querySelectorAll("[data-slot]");
        for (var i = 0; i < cells.length; i++) {
          var pos = parseSlotEl(cells[i]);
          if (!pos) continue;
          if (resolveLayer(pos.area, pos.idx, f)) cells[i].classList.add("ft-can");
        }
      }
      function clearMarks() {
        var cells = root.querySelectorAll("[data-slot]");
        for (var i = 0; i < cells.length; i++) cells[i].classList.remove("ft-can", "ft-on", "ft-bad");
      }
      function updateHover(x, y) {
        var el = document.elementFromPoint(x, y);
        var cell = (el && el.closest) ? el.closest("[data-slot]") : null;
        if (cell === drag.hover) return;
        if (drag.hover) drag.hover.classList.remove("ft-on", "ft-bad");
        drag.hover = cell || null;
        if (!cell || !drag.id) return;
        var pos = parseSlotEl(cell); var f = FURNMAP[drag.id];
        if (!pos || !f) return;
        cell.classList.add(resolveLayer(pos.area, pos.idx, f) ? "ft-on" : "ft-bad");
      }
      function beginDrag(e, id, from) {
        if (!id || !FURNMAP[id]) return;
        drag.on = true; drag.id = id; drag.from = from;
        drag.sx = e.clientX; drag.sy = e.clientY;
        drag.moved = false; drag.ghost = null; drag.hover = null;
        drag.cancelled = false;
        drag.pid = (e.pointerId != null) ? e.pointerId : "m";
      }
      function cleanupDrag() {
        if (drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
        clearMarks();
        drag.on = false; drag.moved = false; drag.ghost = null;
        drag.hover = null; drag.id = null; drag.from = null; drag.pid = null;
      }
      function placeItem(id, from, area, idx) {
        var f = FURNMAP[id];
        if (!f) { holding = null; return; }
        var layer = resolveLayer(area, idx, f);
        if (!layer) { toast("这里放不下"); return; }

        var carriedTop = (from && typeof from === "object" && from.carriedTop) || null;
        if (!carriedTop && from && typeof from === "object" && from.area === "f") {
          var srcSl = s.home[from.idx];
          if (srcSl && srcSl.b === id && srcSl.t && FURNMAP[srcSl.t]) carriedTop = srcSl.t;
        }

        removeFrom(from);

        if (area === "w") {
          s.wall[idx] = id;
        } else {
          if (!s.home[idx]) s.home[idx] = { b: null, t: null };
          var sl = s.home[idx];
          if (layer === "t") {
            sl.t = id;
          } else {
            sl.b = id;
            if (!f.top) {
              sl.t = null;
            } else if (carriedTop && FURNMAP[carriedTop] && !sl.t) {
              sl.t = carriedTop;
            }
          }
        }

        holding = null;
        addLog(s, "摆上了" + f.name + (carriedTop && FURNMAP[carriedTop] ? "和" + FURNMAP[carriedTop].name : ""));
        if (pref("showTalk", true) !== false && Math.random() < 0.35) say("decorPut");
        toast("摆上了「" + f.name + "」" + (carriedTop && FURNMAP[carriedTop] ? "（连带" + FURNMAP[carriedTop].name + "）" : ""));
        persist(); render();
      }
      function tryPlaceAt(area, idx) {
        if (!holding || !FURNMAP[holding.id]) { holding = null; render(); return; }
        placeItem(holding.id, holding.from, area, idx);
      }
      function pickUp(area, idx) {
        var id = getSlotItem(area, idx);
        if (!id || !FURNMAP[id]) return;
        var from = { area: area, idx: idx, id: id };
        var carriedTop = null;
        if (area === "f") {
          var curSl = s.home[idx];
          if (curSl && curSl.b === id && curSl.t && FURNMAP[curSl.t]) carriedTop = curSl.t;
        }
        removeFrom(from);
        if (carriedTop) from.carriedTop = carriedTop;
        holding = { id: id, from: from };
        toast("拿起了「" + FURNMAP[id].name + "」" + (carriedTop ? "（连带" + FURNMAP[carriedTop].name + "）" : ""));
        persist(); render();
      }
      function returnHolding() {
        if (holding && holding.from && holding.from !== "tray" && FURNMAP[holding.id]) {
          var f = FURNMAP[holding.id];
          var lyr = resolveLayer(holding.from.area, holding.from.idx, f);
          if (lyr === "wall") s.wall[holding.from.idx] = holding.id;
          else if (lyr) {
            if (!s.home[holding.from.idx]) s.home[holding.from.idx] = { b: null, t: null };
            var sl2 = s.home[holding.from.idx];
            if (lyr === "t") sl2.t = holding.id;
            else {
              sl2.b = holding.id;
              if (f.top && holding.from.carriedTop && FURNMAP[holding.from.carriedTop] && !sl2.t) {
                sl2.t = holding.from.carriedTop;
              }
            }
          }
        }
        holding = null; persist(); render();
      }

      function onDocMove(e) {
        if (!drag.on || (drag.pid !== null && e.pointerId !== drag.pid)) return;
        var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        if (!drag.moved && dx * dx + dy * dy < 36) return;
        if (!drag.moved) {
          if (drag.from === "tray" && Math.abs(dx) > Math.abs(dy) + 2) {
            drag.cancelled = true;
            drag.on = false;
            return;
          }
          drag.moved = true;
          var g = document.createElement("div");
          g.style.cssText = "position:fixed;left:0;top:0;width:56px;height:56px;pointer-events:none;z-index:99999;transform:translate(-50%,-50%);filter:drop-shadow(0 10px 18px rgba(0,0,0,.3));opacity:.94;";
          g.innerHTML = furnSVG(drag.id, FURNMAP[drag.id] && FURNMAP[drag.id].area === "wall" ? "wall" : null);
          document.body.appendChild(g);
          drag.ghost = g;
          markCanDrop(drag.id);
        }
        if (drag.moved && e.preventDefault) e.preventDefault();
        if (drag.ghost) {
          drag.ghost.style.left = e.clientX + "px";
          drag.ghost.style.top = e.clientY + "px";
        }
        updateHover(e.clientX, e.clientY);
      }
      function onDocUp(e) {
        if (drag.cancelled) {
          if (drag.pid !== null && e.pointerId !== drag.pid) return;
          drag.cancelled = false;
          drag.on = false; drag.moved = false;
          if (drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
          drag.ghost = null; drag.hover = null;
          drag.id = null; drag.from = null; drag.pid = null;
          clearMarks();
          return;
        }

        var wasDragging = drag.on;
        var moved = drag.moved;
        var hoverEl = drag.hover;
        var id = drag.id, from = drag.from;
        if (wasDragging && drag.pid !== null && e.pointerId !== drag.pid) return;
        if (wasDragging) cleanupDrag();

        if (moved && hoverEl) {
          var pos = parseSlotEl(hoverEl);
          if (pos) { placeItem(id, from, pos.area, pos.idx); }
          return;
        }

        var el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el) return;
        var trayEl = el.closest ? el.closest("[data-tray]") : null;
        if (trayEl) {
          var tid = trayEl.dataset.tray;
          if (holding && holding.id === tid) { returnHolding(); return; }
          if (holding) returnHolding();
          if (!FURNMAP[tid]) return;
          holding = { id: tid, from: "tray" };
          if (pref("showTalk", true) !== false && Math.random() < 0.2) say("decorPut");
          render();
          return;
        }
        var cell = el.closest ? el.closest("[data-slot]") : null;
        if (cell) {
          var cp = parseSlotEl(cell);
          if (!cp) return;
          if (holding) { tryPlaceAt(cp.area, cp.idx); return; }
          var held = getSlotItem(cp.area, cp.idx);
          if (held) { pickUp(cp.area, cp.idx); return; }
          toast("先从下面挑一件家具吧");
          return;
        }
        if (holding) { returnHolding(); }
      }

      prevMove = onDocMove;
      prevUp = onDocUp;
      document.addEventListener("pointermove", onDocMove, { passive: false });
      document.addEventListener("pointerup", onDocUp);
      document.addEventListener("pointercancel", onDocUp);

      function render() {
        if (rendering) return;
        rendering = true;
        try {
          stopFishingTicker();
          root.innerHTML = "";
          if (!ch || !s) root.appendChild(selectView());
          else root.appendChild(gameView());
          if (flash) root.appendChild(flashBar());
          if (picking >= 0) root.appendChild(seedPicker());
          if (detailPlot >= 0) root.appendChild(plotDetail());
          if (view === "home" && holding && FURNMAP[holding.id]) markCanDrop(holding.id);
        } finally { rendering = false; }
      }
      function flashBar() {
        var b = h("div", "position:absolute;left:50%;top:14px;transform:translateX(-50%);max-width:86%;z-index:60;padding:9px 16px;border-radius:999px;background:rgba(52,64,45,.9);color:#fff;font-size:12.5px;line-height:1.4;box-shadow:0 6px 20px rgba(30,45,25,.3);", flash);
        b.className = "ft-roll"; return b;
      }
      function selectView() {
        var box = h("div", "position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(180deg,#d6ecff 0%,#eaf8e2 52%,#d3efbd 100%);");
        var head = h("div", "padding:26px 20px 8px;flex:0 0 auto;");
        head.appendChild(h("div", "font-size:23px;font-weight:800;letter-spacing:2px;color:#3f5a3a;", "晴耕物语"));
        head.appendChild(h("div", "font-size:12.5px;color:#6b7d63;margin-top:8px;line-height:1.6;", "选一位伙伴，一起开垦这片地。"));
        head.appendChild(h("div", "font-size:11.5px;color:#8a9a82;margin-top:2px;line-height:1.6;", "每个角色的田都是独立的。你不在的时候，TA 也会自己照顾这里。"));
        box.appendChild(head);
        var list = h("div", "flex:1;overflow-y:auto;padding:8px 16px 24px;display:flex;flex-direction:column;gap:10px;");
        list.className = "ft-scroll";
        var ps = ctx.personas.list() || [];
        if (!ps.length) list.appendChild(h("div", "padding:24px 4px;font-size:13px;color:#7a8a72;line-height:1.7;", "还没有可用的角色，先去聊天里创建一个吧。"));
        ps.forEach(function (p) {
          var sv = loadSave(p.id);
          var card = h("div", "display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:20px;background:rgba(255,255,255,.86);box-shadow:0 5px 16px rgba(90,120,80,.14);cursor:pointer;transition:transform .12s ease;");
          card.onpointerdown = function () { card.style.transform = "scale(.975)"; };
          card.onpointerup = function () { card.style.transform = ""; };
          card.onpointerleave = function () { card.style.transform = ""; };
          var av = h("div", "width:48px;height:48px;flex:0 0 48px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:#fff;background:linear-gradient(140deg,#b7e39a,#6fbf60);box-shadow:0 3px 9px rgba(110,170,90,.32);");
          if (p.avatar) { var im = document.createElement("img"); im.src = p.avatar; im.style.cssText = "width:100%;height:100%;object-fit:cover;"; av.appendChild(im); }
          else av.textContent = String(p.name || "?").slice(0, 1);
          card.appendChild(av);
          var info = h("div", "flex:1;min-width:0;");
          info.appendChild(h("div", "font-size:14.5px;font-weight:700;color:#3d5038;", p.name || "无名"));
          info.appendChild(h("div", "font-size:11.5px;color:#7f8f78;margin-top:3px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;", p.summary || "还没写人设"));
          var furnN = 0;
          if (Array.isArray(sv.home)) sv.home.forEach(function (sl) { if (!sl) return; if (sl.b) furnN++; if (sl.t) furnN++; });
          if (Array.isArray(sv.wall)) sv.wall.forEach(function (x) { if (x) furnN++; });
          info.appendChild(h("div", "font-size:11px;color:#93a58a;margin-top:5px;", "第 " + sv.day + " 天 · 🪙 " + sv.coins + " · 好感 " + sv.bond + " · 摆放 " + furnN));
          card.appendChild(info);
          card.appendChild(h("div", "font-size:18px;color:#a9bd9f;flex:0 0 auto;", "›"));
          card.onclick = function () { enterChar(p); };
          list.appendChild(card);
        });
        box.appendChild(list);
        return box;
      }
      function enterChar(p) {
        ch = p; s = loadSave(p.id); kv.set("lastChar", p.id);
        view = "farm"; shopTab = "seed"; currentScene = "pine";
        bubble = ""; offlineMsgs = []; picking = -1; detailPlot = -1;
        holding = null; cleanupDrag();
        stopFishing(); offlineResolve(); say("idle");
        s.lastVisit = Date.now(); persist(); render();
      }
      function gameView() {
        var season = SEASONS[seasonOf(s)];
        var w = WEATHER[s.weather] || WEATHER.sunny;
        var mapUrl = String(pref("mapUrl", "") || "").trim();
        var night = view === "scene" && currentScene === "firefly";
        var bg;
        if (night) bg = SCENEMAP.firefly.bg;
        else if (view === "home") bg = "linear-gradient(180deg,#f8ecd6 0%,#f0ddbe 55%,#e3caa2 100%)";
        else if (view === "fish") bg = "linear-gradient(180deg,#cfeaff 0%,#bfe6ef 45%,#a8d8dd 100%)";
        else if (mapUrl) bg = 'url("' + mapUrl + '") center/cover no-repeat';
        else bg = season.bg;
        var wrap = h("div", "position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;background:" + bg + ";");
        var top = h("div", "flex:0 0 auto;padding:12px 14px 8px;display:flex;align-items:center;gap:10px;");
        var av = h("div", "width:40px;height:40px;flex:0 0 40px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;color:#fff;background:linear-gradient(140deg,#b7e39a,#6fbf60);box-shadow:0 3px 9px rgba(110,170,90,.34);cursor:pointer;");
        if (ch.avatar) { var im = document.createElement("img"); im.src = ch.avatar; im.style.cssText = "width:100%;height:100%;object-fit:cover;"; av.appendChild(im); }
        else av.textContent = String(ch.name || "?").slice(0, 1);
        av.title = "换一位伙伴";
        av.onclick = function () { stopFishing(); holding = null; persist(); ch = null; s = null; view = "farm"; render(); };
        top.appendChild(av);
        var mid = h("div", "flex:1;min-width:0;");
        var line1 = h("div", "display:flex;align-items:center;gap:6px;flex-wrap:wrap;");
        line1.appendChild(h("div", "font-size:14.5px;font-weight:800;color:#3a4d34;", ch.name || "伙伴"));
        line1.appendChild(h("div", "font-size:11px;color:#6d7d66;background:rgba(255,255,255,.7);padding:2px 8px;border-radius:999px;", "第 " + s.day + " 天 · " + SEASONS[seasonOf(s)].name + " · " + w.icon + " " + w.name));
        mid.appendChild(line1);
        var barWrap = h("div", "margin-top:6px;height:7px;border-radius:999px;background:rgba(255,255,255,.62);overflow:hidden;");
        var pct = Math.max(0, Math.min(100, (s.energy / s.maxEnergy) * 100));
        barWrap.appendChild(h("div", "height:100%;width:" + pct + "%;border-radius:999px;transition:width .3s ease;background:linear-gradient(90deg,#9fe07f,#5fbf6a);", ""));
        mid.appendChild(barWrap);
        mid.appendChild(h("div", "font-size:10.5px;color:#7e8e76;margin-top:3px;", "体力 " + s.energy + " / " + s.maxEnergy + "　好感 " + s.bond));
        top.appendChild(mid);
        top.appendChild(h("div", "flex:0 0 auto;font-size:13px;font-weight:800;color:#8a6a1f;background:rgba(255,246,214,.92);padding:6px 11px;border-radius:999px;box-shadow:0 2px 8px rgba(180,150,60,.2);", "🪙 " + s.coins));
        wrap.appendChild(top);
        if (bubble) {
          var bb = h("div", "flex:0 0 auto;margin:0 14px 8px;padding:9px 13px;border-radius:14px 14px 14px 4px;background:rgba(255,255,255,.92);font-size:12.5px;line-height:1.55;color:#4c5c46;box-shadow:0 4px 14px rgba(90,120,80,.14);");
          bb.textContent = bubble; bb.className = "ft-roll"; wrap.appendChild(bb);
        }
        if (offlineMsgs.length && view === "farm") {
          var ob = h("div", "flex:0 0 auto;margin:0 14px 8px;padding:10px 13px;border-radius:14px;background:rgba(255,255,255,.86);font-size:11.5px;line-height:1.6;color:#5b6b54;box-shadow:0 4px 14px rgba(90,120,80,.14);");
          ob.className = "ft-roll";
          ob.appendChild(h("div", "font-size:11px;font-weight:800;color:#7d8f74;margin-bottom:5px;", "你不在的时候…"));
          offlineMsgs.slice(0, 4).forEach(function (t) { ob.appendChild(h("div", "margin-top:2px;", "· " + t)); });
          var close = h("div", "margin-top:8px;font-size:11px;color:#9aa892;cursor:pointer;", "知道了");
          close.onclick = function () { offlineMsgs = []; render(); };
          ob.appendChild(close); wrap.appendChild(ob);
        }
        var body = h("div", "flex:1;overflow-y:auto;overscroll-behavior:contain;");
        body.className = "ft-scroll";
        if (view === "farm") body.appendChild(farmArea());
        else if (view === "home") body.appendChild(homeArea());
        else if (view === "fish") body.appendChild(fishArea());
        else if (view === "shop") body.appendChild(shopArea());
        else if (view === "bag") body.appendChild(bagArea());
        else if (view === "dex") body.appendChild(dexArea());
        else if (view === "explore") body.appendChild(exploreArea());
        else if (view === "scene") body.appendChild(sceneArea());
        wrap.appendChild(body);
        wrap.appendChild(dock());
        return wrap;
      }
      function farmArea() {
        var box = h("div", "padding:2px 0 12px;position:relative;");
        var homeBar = h("div", "margin:0 14px 10px;padding:9px 12px;border-radius:18px;background:rgba(255,255,255,.72);display:flex;align-items:center;gap:8px;box-shadow:0 3px 12px rgba(90,120,80,.12);");
        homeBar.appendChild(h("div", "font-size:11.5px;font-weight:800;color:#5c6e53;flex:0 0 auto;", "🏡 小家园"));
        var placedN = 0;
        s.home.forEach(function (sl) { if (!sl) return; if (sl.b) placedN++; if (sl.t) placedN++; });
        if (Array.isArray(s.wall)) s.wall.forEach(function (x) { if (x) placedN++; });
        var strip = h("div", "flex:1;min-width:0;display:flex;gap:4px;overflow-x:auto;align-items:center;");
        strip.className = "ft-scroll";
        if (!placedN) strip.appendChild(h("div", "font-size:11px;color:#9aa892;white-space:nowrap;", "还空着，去添点什么吧"));
        else {
          s.home.forEach(function (sl) {
            if (!sl) return;
            [sl.b, sl.t].forEach(function (id) {
              if (!id || !FURNMAP[id]) return;
              var sp = h("span", "width:22px;height:22px;flex:0 0 22px;display:inline-block;");
              sp.innerHTML = furnSVG(id);
              sp.title = FURNMAP[id].name;
              strip.appendChild(sp);
            });
          });
          if (Array.isArray(s.wall)) s.wall.forEach(function (id) {
            if (!id || !FURNMAP[id]) return;
            var sp2 = h("span", "width:22px;height:22px;flex:0 0 22px;display:inline-block;");
            sp2.innerHTML = furnSVG(id, "wall");
            sp2.title = FURNMAP[id].name;
            strip.appendChild(sp2);
          });
        }
        homeBar.appendChild(strip);
        var addBtn = h("div", "flex:0 0 auto;font-size:11px;font-weight:700;color:#fff;padding:5px 11px;border-radius:999px;background:linear-gradient(160deg,#9ad97f,#78c163);cursor:pointer;", "去看看");
        addBtn.onclick = function () { view = "home"; render(); };
        homeBar.appendChild(addBtn); box.appendChild(homeBar);
        var grid = h("div", "display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:6px 14px 4px;");
        for (var i = 0; i < PLOTS; i++) grid.appendChild(plotNode(i));
        box.appendChild(grid);
        var ready = 0, dry = 0, dead = 0, pestN = 0, weedN = 0;
        s.plots.forEach(function (p) {
          if (!p.crop) return;
          if (p.withered) { dead++; return; }
          if (matured(s, p)) ready++; else if (p.water <= 15) dry++;
          if (p.pest >= 50) pestN++; if (p.weed) weedN++;
        });
        var tip = h("div", "padding:10px 16px 0;font-size:11.5px;color:#7b8b73;line-height:1.7;");
        var arr = [];
        if (dead) arr.push(dead + " 株枯了"); if (ready) arr.push(ready + " 株可收");
        if (dry) arr.push(dry + " 块缺水"); if (pestN) arr.push(pestN + " 株有虫"); if (weedN) arr.push(weedN + " 块有草");
        tip.textContent = arr.length ? arr.join(" · ") + "。点土地看详情。" : "点空地播种，点作物看详情、浇水、施肥。";
        box.appendChild(tip);
        var akeys = Object.keys(s.animals).filter(function (k) { return ANIMALMAP[k]; });
        if (akeys.length) {
          var ab = h("div", "margin:12px 14px 0;padding:10px 12px;border-radius:16px;background:rgba(255,255,255,.62);font-size:11px;color:#6d7d66;line-height:1.7;");
          ab.appendChild(h("div", "font-weight:800;color:#5c6e53;margin-bottom:4px;", "🐾 常来的邻居"));
          var row = h("div", "display:flex;flex-wrap:wrap;gap:8px;align-items:center;");
          akeys.forEach(function (k) { var a = ANIMALMAP[k]; var tag = h("span", "font-size:11.5px;color:#6d7d66;"); tag.innerHTML = '<span class="ft-animal">' + a.icon + "</span>" + a.name + " · 亲近 " + s.animals[k]; row.appendChild(tag); });
          ab.appendChild(row); box.appendChild(ab);
        }
        return box;
      }
      function plotNode(i) {
        var p = s.plots[i]; var ripe = matured(s, p); var st = stageOf(s, p);
        var d = h("div", "");
        d.className = "ft-plot" + (ripe ? " ripe" : "") + (p.crop ? "" : " empty") + (p.withered ? " withered" : "");
        if (p.crop) d.innerHTML = plantSVG(CROP[p.crop], st);
        else d.innerHTML = '<div class="ft-empty-mark">＋</div>';
        var tag = "";
        if (ripe) tag = "✨"; else if (p.withered) tag = "🥀";
        else if (p.crop && p.pest >= 50) tag = "🐛"; else if (p.crop && p.water <= 15) tag = "💧"; else if (p.crop && p.weed) tag = "🌿";
        if (tag) d.appendChild(h("div", "ft-tag", tag));
        d.onclick = function () { tapPlot(i); };
        return d;
      }
      function tapPlot(i) { var p = s.plots[i]; if (!p.crop) { picking = i; render(); return; } detailPlot = i; render(); }
      function plotDetail() {
        var idx = detailPlot;
        if (idx < 0 || idx >= s.plots.length) { detailPlot = -1; return h("div"); }
        var p = s.plots[idx]; if (!p.crop) { detailPlot = -1; return h("div"); }
        var c = CROP[p.crop]; var st = stageOf(s, p); var ripe = matured(s, p); var a = assess(s, p); var d = daysOf(c);
        var ov = h("div", "position:absolute;inset:0;z-index:45;background:rgba(38,50,34,.44);display:flex;align-items:flex-end;");
        ov.onclick = function (e) { if (e.target === ov) { detailPlot = -1; render(); } };
        var panel = h("div", "width:100%;max-height:80%;overflow-y:auto;background:#fbfdf6;border-radius:24px 24px 0 0;padding:20px 18px 26px;box-shadow:0 -8px 28px rgba(40,60,30,.24);");
        panel.className = "ft-scroll";
        var heroRow = h("div", "display:flex;align-items:center;gap:14px;");
        var pic = h("div", "width:88px;height:88px;flex:0 0 88px;display:flex;align-items:flex-end;justify-content:center;");
        pic.innerHTML = plantSVG(c, st); heroRow.appendChild(pic);
        var info = h("div", "flex:1;min-width:0;");
        var t1 = h("div", "display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;");
        t1.appendChild(h("div", "font-size:17px;font-weight:800;color:#3d5038;", c.name));
        t1.appendChild(h("span", "font-size:11px;padding:2px 8px;border-radius:999px;background:" + (c.kind === "flower" ? "rgba(230,140,180,.22)" : "rgba(150,200,130,.28)") + ";color:#5f7058;", c.kind === "flower" ? "花卉" : "蔬菜"));
        info.appendChild(t1);
        var stageName;
        if (p.withered) stageName = "枯萎"; else if (st === 0) stageName = "种子期"; else if (st === 1) stageName = "发芽期"; else if (st === 2) stageName = "开花期"; else stageName = ripe ? "成熟待收" : "结果期";
        info.appendChild(h("div", "font-size:12px;color:#7f8f78;margin-top:5px;", "阶段：" + stageName + "　·　" + a.level));
        var rest = ripe ? "已成熟" : "还需 " + Math.max(1, d - p.grown) + " 天";
        info.appendChild(h("div", "font-size:11.5px;color:#9aa892;margin-top:4px;", rest));
        heroRow.appendChild(info); panel.appendChild(heroRow);
        var tagWrap = h("div", "display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;");
        a.tags.forEach(function (t) { tagWrap.appendChild(h("span", "font-size:11px;padding:3px 10px;border-radius:999px;background:rgba(154,217,127,.28);color:#4a6b40;", t)); });
        panel.appendChild(tagWrap);
        panel.appendChild(h("div", "font-size:12px;font-weight:800;color:#4a5f42;margin:18px 0 8px;", "🌿 生长状况"));
        var barsWrap = h("div", "display:flex;flex-direction:column;gap:9px;");
        barsWrap.appendChild(bar("水分", p.water, "linear-gradient(90deg,#7cc8f0,#4aa8df)", "#e6f3fb"));
        barsWrap.appendChild(bar("肥料", p.fert, "linear-gradient(90deg,#e8c07a,#c98a3a)", "#fbf1de"));
        barsWrap.appendChild(bar("虫害", p.pest, "linear-gradient(90deg,#f09090,#dc5757)", "#fbe4e4"));
        var wr = h("div", "display:flex;align-items:center;gap:10px;");
        wr.appendChild(h("div", "width:36px;font-size:11px;color:#7e8e76;flex:0 0 auto;", "杂草"));
        wr.appendChild(h("div", "flex:1;font-size:11.5px;color:" + (p.weed ? "#c26a35" : "#7ea06f") + ";", p.weed ? "🌿 有杂草，影响生长" : "✓ 干净"));
        barsWrap.appendChild(wr); panel.appendChild(barsWrap);
        var ops = h("div", "display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:18px;");
        if (!p.withered) {
          ops.appendChild(opBtn("💧 浇水", "水 " + p.water + "/100", s.energy >= 2 && p.water < 100, function () { if (p.water >= 100) { toast("水已经够了"); return; } if (s.energy < 2) { toast("体力不够"); return; } s.energy -= 2; p.water = Math.min(100, p.water + 50); addLog(s, "给" + c.name + "浇了水"); if (pref("showTalk", true) !== false && Math.random() < 0.35) say("water", c); persist(); render(); }));
          ops.appendChild(opBtn("💩 施肥", "存 " + (s.items.fert || 0), (s.items.fert || 0) > 0 && p.fert < 100, function () { if (p.fert >= 100) { toast("肥已经够多了"); return; } if (!s.items.fert) { toast("没有肥料了，去商店买"); return; } s.items.fert -= 1; p.fert = Math.min(100, p.fert + 45); addLog(s, "给" + c.name + "施了肥"); if (pref("showTalk", true) !== false && Math.random() < 0.35) say("fert", c); persist(); render(); }));
          ops.appendChild(opBtn("🧴 喷药", "存 " + (s.items.spray || 0), (s.items.spray || 0) > 0 && p.pest > 0, function () { if (p.pest <= 0) { toast("没有虫害"); return; } if (!s.items.spray) { toast("没有驱虫剂了"); return; } s.items.spray -= 1; p.pest = 0; addLog(s, "给" + c.name + "喷了药"); if (pref("showTalk", true) !== false && Math.random() < 0.35) say("spray", c); persist(); render(); }));
          ops.appendChild(opBtn("🧪 除草", "存 " + (s.items.weed || 0), (s.items.weed || 0) > 0 && p.weed, function () { if (!p.weed) { toast("没有杂草"); return; } if (!s.items.weed) { toast("没有除草剂了"); return; } s.items.weed -= 1; p.weed = false; addLog(s, "清掉了" + c.name + "旁边的草"); if (pref("showTalk", true) !== false && Math.random() < 0.35) say("weed", c); persist(); render(); }));
        }
        if (ripe) ops.appendChild(opBtn("🧺 收获", "成熟了", true, function () { var r = harvestPlot(s, idx); if (!r) { toast("还没成熟"); return; } addLog(s, "收了 " + r.count + " 份" + r.crop.name + "（" + r.level + "）"); if (pref("showTalk", true) !== false) say("harvest", r.crop); toast("收获 " + r.crop.name + " ×" + r.count + " · " + r.level); detailPlot = -1; persist(); render(); }));
        ops.appendChild(opBtn("🪏 拔除", p.withered ? "枯了" : "清空", true, function () { var nm = c.name; p.crop = null; p.grown = 0; p.water = 55; p.fert = 15; p.pest = 0; p.weed = false; p.dry = 0; p.withered = false; addLog(s, "拔掉了" + nm); toast("拔掉了 " + nm); detailPlot = -1; persist(); render(); }));
        panel.appendChild(ops);
        var close = h("div", "margin-top:16px;text-align:center;font-size:13px;color:#849479;padding:10px;cursor:pointer;", "关上");
        close.onclick = function () { detailPlot = -1; render(); };
        panel.appendChild(close);
        ov.appendChild(panel); return ov;
      }
      function bar(label, value, grad, bg) {
        value = Math.max(0, Math.min(100, value));
        var row = h("div", "display:flex;align-items:center;gap:10px;");
        row.appendChild(h("div", "width:36px;font-size:11px;color:#7e8e76;flex:0 0 auto;", label));
        var wrapBar = h("div", "ft-bar"); wrapBar.style.background = bg;
        var inner = h("i", ""); inner.style.background = grad; inner.style.width = value + "%";
        wrapBar.appendChild(inner); row.appendChild(wrapBar);
        row.appendChild(h("div", "width:32px;font-size:11px;color:#7e8e76;text-align:right;flex:0 0 auto;", value));
        return row;
      }
      function opBtn(label, sub, enabled, fn) {
        var b = h("button", "border:0;border-radius:14px;padding:10px 4px;font:inherit;font-size:12px;font-weight:700;color:" + (enabled ? "#3f4a3d" : "#a2b09a") + ";background:" + (enabled ? "#fff" : "rgba(240,240,230,.7)") + ";box-shadow:0 3px 9px rgba(90,120,80,.12);cursor:" + (enabled ? "pointer" : "not-allowed") + ";display:flex;flex-direction:column;align-items:center;gap:2px;line-height:1.2;");
        b.type = "button"; b.textContent = label;
        var subEl = h("span", "font-size:9.5px;font-weight:500;opacity:.72;", sub);
        b.appendChild(subEl); b.onclick = function () { if (enabled) fn(); };
        return b;
      }
      function seedPicker() {
        var idx = picking;
        var ov = h("div", "position:absolute;inset:0;z-index:40;background:rgba(38,50,34,.42);display:flex;align-items:flex-end;");
        ov.onclick = function (e) { if (e.target === ov) { picking = -1; render(); } };
        var sheetEl = h("div", "width:100%;max-height:66%;overflow-y:auto;background:#fbfdf6;border-radius:24px 24px 0 0;padding:18px 16px 26px;box-shadow:0 -8px 28px rgba(40,60,30,.24);");
        sheetEl.className = "ft-scroll";
        sheetEl.appendChild(h("div", "font-size:14.5px;font-weight:800;color:#44593d;margin-bottom:12px;", "第 " + (idx + 1) + " 号地 · 种点什么？"));
        var owned = Object.keys(s.seeds).filter(function (k) { return s.seeds[k] > 0 && CROP[k]; });
        if (!owned.length) sheetEl.appendChild(h("div", "font-size:12.5px;color:#7c8a74;line-height:1.7;padding:8px 0 4px;", "手上没有种子了。去商店买一些，或者出门探索看看。"));
        else {
          var g = h("div", "display:grid;grid-template-columns:repeat(3,1fr);gap:9px;");
          owned.forEach(function (k) {
            var c = CROP[k];
            var card = h("div", "padding:10px 8px 9px;border-radius:16px;background:#fff;text-align:center;box-shadow:0 3px 10px rgba(100,130,90,.13);cursor:pointer;");
            var pic = h("div", "height:44px;display:flex;align-items:flex-end;justify-content:center;");
            pic.innerHTML = plantSVG(c, 3); card.appendChild(pic);
            card.appendChild(h("div", "font-size:12px;font-weight:700;color:#47593f;margin-top:6px;", c.name));
            card.appendChild(h("div", "font-size:10.5px;color:#8b9a83;margin-top:2px;", (c.kind === "flower" ? "花 · " : "菜 · ") + daysOf(c) + "天"));
            card.appendChild(h("div", "font-size:10.5px;color:#9aa892;margin-top:1px;", "持有 " + s.seeds[k]));
            card.onclick = function () { doPlant(k); };
            g.appendChild(card);
          });
          sheetEl.appendChild(g);
        }
        var cancel = h("div", "margin-top:16px;text-align:center;font-size:13px;color:#849479;padding:10px;cursor:pointer;", "算了");
        cancel.onclick = function () { picking = -1; render(); };
        sheetEl.appendChild(cancel);
        ov.appendChild(sheetEl); return ov;
      }
      function doPlant(cropId) {
        var i = picking; if (i < 0) return;
        var p = s.plots[i];
        if (p.crop || !s.seeds[cropId] || s.seeds[cropId] <= 0) { picking = -1; render(); return; }
        s.seeds[cropId] -= 1; p.crop = cropId; p.grown = 0; p.water = 55; p.fert = 15; p.pest = 0; p.weed = false; p.dry = 0; p.withered = false;
        var c = CROP[cropId]; addLog(s, "种下了 " + c.name);
        if (pref("showTalk", true) !== false) say("plant", c);
        picking = -1; toast("种下了 " + c.name); persist(); render();
      }

      function wallCell(i) {
        var id = s.wall[i];
        var el = h("div", "");
        el.className = "ft-cell ft-wallcell" + (id ? " full" : " empty");
        el.dataset.slot = "w:" + i;
        if (id && FURNMAP[id]) {
          el.innerHTML = furnSVG(id, "wall");
          el.title = FURNMAP[id].name;
          el.addEventListener("pointerdown", function (e) {
            e.preventDefault();
            beginDrag(e, id, { area: "w", idx: i, id: id });
          });
        }
        return el;
      }
      function floorCell(i) {
        var sl = s.home[i];
        var has = !!(sl && (sl.b || sl.t));
        var el = h("div", "");
        el.className = "ft-cell ft-floorcell" + (has ? " full" : " empty");
        el.dataset.slot = "f:" + i;
        if (sl) {
          if (sl.b && FURNMAP[sl.b]) {
            var bEl = h("div", "position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;z-index:1;");
            bEl.innerHTML = '<div style="position:absolute;left:16%;right:16%;bottom:1px;height:6px;border-radius:50%;background:radial-gradient(ellipse at 45% 50%,rgba(60,35,15,.30),transparent 74%);filter:blur(1.5px);pointer-events:none;"></div>' + furnSVG(sl.b);
            el.appendChild(bEl);
          }
          if (sl.t && FURNMAP[sl.t]) {
            var tEl = h("div", "");
            tEl.className = "ft-topitem";
            tEl.innerHTML = '<div style="position:absolute;left:14%;right:14%;bottom:2px;height:5px;border-radius:50%;background:radial-gradient(ellipse at 50% 50%,rgba(60,35,15,.35),transparent 72%);filter:blur(1px);pointer-events:none;"></div>' + furnSVG(sl.t);
            tEl.title = FURNMAP[sl.t].name + "（拖它可以单独拿走）";
            tEl.addEventListener("pointerdown", function (e) {
              e.preventDefault();
              e.stopPropagation();
              var cur = s.home[i];
              if (cur && cur.t) beginDrag(e, cur.t, { area: "f", idx: i, id: cur.t });
            });
            el.appendChild(tEl);
          }
          if (sl.b) {
            el.title = FURNMAP[sl.b].name + (sl.t ? "（点上方小物可单独拖）" : "");
            el.addEventListener("pointerdown", function (e) {
              e.preventDefault();
              var cur = s.home[i];
              if (cur && cur.b) beginDrag(e, cur.b, { area: "f", idx: i, id: cur.b });
            });
          } else if (sl.t) {
            el.title = FURNMAP[sl.t].name;
            el.addEventListener("pointerdown", function (e) {
              e.preventDefault();
              var cur = s.home[i];
              if (cur && cur.t) beginDrag(e, cur.t, { area: "f", idx: i, id: cur.t });
            });
          }
        }
        return el;
      }
      function trayItem(id) {
        var f = FURNMAP[id];
        var n = freeCount(s, id);
        var card = h("div", "");
        card.className = "ft-tray" + (holding && holding.id === id ? " sel" : "");
        card.dataset.tray = id;
        var pic = h("div", "height:38px;display:flex;align-items:flex-end;justify-content:center;pointer-events:none;");
        pic.innerHTML = furnSVG(id, f.area === "wall" ? "wall" : null);
        card.appendChild(pic);
        card.appendChild(h("div", "font-size:10px;font-weight:700;color:#4c3e28;margin-top:4px;line-height:1.2;pointer-events:none;", f.name));
        card.appendChild(h("div", "font-size:9px;color:#a89878;margin-top:1px;pointer-events:none;", "×" + n));
        card.addEventListener("pointerdown", function (e) {
          beginDrag(e, id, "tray");
        });
        return card;
      }
      function trayRow(label, list) {
        var sec = h("div", "margin-bottom:10px;");
        sec.appendChild(h("div", "font-size:11px;font-weight:700;color:#8a7a60;margin:0 2px 6px;", label + "　" + list.length + " 件"));
        var row = h("div", "display:flex;gap:8px;overflow-x:auto;padding:2px 2px 6px;");
        row.className = "ft-scroll";
        if (!list.length) row.appendChild(h("div", "font-size:11px;color:#b0a48c;padding:14px 2px;white-space:nowrap;", "还没有可摆的，去商店看看"));
        else list.forEach(function (id) { row.appendChild(trayItem(id)); });
        sec.appendChild(row);
        return sec;
      }
      function homeArea() {
        var box = h("div", "padding:2px 12px 28px;");

        box.appendChild(h("div", "font-size:14px;font-weight:800;color:#5a4a30;margin:10px 2px 3px;", "🏡 我的小屋"));
        box.appendChild(h("div", "font-size:11.5px;color:#8a7a60;line-height:1.6;margin:0 2px 10px;", "把下面的家具拖进房间，也可以先点家具、再点位置。桌子上有东西时，点小物可单独拖走，点格子主体则拖桌子（含桌面小物一起走）。"));

        if (holding && FURNMAP[holding.id]) {
          var hb = h("div", "display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:9px 12px;border-radius:14px;background:rgba(154,217,127,.30);box-shadow:inset 0 0 0 1px rgba(120,190,100,.4);");
          var hip = h("span", "width:26px;height:26px;flex:0 0 26px;display:inline-block;");
          hip.innerHTML = furnSVG(holding.id, FURNMAP[holding.id].area === "wall" ? "wall" : null);
          hb.appendChild(hip);
          hb.appendChild(h("div", "flex:1;font-size:12px;color:#3f6b2e;font-weight:600;", "拿着「" + FURNMAP[holding.id].name + "」" + (holding.from && holding.from.carriedTop ? "（连带" + FURNMAP[holding.from.carriedTop].name + "）" : "") + "，点一个位置放下"));
          var cancelH = h("div", "font-size:11.5px;font-weight:700;color:#7a9a6a;cursor:pointer;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,.72);", "放回");
          cancelH.onclick = function () { returnHolding(); };
          hb.appendChild(cancelH);
          box.appendChild(hb);
        }

        var paper = PAPERMAP[s.wallpaper] || PAPERS[0];
        var room = h("div", "ft-room");

        // ==== 墙面 ====
        var wallEl = h("div", "position:relative;padding:10px 9px 0;background:" + paper.css + ";box-shadow:inset 0 14px 22px -14px rgba(70,50,30,.45),inset 0 -10px 14px -12px rgba(70,50,30,.30);");
        var wallGrid = h("div", "display:grid;grid-template-columns:repeat(" + WALL_COLS + ",1fr);gap:6px;position:relative;z-index:2;");
        for (var wi = 0; wi < WALL_SLOTS; wi++) wallGrid.appendChild(wallCell(wi));
        wallEl.appendChild(wallGrid);
        wallEl.appendChild(h("div", "ft-wall-layer"));
        wallEl.appendChild(h("div", "ft-wall-base"));
        room.appendChild(wallEl);

        // ==== 地面 ====
        var floorEl = h("div", "position:relative;padding:10px 9px 14px;background:repeating-linear-gradient(90deg,rgba(160,120,80,.12) 0 2px,transparent 2px 28px),repeating-linear-gradient(0deg,rgba(160,120,80,.08) 0 2px,transparent 2px 22px),linear-gradient(175deg,#f2e2c8,#ddc5a0);");
        var floorGrid = h("div", "display:grid;grid-template-columns:repeat(" + FLOOR_COLS + ",1fr);gap:6px;position:relative;z-index:2;");
        for (var fi = 0; fi < HOME_SLOTS; fi++) {
          var fc = floorCell(fi);
          fc.style.zIndex = String(2 + Math.floor(fi / FLOOR_COLS));
          floorGrid.appendChild(fc);
        }
        floorEl.appendChild(floorGrid);
        floorEl.appendChild(h("div", "ft-floor-layer"));
        room.appendChild(floorEl);

        box.appendChild(room);

        // ==== 墙纸 ====
        var paperSec = h("div", "margin-top:14px;");
        paperSec.appendChild(h("div", "font-size:12px;font-weight:800;color:#5a4a30;margin:0 2px 7px;", "🎨 墙纸"));
        var paperRow = h("div", "display:flex;gap:8px;overflow-x:auto;padding:2px 2px 6px;");
        paperRow.className = "ft-scroll";
        PAPERS.forEach(function (p) {
          var sw = h("div", "width:40px;height:40px;flex:0 0 40px;border-radius:12px;cursor:pointer;background:" + p.css + ";box-shadow:0 2px 8px rgba(120,100,70,.18),0 0 0 " + (s.wallpaper === p.id ? "2.5px #78c163" : "1px rgba(160,140,110,.3)") + ";");
          sw.title = p.name;
          sw.onclick = function () { s.wallpaper = p.id; persist(); render(); };
          paperRow.appendChild(sw);
        });
        paperSec.appendChild(paperRow);
        box.appendChild(paperSec);

        // ==== 仓库 ====
        var floorList = [], surfaceList = [], wallList = [];
        Object.keys(s.decor).forEach(function (k) {
          if (!FURNMAP[k]) return;
          if (freeCount(s, k) <= 0) return;
          var f = FURNMAP[k];
          if (f.area === "wall") wallList.push(k);
          else if (f.area === "surface") surfaceList.push(k);
          else floorList.push(k);
        });
        var sorter = function (a, b) { return (FURNMAP[a].rar - FURNMAP[b].rar) || (FURNMAP[a].price - FURNMAP[b].price); };
        floorList.sort(sorter); surfaceList.sort(sorter); wallList.sort(sorter);

        var traySec = h("div", "margin-top:16px;");
        traySec.appendChild(h("div", "font-size:12px;font-weight:800;color:#5a4a30;margin:0 2px 8px;", "📦 家具仓库"));
        traySec.appendChild(trayRow("🪑 地面", floorList));
        traySec.appendChild(trayRow("🍵 桌面小物（需放在有台面的家具上）", surfaceList));
        traySec.appendChild(trayRow("🖼️ 墙上", wallList));
        box.appendChild(traySec);

        box.appendChild(h("div", "font-size:13px;font-weight:800;color:#5a4a30;margin:20px 2px 10px;", "🧰 材料"));
        var mg = h("div", "display:grid;grid-template-columns:repeat(5,1fr);gap:8px;");
        MATKEYS.forEach(function (k) {
          var cell = h("div", "padding:10px 4px;border-radius:14px;background:#fff;text-align:center;box-shadow:0 3px 10px rgba(120,100,70,.12);");
          cell.appendChild(h("div", "font-size:19px;", MATS[k].icon));
          cell.appendChild(h("div", "font-size:10.5px;color:#8a7a60;margin-top:3px;", MATS[k].name));
          cell.appendChild(h("div", "font-size:12px;font-weight:800;color:#5c4b32;margin-top:2px;", "×" + (s.mats[k] || 0)));
          mg.appendChild(cell);
        });
        box.appendChild(mg);

        var shortcuts = h("div", "display:flex;gap:9px;margin-top:18px;");
        [["🏪 挑家具", "furn"], ["🛍️ 跳蚤市场", "market"], ["🛠️ 图纸制作", "craft"]].forEach(function (t) {
          var b = h("div", "flex:1;text-align:center;padding:13px 0;border-radius:16px;background:rgba(255,255,255,.86);font-size:12.5px;font-weight:700;color:#5c6e53;cursor:pointer;box-shadow:0 3px 10px rgba(120,100,70,.14);", t[0]);
          b.onclick = function () { holding = null; view = "shop"; shopTab = t[1]; render(); };
          shortcuts.appendChild(b);
        });
        box.appendChild(shortcuts);

        return box;
      }

      function stopFishingTicker() { if (fishing.timer) { clearInterval(fishing.timer); fishing.timer = null; } }
      function stopFishing() { stopFishingTicker(); fishing.active = false; fishing.hook = null; }
      function startTicker() {
        stopFishingTicker();
        fishing.timer = setInterval(function () {
          if (!fishing.active) { stopFishingTicker(); return; }
          fishing.pos += fishing.dir * fishing.speed;
          if (fishing.pos >= 100) { fishing.pos = 100; fishing.dir = -1; }
          if (fishing.pos <= 0) { fishing.pos = 0; fishing.dir = 1; }
          var hk = fishing.hook; if (hk && hk.isConnected) hk.style.left = fishing.pos + "%";
        }, 28);
      }
      function startFish() {
        if (fishing.active) return;
        if (s.energy < 8) { toast("体力不够了，歇会儿吧"); return; }
        s.energy -= 8;
        var roll = Math.random();
        var rar = roll < 0.52 ? 1 : roll < 0.82 ? 2 : roll < 0.95 ? 3 : 4;
        var pool = FISH.filter(function (f) { return f.rar === rar; });
        if (!pool.length) pool = FISH;
        var target = pool[Math.floor(Math.random() * pool.length)];
        fishing.active = true; fishing.catchFish = target; fishing.pos = 0; fishing.dir = 1;
        fishing.speed = 2.4 + Math.random() * 1.8;
        fishing.width = [0, 34, 24, 16, 10][rar] || 24;
        fishing.target = fishing.width / 2 + Math.random() * (100 - fishing.width);
        fishing.result = null; fishing.hook = null;
        if (pref("showTalk", true) !== false) say("fishCast");
        persist(); render(); startTicker();
      }
      function reelIn() {
        if (!fishing.active) return;
        stopFishingTicker();
        var f = fishing.catchFish;
        var hit = Math.abs(fishing.pos - fishing.target) <= fishing.width / 2;
        fishing.active = false; fishing.hook = null;
        if (hit) {
          s.fish[f.id] = (s.fish[f.id] || 0) + 1; s.bond += 1;
          addLog(s, "钓上了" + f.name);
          if (pref("showTalk", true) !== false) say("fishWin");
          fishing.result = { ok: true, text: "钓到了「" + f.name + "」！" + f.desc };
          if (f.rar >= 4 && Math.random() < 0.7) { var bp = tryUnlockBlueprint(s, false); if (bp) fishing.result.text += "　（还翻出一张图纸：「" + bp.name + "」）"; }
          else if (Math.random() < 0.22) { var mk = randomMat(); giveMat(s, mk, 1); fishing.result.text += "　（顺便捞到 1 份" + MATS[mk].name + "）"; }
        } else {
          if (pref("showTalk", true) !== false) say("fishLose");
          fishing.result = { ok: false, text: Math.random() < 0.6 ? "鱼跑了……手慢了一点。" : "什么都没咬钩。" };
        }
        persist(); render();
      }
      function fishArea() {
        var box = h("div", "padding:2px 0 24px;position:relative;");
        var pool = h("div", "position:relative;margin:8px 14px 0;height:170px;border-radius:24px;overflow:hidden;background:linear-gradient(180deg,#bfe6f5 0%,#8cc9e0 45%,#5aa8c8 100%);box-shadow:0 8px 24px rgba(50,110,140,.28),inset 0 3px 0 rgba(255,255,255,.5);");
        pool.className = "ft-scene";
        for (var i = 0; i < 4; i++) { var wv = h("div", ""); wv.className = "ft-wave"; wv.style.top = (16 + i * 34) + "px"; wv.style.animationDuration = (5 + i) + "s"; wv.style.opacity = (0.5 - i * 0.08); pool.appendChild(wv); }
        [{ t: 10, l: 8, s: 22 }, { t: 30, l: 68, s: 16 }].forEach(function (c) { var cl = h("div", "position:absolute;opacity:.55;pointer-events:none;font-size:" + c.s + "px;", "☁️"); cl.style.top = c.t + "px"; cl.style.left = c.l + "%"; pool.appendChild(cl); });
        if (!fishing.active) { for (var k = 0; k < 3; k++) { var sh = h("div", "position:absolute;font-size:" + (13 + k * 3) + "px;opacity:.32;pointer-events:none;", "🐟"); sh.style.top = (70 + k * 22) + "px"; sh.style.left = (12 + k * 26) + "%"; sh.style.transform = "scaleX(-1)"; sh.style.animation = "ftfloat " + (4 + k) + "s ease-in-out infinite"; pool.appendChild(sh); } }
        var tipTxt = fishing.active ? "看准绿色的位置，点「收竿」！" : "点「抛竿」开始，看准时机收竿。";
        var tip = h("div", "position:absolute;left:0;right:0;bottom:0;padding:10px 16px;font-size:11.5px;font-weight:700;color:#2b5266;background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.78));", tipTxt);
        pool.appendChild(tip); box.appendChild(pool);
        if (fishing.active) {
          var trackWrap = h("div", "margin:16px 18px 0;");
          var track = h("div", "position:relative;height:34px;border-radius:17px;background:rgba(255,255,255,.72);overflow:hidden;box-shadow:inset 0 2px 6px rgba(50,90,110,.18);");
          var zone = h("div", "position:absolute;top:0;bottom:0;border-radius:12px;background:linear-gradient(180deg,#a8e08a,#5fbf6a);box-shadow:0 0 12px rgba(110,200,110,.55);");
          zone.style.left = (fishing.target - fishing.width / 2) + "%"; zone.style.width = fishing.width + "%";
          track.appendChild(zone);
          var hookEl = h("div", "position:absolute;top:-3px;bottom:-3px;width:6px;border-radius:6px;background:linear-gradient(180deg,#fff,#ffcf5c);box-shadow:0 0 10px rgba(255,190,60,.9);transform:translateX(-50%);");
          hookEl.style.left = fishing.pos + "%"; track.appendChild(hookEl); fishing.hook = hookEl;
          trackWrap.appendChild(track); box.appendChild(trackWrap);
        }
        if (fishing.result) {
          var rb = h("div", "margin:14px 16px 0;padding:12px 14px;border-radius:16px;line-height:1.65;font-size:12.5px;background:" + (fishing.result.ok ? "rgba(226,247,214,.95)" : "rgba(255,255,255,.9)") + ";color:" + (fishing.result.ok ? "#3f6b2e" : "#6d7d66") + ";box-shadow:0 4px 14px rgba(60,110,80,.14);");
          rb.className = "ft-roll"; rb.textContent = fishing.result.text; box.appendChild(rb);
        }
        var btnWrap = h("div", "margin:18px 16px 0;display:flex;gap:10px;");
        var main = h("button", "flex:1;border:0;border-radius:18px;padding:15px 0;font:inherit;font-size:15px;font-weight:800;color:#fff;cursor:pointer;letter-spacing:2px;background:" + (fishing.active ? "linear-gradient(160deg,#ffb45c,#f08a3a)" : "linear-gradient(160deg,#7ec8f0,#3f9ec8)") + ";box-shadow:0 8px 22px rgba(70,150,180,.34);", fishing.active ? "收竿！" : "抛竿");
        main.type = "button";
        main.onclick = function () { if (fishing.active) reelIn(); else startFish(); };
        btnWrap.appendChild(main);
        var allIn = h("button", "flex:0 0 100px;border:0;border-radius:18px;padding:15px 0;font:inherit;font-size:13px;font-weight:700;color:#4f6a72;background:rgba(255,255,255,.86);cursor:pointer;box-shadow:0 4px 14px rgba(60,110,140,.18);", "查看鱼篓");
        allIn.type = "button";
        allIn.onclick = function () { view = "bag"; render(); };
        btnWrap.appendChild(allIn); box.appendChild(btnWrap);
        var keys = Object.keys(s.fish).filter(function (k) { return FISHMAP[k] && s.fish[k] > 0; });
        box.appendChild(h("div", "font-size:13px;font-weight:800;color:#3f5a66;margin:24px 16px 10px;", "🐟 今日鱼篓"));
        if (!keys.length) box.appendChild(h("div", "font-size:12px;color:#7f9aa5;line-height:1.7;margin:0 16px;", "还空着。多抛几竿吧。"));
        else {
          var g = h("div", "display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:0 16px;");
          keys.forEach(function (k) {
            var f = FISHMAP[k];
            var card = h("div", "padding:10px 6px 9px;border-radius:16px;background:rgba(255,255,255,.9);text-align:center;box-shadow:0 3px 10px rgba(60,110,140,.14);");
            var pic = h("div", "height:44px;display:flex;align-items:flex-end;justify-content:center;");
            pic.innerHTML = fishSVG(f); card.appendChild(pic);
            card.appendChild(h("div", "font-size:11.5px;font-weight:700;color:#3f5a66;margin-top:6px;", f.name));
            card.appendChild(h("div", "font-size:10.5px;color:#8fa8b2;margin-top:1px;", "×" + s.fish[k]));
            g.appendChild(card);
          });
          box.appendChild(g);
        }
        return box;
      }
      function shopArea() {
        var box = h("div", "padding:0 0 24px;");
        var tabs = h("div", "display:flex;gap:7px;padding:8px 14px 12px;overflow-x:auto;");
        tabs.className = "ft-scroll";
        [{ id: "seed", label: "🌰 种子" }, { id: "item", label: "🧴 道具" }, { id: "furn", label: "🛋️ 家具" }, { id: "craft", label: "🛠️ 制作" }, { id: "market", label: "🛍️ 跳蚤市场" }, { id: "sell", label: "🧺 卖出" }].forEach(function (t) {
          var b = h("div", ""); b.className = "ft-tab " + (shopTab === t.id ? "on" : "off");
          b.textContent = t.label; b.onclick = function () { shopTab = t.id; render(); };
          tabs.appendChild(b);
        });
        box.appendChild(tabs);
        var inner = h("div", "padding:0 14px;");
        if (shopTab === "seed") inner.appendChild(shopSeed());
        else if (shopTab === "item") inner.appendChild(shopItem());
        else if (shopTab === "furn") inner.appendChild(shopFurn());
        else if (shopTab === "craft") inner.appendChild(shopCraft());
        else if (shopTab === "market") inner.appendChild(shopMarket());
        else if (shopTab === "sell") inner.appendChild(shopSell());
        box.appendChild(inner); return box;
      }
      function shopSeed() {
        var box = h("div", "");
        var g = h("div", "display:grid;grid-template-columns:1fr 1fr;gap:9px;");
        CROPS.forEach(function (c) {
          var afford = s.coins >= c.seed;
          var card = h("div", "display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:16px;background:#fff;box-shadow:0 3px 10px rgba(100,130,90,.12);cursor:pointer;" + (afford ? "" : "opacity:.5;"));
          var pic = h("div", "width:38px;height:38px;flex:0 0 38px;"); pic.innerHTML = plantSVG(c, 3); card.appendChild(pic);
          var info = h("div", "flex:1;min-width:0;");
          info.appendChild(h("div", "font-size:12.5px;font-weight:700;color:#46583e;", c.name));
          info.appendChild(h("div", "font-size:10.5px;color:#8b9a83;margin-top:2px;", daysOf(c) + " 天 · 卖 " + c.sell));
          info.appendChild(h("div", "font-size:11px;font-weight:700;color:#b8873a;margin-top:2px;", "🪙 " + c.seed));
          card.appendChild(info);
          card.onclick = function () { if (s.coins < c.seed) { toast("金币不够啦"); return; } s.coins -= c.seed; s.seeds[c.id] = (s.seeds[c.id] || 0) + 1; addLog(s, "买了 1 颗" + c.name + "种子"); persist(); render(); };
          g.appendChild(card);
        });
        box.appendChild(g); return box;
      }
      function shopItem() {
        var box = h("div", "");
        var g = h("div", "display:flex;flex-direction:column;gap:9px;");
        Object.keys(ITEMS).forEach(function (k) {
          var it = ITEMS[k]; var afford = s.coins >= it.price;
          var card = h("div", "display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;background:#fff;box-shadow:0 3px 10px rgba(100,130,90,.12);cursor:pointer;" + (afford ? "" : "opacity:.5;"));
          card.appendChild(h("span", "font-size:22px;", it.icon));
          var info = h("div", "flex:1;min-width:0;");
          info.appendChild(h("div", "font-size:12.5px;font-weight:700;color:#46583e;", it.name + "（持有 " + (s.items[k] || 0) + "）"));
          info.appendChild(h("div", "font-size:10.5px;color:#8b9a83;margin-top:2px;", it.desc));
          card.appendChild(info);
          card.appendChild(h("div", "font-size:12px;font-weight:700;color:#b8873a;", "🪙 " + it.price));
          card.onclick = function () { if (s.coins < it.price) { toast("金币不够"); return; } s.coins -= it.price; s.items[k] = (s.items[k] || 0) + 1; toast("买了一份" + it.name); persist(); render(); };
          g.appendChild(card);
        });
        box.appendChild(g); return box;
      }
      function shopFurn() {
        var box = h("div", "");
        box.appendChild(h("div", "font-size:11.5px;color:#8b9a83;line-height:1.6;margin:0 2px 12px;", "这里只卖常见的家具。稀有的要靠图纸制作，或者去跳蚤市场碰运气。"));
        var list = FURN.filter(function (f) { return f.rar <= 2; });
        var g = h("div", "display:grid;grid-template-columns:1fr 1fr;gap:9px;");
        list.forEach(function (f) {
          var afford = s.coins >= f.price; var own = s.decor[f.id] || 0;
          var card = h("div", "padding:11px;border-radius:16px;background:#fff;box-shadow:0 3px 10px rgba(100,130,90,.12);cursor:pointer;" + (afford ? "" : "opacity:.5;"));
          var row = h("div", "display:flex;align-items:center;gap:8px;");
          var pic = h("span", "width:34px;height:34px;flex:0 0 34px;display:inline-block;"); pic.innerHTML = furnSVG(f.id, f.area === "wall" ? "wall" : null); row.appendChild(pic);
          var info = h("div", "flex:1;min-width:0;");
          info.appendChild(h("div", "font-size:12.5px;font-weight:700;color:#46583e;", f.name));
          info.appendChild(h("div", "font-size:10px;color:#8b9a83;margin-top:1px;line-height:1.4;", f.desc));
          row.appendChild(info); card.appendChild(row);
          card.appendChild(h("div", "font-size:11px;font-weight:700;margin-top:8px;color:#b8873a;", "🪙 " + f.price + (own ? "　已有 " + own : "")));
          card.onclick = function () { if (s.coins < f.price) { toast("金币不够"); return; } s.coins -= f.price; s.decor[f.id] = (s.decor[f.id] || 0) + 1; addLog(s, "买了" + f.name); toast("买下了「" + f.name + "」"); persist(); render(); };
          g.appendChild(card);
        });
        box.appendChild(g); return box;
      }
      function shopCraft() {
        var box = h("div", "");
        box.appendChild(h("div", "font-size:11.5px;color:#8b9a83;line-height:1.6;margin:0 2px 12px;", "有图纸就能用材料做家具。图纸从跳蚤市场、探索或钓鱼里获得。"));
        var list = FURN.filter(function (f) { return s.blueprints[f.id]; });
        if (!list.length) { box.appendChild(h("div", "font-size:12.5px;color:#8a8a80;line-height:1.7;", "还没有任何图纸。")); return box; }
        var g = h("div", "display:grid;grid-template-columns:1fr 1fr;gap:9px;");
        list.forEach(function (f) {
          var can = true; var parts = [];
          Object.keys(f.mats).forEach(function (mk) { var need = f.mats[mk]; var have = s.mats[mk] || 0; if (have < need) can = false; parts.push(MATS[mk].icon + need + "(" + have + ")"); });
          var card = h("div", "padding:11px;border-radius:16px;background:" + (can ? "#f2fbf0" : "#fff") + ";box-shadow:0 3px 10px rgba(100,130,90,.12);cursor:pointer;" + (can ? "" : "opacity:.6;"));
          var row = h("div", "display:flex;align-items:center;gap:8px;");
          var pic = h("span", "width:34px;height:34px;flex:0 0 34px;display:inline-block;"); pic.innerHTML = furnSVG(f.id, f.area === "wall" ? "wall" : null); row.appendChild(pic);
          var info = h("div", "flex:1;min-width:0;");
          info.appendChild(h("div", "font-size:12.5px;font-weight:700;color:#46583e;", f.name));
          info.appendChild(h("div", "font-size:10px;color:#8b9a83;margin-top:2px;line-height:1.5;", parts.join(" ")));
          row.appendChild(info); card.appendChild(row);
          card.appendChild(h("div", "font-size:11px;font-weight:700;margin-top:8px;color:" + (can ? "#4d8a3a" : "#a0a096") + ";", can ? "可以制作" : "材料不足"));
          card.onclick = function () {
            if (!can) { toast("材料不够"); return; }
            Object.keys(f.mats).forEach(function (mk) { s.mats[mk] = (s.mats[mk] || 0) - f.mats[mk]; });
            s.decor[f.id] = (s.decor[f.id] || 0) + 1;
            addLog(s, "做了一件" + f.name);
            if (pref("showTalk", true) !== false && Math.random() < 0.5) say("craft");
            toast("做好了「" + f.name + "」"); persist(); render();
          };
          g.appendChild(card);
        });
        box.appendChild(g); return box;
      }
      function shopMarket() {
        var box = h("div", "");
        box.appendChild(h("div", "font-size:11.5px;color:#8b9a83;line-height:1.6;margin:0 2px 12px;", "跳蚤市场每天换一批货。稀有的家具和图纸在这里有机会遇到。"));
        var items = marketStock(s);
        var g = h("div", "display:flex;flex-direction:column;gap:9px;");
        items.forEach(function (it, idx) {
          var name = "", icon = "", sub = ""; var svgHTML = "", isFurn = false, isBig = false;
          if (it.kind === "mat") { icon = MATS[it.id].icon; name = MATS[it.id].name + " ×" + it.n; sub = "材料"; }
          else if (it.kind === "furn") { svgHTML = furnSVG(it.id, FURNMAP[it.id].area === "wall" ? "wall" : null); isFurn = true; isBig = true; name = FURNMAP[it.id].name; sub = FURNMAP[it.id].desc; }
          else if (it.kind === "blueprint") { svgHTML = furnSVG(it.id, FURNMAP[it.id].area === "wall" ? "wall" : null); isFurn = true; isBig = false; name = "图纸 · " + FURNMAP[it.id].name; sub = "解锁制作配方"; }
          else if (it.kind === "seed") { icon = "🌰"; name = CROP[it.id].name + "种子 ×" + it.n; sub = "种子"; }
          var afford = s.coins >= it.price && !it.sold;
          var card = h("div", "display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:16px;background:" + (it.sold ? "rgba(245,245,238,.7)" : "#fff") + ";box-shadow:0 3px 10px rgba(100,130,90,.12);" + (afford ? "cursor:pointer;" : "opacity:.55;"));
          if (isFurn) { var picM = h("span", "width:34px;height:34px;flex:0 0 34px;display:inline-block;" + (isBig ? "" : "opacity:.85;")); picM.innerHTML = svgHTML; card.appendChild(picM); }
          else card.appendChild(h("span", "font-size:24px;", icon));
          var info = h("div", "flex:1;min-width:0;");
          info.appendChild(h("div", "font-size:12.5px;font-weight:700;color:#46583e;", name));
          info.appendChild(h("div", "font-size:10.5px;color:#8b9a83;margin-top:2px;", sub));
          card.appendChild(info);
          card.appendChild(h("div", "font-size:12px;font-weight:700;color:" + (it.sold ? "#a0a096" : "#b8873a") + ";", it.sold ? "已卖出" : "🪙 " + it.price));
          card.onclick = function () {
            if (it.sold) { toast("这件已经卖掉了"); return; }
            if (s.coins < it.price) { toast("金币不够"); return; }
            s.coins -= it.price; it.sold = true;
            if (it.kind === "mat") giveMat(s, it.id, it.n);
            else if (it.kind === "furn") s.decor[it.id] = (s.decor[it.id] || 0) + 1;
            else if (it.kind === "blueprint") s.blueprints[it.id] = true;
            else if (it.kind === "seed") s.seeds[it.id] = (s.seeds[it.id] || 0) + it.n;
            if (pref("showTalk", true) !== false && Math.random() < 0.4) say("market");
            addLog(s, "在跳蚤市场买了「" + name + "」");
            toast("买下了「" + name + "」"); persist(); render();
          };
          g.appendChild(card);
        });
        box.appendChild(g);
        box.appendChild(h("div", "margin-top:14px;text-align:center;font-size:11px;color:#9aa892;line-height:1.6;", "明天再来，摊子上就换新货了。"));
        return box;
      }
      function shopSell() {
        var box = h("div", "");
        box.appendChild(h("div", "font-size:13px;font-weight:800;color:#4a5f42;margin:2px 0 10px;", "🧺 卖收成"));
        var keys = Object.keys(s.barn).filter(function (k) { return s.barn[k] > 0 && CROP[k]; });
        if (!keys.length) box.appendChild(h("div", "font-size:12px;color:#8b9a83;line-height:1.7;padding:2px 2px 8px;", "仓库还是空的，先去收点东西吧。"));
        else {
          var g3 = h("div", "display:flex;flex-direction:column;gap:8px;");
          keys.forEach(function (k) {
            var c = CROP[k]; var n = s.barn[k];
            var row = h("div", "display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;background:#fff;box-shadow:0 3px 10px rgba(100,130,90,.12);");
            var pic = h("div", "width:34px;height:34px;flex:0 0 34px;"); pic.innerHTML = plantSVG(c, 3); row.appendChild(pic);
            row.appendChild(h("div", "flex:1;font-size:12.5px;font-weight:700;color:#46583e;", c.name + " ×" + n));
            var btn = h("div", "font-size:12px;font-weight:700;color:#fff;background:linear-gradient(160deg,#9ad97f,#78c163);padding:7px 14px;border-radius:999px;cursor:pointer;box-shadow:0 3px 9px rgba(110,180,90,.32);", "卖出 🪙" + c.sell * n);
            btn.onclick = function () { s.coins += c.sell * n; addLog(s, "卖了 " + n + " 份" + c.name + "，+ " + c.sell * n); s.barn[k] = 0; toast("卖出 " + c.name + " ×" + n); persist(); render(); };
            row.appendChild(btn); g3.appendChild(row);
          });
          box.appendChild(g3);
        }
        box.appendChild(h("div", "font-size:13px;font-weight:800;color:#4a5f42;margin:22px 0 10px;", "🐟 卖鱼"));
        var fk = Object.keys(s.fish).filter(function (k) { return FISHMAP[k] && s.fish[k] > 0; });
        if (!fk.length) box.appendChild(h("div", "font-size:12px;color:#8b9a83;line-height:1.7;padding:2px 2px 8px;", "鱼篓是空的。"));
        else {
          var gf = h("div", "display:flex;flex-direction:column;gap:8px;");
          fk.forEach(function (k) {
            var f = FISHMAP[k]; var n = s.fish[k];
            var row = h("div", "display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;background:#fff;box-shadow:0 3px 10px rgba(100,130,90,.12);");
            var pic = h("div", "width:38px;height:34px;flex:0 0 38px;"); pic.innerHTML = fishSVG(f); row.appendChild(pic);
            row.appendChild(h("div", "flex:1;font-size:12.5px;font-weight:700;color:#46583e;", f.name + " ×" + n));
            var btn = h("div", "font-size:12px;font-weight:700;color:#fff;background:linear-gradient(160deg,#7ec8f0,#3f9ec8);padding:7px 14px;border-radius:999px;cursor:pointer;box-shadow:0 3px 9px rgba(70,150,180,.32);", "卖出 🪙" + f.price * n);
            btn.onclick = function () { s.coins += f.price * n; addLog(s, "卖了 " + n + " 条" + f.name + "，+ " + f.price * n); s.fish[k] = 0; toast("卖出 " + f.name + " ×" + n); persist(); render(); };
            row.appendChild(btn); gf.appendChild(row);
          });
          box.appendChild(gf);
        }
        box.appendChild(h("div", "font-size:13px;font-weight:800;color:#4a5f42;margin:22px 0 10px;", "🛋️ 卖家具"));
        box.appendChild(h("div", "font-size:11px;color:#8b9a83;line-height:1.6;margin:-6px 0 10px;", "按原价四成回收。摆在小屋里的要先收回才能卖。"));
        var dk = Object.keys(s.decor).filter(function (k) { return freeCount(s, k) > 0; });
        if (!dk.length) box.appendChild(h("div", "font-size:12px;color:#8b9a83;line-height:1.7;padding:2px 2px 8px;", "仓库里没有可以卖的家具。"));
        else {
          var gd = h("div", "display:grid;grid-template-columns:1fr 1fr;gap:9px;");
          dk.forEach(function (k) {
            var f = FURNMAP[k]; var n = freeCount(s, k); var price = Math.max(1, Math.round(f.price * 0.4));
            var card = h("div", "padding:11px;border-radius:16px;background:#fff;box-shadow:0 3px 10px rgba(100,130,90,.12);cursor:pointer;");
            var row = h("div", "display:flex;align-items:center;gap:8px;");
            var picS = h("span", "width:34px;height:34px;flex:0 0 34px;display:inline-block;"); picS.innerHTML = furnSVG(f.id, f.area === "wall" ? "wall" : null); row.appendChild(picS);
            var info = h("div", "flex:1;min-width:0;");
            info.appendChild(h("div", "font-size:12.5px;font-weight:700;color:#46583e;", f.name));
            info.appendChild(h("div", "font-size:10.5px;color:#8b9a83;margin-top:1px;", "可卖 " + n + " 件"));
            row.appendChild(info); card.appendChild(row);
            card.appendChild(h("div", "font-size:11px;font-weight:700;margin-top:8px;color:#b8873a;", "每件 🪙 " + price));
            card.onclick = function () { s.decor[k] = (s.decor[k] || 0) - 1; if (s.decor[k] <= 0) delete s.decor[k]; s.coins += price; addLog(s, "卖掉了" + f.name); toast("卖掉「" + f.name + "」+ 🪙" + price); persist(); render(); };
            gd.appendChild(card);
          });
          box.appendChild(gd);
        }
        return box;
      }
      function bagArea() {
        var box = h("div", "padding:4px 14px 20px;");
        box.appendChild(h("div", "font-size:13px;font-weight:800;color:#4a5f42;margin:8px 0 10px;", "🌰 种子"));
        var sk = Object.keys(s.seeds).filter(function (k) { return s.seeds[k] > 0 && CROP[k]; });
        box.appendChild(chipGrid(sk.map(function (k) { return { crop: CROP[k], n: s.seeds[k] }; }), "还没有种子"));
        box.appendChild(h("div", "font-size:13px;font-weight:800;color:#4a5f42;margin:20px 0 10px;", "🧴 道具"));
        var it = h("div", "display:flex;flex-direction:column;gap:8px;");
        Object.keys(ITEMS).forEach(function (k) {
          var data = ITEMS[k];
          var row = h("div", "display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;background:#fff;box-shadow:0 3px 10px rgba(100,130,90,.12);");
          row.appendChild(h("span", "font-size:22px;", data.icon));
          var info = h("div", "flex:1;min-width:0;");
          info.appendChild(h("div", "font-size:12.5px;font-weight:700;color:#46583e;", data.name));
          info.appendChild(h("div", "font-size:10.5px;color:#8b9a83;margin-top:2px;", data.desc));
          row.appendChild(info);
          row.appendChild(h("div", "font-size:13px;font-weight:800;color:#5c6e53;", "× " + (s.items[k] || 0)));
          it.appendChild(row);
        });
        box.appendChild(it);
        box.appendChild(h("div", "font-size:13px;font-weight:800;color:#4a5f42;margin:20px 0 10px;", "🧰 材料"));
        var mg = h("div", "display:grid;grid-template-columns:repeat(5,1fr);gap:8px;");
        MATKEYS.forEach(function (k) {
          var cell = h("div", "padding:10px 4px;border-radius:14px;background:#fff;text-align:center;box-shadow:0 3px 10px rgba(100,130,90,.12);");
          cell.appendChild(h("div", "font-size:19px;", MATS[k].icon));
          cell.appendChild(h("div", "font-size:10px;color:#8b9a83;margin-top:3px;", MATS[k].name));
          cell.appendChild(h("div", "font-size:12px;font-weight:800;color:#46583e;margin-top:2px;", "×" + (s.mats[k] || 0)));
          mg.appendChild(cell);
        });
        box.appendChild(mg);
        box.appendChild(h("div", "font-size:13px;font-weight:800;color:#4a5f42;margin:20px 0 10px;", "🧺 收成"));
        var bk = Object.keys(s.barn).filter(function (k) { return s.barn[k] > 0 && CROP[k]; });
        box.appendChild(chipGrid(bk.map(function (k) { return { crop: CROP[k], n: s.barn[k] }; }), "仓库空空的"));
        box.appendChild(h("div", "font-size:13px;font-weight:800;color:#4a5f42;margin:20px 0 10px;", "🐟 鱼篓"));
        var fk = Object.keys(s.fish).filter(function (k) { return FISHMAP[k] && s.fish[k] > 0; });
        if (!fk.length) box.appendChild(h("div", "font-size:12px;color:#8b9a83;line-height:1.7;padding:2px 2px 6px;", "还没钓到鱼。"));
        else {
          var fg = h("div", "display:grid;grid-template-columns:repeat(3,1fr);gap:9px;");
          fk.forEach(function (k) {
            var f = FISHMAP[k];
            var card = h("div", "padding:10px 6px 9px;border-radius:16px;background:#fff;text-align:center;box-shadow:0 3px 10px rgba(100,130,90,.12);");
            var pic = h("div", "height:40px;display:flex;align-items:flex-end;justify-content:center;"); pic.innerHTML = fishSVG(f); card.appendChild(pic);
            card.appendChild(h("div", "font-size:11.5px;font-weight:700;color:#47593f;margin-top:6px;", f.name));
            card.appendChild(h("div", "font-size:10.5px;color:#9aa892;margin-top:1px;", "×" + s.fish[k]));
            fg.appendChild(card);
          });
          box.appendChild(fg);
        }
        box.appendChild(h("div", "font-size:13px;font-weight:800;color:#4a5f42;margin:22px 0 10px;", "📜 农事记"));
        var logBox = h("div", "font-size:11.5px;color:#7e8e76;line-height:1.9;background:rgba(255,255,255,.7);border-radius:16px;padding:12px 14px;max-height:200px;overflow-y:auto;white-space:pre-wrap;");
        logBox.className = "ft-scroll";
        logBox.textContent = s.log.length ? s.log.slice(0, 25).join("\n") : "还没有记录。";
        box.appendChild(logBox);
        return box;
      }
      function chipGrid(items, emptyText) {
        if (!items.length) return h("div", "font-size:12px;color:#8b9a83;line-height:1.7;padding:2px 2px 6px;", emptyText);
        var g = h("div", "display:grid;grid-template-columns:repeat(3,1fr);gap:9px;");
        items.forEach(function (it) {
          var card = h("div", "padding:10px 6px 9px;border-radius:16px;background:#fff;text-align:center;box-shadow:0 3px 10px rgba(100,130,90,.12);");
          var pic = h("div", "height:42px;display:flex;align-items:flex-end;justify-content:center;"); pic.innerHTML = plantSVG(it.crop, 3); card.appendChild(pic);
          card.appendChild(h("div", "font-size:11.5px;font-weight:700;color:#47593f;margin-top:6px;", it.crop.name));
          card.appendChild(h("div", "font-size:10.5px;color:#9aa892;margin-top:1px;", "×" + it.n));
          g.appendChild(card);
        });
        return g;
      }
      function dexArea() {
        var box = h("div", "padding:4px 14px 24px;");
        var tabs = h("div", "display:flex;gap:7px;margin:6px 0 12px;");
        [{ id: "nature", label: "🌿 自然" }, { id: "fish", label: "🐟 鱼类" }].forEach(function (t) {
          var b = h("div", ""); b.className = "ft-tab " + (dexTab === t.id ? "on" : "off");
          b.textContent = t.label; b.onclick = function () { dexTab = t.id; render(); };
          tabs.appendChild(b);
        });
        box.appendChild(tabs);
        if (dexTab === "nature") {
          var found = Object.keys(s.dex).filter(function (k) { return DEXMAP[k]; }).length;
          box.appendChild(h("div", "font-size:12.5px;font-weight:800;color:#4a5f42;margin-bottom:8px;", "已收集 " + found + " / " + DEX.length));
          var list = h("div", "display:flex;flex-direction:column;gap:8px;");
          DEX.forEach(function (d) {
            var has = !!s.dex[d.id];
            var row = h("div", "padding:11px 13px;border-radius:16px;background:" + (has ? "#fff" : "rgba(255,255,255,.5)") + ";box-shadow:0 3px 10px rgba(100,130,90,.10);");
            row.appendChild(h("div", "font-size:12.5px;font-weight:700;color:" + (has ? "#46583e" : "#9aa892") + ";", has ? "🌸 " + d.name + "　×" + s.dex[d.id] : "· · ·"));
            row.appendChild(h("div", "font-size:11.5px;color:" + (has ? "#7f8f78" : "#a8b5a1") + ";margin-top:3px;line-height:1.6;", has ? d.desc : "还没遇到过"));
            list.appendChild(row);
          });
          box.appendChild(list);
        } else {
          var foundF = Object.keys(s.fish).filter(function (k) { return FISHMAP[k] && s.fish[k] > 0; }).length;
          box.appendChild(h("div", "font-size:12.5px;font-weight:800;color:#4a5f42;margin-bottom:8px;", "已钓到 " + foundF + " / " + FISH.length));
          var fl = h("div", "display:flex;flex-direction:column;gap:8px;");
          FISH.forEach(function (f) {
            var has = (s.fish[f.id] || 0) > 0;
            var row = h("div", "display:flex;align-items:center;gap:11px;padding:10px 13px;border-radius:16px;background:" + (has ? "#fff" : "rgba(255,255,255,.5)") + ";box-shadow:0 3px 10px rgba(100,130,90,.10);");
            var pic = h("div", "width:44px;height:36px;flex:0 0 44px;");
            if (has) pic.innerHTML = fishSVG(f);
            else pic.appendChild(h("div", "width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;color:#c2cdbc;", "？"));
            row.appendChild(pic);
            var info = h("div", "flex:1;min-width:0;");
            info.appendChild(h("div", "font-size:12.5px;font-weight:700;color:" + (has ? "#46583e" : "#9aa892") + ";", has ? f.name + "　×" + s.fish[f.id] : "？？？"));
            info.appendChild(h("div", "font-size:11px;color:" + (has ? "#7f8f78" : "#a8b5a1") + ";margin-top:3px;line-height:1.6;", has ? f.desc : "还没钓到"));
            row.appendChild(info);
            if (has) row.appendChild(h("div", "font-size:11px;font-weight:700;color:#b8873a;", "🪙" + f.price));
            fl.appendChild(row);
          });
          box.appendChild(fl);
        }
        return box;
      }
      function exploreArea() {
        var box = h("div", "padding:4px 14px 24px;");
        var head = h("div", "display:flex;align-items:center;justify-content:space-between;margin:8px 0 4px;");
        head.appendChild(h("div", "font-size:14px;font-weight:800;color:#4a5f42;", "🌿 出门走走"));
        var dexBtn = h("div", "font-size:11.5px;font-weight:700;color:#4a6b40;background:rgba(255,255,255,.86);padding:6px 12px;border-radius:999px;cursor:pointer;box-shadow:0 2px 8px rgba(90,120,80,.14);", "📖 图鉴");
        dexBtn.onclick = function () { view = "dex"; dexTab = "nature"; render(); };
        head.appendChild(dexBtn); box.appendChild(head);
        box.appendChild(h("div", "font-size:11.5px;color:#8b9a83;margin-bottom:12px;line-height:1.6;", "选一个地方，进去之后点「开始探索」。每去一次消耗 12 点体力。当前体力 " + s.energy));
        var list = h("div", "display:flex;flex-direction:column;gap:10px;");
        SCENES.forEach(function (sc) {
          var card = h("div", "position:relative;border-radius:20px;overflow:hidden;height:110px;cursor:pointer;box-shadow:0 6px 18px rgba(80,110,70,.18);background:" + sc.bg + ";");
          card.className = "ft-scene";
          var fl = h("div", "position:absolute;inset:0;pointer-events:none;");
          [{ top: "12%", left: "8%" }, { top: "56%", left: "22%" }, { top: "24%", left: "72%" }, { top: "66%", left: "80%" }].forEach(function (sp, i) {
            var f = h("div", "position:absolute;font-size:" + (i % 2 ? 16 : 22) + "px;opacity:.7;animation-delay:" + (i * 0.6) + "s;", sc.icon);
            f.className = "ft-float"; f.style.top = sp.top; f.style.left = sp.left; fl.appendChild(f);
          });
          card.appendChild(fl);
          var inner = h("div", "position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:14px 16px;background:linear-gradient(180deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.72));");
          var t1 = h("div", "display:flex;align-items:center;gap:6px;");
          t1.appendChild(h("span", "font-size:18px;", sc.icon));
          t1.appendChild(h("div", "font-size:14px;font-weight:800;color:#3f5338;", sc.name));
          inner.appendChild(t1);
          inner.appendChild(h("div", "font-size:11px;color:#6d7d66;margin-top:3px;line-height:1.5;", sc.desc));
          card.appendChild(inner);
          card.onclick = function () { currentScene = sc.id; lastExplore = ""; view = "scene"; render(); };
          list.appendChild(card);
        });
        box.appendChild(list); return box;
      }
      function sceneArea() {
        var sc = SCENEMAP[currentScene] || SCENES[0];
        var night = currentScene === "firefly"; var fg = night ? "#e8f2e0" : "#3f5338";
        var box = h("div", "padding:0 0 24px;min-height:100%;display:flex;flex-direction:column;");
        var back = h("div", "margin:10px 14px 4px;font-size:12px;color:" + (night ? "#cfd8c8" : "#6d7d66") + ";cursor:pointer;display:inline-block;", "‹ 回到地图");
        back.onclick = function () { view = "explore"; render(); }; box.appendChild(back);
        var hero = h("div", "position:relative;margin:6px 14px 0;border-radius:24px;overflow:hidden;height:200px;box-shadow:0 8px 26px rgba(70,100,60,.22);background:" + sc.bg + ";");
        hero.className = "ft-scene";
        var fl = h("div", "position:absolute;inset:0;pointer-events:none;");
        for (var i = 0; i < 8; i++) {
          var f = h("div", "position:absolute;font-size:" + (12 + Math.floor(Math.random() * 16)) + "px;opacity:.66;animation-delay:" + (i * 0.45).toFixed(2) + "s;", sc.icon);
          f.className = "ft-float"; f.style.top = (8 + Math.random() * 78).toFixed(0) + "%"; f.style.left = (6 + Math.random() * 84).toFixed(0) + "%";
          fl.appendChild(f);
        }
        hero.appendChild(fl);
        var heroText = h("div", "position:absolute;left:0;right:0;bottom:0;padding:16px 18px;background:linear-gradient(180deg,rgba(255,255,255,0) 10%,rgba(255,255,255,.82));");
        heroText.appendChild(h("div", "font-size:20px;font-weight:800;color:" + fg + ";letter-spacing:1px;", sc.name));
        heroText.appendChild(h("div", "font-size:12px;color:" + (night ? "#b9c6b0" : "#5f7058") + ";margin-top:5px;line-height:1.6;", sc.desc));
        hero.appendChild(heroText); box.appendChild(hero);
        var flavor = h("div", "margin:14px 18px 0;font-size:12px;color:" + (night ? "#c6d2bd" : "#6d7d66") + ";line-height:1.8;font-style:italic;");
        flavor.textContent = sc.flavor[Math.floor(Math.random() * sc.flavor.length)];
        box.appendChild(flavor);
        if (lastExplore) {
          var res = h("div", "margin:14px 14px 0;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.86);font-size:12px;color:#4c5c46;line-height:1.7;box-shadow:0 4px 14px rgba(90,120,80,.14);");
          res.className = "ft-roll"; res.textContent = lastExplore; box.appendChild(res);
        }
        var btnWrap = h("div", "margin:20px 14px 0;display:flex;gap:10px;");
        var go = h("button", "flex:1;border:0;border-radius:18px;padding:15px 0;font:inherit;font-size:15px;font-weight:800;color:#fff;background:linear-gradient(160deg,#9ad97f,#5fbf6a);cursor:pointer;box-shadow:0 8px 22px rgba(90,170,80,.36);letter-spacing:2px;", "开始探索");
        go.type = "button"; go.onclick = doExplore; btnWrap.appendChild(go);
        var alone = h("button", "flex:0 0 92px;border:0;border-radius:18px;padding:15px 0;font:inherit;font-size:13px;font-weight:700;color:#5f7058;background:rgba(255,255,255,.86);cursor:pointer;box-shadow:0 4px 14px rgba(90,120,80,.16);", "让TA去");
        alone.type = "button";
        alone.onclick = function () {
          if (s.energy < 6) { toast("体力不够，先歇一歇吧"); return; }
          s.energy -= 6; var txt = exploreReward(s, currentScene, false);
          lastExplore = ch.name + "替你去了" + sc.name + "：" + txt;
          addLog(s, ch.name + "替你去了" + sc.name + "：" + txt);
          if (pref("showTalk", true) !== false) say("autoExplore");
          persist(); render();
        };
        btnWrap.appendChild(alone); box.appendChild(btnWrap);
        var pool = (sc.dexPool || []).filter(function (id) { return DEXMAP[id]; });
        if (pool.length) {
          var pb = h("div", "margin:20px 14px 0;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.6);");
          pb.appendChild(h("div", "font-size:11px;font-weight:800;color:#6d7d66;margin-bottom:6px;", "可能遇见"));
          var row = h("div", "display:flex;flex-wrap:wrap;gap:6px;");
          pool.forEach(function (id) {
            var d = DEXMAP[id]; var has = !!s.dex[id];
            row.appendChild(h("span", "font-size:11px;padding:3px 9px;border-radius:999px;background:" + (has ? "rgba(154,217,127,.34)" : "rgba(255,255,255,.75)") + ";color:" + (has ? "#4a6b40" : "#93a58a") + ";", has ? "✓ " + d.name : "？ " + (d.name.length > 2 ? d.name.slice(0, 1) + "…" : "？？")));
          });
          pb.appendChild(row); box.appendChild(pb);
        }
        return box;
      }
      function doExplore() {
        if (s.energy < 12) { toast("体力不够，先收工歇一歇吧"); return; }
        var sc = SCENEMAP[currentScene] || SCENES[0];
        s.energy -= 12; s.bond += 1;
        var txt = exploreReward(s, sc.id, false);
        lastExplore = txt; addLog(s, "去了" + sc.name + "：" + txt);
        if (pref("showTalk", true) !== false) say("explore");
        toast(txt); persist(); render();
      }
      function dock() {
        var bar = h("div", "flex:0 0 auto;padding:8px 8px calc(12px + env(safe-area-inset-bottom));display:flex;gap:5px;background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.72) 40%);");
        [{ id: "farm", ic: "🌱", label: "农场" }, { id: "home", ic: "🏡", label: "家园" }, { id: "fish", ic: "🎣", label: "钓鱼" }, { id: "shop", ic: "🏪", label: "商店" }, { id: "bag", ic: "🎒", label: "背包" }, { id: "explore", ic: "🌿", label: "探索" }].forEach(function (it) {
          var b = h("button", ""); b.type = "button";
          b.className = "ft-btn" + ((view === it.id || (it.id === "explore" && view === "scene")) ? " on" : "");
          b.style.flex = "1";
          b.innerHTML = '<span class="ic">' + it.ic + "</span>" + it.label;
          b.onclick = function (e) {
            if (e && e.stopPropagation) e.stopPropagation();
            if (view === it.id) return;
            if (holding) holding = null;
            cleanupDrag();
            stopFishing(); view = it.id; picking = -1; detailPlot = -1; render();
          };
          bar.appendChild(b);
        });
        var sleep = h("button", ""); sleep.type = "button"; sleep.className = "ft-btn"; sleep.style.flex = "0 0 46px";
        sleep.innerHTML = '<span class="ic">🌙</span>收工';
        sleep.onclick = endDay; bar.appendChild(sleep);
        return bar;
      }
      function endDay() {
        stopFishing();
        if (holding) holding = null;
        var witheredNow = 0, pestNow = 0, weedNow = 0;
        for (var i = 0; i < s.plots.length; i++) {
          var p = s.plots[i]; if (!p.crop || p.withered) continue;
          if (s.weather === "rain") p.water = 100; else p.water = Math.max(0, p.water - 30);
          p.fert = Math.max(0, p.fert - 6);
          var pestRate = s.weather === "rain" ? 0.10 : 0.06;
          if (p.pest < 90 && Math.random() < pestRate) { p.pest = Math.min(100, p.pest + 20); if (p.pest >= 50) pestNow++; }
          if (s.weather === "sunny" && p.pest > 0 && Math.random() < 0.15) p.pest = Math.max(0, p.pest - 10);
          if (!p.weed && Math.random() < 0.12) { p.weed = true; weedNow++; }
          if (p.water <= 0 && !matured(s, p)) { p.dry = (p.dry || 0) + 1; if (p.dry >= 2) { p.withered = true; witheredNow++; } }
          else if (p.water > 0) p.dry = 0;
          if (p.water > 0 && p.pest < 70) {
            var d = daysOf(CROP[p.crop]);
            if (p.fert >= 30) p.grown = Math.min(d, p.grown + 1);
            else if (Math.random() < 0.75) p.grown = Math.min(d, p.grown + 1);
            if (p.fert >= 30 && p.grown < d && Math.random() < 0.25) p.grown = Math.min(d, p.grown + 1);
          }
        }
        s.day += 1; s.market = null;
        var roll = Math.random();
        s.weather = roll < 0.28 ? "rain" : roll < 0.45 ? "cloud" : "sunny";
        if (s.weather === "rain") s.plots.forEach(function (p) { if (p.crop && !p.withered) p.water = 100; });
        s.energy = Math.min(s.maxEnergy, s.energy + (s.weather === "rain" ? 55 : 45));
        s.bond += 1;
        var autoText = "";
        if (pref("autoAct", true) !== false && Math.random() < 0.55) { var ev = autoAct(s, ch); if (ev) autoText = ev.text; }
        var animalText = "";
        if (Math.random() < 0.45) {
          var aev = animalVisit(s); animalText = aev.text;
          if (pref("showTalk", true) !== false) say(aev.kind === "steal" ? "animalSteal" : "animalGive");
        }
        var season = SEASONS[seasonOf(s)].name;
        addLog(s, "第 " + s.day + " 天 · " + season + " · " + (WEATHER[s.weather] || WEATHER.sunny).name);
        if (autoText) addLog(s, autoText);
        if (animalText) addLog(s, animalText);
        if (witheredNow) addLog(s, witheredNow + " 株苗枯掉了");
        if (witheredNow) { if (pref("showTalk", true) !== false && !animalText) say("wither"); }
        else if (pestNow) { if (pref("showTalk", true) !== false && !animalText) say("pest"); }
        else if (pref("showTalk", true) !== false && !animalText) say("sleep");
        var parts = [];
        parts.push("第 " + s.day + " 天 · " + season + " · " + (WEATHER[s.weather] || WEATHER.sunny).icon);
        if (s.weather === "rain") parts.push("雨水浇了地");
        if (witheredNow) parts.push(witheredNow + " 株枯了");
        if (pestNow) parts.push(pestNow + " 株有虫");
        if (weedNow) parts.push(weedNow + " 块长草");
        if (autoText) parts.push(autoText);
        if (animalText) parts.push(animalText);
        s.lastVisit = Date.now(); persist();
        offlineMsgs = []; flash = parts.join("　|　");
        if (flashTimer) clearTimeout(flashTimer);
        flashTimer = setTimeout(function () { flash = ""; render(); }, 3400);
        render();
      }
      (function boot() {
        var ps = ctx.personas.list() || [];
        var fixed = String(pref("partner", "") || "").trim();
        var target = null;
        if (fixed) target = ps.filter(function (p) { return p.id === fixed; })[0] || null;
        if (!target) { var last = kv.get("lastChar"); if (last) target = ps.filter(function (p) { return p.id === last; })[0] || null; }
        if (target) { ch = target; s = loadSave(target.id); offlineResolve(); }
        render();
      })();
      return function () {
        kv.set("appOpen", false); stopFishing();
        document.removeEventListener("pointermove", onDocMove);
        document.removeEventListener("pointerup", onDocUp);
        document.removeEventListener("pointercancel", onDocUp);
        prevMove = null; prevUp = null;
        if (ch && s) { s.lastVisit = Date.now(); saveSave(ch.id, s); }
      };
    });
  },
};