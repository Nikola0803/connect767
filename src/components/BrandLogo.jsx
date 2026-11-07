export default function BrandLogo({
  className = "",
  markFilter = "none",
  size = "default",
}) {
  const large = size === "large";
  const markSize = large ? "h-9 w-9 sm:h-10 sm:w-10" : "h-8 w-8 sm:h-9 sm:w-9";

  return (
    <span
      aria-label="Connect767"
      className={`group inline-flex items-center ${className}`}
    >
      <span
        className={`grid ${markSize} flex-shrink-0 place-items-center transition-transform duration-300 group-hover:-rotate-2 group-hover:scale-[1.04]`}
      >
        <span
          aria-hidden="true"
          className={markSize}
          style={{
            backgroundColor: "currentColor",
            WebkitMaskImage: "url('/connect767-favicon.png')",
            maskImage: "url('/connect767-favicon.png')",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            filter: markFilter,
            transform: "scale(1.14)",
            transformOrigin: "center",
          }}
        />
      </span>
    </span>
  );
}
