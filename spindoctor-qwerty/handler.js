// SpinDoctor Qwerty 1.1.0 - AnythingLLM custom agent skill
// Copyright (C) 2026 RUSSELL PHILIP SMITHSON <russellsmithson77@outlook.com>
// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify it under the terms of the GNU General
// Public License as published by the Free Software Foundation, either version 3 of the License, or (at your
// option) any later version. It is distributed WITHOUT ANY WARRANTY; see the LICENSE file for details.
//
// AnythingLLM custom agent skill (https://docs.anythingllm.com/agent/custom/handler-js). The handler always returns a
// string, wraps everything in try/catch and only uses the Node.js standard library. It runs the bundled SpinDoctor
// engine (SpinDoctor 3.1.2 parity) with Python 3 from ./engine. No network access, no shell, no installs.
// AnythingLLM skills have one entrypoint, so the six engine tools are reached through the `action` parameter.
"use strict";

const VERSION = "1.1.0";
const ACTIONS = {
  script: "spindoctor_run_script",
  preset: "spindoctor_run_preset",
  list: "spindoctor_list_presets",
  report: "spindoctor_report",
  functions: "spindoctor_functions",
  theory: "spindoctor_test_theory",
};
const MAX_RETURN = 60000;              // characters handed back to the agent
const MAX_STDOUT = 64 * 1024 * 1024;   // bytes read from the engine before it is stopped
const TIMEOUT_MS = 600000;             // 10 minutes per call

// Map the skill's (action, input) strings to an engine tool name and its JSON arguments.
function toToolCall(action, input) {
  const a = String(action || "").toLowerCase().trim();
  const text = String(input == null ? "" : input);
  const tool = ACTIONS[a];
  if (!tool) return { error: "Unknown action '" + a + "'. Use one of: " + Object.keys(ACTIONS).join(", ") + "." };
  if (a === "script") return { tool, args: { script: text } };
  if (a === "preset") {
    const parts = text.trim().split(/\s+/).filter(Boolean); const overrides = {};
    for (const p of parts.slice(1)) {
      const i = p.indexOf("=");
      if (i <= 0) return { error: "Preset overrides must look like name=value (got '" + p + "')." };
      overrides[p.slice(0, i)] = p.slice(i + 1);
    }
    if (!parts[0]) return { error: "action=preset needs a preset id, e.g. qc-001 (action=list lists them)." };
    return { tool, args: { preset_id: parts[0], overrides } };
  }
  if (a === "list") return { tool, args: { filter: text.trim() } };
  if (a === "report") return { tool, args: text.trim() ? { name: text.trim() } : { limit: 10 } };
  if (a === "functions") {
    const p = text.trim().split(/\s+/).filter(Boolean);
    return { tool, args: { section: p[0] || "commands", filter: p.slice(1).join(" ") } };
  }
  // theory: a JSON object with the spindoctor_test_theory fields, or plain text to extract a theory from.
  if (!text.trim().startsWith("{")) return { tool, args: { action: "extract", source: "text", text } };
  try {
    const args = JSON.parse(text);
    if (!args || typeof args !== "object" || Array.isArray(args)) return { error: "theory input must be a JSON object." };
    return { tool, args };
  } catch (e) { return { error: "theory input must be a JSON object: " + e.message }; }
}

function pythonFor(runtimeArgs) {
  const p = String((runtimeArgs && runtimeArgs.PYTHON) || "").trim();
  if (p && !/[\r\n\0]/.test(p)) return p;
  return process.platform === "win32" ? "python" : "python3";
}

// Run one engine tool; resolves to the parsed JSON result (never rejects).
function callEngine(tool, args, runtimeArgs) {
  const path = require("path");
  const { spawn } = require("child_process");
  const cli = path.join(__dirname, "engine", "scripts", "spindoctor_cli.py");
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8", PYTHONDONTWRITEBYTECODE: "1" });
  const ws = String((runtimeArgs && runtimeArgs.WORKSPACE) || "").trim();
  if (ws && !/[\r\n\0]/.test(ws)) env.SPINDOCTOR_WORKSPACE = ws;
  return new Promise((resolve) => {
    let out = [], size = 0, err = "", done = false, why = "";
    const finish = (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    let child;
    try { child = spawn(pythonFor(runtimeArgs), [cli, "tool", tool], { windowsHide: true, env, shell: false }); }
    catch (e) { return finish({ ok: false, error: "Python 3.8+ is required to run SpinDoctor: " + e.message }); }
    const timer = setTimeout(() => { why = "SpinDoctor timed out after " + TIMEOUT_MS / 1000 + " s"; child.kill(); }, TIMEOUT_MS);
    child.stdout.on("data", (d) => {
      size += d.length;
      if (size > MAX_STDOUT) { why = "SpinDoctor output exceeded " + MAX_STDOUT + " bytes"; child.kill(); return; }
      out.push(d);
    });
    child.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
    child.on("error", (e) => finish({ ok: false, error: "Python 3.8+ is required to run SpinDoctor (set the PYTHON setting): " + e.message }));
    child.on("close", (code) => {
      if (why) return finish({ ok: false, error: why + "." });
      const lines = Buffer.concat(out).toString("utf8").trim().split("\n");
      try { finish(JSON.parse(lines[lines.length - 1])); }
      catch (e) { finish({ ok: false, error: "SpinDoctor engine failed (exit " + code + "): " + (err.trim() || "no output") }); }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(args));
  });
}

// Turn an engine result into the string the agent sees.
function asText(result) {
  if (result && result.ok && typeof result.markdown === "string") return result.markdown;
  const s = JSON.stringify(result);
  return s.length > MAX_RETURN ? s.slice(0, MAX_RETURN) + " ...[truncated; the full output is in the TXT/PDF/JSON report files listed above]" : s;
}

// Shared by the handler and the test host: ctx is the skill's `this` (config, runtimeArgs, introspect, logger).
// onResult (optional) receives the full engine result so tests never have to run a command twice.
async function executeAction(ctx, params, onResult) {
  const say = (m) => { try { if (ctx && typeof ctx.introspect === "function") ctx.introspect(m); } catch (e) { /* UI only */ } };
  const callerId = ((ctx && ctx.config && ctx.config.name) || "SpinDoctor Qwerty") + "-v" + ((ctx && ctx.config && ctx.config.version) || VERSION);
  try {
    const call = toToolCall(params && params.action, params && params.input);
    if (call.error) { if (onResult) onResult({ ok: false, error: call.error }); return call.error; }
    say(callerId + ": SpinDoctor " + String(params.action).toLowerCase().trim() + " (classical simulation on this computer)...");
    const result = await callEngine(call.tool, call.args, ctx && ctx.runtimeArgs);
    if (onResult) onResult(result);
    return asText(result);
  } catch (e) {
    try { if (ctx && typeof ctx.logger === "function") ctx.logger(callerId + " failed: " + e.message); } catch (e2) { /* ignore */ }
    return "SpinDoctor failed: " + e.message;
  }
}

module.exports.runtime = {
  handler: async function ({ action, input }) {
    return executeAction(this, { action, input });
  },
};
module.exports.VERSION = VERSION;
module.exports.ACTIONS = ACTIONS;
module.exports.toToolCall = toToolCall;
module.exports.executeAction = executeAction;
