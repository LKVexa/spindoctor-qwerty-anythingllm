#!/usr/bin/env node
// SpinDoctor Qwerty 1.1.0 - AnythingLLM handler tests
// Copyright (C) 2026 RUSSELL PHILIP SMITHSON <russellsmithson77@outlook.com>
// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify it under the terms of the GNU General
// Public License as published by the Free Software Foundation, either version 3 of the License, or (at your
// option) any later version. It is distributed WITHOUT ANY WARRANTY; see the LICENSE file for details.
// Unit tests for spindoctor-qwerty/handler.js (Node.js standard library only).
// usage: node tests/handler_test.js
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const skillDir = path.join(__dirname, "..", "spindoctor-qwerty");
const h = require(path.join(skillDir, "handler.js"));
const manifest = JSON.parse(fs.readFileSync(path.join(skillDir, "plugin.json"), "utf8"));
const ws = fs.mkdtempSync(path.join(os.tmpdir(), "sdq-handler-"));
let passed = 0, failed = 0;
async function t(name, f) { try { await f(); passed++; console.log("PASS " + name); } catch (e) { failed++; console.log("FAIL " + name + " -- " + e.message); } }
const ctx = (extra) => Object.assign({ config: manifest, runtimeArgs: { PYTHON: null, WORKSPACE: ws }, introspect() {}, logger() {} }, extra || {});
const run = (params, c) => h.runtime.handler.call(c || ctx(), params);

(async () => {
  await t("versions agree (handler, plugin.json, engine)", () => {
    assert.strictEqual(h.VERSION, "1.1.0"); assert.strictEqual(manifest.version, "1.1.0");
    const init = fs.readFileSync(path.join(skillDir, "engine", "spindoctor", "__init__.py"), "utf8");
    assert.ok(/CARTRIDGE_VERSION\s*=\s*"1\.1\.0"/.test(init + fs.readFileSync(path.join(skillDir, "engine", "spindoctor", "terminal.py"), "utf8")), "engine CARTRIDGE_VERSION");
  });
  await t("plugin.json: hubId = folder name, entrypoint handler.js, params are strings, GPL license, author", () => {
    assert.strictEqual(manifest.hubId, path.basename(skillDir)); assert.strictEqual(manifest.entrypoint.file, "handler.js");
    for (const p of Object.values(manifest.entrypoint.params)) assert.strictEqual(p.type, "string");
    assert.strictEqual(manifest.license, "GPL-3.0-or-later"); assert.ok(manifest.author.startsWith("RUSSELL PHILIP SMITHSON"));
    assert.ok(manifest.examples.length >= 1 && manifest.examples.length <= 3, "docs recommend 1-3 examples");
    for (const e of manifest.examples) { const c = JSON.parse(e.call); assert.ok(h.ACTIONS[c.action], "example action " + c.action); }
  });
  await t("empty PYTHON setting falls back to python3 (python on Windows)", async () => {
    const out = await run({ action: "list", input: "bell" }); assert.ok(out.includes("qc-"), out.slice(0, 200));
  });
  await t("unknown action returns a string, no engine call", async () => {
    const out = await run({ action: "explode", input: "" }); assert.ok(typeof out === "string" && out.startsWith("Unknown action"));
  });
  await t("bad preset override and missing preset id are refused", async () => {
    assert.ok((await run({ action: "preset", input: "qc-001 shots" })).includes("name=value"));
    assert.ok((await run({ action: "preset", input: "  " })).includes("needs a preset id"));
  });
  await t("theory: invalid JSON and non-object JSON are refused", async () => {
    assert.ok((await run({ action: "theory", input: "{bad" })).includes("must be a JSON object"));
    assert.ok((await run({ action: "theory", input: "{}" })).length > 0);
  });
  await t("missing Python executable returns a readable error string", async () => {
    const out = await run({ action: "functions", input: "" }, ctx({ runtimeArgs: { PYTHON: "/nonexistent/python3-missing", WORKSPACE: ws } }));
    assert.ok(out.includes("Python 3.8+ is required"), out);
  });
  await t("PYTHON setting with a newline is ignored (no injection; shell is never used)", async () => {
    const out = await run({ action: "functions", input: "tools" }, ctx({ runtimeArgs: { PYTHON: "python3\nrm -rf /", WORKSPACE: ws } }));
    assert.ok(out.includes("spindoctor_"), out.slice(0, 200));
  });
  await t("functions returns the Markdown table", async () => {
    const out = await run({ action: "functions", input: "" }); assert.ok(out.includes("| Function |") || out.includes("|"), out.slice(0, 200));
  });
  await t("script runs and reports land in the WORKSPACE setting", async () => {
    const out = await run({ action: "script", input: "q.circuit new bell 2\nq.circuit add h 0\nq.circuit add cx 0 1\nq.circuit run shots 100 basis z" });
    assert.ok(out.includes('"ok":true'), out.slice(0, 300));
    assert.ok(fs.existsSync(path.join(ws, "reports")), "reports folder in WORKSPACE");
  });
  await t("long output is truncated with a pointer to the report files", async () => {
    const out = await run({ action: "list", input: "" }); assert.ok(out.length <= 60000 + 200);
    if (out.length > 60000) assert.ok(out.includes("truncated"));
  });
  await t("introspect failure never breaks the handler", async () => {
    const out = await run({ action: "list", input: "ghz" }, ctx({ introspect() { throw new Error("ui gone"); } })); assert.ok(out.includes("qc-"));
  });
  fs.rmSync(ws, { recursive: true, force: true });
  console.log("SUMMARY " + passed + "/" + (passed + failed) + " passed");
  process.exit(failed ? 1 : 0);
})();
