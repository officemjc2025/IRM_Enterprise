# Chapter 01 — System Architecture

**Version:** 1.0.0

**Status:** Active

**Document Owner:** IRM Enterprise Architecture Team

---

# Overview

This document defines the enterprise architecture of IRM Enterprise.

It describes how every module communicates, how business logic is organized, how data flows through the application, and how future modules can be added without redesigning the system.

The architecture follows a layered, modular, and domain-driven approach.

---

# Architecture Principles

IRM Enterprise follows these architectural principles.

* Separation of Concerns
* Single Responsibility Principle
* Dependency Inversion
* Modular Design
* Domain-Oriented Structure
* Repository Pattern
* Service Layer
* Strict Type Safety
* Security by Design
* Cloud Native

---

# High-Level Architecture

```text
                        Client
                           │
            ┌──────────────┴──────────────┐
            │                             │
        Desktop                       Mobile
            │                             │
            └──────────────┬──────────────┘
                           │
                    Next.js Application
                           │
      ┌────────────────────┼────────────────────┐
      │                    │                    │
 Components             Features           Providers
      │                    │                    │
      └──────────────┬─────┴──────────────┬─────┘
                     │                    │
                  Services            Repositories
                     │                    │
                     └────────────┬───────┘
                                  │
                           Supabase Client
                                  │
               ┌──────────────────┼──────────────────┐
               │                  │                  │
           PostgreSQL        Authentication      Storage
```

---

# Layered Architecture

IRM Enterprise is divided into multiple logical layers.

---

## Presentation Layer

Responsible for rendering user interfaces.

Examples

* Pages
* Layouts
* Components
* Forms
* Tables
* Dialogs

Business logic is not implemented here.

---

## Feature Layer

Each business domain owns its own feature folder.

Examples

* Resident
* Rental
* Visitor
* Work Order
* Security

Each feature is isolated from other features.

---

## Service Layer

Contains business logic.

Responsibilities

* Validation
* Business Rules
* Transactions
* Calculations
* Workflow Coordination

Services never communicate directly with UI components.

---

## Repository Layer

Responsible for all database access.

Responsibilities

* CRUD Operations
* Query Building
* Pagination
* Filtering
* Search
* Database Mapping

Repositories never contain business logic.

---

## Database Layer

Implemented using PostgreSQL through Supabase.

Responsibilities

* Data Storage
* Constraints
* Indexes
* Relationships
* Row Level Security

---

# Project Structure

```text
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
middleware.ts
```

---

# Feature Structure

Each feature follows the same structure.

```text
features/

resident/

components/

hooks/

types/

utils/

constants/
```

Every feature should remain independent.

---

# Repository Pattern

Repositories communicate directly with Supabase.

Example

```text
Resident Repository

↓

Supabase

↓

Residents Table
```

Repositories must never call another repository.

---

# Service Layer

Services coordinate business logic.

Example

```text
Create Resident

↓

Validate Request

↓

Check Unit

↓

Create Profile

↓

Create Resident

↓

Assign Occupancy

↓

Return Result
```

Services may call multiple repositories.

---

# Providers

Providers manage global application state.

Examples

* Authentication
* Language
* Theme

Providers must never contain database logic.

---

# Hooks

Hooks provide reusable logic for UI components.

Examples

```text
useAuth()

useProfile()

useResident()

useVisitor()

useUnit()
```

Hooks communicate only with services.

---

# Shared Layer

Contains reusable code.

Examples

* Roles
* Permissions
* Guards
* Utilities
* Constants

Shared modules must not depend on business modules.

---

# Authentication Flow

```text
Login Page

↓

Auth Service

↓

Auth Repository

↓

Supabase Auth

↓

Session

↓

Auth Provider

↓

Application
```

---

# Request Flow

Every request follows the same lifecycle.

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

Direct UI-to-database communication is prohibited.

---

# Folder Ownership

Each folder has a defined responsibility.

| Folder       | Responsibility        |
| ------------ | --------------------- |
| app          | Routing               |
| components   | Reusable UI           |
| features     | Business Modules      |
| hooks        | Reusable Logic        |
| providers    | Global State          |
| repositories | Data Access           |
| services     | Business Logic        |
| shared       | Common Resources      |
| types        | Type Definitions      |
| lib          | External Integrations |

---

# Error Handling

Errors are categorized into:

* Validation Errors
* Authentication Errors
* Authorization Errors
* Business Rule Errors
* Database Errors
* External Service Errors

Services should return structured results rather than throwing unhandled exceptions whenever possible.

---

# Security

Every request must validate:

* Authentication
* Authorization
* Business Permission
* Resource Ownership

Security is enforced in both application logic and database policies.

---

# Scalability

The architecture supports:

* Multi-Property
* Multi-Building
* Multi-Tenant
* Multi-Language
* Multi-Timezone
* Future Microservices
* API Expansion

without architectural redesign.

---

# Architecture Rules

The following rules are mandatory.

* UI never accesses Supabase directly.
* Business logic never exists inside components.
* Repositories never contain business rules.
* Services never manipulate UI state.
* Components remain presentation-focused.
* Shared code must remain framework-independent whenever possible.
* Every new module follows the same architecture.

---

# Future Expansion

The architecture is designed to support future integrations including:

* Mobile Applications
* Public REST APIs
* GraphQL
* IoT Devices
* Smart Access Control
* AI Services
* Business Intelligence
* ERP Integration
* Payment Gateways
* Government Services

without restructuring the application.
