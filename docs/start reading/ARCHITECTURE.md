# IRM Enterprise - Master Development Prompt (Production)

## PROJECT NAME

IRM Enterprise
Integrated Resident & Property Management Platform

---

# OBJECTIVE

Continue development of the IRM Enterprise system until Version 1.0 is production-ready.

This is NOT a prototype.

Every implementation must be production quality.

Never redesign the architecture unless absolutely required.

---

# CURRENT TECH STACK

Framework

* Next.js 16 (App Router)
* React 19
* TypeScript 5
* Tailwind CSS 4

Backend

* Supabase
* PostgreSQL
* Supabase Storage
* Supabase Auth

Deployment

* Vercel

---

# PROJECT ARCHITECTURE (LOCKED)

Keep the existing project structure.

Do NOT move everything into src.

Current structure should remain.

Example

app/
components/
contexts/
hooks/
lib/
providers/
repositories/
services/
shared/
styles/
types/
utils/
database/
docs/
scripts/
supabase/

---

# DEVELOPMENT RULES

1.

Never redesign architecture.

2.

Never change folder structure unless necessary.

3.

Never create duplicate providers.

4.

Always reuse existing files.

5.

Only modify files that are required.

6.

Every feature must be runnable before starting the next feature.

7.

One feature = one completed package.

---

# UI STANDARD

Theme

Dark Navy

Primary

#0F172A

Accent

Gold

#D4AF37

Rounded Card

Responsive

Desktop First

Mobile Friendly

Support Thai + English.

Every menu must support i18n.

---

# CODING STANDARD

Use

Function Based

NOT Class Based.

Repositories

services

hooks

must all use function exports.

Example

property.repository.ts

auth.repository.ts

visitor.repository.ts

Never use class repository.

---

# DATABASE STANDARD

Every table should contain

id (UUID)

code

name_th

name_en

status

created_at

updated_at

created_by

updated_by

Use UUID.

Use Foreign Keys.

Use indexes.

---

# PROPERTY DOMAIN

Hierarchy

Property

↓

Building

↓

Floor

↓

Unit

Unit is the center of the whole system.

Everything connects to Unit.

Resident

Owner

Rental

Work Order

Visitor

Finance

Documents

---

# RESIDENT DOMAIN

Support

Owner

Co-owner

Resident

Tenant

Multiple residents per room.

One resident can own multiple units.

---

# VEHICLE DOMAIN

One resident can have multiple vehicles.

Support

Car

Motorbike

Bicycle

Electric Vehicle

Future vehicle types.

Never limit one vehicle per resident.

---

# RENTAL DOMAIN

Owner managed rental.

Support

Reservation

Owner Stay

Guest Stay

Housekeeping

Revenue

Payment

Availability

Reservation Status

---

# VISITOR DOMAIN

Support

QR Check-in

Vehicle Check-in

Visitor History

Parking

Security Gate

---

# WORK ORDER

Repair Requests

Assignment

Technician

Priority

Status

Photo

History

---

# RBAC

Roles

Super Admin

Admin

Committee

Security

Technician

Owner

Co-owner

Tenant

Resident

Menus must be controlled by role.

---

# AUTHENTICATION

Complete production authentication.

Features

Login

Logout

Remember Session

Protected Routes

Dashboard Redirect

Supabase Auth

No mock login.

---

# DASHBOARD

Dashboard must show

Property Count

Resident Count

Vehicle Count

Open Work Orders

Pending Visitors

Rental Statistics

Recent Activities

---

# INTERNATIONALIZATION

Everything must support

Thai

English

No hardcoded menu.

Use translation files.

---

# FEATURE DEVELOPMENT ORDER

Authentication

↓

Property

↓

Building

↓

Floor

↓

Unit

↓

Resident

↓

Vehicle

↓

Visitor

↓

Rental

↓

Work Order

↓

Documents

↓

Reports

↓

Settings

Complete each feature before starting the next.

---

# DEFINITION OF DONE

Each feature must include

Database

Types

Repository

Service

Hook

Components

Pages

Validation

Translation

Responsive UI

Error Handling

Loading State

Testing

No placeholder.

No TODO.

Production Ready.

---

# IMPORTANT

Never restart architecture.

Never rebuild the project.

Continue from the current repository.

Modify only what is necessary.

Always preserve previous work.

Goal

IRM Enterprise Version 1.0

Production Ready.
