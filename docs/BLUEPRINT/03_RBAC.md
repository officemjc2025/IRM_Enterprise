# Chapter 03 — Role Based Access Control (RBAC)

**Version:** 1.0.0

**Status:** Active

**Owner:** IRM Enterprise Architecture Team

---

# Overview

This document defines the Role-Based Access Control (RBAC) architecture for IRM Enterprise.

RBAC determines who can access which modules, perform which actions, and view which business data.

It provides a centralized authorization model across the entire platform.

Every module, API, page, report, and business process must comply with this RBAC specification.

---

# Objectives

The RBAC architecture is designed to:

* Protect sensitive information.
* Separate responsibilities.
* Enforce least privilege.
* Support multi-property organizations.
* Simplify permission management.
* Enable future scalability.

---

# Authorization Philosophy

Authentication answers:

**Who are you?**

Authorization answers:

**What are you allowed to do?**

Authentication is handled by Supabase Auth.

Authorization is handled by IRM Enterprise.

---

# Security Layers

```text
User

↓

Authentication

↓

Session

↓

Role

↓

Permission

↓

Business Rule

↓

Database RLS

↓

Resource Access
```

---

# RBAC Principles

IRM Enterprise follows these principles.

* Least Privilege
* Role Separation
* Property Isolation
* Auditability
* Explicit Permission
* Deny by Default

Every request must be authorized.

---

# Permission Hierarchy

Permissions are evaluated in this order.

```text
Authentication

↓

Role

↓

Property Access

↓

Business Rule

↓

Resource Ownership

↓

Database Policy
```

If any layer fails,

Access is denied.


---

# Section 1 — Enterprise Roles

IRM Enterprise supports a hierarchical Role-Based Access Control (RBAC) model.

Roles define the operational responsibilities of users throughout the platform.

Permissions are granted to roles rather than individual users whenever possible.

---

# Role Hierarchy

```text
Super Administrator
        │
        ▼
Organization Administrator
        │
        ▼
Property Manager
        │
        ▼
Committee
        │
        ▼
Office Staff
        │
        ▼
Security Supervisor
        │
        ▼
Security Guard
        │
        ▼
Maintenance Supervisor
        │
        ▼
Technician
        │
        ▼
Owner
        │
        ▼
Co-Owner
        │
        ▼
Resident
        │
        ▼
Tenant
        │
        ▼
Guest
```

Roles inherit only the permissions explicitly granted by the RBAC policy.

Inheritance should never automatically grant unrestricted access.

---

# Enterprise Roles

## Super Administrator

Responsible for the entire platform.

Permissions include

* System Configuration
* Global Settings
* Property Creation
* User Management
* Permission Management
* Database Administration
* Integration Management
* Audit Access

Can access every module.

---

## Organization Administrator

Responsible for all properties within one organization.

Permissions include

* Property Administration
* User Administration
* Reports
* Financial Review
* System Configuration (Organization Level)

Cannot modify global platform settings.

---

## Property Manager

Responsible for one property.

Permissions include

* Residents
* Owners
* Rentals
* Visitors
* Security
* Work Orders
* Finance
* Reports

Limited to assigned properties.

---

## Committee

Represents the condominium committee.

Permissions include

* Resident Information
* Complaint Review
* Meeting Documents
* Reports
* Announcements

Committee members cannot change system configuration.

---

## Office Staff

Responsible for daily office operations.

Permissions include

* Resident Registration
* Visitor Approval
* Rental Registration
* Work Order Creation
* Document Management

Cannot access administrative settings.

---

## Security Supervisor

Responsible for the security team.

Permissions include

* Gate Operations
* Incident Reports
* Security Dashboard
* Shift Assignment
* Visitor Verification

Cannot modify resident information.

---

## Security Guard

Responsible for gate operations.

Permissions include

* QR Check-In
* QR Check-Out
* Visitor Registration
* Visitor Search
* Temporary Parking
* Incident Reporting

Cannot modify financial information.

---

## Maintenance Supervisor

Responsible for maintenance planning.

Permissions include

* Assign Work Orders
* Schedule Maintenance
* Manage Technicians
* Vendor Coordination
* Asset Management

---

## Technician

Responsible for maintenance execution.

Permissions include

* View Assigned Work Orders
* Upload Photos
* Complete Tasks
* Update Maintenance Status

Technicians cannot create financial records.

---

## Owner

Legal owner of one or more units.

Permissions include

* View Owned Units
* View Owner Statements
* View Rental Revenue
* Register Owner Stay
* Submit Maintenance Requests
* View Visitor History

Owners cannot manage other owners.

---

## Co-Owner

Shares ownership rights.

Permissions are configurable according to ownership agreements.

---

## Resident

Lives within the property.

Permissions include

* View Resident Profile
* Submit Maintenance Requests
* Register Visitors
* Receive Announcements
* View Documents
* Book Facilities

