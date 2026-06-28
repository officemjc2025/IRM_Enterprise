# IRM Enterprise — AI Documentation Index

**Version:** 1.0.0

**Status:** Active

---

# Purpose

This document is the entry point for every AI assistant working on IRM Enterprise.

Instead of loading the entire project context, AI should first read this file to determine which documents are relevant to the current task.

This approach minimizes token usage while ensuring architectural consistency.

---

# AI Startup Sequence

Every AI session should follow this order.

```
README_AI.md

↓

AI_CONTEXT.md

↓

AI_RULES.md

↓

Relevant Blueprint

↓

Relevant Specification

↓

Source Code
```

Never start from source code alone.

---

# Documentation Hierarchy

```
README_AI.md

↓

AI_CONTEXT.md

↓

AI_RULES.md

↓

Blueprint

↓

ADR

↓

Module Specification

↓

Source Code
```

Blueprint is always considered the authoritative source for architecture.

---

# Project Structure

```
docs/

README_AI.md

AI_CONTEXT.md

AI_RULES.md

AI_SESSION_TEMPLATE.md

BLUEPRINT/

ADR/

SPEC/

PROMPTS/

templates/
```

---

# Which Document Should AI Read?

## Architecture

Read

```
01_SYSTEM_ARCHITECTURE.md
```

---

## Database

Read

```
02_DATABASE_MASTER.md
```

---

## Security

Read

```
03_RBAC.md
```

---

## UI / UX

Read

```
04_UI_UX_STANDARD.md
```

---

## API

Read

```
06_API_STANDARD.md
```

(When available)

---

## Coding

Read

```
07_CODING_STANDARD.md
```

(When available)

---

## Module Design

Read

```
08_MODULE_SPECIFICATION.md
```

(When available)

---

## Workflow

Read

```
09_WORKFLOW.md
```

(When available)

---

## Deployment

Read

```
10_DEPLOYMENT.md
```

(When available)

---

# Task-Based Reading Guide

## Build Database

Read

* AI_CONTEXT.md
* AI_RULES.md
* 02_DATABASE_MASTER.md

---

## Create API

Read

* AI_CONTEXT.md
* AI_RULES.md
* 02_DATABASE_MASTER.md
* 03_RBAC.md
* 06_API_STANDARD.md

---

## Create UI

Read

* AI_CONTEXT.md
* AI_RULES.md
* 04_UI_UX_STANDARD.md

---

## Build Authentication

Read

* AI_CONTEXT.md
* AI_RULES.md
* 03_RBAC.md

---

## Build New Module

Read

* AI_CONTEXT.md
* AI_RULES.md
* 01_SYSTEM_ARCHITECTURE.md
* 02_DATABASE_MASTER.md
* 03_RBAC.md
* Module Specification

---

## Fix Bug

Read only the documents directly related to the affected module.

Avoid loading unnecessary chapters.

---

# AI Best Practices

Always:

* Reuse existing components.
* Preserve architecture.
* Preserve RBAC.
* Preserve Property Isolation.
* Update Blueprint if architecture changes.
* Prefer maintainability over shortcuts.

Never:

* Duplicate components.
* Duplicate business logic.
* Bypass Service Layer.
* Query Supabase directly from UI.
* Ignore existing standards.

---

# Recommended AI Prompt

When starting a new conversation, use:

```
Read docs/README_AI.md first.

Then read docs/AI_CONTEXT.md.

Then read only the Blueprint chapters required for the current task.

Do not load unnecessary documents.

Preserve the existing architecture and coding standards.
```

---

# Token Optimization Strategy

To reduce AI cost:

* Work on one business objective per conversation.
* Read only the required Blueprint chapters.
* Avoid reopening completed chapters.
* Commit after each completed objective.
* Start a fresh conversation for the next objective.

---

# Blueprint Status

```
00 Project Vision

01 System Architecture

02 Database Master

03 RBAC

04 UI/UX Standard

05 Design System

06 API Standard

07 Coding Standard

08 Module Specification

09 Workflow

10 Deployment

11 Disaster Recovery

12 Testing Strategy

13 DevOps

14 AI Development Guide

15 Prompt Engineering Guide

16 ADR

17 Project Roadmap
```

Update this list whenever a new Blueprint chapter is created.

---

# Final Principle

The documentation exists to reduce ambiguity.

AI should always follow the documented architecture instead of inventing new patterns.

When documentation and source code differ, review both and resolve the discrepancy before implementing changes.

Documentation is part of the product—not an afterthought.
