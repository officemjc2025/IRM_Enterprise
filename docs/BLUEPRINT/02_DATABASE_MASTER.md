# Chapter 02 — Master Database Architecture

**Version:** 1.0.0

**Status:** Active

**Owner:** IRM Enterprise Architecture Team

---

# Overview

This document defines the complete enterprise database architecture for IRM Enterprise.

It establishes the database standards, entity relationships, naming conventions, and domain boundaries that every future module must follow.

The database is designed to support:

* Single Property
* Multiple Properties
* Condominium
* Apartment
* Hotel
* Resort
* Mixed-use Development
* Property Management Company

without structural redesign.

---

# Database Philosophy

IRM Enterprise follows strict database principles.

## Single Source of Truth

Each business entity must have only one authoritative table.

Example

A resident exists only once.

A unit exists only once.

An owner exists only once.

Duplicated business entities are prohibited.

---

## Fully Normalized

The database follows Third Normal Form (3NF) unless a documented optimization is approved.

No duplicated business information should exist.

---

## UUID Primary Keys

Every business table uses UUID as the primary key.

Example

```sql
id UUID PRIMARY KEY
```

Sequential integer keys are avoided for business entities.

---

## Audit Fields

Every table must contain

```text
created_at

updated_at

created_by

updated_by
```

Whenever applicable.

---

## Soft Delete

Business data should not be physically deleted.

Preferred fields

```text
deleted_at

deleted_by

is_deleted
```

Historical information must remain recoverable.

---

## Timestamps

All timestamps use UTC.

Application converts to local timezone.

---

# Database Layers

IRM Enterprise separates data into domains.

```text
Authentication

↓

Identity

↓

Property

↓

Resident

↓

Rental

↓

Visitor

↓

Security

↓

Maintenance

↓

Finance

↓

Communication

↓

Reporting
```

---

# Domain Overview

The system consists of the following domains.

## Core

Authentication

Profiles

Settings

Audit Logs

Notifications

---

## Property

Properties

Buildings

Floors

Units

Facilities

Assets

Parking

Common Areas

---

## Resident

Owners

Residents

Occupancies

Emergency Contacts

Vehicles

Pets

---

## Rental

Reservations

Guests

Contracts

Housekeeping

Revenue

---

## Visitor

Visitors

Visit Sessions

Visitor Parking

Blacklist

QR Access

---

## Security

Security Staff

Patrol

Gate Logs

Incident Reports

Access History

---

## Maintenance

Work Orders

Assets

Preventive Maintenance

Inventory

Vendor

---

## Finance

Payment

Invoices

Outstanding Fees

Owner Statements

Accounting Mapping

---

# Core Database Diagram

```text
Authentication
        │
        ▼
Profiles
        │
        ▼
Residents
        │
        ▼
Occupancies
        │
        ▼
Units
        │
        ▼
Floors
        │
        ▼
Buildings
        │
        ▼
Properties
```

---

# Master Entity Relationship

```text
Properties
     │
     ▼
Buildings
     │
     ▼
Floors
     │
     ▼
Units
     │
     ├────────────┐
     │            │
Ownerships    Occupancies
     │            │
Owners      Residents
     │            │
     └─────┬──────┘
           ▼
      Visitor
           │
           ▼
     Work Orders
```

---

# Identity Layer

Identity represents user accounts.

Business data should never be stored inside authentication tables.

Authentication only verifies identity.

Business information belongs to Profiles.

---

# Property Layer

Property hierarchy

```text
Property

↓

Building

↓

Floor

↓

Unit
```

Every future module references Unit.

Never reference Building directly when Unit exists.

---

# Resident Layer

Residents represent people living in units.

Resident

≠

Owner

A resident may not own the property.

An owner may not live in the property.

These are separate business concepts.

---

# Ownership Layer

Ownership represents legal ownership.

Examples

Private Owner

Co-owner

Developer

Company

Bank

Ownership history must always be preserved.

---

# Occupancy Layer

Occupancy represents who currently lives in a unit.

Examples

Owner Occupied

Tenant

Family

Staff

Temporary Guest

Historical occupancy must never be overwritten.

---

# Rental Layer

Rental operates independently from ownership.

Owner

↓

Unit

↓

Rental Contract

↓

Guest

The owner remains the legal owner while occupancy changes.

---

# Visitor Layer

Visitors always visit a resident or unit.

Visitor

↓

Visit Session

↓

Resident

↓

Unit

Visitor history is immutable.

---

# Security Layer

Every gate operation creates a permanent record.

Entry

Exit

Verification

Blacklist

Parking

QR Access

All actions must be auditable.

---

# Maintenance Layer

Every maintenance request belongs to a unit.

Optionally linked to

Resident

Technician

Vendor

Asset

Invoice

---

# Financial Layer

Finance does not replace accounting software.

IRM Enterprise stores operational records.

Accounting remains synchronized through integration.

Current integration target

SoftBis ERP

---

# Database Growth Strategy

The schema is designed for expansion.

Future additions

IoT

Smart Locks

Utility Billing

Energy Monitoring

Hotel PMS

AI Analytics

Business Intelligence

Government Integration

without changing existing tables.

---

# Database Standards

Every table must satisfy:

* UUID Primary Key
* Foreign Keys
* Created At
* Updated At
* Created By
* Updated By
* Soft Delete Support
* Audit Ready
* Row Level Security Ready
* Enterprise Naming Convention

---

# Next Chapter

The following chapters define every database domain individually.

Each chapter specifies:

* Business Rules
* Entity Relationships
* Required Tables
* Constraints
* Future Expansion
* Integration Points

No implementation should begin before the relevant database domain has been documented.


---

# Section 2 — Core Database Domains

The Core Domain contains the fundamental entities required by every business module within IRM Enterprise.

Every module depends on this layer.

```text
Core Domain

Authentication

↓

Profiles

↓

Properties

↓

Buildings

↓

Floors

↓

Units
```

No business module should bypass the Core Domain.

---

# Core Tables

The following tables form the foundation of the entire system.

| Table         | Purpose            |
| ------------- | ------------------ |
| profiles      | User Identity      |
| properties    | Property Master    |
| buildings     | Building Master    |
| floors        | Floor Master       |
| units         | Unit Master        |
| settings      | Global Settings    |
| files         | File Registry      |
| audit_logs    | System Audit       |
| notifications | Notification Queue |

---

# Profiles

Profiles represent application users.

Authentication credentials are managed by Supabase Auth.

Business information is stored in Profiles.

Examples

* Administrator
* Security Guard
* Technician
* Owner
* Tenant
* Resident

Profiles are independent from business modules.

---

Recommended Columns

```text
id

email

display_name

full_name

phone

avatar_url

language

theme

timezone

status

created_at

updated_at
```

---

Business Rules

* One profile represents one login account.
* One profile may own multiple units.
* One profile may reside in multiple units over time.
* One profile may perform multiple system roles.
* Profile history must be preserved.

---

# Properties

A property represents an independent project.

Examples

Metro Jomtien Condotel

Metro Residence

Metro Tower

Future support includes unlimited properties.

---

Recommended Columns

```text
id

property_code

property_name

property_type

tax_number

address

country

province

district

postal_code

phone

email

status

created_at

updated_at
```

---

Business Rules

* Property names must be unique within the organization.
* Every building belongs to exactly one property.
* Properties cannot be deleted if dependent records exist.

---

# Buildings

Buildings belong to properties.

Examples

Tower A

Tower B

Building C

North Wing

---

Recommended Columns

```text
id

property_id

building_code

building_name

building_type

number_of_floors

status

created_at

updated_at
```

---

Business Rules

* One property contains many buildings.
* Building code must be unique within a property.
* Buildings inherit property settings unless overridden.

---

# Floors

Floors belong to buildings.

---

Recommended Columns

```text
id

building_id

floor_number

floor_name

status

created_at

updated_at
```

