# Traffic Signal Control Rules Documentation
Version: 4.0 | KPI Target: Minimize Average Queue Length and Maximize Throughput

## Overview
This document describes the v4 traffic signal ruleset, which combines the responsive actuated behavior that performed best in v2 with the richer demand awareness introduced in v3. The controller now uses simple actuated rules to decide when to end the current phase, while using bounded pressure scoring only to choose the best next eligible phase.

---

## Timing Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Yellow | 4.0s | Yellow clearance interval |
| All-Red | 2.0s | Red clearance for all directions |
| Pedestrian Walk | 7.0s | Walk signal duration |
| Pedestrian Clearance | 15.0s | Flashing don't walk interval |
| Extension Interval | 2.0s | Controller re-evaluation interval |

---

## Phase Definitions

### Phase 1: N-S Through (PHASE_1_N_S_THRU)
- **Ring:** 1
- **Sequence:** 1
- **Movements:** N_thru, S_thru
- **Detectors:** det_N_thru_1, det_N_thru_2, det_S_thru_1, det_S_thru_2
- **Pedestrian Phase:** PHASE_PED_NS
- **Min Green:** 10s
- **Max Green:** 60s
- **Passage Time:** 2.5s
- **Recall:** min_green (phase will always run at least min_green)

### Phase 2: N-S Left Turn (PHASE_2_N_S_LEFT)
- **Ring:** 1
- **Sequence:** 2
- **Movements:** N_left, S_left
- **Detectors:** det_N_left, det_S_left
- **Pedestrian Phase:** PHASE_PED_NS
- **Min Green:** 6s
- **Max Green:** 16s
- **Passage Time:** 2.0s
- **Recall:** none (phase may be skipped if no demand)

### Phase 3: E-W Through (PHASE_3_E_W_THRU)
- **Ring:** 2
- **Sequence:** 1
- **Movements:** E_thru, W_thru
- **Detectors:** det_E_thru_1, det_E_thru_2, det_W_thru_1, det_W_thru_2
- **Pedestrian Phase:** PHASE_PED_EW
- **Min Green:** 10s
- **Max Green:** 60s
- **Passage Time:** 2.5s
- **Recall:** min_green (phase will always run at least min_green)

### Phase 4: E-W Left Turn (PHASE_4_E_W_LEFT)
- **Ring:** 2
- **Sequence:** 2
- **Movements:** E_left, W_left
- **Detectors:** det_E_left, det_W_left
- **Pedestrian Phase:** PHASE_PED_EW
- **Min Green:** 6s
- **Max Green:** 16s
- **Passage Time:** 2.0s
- **Recall:** none (phase may be skipped if no demand)

---

## Ring Barrier Structure

The v4 rules retain the project ring-barrier structure for compatibility with the existing controller and signal phase design.

- **Barrier 1:** PHASE_1_N_S_THRU -> PHASE_2_N_S_LEFT
- **Barrier 2:** PHASE_3_E_W_THRU -> PHASE_4_E_W_LEFT

The main behavioral change is not the ring layout itself, but the logic used to determine when the current phase should terminate and which eligible phase should run next.

---

## Decision Logic

### Core Design Principle
v4 separates two decisions that v3 mixed together:

1. **When to end the current phase**
   - Controlled by actuated logic similar to v2
   - Keeps the controller responsive and prevents overserving one corridor

2. **Which phase to serve next**
   - Controlled by bounded pressure scoring
   - Uses queue and wait-time information to pick the best eligible next phase

This split is the main architectural change in v4.

### Hold / Change Logic
The current phase is evaluated in this order:

1. **Minimum Green Hold**
   - If the current phase has not yet met `min_green`, it remains active.

2. **Maximum Green Force-Off**
   - If the current phase reaches `max_green`, it must terminate.

3. **Per-Phase Gap-Out**
   - If current demand drops below the hold threshold and the phase has outlived its configured `passage_time`, the controller gaps out.

4. **Competing Demand Reallocation**
   - If a competing eligible phase has materially more queued demand than the current phase, the controller changes phases.
   - Competing demand includes both same-ring next-phase demand and opposite-ring demand.

5. **Extension**
   - If none of the above conditions are met, the current phase extends.

### Gap-Out
- **Enabled:** Yes
- **Behavior:** Uses the active phase's own `passage_time` instead of a single global value.
- **Purpose:** Keep v2's strong responsiveness while allowing separate tuning for through and left phases.

### Maximum Green
- **Enabled:** Yes
- **Force Change:** Yes
- **Through Max Green:** 60s
- **Left Max Green:** 16s
- **Purpose:** Cap overservice more tightly than v2 and much more safely than v3.

