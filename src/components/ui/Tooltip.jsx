import { useId, useState } from "react";

/**
 * Hover/focus tooltip for explaining controls.
 *
 * Uses CSS positioning rather than a portal so it inherits the studio's dark
 * surface without extra plumbing. Shows on focus as well as hover, so the
 * explanation is reachable by keyboard and not just by mouse — and is wired
 * up with aria-describedby so screen readers get the same description
 * sighted users do, instead of a bare icon name.
 */

const PLACEMENTS = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export default function Tooltip({
  label,
  description,
  placement = "right",
  className = "",
  children,
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>

      {open && (
        <span
          id={id}
          role="tooltip"
          className={`absolute z-50 w-max max-w-[220px] px-2.5 py-2 rounded-lg bg-foreground-950 text-background-50 shadow-xl border border-white/10 pointer-events-none ${PLACEMENTS[placement]}`}
        >
          <span className="block text-[11px] font-semibold leading-tight">{label}</span>
          {description && (
            <span className="block text-[10px] leading-snug text-background-50/70 mt-0.5 font-label">
              {description}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
