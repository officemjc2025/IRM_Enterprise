# IRM Enterprise — Coding Standards

This document establishes the official coding standards and development guidelines for IRM Enterprise. Adherence to these standards is mandatory for all developers and AI assistants.

---

## 1. Naming Conventions

### File & Directory Names
- **React Components**: `PascalCase` (e.g., `PropertyCard.tsx`, `VisitorTable.tsx`).
- **React Hooks**: `camelCase` starting with `use` (e.g., `useAuth.ts`, `useVisitorCheckIn.ts`).
- **Helpers / Utilities**: `camelCase` (e.g., `formatDate.ts`, `calculateFees.ts`).
- **Constants**: `camelCase` or `UPPER_CASE` for global configuration (e.g., `MAX_UPLOAD_SIZE`, `themeConfig.ts`).
- **Types & Interfaces**: `PascalCase` (e.g., `VisitorRecord.ts`, `PropertyInfo.ts`).

### Code Symbol Names
- **Variables / Functions**: `camelCase` (e.g., `activeOccupants`, `handleLogout()`).
- **Classes / Types / Interfaces**: `PascalCase` (e.g., `class VisitorService`, `interface AuthUser`).
- **Database Tables**: Plural lowercase (e.g., `properties`, `units`).
- **Database Views**: Singular lowercase (e.g., `property`, `unit`).

---

## 2. Folder Conventions
Code must be organized strictly into the designated directories to ensure modularity and high cohesion:
- **`app/`**: Next.js routing, pages, and API endpoints. No business logic or presentation components here.
- **`features/`**: Domain-specific feature modules containing their own pages, hooks, services, and local UI components.
- **`components/`**: Global reusable UI components. Check here before writing a new UI element.
- **`repositories/`**: Supabase/Database data access layer.
- **`services/`**: Core business domain logic and services.
- **`providers/`**: Global React Context providers (Auth, Language, Theme).
- **`hooks/`**: Global custom React hooks.
- **`shared/`**: Common utilities, validation schemas, guards, types, and constants.

---

## 3. Import Rules
- **Use Path Aliases**: Always use the `@/` path alias pointing to the root directory for non-relative imports:
  - Correct: `import { useAuth } from "@/providers/AuthProvider";`
  - Incorrect: `import { useAuth } from "../../../../providers/AuthProvider";`
- **Group Imports**: Organize imports in the following order, separated by a blank line:
  1. React and Next.js built-ins.
  2. Third-party library imports.
  3. Path-aliased local modules (e.g., `@/components`, `@/services`).
  4. Relative path sibling components/styles.

---

## 4. Repository Pattern
Repositories in `repositories/` are the exclusive interface to the database:
- **Data-Only Responsibility**: Repositories are responsible only for executing database commands (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
- **No Business Logic**: Do not embed default object generation, onboarding, fallbacks, or state alterations in a repository.
- **Updatable View Queries**: Query the singular view aliases (e.g. `property`, `unit`) to align with existing frontend interfaces.
- **Return Type Consistency**: Repositories should return raw data or throw/pass descriptive PostgrestErrors up to the service layer.

---

## 5. Service Pattern
Services in `services/` handle application business rules:
- **Separation of Concerns**: Services coordinate business logic, trigger notifications, check permissions, and format domain models.
- **Onboarding and Fallback Owner**: Services dictate what happens when a database record is missing. For example, if a profile query returns `null`, the service logs a `DataIntegrityError` and bubble-up the error state.
- **Statelessness**: Service classes should remain stateless, executing operations based on input arguments and context providers.

---

## 6. Feature Module Pattern
Domain-specific code must reside within its own folder in `features/` (e.g., `features/visitor/`):
- **Encapsulated Subfolders**:
  - `components/`: UI components exclusive to this feature.
  - `hooks/`: Custom React hooks orchestrating the state/queries for this feature.
  - `pages/`: Page containers that bind to app routing layers.
  - `services/`: Specific orchestrators for this domain.
- **Zero Cross-Module Direct Access**: Do not import local components, hooks, or styles directly from another feature. Communicate via `shared/` or global layers.

---

## 7. API Conventions
All API endpoints live under `app/api/v1/`:
- **RESTful Endpoints**: Use standard HTTP methods to represent actions:
  - `GET`: Retrieve data.
  - `POST`: Create new records.
  - `PUT` / `PATCH`: Update records.
  - `DELETE`: Archive/soft-delete records.
- **Standardized Response Format**: API routes must return a consistent JSON response:
  ```json
  {
    "success": true,
    "data": { ... },
    "error": null
  }
  ```
- **Proper Status Codes**: Always use correct HTTP status codes (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Internal Server Error).

---

## 8. Error Handling Conventions
- **Prevent Silent Failures**: Never write empty catch blocks. Always log errors or return them.
- **Detailed Log Context**: When logging errors (especially PostgrestErrors), log all available keys:
  ```ts
  console.error("Operation failed:", {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint
  });
  ```
- **Custom Error Types**: Use domain-specific error classes (e.g., `DataIntegrityError`, `ValidationError`, `PermissionError`) to differentiate between network failures, rule violations, and system faults.