### Reallocation Thresholds
- **Queue Threshold:** 3 vehicles
- **Current Phase Hold Threshold:** 1 vehicle
- **Reallocation Margin:** 3 vehicles
- **Purpose:** Make the controller reallocate sooner than v2 when real competing demand forms, but avoid v3's overly sticky pressure behavior.

### Next-Phase Pressure Selection
Pressure is used only after a phase change has already been justified.

- **Through Weight:** 1.0
- **Left Weight:** 0.85
- **Wait-Time Weight:** 0.02 per queued vehicle-second
- **Through Queue Threshold:** 3 vehicles
- **Left Queue Threshold:** 2 vehicles

This gives a mild throughput preference while still allowing left-turn demand and accumulated waiting time to influence which next phase is most valuable to serve.

### Key Difference From v3
v3 allowed pressure to influence whether the current phase should keep holding. That made the controller too sticky, which caused long green durations, almost no gap-outs, and excessive E/W through dominance.

v4 uses pressure only for next-phase ranking. This restores responsive phase termination while keeping the more informed phase selection benefits from v3.

---

## Connected Vehicle (CV) to Detector Mapping

For CV-based detection, the system maps incoming CV data to virtual detector zones:

| CV Zone | Detector | Location |
|---------|---------|----------|
| zone_1 | det_N_thru_1 | North - Through Lane 1 |
| zone_2 | det_N_thru_2 | North - Through Lane 2 |
| zone_3 | det_N_left | North - Left Turn |
| zone_4 | det_S_thru_1 | South - Through Lane 1 |
| zone_5 | det_S_thru_2 | South - Through Lane 2 |
| zone_6 | det_S_left | South - Left Turn |
| zone_7 | det_E_thru_1 | East - Through Lane 1 |
| zone_8 | det_E_thru_2 | East - Through Lane 2 |
| zone_9 | det_E_left | East - Left Turn |
| zone_10 | det_W_thru_1 | West - Through Lane 1 |
| zone_11 | det_W_thru_2 | West - Through Lane 2 |
| zone_12 | det_W_left | West - Left Turn |

---

## Phase Sequence Diagram

```
Ring 1                          Ring 2
┌─────────────────────────┐      ┌─────────────────────────┐
│  PHASE_1_N_S_THRU       │      │  PHASE_3_E_W_THRU       │
│  (10-60s)               │      │  (10-60s)               │
│  N_thru + S_thru        │      │  E_thru + W_thru        │
│  det: 1,2,4,5           │      │  det: 7,8,10,11         │
└────────────┬────────────┘      └────────────┬────────────┘
             │                                │
             ▼                                ▼
┌─────────────────────────┐      ┌─────────────────────────┐
│  PHASE_2_N_S_LEFT       │      │  PHASE_4_E_W_LEFT       │
│  (6-16s, skip if no     │      │  (6-16s, skip if no     │
│   demand)               │      │   demand)               │
│  N_left + S_left        │      │  E_left + W_left        │
│  det: 3,6               │      │  det: 9,12              │
└─────────────────────────┘      └─────────────────────────┘
```

---

## Optimization Notes

### Version 4.0 Tuning Changes

1. **Restored Actuated Change Behavior From v2**
   - Phase termination is again driven by `min_green`, `max_green`, `gap_out`, and competing queue thresholds
   - Purpose: recover the responsiveness that gave v2 its best queue performance

2. **Pressure Limited To Next-Phase Selection**
   - Pressure no longer decides whether the current phase keeps extending
   - Purpose: prevent the v3 failure mode where one through corridor dominated for most of the run

3. **Same-Ring Demand Still Considered**
   - v4 keeps the useful v3 learning that same-ring queued demand matters when deciding to reallocate
   - Purpose: avoid starving queued left phases while still prioritizing throughput

4. **Lower Through Maximum Green Than v2**
   - Through max green reduced from 75s to 60s
   - Purpose: reduce overservice on dominant corridors and improve total queue control

5. **Shorter Left Maximum Green**
   - Left max green reduced from 18s in v3 to 16s
   - Purpose: avoid wasting protected left time while still allowing service for non-trivial left queues

6. **Mild Next-Phase Through Preference**
   - Through phases remain slightly favored, but far less aggressively than in v3
   - Purpose: preserve throughput without creating a sticky E/W through bias

---

## File Reference
- Source: `rules.json`
- Version Snapshot: `docs/rules/RULES_DOCUMENTATION_v4_0.md`
- Versioned Rules Copy: `rules/rules_v4.json`
- Generated: Documentation copy for optimization iteration v4 / rules version 4.0
