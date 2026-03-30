# Rules Documentation Index

This directory keeps a documentation snapshot for each traffic-signal rules version used in the project.

## Naming Scheme

- Preferred format: `RULES_DOCUMENTATION_v<major>_<minor>.md`
- Example: rules version `3.1` maps to `RULES_DOCUMENTATION_v3_1.md`
- Legacy snapshots are kept as-is for continuity, but new versions should follow the preferred format

## Version History

| Rules Version | Documentation File | Status | Notes |
|---------------|--------------------|--------|-------|
| 3.0 | `docs/rules/RULES_DOCUMENTATION.md` | Legacy baseline | Original documentation snapshot |
| 3.1 | `docs/rules/RULES_DOCUMENTATION_v2.md` | Legacy iteration copy | First optimized copy created after tuning |
| 3.1 | `docs/rules/RULES_DOCUMENTATION_v3_1.md` | Canonical | Preferred versioned filename using the standard scheme |

## Usage

- When `rules.json` changes, create a matching documentation snapshot in this directory
- Preserve prior files instead of overwriting them
- Add the new entry to this index so the history remains traceable
