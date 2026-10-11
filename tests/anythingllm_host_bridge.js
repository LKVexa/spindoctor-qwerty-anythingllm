#!/usr/bin/env node
// SpinDoctor Qwerty 1.1.0 - AnythingLLM stand-in host
// Copyright (C) 2026 RUSSELL PHILIP SMITHSON <russellsmithson77@outlook.com>
// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify it under the terms of the GNU General
// Public License as published by the Free Software Foundation, either version 3 of the License, or (at your
// option) any later version. It is distributed WITHOUT ANY WARRANTY; see the LICENSE file for details.
// AnythingLLM stand-in host built on AnythingLLM's own skill loader.
//
// tests/anythingllm_loader/imported.js is server/utils/agents/imported.js copied unchanged from AnythingLLM
// (MIT, Copyright (c) Mintplex Labs Inc.; see tests/anythingllm_loader/LICENSE-AnythingLLM.txt). This script gives it
// the three small server helpers it requires (safeJsonParse, isWithin/normalizePath copied from AnythingLLM, and a
// no-op CollectorApi), points STORAGE_DIR at a temporary storage folder, copies the skill into
// <STORAGE_DIR>/plugins/agent-skills/<hubId>/ as the README says, and then loads the skill as AnythingLLM does:
// activeImportedPlugins() -> loadPluginByHubId() -> plugin(parseCallOptions()) -> setup(aibitat). The registered
// function is exposed over a minimal stdio MCP loop (JSON-RPC 2.0) as the six spindoctor_* tools so
// tests/e2e_mcp.py can drive it. Read-only tools are also called through the registered fn.handler (`this` bound
// as AnythingLLM binds it) and must give the same string.
// usage: node tests/anythingllm_host_bridge.js [path/to/spindoctor-qwerty] [--describe]
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");

const HERE = __dirname;
const argDir = process.argv.slice(2).find((a) => !a.startsWith("--"));
const skillSrc = path.resolve(argDir || path.join(HERE, "..", "spindoctor-qwerty"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "anythingllm-standin-"));
process.on("exit", () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ } });

// Minimal server tree: utils/agents/imported.js (unchanged) + the helpers it requires.
const utils = path.join(tmp, "server", "utils");
for (const d of ["agents", "http", "files", "collectorApi"]) fs.mkdirSync(path.join(utils, d), { recursive: true });
fs.copyFileSync(path.join(HERE, "anythingllm_loader", "imported.js"), path.join(utils, "agents", "imported.js"));
fs.writeFileSync(path.join(utils, "http", "index.js"),
  "function safeJsonParse(s, fallback = null) { if (s === null) return fallback; try { return JSON.parse(s); } catch { return fallback; } }\nmodule.exports = { safeJsonParse };\n");
fs.writeFileSync(path.join(utils, "files", "index.js"), [
  "const path = require('path');",
  "function isWithin(outer, inner) { const o = path.resolve(outer), i = path.resolve(inner); const rel = path.relative(o, i); if (rel === '') return false; return !rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel); }",
  "function normalizePath(filepath = '') { const result = path.normalize(filepath.trim()).replace(/^(\\.\\.(\\/|\\\\|$))+/, '').trim(); if (['..', '.', '/'].includes(result)) throw new Error('Invalid path.'); return result; }",
  "module.exports = { isWithin, normalizePath };", ""].join("\n"));
fs.writeFileSync(path.join(utils, "collectorApi", "index.js"), "class CollectorApi {}\nmodule.exports = { CollectorApi };\n");

// Install the skill the way the README says: <STORAGE_DIR>/plugins/agent-skills/<hubId>/
const storage = path.join(tmp, "storage");
const manifest = JSON.parse(fs.readFileSync(path.join(skillSrc, "plugin.json"), "utf8"));
const skillsDir = path.join(storage, "plugins", "agent-skills");
fs.mkdirSync(skillsDir, { recursive: true });
fs.cpSync(skillSrc, path.join(skillsDir, manifest.hubId), { recursive: true });
process.env.STORAGE_DIR = storage;
delete process.env.NODE_ENV;
const ImportedPlugin = require(path.join(utils, "agents", "imported.js"));

