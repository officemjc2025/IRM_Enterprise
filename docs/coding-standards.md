# IRM Enterprise Coding Standards

Version: 1.0

Status: Active

Last Updated: 25 June 2026

---

# 1. General Principles

* Write clean, readable, and maintainable code.
* Prefer reusable components over duplicated code.
* Keep functions small and focused.
* Use TypeScript Strict Mode.

---

# 2. Naming Convention

## Components

PascalCase

Example

PropertyCard.tsx

ResidentTable.tsx

---

## Hooks

camelCase with "use"

Example

useAuth.ts

useLanguage.ts

usePagination.ts

---

## Utility Files

camelCase

Example

formatDate.ts

calculateFee.ts

---

## Constants

UPPER_CASE

Example

MAX_UPLOAD_SIZE

DEFAULT_LANGUAGE

---

# 3. Folder Structure

Business logic belongs in:

modules/

Reusable UI belongs in:

components/

Shared helpers belong in:

shared/

Providers belong in:

providers/

Custom hooks belong in:

hooks/

---

# 4. React Rules

* Prefer Functional Components.
* Avoid inline business logic.
* Keep components reusable.
* Split large components into smaller ones.

---

# 5. TypeScript Rules

* Avoid "any".
* Define interfaces/types.
* Export types when shared.
* Use explicit return types for exported functions.

---

# 6. Styling

* Tailwind CSS only.
* Reuse utility classes.
* Keep spacing consistent.
* Support Dark Mode.

---

# 7. Internationalization

* Never hardcode user-facing text.
* Store all UI text in language files.
* Default language: Thai.

---

# 8. Git Convention

Branch

main

develop

feature/*

Commit Example

IRM-003 feat(auth): add login page

IRM-004 feat(property): create property module

---

# 9. Documentation

Every major feature must include:

* Architecture Update
* Database Update
* API Update
* Sprint Log

---

# 10. Code Review Checklist

Before every commit:

* Build passes
* No TypeScript errors
* No ESLint errors
* Responsive layout verified
* Dark mode checked
* Documentation updated

---

End of Document
