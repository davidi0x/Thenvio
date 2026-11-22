# Thenvio

**Think in paths. Decide with evidence.**

Thenvio is a local-first decision-intelligence workspace. Users can combine their existing AI assistants with a deterministic engine that checks constraints, dependencies and what changes the recommendation. There is **no hosted model**, no shared paid model API, and no operator-funded tokens.

## What works in v0.1

- Responsive dark-mode web application with editable decisions, paths and assumptions
- Transparent score breakdown, explicit blockers, sensitivity to budget/time/risk
- Stress testing via MCP
- 24 original Founder Skills using portable SKILL.md and MCP prompts
- Local browser saving plus JSON import/export
- A local, stateless stdio MCP server compatible with local-MCP clients
- Zero runtime dependencies; no accounts, trackers, database or API keys

The initial example is labeled **SYNTHETIC DEMO**. All cost, risk, learning and upside scores are illustrative estimates, not market facts or forecast probabilities. Source notes are not independently validated.

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

The static website is generated under dist/ and can be deployed to GitHub Pages or a static hosting service. There is a GitHub Pages workflow for main; GitHub Pages must be enabled in repository settings before a deployment is live.

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
