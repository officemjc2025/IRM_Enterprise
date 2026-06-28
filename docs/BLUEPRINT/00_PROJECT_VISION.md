# Chapter 00 — Project Vision

**Version:** 1.0.0

**Status:** Active

**Document Owner:** IRM Enterprise Architecture Team

---

# Vision

IRM Enterprise is a next-generation Property Management Platform designed to manage every aspect of residential, rental, security, maintenance, finance, and resident services within a single integrated ecosystem.

The platform aims to eliminate fragmented software by providing one unified enterprise solution for property organizations.

IRM Enterprise is designed to support condominiums, apartments, mixed-use developments, hotels, resorts, and multi-property organizations without requiring architectural redesign.

---

# Mission

Our mission is to build an enterprise-grade platform that connects every department within a property organization through a single source of truth.

The platform must improve operational efficiency, reduce manual work, increase transparency, and provide real-time information for management, staff, owners, tenants, and residents.

---

# Objectives

The primary objectives of IRM Enterprise are:

* Centralize all operational data.
* Reduce duplicated information.
* Standardize business workflows.
* Improve communication between departments.
* Enable automation of repetitive tasks.
* Support future business expansion.
* Provide mobile-first experiences.
* Integrate with third-party systems.

---

# Business Scope

IRM Enterprise consists of the following major business domains.

## Core Platform

Authentication

Authorization

Profiles

Settings

Notifications

Audit Logs

---

## Property Management

Properties

Buildings

Floors

Units

Facilities

Assets

Common Areas

Parking

Utility Meters

---

## Resident Management

Owners

Co-Owners

Residents

Tenants

Family Members

Emergency Contacts

Vehicles

Pets

Move-In

Move-Out

Occupancy

---

## Rental Management

Reservations

Guests

Rental Contracts

Housekeeping

Owner Stay

Revenue Sharing

Cleaning Schedule

Rental Reports

---

## Visitor Management

Visitor Registration

QR Check-In

QR Check-Out

Parking Access

Blacklist

Visitor History

Visitor Statistics

---

## Security Management

Gate Operations

Security Staff

Patrol

Incident Reports

Access Logs

Visitor Verification

Emergency Events

---

## Maintenance Management

Work Orders

Preventive Maintenance

Technicians

Inventory

Vendors

Service Contracts

Asset Maintenance

---

## Financial Integration

SoftBis Integration

Owner Statements

Payment Records

Invoice Mapping

Outstanding Fees

Financial Reports

---

## Communication

Announcements

Documents

Push Notifications

LINE OA

Email

SMS

Meeting Notifications

---

# Target Users

IRM Enterprise supports multiple user roles.

* Super Administrator
* Administrator
* Committee
* Security
* Technician
* Owner
* Co-Owner
* Tenant
* Resident
* Guest

Each role operates under Role-Based Access Control (RBAC).

---

# Product Philosophy

IRM Enterprise is designed using the following principles.

## Enterprise First

Every feature must support future expansion.

---

## Database First

Database architecture is designed before application development.

---

## Architecture First

Business architecture is established before coding.

---

## Security First

Every feature must follow security best practices.

---

## Mobile First

Every page must work seamlessly on phones, tablets, and desktop devices.

---

## Cloud Native

The platform is optimized for cloud deployment and scalable infrastructure.

---

## AI Assisted Development

The project is designed to be developed collaboratively with AI coding assistants following documented standards.

---

# Long-Term Vision

IRM Enterprise is not intended to be a condominium management application only.

It is intended to become a complete Enterprise Property Operating System capable of supporting:

* Single Condominium
* Multiple Condominiums
* Apartment Groups
* Hotels
* Resorts
* Mixed-Use Developments
* Property Management Companies
* Enterprise Organizations

without changing the underlying architecture.

---

# Success Criteria

IRM Enterprise will be considered successful when:

* All operational departments work from one platform.
* Data duplication is eliminated.
* Manual paperwork is significantly reduced.
* Real-time dashboards are available.
* Business processes are standardized.
* Future modules can be added without redesign.
* Third-party integrations can be implemented through standard interfaces.

---

# Guiding Principles

Every future development must satisfy these requirements.

* Business requirements before implementation.
* Blueprint before coding.
* Documentation before deployment.
* Architecture before optimization.
* Quality before quantity.
* Maintainability before shortcuts.
* Scalability before convenience.

---

# Blueprint Authority

This Project Vision defines the direction of the entire IRM Enterprise platform.

Every future module, database table, API, user interface, workflow, and business process must align with this vision.

Changes to this document require architectural review and should be recorded through the Architecture Decision Record (ADR) process.
