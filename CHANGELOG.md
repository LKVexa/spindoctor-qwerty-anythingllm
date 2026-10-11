# Changelog

## 1.1.0 (2026-10-10)

- Engine rebased on **SpinDoctor 3.1.2** (update 3.1.2-298-20261010): 1-298 logical qubits with 59-qubit entangled factors,
  prepared-factor Born-Z sampling above 29 qubits, the `mcx7` gate, wide basis indices, `q.folder` with 3.1.2 semantics,
  CSV report copies and measurement-CSV fitting equations. 241 presets replayed against the updated 3.1.2 reference.
- New actions: `functions` (in-chat function table) and `theory` (file, pasted text, chat history, exported chat transcripts).
- Fix: the `PYTHON` setting defaulted to `python`, which AnythingLLM passes to the skill as the value, so the `python3`
  fallback never ran and the skill failed where only `python3` exists (most Linux systems and Docker images). It now defaults
  to empty and falls back to `python3` (`python` on Windows).
- New optional `WORKSPACE` setting (state and report folder).
- Handler hardening: never uses a shell; ignores settings with control characters; 64 MiB output cap and 10-minute timeout with
  clear messages; UTF-8 forced for the engine; bad preset overrides, missing preset ids and non-object theory JSON refused with
  readable errors; introspect/logger failures cannot break a call; every path returns a string inside try/catch (per the
  handler.js reference).
- plugin.json: license MIT -> GPL-3.0-or-later; author RUSSELL PHILIP SMITHSON with author_url; examples trimmed to 3 (docs
  recommend 1-3); description states the 3.1.2 limits and the classical-simulator guardrail; validated against AnythingLLM's
  published schema.
- Skill-folder README.md added (the developer guide asks for one at the skill root).
- Optional reproducibility: `SPINDOCTOR_MEASUREMENT_SEED` / `SPINDOCTOR_FIELD_SEED` (64 hex characters) seed a new workspace.

## 1.0.0

- First release (SpinDoctor 3.0.3 semantics).
