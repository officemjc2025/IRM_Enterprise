# Chapter 05 — API Standard

**Version:** 1.0.0

**Status:** Active

**Owner:** IRM Enterprise Architecture Team

---

# Overview

This document defines the API architecture standards for IRM Enterprise.

The objective is to establish a single, consistent approach for designing, implementing, securing, and maintaining APIs across the entire platform.

Every module, regardless of implementation technology, must comply with these standards.

---

# Objectives

The API architecture is designed to provide:

* Consistency
* Maintainability
* Security
* Scalability
* Testability
* Reusability
* AI-Friendly Development

---

# API Philosophy

IRM Enterprise follows:

Business Requirement

↓

Database

↓

Repository

↓

Service

↓

API

↓

Frontend

The API is not responsible for business logic.

Business logic belongs exclusively to the Service Layer.

---

# API Architecture

```text
Frontend

↓

API Route

↓

Service

↓

Repository

↓

Supabase

↓

PostgreSQL
```

Each layer has a single responsibility.

---

# Architectural Principles

Every API must follow:

Single Responsibility Principle

Stateless Design

RESTful Naming

Consistent Responses

Centralized Error Handling

RBAC Authorization

Property Isolation

Audit Logging

Type Safety

No business rules inside controllers.

---

# Supported API Types

Current

REST API

Future

GraphQL

Internal RPC

Webhook

Background Jobs

Public API

Mobile API

All future API styles must preserve the same architectural principles.

---

# API Versioning

API versions should use URL versioning.

Example

```text
/api/v1/residents

/api/v1/work-orders

/api/v1/visitors
```

Breaking changes require a new API version.

---

# API Design Goals

Every endpoint should be:

Predictable

Discoverable

Self-descriptive

Backward Compatible

Easy to test

Easy to document

Easy to secure


---

# Section 1 — API Naming Standard

Consistent API naming improves readability, maintainability, and discoverability.

Every endpoint should represent a business resource rather than an implementation detail.

---

# Resource Naming

Use plural nouns.

Examples

```text
/api/v1/residents

/api/v1/owners

/api/v1/units

/api/v1/visitors

/api/v1/work-orders

/api/v1/invoices
```

Avoid verbs in endpoint names.

Incorrect

```text
/createResident

/getResident

/deleteVisitor
```

Correct

```text
POST   /api/v1/residents

GET    /api/v1/residents

DELETE /api/v1/visitors/{id}
```

---

# HTTP Methods

Use HTTP methods according to their intended purpose.

| Method | Purpose             |
| ------ | ------------------- |
| GET    | Read                |
| POST   | Create              |
| PATCH  | Partial Update      |
| PUT    | Full Replace (Rare) |
| DELETE | Soft Delete         |

---

# Resource Identifier

Use UUID identifiers.

Example

```text
GET /api/v1/residents/{residentId}
```

Never expose database row numbers.

---

# Nested Resources

Nested resources should reflect business relationships.

Examples

```text
GET /api/v1/units/{unitId}/residents

GET /api/v1/units/{unitId}/owners

GET /api/v1/residents/{residentId}/vehicles

GET /api/v1/residents/{residentId}/visitors
```

Avoid excessive nesting.

Maximum recommended depth:

```text
3 Levels
```

---

# Action Endpoints

Business actions that cannot be represented by CRUD may use action endpoints.

Examples

```text
POST /api/v1/work-orders/{id}/assign

POST /api/v1/work-orders/{id}/complete

POST /api/v1/reservations/{id}/approve

POST /api/v1/visitors/{id}/check-in

POST /api/v1/visitors/{id}/check-out
```

Action names should be concise and business-oriented.

---

# URL Rules

URLs should:

* Use lowercase characters.
* Use hyphens for multiple words.
* Avoid underscores.
* Avoid file extensions.
* Avoid implementation details.

Correct

```text
/work-orders
```

Incorrect

```text
/work_orders

/WorkOrders

/getWorkOrders.php
```

---

# Query Parameters

Query parameters should be used for filtering rather than resource identification.

Examples

```text
GET /api/v1/residents?status=active

GET /api/v1/work-orders?priority=high

GET /api/v1/visitors?date=2026-07-01
```

---

# Sorting

Sorting uses the following format.

```text
?sort=created_at

?sort=-created_at

?sort=name

?sort=-priority
```

The minus sign indicates descending order.

---

# Searching

Global text search uses:

```text
?q=john
```

Search should support business-relevant fields.

