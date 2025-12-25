# Pugsworth Design System

This document defines the visual language and standard component patterns for all tools in the Pugsworth repository.

## Visual Language

### Colors
- **Primary**: Indigo/Purple gradient (`from-indigo-500 to-purple-600`) for main actions.
- **Background**: `bg-slate-950` for the main canvas, `bg-slate-900` for sidebars.
- **Borders**: `border-slate-800` or `border-slate-700`.
- **Text**: `text-slate-200` (primary), `text-slate-400` (secondary).

### Typography
- **Font**: Sans-serif (Inter/system-ui).
- **Sizes**: `text-xs` for tooltips/labels, `text-sm` for UI text, `text-lg` for headers.

## Standard Components

### ToolButton
A consistent button for sidebar tools with tooltips and shortcuts.

**Props:**
- `active`: boolean
- `icon`: Lucide icon component
- `onClick`: function
- `label`: string
- `shortcut`: string

**Behavior:**
- Hover shows a tooltip with the label and shortcut.
- Active state uses `bg-blue-600` and a shadow.

## Repository Structure

To ensure this visual language is shared across all tools:

1. **`master` branch**: Stores this `DESIGN.md` and a `shared/` directory with reference component implementations.
2. **Templates**: `template/react` and `template/vue` should include these standard components by default.