---

Business Rules

* Floor numbers must be unique within a building.
* Floors cannot exist without a building.

---

# Units

Units are the most important business entity.

Almost every module references Units.

Examples

Resident

Visitor

Rental

Parking

Maintenance

Security

Finance

---

Recommended Columns

```text
id

property_id

building_id

floor_id

unit_number

unit_type

area

ownership_ratio

bedrooms

bathrooms

parking_quota

status

created_at

updated_at
```

---

Business Rules

* Unit numbers must be unique within a building.
* Unit records are never physically deleted.
* Historical ownership is preserved separately.
* Occupancy is managed separately.
* Rental is managed separately.

---

# Unit Status

Recommended values

```text
Available

Occupied

Reserved

Maintenance

Inactive

Blocked
```

Status definitions should remain configurable.

---

# Unit Type

Examples

Studio

1 Bedroom

2 Bedroom

3 Bedroom

Penthouse

Office

Commercial

Storage

Parking

Additional types may be added without database redesign.

---

# Property Hierarchy

```text
Property

↓

Building

↓

Floor

↓

Unit
```

Every operational module references Unit as its primary location.

Direct references to Building or Floor should only occur when Unit is not applicable.

---

# Core Domain Relationships

```text
Properties

1

↓

Many

Buildings

↓

Many

Floors

↓

Many

Units
```

This hierarchy must remain stable across future versions.

---

# Naming Convention

Primary Keys

```text
id
```

Foreign Keys

```text
property_id

building_id

floor_id

unit_id

profile_id
```

Timestamp Fields

```text
created_at

updated_at
```

Audit Fields

```text
created_by

updated_by
```

Soft Delete

```text
deleted_at

deleted_by

is_deleted
```

---

# Core Domain Summary

The Core Domain serves as the foundation for every other business domain.

No module may introduce alternative representations of Properties, Buildings, Floors, Units, or Profiles.

All future database design must extend this foundation rather than duplicate it.

---

# Section 3 — Resident Domain

The Resident Domain manages every person who is related to a property.

Unlike many traditional condominium systems, IRM Enterprise separates Identity, Ownership, Residency, and Occupancy into different business entities.

This separation enables future expansion without redesign.

---

# Resident Domain Philosophy

The following concepts are different and must never be combined into a single table.

Profile

↓

Owner

↓

Resident

↓

Occupancy

Each entity has its own lifecycle.

---

Example

John may be

* an Owner
* not living in the property

while

Mary may be

* living in the unit
* not the legal owner

The database must support both scenarios.

---

# Resident Domain Overview

```text
Profiles
    │
    ├──────────────┐
    ▼              ▼
Owners        Residents
    │              │
    └──────┬───────┘
           ▼
      Occupancies
           │
           ▼
          Units
```

---

# Resident Tables

| Table              | Purpose                |
| ------------------ | ---------------------- |
| owners             | Legal Ownership        |
| ownerships         | Ownership Relationship |
| residents          | Resident Master        |
| occupancies        | Current Residency      |
| emergency_contacts | Emergency Contacts     |
| resident_vehicles  | Resident Vehicles      |
| pets               | Pet Registration       |

---

# Owners

Owners represent legal ownership.

Ownership is independent from residency.

Examples

Private Owner

Company

Developer

Bank

Estate

---

Recommended Columns

```text
id

profile_id

owner_type

tax_number

passport_number

citizen_id

billing_address

preferred_language

status

created_at

updated_at
```

---

Business Rules

* One profile may have one owner record.
* One owner may own multiple units.
* Ownership percentage is stored separately.
* Ownership history must never be lost.

---

# Ownerships

Ownerships connect Owners to Units.

Recommended Columns

```text
id

owner_id

unit_id

ownership_percentage

ownership_type

purchase_date

effective_date

end_date

status

created_at

updated_at
```

---

Ownership Types

Examples

Primary Owner

Co-owner

Developer

Company

Trust

Bank

---

Business Rules

* One unit may have multiple owners.
* Ownership percentages should total 100%.
* Historical ownership must remain available.
* Previous owners are never overwritten.

---

Example

```text
Unit 1205

↓

Owner A

70%

↓

Owner B

30%
```

---

# Residents

Residents represent people associated with units.

Residents are not necessarily owners.

Examples

Owner Occupant

Tenant

Family Member

Guest Resident

Staff

Committee Member

---

Recommended Columns

```text
id

profile_id

resident_type

nationality

passport_number

citizen_id

birth_date

gender

phone

email

status

created_at

updated_at
```

---

Resident Types

```text
Owner

Co-owner

Tenant

Resident

Family

Staff

Committee
```

The list remains configurable.

---

Business Rules

* A profile may become a resident multiple times.
* Resident history must never be deleted.
* Resident records remain after move-out.

---

# Occupancies

Occupancy records describe who currently lives inside a unit.

This table is the operational source of truth.

---

Recommended Columns

```text
id

resident_id

unit_id

move_in_date

move_out_date

occupancy_type

is_primary

status

created_at

updated_at
```

---

Occupancy Types

Owner Occupied

Tenant

Family

Temporary

Company Housing

Staff Housing

---

Business Rules

* One resident may occupy multiple units over time.
* One unit may have multiple residents.
* Historical occupancy is immutable.
* Current occupancy is determined by active records.

---

Example

```text
Room 1205

↓

Owner

↓

Moved Out

↓

Tenant

↓

Current Resident
```

No data is overwritten.

---

# Emergency Contacts

Emergency contacts belong to residents.

Recommended Columns

```text
id

resident_id

contact_name

relationship

phone

email

priority

status

created_at

updated_at
```

---

Business Rules

* Multiple emergency contacts allowed.
* Priority determines notification order.

---

# Resident Vehicles

Residents may register vehicles.

Recommended Columns

```text
id

resident_id

license_plate

province

brand

model

color

parking_sticker

status

created_at

updated_at
```

---

Business Rules

* One resident may register multiple vehicles.
* License plates should be unique.
* Parking rights are managed separately.

---

# Pets

Optional module.

Recommended Columns

```text
id

resident_id

pet_name

species

breed

color

registration_number

vaccination_date

status

created_at

updated_at
```

---

Business Rules

* Pets belong to residents.
* Pet policies are configurable per property.

---

# Resident Lifecycle

```text
Profile

↓

Owner (optional)

↓

Resident

↓

Occupancy

↓

Move In

↓

Move Out

↓

History
```

Historical records remain permanently.

---

# Ownership vs Occupancy

The following concepts must never be merged.

Ownership

Legal ownership of the unit.

Occupancy

Actual residency within the unit.

These two concepts evolve independently.

---

Example

```text
Owner

↓

Owns Unit

↓

Moves Overseas

↓

Rents Unit

↓

Tenant Lives Inside
```

Ownership remains unchanged.

Occupancy changes.

---

# Domain Integrity Rules

The Resident Domain must satisfy the following rules.

* No duplicate residents.
* No duplicate owners.
* No duplicate occupancies.
* Historical information is immutable.
* Every relationship uses foreign keys.
* Business history is never overwritten.

---

# Future Expansion

The Resident Domain is designed to support future modules.

Examples

Digital Resident Card

Biometric Access

Parking Automation

Visitor Invitations

LINE Integration

Package Delivery

Smart Lock Integration

IoT Access Control

Resident Mobile Application

without redesigning the schema.

---

# Section 4 — Rental Domain

The Rental Domain manages every rental activity within the property.

Unlike traditional condominium software, IRM Enterprise supports owner-managed rentals, property-managed rentals, and future hotel-style operations using the same architecture.

Rental operations are independent from legal ownership.

---

# Rental Philosophy

The following concepts are independent.

Ownership

↓

Rental

↓

Reservation

↓

Guest

↓

Stay

↓

Housekeeping

↓

Revenue