---

# Filtering

Examples

```text
?status=active

?property=metro-jomtien

?building=A

?floor=12

?unit=1205
```

Filters may be combined.

---

# Date Range

Date filters follow ISO-8601.

Example

```text
?from=2026-07-01

&to=2026-07-31
```

---

# Pagination

Standard pagination.

```text
?page=1

&pageSize=25
```

Maximum page size should be configurable.

---

# API Naming Principles

Every endpoint should satisfy:

Predictable

Consistent

RESTful

Business-Oriented

Versioned

Stable

---

# Summary

The API Naming Standard establishes a consistent contract across every module of IRM Enterprise.

Following these conventions enables reusable frontend code, automated documentation, easier testing, and AI-assisted development without ambiguity.


---

# Section 2 — Request & Response Standard

Every API within IRM Enterprise must return responses using a consistent structure.

Consistent responses simplify frontend development, improve debugging, and enable AI-assisted code generation.

---

# Response Philosophy

Every API response should answer:

* Was the request successful?
* What happened?
* What data was returned?
* Is additional information available?

---

# Success Response

Standard success response

```json
{
  "success": true,
  "message": "Resident created successfully.",
  "data": {}
}
```

Required fields

| Field   | Description            |
| ------- | ---------------------- |
| success | Boolean result         |
| message | Human-readable message |
| data    | Business data          |

---

# Collection Response

When returning multiple records:

```json
{
  "success": true,
  "message": "Residents retrieved successfully.",
  "data": [],
  "pagination": {}
}
```

Pagination information should be included only when applicable.

---

# Pagination Object

```json
{
  "page": 1,
  "pageSize": 25,
  "totalItems": 245,
  "totalPages": 10
}
```

---

# Empty Response

When no records exist:

```json
{
  "success": true,
  "message": "No residents found.",
  "data": []
}
```

An empty result is not considered an error.

---

# Create Response

POST requests return the created resource.

```json
{
  "success": true,
  "message": "Resident created successfully.",
  "data": {
    "id": "uuid"
  }
}
```

---

# Update Response

PATCH requests return the updated resource.

```json
{
  "success": true,
  "message": "Resident updated successfully.",
  "data": {}
}
```

---

# Delete Response

IRM Enterprise uses Soft Delete.

Example

```json
{
  "success": true,
  "message": "Resident deleted successfully."
}
```

Deleted resources remain in the database.

---

# Request Body

Request bodies should contain only business data.

Avoid:

* Metadata
* UI State
* Display-only values

Example

```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "0812345678"
}
```

---

# PATCH Requests

PATCH updates only supplied fields.

Missing fields remain unchanged.

---

# PUT Requests

PUT replaces the entire resource.

Use only when full replacement is required.

PATCH is preferred.

---

# Date Format

All dates use ISO-8601.

Example

```text
2026-07-15T14:30:00Z
```

Timezones should always be explicit.

---

# UUID Format

Identifiers use UUID.

Example

```text
f6d59b9d-5c90-4b7c-9c4a-53af45c39b41
```

Sequential numeric IDs should never be exposed publicly.

---

# Boolean Values

Always use JSON boolean values.

Correct

```json
true
false
```

Incorrect

```text
"true"

"false"

1

0
```

---

# Null Handling

Use null only when a value is intentionally unknown.

Prefer empty arrays over null collections.

Correct

```json
[]
```

Incorrect

```json
null
```

---

# Metadata

Optional metadata may be returned.

Example

```json
{
  "metadata": {
    "generatedAt": "2026-07-15T12:00:00Z",
    "version": "1.0"
  }
}
```

---

# Response Consistency

Every endpoint should follow identical response patterns.

The frontend should never need custom parsing logic for individual modules.

---

# Summary

A consistent Request & Response structure enables reusable frontend components, easier testing, standardized API documentation, and significantly improves AI-assisted development by eliminating ambiguity.


---

# Section 3 — Error Handling Standard

Every API must return predictable, structured, and machine-readable errors.

Error responses should help developers diagnose problems while providing end users with clear and understandable messages.

Internal implementation details must never be exposed.

---

# Error Philosophy

Every error should answer:

* What happened?
* Why did it happen?
* Can the user fix it?
* Can the developer identify it?

---

# Standard Error Response

Every failed request returns:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Room number is required."
  }
}
```

---

# Error Object

| Field   | Description                 |
| ------- | --------------------------- |
| code    | Machine-readable error code |
| message | Human-readable message      |

Optional fields

```json
{
  "details": {},
  "traceId": "uuid"
}
```

---

# Standard Error Codes

Authentication

```text
UNAUTHORIZED

