# IRM Enterprise System Architecture

Version: 1.0

Status: Draft

Last Updated: 25 June 2026

Project Owner: Metro Admin

Technical Architect: ChatGPT

---

# 1. Project Vision

IRM Enterprise (Integrated Resident Management) is a modern Property Management Platform designed for condominium, apartment, hotel residence, mixed-use buildings, and property management companies.

The system aims to centralize all operational activities into a single platform.

Core objectives include:

* Resident Management
* Property Management
* Rental Management
* Visitor Management
* Work Order Management
* Security Operations
* Financial Reporting
* Owner Portal
* Resident Portal
* Staff Operations

The platform is designed to support future expansion into a SaaS Property Management solution.

---

# 2. Design Principles

The architecture follows these principles:

* Enterprise First
* Modular Architecture
* Reusable Components
* Scalable Design
* Security by Default
* Mobile First
* Responsive UI
* Multi-language Ready
* Cloud Native
* Documentation Driven Development

---

# 3. Technology Stack

Frontend

* Next.js (App Router)
* TypeScript
* Tailwind CSS

Backend

* Supabase
* PostgreSQL
* Supabase Auth
* Supabase Storage

Deployment

* Vercel

Version Control

* Git
* GitHub

AI Assisted Development

* ChatGPT
* GitHub Copilot
* Gemini CLI

---

# 4. High Level Architecture

Client

↓

Next.js Application

↓

Business Modules

↓

Shared Components

↓

Supabase API

↓

PostgreSQL Database

↓

Storage

↓

Notifications

---

# 5. Folder Structure

app/

Application routing

components/

Reusable UI Components

modules/

Business Modules

shared/

Shared utilities

providers/

React Providers

hooks/

Reusable Hooks

messages/

Multi-language resources

types/

Global Types

docs/

Project Documentation

blueprints/

Architecture Blueprints

prompts/

AI Prompt Library

---

# 6. Core Modules

The first production release includes:

Property Management

Resident Management

Rental Management

Work Order Management

Visitor Management

Security Management

Reports & Dashboard

Administration

---

# 7. User Roles

Super Administrator

Property Manager

Committee

Reception

Security Guard

Technician

Owner

Co-owner

Tenant

Resident

Guest

---

# 8. Internationalization

The platform supports:

Thai

English

Additional languages can be added in future without architectural changes.

---

# 9. Authentication

Authentication will be handled by Supabase Auth.

Supported methods

Email

Google

Microsoft

Future

LINE Login

Single Sign-On

---

# 10. Authorization

Role Based Access Control (RBAC)

Every page

Every API

Every Module

Every Action

must verify permissions.

---

# 11. Database Philosophy

Every table must include:

id

created_at

updated_at

created_by

updated_by

Optional

deleted_at

deleted_by

Soft Delete is preferred.

---

# 12. Coding Philosophy

Business Logic must never live inside UI Components.

UI Components must remain reusable.

Business Rules belong to Modules.

Shared utilities belong inside shared/.

---

# 13. Documentation Philosophy

Documentation is part of the product.

Every major feature requires:

Architecture

Database Design

API Design

UI Design

Review Notes

Sprint Log

---

# 14. Git Workflow

Main Branch

main

Development

develop

Feature Branches

feature/property

feature/resident

feature/rental

feature/work-order

feature/security

feature/dashboard

---

# 15. Commit Convention

IRM-001 feat(layout): dashboard foundation

IRM-002 feat(i18n): language system

IRM-003 feat(auth): authentication

IRM-004 feat(property): property module

---

# 16. Development Workflow

Architecture

↓

Blueprint

↓

Documentation

↓

Implementation

↓

Review

↓

Testing

↓

Commit

↓

Release

---

# 17. Long-term Vision

IRM Enterprise is designed to become a complete enterprise-grade property management ecosystem supporting:

Residential Condominium

Apartment

Hotel Residence

Rental Business

Vacation Rental

Property Management Company

Multi-Project Management

Cloud SaaS Platform

---

End of Document
