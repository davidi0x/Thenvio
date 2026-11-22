# Thenvio — architecture and guarantees

## Data model

Project schemaVersion 1: id, title, goal, currency, budget, deadlineWeeks, riskTolerance, assumptions[], paths[].
Assumptions: id, claim, status (unknown/supported/refuted), source.
Paths: id, name, description, cost, weeks, upside, risk, learning, dependencies[].
Upside, risk and learning are **user-provided comparative values** on a 0–100 scale, not measured success probabilities.

Idea graph schemaVersion 1 (canvas): id, title, rootId, nodes[], links[]. Nodes: id, parentId, title, description, kind (idea/direction/question/assumption/experiment/insight), status (open/exploring/supported/refuted), evidence, collapsed, plus canvas x, y and free (loose note, parent edge hidden).
Optional, backward-compatible fields added in v0.6 (absent means "not set"; older files stay valid, no version bump):
- node.impact, node.effort: whole numbers 1–5, user ratings. Clearing a rating removes the key.
- link.type: relates (default when absent) / supports / conflicts.
Validation rejects any other value. In the UI the kind "direction" is labelled **Option**.

## Deterministic scoring

A route is blocked if estimated cost exceeds available budget, estimated time exceeds the deadline, or a required assumption is refuted. Blocked routes cannot be recommended, even if they have a high raw score.

For all routes the transparent heuristic uses:
- 38% upside
- 20% learning
- 24% risk fitness, defined as 100 − risk × (1 − riskTolerance/200)
- 10% cost fitness, defined as clamp(100 × (1 − cost/(1.25 × budget)))
- 8% time fitness, defined as clamp(100 × (1 − weeks/(1.25 × deadlineWeeks)))
- Penalty: 6 points per unresolved or uncited dependency, capped at 30

Budget=0 is handled explicitly. Scores are bounded to 0–100 and round to one decimal place.

A winner is chosen only from feasible routes. Recommended = maximum heuristic score; least cost = cheapest feasible; highest upside = maximum upside among feasible. If none are feasible, no route is recommended.

**This formula is opinionated and uncalibrated, not financial advice or a forecast.** Do not compare scores across unrelated decisions.

## Separation of concerns

- web/: static HTML/CSS/ESM app with no remote assets
- core/: pure evaluation engine, synthetic example, original skill catalog
- integrations/mcp/: stateless local JSON-RPC stdio MCP adapter
- skills/: portable agent workflows
- tests/: deterministic regression and protocol smoke tests
- scripts/: zero-dependency build, local development and skill installation

The user's AI host does any research or generation. Thenvio handles constraints, pathways and assumptions. A new project contains no generated proposals.

## Threat and trust boundaries