INVALID_CREDENTIALS

SESSION_EXPIRED

TOKEN_INVALID
```

Authorization

```text
FORBIDDEN

INSUFFICIENT_PERMISSION

PROPERTY_ACCESS_DENIED

OWNERSHIP_REQUIRED
```

Validation

```text
VALIDATION_ERROR

INVALID_INPUT

REQUIRED_FIELD

INVALID_DATE
```

Business

```text
RESOURCE_NOT_FOUND

DUPLICATE_RECORD

BUSINESS_RULE_VIOLATION

RESOURCE_LOCKED
```

System

```text
INTERNAL_SERVER_ERROR

DATABASE_ERROR

NETWORK_ERROR

SERVICE_UNAVAILABLE

UNKNOWN_ERROR
```

---

# HTTP Status Codes

Use standard HTTP status codes.

| Status | Meaning               |
| ------ | --------------------- |
| 200    | Success               |
| 201    | Created               |
| 204    | No Content            |
| 400    | Bad Request           |
| 401    | Unauthorized          |
| 403    | Forbidden             |
| 404    | Not Found             |
| 409    | Conflict              |
| 422    | Validation Error      |
| 500    | Internal Server Error |
| 503    | Service Unavailable   |

Avoid inventing custom HTTP status codes.

---

# Validation Errors

Multiple validation failures should be returned together.

Example

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed.",
    "details": {
      "roomNumber": "Room number is required.",
      "phone": "Invalid phone number."
    }
  }
}
```

---

# Business Errors

Business rule failures should use meaningful codes.

Examples

```text
ROOM_ALREADY_OCCUPIED

VISITOR_ALREADY_CHECKED_IN

WORK_ORDER_ALREADY_COMPLETED

UNIT_NOT_AVAILABLE
```

Business errors should never be reported as server errors.

---

# Authentication Errors

Expired or invalid sessions return:

```text
401 Unauthorized
```

The frontend should redirect users to the login page when appropriate.

---

# Authorization Errors

Permission failures return:

```text
403 Forbidden
```

The response should not reveal sensitive information.

---

# Not Found

When a requested resource does not exist:

```text
404 Not Found
```

The response should not disclose whether the resource ever existed.

---

# Internal Errors

Unexpected failures return:

```text
500 Internal Server Error
```

Internal exception details must never be exposed to clients.

Detailed logs should remain on the server.

---

# Logging

Every server error should generate:

Timestamp

User

Module

API Endpoint

HTTP Method

Property

Request ID

Error Code

Stack Trace (Internal Only)

---

# Trace Identifier

Future versions should include a Trace ID.

Example

```json
{
  "traceId": "5b3c7f8c..."
}
```

This simplifies troubleshooting across distributed systems.

---

# Error Message Principles

Messages should be:

Clear

Actionable

Consistent

Non-technical

Localized when applicable

Avoid exposing database names, SQL errors, or stack traces.

---

# Summary

A standardized error model improves developer productivity, frontend consistency, API documentation, monitoring, and AI-assisted development while protecting sensitive implementation details.

---

# Section 4 — Authentication Standard

Authentication verifies the identity of every user before access to business resources is granted.

IRM Enterprise delegates identity management to Supabase Authentication while enforcing application-specific authorization through the Service Layer and RBAC.

---

# Authentication Flow

Every authenticated request follows this sequence.

```text id="authflow1"
Client

↓

Login

↓

Supabase Authentication

↓

JWT Access Token

↓

API Request

↓

Middleware

↓

Service Layer

↓

Repository

↓

Database
```

Authentication must always occur before authorization.

---

# Supported Authentication Methods

Current

* Email / Password

Planned

* Magic Link
* Google OAuth
* Microsoft Entra ID
* LINE Login
* Apple Sign In
* Multi-Factor Authentication (MFA)

All authentication providers must produce a valid authenticated session before accessing business APIs.

---

# Session Management

Every authenticated user receives:

* Access Token
* Refresh Token
* Session Identifier

Session refresh should occur automatically without requiring the user to log in again.

Expired sessions should redirect users to the Login page.

---

# JWT Token Usage

Every authenticated API request must include a valid JWT.

Example

```text id="jwt1"
Authorization: Bearer <access_token>
```

Tokens must never be passed through URL parameters.

---

