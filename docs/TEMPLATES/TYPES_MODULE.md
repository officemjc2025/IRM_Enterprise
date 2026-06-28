# Types Module Template

TypeScript typing rules enforce safety, self-documentation, and runtime predictability. This document outlines how to organize typescript contracts and where types should reside.

## Type Classification

### 1. Domain Entities
* **Definition**: Interfaces representing database tables or core business models.
* **Rules**: Always define these as strict interfaces. All database columns must be represented correctly (nullable fields marked as `| null`).
* **Location**: Put in `types/your-domain.ts` at the root folder level.

### 2. DTOs (Data Transfer Objects)
* **Definition**: Payloads used for creating, updating, or deleting entities.
* **Rules**: Use typescript utility types to create variations (e.g., `Omit<Entity, 'id' | 'created_at'>`).
* **Location**: Put alongside the main Domain Entity file, or in a `types/dto.ts` subfile.

### 3. Local UI Types
* **Definition**: Form state structures, drop-down option lists, and component-specific states.
* **Rules**: Do not pollute the repository layer with local UI states.
* **Location**: Save inside the specific feature folder at `features/your-domain/types/index.ts`.

## Where to Place Types: Decision Matrix

| Type Scope | Description | Target Directory |
|---|---|---|
| **Global / Cross-Module** | Used by 2 or more distinct feature domains (e.g. User, Property, Status, API Response). | `shared/types/` or `shared/enums/` |
| **Domain / Persistence** | Maps to database tables or repository models. | `types/your-domain.ts` |
| **Local Feature / UI** | Used only by React components or local hooks. | `features/your-domain/types/` |

## Strict Rules

* **No implicit or explicit `any`**: TypeScript strict mode is enabled. Use `unknown` or specific interfaces.
* **No Inline Types for API contracts**: Avoid defining complex types directly in function parameters. Define a typed contract interface instead.
