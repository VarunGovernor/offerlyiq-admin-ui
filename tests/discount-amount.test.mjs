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
const boundaryChecks = [
  ['tiny percentage cannot become zero', () => assert.throws(() => toBasisPoints(1e-10), /percentage|decimal/)],
  ['USD excess precision below epsilon is rejected', () => assert.throws(() => toMinorUnits(1.0000000001, 'USD'), /decimal/)],
  ['percentage excess precision below epsilon is rejected', () => assert.throws(() => toBasisPoints(1.0000000001), /percentage|decimal/)],
  ['raw decimal precision is preserved', () => assert.throws(() => toMinorUnits('1.00000000000000001', 'USD'), /decimal/)],
  ['valid decimal money is exact', () => assert.equal(toMinorUnits('0.29','USD'),29)],
  ['valid trailing zeros are accepted', () => assert.equal(toMinorUnits('1.2300','USD'),123)],
  ['safe integer limit', () => assert.equal(toMinorUnits('90071992547409.91','USD'),Number.MAX_SAFE_INTEGER)],
  ['unsafe integer rejected', () => assert.throws(() => toMinorUnits('90071992547409.92','USD'), /decimal|safe/)],
];
let failures=0;
for(const [name,run] of boundaryChecks) {try {run();console.log('PASS '+name)} catch(e) {failures++;console.error('FAIL '+name+': '+e.message)}}
if(failures) process.exitCode=1;
const { toRedemptionCap } = sandboxModule.exports;
assert.equal(toRedemptionCap('10',true),10);
assert.equal(toRedemptionCap('0',false),null);
assert.throws(()=>toRedemptionCap('1.5',true),/whole/);
assert.throws(()=>toRedemptionCap('-1',false),/whole/);
assert.throws(()=>toRedemptionCap('9007199254740993',false),/whole/);
assert.throws(()=>toRedemptionCap('1.000000000000001',false),/whole/);
assert.throws(()=>toRedemptionCap('',true),/cap/);
assert.equal(toMinorUnits('.29','USD'),29);

assert.equal(toRedemptionCap('2147483647',true),2147483647);
assert.throws(()=>toRedemptionCap('2147483648',true),/2147483647/);
