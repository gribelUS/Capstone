# Traffic Signal Control Rules Documentation
Version: 3.1 | KPI Target: Minimize Total Wait Time

## Overview
This document describes the fully actuated traffic signal control rules used for maximizing throughput at the intersection.

---

## Timing Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Yellow | 4.0s | Yellow clearance interval |
| All-Red | 2.0s | Red clearance for all directions |
| Pedestrian Walk | 7.0s | Walk signal duration |
| Pedestrian Clearance | 15.0s | Flashing don't walk interval |
| Extension Interval | 2.0s | Vehicle call extension time |

---

## Phase Definitions

### Phase 1: N-S Through (PHASE_1_N_S_THRU)
- **Ring:** 1
- **Sequence:** 1
- **Movements:** N_thru, S_thru
- **Detectors:** det_N_thru_1, det_N_thru_2, det_S_thru_1, det_S_thru_2
- **Pedestrian Phase:** PHASE_PED_NS
- **Min Green:** 10s
- **Max Green:** 75s
- **Passage Time:** 3.0s
- **Recall:** min_green (phase will always run at least min_green)

### Phase 2: N-S Left Turn (PHASE_2_N_S_LEFT)
- **Ring:** 1
- **Sequence:** 2
- **Movements:** N_left, S_left
- **Detectors:** det_N_left, det_S_left
- **Pedestrian Phase:** PHASE_PED_NS
- **Min Green:** 6s
- **Max Green:** 18s
- **Passage Time:** 3.0s
- **Recall:** none (phase may be skipped if no demand)

### Phase 3: E-W Through (PHASE_3_E_W_THRU)
- **Ring:** 2
- **Sequence:** 1
- **Movements:** E_thru, W_thru
- **Detectors:** det_E_thru_1, det_E_thru_2, det_W_thru_1, det_W_thru_2
- **Pedestrian Phase:** PHASE_PED_EW
- **Min Green:** 10s
- **Max Green:** 75s
- **Passage Time:** 3.0s
- **Recall:** min_green (phase will always run at least min_green)

### Phase 4: E-W Left Turn (PHASE_4_E_W_LEFT)
- **Ring:** 2
- **Sequence:** 2
- **Movements:** E_left, W_left
- **Detectors:** det_E_left, det_W_left
- **Pedestrian Phase:** PHASE_PED_EW
- **Min Green:** 6s
- **Max Green:** 18s
- **Passage Time:** 3.0s
- **Recall:** none (phase may be skipped if no demand)

---

## Ring Barrier Structure

The signal controller enforces a ring barrier to prevent conflicting phases from running simultaneously:

- **Barrier 1:** PHASE_1_N_S_THRU → PHASE_2_N_S_LEFT
  - (N-S through must complete before N-S left turn)

- **Barrier 2:** PHASE_3_E_W_THRU → PHASE_4_E_W_LEFT
  - (E-W through must complete before E-W left turn)

---

## Decision Logic

### Gap-Out (Early Termination)
- **Enabled:** Yes
- **Gap Threshold:** 2.0 seconds
- **Behavior:** If no vehicles are detected after the minimum green has elapsed and the phase exceeds the configured gap threshold window, the phase may terminate early.

### Max-Out (Force Termination)
- **Enabled:** Yes
- **Force Change:** Yes
- **Behavior:** When max_green is reached, the phase MUST terminate regardless of vehicle presence.

### Queue Threshold
- **Value:** 4 vehicles
- **Behavior:** Opposing demand must build to at least 4 vehicles before it forces a phase change, reducing excessive switching and preserving green time for heavier active flows.

### Demand Waiting Threshold
- **Value:** 1 vehicle
- **Behavior:** A single waiting vehicle is sufficient to call a phase with recall=none.

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
┌─────────────────────────┐     ┌─────────────────────────┐
│  PHASE_1_N_S_THRU       │     │  PHASE_3_E_W_THRU       │
│  (10-75s)               │     │  (10-75s)               │
│  N_thru + S_thru        │     │  E_thru + W_thru        │
│  det: 1,2,4,5           │     │  det: 7,8,10,11         │
└────────────┬────────────┘     └────────────┬────────────┘
             │                               │
             ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  PHASE_2_N_S_LEFT       │     │  PHASE_4_E_W_LEFT       │
│  (6-18s, skip if no     │     │  (6-18s, skip if no     │
│   demand)               │     │   demand)               │
│  N_left + S_left        │     │  E_left + W_left        │
│  det: 3,6               │     │  det: 9,12              │
└─────────────────────────┘     └─────────────────────────┘
```

---

## Optimization Notes

### Version 3.1 Tuning Changes

1. **Shorter Minimum Greens for Faster Reallocation**
   - Through phases reduced from 15s to 10s
   - Left-turn phases reduced from 10s to 6s
   - Purpose: reduce wasted green time under light or uneven demand

2. **Higher Through-Phase Maximum Greens**
   - Through phases increased from 60s to 75s
   - Purpose: allow heavier dominant corridors to clear deeper queues before switching

3. **Shorter Left-Turn Maximum Greens**
   - Left-turn phases reduced from 30s to 18s
   - Purpose: avoid over-serving small protected left-turn queues

4. **More Aggressive Gap-Out**
   - Gap threshold reduced from 3.0s to 2.0s
   - Purpose: cut empty tail time once demand drops after minimum green

5. **Higher Opposing Queue Threshold**
   - Queue threshold increased from 2 to 4 vehicles
   - Purpose: reduce unnecessary phase changes and improve vehicle throughput by holding dominant flows longer

---

## File Reference
- Source: `rules.json`
- Version Snapshot: `docs/rules/RULES_DOCUMENTATION_v3_1.md`
- Generated: Documentation copy for optimization iteration 3.1
