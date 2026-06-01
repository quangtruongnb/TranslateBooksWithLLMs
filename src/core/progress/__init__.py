"""Unified progress domain model for the translation/refine pipeline.

This package defines the single source of truth for progress reporting:

* :class:`Phase` — the coarse phase of work (translating vs refining).
* :class:`ProgressSnapshot` — an immutable, serializable view of progress at
  a point in time. ``percent`` is the *global* 0–100 value the UI displays;
  no consumer recomputes it.
* :class:`ProgressTracker` — the single authority that owns the totals, the
  phase, and the percent math (including the two-phase segment mapping that
  replaces the ad-hoc "double the total when refining" trick scattered across
  the legacy code).

Formats are meant to become simple *unit producers*: they call
``record_unit()`` once per translated/refined unit and never compute a
percentage themselves. This module is intentionally not wired into any
pipeline yet (Step 1 of the progress-system refactor) — it is introduced and
unit-tested in isolation first.
"""

from .legacy import snapshot_from_legacy_stats
from .snapshot import Phase, ProgressSnapshot, global_percent
from .tracker import ProgressTracker

__all__ = [
    "Phase",
    "ProgressSnapshot",
    "ProgressTracker",
    "global_percent",
    "snapshot_from_legacy_stats",
]
