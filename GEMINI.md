# Musicanyya - Gemini CLI

The canonical guide for all agents is AGENTS.md (imported below). Follow it.

@./AGENTS.md

## Gemini CLI specifics

- The workflow steps are available as custom commands: `/speckit:specify`, `/speckit:clarify`, `/speckit:plan`,
  `/speckit:tasks`, `/speckit:analyze`, `/speckit:implement`, `/speckit:checklist`, `/speckit:status`.
- Review roles (`.claude/agents/*.md`) are not native Gemini sub-agents: read the role file and perform the review
  yourself, following its method and output format.
- Use the PowerShell script invocations exactly as written in AGENTS.md (Windows PowerShell on Windows, `pwsh` on Linux).
- Keep AGENTS.md as the single source of truth: put general guidance there, not here.
