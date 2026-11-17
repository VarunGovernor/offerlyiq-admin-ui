import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Transpile the actual frontend helper so these checks cover the code the admin UI imports.
const source = fs.readFileSync("src/lib/discount-amount.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sandboxModule = { exports: {} };
vm.runInNewContext(compiled, { module: sandboxModule, exports: sandboxModule.exports, Intl, Math });

const { currencyExponent, toMinorUnits, toBasisPoints, toWholeCredits, formatFlatDiscount } = sandboxModule.exports;
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
assert.equal(toBasisPoints(12.34), 1234);
assert.equal(toWholeCredits(2), 2);
assert.throws(() => toWholeCredits(1.6), /whole number/);
assert.throws(() => toMinorUnits(0.001, "USD"), /decimal places/);
assert.throws(() => toMinorUnits(0.0001, "KWD"), /decimal places/);
assert.throws(() => toBasisPoints(12.345), /decimal places/);
assert.throws(() => toMinorUnits(0, "INR"), /positive amount/);


console.log("Discount minor-unit contract checks passed.");