- No Thenvio backend, accounts or tracking. Since v0.8 the browser may call two third-party APIs, only on explicit user action: `api.anthropic.com` (brainstorm, the user's own API key, billed to them) and `api.github.com` (read-only GET of a shared brain). The worker's CSP `connect-src` allows exactly these two hosts. Keys and tokens live in tab memory only.
- Browser localStorage is unencrypted and single-project only. Exported JSON is unencrypted.
- User input and source notes are not externally verified.
- Import rejects invalid project shapes, missing dependency references and duplicate IDs.
- The web renderer inserts user text as text nodes, not injected markup.
- Client-side validation is not authorization or protection for future collaboration features.
- The MCP server is local stdio only; no auth or remote network listener is exposed.
- No raw AI API keys are handled.

The 2MB browser import cap is a usability guard, not a comprehensive defense. Independent source provenance and robust collaborative security are future milestones.

## Studio design (v0.2)
The interface is an editorial decision canvas (dark by default since v0.6; light and system remain available). Visuals are computed from core/visuals.mjs (pure model) and rendered as inline SVG in web/app.mjs (no chart dependencies). Views are landscape (cost and score), score contributions, and stress-tested leading path. User-selected colors, density, theme and motion are stored under a separate preferences key in localStorage. Browser light/dark system mode and reduced-motion preference are respected. On-screen values remain heuristic, not evidence.


## Thinking canvas (v0.6)

The canvas is the primary product. Three pure modules in core/ give it judgement; the browser only renders.

### Futures — core/futures.mjs
A **fork** is a connected note with two or more children of kind direction (options). A **future** (scenario) picks exactly one option at every active fork; options under an unchosen option are inactive. Non-option notes (questions, assumptions, experiments, insights) belong to whichever option or fork they sit under. Loose notes (free: true) are excluded until connected.
- Count: a BigInt product/sum over the tree, so very large canvases never overflow.
- Enumeration: exhaustive up to 4,000 futures; above that a deterministic beam search keeps the strongest 160 partial combinations at each step. The UI says which one ran.
- Option score (0–100, comparative) = 40% impact + 25% ease + 25% evidence + 10% testability.
  - impact = (impact−1)/4×100, ease = (5−effort)/4×100; an unrated value counts as 50 and as one unknown.
  - evidence = clamp(50 + 15 × supported notes − 8 × untested assumptions − 4 × unanswered questions + 20 if the option itself is supported).
  - testability = 100 with an experiment below the option, otherwise 30.
- Future score = mean of its option scores + 4 per supports link inside the future (capped at +12).
- A future is **blocked** if it contains a refuted option, a refuted assumption or experiment, or both ends of a conflicts link. Blocked futures are never recommended.
- Confidence label from open unknowns: solid (0–1), shaky (2–4), speculative (5+). It is a label, not a probability.
- Weakest link: each untested assumption on the winning route is assumed false; the one causing the largest drop is reported with the best surviving future as plan B (or flagged as critical if no future survives).
- Next move, in order: add an alternative (no forks) → pivot (all blocked) → rate unrated options on the top two routes → test the weakest link → settle a near tie (< 3 points) → commit and record a decision.

**These numbers rank the user's own notes against each other. They are not probabilities, forecasts or research, and they are not comparable across canvases.**

### Coach — core/coach.mjs
Transparent rules over the graph produce up to six ranked next moves (name the idea, open directions, finish empty notes, pivot from refuted evidence, test the most foundational untested assumption, ask who it is for, answer open questions, name what must be true, scan futures, rate options, define success criteria, test deep untested branches, connect loose notes, act on learnings, merge near-duplicates, group crowded branches). Each move carries an explicit action the UI can execute.
- Kind inference for freshly typed notes (PL/EN phrasing) and content-language detection.
- Tool recommendations: a static catalog of tool categories with well-known examples, matched by keywords in the note and its path, falling back to typical next steps per kind. Thenvio is **not connected** to these tools and says so in the UI.
- Skill recommendations map notes to the 24 founder skills; skill briefs reuse the no-fabrication rules.

### Placement — core/board.mjs
freeSlots (deterministic non-overlapping positions beside a note), tidyLayout (tree layout anchored at the main idea, loose groups shelved below when they collide), moveBoardNodes (one undo step for a dragged subtree), connectNotes (a loose note joins the tree, otherwise a typed link), updateBoardMeta, setLinkType, detachNote.

### Rendering — web/free-canvas.mjs
Keyed DOM reconciliation (no full re-render), one requestAnimationFrame loop that eases displayed positions toward model positions (new notes fly out of their parent, children follow a dragged parent, undo and arrange animate), pointer-captured drags, drag-to-connect from a note's dot, inline editing with Tab/Enter flow, pinch zoom and double-tap on touch, an animated camera, and a futures scan that highlights sampled scenarios before settling on the winner. Reduced-motion preferences turn animation off. The UI language follows the content (Polish or English).

## Shared brain (v0.7)

One repository, plain text, for the team and its agents. Layout: `how-we-work/`, `product-data/` (`ideas/`, `assumptions.md`, `decisions/`), `brand/`, `skills/`, plus `README.md`, `AGENTS.md`, `CLAUDE.md`.

### Canvas file format — core/brain.mjs
`product-data/ideas/<slug>-<hash>.md`: YAML-like front matter (`thenvio: canvas`, `version`, `id`, `title`, `updated`), `# Main idea`, then one bullet per note: `- [kind · status] Title <!-- id=… x=… y=… impact=… effort=… -->`. Two spaces of indent = child. `>` lines are the note's text; `> **Evidence:**` (or `**Dowód:**`) lines are its evidence. `## Loose notes` holds free notes; `## Connections` holds `- A → B · relates|supports|conflicts <!-- from=… to=… -->`. Kind and status words exist in English and Polish.
- canvasToMarkdown → markdownToCanvas is a lossless round trip (same notes, fields, positions, links) and re-serialising is byte-stable.
- The parser is tolerant: missing kinds are inferred, unsafe or duplicate ids are replaced by deterministic hashes, out-of-range ratings are ignored, unresolvable links are dropped, notes without positions are placed in free space beside their parent (or the whole canvas is laid out when nothing has a position), more than 400 notes is refused. The result always passes validateIdeaGraph.
- brainFiles(graphs) returns every file with an owner: `thenvio` (canvases, assumption register, decision records — regenerated) or `team` (scaffold docs and skills — created only when missing, never overwritten). readBrain(files) reads canvases back and reports bad files without failing.
- skills/*/SKILL.md are generated from core/skills.mjs (skillMarkdown) and a test asserts byte equality, so the 24-skill catalog and folders cannot drift.
- core/zip.mjs writes a deterministic stored ZIP (CRC-32, UTF-8 names, fixed timestamp) for the download.

### Sync — web/brain-sync.mjs
Uses the File System Access API on a folder the person picks (the handle is remembered in IndexedDB; access is re-requested when the browser asks). Rules: on connect, canvases in the folder are read first — new ones join, and a file wins over the local copy only if it differs and its modification time is newer than the canvas's `updatedAt` (the replaced local version stays on the undo stack); then Thenvio writes changed `thenvio` files and missing `team` files. Saves are debounced after every change; the folder is re-read when the tab becomes visible again. Nothing is deleted, no git command is run, no network request is made. Browsers without the API get a ZIP download and a read-only folder import.

### Agents
- MCP (integrations/mcp/server.mjs): `thenvio_futures`, `thenvio_next_moves` accept a canvas as Markdown or an idea-graph object and return the same deterministic analysis as the canvas, with its disclaimer.
- CLI (scripts/brain.mjs): `init <dir>` (scaffold, keeps existing files), `export <export.json> <dir>`, `scan <dir>`. Local files only.

### Minimal canvas UI
The canvas hides the app sidebar. Header: Brain (with a sync dot), Scan futures, menu. The side panel is closed by default and has one purpose at a time (note, futures, brain, own AI). The coach shows a single next step; `›` skips to the next one for the session.

## Think (v0.8)
- core/think.mjs (pure): `thinkRequest` builds a Messages API body for `claude-opus-5-5` with structured output (`output_config.format` json_schema `THINK_SCHEMA`: goal, questions, alternatives with parent/impact/effort/mustBeTrue/test, bestPath) and `effort: high`; the user message carries the canvas as Markdown, the goal and up to six shared-brain files. `applyThinkResult` validates, clamps, de-duplicates by title and places notes with freeSlots: options (rated), their assumptions and tests, questions under the focus, and a "Best route" insight under the chosen option, labelled as a hypothesis. The goal is stored as the first `Goal:`/`Cel:` line of the main idea's text.
- web/ai-think.mjs: the only Anthropic call — raw `fetch` (the app is a dependency-free static client with `script-src 'self'`, so the SDK cannot be loaded) with `anthropic-dangerous-direct-browser-access`, `anthropic-version: 2026-10-21` and server-side refusal fallbacks (`fallbacks: "default"`). Handles 401/429, `refusal` and `max_tokens`.
- web/github-brain.mjs: read-only GitHub reader (repo metadata, recursive tree, raw contents of canvases and context files). Merges use the same "newer wins, undo kept" rule as the folder sync, with the repository's `pushed_at` as the file time.

## Thenvio in chat apps (v0.9)
- integrations/brain-store.mjs: file-backed shared brain (default `~/thenvio-brain`, `THENVIO_BRAIN`, `--brain`). Reads the folder fresh on every call, so the local server, a stdio MCP server started by Claude, and git can share it; scaffold files created when missing, nothing deleted.
- integrations/mcp/handler.mjs: one JSON-RPC handler for stdio (server.mjs) and Streamable HTTP (`POST /mcp`, JSON responses, 202 for notifications). Canvas tools: thenvio_canvases, thenvio_canvas, thenvio_new_canvas, thenvio_brainstorm (input = the THINK_SCHEMA fields; its description carries the brainstorming guide, so the host model does the thinking), thenvio_update_note, thenvio_show. Render tools carry `_meta.ui.resourceUri` (and `openai/outputTemplate`) pointing at `ui://thenvio/canvas-v1.html`, served by resources/read with MIME `text/html;profile=mcp-app`. Results include `structuredContent` and a plain-text summary.
- web/mcp-app.html: self-contained view; JSON-RPC over postMessage (`ui/initialize`, `ui/notifications/tool-result`, `tools/call`, `ui/message`) with the `window.openai` bridge as fallback.
- scripts/local-server.mjs (`npm start`): static app + `/api` (brain, canvases, context, PUT canvas, SSE change stream) + `/mcp`, on 127.0.0.1. `/api` requires a localhost Host and an `x-thenvio` header (except the data-less SSE stream); `/mcp` requires a localhost Host or, when `THENVIO_MCP_TOKEN` is set, that token (Bearer or `?key=`). Pages served locally carry `<meta name="thenvio-local">`, which switches the app to live sync (web/local-brain.mjs): saves are debounced PUTs, external changes arrive over SSE and merge with "newer wins, undo kept".
- Unverified: the MCP Apps capability name in `initialize` (declared as `extensions['io.modelcontextprotocol/ui']`) because the spec page was unavailable while building; hosts read the tool `_meta`.

## Cloud connector (v1.0)
integrations/cloud/worker.mjs is a Cloudflare Worker (ES modules uploaded as-is, no bundler): it serves the site (assets embedded by scripts/build-worker.mjs, pages marked `<meta name="thenvio-cloud">`), `POST /mcp/<brain-id>` (Streamable HTTP, JSON responses, CORS for browser-based MCP clients) and `/api/b/<brain-id>/{version,canvases[/id]}` for the site (same-origin, `x-thenvio` header). Every brain id maps to a Durable Object `Brain` (SQLite-backed storage) that runs the same MCP handler over integrations/kv-brain-store.mjs, so tool calls and site saves are strongly consistent. Brain ids are 18 random bytes, base64url, created in the browser; the connector URL is a capability URL and is the only access control. The site polls the version counter every 3 s while visible. Limits: 50 canvases per brain, 2 MB requests, 400 notes per canvas.

## Crowd simulation (v1.1) — core/swarm.mjs
- Options: direction notes at forks (or all options when there is no fork). Per option: value = (impact−1)/4, friction = (effort−1)/4 (0.5 when unrated), text cues for price, trust (incl. payment), new app/habit (negations like "without an app" ignored) and social mechanics; risk = 0.12 per untested assumption (cap 0.5); evidence = 0.08 per supported note (cap 0.25); refuted option or refuted assumption/experiment → blocked.
- Agents (default 240, max 400): archetypes (early adopter 15%, pragmatist 35%, thrifty 20%, skeptic 15%, too busy 15%) or chat-written personas with shares and traits 0–1; each agent's traits are jittered ±0.12 around its segment.
- Utility = gain·(0.4+0.6·value) − 0.8·timeCost·friction − 0.45·priceSens·price − 0.45·trustNeed·trust − 0.4·habit·install − caution·risk + evidence + personal noise. Social pull = social·(1+0.5·socialCue)·(adopted neighbours share)·1.5. Network: ring lattice k=6 rewired with p=0.12. An agent adopts the best option whose utility + pull exceeds its threshold, never un-adopts; one option per agent; 12 rounds by default (max 20).
- Objections: for every agent who would not take an option even alone, the biggest penalty names the reason (benefit, effort, price, trust, new habit, unknowns), counted per segment.
- Seeded PRNG (mulberry32) from the canvas id, option attributes and a seed: same canvas, same crowd.
- swarmNotes adds the top objections as questions and one "5 real conversations" experiment; summarizeVoices / persona voices add the sharpest quoted objection per option. All labelled as synthetic.
- Adoption is reported separately from the futures score and never changes it; the canvas only flags when the two disagree.
