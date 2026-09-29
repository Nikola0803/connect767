export default function StarRating({ rating, size = "text-xs", showValue = false }) {
  const numeric = parseFloat(rating) || 0;
  const full = Math.round(numeric);

  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <i
            key={i}
            className={`${size} ${
              i < full ? "ri-star-fill text-accent-500" : "ri-star-line text-foreground-300"
            }`}
          />
        ))}
      </span>
      {showValue && (
        <span className="text-sm font-semibold text-foreground-950">{rating}</span>
      )}
    </span>
  );
}