Residents cannot access ownership records unless they are also owners.

---

## Tenant

Occupies a unit under a rental agreement.

Permissions include

* View Rental Information
* Submit Maintenance Requests
* Register Visitors
* Book Facilities

Tenants cannot access owner financial information.

---

## Guest

Temporary visitor.

Permissions are extremely limited.

Guests may only access:

* Temporary QR Pass
* Digital Invitation
* Visitor Check-In

Guest accounts expire automatically.

---

# Role Assignment

Each authenticated profile is assigned one or more roles.

Example

```text
Metro Admin

↓

Super Administrator

↓

Property Manager

↓

Committee
```

Multiple roles are allowed.

Effective permissions are calculated by the authorization engine.

---

# Property Scope

Roles are evaluated together with property assignment.

Example

```text
Property Manager

↓

Metro Jomtien

✓ Allowed

↓

Metro Residence

✗ Denied
```

Property isolation is mandatory.

---

# Future Roles

The architecture supports future roles including

Corporate Manager

Regional Manager

Finance Officer

Accounting Staff

Customer Service

Cleaning Staff

Parking Officer

Delivery Center

AI Agent

External Auditor

Government Inspector

without changing the RBAC architecture.

---

# Section 2 — Enterprise Permission Matrix

The Permission Matrix defines the actions each role is authorized to perform across every business module.

IRM Enterprise follows a capability-based permission model.

Permissions are grouped into four primary operations.

* Create
* Read
* Update
* Delete

Additional operational permissions are also supported.

* Approve
* Assign
* Export
* Import
* Configure
* Audit

---

# Permission Types

| Permission | Description                       |
| ---------- | --------------------------------- |
| Create     | Create new records                |
| Read       | View records                      |
| Update     | Modify records                    |
| Delete     | Remove records (Soft Delete Only) |
| Approve    | Approve business transactions     |
| Assign     | Assign work                       |
| Export     | Export reports                    |
| Import     | Import data                       |
| Configure  | Change system configuration       |
| Audit      | View audit information            |

---

# Module Permission Matrix

## Authentication

| Role                |  C  |     R    |     U    |  D  |
| ------------------- | :-: | :------: | :------: | :-: |
| Super Administrator |  ✓  |     ✓    |     ✓    |  ✓  |
| Administrator       |  ✓  |     ✓    |     ✓    |  ✗  |
| Property Manager    |  ✗  |     ✓    |     ✗    |  ✗  |
| Resident            |  ✗  | ✓ (Self) | ✓ (Self) |  ✗  |

---

## Profiles

| Role                |  C  |     R    |     U    |  D  |
| ------------------- | :-: | :------: | :------: | :-: |
| Super Administrator |  ✓  |     ✓    |     ✓    |  ✓  |
| Administrator       |  ✓  |     ✓    |     ✓    |  ✗  |
| Property Manager    |  ✓  |     ✓    |     ✓    |  ✗  |
| Resident            |  ✗  | ✓ (Self) | ✓ (Self) |  ✗  |

---

## Properties

| Role                |  C  |  R  |  U  |  D  |
| ------------------- | :-: | :-: | :-: | :-: |
| Super Administrator |  ✓  |  ✓  |  ✓  |  ✓  |
| Administrator       |  ✓  |  ✓  |  ✓  |  ✗  |
| Property Manager    |  ✓  |  ✓  |  ✓  |  ✗  |
| Committee           |  ✗  |  ✓  |  ✗  |  ✗  |
| Resident            |  ✗  |  ✗  |  ✗  |  ✗  |

---

## Units

| Role                |  C  |       R      |  U  |  D  |
| ------------------- | :-: | :----------: | :-: | :-: |
| Super Administrator |  ✓  |       ✓      |  ✓  |  ✓  |
| Administrator       |  ✓  |       ✓      |  ✓  |  ✗  |
| Property Manager    |  ✓  |       ✓      |  ✓  |  ✗  |
| Office Staff        |  ✗  |       ✓      |  ✓  |  ✗  |
| Owner               |  ✗  |   ✓ (Owned)  |  ✗  |  ✗  |
| Resident            |  ✗  | ✓ (Occupied) |  ✗  |  ✗  |

---

## Residents

| Role                |  C  |     R    |     U    |  D  |
| ------------------- | :-: | :------: | :------: | :-: |
| Super Administrator |  ✓  |     ✓    |     ✓    |  ✓  |
| Administrator       |  ✓  |     ✓    |     ✓    |  ✗  |
| Property Manager    |  ✓  |     ✓    |     ✓    |  ✗  |
| Office Staff        |  ✓  |     ✓    |     ✓    |  ✗  |
| Resident            |  ✗  | ✓ (Self) | ✓ (Self) |  ✗  |

---

## Rentals

