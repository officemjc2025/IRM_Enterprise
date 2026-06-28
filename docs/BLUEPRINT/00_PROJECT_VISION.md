# IRM Enterprise

## Chapter 00 — Project Vision

Version: 1.0

Status: Draft

Author: IRM Enterprise Architecture Team

---

# 1. Vision

IRM Enterprise is an Enterprise Property Management Platform designed for condominium, apartment, hotel, mixed-use property, and rental management.

The objective is to create a modern platform capable of managing all operational processes within a property organization using a single integrated system.

The platform is designed to be modular, scalable, secure, and cloud-native.

---

# 2. Mission

The mission of IRM Enterprise is to replace fragmented operational tools with a unified enterprise platform that provides:

* Property Management
* Resident Management
* Rental Management
* Visitor Management
* Security Operations
* Maintenance & Work Orders
* Accounting Integration
* Business Intelligence
* Mobile First Experience

---

# 3. Long-Term Goal

IRM Enterprise aims to become the central operating platform for property management organizations.

The system must support:

* Single Property
* Multiple Properties
* Property Groups
* Franchise Operations
* Enterprise Organizations

without redesigning the architecture.

---

# 4. Core Principles

Every module must follow these principles.

## 4.1 Single Source of Truth

Each business entity must have only one authoritative source.

Examples:

* One resident profile
* One unit record
* One ownership record

No duplicated business data.

---

## 4.2 Modular Architecture

Every business module must be independent.

Modules communicate through services and repositories.

Direct coupling between modules is prohibited.

---

## 4.3 Enterprise Scalability

Every design decision must support future growth.

The architecture must scale from:

50 Units

to

50,000 Units

without redesign.

---

## 4.4 Cloud Native

IRM Enterprise is designed primarily for cloud deployment.

Supported platforms:

* Supabase
* Vercel
* Docker
* Kubernetes

---

## 4.5 Mobile First

Every screen must be usable on:

Desktop

Tablet

Mobile

without creating separate applications.

---

# 5. Business Domains

The platform consists of the following major domains.

## Core

Authentication

Authorization

Profiles

Settings

Notifications

Audit Logs

---

## Property

Properties

Buildings

Floors

Units

Facilities

Assets

---

## Resident

Owners

Co-Owners

Residents

Tenants

Family Members

Emergency Contacts

Vehicles

Pets

---

## Rental

Reservations

Contracts

Guests

Housekeeping

Owner Revenue

Rental Reports

---

## Visitor

Visitor Registration

QR Check-In

Parking

Gate Access

Visitor History

Blacklist

---

## Security

Security Guards

Incident Reports

Patrol

Access Logs

Visitor Control

---

## Maintenance

Work Orders

Preventive Maintenance

Technicians

Inventory

Vendors

Service Contracts

---

## Finance

Accounting Integration

Invoice Mapping

Payment Records

SoftBis Integration

Owner Statements

---

## Communication

Announcements

Push Notifications

LINE OA

Email

SMS

Documents

---

# 6. Technology Stack

Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

Backend

* Supabase

Authentication

* Supabase Auth

Database

* PostgreSQL

Storage

* Supabase Storage

Deployment

* Vercel

---

# 7. Development Philosophy

Every implementation must follow these rules.

1. Database First

2. Architecture First

3. Repository Pattern

4. Service Layer

5. Reusable Components

6. Strict TypeScript

7. Security by Design

8. Mobile First

9. Performance First

10. AI Assisted Development

---

# 8. AI Development Strategy

The project is designed to be developed collaboratively with AI systems.

ChatGPT is responsible for:

* Enterprise Architecture
* Database Design
* System Design
* Blueprint
* Code Review
* Quality Assurance

Coding assistants (such as Antigravity or similar tools) are responsible for implementing code that conforms to this blueprint.

No generated code should intentionally violate the architectural decisions documented here.

---

# 9. Definition of Done

A feature is considered complete only when:

* Business requirements are implemented.
* TypeScript passes.
* ESLint passes.
* Production build succeeds.
* Repository Pattern is maintained.
* Service Layer is maintained.
* Documentation is updated.
* Git history remains clean.

---

# 10. Blueprint Authority

This Blueprint is the primary reference for the entire IRM Enterprise project.

Whenever there is a conflict between source code and documentation, the architecture described in this Blueprint shall be reviewed first, and any intentional architectural change must be reflected in this document.

All future modules must conform to this Blueprint.
