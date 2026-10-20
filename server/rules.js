"use strict";

const { randomInt, randomUUID } = require("node:crypto");

const ALLOWED_DICE = Object.freeze([4, 6, 8, 10, 12, 20]);
const TARGET = 12;

function normalizeBonus(value) {
  const bonus = Number(value);
  if (!Number.isInteger(bonus) || bonus < 0 || bonus > 10) {
    throw new Error("Bonus must be a whole number from 0 to 10.");
  }
  return bonus;
}

function normalizeCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error("Roll count must be from 1 to 100.");
  }
  return count;
}

function classify(die1, die2, bonus) {
  const total = die1 + die2 + bonus;
  const doubles = die1 === die2;
  if (total >= TARGET) return { total, result: doubles ? "Critical Success" : "Success" };
  return { total, result: doubles ? "Critical Failure" : "Failure" };
}

function rollDie(sides, rng = randomInt) {
  return rng(1, sides + 1);
}

function makeRoll({ type = "2d10", bonus = 0, count = 1 }, rng = randomInt) {
  const safeBonus = normalizeBonus(bonus);
  const safeCount = normalizeCount(count);
  const batchId = safeCount > 1 ? randomUUID() : "";
  const timestamp = new Date().toISOString();

  if (type === "Initiative") {
    if (safeCount !== 1) throw new Error("Initiative can only be rolled once at a time.");
    let players;
    let monsters;
    do {
      players = rollDie(10, rng);
      monsters = rollDie(10, rng);
    } while (players === monsters);
    return [{
      id: randomUUID(), timestamp, type, die1: players, die2: monsters,
      bonus: safeBonus, total: Math.max(players, monsters) + safeBonus,
      result: players > monsters ? "Players Win" : "Monsters Win", batchId,
    }];
  }

  if (type === "2d10") {
    return Array.from({ length: safeCount }, () => {
      const die1 = rollDie(10, rng);
      const die2 = rollDie(10, rng);
      return { id: randomUUID(), timestamp, type, die1, die2, bonus: safeBonus, ...classify(die1, die2, safeBonus), batchId };
    });
  }

  const match = /^d(\d+)$/.exec(type);
  const sides = match ? Number(match[1]) : 0;
  if (!ALLOWED_DICE.includes(sides)) throw new Error("Unknown roll type.");
  return Array.from({ length: safeCount }, () => {
    const die1 = rollDie(sides, rng);
    return { id: randomUUID(), timestamp, type, die1, die2: 0, bonus: safeBonus, total: die1 + safeBonus, result: "Roll", batchId };
  });
}

module.exports = { ALLOWED_DICE, TARGET, classify, makeRoll, normalizeBonus, normalizeCount };
