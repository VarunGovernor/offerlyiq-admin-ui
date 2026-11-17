import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Transpile the actual frontend helper so these checks cover the code the admin UI imports.
const source = fs.readFileSync("src/lib/discount-amount.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, Intl, Math });

const { currencyExponent, toMinorUnits, formatFlatDiscount } = module.exports;
assert.equal(currencyExponent("USD"), 2);
assert.equal(currencyExponent("INR"), 2);
assert.equal(currencyExponent("JPY"), 0);
assert.equal(currencyExponent("KWD"), 3);
assert.equal(toMinorUnits(5, "USD"), 500);
assert.equal(toMinorUnits(25, "INR"), 2500);
assert.equal(toMinorUnits(500, "JPY"), 500, "JPY coupons use zero decimal places");
assert.equal(toMinorUnits(1.5, "KWD"), 1500, "KWD coupons use three decimal places");
assert.equal(formatFlatDiscount(500, "JPY"), "JPY 500");
assert.equal(formatFlatDiscount(1500, "KWD"), "KWD 1.500");
assert.equal(formatFlatDiscount(500, "USD"), "USD 5.00");

console.log("Discount minor-unit contract checks passed.");
