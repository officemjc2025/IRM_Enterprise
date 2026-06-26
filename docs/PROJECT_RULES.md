# IRM Enterprise Project Rules

Version: 1.0

Status: Active

---

# Purpose

This document defines the mandatory development rules for the IRM Enterprise project.

Every contributor, AI assistant, and developer must follow these rules.

---

# Architecture

* Follow the architecture defined in `docs/architecture.md`.
* Do not introduce new architecture without approval.
* Keep the project modular.

---

# Folder Rules

Business Modules → modules/

Reusable UI → components/

Shared Code → shared/

React Providers → providers/

Custom Hooks → hooks/

Language Files → messages/

Documentation → docs/

---

# React Rules

* Functional Components only.
* No business logic inside UI components.
* Reuse components whenever possible.

---

# TypeScript Rules

* Strict Mode enabled.
* Avoid `any`.
* Use explicit types.
* Export shared interfaces.

---

# Styling

* Tailwind CSS only.
* Responsive first.
* Dark Mode supported.
* Consistent spacing.

---

# Internationalization

* Never hardcode UI text.
* All user-facing text must come from language resources.
* Default language is Thai.

---

# Git Workflow

Main Branch

main

Development Branch

develop

Feature Branches

feature/*

---

# Commit Convention

Example

IRM-005 feat(visitor): add visitor registration

IRM-006 fix(work-order): resolve assignment bug

---

# Documentation

Every major feature must update:

* Architecture
* Roadmap
* Sprint Log
* Database Design (if applicable)
* API Specification (if applicable)

---

# Code Review Checklist

Before commit:

* Build successful
* TypeScript passed
* ESLint passed
* Responsive verified
* Documentation updated

---

# Long-term Goal

IRM Enterprise must remain:

* Modular
* Scalable
* Maintainable
* Secure
* Enterprise Ready

---

End of Document
