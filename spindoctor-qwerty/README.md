# SpinDoctor Qwerty (AnythingLLM custom agent skill)

Version 1.1.0, engine at SpinDoctor 3.1.2 parity. GPL-3.0-or-later, Copyright (C) 2026 RUSSELL PHILIP SMITHSON
<russellsmithson77@outlook.com>.

Runs the SpinDoctor quantum-circuit **simulator** (classical FP64 on this computer, not a quantum computer, no quantum
advantage) from the bundled `engine/` folder. **Requires Python 3.8+**; the standard library is enough (NumPy optional).
No network access, no installs.

Copy this folder, unchanged and still named `spindoctor-qwerty`, into `<STORAGE_DIR>/plugins/agent-skills/`. Then enable the
skill under Agent Skills. Optional settings: `PYTHON` (leave empty to use `python3`, or `python` on Windows) and
`WORKSPACE` (where state and reports go; default `~/spindoctor-workspace`).

One parameter, `action`, picks the job: `script` (q.* commands, one per line), `preset` (`qc-001`..`qc-241`, optional
`name=value` overrides), `list`, `report`, `functions` (the function table), `theory` (a JSON object with the
`spindoctor_test_theory` fields). Full documentation: the repository README.
