/**
 * Shared surface classes for floating panels (menus, popovers, selects).
 *
 * The max-height uses Reka's per-component "available height" variables (only
 * the one for the current component is defined), so a long menu scrolls
 * instead of running off the bottom of the screen.
 */
export const floatingPanel =
  'anim-pop z-50 min-w-48 rounded-xl border border-border bg-surface p-1.5 text-text shadow-pop ' +
  'max-h-[var(--reka-dropdown-menu-content-available-height,var(--reka-popover-content-available-height,80dvh))] overflow-y-auto';