Each concept has its own lifecycle.

---

# Rental Domain Overview

```text
Owners
    │
    ▼
Ownerships
    │
    ▼
Units
    │
    ▼
Rental Contracts
    │
    ▼
Reservations
    │
    ▼
Guests
    │
    ▼
Stay
    │
    ▼
Housekeeping
```

---

# Rental Tables

| Table             | Purpose               |
| ----------------- | --------------------- |
| rental_contracts  | Rental Agreement      |
| reservations      | Reservation Master    |
| guests            | Guest Master          |
| guest_stays       | Check-In / Check-Out  |
| housekeeping_jobs | Cleaning Schedule     |
| room_availability | Availability Calendar |
| owner_stays       | Owner Reservation     |
| rental_revenue    | Revenue Records       |

---

# Rental Contracts

Represents agreements between owners and tenants.

Applicable to

* Daily Rental
* Monthly Rental
* Yearly Rental

---

Recommended Columns

```text
id

unit_id

owner_id

contract_type

start_date

end_date

monthly_rate

security_deposit

status

created_at

updated_at
```

---

Business Rules

* One unit may have many contracts over time.
* Active contracts cannot overlap.
* Historical contracts remain permanently.

---

# Reservations

Reservation records represent booking requests.

Reservations may originate from

* Owner Office
* Website
* LINE OA
* Manual Entry
* Future OTA Integration

---

Recommended Columns

```text
id

unit_id

guest_id

reservation_number

check_in

check_out

adults

children

booking_source

status

created_at

updated_at
```

---

Reservation Status

Pending

Confirmed

Checked In

Checked Out

Cancelled

No Show

---

Business Rules

* Reservation numbers are unique.
* Reservation dates cannot overlap.
* Reservations create guest stay records after check-in.

---

# Guests

Guests represent temporary occupants.

Guests are different from residents.

---

Recommended Columns

```text
id

full_name

nationality

passport_number

phone

email

vehicle_plate

remarks

created_at

updated_at
```

---

Business Rules

* Guests may return multiple times.
* Historical stays remain attached to guest history.

---

# Guest Stays

Represents the actual stay.

Check-In

↓

Occupied

↓

Check-Out

↓

Completed

---

Recommended Columns

```text
id

reservation_id

unit_id

guest_id

check_in_time

check_out_time

actual_nights

status

created_at

updated_at
```

---

Business Rules

* One reservation creates one stay.
* Actual stay dates may differ from reservation.
* Historical stays are immutable.

---

# Owner Stays

Owners may reserve their own units.

Owner stays must block rental reservations.

---

Recommended Columns

```text
id

owner_id

unit_id

check_in

check_out

purpose

status

created_at

updated_at
```

---

Business Rules

* Owner stay has higher priority than rental.
* Rental reservations cannot overlap owner stays.

---

# Room Availability

Provides the operational availability calendar.

---

Recommended Columns

```text
id

unit_id

date

availability_status

reservation_id

owner_stay_id

created_at

updated_at
```

---

Availability Status

Available

Reserved

Occupied

Owner Stay

Maintenance

Housekeeping

Blocked

---

Business Rules

Availability is calculated from

Reservations

Owner Stay

Maintenance

Housekeeping

---

# Housekeeping Jobs

Cleaning tasks generated after checkout.

---

Recommended Columns

```text
id

unit_id

stay_id

assigned_to

scheduled_date

completed_date

status

created_at

updated_at
```

---

Housekeeping Status

Pending

Assigned

Cleaning

Inspection

Completed

Cancelled

---

Business Rules

* Checkout automatically generates housekeeping.
* Unit cannot become Available until housekeeping is completed.

---

Rental Workflow

```text
Reservation

↓

Confirmation

↓

Check-In

↓

Occupied

↓

Check-Out

↓

Housekeeping

↓

Inspection

↓

Available
```

---

# Rental Revenue

Stores operational revenue.

Accounting remains inside SoftBis.

---

Recommended Columns

```text
id

reservation_id

owner_id

unit_id

gross_amount

management_fee

net_amount

payment_status

created_at

updated_at
```

---

Business Rules

* Revenue belongs to reservation.
* Revenue belongs to owner.
* Revenue is synchronized with accounting.
* Revenue history is immutable.

---

# Rental Integration

Rental integrates with

* Property
* Resident
* Visitor
* Security
* Housekeeping
* Finance
* Notifications

No duplicated rental information is permitted.

---

# Domain Integrity Rules

The Rental Domain must satisfy:

* No overlapping reservations.
* No overlapping owner stays.
* One stay per reservation.
* Automatic housekeeping generation.
* Historical reservations remain immutable.
* Revenue is auditable.
* Availability is system-generated.

---

# Future Expansion

The Rental Domain is designed to support:

Booking.com

Airbnb

Agoda

Channel Manager

Dynamic Pricing

Online Payment

Digital Check-In

Digital Keys

Passport OCR

AI Pricing Engine

Hotel PMS Integration

without redesigning the database.


---

# Section 5 — Visitor Domain

The Visitor Domain manages every non-resident entering the property.

Visitors include:

* Personal Guests
* Delivery Personnel
* Contractors
* Maintenance Vendors
* Government Officers
* Taxi Drivers
* Ride Sharing Drivers
* Temporary Workers

The Visitor Domain is designed to integrate tightly with Security Gate operations.

---

# Visitor Philosophy

Every visitor must have a visit history.

Visits are never deleted.

Each visit creates a Visit Session.

Visitor Identity

↓

Visit Session

↓

Security Verification

↓

Vehicle Registration

↓

Parking

↓

Entry

↓

Exit

↓

History

---

# Visitor Domain Overview

```text
Visitors
      │
      ▼
Visit Sessions
      │
      ├──────────────┐
      ▼              ▼
Vehicles       QR Pass
      │              │
      └──────┬───────┘
             ▼
Security Gate
             │
             ▼
Entry / Exit Logs
```

---

# Visitor Tables

| Table            | Purpose              |
| ---------------- | -------------------- |
| visitors         | Visitor Master       |
| visitor_sessions | Visit Records        |
| visitor_vehicles | Visitor Vehicles     |
| visitor_passes   | QR / Pass Management |
| visitor_parking  | Temporary Parking    |
| blacklist        | Blocked Visitors     |

---

# Visitors

Stores visitor identity.

Visitors may return many times.

The visitor record should never be duplicated.

---

Recommended Columns

```text
id

full_name

phone

email

nationality

passport_number

citizen_id

photo_url

remarks

created_at

updated_at
```

---

Business Rules

* One visitor may have many visit sessions.
* Visitor profile remains after every visit.
* Duplicate visitor profiles should be avoided.

---

# Visitor Sessions

Represents each visit.

Every arrival creates one session.

---

Recommended Columns

```text
id

visitor_id

unit_id

resident_id

visit_type

purpose

expected_arrival

expected_departure

actual_arrival

actual_departure

approved_by

status

created_at

updated_at
```

---

Visit Types

Personal Visit

Delivery

Contractor

Maintenance

Meeting

Inspection

Government

Vendor

---

Visit Status

Pending

Approved

Checked In

Inside Property

Checked Out

Cancelled

Rejected

Expired

---

Business Rules

* One visit creates one session.
* Sessions are immutable after completion.
* Historical visits are preserved forever.

---

# Visitor Vehicles

Visitor vehicles are stored separately.

---

Recommended Columns

```text
id

visitor_id

license_plate

province

brand

model

vehicle_type

color

photo_url

created_at

updated_at
```

---

Business Rules

* One visitor may register multiple vehicles.
* Vehicle history remains permanent.

---

# Visitor Passes

Visitor Pass controls temporary access.

Supports

QR Code

RFID

Temporary Card

Digital Pass

---

Recommended Columns

```text
id

visitor_session_id

pass_number

pass_type

issued_at

returned_at

status

created_at

updated_at
```

