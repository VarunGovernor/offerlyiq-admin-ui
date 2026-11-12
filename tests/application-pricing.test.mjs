import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const context = { exports: {} };
const path = "src/lib/application-pricing.ts";
if (fs.existsSync(path)) {
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
}
const pricing = context.exports;

test("price entry converts decimal text to exact minor units", () => {
  assert.equal(typeof pricing.parsePriceAmount, "function");
  for (const [input, expected] of [["0.01", 1], ["12.34", 1234], ["49", 4900], ["10.1", 1010], ["999999.99", 99999999]]) {
    assert.equal(pricing.parsePriceAmount(input), expected);
  }
});

test("price entry rejects zero, precision loss, scientific notation and overflow", () => {
  assert.equal(typeof pricing.parsePriceAmount, "function");
  for (const input of ["", "0", "0.00", "-1", "1.001", "1e3", "Infinity", "1000000", "1,000", "1x", ".5"]) {
    assert.throws(() => pricing.parsePriceAmount(input));
  }
});

test("fallback entry normalizes codes but rejects duplicates and the primary market", () => {
  assert.equal(typeof pricing.parseFallbackCountries, "function");
  assert.equal(JSON.stringify(pricing.parseFallbackCountries("fr, es", "DE")), '["FR","ES"]');
  assert.equal(JSON.stringify(pricing.parseFallbackCountries("", "US")), '[]');
  for (const input of ["US", "fr,FR", "USA", "FR,,ES", "12"]) {
    assert.throws(() => pricing.parseFallbackCountries(input, "US"));
  }
});
