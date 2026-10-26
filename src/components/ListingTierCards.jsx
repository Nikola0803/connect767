import { Link } from "react-router-dom";

const listingTierPlans = {
  free: {
    eyebrow: "Free plan",
    title: "Free Listing",
    description: "Get started and list your business for free.",
    price: "$0",
    cadence: "forever",
    action: "Start Free",
    href: "/listings/submit?tier=free",
    features: [
      ["ri-calendar-line", "Online bookings"],
      ["ri-price-tag-3-line", "Display pricing"],
      ["ri-file-list-3-line", "1 listing"],
      ["ri-customer-service-2-line", "24/7 support"],
    ],
  },
  classified: {
    eyebrow: "Featured plan",
    title: "Classified",
    description: "Stand out and reach more customers.",
    price: "$40",
    cadence: "/year",
    note: "One-time payment for 12 months.",
    action: "Go Classified",
    href: "/listings/submit?tier=classified",
    features: [
      ["ri-shield-check-line", "Verified profile badge"],
      ["ri-calendar-line", "Online bookings"],
      ["ri-price-tag-3-line", "Display pricing"],
      ["ri-file-list-3-line", "Up to 15 listings"],
      ["ri-star-line", "Premium homepage placement (up to 3 months)"],
      ["ri-user-line", "Featured business profile (provided by client)"],
      ["ri-line-chart-line", "Featured on Trending Listings"],
      ["ri-share-line", "Social media promotion"],
      ["ri-customer-service-2-line", "24/7 support"],
    ],
  },
};

function PlanAction({ planKey, plan, selected, onSelect }) {
  const className = `mt-auto inline-flex w-full items-center justify-center gap-3 rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
    planKey === "classified"
      ? "bg-accent-500 hover:bg-accent-600 focus-visible:ring-accent-400"
      : "bg-primary-950 hover:bg-primary-900 focus-visible:ring-primary-600"
  }`;

  const content = (
    <>
      <span>{onSelect && selected ? "Selected" : plan.action}</span>
      <i className={onSelect && selected ? "ri-check-line" : "ri-arrow-right-line"} aria-hidden="true" />
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelect(planKey);
        }}
        className={className}
        aria-pressed={selected}
      >
        {content}
      </button>
    );
  }

  return (
    <Link to={plan.href} className={className}>
      {content}
    </Link>
  );
}

function FullTierCard({ planKey, selected, onSelect }) {
  const plan = listingTierPlans[planKey];
  const isClassified = planKey === "classified";

  return (
    <article
      onClick={onSelect ? () => onSelect(planKey) : undefined}
      onKeyDown={onSelect ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(planKey);
        }
      } : undefined}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      aria-label={onSelect ? `Select ${plan.title}` : undefined}
      className={`relative flex h-full min-h-[540px] flex-col overflow-hidden rounded-2xl border bg-background-50 p-6 text-foreground-950 shadow-[0_16px_42px_rgba(49,77,62,0.08)] transition-all duration-300 md:p-7 ${
        isClassified ? "border-accent-300" : "border-background-300"
      } ${onSelect ? "cursor-pointer" : ""} ${selected ? "ring-2 ring-primary-500 ring-offset-2" : "hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(49,77,62,0.12)]"}`}
    >
      {isClassified && (
        <span className="absolute right-5 top-5 inline-flex items-center rounded-full bg-accent-500 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white shadow-sm">
          Most Popular
        </span>
      )}

      <header className="mb-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.26em] text-primary-900">
          {plan.eyebrow}
        </span>
        <span className="mt-3 block h-0.5 w-9 bg-primary-400" aria-hidden="true" />
        <h3 className="mt-5 font-heading text-3xl font-medium leading-none text-primary-950 md:text-4xl">
          {plan.title}
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-snug text-foreground-700">
          {plan.description}
        </p>
      </header>

      <div className="mb-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-heading text-5xl font-light leading-none text-primary-950">
            {plan.price}
          </span>
          <span className="text-sm text-foreground-700">{plan.cadence}</span>
        </div>
        {plan.note && <p className="mt-1.5 text-sm text-foreground-700">{plan.note}</p>}
      </div>

      <ul className="mb-6 space-y-2.5 border-t border-background-300 pt-5">
        {plan.features.map(([icon, label]) => (
          <li key={label} className="flex items-center gap-3 text-xs leading-snug text-foreground-800">
            <i className={`${icon} w-5 shrink-0 text-lg text-primary-900`} aria-hidden="true" />
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <PlanAction planKey={planKey} plan={plan} selected={selected} onSelect={onSelect} />
    </article>
  );
}

function CompactTierCard({ planKey, selected, onSelect }) {
  const plan = listingTierPlans[planKey];
  const isClassified = planKey === "classified";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(planKey)}
      aria-pressed={selected}
      className={`relative overflow-hidden rounded-2xl border bg-background-50 p-4 text-left text-foreground-950 transition-all ${
        isClassified ? "border-accent-300" : "border-background-300"
      } ${selected ? "ring-3 ring-accent-300" : "hover:-translate-y-0.5 hover:shadow-md"}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-900">
        {plan.eyebrow}
      </span>
      <span className="mt-2 flex items-end justify-between gap-3">
        <span>
          <span className="block font-heading text-xl font-semibold text-primary-950">{plan.title}</span>
          <span className="mt-1 block text-xs text-foreground-600">{plan.description}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-heading text-2xl text-primary-950">{plan.price}</span>
          <span className="block text-[10px] text-foreground-500">{plan.cadence}</span>
        </span>
      </span>
      {selected && (
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent-500 text-white">
          <i className="ri-check-line" aria-hidden="true" />
        </span>
      )}
    </button>
  );
}

export default function ListingTierCards({ selectedTier = "", onSelect, compact = false, scale = 1, className = "" }) {
  const Card = compact ? CompactTierCard : FullTierCard;

  return (
    <div
      className={`grid grid-cols-1 gap-6 md:grid-cols-2 ${scale === 1 ? "" : "md:[zoom:var(--listing-tier-scale)]"} ${className}`}
      data-visual-scale={scale}
      style={scale === 1 ? undefined : { "--listing-tier-scale": scale }}
    >
      {Object.keys(listingTierPlans).map((planKey) => (
        <Card
          key={planKey}
          planKey={planKey}
          selected={selectedTier === planKey}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
