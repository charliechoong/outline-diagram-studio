# Outline — Diagram studio

A browser-based diagram editor with shapes, connectors, text, sticky notes, emojis, a saved-creations gallery, and full-screen editing.

## Source files

- `dist/index.html`: the app layout.
- `dist/style.css`: styling and responsive/full-screen layouts.
- `dist/app.js`: editor interactions and browser-local persistence.
- `.openai/hosting.json`: the existing private Sites project and static hosting configuration.

The `dist` directory is the source as well as the deployable app; no build step or dependencies are required.

## Run locally

From this repository, run:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4173. Check JavaScript syntax with `node --check dist/app.js`.

## Editing and saving

Use the Full screen button in the canvas bar to expand the editor. Save and all editing tools remain available. Use Exit full screen or Escape to return. In embedded browsers without native fullscreen, the editor expands to fill its browser panel.

Edits autosave after a short pause, with a recovery snapshot written as changes happen. The last active board is restored when reopening the app. Creations are saved in localStorage in the current browser on the current device. They are not synced across devices or included in Git. SVG export creates a standalone copy of a diagram.

## Resize elements and remove arrows

Select any icon or shape to show its eight resize handles. Drag a corner or any boundary to resize. Icons scale proportionally. Resizing is undoable and retained when saving a creation.

Click an arrow to select it, then press Delete/Backspace or click Delete arrow in the bottom toolbar. This removes only the relationship; its shapes remain. Undo restores the arrow.

## Select multiple components

Hold Shift (or Command/Ctrl) while clicking to add or remove components from the selection. Drag blank canvas to box-select shapes, icons, and text. Hold Shift while box-selecting to add to an existing selection. Command/Ctrl+A selects every canvas element.

Drag any selected component to move the selected group together. Delete/Backspace or the Delete button removes all selected components and any arrows attached to deleted shapes. Undo restores the entire action. Duplicate copies selected shapes and their internal connections.

Use the Hand tool or hold Space while dragging to pan the canvas.

## Arrange and group

Snap is enabled by default for dragging. Toggle Snap or hold Alt while dragging to bypass snapping. Nearby components show alignment guides. Arrange provides six alignment options and equal horizontal/vertical spacing.

Select two or more components and choose Arrange > Group to keep them together across deselection and reopening. Shift-click toggles a whole group; Alt-click selects an individual member for editing. Arrange > Ungroup separates a group. Alignment treats each group as a single item.

## Pinned creations and daily planners

In My creations, click Pin on a card to keep it at the top. The Pinned filter shows only favorites. Pins are stored with each creation in this browser.

Use Add daily planner in the floating toolbar for a structured card with an editable title and separate Morning, Afternoon, and Night task lists. Type one task per line. Entries autosave, can be undone, and appear in gallery previews and SVG exports. Drag the card by its grip or outer boundary; resize it with the standard selection handles.

## Daily viewing mode

Opening a creation from My creations now opens a full-page, read-only page. Planner-only creations display as spacious Morning, Afternoon, and Night columns with all entries visible. Other diagrams retain their layout directly on the page, without a framed canvas. The page height follows the content, with discreet zoom controls below the creation and normal page scrolling.

Use Edit to change a creation, then Done · View to return to viewing. The viewing URL can be bookmarked in the same browser where the creation is stored. Reopening the app without a route restores the last saved creation in viewing mode. No data is uploaded or made shareable by the viewing URL.

## Version history

This is a Git repository on `main`, connected to the private source repository provisioned by Sites. The first deployment is preserved as the initial commit. Commit each completed incremental change with a descriptive message. Publish the same committed source through the Sites workflow; do not put repository credentials in files.

App: https://outline-diagram-studio.choongjinyao295489.chatgpt.site
