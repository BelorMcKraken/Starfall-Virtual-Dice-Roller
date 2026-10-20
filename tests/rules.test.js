"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { classify, makeRoll } = require("../server/rules.js");

test("Starfall success threshold includes bonus", () => {
  assert.deepEqual(classify(5, 5, 2), { total: 12, result: "Critical Success" });
  assert.deepEqual(classify(5, 5, 1), { total: 11, result: "Critical Failure" });
  assert.deepEqual(classify(6, 5, 1), { total: 12, result: "Success" });
});

test("2d10 batches use the requested count", () => {
  const values = [0, 1, 8, 9];
  const rolls = makeRoll({ type: "2d10", bonus: 2, count: 2 }, (min, max) => min + values.shift() % (max - min));
  assert.equal(rolls.length, 2);
  assert.equal(rolls[0].total, 5);
  assert.equal(rolls[1].total, 21);
  assert.ok(rolls[0].batchId);
});

test("utility dice and input limits are enforced", () => {
  const [roll] = makeRoll({ type: "d20", bonus: 3, count: 1 }, () => 20);
  assert.equal(roll.total, 23);
  assert.throws(() => makeRoll({ type: "d100", bonus: 0, count: 1 }), /Unknown/);
  assert.throws(() => makeRoll({ type: "2d10", bonus: 11, count: 1 }), /Bonus/);
  assert.throws(() => makeRoll({ type: "2d10", bonus: 0, count: 101 }), /count/);
});

test("initiative rerolls ties", () => {
  const values = [5, 5, 8, 3];
  const [roll] = makeRoll({ type: "Initiative", bonus: 2, count: 1 }, () => values.shift());
  assert.equal(roll.result, "Players Win");
  assert.equal(roll.total, 10);
});
