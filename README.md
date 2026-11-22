# Thenvio

## v0.7 — one shared brain, a canvas anyone can use

**Don't keep your thinking in Notion, ClickUp or Obsidian. Keep it in a repo.** Thenvio now works as the front end of a team's *shared brain*: one Git repository, plain text, that people and AI agents read and write together.

```
shared-brain/
├─ how-we-work/     how the team works and decides
├─ product-data/    ideas (one Markdown file per canvas), assumptions, decisions
├─ brand/           voice and positioning — written by you, never generated
├─ skills/          24 founder skills (SKILL.md) your agents can follow
├─ README.md · AGENTS.md · CLAUDE.md
```

- **Brain → Connect a folder** (Chrome, Edge): pick your local clone of the brain repo. Thenvio writes the layout once (never overwriting files your team wrote), saves every canvas as readable Markdown on each change, and reads edits back when you return to the tab — a teammate's pull or an agent's change shows up on the canvas. Then `git commit && git push`. Thenvio never runs git or touches the network.
- **Download brain (.zip)** works in every browser; **Open a brain folder** reads canvases from any folder; **Import file…** accepts a single canvas `.md`.
- **Agents are first-class.** Canvas files are plain Markdown (`- [option] Title`, indent to branch, `<!-- id … -->` tags invisible on GitHub). An agent can add a line and Thenvio picks it up, placing the new note beside its parent. `AGENTS.md` tells agents where things live and the rules (no invented data, no pushing without approval).
- **Agent tools.** MCP: `thenvio_futures` and `thenvio_next_moves` take a canvas file straight from the repo. CLI: `npm run brain -- init <dir>` creates a brain, `npm run brain -- scan <dir>` prints the best route and next moves for every canvas, `npm run brain -- export <thenvio-export.json> <dir>` writes canvases from an export.

**Minimal by default — open it and start.** The canvas is the whole app: no sidebar, a header with only *Brain*, *Scan futures* and a menu. The panel stays closed until you select a note, and then it shows just kind, title and notes (status, ratings, evidence, tools and skills are folded under *More*). Instead of a list of advice there is one next step in the corner — click to do it, `›` for another. Import, export, your own AI, appearance and the classic analysis tools live in the menu.

## Thinking canvas v0.6 — test ideas, get the next move, scan the futures

Thenvio is a brainstorming space that thinks with you. Write one idea and the canvas keeps proposing where to go next, which assumption to test, which tool is worth connecting, and — once there are real choices on the board — which combination of choices is the strongest route.

- **Fluid canvas.** Notes glide instead of jumping: new notes fly out of their parent, children follow when you drag a parent (hold Alt to move one note), undo and Arrange animate, the camera eases. Pinch to zoom and double-tap on phones.
- **Connect by dragging.** Drag a note's dot onto another note to connect them; release on empty space to grow a branch there; click it for a new branch. Click a connection to mark it *supports*, *conflicts* or remove it. A loose note dropped onto the tree joins it.
- **Keyboard flow.** Enter edits, Tab adds a branch, Shift+Enter a sibling, arrows move between notes, Delete removes (Ctrl/⌘ Z undoes).
- **Suggestions on the canvas.** Select a note and three translucent suggestions appear next to it — Explore, Answer, Challenge or Test. One click turns one into a real note. Kinds (Option, Question, Assumption, Test, Insight) are inferred from what you type and can be changed.
- **Next moves.** A coach reads the whole canvas and ranks what to do next: name the idea, ask who it is for, test the most foundational assumption, define what result counts, pivot from refuted evidence, connect loose notes… Each move is one click.
- **Tools worth connecting.** For the selected note Thenvio suggests tool categories with examples (payments, surveys, landing pages, prototypes, analytics, automation, hosting…) and why. These are suggestions only — Thenvio is not connected to any of these apps.
- **Founder skills in context.** The matching skill from the 24-skill catalog, with a brief to paste into your own assistant.
- **Scan futures.** Every note with two or more options is a fork; every combination of choices is a possible future. Thenvio counts them all, checks each against your ratings (impact, effort), evidence, refuted assumptions and conflicts, animates through them on the canvas and lands on the strongest route — with why it wins, the weakest link, plan B if that link breaks, the next move, and a one-click decision record.

All of this runs locally from deterministic, tested heuristics in `core/` (`futures.mjs`, `coach.mjs`, `board.mjs`). **No model calls, no network, no accounts.** Scores rank your own notes against each other; they are not probabilities or forecasts. The UI follows the language you write in (Polish or English). Formula and schema: docs/ARCHITECTURE.md.

## Canvas v0.5 — open thinking without forced steps

The main product is now an **open freeform canvas** rather than a rigid automatically laid-out idea tree or a dashboard. Older user canvases are retained and spatial coordinates are added without a breaking import/export format change.

