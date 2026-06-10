"use strict";

const CATEGORY_ALL = "全部";
const SHUFFLE_DURATION = 1600;
const SHUFFLE_INTERVAL = 85;

// Browsers commonly block fetch() for file:// pages. This compact fallback
// keeps direct-open mode useful while foods.json remains the canonical dataset.
const OFFLINE_FOOD_ROWS = [
  ["cn-001", "宫保鸡丁", "中餐", "川菜", "🍗"],
  ["cn-002", "麻婆豆腐", "中餐", "川菜", "🌶️"],
  ["cn-003", "鱼香肉丝", "中餐", "川菜", "🥢"],
  ["cn-004", "回锅肉", "中餐", "川菜", "🥓"],
  ["cn-005", "水煮鱼", "中餐", "川菜", "🐟"],
  ["cn-006", "糖醋里脊", "中餐", "鲁菜", "🍖"],
  ["cn-007", "红烧肉", "中餐", "本帮菜", "🍖"],
  ["cn-008", "白切鸡", "中餐", "粤菜", "🍗"],
  ["cn-009", "叉烧饭", "中餐", "粤菜", "🍱"],
  ["cn-010", "煲仔饭", "中餐", "粤菜", "🍚"],
  ["cn-011", "广式烧鹅", "中餐", "粤菜", "🍗"],
  ["cn-012", "梅菜扣肉", "中餐", "客家菜", "🥩"],
  ["cn-013", "小炒黄牛肉", "中餐", "湘菜", "🥩"],
  ["cn-014", "剁椒鱼头", "中餐", "湘菜", "🐟"],
  ["cn-015", "东坡肉", "中餐", "浙菜", "🍖"],
  ["cn-016", "西湖醋鱼", "中餐", "浙菜", "🐟"],
  ["cn-017", "番茄炒蛋", "中餐", "家常菜", "🍅"],
  ["cn-018", "地三鲜", "中餐", "东北菜", "🍆"],
  ["cn-019", "锅包肉", "中餐", "东北菜", "🍖"],
  ["cn-020", "黄焖鸡米饭", "中餐", "鲁菜", "🍲"],
  ["cn-021", "海南鸡饭", "中餐", "海南菜", "🍗"],
  ["cn-022", "扬州炒饭", "中餐", "淮扬菜", "🍛"],
  ["cn-023", "葱爆羊肉", "中餐", "京菜", "🥩"],
  ["cn-024", "烤鸭卷饼", "中餐", "京菜", "🫓"],
  ["noodle-001", "兰州牛肉面", "面食", "西北面食", "🍜"],
  ["noodle-002", "重庆小面", "面食", "重庆面食", "🍜"],
  ["noodle-003", "武汉热干面", "面食", "湖北面食", "🍝"],
  ["noodle-004", "老北京炸酱面", "面食", "北京面食", "🍜"],
  ["noodle-005", "山西刀削面", "面食", "山西面食", "🍜"],
  ["noodle-006", "陕西油泼面", "面食", "陕西面食", "🍜"],
  ["noodle-007", "岐山臊子面", "面食", "陕西面食", "🍜"],
  ["noodle-008", "河南烩面", "面食", "河南面食", "🍜"],
  ["noodle-009", "上海葱油拌面", "面食", "本帮面食", "🍝"],
  ["noodle-010", "宜宾燃面", "面食", "四川面食", "🍜"],
  ["noodle-011", "螺蛳粉", "面食", "广西米粉", "🍜"],
  ["noodle-012", "桂林米粉", "面食", "广西米粉", "🍜"],
  ["noodle-013", "云南过桥米线", "面食", "云南米线", "🍜"],
  ["noodle-014", "广东云吞面", "面食", "粤式面食", "🥟"],
  ["noodle-015", "牛肉板面", "面食", "安徽面食", "🍜"],
  ["noodle-016", "猪肉白菜水饺", "面食", "北方面食", "🥟"],
  ["hot-001", "重庆麻辣火锅", "火锅烧烤", "重庆", "🍲"],
  ["hot-002", "潮汕牛肉火锅", "火锅烧烤", "潮汕", "🥩"],
  ["hot-003", "老北京铜锅涮肉", "火锅烧烤", "北京", "🍲"],
  ["hot-004", "椰子鸡火锅", "火锅烧烤", "海南", "🥥"],
  ["hot-005", "酸汤鱼火锅", "火锅烧烤", "贵州", "🐟"],
  ["hot-006", "串串香", "火锅烧烤", "四川", "🍢"],
  ["hot-007", "麻辣香锅", "火锅烧烤", "川味", "🍲"],
  ["hot-008", "东北烤串", "火锅烧烤", "东北", "🍢"],
  ["hot-009", "新疆羊肉串", "火锅烧烤", "新疆", "🍢"],
  ["hot-010", "韩式烤肉", "火锅烧烤", "韩国料理", "🥓"],
  ["hot-011", "广式打边炉", "火锅烧烤", "粤菜", "🍲"],
  ["hot-012", "纸上烤鱼", "火锅烧烤", "川味", "🐟"],
  ["asia-001", "三文鱼寿司", "日料韩餐", "日本料理", "🍣"],
  ["asia-002", "日式豚骨拉面", "日料韩餐", "日本料理", "🍜"],
  ["asia-003", "日式咖喱饭", "日料韩餐", "日本料理", "🍛"],
  ["asia-004", "鳗鱼饭", "日料韩餐", "日本料理", "🍱"],
  ["asia-005", "天妇罗定食", "日料韩餐", "日本料理", "🍤"],
  ["asia-006", "大阪烧", "日料韩餐", "日本料理", "🥞"],
  ["asia-007", "日式炸猪排", "日料韩餐", "日本料理", "🍛"],
  ["asia-008", "韩式石锅拌饭", "日料韩餐", "韩国料理", "🍚"],
  ["asia-009", "韩式部队锅", "日料韩餐", "韩国料理", "🍲"],
  ["asia-010", "韩式炸鸡", "日料韩餐", "韩国料理", "🍗"],
  ["asia-011", "泡菜五花肉炒饭", "日料韩餐", "韩国料理", "🍛"],
  ["asia-012", "韩式冷面", "日料韩餐", "韩国料理", "🍜"],
  ["west-001", "经典牛肉汉堡", "西餐快餐", "美式快餐", "🍔"],
  ["west-002", "香辣鸡腿堡", "西餐快餐", "美式快餐", "🍔"],
  ["west-003", "玛格丽特披萨", "西餐快餐", "意大利菜", "🍕"],
  ["west-004", "意大利肉酱面", "西餐快餐", "意大利菜", "🍝"],
  ["west-005", "奶油培根意面", "西餐快餐", "意大利菜", "🍝"],
  ["west-006", "黑椒牛排", "西餐快餐", "西餐", "🥩"],
  ["west-007", "炸鱼薯条", "西餐快餐", "英国菜", "🍟"],
  ["west-008", "墨西哥鸡肉卷", "西餐快餐", "墨西哥风味", "🌯"],
  ["west-009", "越南牛肉河粉", "西餐快餐", "东南亚料理", "🍜"],
  ["west-010", "泰式冬阴功汤面", "西餐快餐", "东南亚料理", "🍜"],
  ["west-011", "泰式菠萝炒饭", "西餐快餐", "东南亚料理", "🍍"],
  ["west-012", "新加坡海南鸡饭", "西餐快餐", "东南亚料理", "🍗"],
  ["west-013", "马来西亚叻沙", "西餐快餐", "东南亚料理", "🍜"],
  ["west-014", "印度黄油鸡咖喱", "西餐快餐", "印度料理", "🍛"],
  ["light-001", "鸡胸肉能量碗", "轻食甜品", "轻食", "🥗"],
  ["light-002", "牛油果虾仁沙拉", "轻食甜品", "轻食", "🥗"],
  ["light-003", "金枪鱼全麦三明治", "轻食甜品", "轻食", "🥪"],
  ["light-004", "烟熏三文鱼贝果", "轻食甜品", "早午餐", "🥯"],
  ["light-005", "希腊酸奶水果碗", "轻食甜品", "轻食", "🥣"],
  ["light-006", "凯撒鸡肉沙拉", "轻食甜品", "西式轻食", "🥗"],
  ["light-007", "法式可颂", "轻食甜品", "法式烘焙", "🥐"],
  ["light-008", "提拉米苏", "轻食甜品", "意式甜品", "🍰"],
  ["light-009", "巴斯克芝士蛋糕", "轻食甜品", "西式甜品", "🍰"],
  ["light-010", "芒果糯米饭", "轻食甜品", "泰式甜品", "🥭"],
  ["light-011", "杨枝甘露", "轻食甜品", "港式甜品", "🥭"],
  ["light-012", "双皮奶", "轻食甜品", "广式甜品", "🥛"],
  ["light-013", "红豆抹茶刨冰", "轻食甜品", "日式甜品", "🍧"],
  ["light-014", "鲜果舒芙蕾", "轻食甜品", "西式甜品", "🥞"]
];

