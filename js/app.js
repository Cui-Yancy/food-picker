"use strict";

const { FILTER_ALL, matchesFilters, validateFoods } = FoodRules;
const DRAW_DURATION = 900;
const STORAGE_KEY = "food-lucky-box-exclusions-v1";
const CONFETTI_COLORS = ["#ff6655", "#ffc83d", "#9edbc5", "#c5b2ee", "#ffffff"];

const state = {
  foods: [],
  customItems: [],
  customRevision: 0,
  customUpdatedAt: null,
  isSyncing: false,
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
  resetExclusions: document.querySelector("#reset-exclusions"),
  openLibrary: document.querySelector("#open-library"),
  closeLibrary: document.querySelector("#close-library"),
  libraryDialog: document.querySelector("#library-dialog"),
  customCount: document.querySelector("#custom-count"),
  syncStatus: document.querySelector("#sync-status"),
  libraryListView: document.querySelector("#library-list-view"),
  customItemsList: document.querySelector("#custom-items-list"),
  emptyLibrary: document.querySelector("#empty-library"),
  refreshLibrary: document.querySelector("#refresh-library"),
  addCustomItem: document.querySelector("#add-custom-item"),
  customItemForm: document.querySelector("#custom-item-form"),
  customItemId: document.querySelector("#custom-item-id"),
  formTitle: document.querySelector("#form-title"),
  cancelCustomItem: document.querySelector("#cancel-custom-item"),
  formMessage: document.querySelector("#form-message"),
  saveCustomItem: document.querySelector("#save-custom-item")
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
  const response = await fetch("/api/foods", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`菜单请求失败：HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!payload.ok || !payload.data || !Array.isArray(payload.data.items)) {
    throw new Error("菜单响应格式不正确");
  }
  return {
    foods: validateFoods(payload.data.items),
    customItems: payload.data.items.filter((item) => item.id.startsWith("custom-")),
    revision: payload.data.revision,
    updatedAt: payload.data.updatedAt
  };
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
  if (!categories.includes(state.filters.category)) {
    state.filters.category = FILTER_ALL;
  }
  elements.categoryFilter.replaceChildren(
    createFilterButton("全部", FILTER_ALL, state.filters.category === FILTER_ALL),
    ...categories.map((category) =>
      createFilterButton(category, category, state.filters.category === category)
    )
  );
}

function formatSyncTime(value) {
  if (!value) {
    return "尚无共享记录";
  }
  return `更新于 ${new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value))}`;
}

function setSyncStatus(message, isWarning = false) {
  elements.syncStatus.textContent = message;
  elements.syncStatus.classList.toggle("is-warning", isWarning);
}

function renderCustomItems() {
  elements.customCount.textContent = String(state.customItems.length);
  elements.emptyLibrary.hidden = state.customItems.length > 0;
  elements.customItemsList.replaceChildren(
    ...state.customItems.map((item) => {
      const card = document.createElement("article");
      card.className = "custom-item-card";

      const visual = document.createElement("span");
      visual.className = "custom-item-emoji";
      visual.textContent = item.emoji || "🍽️";
      visual.setAttribute("aria-hidden", "true");

      const content = document.createElement("div");
      content.className = "custom-item-content";
      const name = document.createElement("h3");
      name.textContent = item.name;
      const meta = document.createElement("p");
      meta.textContent = `${item.itemType === "food" ? "菜品" : "餐厅"} · ${item.category} · ${item.cuisine}`;
      content.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "custom-item-actions";
      const edit = document.createElement("button");
      edit.className = "mini-button";
      edit.type = "button";
      edit.dataset.action = "edit";
      edit.dataset.id = item.id;
      edit.textContent = "编辑";
      const remove = document.createElement("button");
      remove.className = "mini-button is-danger";
      remove.type = "button";
      remove.dataset.action = "delete";
      remove.dataset.id = item.id;
      remove.textContent = "删除";
      actions.append(edit, remove);

      card.append(visual, content, actions);
      return card;
    })
  );
  setSyncStatus(formatSyncTime(state.customUpdatedAt));
}

function applyLoadedFoods(result, { announce = false } = {}) {
  state.foods = result.foods;
  state.customItems = result.customItems;
  state.customRevision = result.revision;
  state.customUpdatedAt = result.updatedAt;
  if (state.currentFood) {
    const refreshedCurrentFood = state.foods.find((food) => food.id === state.currentFood.id);
    if (refreshedCurrentFood) {
      state.currentFood = refreshedCurrentFood;
      renderFood(refreshedCurrentFood);
      updateActionLinks(refreshedCurrentFood);
    } else {
      state.currentFood = null;
      elements.drawStage.textContent = "等待开奖";
      elements.resultActions.hidden = true;
      renderPlaceholder();
    }
  }
  state.excludedIds = new Set(
    [...state.excludedIds].filter((id) => state.foods.some((food) => food.id === id))
  );
  persistExclusions();
  renderCategoryFilters();
  renderCustomItems();
  updateAvailability();
  if (announce) {
    setStatus(`已同步家庭美食库，共有 ${state.customItems.length} 条共享美食。`);
  }
}

async function syncFoods({ announce = false } = {}) {
  if (state.isSyncing || state.isDeciding) {
    return;
  }
  state.isSyncing = true;
  elements.refreshLibrary.disabled = true;
  setSyncStatus("正在同步...");
  try {
    applyLoadedFoods(await loadFoods(), { announce });
  } catch (error) {
    console.error(error);
    setSyncStatus("同步失败，请检查家庭服务器", true);
    if (announce) {
      setStatus("家庭美食库同步失败，当前菜单仍可继续使用。", true);
    }
    throw error;
  } finally {
    state.isSyncing = false;
    elements.refreshLibrary.disabled = false;
  }
}

function showLibraryList() {
  elements.customItemForm.hidden = true;
  elements.libraryListView.hidden = false;
  elements.formMessage.textContent = "";
}

function showCustomItemForm(item = null) {
  elements.libraryListView.hidden = true;
  elements.customItemForm.hidden = false;
  elements.customItemForm.reset();
  elements.customItemId.value = item ? item.id : "";
  elements.formTitle.textContent = item ? "编辑共享美食" : "新增美食";
  elements.saveCustomItem.textContent = item ? "保存修改" : "保存到家庭美食库";
  elements.formMessage.textContent = "";
  elements.formMessage.classList.remove("is-warning");

  if (item) {
    Object.entries({
      name: item.name,
      itemType: item.itemType || "restaurant",
      emoji: item.emoji || "🍽️",
      category: item.category,
      cuisine: item.cuisine,
      meal: item.meal,
      budget: item.budget,
      spice: item.spice,
      tags: item.tags.join(", "),
      reason: item.reason,
      searchKeyword: item.searchKeyword || item.name
    }).forEach(([name, value]) => {
      const field = elements.customItemForm.elements.namedItem(name);
      if (field) {
        field.value = value;
      }
    });
  }
  elements.customItemForm.elements.namedItem("name").focus();
}

function formPayload() {
  const data = new FormData(elements.customItemForm);
  return {
    itemType: data.get("itemType"),
    name: data.get("name"),
    category: data.get("category"),
    cuisine: data.get("cuisine"),
    tags: String(data.get("tags") || "")
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
    reason: data.get("reason"),
    emoji: data.get("emoji") || "🍽️",
    image: "",
    meal: data.get("meal"),
    budget: data.get("budget"),
    spice: data.get("spice"),
    searchKeyword: data.get("searchKeyword") || data.get("name")
  };
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    const error = new Error(payload.error || `请求失败：HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function saveCustomItem(event) {
  event.preventDefault();
  if (!elements.customItemForm.reportValidity()) {
    return;
  }

  const itemId = elements.customItemId.value;
  elements.saveCustomItem.disabled = true;
  elements.formMessage.textContent = "正在保存...";
  elements.formMessage.classList.remove("is-warning");
  try {
    await apiRequest(
      itemId ? `/api/custom-items/${encodeURIComponent(itemId)}` : "/api/custom-items",
      {
        method: itemId ? "PUT" : "POST",
        headers: itemId ? { "If-Match": String(state.customRevision) } : {},
        body: JSON.stringify(formPayload())
      }
    );
    await syncFoods();
    showLibraryList();
    setSyncStatus(itemId ? "修改已共享给家人" : "新美食已共享给家人");
    setStatus(itemId ? "家庭美食库中的记录已更新。" : "已加入家庭美食库，可以参与随机抽取了。");
  } catch (error) {
    console.error(error);
    elements.formMessage.textContent =
      error.status === 409 ? `${error.message}，已为你同步最新数据。` : error.message;
    elements.formMessage.classList.add("is-warning");
    if (error.status === 409) {
      await syncFoods().catch(() => {});
    }
  } finally {
    elements.saveCustomItem.disabled = false;
  }
}

