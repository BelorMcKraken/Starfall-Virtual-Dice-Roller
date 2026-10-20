"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const publicDir = path.resolve(__dirname, "..", "public");
const expectedAssets = [
  "cheat-sheet-1.png", "cheat-sheet-2.png", "soldier.png", "engineer.png",
  "magi.png", "influencer.png", "medic.png", "mutant.png", "void-scavenger.png",
  "spinecaster.png", "ironhide-brute.png", "null-warden.png", "starfall-playtest-rulebook.pdf",
];

test("all reference assets are bundled and non-empty", () => {
  for (const filename of expectedAssets) {
    const stats = fs.statSync(path.join(publicDir, "references", filename));
    assert.ok(stats.size > 1000, `${filename} should contain the supplied reference`);
  }
});

test("reference pages contain every sheet exactly once", () => {
  const cheats = fs.readFileSync(path.join(publicDir, "cheat-sheets.html"), "utf8");
  const characters = fs.readFileSync(path.join(publicDir, "characters.html"), "utf8");
  const monsters = fs.readFileSync(path.join(publicDir, "monsters.html"), "utf8");
  for (const filename of expectedAssets.slice(0, 2)) assert.equal(cheats.split(filename).length - 1, 2);
  for (const filename of expectedAssets.slice(2, 8)) assert.equal(characters.split(filename).length - 1, 2);
  for (const filename of expectedAssets.slice(8, 12)) assert.equal(monsters.split(filename).length - 1, 2);
});

test("every page uses the shooting-star favicon", () => {
  for (const page of ["index.html", "cheat-sheets.html", "characters.html", "monsters.html"]) {
    const html = fs.readFileSync(path.join(publicDir, page), "utf8");
    assert.match(html, /rel="icon" href="\/favicon\.svg"/);
  }
  assert.ok(fs.statSync(path.join(publicDir, "favicon.svg")).size > 100);
});

test("every page uses the Starfall logo and creator credit", () => {
  for (const page of ["index.html", "cheat-sheets.html", "characters.html", "monsters.html"]) {
    const html = fs.readFileSync(path.join(publicDir, page), "utf8");
    assert.match(html, /src="\/starfall-logo-concept\.png"/);
    assert.match(html, /Tool Created by Belor McKraken\./);
    assert.match(html, /belormckraken/);
  }
  assert.ok(fs.statSync(path.join(publicDir, "starfall-logo-concept.png")).size > 1000);
});
