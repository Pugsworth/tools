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

### Image Upload
A consistent image upload component for all tools.

Images are to be uploaded using any of the following methods:
- Drag and drop
- Click to open file picker
- Paste from clipboard
- A URL to an image.
    This should open in a modal with a text input for the URL and a preview of the image.
    The modal should have a "Copy" button to copy the URL to the clipboard.
    There should not be verification of the URL by any known **image** file extensions as some urls may not have an extension.

### Modals
Modals shall be used for any content that is to be shown to the user momentarily or for information/controls that are not directly related to the main canvas.

- Modals shall have a close button in the top right corner.
- Modals shall have a title bar.

Modals will be of a couple different types:
- **Dialog**: A modal that is centered on the screen and takes up the full width of the screen.
    This shall be closed with `Escape` or clicking outside the modal or by clicking the close button.
    If this modal is one with a form, it shall be closed with the `Enter` key if `Enter` is a valid form of submission.
    There shall also be a `Save` and `Cancel` button at the bottom of the modal.
- **Drawer**: A modal that is attached to the right side of the screen and can be opened and closed.
- **Popup**: A modal that is present on the screen and does not inhibit the user from interacting with the rest of the page.
    This modal shall be able to be moved around the page by clicking and dragging the title bar.
    If this modal has input fields, `Escape` should not close the modal, but rather de-focus the input field.
    If an input field is focused, Enter shall confirm the value and unfocus the input field.
    `Tab` shall cycle through the input fields in the modal, but not cycle to the modal's buttons (like `Save` and `Cancel`).
    `Shift+Tab` shall cycle through the input fields in the modal in reverse order.
    

### EditorCanvas
A consistent editing canvas for all tools.

When a general area for images is needed for view/preview, or "editing", use this component.

**Behavior:**
- The ability to zoom and pan with with correction for image sizes and any drawn elements.
- Zoom shall always zoom towards the mouse cursor.
- There shall always be a way to reset the zoom and pan to the original state.
- Most of the time, left click will be for selection of elements and tools. Right click will be for context menus. Middle click will be for panning.
- Some tools may require marque selection. This shall be done by clicking and dragging with the left mouse button.
- The canvas shall be able to handle images of any size.



## Repository Structure

To ensure this visual language is shared across all tools:

1. **`master` branch**: Stores this `DESIGN.md` and a `shared/` directory with reference component implementations.
    Within the `shared/` directory, there should be a separation between **React** and **Vue** components.
2. **Templates**: `template/react` and `template/vue` should include these standard components by default.
