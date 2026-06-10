"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  FILTER_ALL,
  matchesFilters,
  validateFoods
} = require("../js/food-rules.js");

const dataPath = path.join(__dirname, "..", "data", "foods.json");
const foods = validateFoods(JSON.parse(fs.readFileSync(dataPath, "utf8")));
const allFilters = {
  category: FILTER_ALL,
  meal: FILTER_ALL,
  budget: FILTER_ALL,
  spice: FILTER_ALL
};

test("menu data is valid and ids are unique", () => {
  assert.equal(foods.length, 92);
  assert.equal(new Set(foods.map((food) => food.id)).size, foods.length);
});

test("derived filters cover every supported option", () => {
  assert.deepEqual(new Set(foods.map((food) => food.meal)), new Set(["正餐", "轻食", "甜品"]));
  assert.deepEqual(new Set(foods.map((food) => food.budget)), new Set(["实惠", "品质"]));
  assert.deepEqual(new Set(foods.map((food) => food.spice)), new Set(["不辣", "辣"]));
});

test("dessert filter does not return regular meals", () => {
  const results = foods.filter((food) =>
    matchesFilters(food, { ...allFilters, meal: "甜品" })
  );
  assert.ok(results.length > 0);
  assert.ok(results.every((food) => food.meal === "甜品"));
});

test("combined filters and exclusions are respected", () => {
  const filters = {
    category: "中餐",
    meal: "正餐",
    budget: "实惠",
    spice: "辣"
  };
  const initial = foods.filter((food) => matchesFilters(food, filters));
  assert.ok(initial.length > 0);

  const excluded = new Set([initial[0].id]);
  const remaining = foods.filter((food) => matchesFilters(food, filters, excluded));
  assert.equal(remaining.length, initial.length - 1);
  assert.ok(!remaining.some((food) => food.id === initial[0].id));
});

test("invalid or duplicate records are rejected", () => {
  assert.throws(() => validateFoods([]), /菜单数据为空/);
  assert.throws(() => validateFoods([{ id: "broken" }]), /字段不完整/);
  assert.throws(() => validateFoods([foods[0], foods[0]]), /菜单 ID 重复/);
});

test("explicit custom filter fields override keyword inference", () => {
  const [custom] = validateFoods([
    {
      id: "custom-test",
      name: "家庭不辣咖喱",
      category: "中餐",
      cuisine: "家常菜",
      tags: ["咖喱"],
      reason: "测试显式筛选字段。",
      emoji: "🍛",
      meal: "轻食",
      budget: "品质",
      spice: "不辣"
    }
  ]);

  assert.equal(custom.meal, "轻食");
  assert.equal(custom.budget, "品质");
  assert.equal(custom.spice, "不辣");
});

test("invalid explicit filter fields are rejected", () => {
  assert.throws(
    () =>
      validateFoods([
        {
          ...foods[0],
          id: "custom-invalid",
          meal: "夜宵"
        }
      ]),
    /筛选字段不正确/
  );
});
