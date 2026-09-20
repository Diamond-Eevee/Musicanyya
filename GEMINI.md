# Musicanyya - Gemini CLI

The canonical guide for all agents is AGENTS.md (imported below). Follow it.

@./AGENTS.md

## Gemini CLI specifics

- The workflow steps are available as custom commands in both spellings, `/speckit.<step>` (same as Claude Code)
  and `/speckit:<step>`: specify, clarify, plan, tasks, analyze, implement, continue, checklist, status,
  constitution. Each one opens `.claude/commands/speckit.<step>.md` and follows it.
- "continue" / `/speckit:continue` resumes where any agent (Claude, Gemini, ...) stopped (AGENTS.md sections 2 and 5).
  Your agent id is `gemini-<model>` (e.g. `gemini-2.5-pro`).
- Review roles (`.claude/agents/*.md`) are not native Gemini sub-agents: read the role file and perform the review
  yourself, following its method and output format.
- Use the PowerShell script invocations exactly as written in AGENTS.md (Windows PowerShell on Windows, `pwsh` on Linux).
- Antigravity also loads AGENTS.md/GEMINI.md as rules and has the same steps as workflows in `.agents/workflows/`.
- Keep AGENTS.md as the single source of truth (under 12,000 characters; details in `docs/agents/reference.md`):
  put general guidance there, not here.