# Protected Endpoints

Unless explicitly marked as public, every endpoint requires authentication.

Examples

Protected

```text id="protected1"
GET /api/v1/residents

POST /api/v1/work-orders

PATCH /api/v1/owners/{id}
```

Public

```text id="public1"
POST /api/v1/auth/login

POST /api/v1/auth/forgot-password

POST /api/v1/auth/reset-password
```

---

# Authentication Failure

If authentication fails:

Return

```text id="authfail1"
401 Unauthorized
```

Standard response

```json id="authjson1"
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication is required."
  }
}
```

---

# Session Expiration

Expired sessions return:

```text id="expire1"
401 Unauthorized
```

The frontend should:

* Attempt session refresh.
* Redirect to Login if refresh fails.

---

# Logout

Logout should:

* Invalidate the current session.
* Remove local authentication data.
* Redirect to the Login page.
* Record an Audit Log entry.

---

# Password Management

Passwords are managed exclusively by Supabase Auth.

IRM Enterprise must never:

* Store passwords.
* Hash passwords manually.
* Log passwords.
* Expose passwords through APIs.

---

# Audit Events

Authentication events should generate audit records.

Examples

Login

Logout

Failed Login

Password Reset

Password Change

Session Expired

Token Revoked

---

# Future Authentication

Future versions may support:

* Single Sign-On (SSO)
* Hardware Security Keys
* Biometric Authentication
* Device Trust
* Adaptive Authentication
* Risk-Based Authentication

The authentication architecture should remain provider-independent.

---

# Summary

Authentication confirms user identity before access to any protected resource.

Identity management is delegated to Supabase Authentication, while authorization and business rules remain the responsibility of IRM Enterprise.

---

# Section 5 — Authorization Standard

Authorization determines what an authenticated user is permitted to access.

Authentication verifies identity.

Authorization verifies permission.

These responsibilities must remain separate.

---

# Authorization Flow

Every protected request follows this sequence.

```text
Authentication

↓

Role Validation

↓

Permission Validation

↓

Property Assignment

↓

Ownership Validation

↓

Business Rules

↓

Repository

↓

Database Row Level Security
```

Every step must succeed before access is granted.

---

# Authorization Source

Authorization is determined using:

* User Role
* Assigned Permissions
* Property Assignment
* Resource Ownership
* Business Rules

No permission should be inferred from the frontend.

---

# RBAC Integration

API authorization follows the RBAC Blueprint.

Every endpoint must validate:

Role

↓

Permission

↓

Property

↓

Ownership

↓

RLS

Authorization logic must remain centralized.

---

# Property Isolation

Every request must be limited to the user's assigned property unless explicitly authorized.

Example

Property Manager

↓

Metro Jomtien

↓

Can access only Metro Jomtien records.

---

# Ownership Validation

Ownership must be verified after permission checks.

Examples

Resident

↓

Own Profile

Owner

↓

Owned Units

Technician

↓

Assigned Work Orders

Security Guard

↓

Assigned Gate Operations

---

# Permission Examples

Residents

Read own profile

Update own profile

Create maintenance request

View own reservations

Owners

View owned units

View owner statements

Manage owner stay

Security

Register visitors

Check visitors in

Check visitors out

View gate history

Administrators

Manage all business modules according to assigned scope.

---

# Authorization Failure

When permission is denied:

Return

```text
403 Forbidden
```

Example

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action."
  }
}
```

Avoid revealing unnecessary information.

---

# Database Enforcement

Authorization is enforced twice.

Application Layer

↓

Supabase Row Level Security

The database remains the final security boundary.

---

# Audit Logging

Permission-sensitive operations should generate audit records.

Examples

Role Change

Permission Update

Financial Approval

Rental Approval

Configuration Change

Audit logs should include:

User

Role

Action

Module

Property

Timestamp

---

# Future Authorization

Future enhancements include:

Attribute-Based Access Control

Time-Based Permissions

Temporary Permissions

Delegated Administration

Context-Aware Authorization

Enterprise Policy Engine

These extensions should integrate with the existing RBAC architecture.

---

# Summary

Authorization ensures that authenticated users access only the resources they are permitted to use.

It combines RBAC, Property Isolation, Ownership Validation, Business Rules, and Row Level Security to provide enterprise-grade protection.

---

# Section 6 — Validation Standard

Validation protects the integrity of business data before it reaches the database.

Validation should occur at multiple layers.

---

# Validation Layers

```text
Client

