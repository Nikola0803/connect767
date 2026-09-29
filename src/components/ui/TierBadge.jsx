const styles = {
  Classified: {
    className: "bg-primary-500 text-background-50",
    icon: "ri-vip-crown-line",
  },
  Featured: {
    className: "bg-accent-500 text-background-50",
    icon: "ri-star-line",
  },
  Free: {
    className: "bg-secondary-100 text-secondary-900 border border-secondary-200",
    icon: "ri-price-tag-3-line",
  },
  Sale: {
    className: "bg-accent-500 text-background-50",
    icon: null,
  },
};

/**
 * Tier / status badge used on listing cards, product cards, and detail pages.
 * Mirrors what will come back as a WooCommerce/CPT "featured" or "tier" meta
 * field or taxonomy term once the WordPress plugin is wired up.
 */
export default function TierBadge({ tier, size = "md", className = "" }) {
  /*
   * Only paid//promoted tiers get a badge.
   *
   * "Free" is the baseline every listing starts at — labelling it advertises
   * that a business hasn't paid, which flatters nobody, so it renders nothing.
   *
   * Matched case-insensitively against a known list rather than by comparing
   * to the single string "Free". The old guard was `tier === "Free"`, so an
   * empty, missing or differently-cased tier slipped past it and fell through
   * to the Free styling with `{tier}` as its label — painting an EMPTY
   * coloured pill onto the card image. WordPress meta is easily any of those
   * (unset on an imported listing, lowercase from a hand edit), so the check
   * needs to be about what IS badge-worthy, not what isn't.
   */
  const key = String(tier || "").trim().toLowerCase();
  const match = Object.keys(styles).find((k) => k.toLowerCase() === key);
  if (!match || match === "Free") return null;

  const style = styles[match];
  const sizeClass =
    size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeClass} ${style.className} ${className}`}
    >
      {style.icon && <i className={style.icon} />}
      {match}
    </span>
  );
}
