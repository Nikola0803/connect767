const DEFAULT_COVER_BASE =
  "https://admin.connect767.com/wp-content/uploads/2026/10/Dominican-Talent-Opportunities-Branding-Poster";

export default function DefaultListingCover({ title = "Listing", compact = false }) {
  return (
    <div
      role="img"
      aria-label={`Connect767 default cover for ${title}`}
      className="relative h-full w-full overflow-hidden bg-primary-100"
    >
      <img
        src={`${DEFAULT_COVER_BASE}.png`}
        srcSet={`${DEFAULT_COVER_BASE}-768x453.png 768w, ${DEFAULT_COVER_BASE}-1024x604.png 1024w, ${DEFAULT_COVER_BASE}-1536x906.png 1536w, ${DEFAULT_COVER_BASE}.png 1633w`}
        sizes={compact ? "(max-width: 640px) 100vw, 420px" : "(max-width: 1024px) 100vw, 1200px"}
        width="1633"
        height="963"
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover object-center"
      />
    </div>
  );
}