---

Pass Types

QR

Card

RFID

Mobile Pass

Temporary Badge

---

# Visitor Parking

Stores temporary parking records.

---

Recommended Columns

```text
id

visitor_session_id

vehicle_id

parking_zone

parking_space

entry_time

exit_time

status

created_at

updated_at
```

---

Business Rules

* Visitor parking expires automatically after checkout.
* Parking history is never deleted.

---

# Blacklist

Blocked visitors.

Reasons include

Repeated Violations

Security Threat

Property Damage

Unpaid Fees

Management Decision

---

Recommended Columns

```text
id

visitor_id

reason

effective_date

expired_date

approved_by

status

created_at

updated_at
```

---

Business Rules

* Blacklisted visitors cannot create new visit sessions.
* Security receives immediate notification.
* Historical blacklist records remain available.

---

# Visitor Workflow

```text
Visitor Registration

↓

Approval

↓

QR Pass

↓

Security Check

↓

Entry

↓

Inside Property

↓

Exit

↓

History
```

---

# Security Integration

The Visitor Domain integrates directly with:

Security Gate

Parking

QR Access

Resident

Notifications

Audit Logs

No duplicated visitor information is permitted.

---

# Metro Jomtien Operational Workflow

The Visitor Domain supports the operational workflow currently used at Metro Jomtien.

Example

```text
Visitor

↓

Security scans QR

↓

Visitor Session created

↓

Vehicle photographed

↓

License Plate Recognition

↓

Temporary Pass Issued

↓

Entry Recorded

↓

Resident Notification

↓

Visitor Leaves

↓

Pass Returned

↓

Exit Recorded

↓

Session Completed
```

This workflow replaces manual paper logs while preserving a complete audit trail.

---

# Domain Integrity Rules

The Visitor Domain must satisfy:

* One active session per visitor per visit.
* Every entry must have a corresponding exit.
* Vehicle records remain historical.
* Pass issuance is auditable.
* Visitor history is immutable.
* QR passes expire automatically.
* Security actions are permanently logged.

---

# Future Expansion

The Visitor Domain is designed to support:

Facial Recognition

License Plate Recognition (LPR)

Automatic Gate

Smart Parking

Digital Visitor Invitation

LINE Visitor Pass

Self Check-In Kiosk

Passport OCR

National ID Verification

AI Security Monitoring

without redesigning the schema.


---

# Section 6 — Security Domain

The Security Domain manages all security operations within IRM Enterprise.

This domain is responsible for protecting people, property, assets, and operational integrity.

Unlike traditional visitor systems, Security is treated as an independent business domain.

---

# Security Philosophy

Every security activity must be traceable.

Nothing performed by security personnel should disappear.

Every action creates an audit record.

Security Guard

↓

Shift

↓

Gate Operation

↓

Visitor Verification

↓

Incident

↓

Audit Log

---

# Security Domain Overview

```text
Security Staff
        │
        ▼
Security Shifts
        │
        ▼
Gate Sessions
        │
        ▼
Entry / Exit
        │
        ▼
Incident Reports
        │
        ▼
Audit Logs
```

---

# Security Tables

| Table            | Purpose              |
| ---------------- | -------------------- |
| security_staff   | Security Employees   |
| security_shifts  | Shift Schedule       |
| gate_sessions    | Gate Operations      |
| gate_logs        | Entry / Exit History |
| incident_reports | Security Incidents   |
| patrol_logs      | Patrol Records       |

---

# Security Staff

Stores security employee information.

Recommended Columns

```text
id

profile_id

employee_code

position

phone

status

created_at

updated_at
```

---

Business Rules

* Every security guard has one profile.
* Historical employment records remain available.

---

# Security Shifts

Stores work schedules.

Recommended Columns

```text
id

staff_id

shift_date

shift_type

start_time

end_time

status

created_at

updated_at
```

---

Shift Types

Morning

Afternoon

Night

Special

---

Business Rules

* Guards cannot have overlapping shifts.
* Historical shifts remain permanent.

---

# Gate Sessions

Represents a working session at a gate.

Recommended Columns

```text
id

staff_id

gate_name

started_at

ended_at

status

created_at

updated_at
```

---

Business Rules

Every entry and exit performed during a shift belongs to one Gate Session.

---

# Gate Logs

Stores every gate transaction.

Recommended Columns

```text
id

gate_session_id

visitor_session_id

vehicle_id

direction

event_time

remarks

created_at

updated_at
```

---

Direction

Entry

Exit

---

Business Rules

* Entry cannot occur twice without exit.
* Exit requires an active visitor session.
* Gate logs are immutable.

---

# Incident Reports

Stores security incidents.

Examples

Noise Complaint

Property Damage

Unauthorized Access

Fire Alarm

Medical Emergency

Lost Property

Vehicle Accident

---

Recommended Columns

```text
id

incident_number

reported_by

unit_id

visitor_session_id

incident_type

description

severity

status

created_at

updated_at
```

---

Severity

Low

Medium

High

Critical

---

Business Rules

Incident reports are permanent legal records.

They must never be deleted.

---

# Patrol Logs

Stores patrol activity.

Recommended Columns

```text
id

staff_id

checkpoint

patrol_time

remarks

created_at

updated_at
```

---

Business Rules

Patrol history remains permanently available.

---

# Metro Jomtien Security Workflow

```text
Security Login

↓

Start Shift

↓

Open Gate Session

↓

Visitor Verification

↓

QR Scan

↓

Vehicle Photo

↓

Entry

↓

Exit

↓

Close Gate Session

↓

End Shift
```

---

# Migration from Existing AppSheet System

The existing AppSheet Visitor Management implementation serves as the reference for migration.

The following concepts will be preserved and redesigned within IRM Enterprise.

Current AppSheet Concept

↓

IRM Enterprise

Visitor Logs

↓

Visitor Sessions

Camera Buffer

↓

Visitor Vehicles

Cards

↓

Visitor Passes

ActiveSessions

↓

Gate Sessions

Exit Scan

↓

Gate Logs

Security Menu

↓

Security Dashboard

This migration preserves business workflows while improving scalability and maintainability.

---

# Domain Integrity Rules

The Security Domain must satisfy:

* Every gate action is auditable.
* Every shift has responsible staff.
* Incidents are immutable.
* Gate Sessions cannot overlap.
* Historical logs remain permanently.

---

# Future Expansion

Designed to support:

Facial Recognition

Automatic Barrier Gate

ANPR / License Plate Recognition

Biometric Authentication

Smart CCTV

AI Security Analytics

IoT Sensors

Emergency Dispatch

Access Control Integration

without redesigning the database.


---

# Section 7 — Work Order Domain

The Work Order Domain manages all maintenance operations within IRM Enterprise.

This includes reactive maintenance, preventive maintenance, inspections, technician management, contractors, inventory usage, and maintenance history.

The objective is to ensure every maintenance activity is traceable from request to completion.

---

# Work Order Philosophy

Every maintenance activity begins with a request.

Every request becomes a work order.

Every work order produces history.

Nothing is deleted.

```text
Resident

↓

Maintenance Request

↓

Work Order

↓

Assignment

↓

Execution

↓

Inspection

↓

Completion

↓

History
```

---

# Work Order Domain Overview

```text
Residents

↓

Maintenance Requests

↓

Work Orders

↓

Technicians

↓

Inventory

↓

Completion

↓

History
```

---

# Work Order Tables

| Table                | Purpose               |
| -------------------- | --------------------- |
| maintenance_requests | Initial Request       |
| work_orders          | Work Order Master     |
| work_order_tasks     | Individual Tasks      |
| technicians          | Technician Master     |
| vendors              | External Contractors  |
| work_order_photos    | Before / After Photos |
| work_order_comments  | Timeline              |
| maintenance_assets   | Related Assets        |

---

# Maintenance Requests

