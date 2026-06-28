# Service Module Template

The Service Layer coordinates business logic, orchestrates data flow, enforces system invariants, and wraps repository operations. It acts as the mediator between the UI (hooks) and the Data Access Layer (repositories).

## Communication Flow

```text
UI (Component) -> React Hook -> Service Layer -> Repository Layer -> Supabase (DB)
```

## Responsibilities

* **Business Invariant Enforcement**: Validate input data against business constraints.
* **Transaction Coordination**: Manage multi-table operations or database transactions.
* **Audit Logging**: Coordinate the creation of system audit logs.
* **Third-Party Integration**: Call external microservices, notification systems, or integrations (e.g., LINE OA, Email).
* **DTO Mapping**: Map UI forms to repository payloads and format repository entities into clean UI models.

## Allowed

* Importing repositories and central constants.
* Orchestrating calls to multiple repositories.
* Performing business validations (e.g., checking user eligibility before booking).
* Formatting data for display (TH/EN translation application).

## Not Allowed

* **No Direct DB Access**: Services must never execute raw SQL, construct database queries, or write directly to Supabase client APIs.
* **No React/UI Dependencies**: Services must not import React hooks, components, or browser APIs (like `localStorage` or `window`).
* **No Mock Logic in Production**: All services must call their corresponding repository functions.

## Typical Service Signature

Services are object exports containing stateless async functions:

```typescript
import * as domainRepository from "@/repositories/domain/domain.repository";
import { DomainEntity, CreateDomainDTO } from "@/types/domain";

export const domainService = {
  async getDetail(id: string): Promise<DomainEntity | null> {
    return domainRepository.findById(id);
  },

  async create(payload: CreateDomainDTO): Promise<DomainEntity> {
    // 1. Business Logic / Invariant validation
    // 2. Repository invocation
    const result = await domainRepository.insert(payload);
    // 3. Optional Audit Log or Notification Trigger
    return result;
  }
};
```
