import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync("src/app/application-packages/page.tsx", "utf8");
const context = { exports: {}, require: () => ({}) };
vm.runInNewContext(ts.transpileModule(`${source}\nglobalThis.formatAmount = formatAmount;`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, context);

test("purchase amounts preserve supported currency minor units and symbols", () => {
  for (const [minor, currency, major] of [[500, "CLP", 500], [1999, "USD", 19.99], [1999, "INR", 19.99], [1999, "EUR", 19.99], [1999, "GBP", 19.99], [500, "JPY", 500], [500, "VND", 500], [15, "KWD", 0.015]]) {
    const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency });
    const expected = formatter.format(major);
    assert.equal(context.formatAmount(minor, currency, formatter.resolvedOptions().maximumFractionDigits), `${expected} (${currency})`);
    assert.equal(context.formatAmount(minor, currency), `${expected} (${currency})`);
  }
  assert.match(context.formatAmount(500, "TWD", 0), /500.*\(TWD\)/);
});