Represents requests submitted by residents or staff.

Examples

Air Conditioner

Water Leak

Electrical

Internet

Furniture

Door Lock

Lighting

Noise Complaint

---

Recommended Columns

```text
id

request_number

unit_id

resident_id

request_type

priority

description

reported_at

status

created_at

updated_at
```

---

Priority

Low

Medium

High

Urgent

Emergency

---

Status

Pending

Approved

Rejected

Converted

Cancelled

---

Business Rules

One request creates one work order.

Requests remain permanently.

---

# Work Orders

Represents operational maintenance.

---

Recommended Columns

```text
id

work_order_number

request_id

unit_id

assigned_to

vendor_id

work_type

priority

scheduled_date

completed_date

status

created_at

updated_at
```

---

Status

Open

Assigned

In Progress

Waiting Parts

Inspection

Completed

Cancelled

---

Business Rules

Every work order belongs to one request.

Historical work orders remain immutable.

---

# Work Order Tasks

Large jobs may contain multiple tasks.

---

Recommended Columns

```text
id

work_order_id

task_name

assigned_to

sequence

status

created_at

updated_at
```

---

Business Rules

Tasks inherit Work Order status.

Completion requires all tasks completed.

---

# Technicians

Stores maintenance personnel.

---

Recommended Columns

```text
id

profile_id

employee_code

specialty

phone

status

created_at

updated_at
```

---

Specialties

Electrical

Plumbing

Painting

Cleaning

Air Conditioning

Civil

General

---

Business Rules

Technicians may receive many work orders.

---

# Vendors

External companies.

Examples

Lift Company

Fire Alarm

Pool Service

Garden

Cleaning

Internet Provider

---

Recommended Columns

```text
id

company_name

contact_name

phone

email

tax_number

status

created_at

updated_at
```

---

Business Rules

Vendors are reusable.

Historical vendors remain.

---

# Work Order Photos

Stores evidence.

---

Recommended Columns

```text
id

work_order_id

photo_type

file_url

uploaded_by

created_at
```

---

Photo Types

Before

During

After

Inspection

Damage

---

Business Rules

Photos remain permanently.

Files stored in Supabase Storage.

---

# Work Order Comments

Stores timeline.

---

Recommended Columns

```text
id

work_order_id

comment

created_by

created_at
```

---

Business Rules

Every update creates a comment.

Timeline is immutable.

---

# Maintenance Assets

Assets repaired.

Examples

Air Conditioner

Water Pump

Elevator

Lighting

Fire Extinguisher

Generator

---

Recommended Columns

```text
id

asset_code

asset_name

asset_category

serial_number

location

status

created_at

updated_at
```

---

Business Rules

Assets have maintenance history.

Assets belong to buildings or common areas.

---

# Metro Jomtien Workflow

```text
Resident

↓

Submit Request

↓

Office Review

↓

Create Work Order

↓

Assign Technician

↓

Repair

↓

Upload Photos

↓

Inspection

↓

Completed

↓

Resident Feedback
```

---

# Integration

The Work Order Domain integrates with

Property

Residents

Technicians

Inventory

Notifications

SoftBis

Audit Logs

No duplicated maintenance information is allowed.

---

# Domain Integrity Rules

The Work Order Domain must satisfy

* Every request creates at most one work order.
* Every work order belongs to one unit.
* Every technician belongs to one profile.
* Every photo belongs to one work order.
* Every comment belongs to one work order.
* Historical maintenance remains permanent.

---

# Future Expansion

The Work Order Domain is designed to support

Preventive Maintenance

Recurring Maintenance

IoT Device Alerts

Smart Building Integration

Asset Lifecycle

Inventory Consumption

Purchase Requests

Warranty Tracking

QR Asset Labels

AI Maintenance Prediction

without redesigning the database.

---

# Section 8 — Finance Domain

The Finance Domain manages all operational financial records generated by IRM Enterprise.

IRM Enterprise is **not** intended to replace an accounting system.

Instead, it functions as the operational source of financial information and synchronizes approved transactions with external accounting systems such as SoftBis ERP.

---

# Finance Philosophy

Business Operation

↓

Operational Transaction

↓

Approval

↓

Accounting Integration

↓

SoftBis ERP

IRM Enterprise owns operational data.

SoftBis owns accounting records.

---

# Finance Domain Overview

```text id="mz5h2a"
Residents

↓

Invoices

↓

Payments

↓

Receipts

↓

Owner Statements

↓

Accounting Mapping

↓

SoftBis ERP
```

---

# Finance Tables

| Table               | Purpose               |
| ------------------- | --------------------- |
| invoices            | Operational Invoice   |
| invoice_items       | Invoice Details       |
| payments            | Payment Records       |
| receipts            | Receipt Registry      |
| owner_statements    | Owner Statements      |
| accounting_mappings | SoftBis Mapping       |
| payment_methods     | Payment Configuration |

---

# Invoices

Invoices represent operational charges generated by the system.

Examples

Maintenance Fee

Water

Electricity

Rental Fee

Parking

Penalty

Common Area Booking

---

Recommended Columns

```text id="t4pxx9"
id

invoice_number

unit_id

resident_id

invoice_date

due_date

invoice_type

total_amount

status

created_at

updated_at
```

---

Invoice Types

Maintenance Fee

Utility

Rental

Parking

Penalty

Other

---

Status

Draft

Pending

Issued

Partially Paid

Paid

Cancelled

Overdue

---

Business Rules

* Invoice numbers are unique.
* Historical invoices remain permanently.
* Cancelled invoices are retained for audit purposes.

---

# Invoice Items

Stores detailed line items.

---

Recommended Columns

```text id="0kgw1q"
id

invoice_id

description

quantity

unit_price

discount

tax

total

created_at

updated_at
```

---

Business Rules

One invoice contains multiple invoice items.

---

# Payments

Represents payment transactions.

---

Recommended Columns

```text id="vy0t5n"
id

invoice_id

payment_method_id

payment_date

amount

reference_number

received_by

status

created_at

updated_at
```

---

Payment Status

Pending

Confirmed

Rejected

Refunded

Cancelled

---

Business Rules

* Multiple payments may settle one invoice.
* Payment history remains immutable.

---

# Receipts

Represents issued receipts.

---

Recommended Columns

```text id="vrk37g"
id

receipt_number

payment_id

issued_date

issued_by

status

created_at

updated_at
```

---

Business Rules

One payment may generate one receipt.

Receipt numbers are unique.

---

# Owner Statements

Summarizes owner financial activity.

---

Recommended Columns

```text id="sqzyj3"
id

owner_id

statement_period

gross_income

management_fee

maintenance_fee

net_income

generated_at
```

---

Business Rules

Owner statements are generated periodically.

Statements remain immutable after issuance.

---

# Accounting Mapping

Used for ERP synchronization.

---

Recommended Columns

```text id="r6zjwn"
id

source_table

source_id

softbis_document

sync_status

last_sync

error_message

created_at

updated_at
```

---

Synchronization Status

Pending

Queued

Synced

Failed

Cancelled

---

Business Rules

Operational records remain editable until synchronized.

Accounting references must never be duplicated.

---

# Payment Methods

Stores configurable payment options.

Examples

Cash

Bank Transfer

Credit Card

QR Payment

PromptPay

Online Gateway

---

Recommended Columns

```text id="0tkq4s"
id

method_name

provider

status

created_at

updated_at
```

---

# Metro Jomtien Workflow

```text id="6o2h9v"
Resident Charge

↓

Invoice

↓

Payment

↓

Receipt

↓

Owner Statement

↓

SoftBis Synchronization
```

---

# SoftBis Integration

IRM Enterprise exchanges data with SoftBis through a controlled integration layer.

Synchronization includes

Invoices

Payments

Receipts

Owner Revenue

Financial Reports

IRM Enterprise never performs accounting journal processing.