const state = {
  foods: [],
  selectedCategory: CATEGORY_ALL,
  excludedIds: new Set(),
  currentFood: null,
  isDeciding: false,
  shuffleTimer: null
};

const elements = {
  availableCount: document.querySelector("#available-count"),
  filterList: document.querySelector("#filter-list"),
  foodCard: document.querySelector("#food-card"),
  foodImage: document.querySelector("#food-image"),
  foodName: document.querySelector("#food-name"),
  foodCuisine: document.querySelector("#food-cuisine"),
  foodCategory: document.querySelector("#food-category"),
  foodTags: document.querySelector("#food-tags"),
  foodReason: document.querySelector("#food-reason"),
  decideButton: document.querySelector("#decide-button"),
  decideLabel: document.querySelector("#decide-button .button-label"),
  resultActions: document.querySelector("#result-actions"),
  againButton: document.querySelector("#again-button"),
  excludeButton: document.querySelector("#exclude-button"),
  statusMessage: document.querySelector("#status-message"),
  resetExclusions: document.querySelector("#reset-exclusions")
};

function createOfflineFoods() {
  return OFFLINE_FOOD_ROWS.map(([id, name, category, cuisine, emoji]) => ({
    id,
    name,
    category,
    cuisine,
    emoji,
    image: "",
    tags: [cuisine, category],
    reason: `${name}很适合现在的心情，跟着这次随机选择去尝尝吧。`
  }));
}

