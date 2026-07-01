# TASK-03: Property Sorting Analysis & Proposal

This document outlines the technical analysis and architectural proposal for integrating column sorting into the Property module of IRM Enterprise.

---

## 1. Recommended Default Sort Order
- **Default Column**: `code` (Property Code) or `name_th` (Thai Name).
- **Default Direction**: `asc` (Ascending).
- **Justification**: Property lists are administrative master records. Sorting alphabetically by code provides a structured, predictable, and standard view for system operators.

---

## 2. Recommended URL Query Format
To maintain the URL as the single source of truth (enabling persistence, shareable links, and history navigation), we recommend the following query parameters:
- **`sortBy`**: Specifies the column key being sorted (e.g., `code`, `name_th`, `name_en`, `status`).
- **`sortOrder`**: Specifies the sort direction: `asc` (ascending) or `desc` (descending).

**Example URL**:
`https://irm.enterprise/properties?sortBy=code&sortOrder=asc`

---

## 3. Support for Future Server-Side Sorting
By routing the sorting state strictly through URL query parameters, we ensure the client UI remains decoupled and stateless.
- **Client Implementation (Current Phase)**: The client component reads `sortBy` and `sortOrder` from `useSearchParams()`, applies a Javascript `.sort()` comparison to the memory-loaded array, and renders the result.
- **Transition to Server-Side**: When scaling up, the client state logic remains identical. The only change is that the API fetch URL is updated to pass the parameters:
  `/api/v1/properties?sortBy=${sortBy}&sortOrder=${sortOrder}`
  The API route forwards these parameters directly to the database repository:
  `supabase.from('properties').select('*').order(sortBy, { ascending: sortOrder === 'asc' })`
  This enables server-side sorting with zero changes to client component page wrappers.

---

## 4. Cross-Module Compatibility
The proposed `sortBy` and `sortOrder` design is fully compatible with the other core modules of IRM Enterprise:
- **Building**: `?sortBy=building_code&sortOrder=asc`
- **Unit**: `?sortBy=unit_number&sortOrder=asc`
- **Person**: `?sortBy=first_name&sortOrder=asc`
- **Owner**: `?sortBy=owner_code&sortOrder=asc`

Since all these modules utilize standard data tables, they can instantly adopt this pattern to support native sorting on text, date, and status columns.

---

## 5. Reusable Logic & UI Extraction Candidates
1. **`useSorting` Hook**: A generic React hook that manages parsing, updating, and toggling column sort parameters:
   ```typescript
   interface UseSortingResult {
     sortBy: string;
     sortOrder: "asc" | "desc";
     toggleSort: (columnKey: string) => void;
   }
   ```
2. **`SortableHeader` Component**: A reusable table header component (`shared/ui/SortableHeader`) that:
   - Renders the column name text.
   - Shows active sort indicators (e.g., Up arrow for `asc`, Down arrow for `desc`, muted default arrows for unsorted state).
   - Automatically calls `toggleSort(columnKey)` on click.
