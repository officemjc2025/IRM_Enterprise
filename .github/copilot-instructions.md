<!--
Project: IRM Enterprise
Description: GitHub Copilot instruction file for enterprise-quality development
Stack: Next.js App Router, TypeScript, Tailwind CSS, Supabase, PostgreSQL, Vercel
-->

# GitHub Copilot Instructions — IRM Enterprise

Purpose
- Provide clear, consistent, and scalable guidance for Copilot suggestions across the IRM Enterprise repository.
- Ensure generated code aligns with our security, architecture, UX, and maintainability standards.

Usage
- Developers should request code completions that follow these rules. When Copilot generates code that deviates, prefer edits that make the output compliant.

Core Principles
- Safety-first: never suggest secrets, credentials, or insecure defaults.
- Explicitness: prefer clear, typed, and documented code over implicit shortcuts.
- Consistency: follow the conventions in this file for names, folders, and APIs.
- Small, reviewable changes: prefer many small PRs with focused scope.

1. Coding standards
- Language: TypeScript (strict mode enabled). Prefer explicit return types for exported functions and components.
- Formatting: follow Prettier and ESLint rules defined in the repository. Do not reformat files outside the immediate change.
- Immutability: prefer immutable data patterns and readonly types where reasonable.
- Error handling: handle and surface errors with typed Result-like shapes or well-documented thrown errors. Avoid silent failures.
- Comments: use concise JSDoc for public modules, exports, and non-obvious logic. Keep comments up to date.

2. Folder structure (high-level)
- app/ — Next.js App Router pages and layout. Keep route-level data fetching close to routes.
- components/ — Reusable presentational components (organize by domain when large).
- layouts/ — App-level and page-level layout components.
- features/ — Domain features composed of components, hooks, and small API adapters.
- contexts/ — React contexts and provider composition.
- hooks/ — Reusable composable React hooks.
- lib/ — Lightweight, framework-agnostic helpers and small adapters (e.g., supabase client wrapper).
- services/ — API clients, business logic, and integration adapters. Do not put UI here.
- styles/ — Global Tailwind config, tokens, and CSS utilities.
- types/ — Shared TypeScript types and domain models.
- utils/ — Misc helpers that are not domain-specific.
- public/ — Static assets.

Notes:
- Keep feature-scoped code colocated: a `features/resident/` folder may contain `components/`, `hooks/`, and `api/` used only by that feature.

3. Naming conventions
- Files: use kebab-case for filenames (e.g., `kpi-card.tsx`).
- Components: PascalCase and exported as default or named export matching filename (e.g., `KpiCard`).
- Hooks: `use` prefix with camelCase, and filename matches (e.g., `useAuth.ts`).
- Types/Interfaces: `PascalCase`, suffix `Props` for component props (e.g., `ResidentCardProps`).
- Constants: `SCREAMING_SNAKE_CASE` for environment-based constants; otherwise `camelCase` or `kebab-case` for files.
- API routes/handlers: use clear verbs and nouns in paths, plural resource names (e.g., `/api/residents`, `/api/leases`).

4. Architecture principles
- Layered separation: UI → features → services → persistence. UI should call feature-level facades, not DB clients directly.
- Single source of truth: centralize configuration (e.g., Tailwind tokens, Supabase client) and reference through well-typed wrappers.
- Domain-driven modules: implement bounded contexts inside `features/` to prevent cross-cutting coupling.
- Contracts and types: use shared TypeScript interfaces for API contracts; avoid `any` across boundaries.
- Side-effects: isolate side-effects (network, storage) in `services/` with small, testable functions.

5. UI guidelines
- Design tokens: centralize spacing, color, and typographic tokens in `styles/` and Tailwind config.
- Accessibility: components must meet WCAG AA; use semantic HTML, ARIA where appropriate, and keyboard navigation.
- Responsiveness: mobile-first CSS; use Tailwind utilities and responsive variants.
- Component APIs: prefer small, composable props; accept `className` and `data-testid` where useful.
- State: prefer local component state for UI-only concerns; use contexts or feature stores for cross-component state.

6. Database rules (PostgreSQL + Supabase)
- Schema design: use normalized schema for core domain models; prefer explicit join tables for many-to-many.
- Migrations: use SQL migration files stored in `db/migrations` and run via CI. Do not rely on auto-generated runtime schema changes.
- Naming: snake_case for DB tables and columns. Use plural table names (e.g., `residents`, `leases`).
- Constraints: always define primary keys, foreign keys, unique constraints, and NOT NULL where applicable.
- Soft deletes: use `deleted_at TIMESTAMP WITH TIME ZONE` for entities requiring audit/history; filter them explicitly.
- Indexing: add indexes on foreign keys and columns used in filters or joins. Document why an index exists.

7. Authentication & Authorization
- Auth provider: Supabase Auth as the primary identity provider for end users.
- Tokens: do not persist access tokens in localStorage; prefer secure httpOnly cookies when server-side session is needed.
- Role model: implement RBAC with roles (e.g., `admin`, `manager`, `staff`, `resident`) stored in the user profile and enforced server-side.
- Principle of least privilege: default to deny; grant minimal permissions required.
- Multi-tenant / scoped access: include `property_id` or tenant scoping in auth claims and enforce it in queries.

8. Security rules
- Secrets: never store secrets in repository. Use Vercel and Supabase environment variables and reference via `process.env`.
- Input validation: validate and sanitize all external inputs at service/API boundaries. Use schema validation (e.g., Zod) for runtime checks.
- SQL safety: use parameterized queries or client libraries — never interpolate raw values into SQL strings.
- XSS & CSRF: escape untrusted content in UI; protect state-changing endpoints with CSRF tokens when using cookies.
- Encryption: enforce TLS for all network traffic; encrypt sensitive PII at rest where required by policy.
- Audit logging: log security-relevant events with context (actor, action, resource) to a secure audit store.

