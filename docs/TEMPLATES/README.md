# IRM Enterprise Module Templates

This directory contains the official module templates and architectural blueprints for IRM Enterprise. Every developer and agentic assistant must adhere strictly to these guidelines when designing, scaffolding, or implementing any business module in this codebase.

## Purpose

To maintain a consistent, predictable, and enterprise-grade architecture across all domains of the property management system. This structure ensures clean separation of concerns, high maintainability, testability, and standard interface contracts.

## Template Index

The following documentation templates define the requirements for each architectural layer:

1. **[Module Folder Structure](MODULE_FOLDER_STRUCTURE.md)**: The official layout and organization of files across the `features/`, `services/`, and `repositories/` directories.
2. **[Feature Module Template](FEATURE_MODULE.md)**: Standards for client-side UI, hooks, context, local types, and feature entry points.
3. **[Service Module Template](SERVICE_MODULE.md)**: Rules governing the Service Layer, transaction management, auditing, and business flow.
4. **[Repository Module Template](REPOSITORY_MODULE.md)**: Standards for data access encapsulation, Supabase operations, and query optimization.
5. **[Types Module Template](TYPES_MODULE.md)**: Guidelines for domain models, DTOs, and separating local module types from global shared types.
6. **[Module Checklist](MODULE_CHECKLIST.md)**: A complete, step-by-step checklist to verify that a module is production-ready before committing.
