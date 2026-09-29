"use client";

/**
 * lib/hooks/use-body-scroll-lock.ts
 * -----------------------------------------------------------------------
 * Locks window-level scrolling while an overlay (modal / detail view) is
 * open, and restores the previous value on close/unmount.
 *
 * Why: every dashboard modal in this app is a `position: fixed` overlay.
 * Without a lock, a wheel/touch gesture over the overlay chains through to
 * the document behind it, so the page underneath keeps scrolling "down the
 * page" while the modal itself stays put — the user ends up far from where
 * they opened it once the modal closes. With the lock, the ONLY scrollable
 * region while the overlay is open is the overlay's own internal
 * `overflow-y-auto` body.
 *
 * Also compensates for the scrollbar width (padding-right) so the page
 * behind doesn't jump sideways when the scrollbar disappears on desktop.
 *
 * Same "save previous value, restore on cleanup" approach SiteNav.tsx
 * already uses for its mobile menu, so the two never clobber each other.
 */

import { useEffect } from "react";

export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [locked]);
}
