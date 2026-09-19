# Musicanyya - Claude Code

The canonical guide for all agents is AGENTS.md (imported below). Follow it.

@AGENTS.md

## Claude Code specifics

- The workflow steps are available as slash commands: `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`,
  `/speckit.tasks`, `/speckit.analyze`, `/speckit.implement`, `/speckit.continue`, `/speckit.checklist`,
  `/speckit.constitution`.
- "continue" / `/speckit.continue` resumes where any agent (Claude, Gemini, ...) stopped (AGENTS.md sections 2 and 5).
  Your agent id is `claude-<model>` (e.g. `claude-opus-5`).
- The review roles in `.claude/agents/` are real subagents: `rt-audio-reviewer`, `music-domain-expert`,
  `constitution-auditor`. Delegate to them instead of reviewing inline.
- Keep AGENTS.md as the single source of truth (under 12,000 characters; details in `docs/agents/reference.md`):
  put general guidance there, not here.
