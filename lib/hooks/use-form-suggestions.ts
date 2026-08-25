"use client";

/**
 * lib/hooks/use-form-suggestions.ts
 * -----------------------------------------------------------------------
 * Thin client-side loader over getFormSuggestionsAction(), used by
 * CreatePassportModal (Grade, Manufacturer) and BatchDetailsModal
 * (Chain-of-Custody Participant Name) to power their autocomplete
 * fields. `enabled` lets each caller gate the fetch on the modal actually
 * being open — modals mount before `open` flips true in this app's own
 * pattern, so fetching unconditionally on mount would fire a network call
 * every time a hidden modal's component tree exists, not just when a user
 * opens it.
 *
 * Fetches once per "became enabled" transition, not on every re-render —
 * a stale-for-a-few-minutes suggestion list (e.g. missing a grade name
 * typed in a sibling tab seconds ago) is a fine trade-off for a feature
 * that's explicitly supposed to stay out of the way, not add a spinner to
 * the form. A failed fetch degrades to an empty suggestion list rather
 * than surfacing an error — every field this backs remains a perfectly
 * normal, fully typeable text input either way, so autocomplete is pure
 * upside, never a blocker.
 */

import { useEffect, useRef, useState } from "react";
import { getFormSuggestionsAction } from "@/lib/actions/get-form-suggestions";
import type { FormSuggestions } from "@/lib/services/form-suggestions";

const EMPTY_SUGGESTIONS: FormSuggestions = {
  grades: [],
  manufacturers: [],
  chainOfCustodyParticipantNames: [],
};

export function useFormSuggestions(enabled: boolean) {
  const [suggestions, setSuggestions] = useState<FormSuggestions>(EMPTY_SUGGESTIONS);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled || fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;

    setLoading(true);
    getFormSuggestionsAction()
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data) setSuggestions(res.data);
      })
      .catch((err) => {
        console.error("useFormSuggestions: getFormSuggestionsAction failed:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { suggestions, loading };
}
