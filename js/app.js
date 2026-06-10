"use strict";

const { FILTER_ALL, matchesFilters, validateFoods } = FoodRules;
const DRAW_DURATION = 900;
const STORAGE_KEY = "food-lucky-box-exclusions-v1";
const CONFETTI_COLORS = ["#ff6655", "#ffc83d", "#9edbc5", "#c5b2ee", "#ffffff"];

const state = {
  foods: [],
  filters: {
    category: FILTER_ALL,
    meal: FILTER_ALL,
    budget: FILTER_ALL,
    spice: FILTER_ALL
  },
  excludedIds: loadStoredExclusions(),
  lastExcludedId: null,
  currentFood: null,
  pendingFood: null,
  isDeciding: false,
  skipRequested: false,
  drawTimer: null
};

const elements = {
  availableCount: document.querySelector("#available-count"),
  categoryFilter: document.querySelector("#category-filter"),
  mealFilter: document.querySelector("#meal-filter"),
  preferenceFilter: document.querySelector("#preference-filter"),
  machine: document.querySelector(".machine"),
  drawStage: document.querySelector("#draw-stage"),
  confettiLayer: document.querySelector("#confetti-layer"),
  foodCard: document.querySelector("#food-card"),
  foodImage: document.querySelector("#food-image"),
  foodName: document.querySelector("#food-name"),
  foodCuisine: document.querySelector("#food-cuisine"),
  foodCategory: document.querySelector("#food-category"),
  foodTags: document.querySelector("#food-tags"),
  foodReason: document.querySelector("#food-reason"),
  decideButton: document.querySelector("#decide-button"),
  decideLabel: document.querySelector("#decide-button .button-label"),
  quickDecideButton: document.querySelector("#quick-decide-button"),
  resultActions: document.querySelector("#result-actions"),
  againButton: document.querySelector("#again-button"),
  excludeButton: document.querySelector("#exclude-button"),
  nearbyLink: document.querySelector("#nearby-link"),
  takeoutLink: document.querySelector("#takeout-link"),
  statusMessage: document.querySelector("#status-message"),
  undoExclusion: document.querySelector("#undo-exclusion"),
  resetExclusions: document.querySelector("#reset-exclusions")
};

function loadStoredExclusions() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return new Set(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set();
  }
}

function persistExclusions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.excludedIds]));
  } catch {
    // Storage can be unavailable in privacy modes; the current session still works.
  }
}

async function loadFoods() {
  const response = await fetch("data/foods.json");
  if (!response.ok) {
    throw new Error(`菜单请求失败：HTTP ${response.status}`);
  }
  return validateFoods(await response.json());
}

function getAvailableFoods() {
  return state.foods.filter((food) =>
    matchesFilters(food, state.filters, state.excludedIds)
  );
}

function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createFilterButton(label, value, active = false) {
  const button = document.createElement("button");
  button.className = `filter-chip${active ? " is-active" : ""}`;
  button.type = "button";
  button.dataset.value = value;
  button.setAttribute("aria-pressed", String(active));
  button.textContent = label;
  return button;
}

function renderCategoryFilters() {
  const categories = [...new Set(state.foods.map((food) => food.category))];
  elements.categoryFilter.replaceChildren(
    createFilterButton("全部", FILTER_ALL, true),
    ...categories.map((category) => createFilterButton(category, category))
  );
}

function updateAvailability() {
  const available = getAvailableFoods();
  const excludedInView = state.foods.filter(
    (food) =>
      state.excludedIds.has(food.id) &&
      matchesFilters(food, state.filters, new Set())
  ).length;

  elements.availableCount.textContent =
    excludedInView > 0
      ? `${available.length} 道符合 · 已跳过 ${excludedInView} 道`
      : `${available.length} 道符合条件`;

  elements.resetExclusions.hidden = state.excludedIds.size === 0;
  const hasChoices = available.length > 0;
  elements.decideButton.disabled = !hasChoices;
  elements.quickDecideButton.disabled = !hasChoices;

  if (!hasChoices) {
    setStatus("没有符合全部条件的菜，放宽一项偏好试试。", true);
    elements.decideLabel.textContent = "没有符合条件的菜";
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
  elements.foodCategory.textContent = `${food.category} · ${food.meal}`;
  elements.foodImage.textContent = food.emoji || "🍽️";
  elements.foodImage.setAttribute("aria-label", `${food.name}的图标`);

  if (!preview) {
    renderTags([...food.tags, food.budget]);
    elements.foodReason.textContent = food.reason;
  }
}

function renderPlaceholder() {
  elements.foodImage.textContent = "🍽️";
  elements.foodImage.setAttribute("aria-label", "等待抽取的餐盘");
  elements.foodCuisine.textContent = "好运菜单";
  elements.foodCategory.textContent = "等待选择";
  elements.foodName.textContent = "准备好了吗？";
  renderTags(["随机", "惊喜"]);
  elements.foodReason.textContent = "按下按钮，让今天这一顿变得简单一点。";
}

function setDeciding(isDeciding) {
  state.isDeciding = isDeciding;
  elements.machine.classList.toggle("is-running", isDeciding);
  elements.foodCard.classList.toggle("is-shuffling", isDeciding);
  elements.foodName.classList.toggle("is-rolling", isDeciding);
  elements.decideButton.classList.toggle("is-deciding", isDeciding);
  elements.foodCard.setAttribute("aria-busy", String(isDeciding));
  elements.resultActions.hidden = true;
  elements.undoExclusion.hidden = true;
  elements.decideLabel.textContent = isDeciding ? "点击立即揭晓" : "再帮我选一个！";
  elements.quickDecideButton.querySelector("span:last-child").textContent = isDeciding
    ? "立即揭晓"
    : "马上帮我选";

  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.disabled = isDeciding;
  });
}

function launchConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const pieces = Array.from({ length: 14 }, (_, index) => {
    const piece = document.createElement("span");
    const angle = (Math.PI * 2 * index) / 14 + Math.random() * 0.35;
    const distance = 75 + Math.random() * 115;
    piece.className = "confetti";
    piece.style.setProperty("--confetti-color", CONFETTI_COLORS[index % CONFETTI_COLORS.length]);
    piece.style.setProperty("--confetti-x", `${Math.cos(angle) * distance}px`);
    piece.style.setProperty("--confetti-y", `${Math.sin(angle) * distance - 30}px`);
    piece.style.setProperty("--confetti-rotate", `${Math.random() * 480 - 240}deg`);
    return piece;
  });

  elements.confettiLayer.replaceChildren(...pieces);
  window.setTimeout(() => elements.confettiLayer.replaceChildren(), 900);
}

function updateActionLinks(food) {
  const query = encodeURIComponent(food.name);
  const isAndroid = /Android/i.test(navigator.userAgent);
  elements.nearbyLink.href = isAndroid
    ? `androidamap://poi?sourceApplication=choose_what_to_eat&keywords=${query}&dev=0`
    : `iosamap://poi?sourceApplication=choose_what_to_eat&name=${query}&dev=0`;
  elements.takeoutLink.href = `imeituan://www.meituan.com/search?q=${encodeURIComponent(`${food.name} 外卖`)}`;
  elements.nearbyLink.setAttribute("aria-label", `在地图中搜索附近的${food.name}`);
  elements.takeoutLink.setAttribute("aria-label", `在美团中搜索${food.name}外卖`);
}

function ensureResultVisible() {
  const bounds = elements.foodName.getBoundingClientRect();
  const isOutsideViewport = bounds.top < 0 || bounds.bottom > window.innerHeight;
  if (!isOutsideViewport) {
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  elements.foodCard.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "center"
  });
}

function revealFood(food) {
  state.currentFood = food;
  state.pendingFood = null;
  renderFood(food);
  setDeciding(false);
  elements.drawStage.textContent = "美味已开奖";
  elements.foodCard.classList.remove("is-revealed");
  requestAnimationFrame(() => elements.foodCard.classList.add("is-revealed"));
  launchConfetti();
  updateActionLinks(food);
  elements.resultActions.hidden = false;
  setStatus(`就是它了：${food.name}！`);
  updateAvailability();
  elements.foodName.setAttribute("tabindex", "-1");
  elements.foodName.focus({ preventScroll: true });
  requestAnimationFrame(ensureResultVisible);
}

function runPrizeRoll(foods, result) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    revealFood(result);
    return;
  }

  const startedAt = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - startedAt) / DRAW_DURATION, 1);
    renderFood(getRandomItem(foods), { preview: true });

    if (progress < 0.45) {
      elements.drawStage.textContent = "菜单翻动中";
    } else if (progress < 0.8) {
      elements.drawStage.textContent = "正在锁定美味";
    } else {
      elements.drawStage.textContent = "马上揭晓";
    }

    if (progress >= 1 || state.skipRequested) {
      state.drawTimer = null;
      revealFood(result);
      return;
    }

    const nextDelay = 86 + Math.pow(progress, 2) * 120;
    state.drawTimer = window.setTimeout(() => requestAnimationFrame(tick), nextDelay);
  };

  requestAnimationFrame(tick);
}

