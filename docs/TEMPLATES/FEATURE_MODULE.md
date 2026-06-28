# Feature Module Template

A Feature Module encapsulates the client-side presentation layer and user interactions for a specific business domain. It resides inside the `features/` directory and communicates with services only through React hooks.

## Directory Structure

Every domain feature directory must have the following structure:

```text
features/your-domain/
├── components/
│   ├── ComponentA.tsx
│   └── ComponentB.tsx
├── hooks/
│   ├── useDomainAction.ts
│   └── useDomainState.ts
├── pages/
│   └── Page.tsx
├── types/
│   └── index.ts
├── utils/
│   └── helpers.ts
└── index.ts
```

## Folder Responsibilities

### 1. `components/`
* **Purpose**: Presentational and container React components specific to the domain.
* **Rules**: Must be function-based, modular, and responsive (Mobile-first). They should receive data and actions via props or domain-specific hooks.

### 2. `hooks/`
* **Purpose**: Encapsulate UI state, side-effects, and orchestration between components and the Service Layer.
* **Rules**: All calls to the Service Layer must be made within hooks, never directly inside React components.

### 3. `pages/`
* **Purpose**: Main entry points/views for page routing.
* **Rules**: Orchestrate large layout sections and pass down state to child components.

### 4. `types/`
* **Purpose**: Store UI-specific types, form states, and local interfaces.
* **Rules**: Do not include database schema definitions here (use the central `types/` or `shared/types/` instead).

### 5. `utils/`
* **Purpose**: Pure formatting functions, math utilities, and UI transformations specific to the domain.
* **Rules**: Must be unit-testable and side-effect free.

### 6. `index.ts`
* **Purpose**: The public API of the feature module.
* **Rules**: Export only the entry point components, pages, or context providers that other modules are allowed to import.

## Strict Restrictions: What Never to Place in Feature Folders

* **No Direct Supabase Calls**: React components and hooks must never import `@supabase/supabase-js` or direct client instances.
* **No Database Logic**: Query assembly, filtering raw SQL, or pagination logic belongs in the Repository Layer.
* **No Direct Repository Calls**: Features must go through Services, not directly to Repositories.