async function loadFoods() {
  try {
    const response = await fetch("data/foods.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const foods = await response.json();
    if (!Array.isArray(foods) || foods.length === 0) {
      throw new Error("菜单数据为空");
    }

    return foods;
  } catch (error) {
    console.info("foods.json 无法通过 fetch 加载，已切换到直接打开模式。", error);
    return createOfflineFoods();
  }
}

function getAvailableFoods() {
  return state.foods.filter((food) => {
    const categoryMatches =
      state.selectedCategory === CATEGORY_ALL || food.category === state.selectedCategory;
    return categoryMatches && !state.excludedIds.has(food.id);
  });
}

function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function updateAvailability() {
  const available = getAvailableFoods();
  const categoryTotal = state.foods.filter(
    (food) => state.selectedCategory === CATEGORY_ALL || food.category === state.selectedCategory
  ).length;
  const hiddenCount = categoryTotal - available.length;

  elements.availableCount.textContent =
    hiddenCount > 0
      ? `还有 ${available.length} 道可选 · 已跳过 ${hiddenCount} 道`
      : `共有 ${available.length} 道可选`;

  elements.resetExclusions.hidden = state.excludedIds.size === 0;
  elements.decideButton.disabled = state.isDeciding || available.length === 0;

  if (available.length === 0) {
    setStatus("这个分类已经全部跳过啦，换个分类或恢复菜单吧。", true);
    elements.decideLabel.textContent = "暂时没有可选菜品";
  } else if (!state.isDeciding) {
    elements.decideLabel.textContent = state.currentFood ? "再帮我选一个！" : "帮我决定！";
  }
}

function setStatus(message = "", isWarning = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.toggle("is-warning", isWarning);
}

function renderTags(tags = []) {
  elements.foodTags.replaceChildren(
    ...tags.slice(0, 4).map((tag) => {
      const item = document.createElement("span");
      item.className = "food-tag";
      item.textContent = tag;
      return item;
    })
  );
}

function renderFood(food, { preview = false } = {}) {
  elements.foodName.textContent = food.name;
  elements.foodCuisine.textContent = food.cuisine;
  elements.foodCategory.textContent = food.category;

  if (food.image) {
    const image = document.createElement("img");
    image.src = food.image;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener(
      "error",
      () => {
        elements.foodImage.textContent = food.emoji || "🍽️";
      },
      { once: true }
    );
    elements.foodImage.replaceChildren(image);
  } else {
    elements.foodImage.textContent = food.emoji || "🍽️";
  }

  elements.foodImage.setAttribute("aria-label", `${food.name}的卡通图标`);

  if (!preview) {
    renderTags(food.tags);
    elements.foodReason.textContent = food.reason;
  }
}

function setDeciding(isDeciding) {
  state.isDeciding = isDeciding;
  elements.foodCard.classList.toggle("is-shuffling", isDeciding);
  elements.foodName.classList.toggle("is-rolling", isDeciding);
  elements.decideButton.classList.toggle("is-deciding", isDeciding);
  elements.resultActions.hidden = true;
  elements.decideButton.disabled = isDeciding;
  elements.decideLabel.textContent = isDeciding ? "正在翻菜单..." : "再帮我选一个！";

  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.disabled = isDeciding;
  });
}

