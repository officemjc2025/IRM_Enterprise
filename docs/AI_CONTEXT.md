# IRM Enterprise — AI Context

**Version:** 1.0.0

**Status:** Active

**Owner:** IRM Enterprise Architecture Team

---

# Purpose

This document is the primary context file for every AI assistant working on IRM Enterprise.

Before making architectural decisions, generating code, modifying database structures, creating UI, or producing documentation, every AI should first read this file.

This document provides the minimum required context while referencing the detailed Blueprint documents.

---

# Project Overview

IRM Enterprise is an Enterprise Property Operating System designed for condominiums, apartments, hotels, resorts, and mixed-use developments.

The platform integrates:

* Property Management
* Resident Management
* Rental Management
* Visitor Management
* Security Management
* Work Order Management
* Finance Integration
* Document Management
* Notification System
* Reporting

The architecture is designed for long-term scalability.

---

# Primary Objectives

Every implementation must satisfy the following objectives.

* Enterprise Architecture
* Modular Design
* Database First
* Security First
* Mobile First
* AI Assisted Development
* Long-term Maintainability

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
* Supabase Authentication
* Supabase Storage

Deployment

* Vercel

Version Control

* Git
* GitHub

---

# Architecture Principles

The project follows:

Database First

↓

Architecture First

↓

Documentation First

↓

Implementation

No implementation should contradict the Blueprint.

---

# Current Blueprint

The following Blueprint documents define the project.

00_PROJECT_VISION.md

01_SYSTEM_ARCHITECTURE.md

02_DATABASE_MASTER.md

03_RBAC.md

04_UI_UX_STANDARD.md

Future chapters should extend this list.

---

# Development Workflow

Every feature follows the same workflow.

Business Requirement

↓

Blueprint

↓

Database

↓

API

↓

Service

↓

Repository

↓

UI

↓

Testing

↓

Documentation

---

# Folder Structure

```text
docs/
    BLUEPRINT/
    ADR/
    PROMPTS/
    SPEC/

app/

components/

features/

hooks/

providers/

repositories/

services/

shared/

types/

lib/
```

---

# Coding Principles

Every implementation must follow:

Single Responsibility Principle

Repository Pattern

Service Layer

Reusable Components

Strict TypeScript

Role-Based Authorization

Property Isolation

Audit Logging

Soft Delete

---

# Database Principles

The database follows:

UUID Primary Keys

Soft Delete

Audit Columns

Foreign Keys

Normalized Schema

Row Level Security

Property Isolation

Historical Preservation

Never duplicate business entities.

---

# Security Principles

Authentication

Supabase Auth

Authorization

IRM Enterprise RBAC

Database Protection

Supabase Row Level Security

Permission evaluation always follows:

Authentication

↓

Role

↓

Permission

↓

Property

↓

Ownership

↓

Business Rules

↓

Database RLS

---

# UI Principles

The UI follows:

Modern Enterprise Design

Responsive Layout

Consistent Navigation

Permission-Based Menus

Accessibility

Component Reuse

Design consistency is mandatory.

---

# Documentation Policy

Blueprint documents are the single source of architectural truth.

AI assistants should never invent architecture that conflicts with Blueprint documents.

When uncertain:

Prefer updating the Blueprint before generating implementation.

---

# AI Working Rules

Before implementing any feature:

1. Identify the affected Blueprint chapter.
2. Verify database impact.
3. Verify RBAC impact.
4. Verify UI consistency.
5. Verify documentation impact.
6. Generate implementation.

---

# AI Response Guidelines

AI assistants should:

Explain architectural decisions.

Prefer maintainability over shortcuts.

Avoid unnecessary complexity.

Reuse existing components whenever possible.

Keep modules independent.

Follow established project conventions.

---

# Long-Term Vision

IRM Enterprise is expected to evolve into a complete Enterprise Property Operating System supporting:

* Multi-Property
* Multi-Organization
* Multi-Country
* SaaS Deployment
* AI Integration
* IoT Integration
* Enterprise Reporting

without architectural redesign.

---

# Authoritative References

Priority order for resolving conflicts:

1. AI_CONTEXT.md

2. Blueprint Documents

3. ADR Documents

4. Module Specifications

5. Source Code

Source code should follow documentation—not the other way around.

---

# Standard Prompt

When starting a new AI session, use the following instruction.

"Read `docs/AI_CONTEXT.md` first. Use it as the primary project context. Follow the Blueprint documents before generating any architecture, database, API, UI, or source code. Do not introduce patterns that conflict with the documented architecture."

---

# Context Version

Version: 1.0.0

Last Updated: Initial Enterprise Blueprint

Status: Active