| Role             |       C      |       R      |       U      |  D  |
| ---------------- | :----------: | :----------: | :----------: | :-: |
| Property Manager |       ✓      |       ✓      |       ✓      |  ✗  |
| Office Staff     |       ✓      |       ✓      |       ✓      |  ✗  |
| Owner            | ✓ (Own Unit) | ✓ (Own Unit) | ✓ (Own Unit) |  ✗  |
| Resident         |       ✗      |       ✗      |       ✗      |  ✗  |

---

## Visitors

| Role         |  C  |         R        |  U  |  D  |
| ------------ | :-: | :--------------: | :-: | :-: |
| Security     |  ✓  |         ✓        |  ✓  |  ✗  |
| Office Staff |  ✓  |         ✓        |  ✓  |  ✗  |
| Resident     |  ✓  | ✓ (Own Visitors) |  ✗  |  ✗  |
| Owner        |  ✓  |         ✓        |  ✗  |  ✗  |

---

## Security

| Role                |  C  |  R  |  U  |  D  |
| ------------------- | :-: | :-: | :-: | :-: |
| Security Supervisor |  ✓  |  ✓  |  ✓  |  ✗  |
| Security Guard      |  ✓  |  ✓  |  ✓  |  ✗  |
| Property Manager    |  ✓  |  ✓  |  ✓  |  ✗  |

---

## Work Orders

| Role                   |  C  |       R      |  U  |  D  |
| ---------------------- | :-: | :----------: | :-: | :-: |
| Property Manager       |  ✓  |       ✓      |  ✓  |  ✗  |
| Maintenance Supervisor |  ✓  |       ✓      |  ✓  |  ✗  |
| Technician             |  ✗  | ✓ (Assigned) |  ✓  |  ✗  |
| Resident               |  ✓  |    ✓ (Own)   |  ✗  |  ✗  |

---

## Finance

| Role            |  C  |    R    |  U  |  D  |
| --------------- | :-: | :-----: | :-: | :-: |
| Administrator   |  ✓  |    ✓    |  ✓  |  ✗  |
| Finance Officer |  ✓  |    ✓    |  ✓  |  ✗  |
| Owner           |  ✗  | ✓ (Own) |  ✗  |  ✗  |
| Resident        |  ✗  | ✓ (Own) |  ✗  |  ✗  |

---

## Reports

| Role                |   View  | Export |
| ------------------- | :-----: | :----: |
| Super Administrator |    ✓    |    ✓   |
| Administrator       |    ✓    |    ✓   |
| Property Manager    |    ✓    |    ✓   |
| Committee           |    ✓    |    ✓   |
| Office Staff        |    ✓    |    ✗   |
| Resident            | Limited |    ✗   |

---

# Operational Permissions

Beyond CRUD, IRM Enterprise supports operational permissions.

Examples

Approve Work Order

Approve Rental

Approve Visitor

Approve Invoice

Assign Technician

Assign Security

Issue QR Pass

Issue Parking Pass

Generate Owner Statement

Export Financial Report

Manage Integration

Manage Users

Manage Roles

---

# Permission Evaluation

Permissions are evaluated using the following sequence.

```text
Authentication

↓

Role

↓

Permission

↓

Property Scope

↓

Business Rule

↓

Record Ownership

↓

Database RLS

↓

Access Granted
```

Failure at any step results in access denial.

---

# Default Principle

IRM Enterprise follows a deny-by-default model.

If a permission has not been explicitly granted, access must be denied.

This principle applies consistently across the application layer, APIs, and database policies.

---

# Permission Management

Permissions are centrally managed.

Business modules must not define their own permission rules independently.

All permission changes require administrative authorization and are recorded in the Audit Log.

---

# Future Expansion

The permission architecture is designed to support:

Dynamic Permission Sets

Custom Roles

Temporary Permissions

Delegated Administration

Time-Based Access

Location-Based Access

API Access Tokens

External Partner Access

AI Agent Permissions

without changing the underlying RBAC model.


---

# Section 3 — Module Permissions

This section defines detailed authorization rules for each business module.

While the Enterprise Permission Matrix defines role capabilities at a high level, this section specifies operational permissions within each module.

Every module follows the same authorization framework.

Authentication

↓

Role

↓

Permission

↓

Property Scope

↓

Business Rule

↓

Resource Ownership

↓

Access

---

# Property Management Module

Responsible for managing:

* Properties
* Buildings
* Floors
* Units
* Facilities
* Assets

Permissions

Super Administrator

* Full Access

Administrator

* Full Access

Property Manager

* Assigned Properties Only

Committee

* Read Only

Residents

* No Access

---

# Resident Management Module

Responsible for

Residents

Owners

Co-Owners

Occupancies

Emergency Contacts

Vehicles

Pets

Permissions

Super Administrator

Full Access

Administrator

Full Access

Property Manager

Assigned Property Only

Office Staff

Create / Update

