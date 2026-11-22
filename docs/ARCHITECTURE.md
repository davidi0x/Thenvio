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

- No cloud endpoints, hosted model inference, accounts or tracking in v0.1.
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
