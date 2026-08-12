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
  // Free is the default/baseline tier every listing starts at — badging it
  // the same way Classified gets badged made every card look like it was
  // wearing a status label, when "Free" isn't really a status worth calling
  // out. Only Classified (and Featured/Sale, used elsewhere) are actually
  // meaningful distinctions to flag, so a plain Free listing now shows no
  // badge at all rather than a "Free" pill.
  if (tier === "Free") return null;

  const style = styles[tier] || styles.Free;
  const sizeClass =
    size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeClass} ${style.className} ${className}`}
    >
      {style.icon && <i className={style.icon} />}
      {tier}
    </span>
  );
}