Owner

Own Records

Resident

Own Records

Guest

No Access

---

# Rental Management Module

Responsible for

Reservations

Owner Stay

Guests

Housekeeping

Revenue

Availability

Permissions

Property Manager

Full Access

Office Staff

Operational Access

Owner

Own Units Only

Resident

No Access

Guest

No Access

---

# Visitor Management Module

Responsible for

Visitors

Visitor Sessions

Visitor Parking

Visitor QR

Blacklist

Permissions

Security Supervisor

Full Access

Security Guard

Operational Access

Office Staff

Registration

Resident

Own Visitors

Owner

Own Visitors

Guest

Own QR Only

---

# Security Module

Responsible for

Gate Operations

Patrol

Incidents

Access Logs

Permissions

Security Supervisor

Full Access

Security Guard

Operational Access

Property Manager

Read Access

Committee

Reports Only

Residents

No Access

---

# Work Order Module

Responsible for

Maintenance Requests

Work Orders

Technicians

Vendors

Photos

Comments

Permissions

Maintenance Supervisor

Full Access

Technician

Assigned Work Orders

Property Manager

Management

Resident

Own Requests

Owner

Own Requests

---

# Finance Module

Responsible for

Invoices

Payments

Receipts

Owner Statements

Accounting Mapping

Permissions

Finance Officer

Operational Access

Administrator

Management

Owner

Own Financial Records

Resident

Applicable Charges

Committee

Financial Reports Only

---

# Announcement Module

Responsible for

Announcements

News

Emergency Notices

Meeting Notices

Permissions

Administrator

Create

Committee

Create

Office Staff

Create

Residents

Read

Owners

Read

Guests

Public Only

---

# Document Center

Responsible for

Meeting Minutes

House Rules

Forms

Policies

Manuals

Permissions

Administrator

Manage

Committee

Manage

Residents

Read

Owners

Read

Guests

Public Documents Only

---

# Facility Reservation

Responsible for

Swimming Pool

Fitness

Meeting Room

Tennis Court

Sauna

BBQ Area

Permissions

Residents

Reserve

Owners

Reserve

Office Staff

Manage

Administrator

Manage

Guests

No Access

---

# Parking Module

Responsible for

Resident Parking

Visitor Parking

Parking Allocation

Parking History

Permissions

Administrator

Manage

Security

Visitor Parking

Residents

Own Parking

Owners

Own Parking

---

# Notification Module

Responsible for

Push Notification

Email

LINE OA

SMS

Permissions

Administrator

Manage

Office Staff

Send

Committee

Announcements

Residents

Receive

Owners

Receive

Guests

Receive Temporary Notifications

---

# Reporting Module

Responsible for

Executive Dashboard

Statistics

Operational Reports

Financial Reports

Permissions

Administrator

All Reports

Property Manager

Property Reports

Committee

Management Reports

Residents

Personal Reports

Owners

Owner Reports

---

# Administration Module

Responsible for

Users

Roles

Permissions

Settings

Integrations

Audit Logs

Permissions

Super Administrator

Full Access

Administrator

Operational Administration

All Other Roles

No Access

---

# Shared Module Rules

Every module follows these common principles.

* Role-based authorization
* Property isolation
* Ownership validation
* Audit logging
* Soft delete
* Least privilege

---

# Menu Visibility

Navigation menus are generated dynamically.

A menu is displayed only when the authenticated user has permission to access at least one function within the corresponding module.

Unauthorized modules remain completely hidden.

---

# API Authorization

Every API endpoint validates

Authentication

↓

Role

↓

Permission

↓

Property Scope

↓

Business Rules

↓

Database RLS

APIs never trust client-side authorization.

---

# Future Modules

Future modules automatically inherit the RBAC architecture.

Examples

Inventory

Procurement

HR

Payroll

CRM

Help Desk

AI Assistant

IoT

Business Intelligence

Digital Signature

without changing the authorization model.

---

# Section 4 — Data Ownership

This section defines ownership of business data throughout IRM Enterprise.

Ownership is one of the most important principles of the authorization architecture.

Having permission to access a module does not automatically grant access to every record within that module.

Every request must also satisfy ownership validation.

---

# Ownership Philosophy

IRM Enterprise separates:

Identity

↓

Role

↓

Permission

↓

Ownership

↓

Resource

A user may have permission to view Residents but may only access residents belonging to the assigned property.

---

# Types of Ownership

IRM Enterprise recognizes several ownership models.

## Personal Ownership

The record belongs directly to one profile.

Examples

User Profile

Personal Settings

Notifications

Documents

---

## Unit Ownership

The record belongs to a condominium unit.

Examples

Maintenance Requests

Invoices

Parking

Visitors

Occupancy

Only authorized users related to that unit may access the record.

---

## Property Ownership

The record belongs to one property.

Examples

Buildings

Facilities

