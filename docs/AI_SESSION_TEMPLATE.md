# IRM Enterprise — AI Session Template

Use this template whenever starting a new AI conversation.

It minimizes context usage while keeping every AI aligned with the project architecture.

---

# Project

IRM Enterprise

Enterprise Property Operating System

---

# Read First

docs/AI_CONTEXT.md

docs/AI_RULES.md

---

# Relevant Blueprint

Specify only the chapters related to the current task.

Example

02_DATABASE_MASTER.md

03_RBAC.md

04_UI_UX_STANDARD.md

---

# Current Objective

Describe one clear objective only.

Examples

Implement Visitor Module

Create Resident CRUD

Add Rental Calendar

Implement Work Order Dashboard

Avoid multiple unrelated objectives.

---

# Current Constraints

The AI must respect:

* Existing Architecture
* Existing Folder Structure
* Existing Components
* RBAC
* Property Isolation
* Row Level Security
* TypeScript Strict Mode
* Tailwind CSS

No architectural redesign unless explicitly requested.

---

# Expected Deliverables

Examples

Updated Files

New Components

Migration Scripts

Repository Changes

Service Changes

UI Changes

Blueprint Updates

Documentation Updates

---

# Required Validation

Before finishing:

Build passes

TypeScript passes

ESLint passes

Authentication works

RBAC preserved

No duplicated components

No duplicated business logic

No unused files

---

# Expected Response Format

Every AI response should include:

1. Summary

2. Files to Modify

3. Complete Source Code

4. Migration Impact

5. Blueprint Impact

6. Testing Steps

7. Git Commit Message

---

# Example Session

Project

IRM Enterprise

Read First

docs/AI_CONTEXT.md

docs/AI_RULES.md

Relevant Blueprint

02_DATABASE_MASTER.md

03_RBAC.md

Current Objective

Implement Visitor Management CRUD.

Constraints

Do not change architecture.

Do not duplicate components.

Preserve RBAC.

Preserve Property Isolation.

Expected Deliverables

Visitor Repository

Visitor Service

Visitor UI

Migration

Tests

Blueprint Update

---

# Session Philosophy

Each AI conversation should focus on one business objective.

Complete the objective.

Validate the implementation.

Commit the changes.

Start a new session for the next objective.

This workflow keeps context small, reduces AI token usage, improves response quality, and maintains a clean project history.
