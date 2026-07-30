# Design-partner pilot operating plan

Status: **READY TO RUN; NOT YET EVIDENCE-COMPLETE**

BuBu's repository can prove behavior, but it cannot manufacture consent, repeat use, trust, or commercial intent. The sellable-V1 gate therefore requires a real 5–10 person pilot over recurring spreadsheet work.

## Participant and privacy contract

1. Obtain explicit written consent before observation or aggregation. Participation is voluntary and withdrawal removes that participant from the aggregate.
2. Keep raw files, row values, prompts, model output, file names, paths, thread IDs and personal identifiers on the participant's device. Do not copy them into the evidence file.
3. Record only de-identified counts and first-Artifact elapsed minutes. Interview notes and written purchase intent remain in an access-controlled research system outside Git.
4. Stop and investigate immediately after any unapproved disclosure or silent semantic change. A nonzero safety count fails the gate; it is not averaged away.

## Session sequence

- Session 1: participant chooses a real recurring Clean or Reconcile job, installs the reviewed build, imports locally, reviews the proposed change or plan, produces an Artifact, and optionally exports a report.
- Between sessions: participant uses the normal pause/recovery surfaces without researcher intervention.
- Session 2: on the next real business period, participant replaces the source, observes replay or pause evidence, recovers if needed, and produces the next deliverable.
- Closeout: ask whether the workflow replaced meaningful spreadsheet work and whether a paid pilot or equivalent written purchase intent is acceptable.

## Acceptance gate

Run `BUBU_PILOT_EVIDENCE_PATH=/absolute/path/pilot.json npm run verify:pilot-evidence`. The strict file accepts only aggregate counts and checks all current thresholds: 70% first-task completion, median first Artifact no more than 10 minutes, at least three return-eligible people and 50% return, 80% pause recovery, 60% report delivery, zero safety violations, and three commercial-intent confirmations.

Passing this gate is necessary but not sufficient: the product owner must review consent provenance and external notes before changing `consented-design-partner-pilot-evidence` to `implemented`.