const active = ImportedPlugin.activeImportedPlugins();
if (!active.includes("@@" + manifest.hubId)) throw new Error("skill not active/listed: " + JSON.stringify(active));
if (!ImportedPlugin.validateImportedPluginHandler(manifest.hubId)) throw new Error("handler.js failed AnythingLLM path validation");
const plugin = ImportedPlugin.loadPluginByHubId(manifest.hubId);
const callOpts = plugin.parseCallOptions();
const functions = new Map(); const introspected = []; const logs = [];
const aibitat = { function(cfg) { functions.set(cfg.name, cfg); return this; }, introspect: (m) => introspected.push(String(m)), handlerProps: { log: (...a) => logs.push(a.join(" ")) } };
plugin.plugin(callOpts).setup(aibitat);
const fn = functions.get(manifest.hubId);
if (!fn || typeof fn.handler !== "function") throw new Error("skill did not register a handler");
const params = Object.keys(fn.parameters.properties);
const skillModule = require(path.join(skillsDir, manifest.hubId, "handler.js"));

if (process.argv.includes("--describe")) {
  console.log(JSON.stringify({ active, name: fn.name, description: fn.description.slice(0, 80), params, callOpts, examples: fn.examples.length, version: skillModule.VERSION, requestToolApproval: typeof fn.requestToolApproval }));
  process.exit(0);
}

// Engine tool call -> the skill's (action, input) strings.
function toAction(name, a) {
  a = a || {};
  if (name === "spindoctor_run_script") return { action: "script", input: a.script || "" };
  if (name === "spindoctor_run_preset") return { action: "preset", input: [a.preset_id || ""].concat(Object.entries(a.overrides || {}).map(([k, v]) => k + "=" + v)).join(" ") };
  if (name === "spindoctor_list_presets") return { action: "list", input: a.filter || "" };
  if (name === "spindoctor_report") return { action: "report", input: a.name || "" };
  if (name === "spindoctor_functions") return { action: "functions", input: [a.section || "commands", a.filter || ""].join(" ").trim() };
  if (name === "spindoctor_test_theory") { const t = Object.assign({}, a); delete t.workspace; return { action: "theory", input: JSON.stringify(t) }; }
  throw new Error("unknown tool " + name);
}
const TOOL_NAMES = Object.values(skillModule.ACTIONS);
const READ_ONLY = new Set(["spindoctor_functions", "spindoctor_list_presets"]);
const schema = { type: "object", additionalProperties: true };

const send = (o) => process.stdout.write(JSON.stringify(o) + "\n");
const rl = readline.createInterface({ input: process.stdin });
let queue = Promise.resolve();
rl.on("line", (line) => { queue = queue.then(() => handle(line)).catch((e) => process.stderr.write(String(e) + "\n")); });
async function handle(line) {
  if (!line.trim()) return;
  const msg = JSON.parse(line); const id = msg.id;
  if (id === undefined || id === null) return;
  try {
    if (msg.method === "initialize") send({ jsonrpc: "2.0", id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "spindoctor-qwerty (AnythingLLM stand-in)", version: skillModule.VERSION } } });
    else if (msg.method === "tools/list") send({ jsonrpc: "2.0", id, result: { tools: TOOL_NAMES.map((n) => ({ name: n, description: "via AnythingLLM skill " + fn.name, inputSchema: schema })) } });
    else if (msg.method === "tools/call") {
      const args = msg.params.arguments || {};
      const p = toAction(msg.params.name, args);
      // The skill's `this`, as AnythingLLM builds it; the WORKSPACE setting carries the per-call workspace.
      const ctx = Object.assign(Object.create(Object.getPrototypeOf(fn)), fn, { runtimeArgs: Object.assign({}, fn.runtimeArgs, args.workspace ? { WORKSPACE: args.workspace } : {}) });
      let structured = null;
      const text = await skillModule.executeAction(ctx, p, (r) => { structured = r; });
      if (READ_ONLY.has(msg.params.name)) {
        const viaHandler = await fn.handler.call(ctx, p);
        if (viaHandler !== text) throw new Error("fn.handler result differs from executeAction for " + msg.params.name);
      }
      if (typeof text !== "string") throw new Error("handler must return a string");
      send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }], structuredContent: structured || {}, isError: !(structured && structured.ok) } });
    } else send({ jsonrpc: "2.0", id, error: { code: -32601, message: "method not found" } });
  } catch (e) { send({ jsonrpc: "2.0", id, error: { code: -32000, message: e.message } }); }
}
