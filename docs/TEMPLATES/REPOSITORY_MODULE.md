# Repository Module Template

The Repository Layer encapsulates all data access logic. It isolates the rest of the application from the database engine, client SDKs (Supabase), and query structure, returning strictly typed domain models.

## Responsibilities

* **Data Querying & Mutations**: Wrap all Supabase client operations (`select`, `insert`, `update`, `delete`).
* **Query Optimization**: Handle indexing, jointures, sorting, filtering, and database pagination.
* **Schema Decoupling**: Isolate raw database table structures from the typescript application domain models.
* **RLS Integration**: Ensure Row Level Security context is passed appropriately.

## Allowed

* Importing `@supabase/supabase-js` and the application's Supabase client wrapper (`@/lib/supabase/client`).
* Formatting Supabase payloads and handling database error codes.
* Constructing filters, pagination limits, and joining tables.

## Not Allowed

* **No Business Logic**: Do not check user permissions, validate workflow rules, or execute business invariants here.
* **No UI/Presentation Logic**: Do not format translation strings or handle client UI state.

## Typical Repository Signature

Repositories export standalone stateless functions:

```typescript
import { createClient } from "@/lib/supabase/client";
import { DomainEntity, CreateDomainPayload } from "@/types/domain";

export async function findById(id: string): Promise<DomainEntity | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("domain_table")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error(`Error fetching entity by id: ${id}`, error);
    return null;
  }
  return data as DomainEntity;
}

export async function insert(payload: CreateDomainPayload): Promise<DomainEntity> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("domain_table")
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw new Error(`Database error on insert: ${error.message}`);
  }
  return data as DomainEntity;
}
```
