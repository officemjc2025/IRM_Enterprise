# Chapter 06 — Coding Standard

**Version:** 1.0.0

**Status:** Active

**Owner:** IRM Enterprise Architecture Team

---

# Overview

This document defines the coding standards for IRM Enterprise.

The objective is to ensure that all source code remains consistent, maintainable, scalable, and understandable regardless of who writes it, whether a human developer or an AI assistant.

These standards apply to every module within the project.

---

# Objectives

The Coding Standard is designed to provide:

* Consistency
* Maintainability
* Readability
* Scalability
* Testability
* AI-Friendly Development

Every implementation should prioritize long-term maintainability over short-term convenience.

---

# Development Philosophy

IRM Enterprise follows:

Architecture First

↓

Database First

↓

API First

↓

Implementation

↓

Testing

↓

Documentation

No implementation should bypass the defined architecture.

---

# Coding Principles

Every implementation must follow:

Single Responsibility Principle

Separation of Concerns

Composition over Inheritance

Reusable Components

Strict Type Safety

Explicit Business Logic

Small Functions

Predictable Behavior

Avoid unnecessary complexity.

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

Version Control

* Git
* GitHub

Deployment

* Vercel

Every implementation should remain compatible with the approved technology stack.

---

# Layered Architecture

Every feature follows this structure.

```text
UI

↓

Hook

↓

Service

↓

Repository

↓

Supabase

↓

Database
```

Responsibilities must never overlap.

---

# Separation of Responsibilities

UI

Presentation only.

Hooks

State management and interaction.

Services

Business logic.

Repositories

Database access.

Database

Data persistence and constraints.

Each layer should remain independent.

---

# Source Code Organization

Every module should organize code consistently.

Typical structure

```text
features/

module/

components/

hooks/

services/

repositories/

types/

utils/
```

Avoid mixing unrelated functionality within the same folder.

---

# General Rules

Always:

* Use TypeScript strict mode.
* Reuse existing components.
* Prefer composition.
* Keep files focused.
* Write self-explanatory code.
* Follow project naming conventions.

Never:

* Duplicate business logic.
* Query Supabase directly from UI.
* Place business rules inside components.
* Introduce architectural shortcuts.

---

# Coding Philosophy

Readable code is preferred over clever code.

Consistency is preferred over personal style.

Architecture is preferred over convenience.

Long-term maintainability is the primary objective of every implementation.

---

# Section 1 — Naming Standard

Consistent naming improves readability, maintainability, and collaboration.

Every file, folder, variable, function, and component should follow predictable naming conventions.

---

# Folder Naming

Use:

kebab-case

Examples

```text
resident-management

work-orders

visitor-management
```

Avoid:

camelCase

snake_case

Spaces

---

# File Naming

React Components

PascalCase

Examples

```text
ResidentCard.tsx

VisitorTable.tsx

DashboardLayout.tsx
```

Hooks

camelCase

```text
useAuth.ts

useResident.ts

usePagination.ts
```

Services

camelCase

```text
resident.service.ts

auth.service.ts
```

Repositories

camelCase

```text
resident.repository.ts

workOrder.repository.ts
```

Types

camelCase

```text
resident.types.ts
```

---

# Variable Naming

Use meaningful names.

Correct

```text
resident

visitor

owner

reservation
```

Avoid

```text
a

b

tmp

data1
```

---

# Function Naming

Functions should describe actions.

Examples

```text
createResident()

updateResident()

deleteVisitor()

assignWorkOrder()
```

Avoid vague names.

---

# Boolean Naming

Boolean variables should answer a question.

Examples

```text
isLoading

isActive

hasPermission

canEdit
```

---

# Constants

Use UPPER_SNAKE_CASE.

Examples

```text
DEFAULT_PAGE_SIZE

MAX_UPLOAD_SIZE

API_VERSION
```

---

# Environment Variables

Always use

UPPER_SNAKE_CASE

Examples

```text
NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

# Section 2 — TypeScript Standard

TypeScript Strict Mode is mandatory.

---

# Type Safety

Never use

```text
any
```

Prefer

Interfaces

Types

Enums

Generics

Utility Types

---

# Interface Naming

Examples

```text
Resident