Assets

Announcements

Reports

Only staff assigned to the property may access these records.

---

## Organization Ownership

The record belongs to the organization.

Examples

Global Settings

Roles

Permissions

Integration Settings

Accessible only by administrators.

---

# Ownership Hierarchy

```text
Organization

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

Business Record
```

Every business entity ultimately belongs to a Property.

---

# Resident Ownership

Residents own:

* Personal Profile
* Personal Notifications
* Personal Maintenance Requests
* Visitor Invitations
* Facility Reservations

Residents cannot access other residents' information unless explicitly authorized.

---

# Owner Ownership

Owners own:

* Ownership Records
* Owner Statements
* Rental Revenue
* Owned Units
* Owner Stay Reservations

Owners may not access information belonging to other owners.

---

# Tenant Ownership

Tenants own:

* Rental Information
* Maintenance Requests
* Visitor Invitations
* Facility Reservations

Tenants do not own the unit.

Ownership remains with the legal owner.

---

# Committee Ownership

Committee members do not own business data.

They are granted read access to specific operational information required for governance.

Examples

Reports

Meeting Documents

Complaints

Financial Summaries

---

# Staff Ownership

Operational staff own operational records created during work.

Examples

Security Logs

Incident Reports

Work Order Updates

Inspection Reports

Audit entries preserve the creator permanently.

---

# Data Visibility

Every record belongs to one of the following visibility levels.

Private

Unit

Property

Organization

Public

Visibility is evaluated after permission validation.

---

# Record Ownership Validation

Before returning data, the system validates:

Authentication

↓

Role

↓

Permission

↓

Property Assignment

↓

Ownership

↓

Record Status

↓

Database RLS

Only then is access granted.

---

# Shared Ownership

Some business records may have multiple authorized users.

Examples

A Unit

↓

Owner

↓

Co-owner

↓

Resident

↓

Tenant

↓

Assigned Property Manager

Each user receives different permissions for the same record.

---

# Historical Ownership

Ownership history must never be overwritten.

Example

```text
Owner A

↓

Sold Unit

↓

Owner B

↓

Current Owner
```

Historical ownership remains permanently available for auditing.

---

# Ownership Transfer

Ownership transfers require:

* Authorization
* Audit Logging
* Historical Preservation
* Effective Date
* Optional End Date

No historical records are modified during transfer.

---

# Ownership and RLS

Row Level Security policies must enforce ownership automatically.

Example

Resident

↓

Only Own Unit

Owner

↓

Only Owned Units

Property Manager

↓

Only Assigned Property

Super Administrator

↓

All Properties

---

# Ownership Integrity Rules

Every business record must have an identifiable owner.

Ownership must never be ambiguous.

No orphan records are allowed.

Foreign key relationships must enforce ownership consistency.

---

# Future Expansion

The ownership model supports:

Corporate Ownership

Joint Ownership

Trust Ownership

Government Ownership

Investment Groups

Multi-Company Organizations

Regional Organizations

International Operations

without redesigning the authorization architecture.

---

# Summary

Ownership is evaluated independently from roles.

Roles determine what a user can do.

Ownership determines which records the user can access.

Both conditions must be satisfied before access is granted.


---

# Section 5 — Property Isolation

Property Isolation is a fundamental security principle of IRM Enterprise.

The platform is designed to support multiple independent properties within the same organization while ensuring complete separation of operational data.

No user should access another property's information unless explicitly authorized.

---

# Property Isolation Philosophy

Every business record belongs to exactly one property.

```text
Organization

↓

Property

↓

Building

↓

Floor

↓

Unit

↓

Business Record
```

Property ownership defines the highest level of business isolation.

---

# Isolation Scope

The following business entities are isolated by Property.

* Buildings
* Floors
* Units
* Residents
* Owners
* Rentals
* Visitors
* Security
* Work Orders
* Finance
* Documents
* Announcements
* Reports

No module bypasses Property Isolation.

---

# Assignment Model

Users are assigned to one or more properties.

Examples

Metro Admin

↓

Metro Jomtien

Metro Residence

Metro Tower

Security Guard A

↓

Metro Jomtien Only

Technician B

↓

Metro Residence Only

---

# Property Assignment Table

Recommended structure

```text
profile_id

property_id

role

is_primary

effective_date

end_date

status
```

One user may be assigned to multiple properties.

Assignments are time-based and auditable.

---

# Access Evaluation

Every request evaluates:

Authentication

↓

Role

↓

Property Assignment

↓

Business Permission

↓

Ownership

↓

RLS Policy

↓

Access

Failure at any step denies access.

---

# Cross Property Access

Only the following roles may access multiple properties.

* Super Administrator
* Organization Administrator
* Regional Manager (Future)

All other roles are restricted to assigned properties.

---

# Resident Isolation

Residents may access only:

