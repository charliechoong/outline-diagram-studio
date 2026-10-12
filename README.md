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

Creations are saved in localStorage in the current browser on the current device. They are not synced across devices or included in Git. SVG export creates a standalone copy of a diagram.

## Version history

This is a Git repository on `main`, connected to the private source repository provisioned by Sites. The first deployment is preserved as the initial commit. Commit each completed incremental change with a descriptive message. Publish the same committed source through the Sites workflow; do not put repository credentials in files.

Private app: https://outline-diagram-studio.choongjinyao295489.chatgpt.site