function decide() {
  if (state.isDeciding) {
    state.skipRequested = true;
    return;
  }

  const availableFoods = getAvailableFoods();
  if (availableFoods.length === 0) {
    updateAvailability();
    return;
  }

  const resultPool =
    availableFoods.length > 1 && state.currentFood
      ? availableFoods.filter((food) => food.id !== state.currentFood.id)
      : availableFoods;

  state.skipRequested = false;
  state.pendingFood = getRandomItem(resultPool);
  setStatus("好运正在翻菜单，再点一次可以立即揭晓。");
  setDeciding(true);
  renderTags(["挑选中", "可立即揭晓"]);
  elements.foodReason.textContent = "菜单正在快速翻动，答案马上出现。";
  runPrizeRoll(availableFoods, state.pendingFood);
}

function resetCurrentResult(message) {
  state.currentFood = null;
  elements.drawStage.textContent = "等待开奖";
  elements.resultActions.hidden = true;
  renderPlaceholder();
  setStatus(message);
  updateAvailability();
}

function updatePressedState(group, selectedButton, filterName) {
  group.querySelectorAll(`[data-filter="${filterName}"], button:not([data-filter])`).forEach((button) => {
    if (button.dataset.filter && button.dataset.filter !== filterName) {
      return;
    }
    const selected = button === selectedButton;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function selectSimpleFilter(filterName, value, button, group) {
  if (state.isDeciding || state.filters[filterName] === value) {
    return;
  }
  state.filters[filterName] = value;
  updatePressedState(group, button, filterName);
  resetCurrentResult("筛选已更新，看看今天会抽到什么。");
}

function excludeCurrentFood() {
  if (!state.currentFood || state.isDeciding) {
    return;
  }

  const excluded = state.currentFood;
  state.excludedIds.add(excluded.id);
  state.lastExcludedId = excluded.id;
  persistExclusions();
  state.currentFood = null;
  elements.resultActions.hidden = true;
  elements.undoExclusion.hidden = false;
  renderPlaceholder();
  updateAvailability();
  setStatus(`已跳过${excluded.name}。可以撤销，或继续抽一道。`);
}

function undoLastExclusion() {
  if (!state.lastExcludedId) {
    return;
  }
  const food = state.foods.find((item) => item.id === state.lastExcludedId);
  state.excludedIds.delete(state.lastExcludedId);
  state.lastExcludedId = null;
  persistExclusions();
  elements.undoExclusion.hidden = true;
  setStatus(food ? `已恢复${food.name}。` : "已恢复刚才跳过的菜品。");
  updateAvailability();
}

function resetExclusions() {
  state.excludedIds.clear();
  state.lastExcludedId = null;
  persistExclusions();
  elements.undoExclusion.hidden = true;
  setStatus("已恢复完整菜单，所有菜品都可以再次抽到。");
  updateAvailability();
}

function bindSingleSelect(group, filterName) {
  group.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-chip");
    if (button) {
      selectSimpleFilter(filterName, button.dataset.value, button, group);
    }
  });
}

function bindEvents() {
  elements.decideButton.addEventListener("click", decide);
  elements.quickDecideButton.addEventListener("click", decide);
  elements.againButton.addEventListener("click", decide);
  elements.excludeButton.addEventListener("click", excludeCurrentFood);
  elements.undoExclusion.addEventListener("click", undoLastExclusion);
  elements.resetExclusions.addEventListener("click", resetExclusions);

  bindSingleSelect(elements.categoryFilter, "category");
  bindSingleSelect(elements.mealFilter, "meal");

  elements.preferenceFilter.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-chip");
    if (button) {
      selectSimpleFilter(button.dataset.filter, button.dataset.value, button, elements.preferenceFilter);
    }
  });
}

async function initialize() {
  bindEvents();
  try {
    state.foods = await loadFoods();
    state.excludedIds = new Set(
      [...state.excludedIds].filter((id) => state.foods.some((food) => food.id === id))
    );
    persistExclusions();
    renderCategoryFilters();
    setStatus("菜单准备好了，直接抽，或者先给一点方向。");
    updateAvailability();
  } catch (error) {
    console.error(error);
    elements.availableCount.textContent = "菜单加载失败";
    elements.decideLabel.textContent = "请通过本地服务打开";
    elements.decideButton.disabled = true;
    elements.quickDecideButton.disabled = true;
    setStatus("未能加载菜单。请运行 ./run.sh start 后通过浏览器访问。", true);
  }
}

initialize();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("Service Worker 注册失败：", error);
    });
  });
}
