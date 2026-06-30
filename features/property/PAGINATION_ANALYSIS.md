# TASK-02: Property Pagination Analysis & Proposal

This document presents the technical analysis and implementation proposal for introducing pagination to the Property List in IRM Enterprise.

---

## 1. Current Table Implementation
The current implementation in [PropertyListPage.tsx](file:///D:/Projects/IRM_Enterprise/irm/features/property/pages/PropertyListPage.tsx) behaves as follows:
- **Fetch Payload**: Fetches the complete list of properties from `/api/v1/properties` into memory.
- **Rendering**: Directly maps the entire list of `filteredProperties` inside a standard HTML `<table>` container.
- **Limitation**: There is no bounds limit, page controls, or records per page configuration. If the properties count grows large, it will degrade initial load, rendering performance, and network efficiency.

---

## 2. Pagination Implementation Plan
To integrate pagination seamlessly:
1. **Pagination Hook**: Introduce a custom hook to manage pagination state:
   ```typescript
   interface UsePaginationResult<T> {
     currentPage: number;
     pageSize: number;
     totalPages: number;
     paginatedItems: T[];
     nextPage: () => void;
     prevPage: () => void;
     setPage: (page: number) => void;
     setPageSize: (size: number) => void;
   }
   ```
2. **Footer Controls**: Add a pagination bar below the table containing:
   - "Showing X to Y of Z properties" status label.
   - "Previous" and "Next" buttons with numeric page selectors.
   - Page size dropdown selector (e.g., 10, 25, 50 records).

---

## 3. Client-Side vs. Server-Side Recommendation
- **Client-Side Pagination**:
  - *Pros*: Zero API/repository changes, instant client-side sorting and searching, extremely fast page switches.
  - *Cons*: Memory/network overhead scales linearly with total record counts in the database.
- **Server-Side Pagination**:
  - *Pros*: Scalable, minimal database query overhead, negligible network payload size.
  - *Cons*: Requires modifications to database queries, API routers, and adds round-trip delays for each page/filter interaction.
- **Recommendation**:
  - For the immediate **Metro Pilot**, utilize **Client-Side Pagination** because total property rows are relatively small (usually < 100 properties) and we are under strict zero-API/zero-DB modification constraints.
  - For future milestones (Resident list, Visitor logs), **Server-Side Pagination** is mandatory due to high volume transaction counts.

---

## 4. Reusable Logic & UI Extraction Candidates
1. **`usePagination` Hook**: Extract a generic React hook under `hooks/usePagination.ts` or `shared/hooks/usePagination.ts` that can be reused across Unit, Occupancy, and Visitor lists.
2. **`shared/ui/PaginationControls` Component**: Build a shared presentation footer component to render page buttons and dropdown selection.
3. **`shared/ui/DataTable` Component**: Standardize a complete data grid wrapper that encapsulates:
   - Header titles and action items (`PageHeader`)
   - Text filters (`SearchInput`)
   - Loading overlays (`LoadingState`)
   - Fallback empty screens (`EmptyState`)
   - Pagination controls (`PaginationControls`)
