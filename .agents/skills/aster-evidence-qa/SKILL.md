---
name: aster-evidence-qa
description: Verify Aster review, provenance, rollback and scoped UI changes with synthetic data, explicit failure cases and traceable artifacts.
---

Work only in the Aster repo assigned by the Supervisor; always set command workdir explicitly. Keep plugin-wide behavior separate from Halo visuals and Orbit navigation.

For affected paths validate provenance, cancellation/failure, idempotence and rollback boundaries using synthetic data/provider mocks. Treat real model outputs separately from deterministic verification. Brand changes retain stable plugin IDs, settings and CSS hooks.

Run check/package, keep command logs and artifact SHA256, and return the assigned task/revision. State what remains unverified; unit tests are not native Obsidian runtime evidence. Do not use personal Vault notes or secrets as fixtures.