Visitor

Owner

Reservation
```

Avoid unnecessary prefixes.

---

# Optional Properties

Use optional fields only when business rules allow missing values.

Avoid excessive optional chaining.

---

# Null Handling

Prefer

```text
undefined
```

over

```text
null
```

unless the database explicitly returns null.

---

# Type Reuse

Never duplicate interfaces.

Shared types belong in:

```text
shared/types/
```

---

# Type Assertions

Avoid unnecessary casting.

Use explicit typing whenever possible.

---

# Summary

Consistent naming and strict typing improve readability, reduce defects, and make AI-generated code more reliable.

---

# Section 3 — React Standard

IRM Enterprise follows modern React development practices.

React components should remain small, reusable, and predictable.

---

# Component Principles

Every component should have a single responsibility.

Avoid components that perform multiple unrelated business functions.

---

# Component Types

Application components are divided into:

* Layout Components
* Feature Components
* Common Components
* Form Components
* Dialog Components

Business logic should remain outside presentation components.

---

# State Management

Use React state only for UI state.

Examples

Loading

Dialog Visibility

Selected Row

Expanded Section

Business data should be managed through Services and Hooks.

---

# Hooks

Reusable logic belongs inside custom hooks.

Examples

```text
useAuth()

useResidents()

usePagination()

useTheme()
```

Never duplicate hook logic.

---

# Section 4 — Service Layer

The Service Layer contains all business logic.

Services coordinate business rules but never interact directly with the user interface.

---

# Service Responsibilities

Services should:

* Validate business rules
* Coordinate repositories
* Transform data
* Handle transactions
* Trigger audit logging

Services should not render UI.

---

# Service Communication

```text
UI

↓

Hook

↓

Service

↓

Repository
```

Services never call React components.

---

# Section 5 — Repository Pattern

Repositories isolate all database access.

They provide a consistent interface between business logic and persistence.

---

# Repository Responsibilities

Repositories should:

* Execute queries
* Map database results
* Handle persistence
* Return typed objects

Repositories should not implement business rules.

---

# Repository Rules

Never access Supabase directly from:

Components

Pages

Hooks

Only repositories communicate with Supabase.

---

# Section 6 — Error Handling

Errors should be predictable and recoverable whenever possible.

---

# Error Principles

Handle errors close to their source.

Provide meaningful messages.

Avoid silent failures.

Log operational errors.

Return typed results.

---

# Error Flow

```text
Repository

↓

Service

↓

API

↓

Frontend
```

Every layer may enrich an error but should not lose the original context.

---

# Section 7 — Testing

Every completed feature should be validated before merging.

Minimum validation:

* TypeScript
* ESLint
* Build
* Manual Functional Test

Future versions may include automated testing.

---

# Section 8 — Performance

Performance should be considered during implementation.

Avoid:

* Duplicate database queries
* Large components
* Unnecessary re-renders
* Repeated calculations

Prefer reusable hooks and efficient data fetching.

---

# Section 9 — Documentation

Source code and documentation should evolve together.

Whenever architecture changes:

Update Blueprint.

Whenever public behavior changes:

Update documentation.

Documentation is part of the implementation.

---

# Section 10 — Future Expansion

Future development standards may include:

* Automated Code Formatting
* Static Analysis
* Unit Testing
* Integration Testing
* End-to-End Testing
* Performance Benchmarking
* Security Scanning
* CI/CD Quality Gates

These enhancements should extend—not replace—the existing coding standards.

---

# Chapter Summary

This Coding Standard establishes a unified development approach for IRM Enterprise.

It defines:

* Naming Conventions
* TypeScript Standards
* React Standards
* Service Layer
* Repository Pattern
* Error Handling
* Testing
* Performance
* Documentation
* Future Development Standards

All source code within IRM Enterprise should comply with these guidelines.

The objective is to produce software that is consistent, maintainable, scalable, and suitable for long-term enterprise development.

---

# End of Chapter 06

This document is the official coding standard for IRM Enterprise.

All contributors, whether human developers or AI assistants, should follow these standards when implementing new features or modifying existing functionality.