---

# Domain Integrity Rules

The Finance Domain must satisfy

* Invoice numbers are unique.
* Receipts cannot exist without payments.
* Payments cannot exceed invoice balance.
* Historical financial records remain immutable.
* Every ERP synchronization is logged.

---

# Future Expansion

The Finance Domain is designed to support

Online Payment Gateway

PromptPay QR

Credit Card Processing

Automatic Reconciliation

Bank API Integration

Tax Invoice Generation

E-Receipt

E-Tax Invoice

Multi-Currency

Multi-Company Accounting

without redesigning the schema.


---

# Section 9 — System Domain

The System Domain provides the infrastructure required by every business module within IRM Enterprise.

Unlike business domains, the System Domain does not represent operational data.

Instead, it provides common services that support the entire platform.

---

# System Philosophy

Business modules should never implement common infrastructure independently.

Instead, all shared functionality must be centralized within the System Domain.

Examples include:

Authentication

Notifications

Files

Audit Logs

Application Settings

Language

System Configuration

---

# System Domain Overview

```text
Authentication
        │
        ▼
Profiles
        │
        ▼
System Services
        │
 ┌──────┼────────┬────────┬────────┐
 ▼      ▼        ▼        ▼        ▼
Files Notifications Audit Settings Languages
```

---

# System Tables

| Table             | Purpose                    |
| ----------------- | -------------------------- |
| settings          | Global Configuration       |
| files             | File Registry              |
| notifications     | Notification Queue         |
| notification_logs | Delivery History           |
| audit_logs        | System Audit Trail         |
| activity_logs     | User Activity              |
| languages         | Supported Languages        |
| system_jobs       | Background Jobs            |
| api_keys          | External API Configuration |
| integrations      | Third-party Integrations   |

---

# Settings

Stores application-wide configuration.

Examples

Company Name

Timezone

Currency

Theme

Email Settings

LINE Settings

SoftBis Settings

---

Recommended Columns

```text
id

setting_key

setting_value

category

description

is_public

created_at

updated_at
```

---

Business Rules

* Setting keys must be unique.
* Configuration changes are audited.
* Sensitive values should be encrypted.

---

# Files

Central registry for uploaded files.

Actual files are stored in Supabase Storage.

---

Recommended Columns

```text
id

file_name

original_name

mime_type

file_size

storage_bucket

storage_path

uploaded_by

created_at
```

---

Business Rules

* Files are never referenced by direct URLs.
* Business modules reference file IDs.
* File ownership is preserved.

---

# Notifications

Stores notifications generated by the system.

Delivery Channels

Application

Email

SMS

LINE OA

Push Notification

Future WhatsApp

---

Recommended Columns

```text
id

recipient_profile_id

channel

title

message

status

scheduled_at

sent_at

created_at
```

---

Status

Queued

Sending

Delivered

Failed

Cancelled

Read

---

Business Rules

Notifications are immutable.

Delivery history is stored separately.

---

# Notification Logs

Tracks every delivery attempt.

---

Recommended Columns

```text
id

notification_id

provider

status

response

attempted_at
```

---

Business Rules

Every delivery attempt creates one log.

---

# Audit Logs

Stores system-level audit events.

Examples

Login

Logout

Permission Change

Configuration Update

Delete Request

Financial Approval

---

Recommended Columns

```text
id

profile_id

module

action

resource

resource_id

ip_address

user_agent

created_at
```

---

Business Rules

Audit logs are immutable.

Deletion is prohibited.

---

# Activity Logs

Stores user activity timeline.

Examples

Opened Dashboard

Created Resident

Generated Report

Viewed Invoice

Exported PDF

---

Recommended Columns

```text
id

profile_id

activity

module

metadata

created_at
```

---

Business Rules

Activity logs improve reporting and analytics.

---

# Languages

Supported application languages.

Examples

English

Thai

Japanese

Chinese

---

Recommended Columns

```text
id

language_code

language_name

is_default

status
```

---

Business Rules

One default language only.

---

# System Jobs

Background processing queue.

Examples

Generate Reports

Sync SoftBis

Send Email

Send LINE

Generate Owner Statement

Cleanup Temporary Files

---

Recommended Columns

```text
id

job_name

job_type

status

scheduled_at

started_at

completed_at

error_message
```

---

Status

Queued

Running

Completed

Failed

Cancelled

---

# API Keys

Stores configuration for external APIs.

Examples

LINE OA

Firebase

Google Maps

PromptPay

Payment Gateway

---

Recommended Columns

```text
id

provider

key_name

encrypted_value

status

created_at

updated_at
```

---

Business Rules

Secrets must never be stored as plain text.

---

# Integrations

External system registry.

Examples

SoftBis

LINE OA

Google Calendar

Firebase

Microsoft 365

Future ERP

---

Recommended Columns

```text
id

integration_name

integration_type

version

status

last_sync

created_at

updated_at
```

---

# Domain Integrity Rules

The System Domain must satisfy:

* Configuration is centralized.
* Audit logs are immutable.
* Notifications are traceable.
* Files are reusable.
* API credentials are encrypted.
* Background jobs are monitored.

---

# Future Expansion

Designed to support

Event Bus

Microservices

Message Queue

AI Agents

Workflow Engine

Digital Signature

Document OCR

Data Warehouse

Business Intelligence

without changing the database architecture.


---

# Section 10 — Enterprise Entity Relationship Architecture

This section defines the master relationship between all major business domains.

The Entity Relationship Architecture serves as the blueprint for every database migration and future module.

---

# Enterprise Relationship

```text
                           Profiles
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
      Owners             Residents          Security Staff
          │                    │                    │
          │                    ▼                    ▼
          │              Occupancies        Security Shifts
          │                    │                    │
          ▼                    ▼                    ▼
     Ownerships             Units            Gate Sessions
          │                    │                    │
          │                    ├──────────────┐     │
          │                    ▼              ▼     ▼
          │             Visitor Sessions  Work Orders
          │                    │              │
          │                    ▼              ▼
          │             Visitor Parking   Assets
          │
          ▼
 Rental Contracts
          │
          ▼
 Reservations
          │
          ▼
 Guest Stays
          │
          ▼
 Housekeeping
          │
          ▼
 Rental Revenue
          │
          ▼
 Owner Statements
          │
          ▼
 SoftBis Integration
```

---

# Core Relationship Rules

The following relationships are mandatory.

Property

↓

Building

↓

Floor

↓

Unit

No module bypasses this hierarchy.

---

Profile

↓

Owner

↓

Ownership

↓

Unit

Ownership represents legal rights only.

---

Profile

↓

Resident

↓

Occupancy

↓

Unit

Occupancy represents actual residency.

---

Rental Relationship

```text
Owner

↓

Unit

↓

Rental Contract

↓

Reservation

↓

Guest

↓

Stay
```

---

Visitor Relationship

```text
Visitor

↓

Visitor Session

↓

Vehicle

↓

Gate Log

↓

Exit
```

---

Work Order Relationship

```text
Resident

↓

Maintenance Request

↓

Work Order

↓

Technician

↓

Completion
```

---

Finance Relationship

```text
Invoice

↓

Payment

↓

Receipt

↓

Accounting Mapping

↓

SoftBis ERP
```

---

Notification Relationship

```text
Business Event

↓

Notification

↓

Notification Log

↓

Delivery
```

---

Audit Relationship

Every business table must support auditing.

```text
Business Record

↓

Audit Log

↓

Activity Log
```

---

# Cross Domain References

The following foreign keys are shared across domains.

```text
profile_id

property_id

building_id

floor_id

unit_id

owner_id

resident_id

visitor_id

reservation_id

work_order_id

invoice_id
```

Business modules should never create duplicate identifiers.

---

# Reference Integrity

The following rules apply globally.

