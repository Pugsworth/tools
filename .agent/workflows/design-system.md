---
description: Guidelines for implementing the Pugsworth Design System in new tools
---

# Pugsworth Design System Workflow

When creating new tools or components, ALWAYS follow these design guidelines.

## Visual Language

1.  **Colors**:
    - Use `bg-slate-950` for the main canvas background.
    - Use `bg-slate-900` for sidebars and panels.
    - Use `border-slate-800` for borders.
    - Use `text-slate-200` for primary text and `text-slate-400` for secondary text.
    - Use `bg-gradient-to-br from-indigo-500 to-purple-600` for primary actions/buttons.

2.  **Typography**:
    - Use standard sans-serif fonts (Inter/system-ui).
    - Use `text-xs` for labels/tooltips.
    - Use `text-sm` for standard UI text.

3.  **Components**:
    - **ToolButton**: Use the standard pattern for sidebar buttons:
      ```tsx
      <button className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all">
        <Icon size={20} />
      </button>
      ```
    - **Modals**: Use `bg-slate-900` with `border-slate-700` and `shadow-2xl`.

## Implementation Steps

1.  Check `DESIGN.md` in the root for the latest standards.
2.  Check `shared/components` for reusable components before building from scratch.
3.  Ensure all interactive elements have hover states and transitions (`transition-all duration-200`).