function revealFood(food) {
  state.currentFood = food;
  renderFood(food);
  setDeciding(false);

  elements.foodCard.classList.remove("is-revealed");
  void elements.foodCard.offsetWidth;
  elements.foodCard.classList.add("is-revealed");
  elements.resultActions.hidden = false;
  setStatus(`就是它了：${food.name}！`);
  updateAvailability();
}

function decide() {
  const availableFoods = getAvailableFoods();
  if (state.isDeciding || availableFoods.length === 0) {
    updateAvailability();
    return;
  }

  const resultPool =
    availableFoods.length > 1 && state.currentFood
      ? availableFoods.filter((food) => food.id !== state.currentFood.id)
      : availableFoods;

  setStatus("好运正在翻菜单...");
  setDeciding(true);
  renderTags(["挑选中", "马上揭晓"]);
  elements.foodReason.textContent = "菜单快速翻动中，答案马上出现。";

  state.shuffleTimer = window.setInterval(() => {
    renderFood(getRandomItem(availableFoods), { preview: true });
  }, SHUFFLE_INTERVAL);

  window.setTimeout(() => {
    window.clearInterval(state.shuffleTimer);
    state.shuffleTimer = null;
    revealFood(getRandomItem(resultPool));
  }, SHUFFLE_DURATION);
}

function selectCategory(category, selectedButton) {
  if (state.isDeciding) {
    return;
  }

  state.selectedCategory = category;
  state.currentFood = null;
  elements.resultActions.hidden = true;

  document.querySelectorAll(".filter-chip").forEach((button) => {
    const isSelected = button === selectedButton;
    button.classList.toggle("is-active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  setStatus(category === CATEGORY_ALL ? "已切换到全部菜单。" : `只看${category}，开始挑选吧。`);
  updateAvailability();
}

function excludeCurrentFood() {
  if (!state.currentFood || state.isDeciding) {
    return;
  }

  const excludedName = state.currentFood.name;
  state.excludedIds.add(state.currentFood.id);
  state.currentFood = null;
  elements.resultActions.hidden = true;
  updateAvailability();

  if (getAvailableFoods().length > 0) {
    setStatus(`已暂时跳过${excludedName}，正在换一道...`);
    window.setTimeout(decide, 320);
  }
}

function resetExclusions() {
  state.excludedIds.clear();
  setStatus("已恢复完整菜单，所有菜品都可以再次抽到。");
  updateAvailability();
}

function bindEvents() {
  elements.decideButton.addEventListener("click", decide);
  elements.againButton.addEventListener("click", decide);
  elements.excludeButton.addEventListener("click", excludeCurrentFood);
  elements.resetExclusions.addEventListener("click", resetExclusions);

  elements.filterList.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-chip");
    if (button) {
      selectCategory(button.dataset.category, button);
    }
  });
}

async function initialize() {
  bindEvents();
  state.foods = await loadFoods();
  elements.decideButton.disabled = false;
  elements.decideLabel.textContent = "帮我决定！";
  setStatus("菜单准备好了，交给今天的好运吧。");
  updateAvailability();
}

initialize();
