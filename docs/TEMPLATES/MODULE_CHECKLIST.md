# Module Definition Checklist

Every new business domain module must fulfill this checklist before being submitted for code review, integration, or deployment.

## Phase 1: Planning and Blueprint
- [ ] Database Schema drafted with required system fields (`id`, `created_at`, `status`, etc.).
- [ ] Row Level Security (RLS) policies defined for user scopes and admin permissions.
- [ ] Folder paths mapped to the official directory structure template.

## Phase 2: Schema and Database (if applicable)
- [ ] Database migration file created in `database/schema/xxx_domain.sql`.
- [ ] Foreign keys, constraints, and indexes defined for relationship performance.
- [ ] Mock seed data generated for development in `database/seed/`.

## Phase 3: Core Domain and Types
- [ ] Main domain models defined in `types/your-domain.ts`.
- [ ] Input and Update DTOs typed strictly (No `any`).
- [ ] Localization strings (TH/EN) defined in `messages/th.json` and `messages/en.json`.

## Phase 4: Data Layer and Services
- [ ] Repository created under `repositories/your-domain/your-domain.repository.ts`.
- [ ] Service wrapper created under `services/your-domain/your-domain.service.ts`.
- [ ] Async/Await syntax used exclusively for asynchronous calls.
- [ ] Database connection handling optimized and Supabase error codes logged.

## Phase 5: UI and Hooks
- [ ] React UI Hook defined under `features/your-domain/hooks/`.
- [ ] Presentational components created under `features/your-domain/components/`.
- [ ] Pages declared and configured inside `features/your-domain/pages/`.
- [ ] Responsiveness (Mobile-friendly) verified for views.

## Phase 6: Routing and RBAC Integration
- [ ] Pages registered inside Next.js App Router.
- [ ] Access controls and Role-Based Guards integrated (using rules from `shared/auth/`).
- [ ] Unauthorized redirects and loading placeholders styled.

## Phase 7: Validation and Testing
- [ ] Form schemas and inputs validated using Zod or custom validation helpers.
- [ ] Client/Server boundaries tested.
- [ ] Linter checked: `npm run lint` yields zero errors and warnings.
- [ ] TypeScript compiler checked: `npm run build` passes successfully.
