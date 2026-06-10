"use strict";

(function createFoodRules(globalObject) {
  const FILTER_ALL = "全部";
  const REQUIRED_FIELDS = ["id", "name", "category", "cuisine", "tags", "reason", "emoji"];
  const DESSERT_WORDS = ["甜品", "蛋糕", "酸奶", "可颂", "双皮奶", "刨冰", "舒芙蕾", "芒果糯米饭"];
  const LIGHT_WORDS = ["轻食", "沙拉", "三明治", "贝果", "能量碗"];
  const PREMIUM_WORDS = ["牛排", "鳗鱼", "三文鱼", "烧鹅", "烤鸭", "鱼头", "海鲜"];
  const SPICY_WORDS = ["辣", "麻", "剁椒", "香锅", "燃面", "冬阴功", "咖喱"];

  function includesAny(text, words) {
    return words.some((word) => text.includes(word));
  }

  function enrichFood(food) {
    const searchable = [food.name, food.cuisine, ...food.tags].join(" ");
    let inferredMeal = "正餐";

    if (includesAny(searchable, DESSERT_WORDS)) {
      inferredMeal = "甜品";
    } else if (includesAny(searchable, LIGHT_WORDS)) {
      inferredMeal = "轻食";
    }

    return {
      ...food,
      meal: food.meal || inferredMeal,
      budget: food.budget || (includesAny(searchable, PREMIUM_WORDS) ? "品质" : "实惠"),
      spice: food.spice || (includesAny(searchable, SPICY_WORDS) ? "辣" : "不辣")
    };
  }

  function validateFoods(value) {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error("菜单数据为空");
    }

    const ids = new Set();
    value.forEach((food, index) => {
      const missing = REQUIRED_FIELDS.filter((field) => food[field] === undefined);
      if (missing.length > 0 || !Array.isArray(food.tags)) {
        throw new Error(`第 ${index + 1} 道菜字段不完整`);
      }
      if (
        (food.meal && !["正餐", "轻食", "甜品"].includes(food.meal)) ||
        (food.budget && !["实惠", "品质"].includes(food.budget)) ||
        (food.spice && !["不辣", "辣"].includes(food.spice))
      ) {
        throw new Error(`第 ${index + 1} 道菜筛选字段不正确`);
      }
      if (ids.has(food.id)) {
        throw new Error(`菜单 ID 重复：${food.id}`);
      }
      ids.add(food.id);
    });

    return value.map(enrichFood);
  }

  function matchesFilters(food, filters, excludedIds = new Set()) {
    const { category, meal, budget, spice, source = FILTER_ALL } = filters;
    const isCustom = food.id.startsWith("custom-");
    const matchesSource =
      source === FILTER_ALL ||
      (source === "预置菜单" && !isCustom) ||
      (source === "美食库" && isCustom);
    return (
      matchesSource &&
      (category === FILTER_ALL || food.category === category) &&
      (meal === FILTER_ALL || food.meal === meal) &&
      (budget === FILTER_ALL || food.budget === budget) &&
      (spice === FILTER_ALL || food.spice === spice) &&
      !excludedIds.has(food.id)
    );
  }

  const rules = {
    FILTER_ALL,
    enrichFood,
    matchesFilters,
    validateFoods
  };

  globalObject.FoodRules = rules;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = rules;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
