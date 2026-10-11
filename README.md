# SpinDoctor Qwerty for AnythingLLM

**spindoctor-qwerty-anythingllm** is an [AnythingLLM](https://anythingllm.com) **custom agent skill** (`plugin.json` + `handler.js`). It
lets the AnythingLLM agent (`@agent`) run the SpinDoctor Qwerty quantum-circuit **simulator**: build and run circuits with SpinDoctor's
`q.*` commands, run any of the 241 presets, process a folder of command files with `q.folder`, test a theory, and write TXT, PDF, JSON and
CSV reports.

- Version **1.1.0**, engine at **SpinDoctor 3.1.2 parity** (update 3.1.2-298-20261010).
- Host: **AnythingLLM Desktop or Docker/self-hosted**, custom agent skills ("imported" skills, `schema: skill-1.0.0`).
- Self-contained: the skill folder `spindoctor-qwerty/` holds `plugin.json`, `handler.js` (Node.js standard library only) and the bundled
  engine in `engine/` (pure Python, standard library only, NumPy optional). No network access, no npm packages, no installs.

> **Honest limits.** SpinDoctor runs classical FP64 arithmetic on your computer. It is **not** a quantum computer, never contacts
> quantum hardware, and gives no quantum speed-up or quantum advantage. Registers hold 1-298 logical qubits, but any group of
> entangled qubits (one "factor") is limited to 59 qubits, and dense factors are limited much further by memory
> (2^n x 16 bytes; about 22 qubits with the standard library, more with NumPy). Registers wider than 29 qubits sample in basis Z only.
> **Python 3.8 or newer is required** on the machine that runs AnythingLLM.

## Install

1. Install **Python 3.8+** where AnythingLLM runs (for Docker, inside the container; the official image may not include Python).
2. Copy the folder **`spindoctor-qwerty/`** (not the whole repository) into your AnythingLLM storage folder:
   `<STORAGE_DIR>/plugins/agent-skills/spindoctor-qwerty/`. The folder name must stay `spindoctor-qwerty` (it must equal `hubId`).
   - Desktop: click the version number at the top right and press **Open storage**, or use `~/.config/anythingllm-desktop/storage`
     (Linux), `~/Library/Application Support/anythingllm-desktop/storage` (macOS), or `%APPDATA%\anythingllm-desktop\storage` (Windows).
   - Docker: the mounted `STORAGE_DIR` (for example `/app/server/storage`).
3. Reload the AnythingLLM page, open **Agent Skills**, and turn on **SpinDoctor Qwerty**. Optional settings:
   - **PYTHON**: the Python 3.8+ executable. Leave empty to use `python3` (`python` on Windows).
   - **WORKSPACE**: the folder for SpinDoctor state and reports. Leave empty for `~/spindoctor-workspace` (or `$SPINDOCTOR_WORKSPACE`).
4. In a workspace chat, type `@agent show me the SpinDoctor functions`.

## How the agent calls it

AnythingLLM skills have one entry point, so one parameter, `action`, picks the job, and `input` carries the text:

| action | input | engine tool |
|---|---|---|
| `script` | q.* commands, one per line (including `q.folder run path="..."`) | `spindoctor_run_script` |
| `preset` | preset id plus optional `name=value` overrides, e.g. `qc-061 shots=500` | `spindoctor_run_preset` |
| `list` | filter text, e.g. `grover` | `spindoctor_list_presets` |
| `report` | report name (empty: the 10 newest) | `spindoctor_report` |
| `functions` | section (`commands`, `gates`, `tools`, `presets`, `all`) and an optional filter | `spindoctor_functions` |
| `theory` | a JSON object with the `spindoctor_test_theory` fields | `spindoctor_test_theory` |

The handler always returns a string: the Markdown table for `functions`, otherwise the engine's JSON result (cut at 60,000 characters with a
pointer to the report files). It never uses a shell, never touches the network, and stops a call after 10 minutes. The skill only writes
reports in its own workspace, so it does not ask for tool approval (`this.requestToolApproval`).

## What you can ask for

## SpinDoctor Qwerty - plugin tools

