# End-to-end results - spindoctor-qwerty-anythingllm 1.1.0

Date: 2026-10-10 (PT). Engine: SpinDoctor Qwerty 1.1.0, SpinDoctor 3.1.2 parity (update 3.1.2-298-20261010).

## Publishing decision (recorded as required)

RUSSELL PHILIP SMITHSON approved publishing ("GO") on the basis that the **updated SpinDoctor 3.1.2** builds and passes its own test
suite **18/18**, with the three test checks that still assumed the old 29-qubit limit adapted to the new 298-qubit limit
(`engine_regressions` dense comparison restricted to gates with at most 3 operands now that `mcx7` has 8; `direct_preset_regressions`
and `csv_gate_regressions` now expect 299 qubits, not 30, to be refused). Unmodified, the update passes 15/18 because of exactly
those three stale checks.

## Reference used

All parity comparisons use reference outputs regenerated from the **updated** SpinDoctor 3.1.2 C# build (241 presets in one
session, the folder-ingest chug series, and direct wide-register commands).

## Shared engine (Phase A, run once for all repos)

| Suite | Result |
|---|---|
| 241 presets replayed against the updated 3.1.2 reference | 236 identical; 5 with documented differences (qc-006, qc-008, qc-009, qc-016, qc-019: OpenCL GPU fields absent in a CPU-only engine, tranche checkpoint wording, session-state file name). qc-198 fails preflight in both C# and the engine (`q.compile synthesize` is not implemented in SpinDoctor 3.1.2 either). Work-accounting counters are compared separately and documented. |
| Folder-ingest chug series (41 folders) | 40 pass; `08_cancel` not applicable (the engine runs `q.folder` synchronously, so there is nothing to cancel; the job completes correctly) |
| Wide-register parity (direct 298-qubit commands) | 0 differences |
| 11-file 298-qubit example folder | identical (73 distinct outcomes, histogram preview and counts match) |
| Engine validation suite | 22/22 |
| Theory-testing suite (files, text, chat summary, 5 transcript formats) | 43/43 |
| Function-table examples (every "Command to type") | 168/168 run OK |

## This repository: clean-room test

The staged repository was copied into a fresh, empty folder with an empty HOME and a minimal environment (`env -i`). It had no access to
engine development folders or tools. The README install step was followed: `spindoctor-qwerty/` was copied into
`<STORAGE_DIR>/plugins/agent-skills/`, and the installed copy was loaded through AnythingLLM's own skill loader.

| Check | Result |
|---|---|
| plugin.json vs AnythingLLM's published schema (`tests/check_manifest.py`, standard-library path) | VALID |
| Handler unit tests (`node tests/handler_test.js`) | 12/12 |
| Loader: `activeImportedPlugins()` lists `@@spindoctor-qwerty`; `validateImportedPluginHandler` passes; `loadPluginByHubId` + `parseCallOptions` (PYTHON/WORKSPACE empty -> null -> python3 fallback) + `setup(aibitat)` registers the handler with params `action`, `input` | PASS |
| Function table shown (`action=functions`) | PASS |
| One script per command family (every family in the function table) | PASS |
| 298-qubit circuit with `mcx7` | PASS |
| Preset run and presets qc-001..qc-025 compared with the updated-3.1.2 reference (seeded) | PASS (20 identical, 5 documented differences) |
| `q.folder` on a small mixed folder (.txt/.csv/.json/.qasm, .md skipped and listed) | PASS |
| Theory test from a file, from a chat summary + excerpts, and from an exported transcript | PASS |
| TXT + PDF reports generated; PDFs validated (header, xref, trailer, EOF) | PASS |
| Read-only actions give the same string through the registered `fn.handler` as through the shared code path | PASS |
| Summary | end-to-end 12/12 |

## Host app

| Item | Result |
|---|---|
| AnythingLLM app | **host-simulated.** The Desktop app needs a GUI, and the Docker image needs a container runtime; the test box has neither, and no sign-in or API key was used. |
| Stand-in | `tests/anythingllm_host_bridge.js` runs AnythingLLM's **own loader code**: `server/utils/agents/imported.js`, copied unchanged from AnythingLLM (MIT, commit b6e1386). It gets minimal copies of the three helpers it requires. |

## Post-push verification

After the push (content commit `bc6e60d`), the public repository was cloned back from GitHub into a fresh folder with an empty HOME, and
`spindoctor-qwerty/` was copied into a fresh `<STORAGE_DIR>/plugins/agent-skills/` as the README says:

| Check | Result |
|---|---|
| Cloned tree vs staged tree | 54/54 files present, byte-identical, no extra files |
| `tests/check_manifest.py` | VALID |
| `node tests/handler_test.js` | 12/12 |
| End-to-end through AnythingLLM's loader on the installed clone | 12/12 (PASS) |

Commits are made through the GitHub connector and show the LKVexa account as committer. The author of the work is
RUSSELL PHILIP SMITHSON <russellsmithson77@outlook.com> (see NOTICE and COPYRIGHT).