async function deleteCustomItem(item) {
  if (!window.confirm(`确定从家庭美食库删除“${item.name}”吗？`)) {
    return;
  }
  setSyncStatus(`正在删除${item.name}...`);
  try {
    await apiRequest(`/api/custom-items/${encodeURIComponent(item.id)}`, {
      method: "DELETE",
      headers: { "If-Match": String(state.customRevision) }
    });
    await syncFoods();
    setSyncStatus("已删除，家人刷新后即可看到");
    if (state.currentFood && state.currentFood.id === item.id) {
      resetCurrentResult("刚才的结果已从家庭美食库删除，请重新抽取。");
    }
  } catch (error) {
    console.error(error);
    setSyncStatus(error.message, true);
    if (error.status === 409) {
      await syncFoods().catch(() => {});
    }
  }
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
  const searchTerm = food.searchKeyword || food.name;
  const query = encodeURIComponent(searchTerm);
  const isAndroid = /Android/i.test(navigator.userAgent);
  elements.nearbyLink.href = isAndroid
    ? `androidamap://poi?sourceApplication=choose_what_to_eat&keywords=${query}&dev=0`
    : `iosamap://poi?sourceApplication=choose_what_to_eat&name=${query}&dev=0`;
  elements.takeoutLink.href = `imeituan://www.meituan.com/search?q=${encodeURIComponent(`${searchTerm} 外卖`)}`;
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
  elements.openLibrary.addEventListener("click", () => {
    showLibraryList();
    elements.libraryDialog.showModal();
    syncFoods().catch(() => {});
  });
  elements.closeLibrary.addEventListener("click", () => elements.libraryDialog.close());
  elements.libraryDialog.addEventListener("click", (event) => {
    if (event.target === elements.libraryDialog) {
      elements.libraryDialog.close();
    }
  });
  elements.refreshLibrary.addEventListener("click", () => syncFoods({ announce: true }).catch(() => {}));
  elements.addCustomItem.addEventListener("click", () => showCustomItemForm());
  elements.cancelCustomItem.addEventListener("click", showLibraryList);
  elements.customItemForm.addEventListener("submit", saveCustomItem);
  elements.customItemsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }
    const item = state.customItems.find((candidate) => candidate.id === button.dataset.id);
    if (!item) {
      return;
    }
    if (button.dataset.action === "edit") {
      showCustomItemForm(item);
    } else if (button.dataset.action === "delete") {
      deleteCustomItem(item);
    }
  });
  window.addEventListener("focus", () => {
    if (state.foods.length > 0) {
      syncFoods().catch(() => {});
    }
  });

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
    applyLoadedFoods(await loadFoods());
    setStatus("菜单准备好了，直接抽，或者先给一点方向。");
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
