# Traffic Signal Control Rules Documentation
Version: 3.0 | KPI Target: Minimize Total Wait Time

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
- **Min Green:** 15s
- **Max Green:** 60s
- **Passage Time:** 3.0s
- **Recall:** min_green (phase will always run at least min_green)

### Phase 2: N-S Left Turn (PHASE_2_N_S_LEFT)
- **Ring:** 1
- **Sequence:** 2
- **Movements:** N_left, S_left
- **Detectors:** det_N_left, det_S_left
- **Pedestrian Phase:** PHASE_PED_NS
- **Min Green:** 10s
- **Max Green:** 30s
- **Passage Time:** 3.0s
- **Recall:** none (phase may be skipped if no demand)

### Phase 3: E-W Through (PHASE_3_E_W_THRU)
- **Ring:** 2
- **Sequence:** 1
- **Movements:** E_thru, W_thru
- **Detectors:** det_E_thru_1, det_E_thru_2, det_W_thru_1, det_W_thru_2
- **Pedestrian Phase:** PHASE_PED_EW
- **Min Green:** 15s
- **Max Green:** 60s
- **Passage Time:** 3.0s
- **Recall:** min_green (phase will always run at least min_green)

### Phase 4: E-W Left Turn (PHASE_4_E_W_LEFT)
- **Ring:** 2
- **Sequence:** 2
- **Movements:** E_left, W_left
- **Detectors:** det_E_left, det_W_left
- **Pedestrian Phase:** PHASE_PED_EW
- **Min Green:** 10s
- **Max Green:** 30s
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
- **Gap Threshold:** 3.0 seconds
- **Behavior:** If no vehicles are detected for 3.0 seconds and min_green has elapsed, the phase may terminate early.

### Max-Out (Force Termination)
- **Enabled:** Yes
- **Force Change:** Yes
- **Behavior:** When max_green is reached, the phase MUST terminate regardless of vehicle presence.

### Queue Threshold
- **Value:** 2 vehicles
- **Behavior:** Used to determine if a phase has sufficient demand to be called.

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
┌─────────────────────────┐      ┌─────────────────────────┐
│  PHASE_1_N_S_THRU       │      │  PHASE_3_E_W_THRU       │
│  (15-60s)               │      │  (15-60s)               │
│  N_thru + S_thru        │      │  E_thru + W_thru        │
│  det: 1,2,4,5           │      │  det: 7,8,10,11         │
└────────────┬────────────┘      └────────────┬────────────┘
             │                                │
             ▼                                ▼
┌─────────────────────────┐      ┌─────────────────────────┐
│  PHASE_2_N_S_LEFT       │      │  PHASE_4_E_W_LEFT       │
│  (10-30s, skip if no    │      │  (10-30s, skip if no    │
│   demand)               │      │   demand)               │
│  N_left + S_left        │      │  E_left + W_left        │
│  det: 3,6               │      │  det: 9,12              │
└─────────────────────────┘      └─────────────────────────┘
```

---

## Optimization Notes

### Potential Improvements

1. **Adaptive Yellow/All-Red Timing**
   - Current: Fixed 4.0s yellow, 2.0s all-red
   - Suggestion: Calculate based on approach speed and intersection width

2. **Dynamic Gap Threshold**
   - Current: Fixed 3.0s gap threshold
   - Suggestion: Adjust based on time of day or detected congestion

3. **Left Turn Protection**
   - Current: Protected left turn phases exist but may be skipped
   - Suggestion: Increase min_green or add left turn recall for safety

4. **Pedestrian Call Integration**
   - Current: Pedestrian phases follow vehicle phases
   - Suggestion: Add pedestrian actuation with push button detection

5. **Coordination Potential**
   - Current: Fully actuated (isolated intersection)
   - Suggestion: Add arterial coordination for progression during off-peak

---

## File Reference
- Source: `rules.json`
- Generated: Documentation for optimization iterations