- Move notes freely by dragging a note. Move the entire canvas by dragging empty space. Scroll to pan; Ctrl/⌘ + wheel to zoom, or use the compact floating dock.
- **Double-click anywhere** to create a note; use **+ Note** in the dock on touchscreens; tap the small + on an existing note to create a connected note. No required "question/assumption/experiment" categories.
- Tap/click any note to edit its free text in a minimal panel. All node positions, titles and body notes persist locally and are exported/imported as JSON.
- **Connect** lets you link any two notes explicitly, without forcing a parent-child connection. Notes can be loose or attached. Undo/redo, delete, new canvases, zoom-to-fit and multiple canvases work.
- **AI is optional**: a separate panel copies a focused prompt for ChatGPT or other assistants, opens ChatGPT externally and imports validated JSON suggestions from the user's own model account. There is NO live ChatGPT account connection, no hosted inference, and no operator-funded AI requests.
- Earlier decision analysis and skills remain available separately without dominating canvas.


## Thenvio Flow v0.4 — thinking that moves

The primary idea map now **offers the next question, possible answer, counterargument or experiment immediately**. A person should not have to create empty branches or open several forms before thinking can continue.

- New idea creation automatically provides **four relevant starting branches** based on the entered topic.
- Selecting a branch displays contextual, editable suggestions in four thinking modes: **Discover / Answer / Challenge / Test**. One tap attaches a complete next thought and immediately continues developing that branch.
- Suggestion cards include a **question and a possible answer or hypothesis**, not just a title. Domain cues distinguish social products, travel, learning, health, commerce, startup software and general ideas.
- **Other angles** rotates suggestions; **Add all** grows four branches in one undoable step; typing an answer or new question into the **inline composer** creates it instantly.
- On phones, selecting a map card opens a compact bottom sheet; after adding a branch, the sheet closes and the new map node is focused. No miniature full-tree map or buried controls.
- Detailed notes and statuses are still available in a collapsed advanced editor. Existing branches, JSON saves, undo/redo and graph cross-links are preserved.
- For real generative brainstorming, **Copy AI brief → paste into the user's own assistant → import validated JSON**. Thenvio does **not** make a paid model call or claim that heuristic prompts are AI-written research.
- The additional deterministic suggestions are produced by pure \`core/brainstorm.mjs\`, testable and transparent.


## Thenvio is for growing ideas (v0.3)

**The main workspace is a living idea map — not a decision dashboard.** Start with one thought and grow it into branching directions, assumptions, questions, experiments and discoveries. The previous comparative scoring screen is still available as a **secondary Decision analysis** tab for users who choose to evaluate a mature option.

What is implemented in the primary **Idea branches** view:

- True multi-level, interactive, draggable, zoomable **branch canvas** with curved parent-child lines, collapsible subtrees, keyboard selection and an alternate outline view.
- Create unlimited-depth editable branches (capped at 400 nodes per idea for safety). Each branch has editable title, type, status, description, evidence and notes.
- Connect related branches using explicit cross-links; explore ancestors with breadcrumb navigation.
- **Develop ideas** adds category-specific thinking prompts as editable children. **These are templates, not AI-generated insights or verified research.**
- Search, filter-by-text highlighting, expand/collapse, fit map, zoom in/out, branch navigation, undo and redo.
- Multiple ideas in a saved local portfolio; choose between them, import and export all ideas as portable JSON.
- **Copy this reasoning for AI** includes the selected branch, its ancestors, descendants, hypotheses and notes for use in any existing assistant, without requiring Thenvio to pay model tokens.
- Light/dark/system appearance and all earlier personalization controls remain available. No account required.

This is the product's core experience. Workspaces are stored in browser localStorage, not synced. Export regularly. A native ChatGPT remote connector, collaboration and autonomous AI branching are not implemented yet.


**One idea. Infinite directions.**

Thenvio is a local-first space for growing ideas into a connected tree of directions, questions, assumptions, experiments and learnings. Start with one thought, develop branches and connect related concepts. The old decision scoring engine is **optional secondary analysis**, not the primary product. Use your existing AI assistant for language and research; this preview never silently pays for model tokens.

## Earlier decision-analysis foundation (secondary)

- Responsive dark-mode web application with editable decisions, paths and assumptions
- Transparent score breakdown, explicit blockers, sensitivity to budget/time/risk
- Stress testing via MCP
- 24 original Founder Skills using portable SKILL.md and MCP prompts
- Local browser saving plus JSON import/export
- A local, stateless stdio MCP server compatible with local-MCP clients
- Zero runtime dependencies; no accounts, trackers, database or API keys

The initial example is labeled **SYNTHETIC DEMO**. All cost, risk, learning and upside scores are illustrative estimates, not market facts or forecast probabilities. Source notes are not independently validated.

## Studio redesign (v0.2)

The Studio home is prompt-first: type the decision you want to explore to open a prefilled project brief. This does not fake AI generation. The interactive chart is placed before the input sliders so the comparison is visible sooner.

The workspace is a calm, light-first **decision studio** rather than a dashboard. New capabilities:

- Three real, interactive views generated from the same deterministic engine: **Landscape** (cost vs. comparative score), **Score drivers** (weighted components), and **Stress test** (sensitivity to changed constraints).
- Select paths directly from charts to inspect their assumptions and blockers.
- Custom preferences: light / dark / system appearance, four accent choices, comfortable / compact density and reduced motion.
- Responsive layout, labeled controls, keyboard-operable chart selections, and a persistent local preference file in browser storage.

Preferences do not leave your device. The charts only visualize your own provided path estimates; they do not represent market verification or probabilities.

## Live preview

**[Open Thenvio preview](https://thenvio-preview-v01.iwaniuk-dawid.workers.dev/)**

Thenvio is deployed as a static client on Cloudflare Workers. All decision data stays in browser localStorage. There is no hosted AI inference, user database, or API key. This is a preview, not a production service for sensitive information.

Redeploy explicitly after editing source code:

    export CLOUDFLARE_ACCOUNT_ID='your-cloudflare-account-id'
    export CLOUDFLARE_API_TOKEN='your-scoped-workers-edit-token'
    npm run deploy:cloudflare

Optional CLOUDFLARE_WORKER_NAME defaults to thenvio-preview-v01. The deployment script creates a standalone Worker from current files. No third-party libraries are necessary. Never commit your token. GitHub commits **do not automatically redeploy Cloudflare**; the operator must run this command.

## Start

Requires Node.js 20+; no npm install is necessary.

    git clone https://github.com/davidi0x/Thenvio.git
    cd Thenvio
    npm run dev

Open http://localhost:4173 .

Check the project:

    npm run check
    npm test
    npm run build

The static website is generated under dist/ and can be deployed to GitHub Pages or a static hosting service. There is an optional manual GitHub Pages workflow; GitHub Pages must be enabled in repository settings before running it.

## Real product workflow

1. Set a clear goal, budget, deadline and risk tolerance.
2. Add **genuinely distinct** candidate paths with your own estimates.
3. Register assumptions, link them to paths, and add or refute evidence.
4. Inspect blockers and heuristic scores. Change constraints without a model call.
5. Export the versioned project as JSON, or bring AI research back with explicit evidence.

A new decision starts with **zero** routes, never imaginary AI output. Everything is saved in this browser only until exported.

## Founder Skills

24 original protocols reside in skills/*/SKILL.md. Each protocol specifies an actionable procedure, data requirements, output contract and falsifiability stop gate. They can be used with a repo-aware agent:

    npm run skills:install -- --agent=claude
    npm run skills:install -- --agent=codex
    npm run skills:install -- --agent=cursor

## Model Context Protocol (MCP)

Local stdio server:

    node /ABSOLUTE/PATH/TO/Thenvio/integrations/mcp/server.mjs

Example Claude Desktop MCP configuration (replace the path):

    {
      "mcpServers": {
        "thenvio": {
          "command": "node",
          "args": ["/ABSOLUTE/PATH/TO/Thenvio/integrations/mcp/server.mjs"]
        }
      }
    }

Implemented tools:
- thenvio_evaluate — transparent path comparison and blockers
- thenvio_stress_test — budget/time/risk sensitivity
- thenvio_what_if — recalculate with changed constraints
- thenvio_founder_skill — return an AI-host skill protocol
- thenvio_validate — schema validation
- thenvio_demo — clearly synthetic input example
- thenvio_futures — scan every combination of choices in a canvas (Markdown from a shared brain or an idea graph)
- thenvio_next_moves — ranked next moves for a canvas

All 24 founder protocols are also exposed as MCP prompts.

**Important:** Local stdio MCP does not automatically make Thenvio a ChatGPT app. A direct ChatGPT integration needs a separately hosted authenticated remote MCP endpoint plus app-platform setup. This is future work, not a feature already shipped. The portable prompts and JSON export work with any assistant today.

## Privacy and limitations

Thenvio uses browser localStorage, which is not encrypted. JSON export contains raw decision content. The local MCP process does not send data to any model or service and does not persist requests. Do not put credentials, medical records or other highly sensitive information into preview projects. Heuristic weights are opinionated and uncalibrated. A claim marked supported with a source note is **not independently verified**.

Architecture, score formula and deployment constraints: docs/ARCHITECTURE.md. Next milestones: docs/ROADMAP.md.

## Inspiration / attribution

The original 24 Thenvio skills follow the public Agent Skills pattern and evidence-first workflows. Conceptual references include:
- https://github.com/AgentlyLabs/founder-skills
- https://github.com/shawnpang/startup-founder-skills
- https://modelcontextprotocol.io

The skill documents in this repository were written for Thenvio rather than copied from external repositories. No open-source license has been selected for this repository yet.
