# IRM Developer Toolkit (IDT)

Version: 1.0.0

Status: Planned

---

# Vision

IRM Developer Toolkit (IDT) is the official developer toolkit for IRM Enterprise.

Its purpose is to automate repetitive development tasks, enforce project standards, and accelerate module creation while maintaining architectural consistency.

IDT is designed for developers and AI assistants.

---

# Objectives

* Reduce repetitive coding
* Standardize project structure
* Minimize AI token usage
* Improve development speed
* Maintain Coding Standard
* Maintain API Standard
* Maintain Blueprint compliance

---

# Architecture

```text
Developer

↓

IRM Developer Toolkit

↓

Project Templates

↓

Generated Source Code

↓

Business Logic
```

IDT generates project structure.

Developers implement business logic.

---

# Principles

IDT never generates business rules.

IDT never modifies existing modules automatically.

IDT creates only standardized project scaffolding.

Business implementation remains under developer control.

---

# Toolkit Structure

```text
tools/

create-module/

create-api/

create-page/

create-domain/

create-policy/

create-rbac/

create-test/

templates/

shared/

README.md
```

---

# Version Roadmap

## Version 1

Module Generator

Command

```bash
npm run create:module <module-name>
```

Creates

* Feature
* Service
* Repository
* Types
* Index files

---

## Version 2

API Generator

Command

```bash
npm run create:api <module-name>
```

Creates

* Route
* Controller
* DTO
* Validation

---

## Version 3

Page Generator

Command

```bash
npm run create:page <module-name>
```

Creates

* List
* Detail
* Form

---

## Version 4

CRUD Generator

Creates complete CRUD implementation.

---

## Version 5

RBAC Generator

Creates:

* Roles
* Permissions
* Guards
* Policies

---

## Version 6

Test Generator

Creates:

* Unit Tests
* Integration Tests
* Mock Files

---

## Version 7

Documentation Generator

Creates:

* Domain Document
* API Document
* Module README

---

# Template Engine

Every generator uses predefined templates.

Templates are the single source of truth.

Generated code must follow:

* Coding Standard
* API Standard
* Module Template
* Folder Structure

---

# Naming Rules

Modules

snake_case folders

Example

resident

owner

visitor

rental

Services

module.service.ts

Repositories

module.repository.ts

Types

module.types.ts

Pages

ModuleList.tsx

ModuleForm.tsx

ModuleDetail.tsx

---

# Future Commands

```bash
npm run create:module resident

npm run create:api resident

npm run create:page resident

npm run create:crud resident

npm run create:test resident

npm run create:policy resident

npm run create:rbac resident

npm run create:docs resident
```

---

# Development Workflow

Business Analysis

↓

Domain Design

↓

Toolkit Generation

↓

Business Implementation

↓

Testing

↓

Review

↓

Commit

---

# Benefits

IDT provides

* Consistent architecture
* Faster development
* Lower AI token consumption
* Predictable project structure
* Easier onboarding
* Reusable templates
* Long-term maintainability

---

# Long-Term Vision

IDT will evolve into the official development platform for IRM Enterprise.

Every future module will be created through the toolkit before business logic is implemented.

The toolkit becomes the foundation for scalable, maintainable, and AI-assisted enterprise software development.

