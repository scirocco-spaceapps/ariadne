---
name: pr-ac
description: Finish an Ariadne task to the definition of done. Runs the checks of every directory the task touched, confirms no file outside the task card's allowed paths changed, summarises the diff, opens a PR with gh, and appends one line to docs/ai-use/<name>.md. Use when a task is ready for review or the user says "open the PR" / "pr-ac".
---

# pr-ac — PR with acceptance checks

Run these steps in order. Stop and report at the first failure; never skip a step or weaken a check.

## 1. Find the allowed paths

- **Allowed paths** come from the task prompt's "Work only inside:" line in this conversation,
  e.g. `pipeline/ and planner/`, `content/stops/index.json and docs/model.md`,
  `web/ (except src/map and src/stops)`. If there is no such line, ask the user; if they have none,
  the allowed path is the branch's directory.
- Branch must be `<directory>/<short-task-name>` (`git branch --show-current`), where `<directory>`
  is the top folder of the first allowed path. If the branch is `main` or does not match, stop and ask.
- Ask the user for their name if you don't know it (lowercase first name, e.g. `yusuf`, `alikoray`);
  it picks `docs/ai-use/<name>.md`.
- Read `docs/PLAN_CHANGES.md`: where it differs from the task prompt, it wins.

## 2. Run the check of every directory the diff touches

| Directory | Check |
|---|---|
| `contracts` | `pip install -r contracts/requirements.txt && python contracts/check.py` |
| `web` | `cd web && npm ci && npm run check` |
| `planner` | `cd planner && pip install -r requirements-dev.txt && python -m pytest` |
| `mission-control` | `cd mission-control && go vet ./... && go test ./...` |
| `docs` | none (Markdown); still read the diff |
| other | the Test line in `<directory>/CLAUDE.md` |

Run one check per top-level directory in the diff. If a check fails, show the output and stop.

## 3. Confirm the diff stays inside the allowed paths

```bash
git fetch origin main
git diff --name-only origin/main...HEAD
git status --porcelain
```

Every changed path must be inside one of the allowed paths (a folder path covers everything under
it; a file path covers only that file; an "except" clause removes those folders). The only extra
paths allowed are `docs/ai-use/<name>.md` (added in step 5) and appended notes in
`docs/notes/<owner>.md` (additions only; deleting lines is allowed only in your own notes file). Inside `web/`, also check the path
against `.github/CODEOWNERS`: `web/src/map/` and `web/src/stops/` have their own owners.

If any other path changed: stop, list the paths, and append a note to `docs/notes/<owner>.md` (who and
what must change) instead of opening the PR.

Also stop if `contracts/` changed on a non-`contracts/` branch, or if a lockfile or root config
changed outside the directory.

## 4. Summarise the diff and open the PR

- `git diff --stat origin/main...HEAD` and read the diff. Write a 3-6 bullet summary: what changed,
  how it was checked, any note for other owners.
- Commit messages and PR title use the directory prefix: `<directory>: <what>`.
- Push and open:

```bash
git push -u origin HEAD
gh pr create --base main --title "<directory>: <what>" --body "<summary>

Check: <command> passed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Keep PRs small; if the diff is too big to review in a few minutes, propose a split first.

## 5. Log AI use

Append exactly one line to the end of `docs/ai-use/<name>.md` (create the file with a
`# AI use — <Name>` heading if missing):

```
- YYYY-MM-DD | <branch> (#<PR number>) | Claude Code | <what the AI did> | <what the human checked>
```

Commit it on the same branch (`docs: ai-use line for <branch>`, keep the `Co-Authored-By:` trailer)
and push. Never edit other lines or other people's files.

## 6. Report

Give the user: the PR URL, the check that passed, and the ai-use line.
