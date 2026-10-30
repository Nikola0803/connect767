export default function BrandLogo({
  className = "",
  compactOnNarrow = false,
  markFilter = "none",
  size = "default",
}) {
  const large = size === "large";
  const markSize = large ? "h-9 w-9 sm:h-10 sm:w-10" : "h-8 w-8 sm:h-9 sm:w-9";
  const textSize = large ? "text-xl sm:text-2xl" : "text-lg sm:text-xl md:text-[1.4rem]";

  return (
    <span className={`group inline-flex min-w-0 items-center gap-0 ${className}`}>
      <span
        className={`grid ${markSize} -mr-0.5 flex-shrink-0 place-items-center transition-transform duration-300 group-hover:-rotate-2 group-hover:scale-[1.04]`}
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
            transform: "translateY(-1px) scale(1.14)",
            transformOrigin: "center",
          }}
        />
      </span>
      <span
        aria-hidden="true"
        className={`${
          compactOnNarrow ? "hidden min-[350px]:inline-flex" : "inline-flex"
        } -ml-0.5 items-baseline font-label ${textSize} font-extrabold leading-none tracking-[-0.055em]`}
      >
        <span>ONNECT</span>
        <span className="ml-0.5 text-accent-500 tracking-[-0.035em]">767</span>
      </span>
    </span>
  );
}