* Their own profile
* Their occupied units
* Their own maintenance requests
* Their own visitors
* Their own reservations

Residents never access another property's data.

---

# Owner Isolation

Owners may access:

* Owned Units
* Owner Statements
* Rental Revenue
* Visitor History
* Owner Stay

Only for units they legally own.

---

# Staff Isolation

Office Staff

↓

Assigned Property Only

Security Guard

↓

Assigned Property Only

Technician

↓

Assigned Property Only

Committee

↓

Assigned Property Only

---

# Financial Isolation

Financial records are isolated by property.

Examples

Invoices

Payments

Owner Statements

Revenue

Accounting Mapping

Financial reports cannot include another property's data without organization-level permission.

---

# Report Isolation

Reports follow the same rules.

Property Manager

↓

Own Property Reports

Organization Administrator

↓

Organization Reports

Super Administrator

↓

All Reports

---

# Notification Isolation

Announcements

↓

Property Specific

Emergency Alerts

↓

Property Specific

Owner Statements

↓

Unit Specific

System Notifications

↓

Organization Level

---

# Database Enforcement

Property Isolation is enforced by:

Application Layer

↓

Service Layer

↓

Repository

↓

Supabase Row Level Security

↓

PostgreSQL

Isolation is never enforced solely by the frontend.

---

# Property Transfer

If a unit changes ownership, the Property Assignment remains unchanged.

Only ownership records change.

Historical data remains associated with the original property.

---

# Integrity Rules

Every operational table must contain a property reference either directly or indirectly.

Property relationships must always be traceable.

No orphan records are permitted.

---

# Future Expansion

Property Isolation supports:

Multi-Property

Multi-Organization

Regional Offices

International Operations

White Label SaaS

Property Franchises

without modifying the authorization architecture.

---

# Summary

Property Isolation guarantees that operational data remains securely partitioned between properties.

It provides one of the strongest security boundaries within the IRM Enterprise platform and works together with Roles, Permissions, Ownership, and Row Level Security to protect business information.


---

# Section 6 — Approval Workflow

Many business processes within IRM Enterprise require approval before becoming effective.

The Approval Workflow ensures that sensitive operations are reviewed, authorized, and permanently recorded.

Every approval is fully auditable.

---

# Approval Philosophy

Business Action

↓

Validation

↓

Approval

↓

Execution

↓

Audit Log

No critical business action should bypass the approval process.

---

# Approval Principles

IRM Enterprise follows these approval principles.

* Separation of Duties
* Least Privilege
* Full Auditability
* Configurable Workflow
* Digital Approval
* Non-Repudiation

Approvals must always identify the approver and the approval time.

---

# Approval Levels

The system supports multiple approval levels.

Level 1

Operational Approval

Examples

Visitor Approval

Maintenance Request

Facility Reservation

---

Level 2

Manager Approval

Examples

Large Work Orders

Owner Statements

Rental Contracts

Vendor Registration

---

Level 3

Executive Approval

Examples

Property Configuration

Financial Closing

Permission Changes

Organization Settings

---

# Approval Status

Standard approval statuses include:

Pending

Submitted

Under Review

Approved

Rejected

Cancelled

Expired

Completed

Status changes must be logged permanently.

---

# Approval Workflow

```text
Request

↓

Validation

↓

Reviewer Assignment

↓

Approval Decision

↓

Execution

↓

Audit Log

↓

Notification
```

---

# Supported Approval Modules

The following modules support approval workflows.

Visitors

Rental Contracts

Owner Stay

Maintenance Requests

Work Orders

Vendor Registration

Financial Adjustments

Invoices

Announcements

Document Publication

Role Changes

Permission Changes

System Configuration

---

# Reviewer Assignment

Reviewers may be assigned by:

Role

Department

Property

Business Rule

Specific User

Assignments are configurable.

---

# Delegation

Approvers may delegate approval authority temporarily.

Delegation requires:

* Start Date
* End Date
* Delegate User
* Approval Scope

Delegation history is permanently recorded.

---

# Multi-Level Approval

Some workflows require multiple approvals.

Example

```text
Office Staff

↓

Property Manager

↓

Finance Officer

↓

Administrator
```

Execution occurs only after all required approvals are completed.

---

# Approval History

Every approval stores:

Requester

Approver

Decision

Comments

Approval Time

Module

Record Reference

Property

Historical records are immutable.

---

# Notification Integration

Approval events automatically generate notifications.

Examples

Request Submitted

Approval Required

Approved

Rejected

Cancelled

Expired

Notifications support:

Application

Email

LINE OA

Push Notification

SMS (Future)

---

# Business Rules

Every approval workflow must satisfy:

* Clear approval responsibility
* Permanent audit trail
* Configurable routing
* Property isolation
* Permission validation
* Ownership validation

---

# Emergency Approval

Emergency workflows may bypass normal routing.

Examples

Fire

