---
name: skill-creator
description: Create or update a workspace-local OpenCode skill when a user asks for a reusable workflow or skill.
---

# Skill Creator

Create skills locally in the active workspace. VeloxOpenWork has no Cloud or organization skill authoring flow.

## Location

Create or update exactly one skill at:

```text
.opencode/skills/<skill-name>/SKILL.md
```

Read an existing skill before changing it. Do not create a second copy under another directory unless the user explicitly requests that structure.

## Local Flow

1. Inspect `.opencode/skills/` and the requested workspace context.
2. Resolve an existing exact-name match before writing.
3. Create or update one complete `SKILL.md` with YAML frontmatter and a clear instruction body.
4. Do not include credentials, API keys, or machine-specific secrets.
5. Re-read the finished file and report its location and behavior.

## Recommended Structure

```text
.opencode/
  skills/
    my-skill/
      SKILL.md
      templates/
      scripts/
```

## Frontmatter Template

```yaml
---
name: my-skill
description: |
  Explains what the skill does and when to use it.

  Triggers when the user mentions:
  - "specific phrase 1"
  - "specific phrase 2"
---
```

## Checklist

- State the purpose, inputs, outputs, and any required permissions.
- Include safe setup steps when local tooling is required.
- Add realistic examples when the workflow is non-obvious.
- Avoid destructive defaults and request confirmation before irreversible actions.
- Keep the skill portable and independent of personal credentials.