| Function | What it does | Command to type |
|---|---|---|
| Function table (spindoctor_functions) | Show this table in chat | Ask: "show the SpinDoctor functions" (CLI: `spindoctor_cli.py functions`) |
| Run a script (spindoctor_run_script) | Run any q.* lines above; returns results + TXT/JSON/CSV/PDF report paths | Ask: "run q.circuit new bell 2 / q.circuit add h 0 / ..." |
| Run a preset (spindoctor_run_preset) | Run qc-001..qc-241 with overrides | Ask: "run preset qc-067 with shots=64" |
| List presets (spindoctor_list_presets) | Search the 241 presets | Ask: "list presets about Grover" |
| Read a report (spindoctor_report) | List/read TXT reports (PDF/JSON paths alongside) | Ask: "show the newest SpinDoctor report" |
| Test a theory from a file (spindoctor_test_theory source=file) | Read a .txt/.md/.pdf/.py/.json/.csv/.q attachment, then hypothesis -> prediction -> q.* script -> run -> verdict + TXT/PDF theory report | Ask: "test the theory in C:/notes/theory.md" (the host must pass the file path/content) |
| Test a theory from text (spindoctor_test_theory source=text) | Same pipeline for pasted text | Ask: "test this theory: a Hadamard on \|0> gives 50/50" |
| Test the theory we discussed (spindoctor_test_theory source=chat) | The AI summarises the theory from the conversation (claims, assumptions, variables, prediction), you confirm, then it is tested; quoted excerpts go in the report under 'Source: chat history'. An exported chat transcript (.txt/.md/.json/.html) also works | Ask: "test the theory we discussed" or "test the theory in my exported chat C:/chats/conversation.json" |

Every command family is listed with a runnable example in **[FUNCTIONS.md](FUNCTIONS.md)** (the exact table `action=functions` shows):
circuits (`q.circuit`, including 298-qubit wide registers and the `mcx7` gate), queries (`q.query`), the tranche register (`q.tranche`),
the procedural grid, presets and sequences, resource planning, math calculators, physics models, lessons, noise, error correction,
compilation, algorithms, inputs/folders/history (`q.input`, `q.folder`, `q.history`) and the cartridge commands.

## Theory testing

`action=theory` turns a claim into a test: hypothesis -> measurable prediction -> `q.*` script -> run -> compare -> a TXT + JSON + PDF
**theory test report** with the hypothesis, script, raw results, verdict (*supported*, *not supported* or *inconclusive*) and limits.

- **From a file:** .txt, .md, .pdf, .py, .json, .csv or .q, given as a path the AnythingLLM server can read (`"source": "file", "path": "..."`).
  AnythingLLM does not hand chat files to skills. A file dropped into the chat is inserted into the conversation as text, so the agent
  can pass that text with `"source": "text"`. A file uploaded as a workspace document is embedded for search (RAG). Otherwise, give a server path.
- **From pasted text** (`"source": "text"`).
- **From the chat history:** say *"test the theory we discussed"*. The agent writes a short summary (claims, assumptions, variables,
  measurable prediction), shows it to you to confirm or correct, then passes it as `"source": "chat"` with optional quoted `excerpts`; the
  report records them under *Source: chat history*. Exported chat transcripts (.txt/.md/.json/.html from ChatGPT, Claude and others) also work.
- The skill cannot read your conversation or attachments by itself: only the agent sees them, and very long conversations may already be
  truncated by the model's context window.

Sample theory files and chat transcripts are in `spindoctor-qwerty/engine/examples/theory/`. The two sample PDFs are stored as text; run
`python3 spindoctor-qwerty/engine/examples/theory/make_sample_pdfs.py` to recreate them.

## Folder ingestion (`q.folder`)

`q.folder run path="<folder>"` runs every supported file at the top level of a folder (.txt, .csv, .json, .qasm, .qasm2, .circuit, .pdf)
in ordinal name order: 1-128 supported files, at most 4 MiB per file, 1-128 commands per file and 4096 characters per command, strict
UTF-8. Other files (for example .md) are skipped and listed. The first failing file stops the job.

## Testing

| Test | Command | Result for 1.1.0 |
|---|---|---|
| plugin.json vs AnythingLLM's published schema | `python3 tests/check_manifest.py` | valid |
| Handler unit tests | `node tests/handler_test.js` | 12/12 |
| End-to-end through AnythingLLM's own skill loader (stand-in host) | `python3 tests/e2e_mcp.py --server node tests/anythingllm_host_bridge.js --examples spindoctor-qwerty/engine/examples/theory` | 12/12 |

**host-simulated:** the AnythingLLM app was not installed. The Desktop app needs a GUI, and the Docker image needs a container runtime,
which the test machine does not have. The stand-in `tests/anythingllm_host_bridge.js` runs AnythingLLM's own loader
(`server/utils/agents/imported.js`, copied unchanged, MIT): it installs the skill into a temporary `STORAGE_DIR`, lists it as active, loads it
with `loadPluginByHubId`, applies the setup settings with `parseCallOptions`, registers it with `setup(aibitat)`, and calls the registered handler.
Details in [E2E_RESULTS.md](E2E_RESULTS.md).

## Author and license

Author: **RUSSELL PHILIP SMITHSON** <russellsmithson77@outlook.com>

Copyright (C) 2026 RUSSELL PHILIP SMITHSON. Licensed under the GNU General Public License v3.0 or later (`GPL-3.0-or-later`): see
[LICENSE](LICENSE), [NOTICE](NOTICE) and [COPYRIGHT](COPYRIGHT). `plugin.json` carries `"license": "GPL-3.0-or-later"` and the author.
The test fixtures in `tests/anythingllm_loader/` are AnythingLLM files under the MIT license (see NOTICE).
