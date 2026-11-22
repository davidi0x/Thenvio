# Thenvio agent instructions

Read docs/ARCHITECTURE.md before changing the decision formula or schema. Scores are comparative heuristics, not probabilities. Keep core/ deterministic, side-effect-free, dependency-free and easily testable.

Do not fabricate research, sources, users, revenue, customer data or product-market fit. Every generated claim must distinguish facts, estimates, hypotheses and unknowns. Prefer an evidence-gathering experiment over unfounded certainty.

Respect privacy: no credentials or hosted tokens in the browser bundle, no unsolicited telemetry, no shared model API billing, and no remote action without explicit approval.

For UI, favor clear state transitions, accessible labeling, meaningful empty/error states, responsive ergonomics, dark monochrome surfaces and minimal visual noise. Do not introduce gradients, decorative 3D or inert controls.

Before shipping, run npm run check, npm test and npm run build. New skills require SKILL.md frontmatter, workflow, output contract and falsifiability gate. Keep the 24-item skill catalog in sync with folders.