9. API conventions
- RESTful endpoints: prefer REST-like resources with clear nouns and verbs for action endpoints.
- HTTP semantics: use proper HTTP status codes (200, 201, 204, 400, 401, 403, 404, 409, 422, 500).
- Pagination: use cursor-based pagination for large lists; include `meta` object with `nextCursor` and `limit`.
- Versioning: include version prefix when breaking changes are possible (e.g., `/api/v1/...`).
- Contracts: define request/response schemas and share types between client and server where feasible.
- Errors: return structured error objects with `code`, `message`, and optional `details` for client handling.

10. Git & commit conventions
- Branching: use short-lived feature branches: `feature/`, `fix/`, `chore/`, `hotfix/` prefixes.
- PRs: small, focused PRs with descriptive titles and linked issue/decision records.
- Commit messages: follow Conventional Commits style. Example: `feat(auth): add SSO login for managers`.
- Reviews: require at least one approving review from a different team member; security-sensitive changes require security review.
- CI: all PRs must pass lint, type-check, unit tests, and migration checks before merge.

11. Testing and quality
- Types: keep TypeScript `strict` on; add tests when introducing business logic or critical flows.
- Unit tests: use vitest/jest for logic; mock external services at edges.
- Integration tests: include critical API flows that cover auth, multi-tenant access, and data integrity.
- End-to-end: use Playwright or Cypress for main user flows; run a small smoke suite in CI for each merge to `main`.

12. Observability & operations
- Metrics: emit business and performance metrics (APIs, background jobs, DB query latency).
- Tracing: use distributed tracing for cross-service requests when applicable.
- Alerts: define SLOs and alert thresholds for latency, error rate, and job failures.
- Runbooks: maintain runbooks for frequent incidents and for on-call troubleshooting steps.

13. Performance
- Data loading: prefer incremental and paged data loading; avoid rendering large lists without virtualization.
- Caching: use HTTP caching headers and server-side caching for stable, expensive queries. Invalidate caches on writes.
- DB queries: prefer narrow selects and avoid N+1 queries by using joins or batched loaders.

14. Compliance & privacy
- PII handling: classify data and apply least privilege, retention and deletion policies.
- Data residency: adhere to customer/regulatory requirements for data residency (document tenant-specific constraints).

15. Enterprise best practices
- Modularization: keep modules small, with explicit public APIs and minimal surface area.
- Documentation: maintain concise README sections for each feature and a high-level architecture doc in `docs/architecture`.
- Onboarding: include a `developer-setup` doc with local Supabase emulation or connection guidance.
- Secrets & rollout: use feature flags and staged rollouts for new behavior.
- Legal & compliance: route security or data classification questions to legal and infosec early.

Checklist for PRs (add to PR template)
- Code compiles with `tsc --noEmit`.
- Linting passes (`eslint`).
- Unit tests added/updated and passing.
- Migration files included when schema changes are present.
- Security checklist completed for sensitive changes.
- Documentation updated (if public API or behavior changed).

Final notes
- Treat this document as the single source of truth for Copilot-guided generation in this repo. Update it as architecture or policy changes occur.
- When in doubt, prefer explicit, well-typed, secure code and add a short explanation in the PR for rationale.

--
Generated for IRM Enterprise by repository guidelines.

16. IRM Enterprise Domain Rules
- Project structure: the codebase is modular. Every business domain must live under `/modules` and follow the module conventions below.
- Shared code: use the `/shared` folder for utilities, design tokens, types, and cross-cutting helpers intended for reuse across modules.
- UI components: centralize generic, reusable UI components under `/components` (presentational only). Domain-specific components may live inside each module's `components/` subfolder.
- Separation of concerns: do not place business logic inside UI components. UI components must be purely presentational and call into `services` or hooks for behavior.
- Module layout: every module must include the following structure (minimum):
	- `components/` — presentational and domain-scoped UI components
	- `services/` — data access, side-effects, and business operations
	- `hooks/` — module-specific React hooks
	- `types/` — domain TypeScript types and interfaces
	- `index.ts` — public exports and a small module facade
- Reusability: prefer reusable components; extract common UI patterns into `/components` or `/shared` rather than duplicating across modules.
- Scalability: always design module boundaries with future growth in mind (clear contracts, bounded contexts, and minimal surface area).

Business Modules (create under `/modules`)
- Dashboard
- Property
- Building
- Floor
- Room
- Owner
- Resident
- Tenant
- Rental
- Reservation
- Housekeeping
- Work Order
- Visitor
- Security
- Parking
- Finance
- Reports
- Administration

Database rules for modules
- UUIDs: All database tables must use UUID (UUIDv4) primary keys.
- Audit fields: all tables must include the following columns: `created_at`, `updated_at`, `created_by`, `updated_by` (use UTC timestamps for `created_at`/`updated_at`).

API and UI rules for modules
- Pagination: all APIs must support pagination (cursor-based preferred) and return `meta` with `nextCursor` and `limit` when applicable.
- Responsiveness: all pages must be responsive and follow mobile-first design.
- Dark mode: the application must support Dark Mode; design tokens and Tailwind config must provide theme variants.
- Tailwind: use Tailwind CSS exclusively for styling; do not introduce additional CSS frameworks.

Production readiness
- The project must be production-ready: enforce `strict` TypeScript, CI for linting/type-check/tests, database migrations, monitoring/alerts, and deployment pipelines (Vercel recommended for front-end and Supabase for DB/auth).
