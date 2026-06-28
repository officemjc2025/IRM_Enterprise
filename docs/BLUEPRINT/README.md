# IRM Enterprise Master Blueprint

**Version:** 1.0.0

**Status:** Active Development

**Architecture Owner:** IRM Enterprise Architecture Team

---

# Overview

The IRM Enterprise Master Blueprint is the official architectural reference for the entire IRM Enterprise platform.

This documentation defines:

* Business Vision
* Enterprise Architecture
* Database Design
* Business Rules
* Coding Standards
* API Standards
* Development Workflow
* Security Standards
* UI Standards
* AI Development Rules

Every module developed for IRM Enterprise must comply with this Blueprint.

---

# Purpose

This Blueprint serves as the single source of truth for:

* Developers
* Software Architects
* AI Coding Assistants
* Technical Documentation
* Future Contributors

When there is any conflict between implementation and documentation, this Blueprint must be reviewed first.

---

# Technology Stack

Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

Backend

* Supabase
* PostgreSQL

Authentication

* Supabase Auth

Deployment

* Vercel

Repository Pattern

Service Layer

Strict TypeScript

---

# Documentation Structure

## Blueprint

| Chapter | Description               |
| ------- | ------------------------- |
| 00      | Project Vision            |
| 01      | System Architecture       |
| 02      | Master Database           |
| 03      | Role Based Access Control |
| 04      | Property Management       |
| 05      | Resident Management       |
| 06      | Rental Management         |
| 07      | Visitor Management        |
| 08      | Security Gate             |
| 09      | Work Order                |
| 10      | Finance & SoftBis         |
| 11      | Notification              |
| 12      | Document Management       |
| 13      | Reporting & Analytics     |
| 14      | UI Design System          |
| 15      | API Standard              |
| 16      | Coding Standard           |
| 17      | Database Convention       |
| 18      | Security Standard         |
| 19      | Deployment                |
| 20      | Testing                   |
| 21      | Git Workflow              |
| 22      | AI Development Guide      |
| 23      | Roadmap                   |
| 24      | Changelog                 |

---

# Supporting Documentation

## ADR

Architecture Decision Records

Used to record major technical decisions.

---

## DECISIONS

Business decisions and domain rules.

Example

* Ownership Model
* Resident Model
* Visitor Policy
* Rental Rules

---

## STANDARDS

Development standards.

Includes

* TypeScript
* React
* Next.js
* Tailwind
* Database
* API
* Security
* Git

---

## TEMPLATES

Reusable templates.

Examples

* Repository
* Service
* Hook
* CRUD Page
* SQL Migration
* Prompt

---

## PROMPTS

AI Prompt Library.

Every AI assistant should reference these prompts before generating code.

---

# Development Workflow

Every feature follows the same lifecycle.

Business Requirement

↓

Blueprint

↓

Architecture

↓

Database Design

↓

Business Rules

↓

API Design

↓

Repository

↓

Service

↓

Hook

↓

UI

↓

Testing

↓

Code Review

↓

Production

---

# Architecture Principles

IRM Enterprise follows these principles.

1. Database First

2. Architecture First

3. Business Driven Design

4. Repository Pattern

5. Service Layer

6. Modular Architecture

7. Security by Design

8. Mobile First

9. Cloud Native

10. AI Assisted Development

---

# Module Dependency

```text
Authentication
        │
        ▼
Profiles
        │
        ▼
Properties
        │
        ▼
Buildings
        │
        ▼
Floors
        │
        ▼
Units
        │
        ▼
Residents
        │
        ├─────────────┐
        ▼             ▼
Rental         Visitor
        │             │
        └──────┬──────┘
               ▼
        Work Orders
               │
               ▼
        Finance
```

---

# Definition of Done

A module is considered complete only when:

* Blueprint updated
* Database documented
* Business Rules documented
* Repository implemented
* Service implemented
* Hook implemented
* UI completed
* TypeScript passes
* ESLint passes
* Production Build passes
* Documentation updated
* Git committed

---

# Version History

| Version | Description              |
| ------- | ------------------------ |
| 1.0.0   | Initial Master Blueprint |
