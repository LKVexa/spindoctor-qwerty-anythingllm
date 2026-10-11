#!/usr/bin/env python3
# SpinDoctor Qwerty 1.1.0 - AnythingLLM manifest check
# Copyright (C) 2026 RUSSELL PHILIP SMITHSON <russellsmithson77@outlook.com>
# SPDX-License-Identifier: GPL-3.0-or-later
# This program is free software: you can redistribute it and/or modify it under the terms of the GNU General
# Public License as published by the Free Software Foundation, either version 3 of the License, or (at your
# option) any later version. It is distributed WITHOUT ANY WARRANTY; see the LICENSE file for details.
"""Validate spindoctor-qwerty/plugin.json against AnythingLLM's published plugin.json schema
(tests/anythingllm_loader/imported-manifest.schema.json, a copy of server/utils/agents/imported-manifest.schema.json).
Uses the jsonschema package when installed; otherwise runs the same checks with the standard library (offline).
usage: python3 tests/check_manifest.py"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.join(os.path.dirname(HERE), "spindoctor-qwerty")


def fallback(schema, m):
    errs = []
    for k in m:
        if k != "$schema" and k not in schema["properties"]:
            errs.append("unknown property " + k)
    for k in schema.get("required", []):
        if k not in m: errs.append("missing " + k)
    if m.get("schema") != "skill-1.0.0": errs.append("schema must be skill-1.0.0")
    for k, a in (m.get("setup_args") or {}).items():
        if set(a) - {"type", "required", "input", "value"} or "type" not in a: errs.append("setup_args." + k)
        if set(a.get("input", {})) - {"type", "default", "placeholder", "hint"}: errs.append("setup_args.%s.input" % k)
    for e in m.get("examples", []):
        if set(e) != {"prompt", "call"}: errs.append("examples entry keys")
    for k, p in m["entrypoint"]["params"].items():
        if p.get("type") not in ("string", "number", "boolean"): errs.append("entrypoint.params." + k)
    return errs


def main():
    schema = json.load(open(os.path.join(HERE, "anythingllm_loader", "imported-manifest.schema.json"), encoding="utf-8"))
    m = json.load(open(os.path.join(SKILL, "plugin.json"), encoding="utf-8"))
    try:
        import jsonschema
        errs = [e.message for e in jsonschema.Draft7Validator(schema, format_checker=jsonschema.FormatChecker()).iter_errors(m)]
        how = "jsonschema"
    except ImportError:
        errs, how = fallback(schema, m), "stdlib fallback"
    if m.get("hubId") != os.path.basename(SKILL): errs.append("hubId must equal the folder name")
    if not os.path.isfile(os.path.join(SKILL, m["entrypoint"]["file"])): errs.append("entrypoint file missing")
    if not re.match(r"^\d+\.\d+\.\d+$", m.get("version", "")): errs.append("version")
    print(("VALID" if not errs else "INVALID") + " plugin.json (" + how + ")" + "".join("\n  - " + e for e in errs))
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
