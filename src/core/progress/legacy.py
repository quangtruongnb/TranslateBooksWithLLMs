"""Bridge from the legacy ad-hoc stats dicts to the unified snapshot.

This is the Step 2 seam. Engines still emit their three historical shapes
(the bare ``{total,completed,failed}`` dict, the rich ``TranslationMetrics``
dict, and the token-tracker dict), merged with the ``_workflow_meta`` phase
hints in ``handlers.py``. This function turns that merged dict into a
:class:`ProgressSnapshot` so a single canonical ``percent`` / ``phase`` can be
emitted alongside the legacy fields.

The percent math here mirrors the *frontend's current* bar logic
(``progress-manager.js`` ``update()``) byte-for-byte, including the
``progress_percent`` passthrough, so that when the frontend switches to
reading the server-sent ``percent`` (Step 3) the displayed value does not
change. Once the engines themselves drive a :class:`ProgressTracker`
(Steps 5–6), this bridge — and the legacy fields — can be deleted.
"""

from __future__ import annotations

from typing import Any, Dict

from .snapshot import Phase, ProgressSnapshot, global_percent

_REFINE_SPLIT = 50.0


def _as_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def snapshot_from_legacy_stats(stats: Dict[str, Any]) -> ProgressSnapshot:
    """Derive a :class:`ProgressSnapshot` from a merged legacy stats dict."""
    total = _as_int(stats.get("total_chunks"))
    done = _as_int(stats.get("completed_chunks"))
    failed = _as_int(stats.get("failed_chunks"))
    enable_refinement = bool(stats.get("enable_refinement"))
    refine_only = bool(stats.get("refine_only"))
    phase_num = stats.get("current_phase") or 1

    if enable_refinement:
        # Two-phase refine-after: translation in [0, 50], refinement in [50, 100].
        phase = Phase.REFINING if phase_num == 2 else Phase.TRANSLATING
        percent = global_percent(phase, done, total, True, _REFINE_SPLIT)
        refinement_enabled = True
    else:
        phase = Phase.REFINING if refine_only else Phase.TRANSLATING
        progress_percent = stats.get("progress_percent")
        # Mirror the frontend: a single-phase run trusts a server-sent
        # progress_percent when present, else falls back to chunk ratio.
        if isinstance(progress_percent, (int, float)) and not isinstance(
            progress_percent, bool
        ):
            percent = min(max(float(progress_percent), 0.0), 100.0)
        else:
            percent = global_percent(phase, done, total, False)
        refinement_enabled = False

    succeeded = max(0, done - failed)
    return ProgressSnapshot(
        phase=phase,
        units_done=done,
        units_total=total,
        units_succeeded=succeeded,
        units_failed=failed,
        percent=percent,
        refinement_enabled=refinement_enabled,
    )
