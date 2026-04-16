# Traffic Signal Control Rules Documentation
Version: 3.2 | KPI Target: Minimize Total Delay

## Overview
This document describes the throughput-first traffic signal rules used to reduce total delay by serving the heaviest and longest-waiting approach with the highest pressure score.

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
- **Max Green:** 65s
- **Passage Time:** 2.5s
- **Recall:** min_green (phase will always run at least min_green)

### Phase 2: N-S Left Turn (PHASE_2_N_S_LEFT)
- **Ring:** 1
- **Sequence:** 2
- **Movements:** N_left, S_left
- **Detectors:** det_N_left, det_S_left
- **Pedestrian Phase:** PHASE_PED_NS
- **Min Green:** 6s
- **Max Green:** 18s
- **Passage Time:** 2.0s
- **Recall:** none (phase may be skipped if no demand)

### Phase 3: E-W Through (PHASE_3_E_W_THRU)
- **Ring:** 2
- **Sequence:** 1
- **Movements:** E_thru, W_thru
- **Detectors:** det_E_thru_1, det_E_thru_2, det_W_thru_1, det_W_thru_2
- **Pedestrian Phase:** PHASE_PED_EW
- **Min Green:** 10s
- **Max Green:** 65s
- **Passage Time:** 2.5s
- **Recall:** min_green (phase will always run at least min_green)

### Phase 4: E-W Left Turn (PHASE_4_E_W_LEFT)
- **Ring:** 2
- **Sequence:** 2
- **Movements:** E_left, W_left
- **Detectors:** det_E_left, det_W_left
- **Pedestrian Phase:** PHASE_PED_EW
- **Min Green:** 6s
- **Max Green:** 18s
- **Passage Time:** 2.0s
- **Recall:** none (phase may be skipped if no demand)

---

## Ring Barrier Structure

The signal controller keeps the ring-barrier phase definitions for hardware compatibility, but the v3 controller now scores all candidate phases before selecting the next service.

- **Barrier 1:** PHASE_1_N_S_THRU → PHASE_2_N_S_LEFT
- **Barrier 2:** PHASE_3_E_W_THRU → PHASE_4_E_W_LEFT

---

## Decision Logic

### Phase-Aware Gap-Out
- **Enabled:** Yes
- **Behavior:** After minimum green, a phase can terminate once demand falls below the waiting threshold and the phase-specific `passage_time` expires.
- **Purpose:** Cut empty tail green faster than the prior global-only gap rule.

### Max-Out (Force Termination)
- **Enabled:** Yes
- **Force Change:** Yes
- **Behavior:** When `max_green` is reached, the current phase must terminate.

### Pressure-Based Phase Selection
- **Behavior:** Every candidate phase receives a pressure score based on queued vehicles and accumulated waiting time.
- **Purpose:** Prefer the phase that will reduce the most total delay rather than changing on raw opposing demand alone.

### Pressure Weights
- **Through Weight:** 1.0
- **Left Weight:** 0.6
- **Wait-Time Weight:** 0.08 per queued vehicle-second
- **Change Margin:** 2.0 pressure units
- **Purpose:** Keep throughput movements favored unless left-turn delay becomes materially harmful to total network delay.

### Service Thresholds
- **Through Queue Threshold:** 4 vehicles
- **Left Queue Threshold:** 2 vehicles
- **Demand Waiting Threshold:** 1 vehicle
- **Purpose:** Avoid wasting phases on tiny calls while still allowing smaller protected left queues to be served before they become high-delay outliers.

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
│  (10-65s)               │      │  (10-65s)               │
│  N_thru + S_thru        │      │  E_thru + W_thru        │
│  det: 1,2,4,5           │      │  det: 7,8,10,11         │
└────────────┬────────────┘      └────────────┬────────────┘
             │                                │
             ▼                                ▼
┌─────────────────────────┐      ┌─────────────────────────┐
│  PHASE_2_N_S_LEFT       │      │  PHASE_4_E_W_LEFT       │
│  (6-18s, skip if no     │      │  (6-18s, skip if no     │
│   demand)               │      │   demand)               │
│  N_left + S_left        │      │  E_left + W_left        │
│  det: 3,6               │      │  det: 9,12              │
└─────────────────────────┘      └─────────────────────────┘
```

---

## Optimization Notes

### Version 3.2 Tuning Changes

1. **Pressure-Based Change Decisions**
   - Replaced opposing-ring-only demand checks with all-phase pressure scoring
   - Purpose: switch to the phase that removes the most total delay

2. **Per-Phase Gap-Out Using Passage Time**
   - Through phases use 2.5s passage time
   - Left-turn phases use 2.0s passage time
   - Purpose: reduce empty tail green without over-cutting active demand

3. **Lower Through-Phase Maximum Greens**
   - Through phases reduced from 75s to 65s
   - Purpose: limit overservice under saturated dominant-corridor runs and reallocate sooner when other queues are building

4. **Throughput-Weighted Candidate Selection**
   - Through queues receive higher base weight than protected left queues
   - Waiting time still increases pressure over time
   - Purpose: keep the controller focused on discharging the most vehicles while still containing long-delay outliers

5. **Separate Through and Left Service Thresholds**
   - Through threshold stays at 4 vehicles
   - Left threshold reduced to 2 vehicles
   - Purpose: prevent tiny left calls from stealing green too early while avoiding excessive left-turn queue growth

---

## File Reference
- Source: `rules.json`
- Version Snapshot: `docs/rules/RULES_DOCUMENTATION_v3_2.md`
- Generated: Documentation copy for optimization iteration v3 / rules version 3.2
