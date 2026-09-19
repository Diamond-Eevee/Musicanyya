# Musicanyya - Claude Code

The canonical guide for all agents is AGENTS.md (imported below). Follow it.

@AGENTS.md

## Claude Code specifics

- The workflow steps are available as slash commands: `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`,
  `/speckit.tasks`, `/speckit.analyze`, `/speckit.implement`, `/speckit.checklist`, `/speckit.constitution`.
- The review roles in `.claude/agents/` are real subagents: `rt-audio-reviewer`, `music-domain-expert`,
  `constitution-auditor`. Delegate to them instead of reviewing inline.
- Keep AGENTS.md as the single source of truth: put general guidance there, not here.
