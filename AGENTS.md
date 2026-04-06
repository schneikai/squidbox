# AGENTS.md

## Project Overview

This project is an Expo React Native application targeting iOS (for now).
It focuses on content creation, AI-assisted workflows, and media management.

The codebase follows a modular, component-driven architecture with an emphasis on:

- composability
- clear ownership boundaries
- minimal duplication
- predictable patterns

## File Organization

- One exported component or utility per file
- Small private helpers may live in the same file
- Keep related logic close to where it is used
- Avoid generic shared files unless truly reusable across features
- Prefer feature-based grouping over type-based grouping

## General Conventions

- Prefer readable and explicit code over clever abstractions
- Avoid premature abstraction — extract only when repetition is real
- Keep functions small and focused
- Prefer early returns to reduce nesting
- Use clear, intention-revealing naming
- Avoid unnecessary comments — code should explain itself
- Add comments only for non-obvious decisions or complex logic

## React

- Use function declarations for exported components
- Order inside components:
  1. hooks
  2. derived values
  3. handlers
  4. early returns
  5. JSX
- Move pure helper functions outside components when possible
- Keep components focused — avoid mixing unrelated concerns

## State & Logic

- Keep state as local as possible
- Lift state only when necessary
- Avoid deeply nested state
- Prefer explicit state transitions over implicit mutations
- Keep side effects isolated and predictable

## UI / Components

- Always prefer existing components from src/components before creating new ones
- Do not recreate UI patterns with styles — use components and composition
- Avoid spreading style objects (e.g. ...glass) in screens or features
- If a UI pattern repeats, extract or reuse a component instead of duplicating styles
- Keep component responsibilities clear:
  - components define appearance
  - parents define layout
- Do not use low-level primitives (e.g. raw TextInput, menu primitives) directly in features if a project component exists
- Keep UI abstractions simple — avoid over-generalization

## Naming

- Name by purpose, not appearance

Good:

- MenuButton
- Field
- SegmentedControl

Bad:

- RoundedBox
- GrayCard

## Code Quality

- Avoid dead code and unused styles
- Keep files concise and focused
- Prefer consistency over personal style preferences
- Refactor when patterns become clear — not before

## Non-Goals

- No premature abstraction
- No unnecessary indirection
- No duplication of existing patterns
- No over-engineering of simple features

## Summary

- Build through composition, not duplication
- Prefer clarity over cleverness
- Reuse existing patterns before introducing new ones
- Keep the codebase predictable and easy to reason about
