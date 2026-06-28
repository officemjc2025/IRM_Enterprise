# Module Folder Structure

To ensure consistency as the project scales, all business modules must separate UI features, business logic, and repository access into distinct, matching directories.

## Directory Blueprint

Below is the official organization chart for a domain module (e.g. `resident` domain):

```text
irm/
├── app/
│   └── (dashboard)/
│       └── resident/
│           └── page.tsx              # Page route entry
│
├── features/
│   └── resident/                     # UI Layer
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── types/
│       ├── utils/
│       └── index.ts
│
├── services/
│   └── resident/                     # Business Logic Layer
│       ├── resident.service.ts
│       └── index.ts
│
├── repositories/
│   └── resident/                     # Data Access Layer
│       ├── resident.repository.ts
│       └── index.ts
│
└── types/
    └── resident.ts                   # Core Data Models
```

## Structural Purpose of Folders

### 1. `features/`
Contains the client-side presentation code. It handles UI state, interaction handlers, rendering logic, and local UI helpers. It is completely isolated from DB providers.

### 2. `services/`
Contains stateless business operations. It coordinates multiple tables, enforces business logic, and handles translations and logging. It does not import React components or hooks.

### 3. `repositories/`
Directly calls Supabase table APIs. It handles queries, joins, and data mapping. It is the only layer allowed to reference database table schemas and connection clients.

### 4. `types/`
Contains typescript definition contracts representing database models and API data structures.

## Rule Enforcement
Any code violating these boundaries (e.g., calling Supabase directly in a React component, importing a React Hook inside a Service, or adding business invariants inside a Repository) will fail architectural reviews and must be refactored.