↓

API

↓

Service

↓

Repository

↓

Database Constraints
```

Each layer performs validation appropriate to its responsibility.

---

# Client Validation

Client-side validation improves user experience.

Examples

Required fields

Email format

Phone format

Date format

Number ranges

Client validation must never replace server validation.

---

# API Validation

The API validates:

Required fields

Data types

JSON format

UUID format

Request schema

Invalid requests return

```text
422 Validation Error
```

---

# Business Validation

Business rules belong inside the Service Layer.

Examples

Room already occupied

Duplicate reservation

Visitor already checked in

Maximum parking exceeded

Business validation should never be implemented inside repositories.

---

# Database Validation

The database validates:

Primary Keys

Foreign Keys

Unique Constraints

Check Constraints

Row Level Security

Database constraints provide the final integrity check.

---

# Validation Messages

Validation errors should be:

Consistent

Readable

Actionable

Localized where appropriate

Avoid technical terminology.

---

# Summary

Validation protects business integrity.

Each layer performs its own responsibility, preventing invalid data while maintaining a clear separation of concerns.

# Section 7 — Pagination & Filtering

Large datasets must support standardized pagination and filtering.

The same query parameters should behave consistently across every API.

---

# Pagination

Standard parameters

```text
?page=1

&pageSize=25
```

Recommended page sizes

10

25

50

100

Maximum page size should be configurable by the server.

---

# Pagination Response

```json
{
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "totalItems": 248,
    "totalPages": 10
  }
}
```

---

# Searching

Global text search

```text
?q=metro
```

Search should cover business-relevant fields only.

---

# Filtering

Standard filtering

```text
?status=active

?propertyId=uuid

?buildingId=uuid

?unitId=uuid
```

Multiple filters may be combined.

---

# Sorting

Ascending

```text
?sort=name
```

Descending

```text
?sort=-createdAt
```

The minus (-) prefix indicates descending order.

---

# Date Range

Use ISO-8601 dates.

```text
?from=2026-07-01

&to=2026-07-31
```

---

# Response Consistency

Pagination, filtering, and sorting should behave identically across all business modules.

---

# Section 8 — API Security

Every API is protected using multiple security layers.

---

# Security Layers

```text
HTTPS

↓

Authentication

↓

Authorization

↓

Validation

↓

Service

↓

Repository

↓

Row Level Security

↓

Database
```

---

# Security Principles

Every endpoint should:

Require HTTPS.

Validate authentication.

Validate authorization.

Validate ownership.

Respect Property Isolation.

Generate audit logs for sensitive operations.

---

# Sensitive Operations

The following operations should always be audited.

Login

Logout

Role Changes

Permission Changes

Financial Operations

Configuration Changes

Data Export

Bulk Operations

---

# Rate Limiting

Future implementations should support rate limiting for:

Authentication

Password Reset

Public APIs

File Upload

QR Validation

---

# API Logging

Every request should record:

Timestamp

User

Method

Endpoint

Status Code

Duration

Property

Trace Identifier

---

# Summary

API Security is enforced through layered protection.

No single layer should be trusted independently.

---

# Section 9 — API Documentation

Every API must be documented.

Documentation should remain synchronized with implementation.

---

# Documentation Requirements

Each endpoint should describe:

Purpose

Request

Response

Authentication

Permissions

Validation Rules

Error Codes

Examples

---

# OpenAPI

Future releases should generate OpenAPI specifications automatically.

Swagger UI may be used for interactive testing.

---

# API Examples

Every endpoint should include:

Successful Request

Successful Response

Validation Error

Authorization Error

Business Error

---

# Version History

Breaking API changes require:

New Version

Migration Guide

Deprecation Notice

Documentation Update

---

# Summary

API documentation is considered part of the product.

Undocumented APIs are incomplete APIs.

---

# Section 10 — Future Expansion

Future API capabilities include:

GraphQL

Webhooks

Server Sent Events

Real-time APIs

Background Jobs

Batch Processing

Public Developer API

Mobile SDK

Enterprise Integration

These features should extend the existing architecture without breaking compatibility.

---

# Chapter Summary

This chapter defines the API standards for IRM Enterprise.

It establishes:

• REST conventions

• Naming standards

• Request & Response models

• Error handling

• Authentication

• Authorization

• Validation

• Pagination

• API Security

• Documentation

• Future expansion

Every API implemented within IRM Enterprise must follow these standards.

This document serves as the authoritative reference for API development across the platform.
