export default function DefaultListingCover({ title = "Listing", compact = false }) {
  return (
    <div
      role="img"
      aria-label={`Connect767 default cover for ${title}`}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-primary-100 via-background-50 to-accent-100 text-foreground-950"
    >
      <div
        className="absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 20%, rgba(255,255,255,.95) 0 2px, transparent 3px), radial-gradient(circle at 82% 76%, rgba(255,255,255,.85) 0 2px, transparent 3px)",
          backgroundSize: "38px 38px, 52px 52px",
        }}
        aria-hidden="true"
      />
      <div className="absolute -left-12 -top-14 h-44 w-44 rounded-full bg-primary-300/25 blur-2xl" aria-hidden="true" />
      <div className="absolute -bottom-16 -right-10 h-52 w-52 rounded-full bg-accent-300/30 blur-2xl" aria-hidden="true" />

      <div className={`relative flex flex-col items-center text-center ${compact ? "gap-2 px-5" : "gap-4 px-8"}`}>
        <div className={`flex items-center justify-center rounded-2xl border border-background-50/80 bg-background-50/80 shadow-sm backdrop-blur ${compact ? "h-14 w-14 p-2.5" : "h-24 w-24 p-4"}`}>
          <img
            src="/connect767-favicon.png"
            alt=""
            className="h-full w-full object-contain"
            aria-hidden="true"
          />
        </div>
        <div>
          <p className={`font-heading font-semibold tracking-tight ${compact ? "text-base" : "text-2xl md:text-3xl"}`}>
            Connect<span className="text-primary-700">767</span>
          </p>
          <p className={`mt-1 font-label uppercase text-foreground-600 ${compact ? "text-[9px] tracking-[0.14em]" : "text-xs tracking-[0.2em]"}`}>
            Dominican talent, services & opportunities
          </p>
        </div>
      </div>
    </div>
  );
}
