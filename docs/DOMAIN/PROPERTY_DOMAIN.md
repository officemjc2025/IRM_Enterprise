# Property Domain

**Version:** 1.0.0

**Status:** Active

---

# 1. Business Purpose

The Property Domain is the root domain of IRM Enterprise.

Every business object belongs to exactly one Property.

Property is the highest level of data isolation, security, reporting, and administration.

---

# 2. Domain Scope

The Property Domain manages:

* Property
* Building
* Floor
* Unit
* Facility
* Zone
* Parking Area

Future domains reference Property through `property_id`.

---

# 3. Core Entity

## Property

Represents one condominium, apartment, hotel, or managed project.

Typical attributes:

* id
* code
* name
* short_name
* address
* timezone
* currency
* status
* created_at
* updated_at

---

# 4. Relationships

```text
Property
├── Buildings
│   ├── Floors
│   │   └── Units
│   └── Facilities
├── Residents
├── Owners
├── Visitors
├── Staff
├── Work Orders
├── Rentals
└── Documents
```

Every child entity belongs to one Property.

---

# 5. Business Rules

* Every record must belong to a Property.
* Property cannot be deleted while dependent data exists.
* Property administrators manage only assigned properties.
* Super Admin may manage all properties.
* Property status controls system availability.

---

# 6. Roles

| Role           | Access            |
| -------------- | ----------------- |
| Super Admin    | All Properties    |
| Property Admin | Assigned Property |
| Manager        | Assigned Property |
| Staff          | Assigned Property |
| Resident       | Own Property      |
| Owner          | Own Property      |

Authorization is enforced through RBAC and Property Isolation.

---

# 7. API Scope

Typical endpoints:

* List Properties
* Get Property
* Create Property
* Update Property
* Archive Property

All APIs follow the IRM API Standard.

---

# 8. Service Responsibilities

The Property Service is responsible for:

* Business validation
* Property lifecycle
* Status management
* Property configuration
* Business rule enforcement

The Service Layer contains all business logic.

---

# 9. Repository Responsibilities

The Property Repository is responsible for:

* Database access
* CRUD operations
* Query optimization
* Typed results

Repositories must not contain business logic.

---

# 10. User Experience

## Admin Portal

* Create Property
* Configure Property
* View Reports

## Resident App

* Read-only property information

## Owner Portal

* Read-only property information

## Staff Apps

* Read-only property context

---

# 11. Future Expansion

Future enhancements may include:

* Multi-country support
* Multi-currency
* Branding
* Property templates
* Property-level automation
* AI analytics

The Property Domain should remain backward compatible.

---

# Summary

The Property Domain is the root business domain of IRM Enterprise.

Every other business domain references Property.

Property is the foundation of:

* Data Isolation
* RBAC
* Reporting
* Configuration
* Security
* Multi-property scalability

All future domains must integrate with the Property Domain through `property_id`.
