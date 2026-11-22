# Thenvio — architecture and guarantees

## Data model

Project schemaVersion 1: id, title, goal, currency, budget, deadlineWeeks, riskTolerance, assumptions[], paths[].
Assumptions: id, claim, status (unknown/supported/refuted), source.
Paths: id, name, description, cost, weeks, upside, risk, learning, dependencies[].
Upside, risk and learning are **user-provided comparative values** on a 0–100 scale, not measured success probabilities.

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
