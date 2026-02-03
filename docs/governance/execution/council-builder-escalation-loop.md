# Council ⇄ Builder Escalation Loop

## Governance Role
procedure

## Purpose

Defines the operational execution loop between Council, Builder, and Human authority.

This loop governs deterministic work, retries, receipts, and escalation.

---

## Loop

### 1. Council Issues Work Packet
Includes:
- scope
- constraints
- success criteria
- acceptance tests
- paths / environment context

### 2. Builder Executes Deterministically
- runs commands
- produces diffs
- captures outputs

### 3. Builder Runs Proof Gates
Examples:
- verify.sh
- tests
- lint
- validation scripts

### 4. If Pass → Return Receipts to Council
Work is considered structurally complete.

### 5. If Fail → Builder Retries (Bounded)
- Maximum N retries
- Each retry must include:
  - failure evidence
  - delta from previous attempt
  - reasoning

### 6. If Still Failing → Escalate to Council
Builder sends:
- logs
- diffs
- failure analysis

### 7. Council Performs Structural Diagnosis
Classifies issue as:
- missing information
- conflicting constraints
- environmental failure
- structural disharmony

### 8. If Council Cannot Resolve → Escalate to Human
Council emits:

STATE: DISHARMONY_DETECTED

Includes:
- evidence
- impact
- request for clarification or creative harmony authorization

### 9. Human Responds / Authorizes
May provide:
- missing info
- constraint adjustment
- permission for Creative Harmony Loop

### 10. Council Updates Work Packet

### 11. Loop Returns to Builder

---

## Stop Conditions

- Proof gates pass
- Human abort
- Escalation threshold exceeded

---

## Governance Integration

This loop operates under:

- Whole → Part Ordering (constraint)
- Creative Harmony Loop (constraint)
- Disharmony Detection (procedure)
- State Externalisation Rule (constraint)

Receipts and logs are mandatory at every boundary.