* All foreign keys must reference existing records.
* Cascade Delete is prohibited for business entities.
* Historical records must remain available.
* Soft Delete is preferred.
* Referential integrity must always be maintained.

---

# UUID Strategy

Every business entity uses UUID.

Example

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

Advantages

* Globally unique
* Safer synchronization
* Multi-system integration
* Easier offline support
* Future microservices compatibility

---

# Standard Audit Columns

Every business table should contain

```text
id

created_at

updated_at

created_by

updated_by

deleted_at

deleted_by

is_deleted
```

Additional columns may be added depending on business requirements.

---

# Naming Rules

Primary Key

```text
id
```

Foreign Keys

```text
profile_id

owner_id

resident_id

unit_id

building_id

property_id

reservation_id

visitor_session_id

work_order_id

invoice_id
```

Boolean

```text
is_active

is_deleted

is_primary

is_default
```

Date

```text
start_date

end_date

move_in_date

move_out_date

scheduled_date

completed_date
```

Timestamp

```text
created_at

updated_at

deleted_at
```

---

# Relationship Stability

The relationships defined in this chapter are considered part of the Enterprise Architecture.

Future modules must extend these relationships rather than replacing them.

Breaking changes require:

* Architecture Review
* ADR Documentation
* Database Migration Plan
* Backward Compatibility Assessment

---

# Database Architecture Principle

IRM Enterprise follows a Database First strategy.

Every module must satisfy the following sequence.

Business Requirement

↓

Business Rules

↓

Database Design

↓

Relationships

↓

Migration

↓

Repository

↓

Service

↓

API

↓

UI

No implementation should begin before the database architecture has been approved.


---

# Section 11 — Database Index Strategy

This section defines the indexing standards for every database table within IRM Enterprise.

Proper indexing is essential to ensure high performance as the platform grows to millions of records across multiple properties.

---

# Indexing Philosophy

Indexes must support business operations rather than simply improving query speed.

Every index should exist because it satisfies one of the following objectives.

* Improve lookup performance.
* Support foreign key relationships.
* Accelerate reporting.
* Optimize sorting.
* Reduce full table scans.

Unused indexes should be avoided.

---

# Primary Index

Every business table uses a UUID primary key.

Example

```sql
PRIMARY KEY (id)
```

---

# Foreign Key Indexes

Every foreign key must be indexed.

Examples

```text
profile_id

property_id

building_id

floor_id

unit_id

owner_id

resident_id

visitor_id

reservation_id

work_order_id

invoice_id
```

---

# Composite Indexes

Frequently queried combinations should use composite indexes.

Examples

Residents

```text
(unit_id, status)
```

Reservations

```text
(unit_id, check_in, check_out)
```

Visitor Sessions

```text
(status, actual_arrival)
```

Work Orders

```text
(status, priority)
```

Invoices

```text
(status, due_date)
```

---

# Search Indexes

Fields frequently searched should be indexed.

Examples

```text
email

phone

passport_number

citizen_id

license_plate

unit_number

reservation_number

invoice_number

work_order_number
```

---

# Date Indexes

Operational reporting depends heavily on dates.

Recommended indexes

```text
created_at

updated_at

check_in

check_out

invoice_date

payment_date

scheduled_date

completed_date
```

---

# Status Indexes

Status fields are frequently filtered.

Recommended indexes

```text
status

is_active

is_deleted

is_primary
```

---

# Unique Indexes

The following fields should enforce uniqueness where appropriate.

```text
email

employee_code

property_code

building_code

unit_number (within building)

reservation_number

invoice_number

receipt_number
```

---

# Full-Text Search

The following fields should support future PostgreSQL Full-Text Search.

Examples

Resident Name

Visitor Name

Work Order Description

Incident Description

Announcement Title

Document Title

---

# Reporting Indexes

Large reports should use optimized indexes.

Examples

Revenue Reports

```text
(invoice_date, status)
```

Owner Statements

```text
(owner_id, statement_period)
```

Visitor Reports

```text
(actual_arrival, actual_departure)
```

Work Order Reports

```text
(priority, status, completed_date)
```

---

# Performance Guidelines

Database queries should:

* Use indexed columns whenever possible.
* Avoid leading wildcard searches.
* Avoid unnecessary SELECT *.
* Return only required columns.
* Support pagination for large datasets.

---

# Maintenance Strategy

Indexes should be reviewed periodically.

Unused indexes should be removed.

Missing indexes should be identified using PostgreSQL performance statistics.

Database performance should be monitored continuously as data volume increases.

---

# Enterprise Recommendation

Every new table introduced into IRM Enterprise must include an Index Review during database design.

No production migration should be approved until indexing has been evaluated.


---

# Section 12 — Row Level Security (RLS) Strategy

This section defines the Row Level Security (RLS) architecture for IRM Enterprise.

Security is enforced at both the application layer and the database layer.

Every database table containing business data must be protected by Row Level Security.

---

# Security Philosophy

IRM Enterprise follows the principle of Least Privilege.

Users should only be able to access data required to perform their responsibilities.

Permission is granted by role, property, and business relationship.

---

# Security Layers

```text
Application

↓

Middleware

↓

Service Layer

↓

Repository

↓

Supabase RLS

↓

PostgreSQL
```

Every layer contributes to overall security.

No single layer is considered sufficient on its own.

---

# Authentication

Authentication is handled exclusively by Supabase Auth.

Supabase is responsible for:

* Identity Verification
* Session Management
* Token Issuance
* Password Security
* Email Verification

IRM Enterprise never stores user passwords.

---

# Authorization

Authorization is managed internally.

Authorization depends on:

* User Role
* Assigned Property
* Assigned Building
* Assigned Unit
* Business Ownership
* Operational Responsibility

---

# Role Hierarchy

```text
Super Administrator

↓

Administrator

↓

Committee

↓

Manager

↓

Security

↓

Technician

↓

Owner

↓

Resident

↓

Tenant

↓

Guest
```

Higher roles inherit permissions from lower roles only where explicitly defined.

---

# Data Ownership

Every record belongs to an owner.

Examples

Resident Record

↓

Resident

Work Order

↓

Assigned Unit

Visitor Session

↓

Resident

Rental

↓

Owner

Invoice

↓

Unit

Ownership determines access.

---

# Property Isolation

Multi-property deployment requires strict isolation.

Example

```text
Property A

cannot access

Property B
```

Unless explicitly granted.

---

# Recommended RLS Policies

Profiles

* Users may view their own profile.
* Administrators may manage all profiles.

Residents

* Residents may view their own records.
* Property staff may manage residents.

Units

* Residents may view assigned units.
* Owners may view owned units.
* Staff may manage units.

Reservations

* Guests cannot access.
* Owners view their own reservations.
* Administrators manage all.

Visitor Sessions

* Security manages active sessions.
* Residents view visitors for their units.
* Historical data is read-only.

Work Orders

* Residents view their own requests.
* Technicians view assigned work.
* Administrators manage all.

Invoices

* Owners view their invoices.
* Residents view applicable invoices.
* Finance staff manage payments.

---

# Service Responsibility

The Service Layer validates business permissions before accessing repositories.

Examples

* Verify ownership.
* Verify assignment.
* Verify active status.
* Verify property membership.

Repositories never implement authorization logic.

---

# Audit Requirements

Security-sensitive actions generate audit records.

Examples

Login

Logout

Role Change

Permission Update

Financial Approval

Record Deletion

Configuration Change

---

# Security Best Practices

* Never trust client-side validation.
* Validate every request.
* Use UUID identifiers.
* Encrypt sensitive values.
* Log privileged actions.
* Apply least privilege.
* Deny by default.

---

# Future Expansion

The RLS architecture supports:

* Multi-Company
* Multi-Tenant SaaS
* External API Access
* Mobile Applications
* AI Agents
* Public Portals

without changing the underlying authorization model.


---

# Section 13 — Database Migration Strategy

