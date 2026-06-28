# USER_EXPERIENCE_MAP.md

## Purpose

This document defines the user groups of IRM Enterprise and the applications they use.

It serves as the reference for module development, permissions, and user experience.

---

# 1. User Groups

| User           | Device          | Primary Usage         |
| -------------- | --------------- | --------------------- |
| Super Admin    | Desktop         | System Administration |
| Property Admin | Desktop         | Daily Operations      |
| Reception      | Desktop         | Front Desk            |
| Security       | Mobile / Tablet | Visitor & Gate        |
| Technician     | Mobile          | Work Orders           |
| Housekeeping   | Mobile          | Cleaning Tasks        |
| Owner          | Mobile          | Property & Rental     |
| Resident       | Mobile          | Resident Services     |
| Tenant         | Mobile          | Daily Living          |

---

# 2. Applications

| Application      | Primary Users     |
| ---------------- | ----------------- |
| Admin Portal     | Admin Office      |
| Resident App     | Resident / Tenant |
| Owner Portal     | Owner             |
| Security App     | Security          |
| Technician App   | Technician        |
| Housekeeping App | Housekeeping      |

---

# 3. Main Functions

Admin

* Manage all business data
* Reports
* Configuration

Resident

* Maintenance Request
* Booking
* Visitor
* Documents
* Notifications

Owner

* Units
* Rental
* Revenue
* Statements

Security

* Check-in
* Check-out
* Parking
* Incident

Technician

* Assigned Jobs
* Job Status
* Before/After Photos

Housekeeping

* Cleaning Queue
* Room Status
* Cleaning Completion

---

# 4. Permission Principle

Every application uses:

Authentication

↓

RBAC

↓

Property Isolation

↓

Ownership Validation

↓

Business Rules

No application communicates directly with the database.

All applications use the same API.

---

# 5. Design Principles

Desktop First

* Admin Portal

Mobile First

* Resident
* Owner
* Technician
* Housekeeping
* Security

One Backend

Shared API

Shared Authentication

Shared RBAC

Shared Database
