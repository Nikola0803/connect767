const DEFAULT_COVER_BASE =
  "https://admin.connect767.com/wp-content/uploads/2026/10/Dominican-Talent-Branding-Poster";

export default function DefaultListingCover({ title = "Listing", compact = false }) {
  const imageUrl = `${DEFAULT_COVER_BASE}.png`;

  return (
    <div
      role="img"
      aria-label={`Connect767 default cover for ${title}`}
      className="relative isolate h-full w-full overflow-hidden bg-primary-100"
    >
      <div
        aria-hidden="true"
        className="absolute -inset-3 bg-cover bg-center opacity-20 blur-xl"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
      <img
        src={imageUrl}
        srcSet={`${DEFAULT_COVER_BASE}-768x453.png 768w, ${DEFAULT_COVER_BASE}-1024x604.png 1024w, ${DEFAULT_COVER_BASE}-1536x906.png 1536w, ${DEFAULT_COVER_BASE}.png 1632w`}
        sizes={compact ? "(max-width: 640px) 100vw, 420px" : "(max-width: 1024px) 100vw, 1200px"}
        width="1632"
        height="963"
        alt=""
        loading="lazy"
        decoding="async"
        className="relative z-10 h-full w-full max-h-full max-w-full object-contain object-center"
      />
    </div>
  );
}