Medical Emergency

Security Incident

Critical Infrastructure Failure

Emergency approvals require post-event review and mandatory audit documentation.

---

# Future Expansion

The Approval Engine is designed to support:

Parallel Approval

Conditional Approval

AI Recommendation

Digital Signature

Electronic Stamp

Government Integration

Workflow Automation

BPM Integration

without redesigning the approval architecture.

---

# Summary

The Approval Workflow provides a standardized mechanism for authorizing sensitive business operations.

It ensures accountability, transparency, and operational consistency across every module within IRM Enterprise.


---

# Section 7 — Security Policies

This section defines the enterprise security policies governing access to IRM Enterprise.

Security is implemented using a Defense-in-Depth strategy, where multiple independent security layers work together to protect business data and system resources.

No single security mechanism is considered sufficient.

---

# Security Principles

IRM Enterprise follows these core security principles.

* Zero Trust
* Least Privilege
* Defense in Depth
* Secure by Default
* Deny by Default
* Continuous Auditing
* Principle of Separation of Duties

Every request must be authenticated, authorized, validated, and audited.

---

# Security Architecture

```text
Client

↓

HTTPS / TLS

↓

Authentication

↓

Middleware

↓

Authorization

↓

Business Validation

↓

Service Layer

↓

Repository

↓

Row Level Security

↓

PostgreSQL
```

Each layer provides independent protection.

---

# Authentication Policy

Authentication is provided exclusively by Supabase Authentication.

Supported authentication methods include:

Email / Password

Magic Link

OAuth Providers (Future)

Enterprise SSO (Future)

Multi-Factor Authentication (Future)

Passwords are never stored inside IRM Enterprise.

---

# Session Management

Every authenticated user receives a secure session.

Session rules include:

* Secure Cookies
* Automatic Token Refresh
* Session Expiration
* Logout on Session Revocation
* Device Validation (Future)

Inactive sessions should expire automatically according to organizational policy.

---

# Password Policy

When password authentication is enabled, recommended requirements include:

Minimum 12 characters

Uppercase letter

Lowercase letter

Number

Special character

Passwords must never be reused within the configured history period.

Password hashes are managed by Supabase Auth.

---

# Multi-Factor Authentication

Future versions should support:

Authenticator Applications

SMS Verification

Email Verification

Hardware Security Keys (FIDO2)

Biometric Authentication

MFA should be configurable by organization policy.

---

# API Security

Every API request must validate:

Authentication

↓

Authorization

↓

Role

↓

Permission

↓

Property Scope

↓

Ownership

↓

Business Rules

↓

RLS

↓

Execution

APIs never trust client-side validation.

---

# File Security

Uploaded files must satisfy:

* File Type Validation
* File Size Limits
* Virus Scanning (Future)
* Secure Storage
* Access through Authorization
* Audit Logging

Files are never exposed directly from storage without permission validation.

---

# Audit Policy

The following events must always generate audit records.

Login

Logout

Password Reset

Permission Changes

Role Assignment

Configuration Changes

Financial Approval

Visitor Approval

Rental Approval

Work Order Completion

File Upload

File Download

System Integration

---

# Encryption Policy

Sensitive information must be protected.

Encryption applies to:

API Keys

Access Tokens

Integration Credentials

Personal Information (where required)

Backup Archives

All communication uses HTTPS/TLS.

---

# Logging Policy

Application logs should include:

Timestamp

User

Property

Module

Action

Record Identifier

IP Address

User Agent

Result

Sensitive information must never appear in logs.

---

# Rate Limiting

Rate limiting should protect against abuse.

Examples

Login Attempts

Password Reset

API Requests

QR Validation

Visitor Registration

Public Endpoints

Organizations may configure limits based on operational requirements.

---

# Backup Policy

Production databases should support:

Daily Backups

Point-in-Time Recovery

Encrypted Storage

Disaster Recovery Testing

Retention Policies

Backup procedures must be documented separately.

---

# Incident Response

Security incidents should follow this process.

Detection

↓

Containment

↓

Investigation

↓

Recovery

↓

Root Cause Analysis

↓

Corrective Action

↓

Documentation

Every incident receives a unique incident identifier.

---

# Compliance

The security architecture is designed to support:

ISO 27001

OWASP ASVS

OWASP Top 10

SOC 2 (Future)

GDPR (Where Applicable)

PDPA Thailand

Additional regional compliance standards may be adopted without redesign.

---

# Security Reviews

Security reviews should be conducted:

Before Production Release

After Major Architectural Changes

After Security Incidents

At Regular Scheduled Intervals

Penetration testing should be performed before major releases.

---

# Future Security

Future enhancements include:

Zero Trust Networking

Hardware Security Keys

AI Threat Detection

Behavioral Analytics

Device Trust

Conditional Access

Security Information and Event Management (SIEM)

Enterprise Identity Providers

