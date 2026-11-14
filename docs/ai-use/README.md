# AI use log

Space Apps asks teams to disclose how AI was used. Each person keeps one file here,
`docs/ai-use/<name>.md` (lowercase first name: `yusuf.md`, `nuri.md`, `furkan.md`, `mazlum.md`,
`alikoray.md`, `bunyamin.md`), and appends **one line per finished task**. Never edit someone
else's file, never rewrite old lines.

Line format:

```
- YYYY-MM-DD | <branch or PR> | <tool, e.g. Claude Code> | <what the AI did> | <what a human checked>
```

Example:

```
- 2026-11-15 | planner/slope-cost | Claude Code | wrote slope cost function and tests | reviewed formula against docs/model.md, ran pytest
```

Rules that apply to AI output: no AI-generated images anywhere in the project; AI may not invent
measurements; every AI-assisted commit keeps its `Co-Authored-By:` trailer.
