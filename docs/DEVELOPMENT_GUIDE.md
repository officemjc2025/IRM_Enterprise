# IRM Enterprise Development Guide

Version: 2.0

Status: Active

---

# Purpose

This document defines the mandatory development standards for the IRM Enterprise project.

All developers, AI assistants and contributors must follow these rules.

Before starting any implementation, read the following documents in order:

1. DEVELOPMENT_GUIDE.md
2. ARCHITECTURE_DECISIONS.md
3. ROADMAP.md
4. PROJECT_PROGRESS.md

These documents are the single source of truth for the project.

---

# Project Principles

Business Value First

Metro Pilot is the highest priority.

Avoid unnecessary architectural redesign during Metro Pilot development.

Priority order:

1. Business Features
2. Bug Fixes
3. Small Refactoring
4. Platform Improvements

---

# Architecture

Follow the architecture defined in:

* docs/architecture.md
* ARCHITECTURE_DECISIONS.md

Do not introduce new architecture without approval.

Keep the project modular.

---

# Folder Structure

Business Features → features/

Reusable Components → components/

Shared Code → shared/

Repositories → repositories/

Services → services/

Providers → providers/

Hooks → hooks/

Language Resources → messages/

Documentation → docs/

---

# Development Process

IRM Enterprise follows:

Release

↓

Epic

↓

Feature

↓

Task

↓

Commit

↓

Review

↓

Next Task

Each Task must:

* deliver business value
* be independently testable
* be independently committable

---

# React Standards

* Functional Components only.
* No business logic inside UI components.
* Reuse shared components whenever possible.
* Prefer composition over duplication.

---

# TypeScript Standards

* Strict Mode enabled.
* Avoid any.
* Use explicit types.
* Export reusable interfaces.
* Reuse shared types.

---

# Styling Standards

* Tailwind CSS only.
* Responsive first.
* Dark Mode is optional until after Metro Pilot.
* Keep spacing consistent.

---

# Internationalization

All production UI text must come from the existing translation system.

Reuse:

* LanguageProvider
* useLanguage()
* Translation JSON

Never create another translation system.

Hard-coded strings are allowed only for:

* Console logs
* Debugging
* Test data
* Internal comments
* Temporary prototypes

---

# Shared Components

Always check existing shared components before creating new ones.

Avoid duplicate UI components.

---

# AI Development Rules

Every AI implementation task must include:

* Business Goal
* User Story
* Technical Scope
* Allowed Files
* Forbidden Files
* Acceptance Criteria
* Definition of Done

AI must never modify files outside the declared scope unless explicitly approved.

---

# Git Workflow

Main

main

Development

develop

Feature

feature/*

Commit format

IRM-001 feat(visitor): add visitor registration

IRM-002 fix(person): resolve validation issue

---

# Documentation

Major changes must update:

* ARCHITECTURE_DECISIONS.md (if architecture changes)
* ROADMAP.md
* PROJECT_PROGRESS.md
* CHANGELOG.md
* API documentation (if applicable)
* Database documentation (if applicable)

---

# Code Review Checklist

Before every commit:

* Build successful
* TypeScript passed
* ESLint passed
* Responsive verified
* Documentation updated

---

# Long-term Goals

IRM Enterprise must remain:

* Modular
* Scalable
* Maintainable
* Secure
* Enterprise Ready
* AI Friendly

---

End of Document