without changing the core RBAC architecture.

---

# Summary

Security within IRM Enterprise is enforced through multiple independent layers.

Authentication, Authorization, Ownership, Property Isolation, Audit Logging, and Row Level Security work together to provide enterprise-grade protection for business operations.


---

# Section 8 — Future Expansion

This section defines the long-term evolution strategy of the IRM Enterprise authorization architecture.

The RBAC model has been designed to evolve with the platform while preserving security, maintainability, and backward compatibility.

Future authorization features should extend the existing architecture rather than replacing it.

---

# Authorization Evolution

IRM Enterprise currently implements:

Authentication

↓

Role-Based Access Control (RBAC)

↓

Ownership Validation

↓

Property Isolation

↓

Row Level Security

Future versions will extend this model using additional authorization mechanisms.

---

# Attribute-Based Access Control (ABAC)

Future releases may introduce ABAC.

Authorization decisions may consider attributes such as:

User Department

Employment Status

Building Assignment

Work Shift

Emergency Status

Certification Level

Language

Business Unit

ABAC complements RBAC rather than replacing it.

---

# Context-Aware Authorization

Future authorization decisions may evaluate operational context.

Examples

Current Property

Current Building

Current Shift

Current Device

Network Location

Office Hours

Emergency Mode

System Maintenance Mode

Context is evaluated before permission is granted.

---

# Time-Based Permissions

Permissions may become active only during approved time periods.

Examples

Security Guard

22:00–06:00

Technician

08:00–17:00

Contractor

Temporary Access

Visitor

Limited Validity

Time-based permissions automatically expire.

---

# Temporary Permissions

Temporary permissions support operational flexibility.

Examples

Temporary Administrator

Acting Property Manager

Emergency Technician

External Auditor

Government Inspector

Temporary permissions always include:

Start Time

End Time

Reason

Approver

Audit Record

---

# Delegated Administration

Organizations may delegate selected administrative responsibilities.

Examples

Property Manager

↓

Office Supervisor

↓

Office Staff

Delegation remains limited to approved operational scope.

---

# External Partner Access

Future releases may support external organizations.

Examples

Cleaning Companies

Lift Maintenance

Internet Provider

Insurance Company

Fire Safety Contractor

Utility Provider

Each partner receives isolated permissions.

---

# API Authorization

Future public APIs will support scoped access.

Examples

Resident API

Visitor API

Work Order API

Finance API

Reporting API

Every API Token contains:

Organization

Property

Scope

Expiration

Issuer

Audit Identifier

---

# AI Agent Authorization

Future AI assistants must operate under explicit permissions.

Examples

Resident AI Assistant

Security AI

Maintenance AI

Finance AI

Reporting AI

Document AI

Every AI agent receives its own identity and role.

AI agents are never granted unrestricted administrator privileges.

---

# Multi-Tenant SaaS

Future SaaS deployments support complete tenant isolation.

Hierarchy

```text
Platform

↓

Organization

↓

Property

↓

Building

↓

Unit
```

Every tenant remains cryptographically isolated through application logic and Row Level Security.

---

# Regional Deployment

Future deployments support:

Country

↓

Region

↓

Organization

↓

Property

↓

Building

↓

Unit

Regional policies may override organization defaults where legally required.

---

# Enterprise Identity

Future authentication providers may include:

Microsoft Entra ID

Google Workspace

Okta

Auth0

Keycloak

National Digital Identity

Enterprise Single Sign-On

Authentication providers remain independent from authorization.

---

# Security Analytics

Future authorization events may feed security analytics.

Examples

Failed Login Trends

Permission Escalation

Suspicious Access

Impossible Travel

Repeated Authorization Failures

AI-based Threat Detection

These analytics improve proactive security monitoring.

---

# Policy Engine

Future releases may include a centralized policy engine.

Responsibilities

Permission Evaluation

Business Rules

Approval Rules

Delegation

Conditional Access

Context Evaluation

This enables authorization without modifying application code.

---

# Future Principles

Every authorization enhancement must satisfy:

Backward Compatibility

Auditability

Least Privilege

Property Isolation

Performance

Scalability

Documentation

Security by Design

---

# Chapter Summary

The RBAC architecture defines the authorization foundation of IRM Enterprise.

It establishes:

* Enterprise Roles
* Permission Matrix
* Module Permissions
* Data Ownership
* Property Isolation
* Approval Workflow
* Security Policies
* Future Authorization Strategy

Together with Authentication and Row Level Security, this architecture provides enterprise-grade authorization across every module of the platform.

All future modules, APIs, integrations, and user interfaces must comply with the authorization principles defined in this document.

Changes to the RBAC architecture require:

* Architecture Review
* Architecture Decision Record (ADR)
* Blueprint Update
* Security Review
* Regression Testing

This document is the authoritative reference for authorization within IRM Enterprise.
