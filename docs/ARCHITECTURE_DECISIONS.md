# IRM Enterprise — Architecture & Development Decisions

> Last Updated: 2026-06-29
>
> This document records the permanent architectural and development decisions for IRM Enterprise.
> These decisions should not be changed unless there is a major business or technical reason.

---
# DECISION-000 — Single Source of Truth

The following documents are the authoritative source of truth for the project:

- DECISIONS.md
- ROADMAP.md
- PROJECT_PROGRESS.md
- BACKLOG.md
- CHANGELOG.md

All AI assistants and developers must follow these documents before making architectural or implementation decisions.

If there is a conflict between source code and these documents, clarify before changing the architecture.


# DECISION-001 — Core Domain Model

The core domain model is frozen.

Property
→ Unit
→ Occupancy
→ Person

All future business modules must reuse these domains.

---

# DECISION-002 — Person is the Single Source of Truth

Every human is represented by exactly one Person.

Business roles are determined through Occupancy.

Do not duplicate personal information in other modules.

---

# DECISION-003 — Platform Freeze

The platform architecture is frozen until Metro Pilot is completed.

No new framework, shared engine, infrastructure layer or architectural redesign may be introduced unless it directly blocks a business feature.

Priority order:

1. Business Feature
2. Bug Fix
3. Small Refactor
4. Platform Improvement

---

# DECISION-004 — Development Process

IRM Enterprise uses:

Release
→ Epic
→ Feature
→ Task

Each Task must:

* be independently testable
* be independently committable
* deliver business value

---

# DECISION-005 — UI Internationalization Standard

All user-facing production UI text must use the existing translation system.

Reuse:

* LanguageProvider
* useLanguage()
* Translation JSON

Hard-coded strings are allowed only for:

* Debugging
* Test data
* Console logs
* Internal developer comments
* Temporary prototype code

---

# DECISION-006 — Shared Components First

Before creating a new component, check whether a shared component already exists.

Avoid duplicate UI components.

Shared components have priority.

---

# DECISION-007 — AI Development Rules

AI tasks must be small enough to complete within a single development cycle.

Preferred scope:

* One Task
* One Commit
* One Review

Avoid project-wide refactoring during Metro Pilot.

---

# DECISION-008 — Metro Pilot First

Every development decision must answer one question:

"Does this help Metro Jomtien Condotel use the system sooner?"

If YES → Build it.

If NO → Move it to the backlog after Metro Pilot.

# DECISION-009

Never modify files outside the current Task scope
unless explicitly requested.

Allowed files must be specified in every AI prompt.

# DECISION-010 — AI Prompt Contract

Every AI implementation prompt must include:

- Project Context
- Business Goal
- User Story
- Technical Scope
- Allowed Files
- Forbidden Files
- Acceptance Criteria
- Definition of Done

AI must never modify files outside the declared scope unless explicitly approved.