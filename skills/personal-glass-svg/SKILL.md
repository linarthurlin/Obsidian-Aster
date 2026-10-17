---
name: personal-glass-svg
description: Create readable, editable offline SVG architecture and knowledge diagrams for Obsidian, with coordinated light/dark variants and local attachment delivery. Use for vector diagrams, not photographs or statistical plots.
---

# Personal Glass SVG

Start from the diagram's relationships, intended reading order, target width and surrounding document theme. Reuse the user's supplied labels and sources; do not invent quantitative claims.

Use `scripts/render-flow.mjs` for short sequential flows. For non-sequential graphs, choose an appropriate graph layout or construct native SVG with an explicit layout; do not force every relationship into a linear pipeline. Prefer Mermaid when editable plain-text diagrams already meet the need. Use standard plotting tools for measured/scientific charts.

For a sequential flow, create a JSON input with a title, description and 2–12 nodes:

```json
{"title":"Knowledge workflow","description":"Evidence becomes reviewed knowledge.","nodes":[{"title":"Capture","detail":"Preserve the original"},{"title":"Understand","detail":"Connect the evidence"},{"title":"Create","detail":"Make something useful"}]}
```

Run using the directory containing this SKILL.md (replace `<skill-dir>` with its actual location):

```sh
node <skill-dir>/scripts/render-flow.mjs input.json output-name
python <skill-dir>/scripts/validate_svg.py output-name-light.svg output-name-dark.svg
```

The generator produces paired self-contained SVGs. External SVG images embedded in Obsidian do not reliably inherit the host document's CSS variables: use explicit light/dark files or a self-contained neutral panel, then verify both in the target view.

Keep consistent strokes, radii and arrowheads; reserve adequate space for long Chinese/English labels. Preserve text as text unless the user's export requirement calls for outlines. Use a `viewBox`, accessible title and description. Avoid scripts, external resources, remote fonts and `foreignObject` so the asset works offline.

Validate XML and resource boundaries, then render and inspect at normal width and a narrow document width. Validation alone does not prove labels fit or arrows communicate the intended relationships. Inspect the output in Obsidian Reading View and Live Preview when available; name any untested export paths.

Deliver the SVG pair and input structure with a brief explanation of the diagram. For vault use, place approved assets beside the relevant note in `assets/` and provide an embed link; do not reorganize existing attachments or write to a vault without authorization. Static diagrams are the default; animation requires a reason and a static alternative.