This section defines the migration strategy for the IRM Enterprise database.

The objective is to ensure that every schema change is traceable, repeatable, reversible when possible, and safe for production environments.

Database migrations are considered part of the software architecture and must follow the same review process as application code.

---

# Migration Philosophy

IRM Enterprise follows a controlled migration process.

Business Requirement

↓

Blueprint Update

↓

Architecture Review

↓

Database Design

↓

Migration Script

↓

Testing

↓

Deployment

↓

Production

Schema changes must never be made directly in production.

---

# Migration Principles

Every migration must satisfy the following principles.

* Atomic
* Repeatable
* Version Controlled
* Documented
* Backward Compatible whenever possible
* Tested before deployment

---

# Migration Categories

## Schema Migration

Examples

Create Table

Drop Table

Add Column

Rename Column

Modify Constraint

Create Index

Drop Index

---

## Data Migration

Examples

Move Data

Normalize Data

Merge Records

Split Records

Update Existing Values

Historical Conversion

---

## Reference Data Migration

Examples

Default Roles

Languages

Statuses

Configuration

Permission Matrix

Countries

Currencies

---

# Migration Naming Convention

Recommended format

```text id="1dtn5v"
YYYYMMDD_HHMM_description.sql
```

Example

```text id="s0qn9j"
20260705_0900_create_residents_table.sql

20260705_1100_add_owner_index.sql

20260708_1430_create_work_orders.sql
```

---

# Migration Directory Structure

```text id="frsj0f"
supabase/

migrations/

seeds/

functions/

policies/

views/

triggers/
```

---

# Migration Workflow

```text id="juxdwb"
Blueprint Updated

↓

Migration Created

↓

Local Testing

↓

Code Review

↓

Architecture Review

↓

Git Commit

↓

Deployment

↓

Production
```

---

# Database Versioning

Every migration is stored in Git.

Schema history must remain available.

Developers must never edit previously executed migration files.

New changes require new migration files.

---

# Rollback Strategy

Where possible, migrations should support rollback.

Examples

Create Table

↓

Drop Table

Add Column

↓

Drop Column

Create Index

↓

Drop Index

Complex data migrations may require manual rollback procedures.

---

# Seed Data

Seed data should be separated from migrations.

Examples

Roles

Permissions

Languages

Property Types

Unit Types

Work Order Status

Invoice Status

Countries

Currencies

---

# Environment Strategy

IRM Enterprise supports multiple environments.

Development

↓

Testing

↓

Staging

↓

Production

Every environment uses identical schema versions.

Configuration differs only through environment variables.

---

# Deployment Rules

Production deployment requires:

* Successful Build
* Passing TypeScript
* Passing ESLint
* Migration Validation
* Database Backup
* Architecture Approval

---

# Migration Review Checklist

Before approving a migration:

* Blueprint updated
* ADR reviewed (if required)
* Naming convention followed
* Foreign keys validated
* Indexes reviewed
* RLS policies updated
* Seed data verified
* Rollback considered
* Tested locally
* Committed to Git

---

# Long-Term Maintenance

Database migrations are permanent historical artifacts.

They must remain:

* Readable
* Reproducible
* Versioned
* Documented

Migration history forms part of the technical documentation of IRM Enterprise.

---

# Future Expansion

The migration strategy is designed to support:

Multi-Property

Multi-Tenant SaaS

Regional Deployments

Database Sharding

Read Replicas

Partitioned Tables

High Availability

Cloud Failover

without changing the migration process.

# Section 14 — Future Expansion Strategy

This section defines the long-term evolution strategy of the IRM Enterprise database.

The database architecture has been designed not only for the current operational requirements of Metro Jomtien Condotel, but also to support future expansion into a complete Enterprise Property Operating System.

The objective is to ensure that new business capabilities can be introduced without redesigning the core database architecture.

---

# Design Philosophy

IRM Enterprise follows the principle of **Evolution without Reconstruction**.

Every new module should extend the existing architecture rather than replace it.

Future growth must preserve:

* Database consistency
* Business continuity
* Historical records
* Referential integrity
* Backward compatibility

---

# Expansion Roadmap

The following domains are planned for future implementation.

## Phase 1

Core Platform

Resident Management

Property Management

Visitor Management

Security Management

Rental Management

Work Orders

Finance Integration

Completed through the initial Enterprise Architecture.

---

## Phase 2

Package & Parcel Management

Meeting Room Booking

Facility Reservation

Vehicle Registration

Parking Management

Announcement Center

Document Center

Complaint Management

Survey System

Resident Mobile Portal

---

## Phase 3

Smart Building

IoT Sensors

Access Control

Smart Locks

Energy Monitoring

Utility Meter Automation

Digital Visitor Kiosk

Facial Recognition

Automatic Number Plate Recognition (ANPR)

CCTV Integration

---

## Phase 4

Business Intelligence

Executive Dashboard

AI Reporting

Predictive Maintenance

Occupancy Analytics

Financial Forecasting

Resident Behavior Analytics

Operational KPI Dashboard

---

## Phase 5

Enterprise Expansion

Multi-Company

Multi-Region

Multi-Country

Multi-Currency

Multi-Language

Franchise Management

Cloud SaaS Platform

White Label Platform

---

# External Integrations

The architecture supports future integration with:

SoftBis ERP

LINE Official Account

Microsoft 365

Google Workspace

Google Calendar

Google Maps

Firebase

Payment Gateways

PromptPay QR

National Digital ID

Government e-Tax Services

Hotel PMS

Channel Managers

Accounting Platforms

CRM Systems

REST APIs

GraphQL APIs

Webhook Services

---

# Artificial Intelligence

IRM Enterprise is designed to become an AI-assisted platform.

Future AI modules include:

AI Help Desk

AI Resident Assistant

AI Security Monitoring

AI Visitor Verification

AI Maintenance Prediction

AI Revenue Forecasting

AI Document Search

AI Knowledge Base

AI Report Generation

AI Workflow Automation

---

# Data Warehouse Strategy

Operational databases remain optimized for transactions.

Large-scale reporting should utilize a separate analytics platform.

Future architecture may include:

Operational Database

↓

Data Warehouse

↓

Business Intelligence

↓

Executive Dashboard

↓

AI Analytics

---

# Scalability Targets

The architecture is designed to support:

Millions of Residents

Millions of Visitors

Millions of Work Orders

Millions of Financial Records

Multiple Properties

Multiple Organizations

Multiple Countries

without redesigning the schema.

---

# Technology Evolution

The platform should remain adaptable to future technologies including:

Microservices

Event-Driven Architecture

Serverless Computing

Edge Computing

AI Agents

Machine Learning

Digital Identity

Blockchain-based Audit

IoT Platforms

Cloud-native Infrastructure

---

# Backward Compatibility

Backward compatibility is a core architectural requirement.

Existing APIs, database structures, and integrations should remain functional whenever possible.

Breaking changes require:

* Architecture Review
* Architecture Decision Record (ADR)
* Database Migration Plan
* Communication Plan
* Version Upgrade Strategy

---

# Documentation Policy

Every architectural expansion must update:

Blueprint

ADR

Business Decisions

Standards

Templates

Prompts

No architectural change is considered complete until the documentation has been updated.

---

# Final Architecture Principle

IRM Enterprise is designed as a living platform.

The database architecture should evolve continuously while preserving stability, maintainability, security, and scalability.

Every future module must extend the architecture defined in this Master Database Specification rather than introducing parallel structures.

---

# Chapter Summary

The Master Database Architecture defines the foundation of IRM Enterprise.

It establishes:

* Enterprise database philosophy
* Core domains
* Business domains
* System domains
* Entity relationships
* Index strategy
* Row Level Security
* Migration strategy
* Future expansion

This document serves as the authoritative reference for all future database design, application development, and system integration activities.

No implementation should deviate from this architecture without formal architectural review.
