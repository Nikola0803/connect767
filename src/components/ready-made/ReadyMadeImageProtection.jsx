const LOGO = "/connect767-ai-logo-transparent.png?v=20261117";

export function ReadyMadeImageWatermark({ compact = false }) {
  return <div data-testid="ready-made-image-watermark" aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none">
    <img src={LOGO} alt="" draggable="false" style={{ transform: "translate(-50%, -50%) translate(2px, 2px)" }} className={`absolute left-1/2 top-1/2 object-contain grayscale brightness-0 ${compact ? "h-[62%] w-[62%] opacity-[0.10]" : "h-[72%] w-[72%] opacity-[0.13]"}`} />
    <img src={LOGO} alt="" draggable="false" style={{ transform: "translate(-50%, -50%) translate(-1px, -1px)" }} className={`absolute left-1/2 top-1/2 object-contain grayscale brightness-0 invert ${compact ? "h-[62%] w-[62%] opacity-[0.18]" : "h-[72%] w-[72%] opacity-[0.24]"}`} />
    {!compact && ["16%", "49%", "82%"].map((top) => <span key={top} className="absolute left-1/2 -translate-x-1/2 -rotate-[18deg] whitespace-nowrap text-[clamp(8px,1vw,14px)] font-black uppercase tracking-[0.28em] text-foreground-950/[0.12]" style={{ top }}>Connect767 Protected Preview</span>)}
  </div>;
}

export function ReadyMadeCaptureShield({ active }) {
  if (!active) return null;
  return <div data-testid="ready-made-capture-shield" role="status" className="fixed inset-0 z-[200] grid place-items-center bg-foreground-950/95 p-6 text-center text-white backdrop-blur-2xl">
    <span><i className="ri-shield-keyhole-line text-5xl text-primary-300" aria-hidden="true" /><strong className="mt-3 block font-heading text-2xl">Protected Ready-Made Preview</strong><span className="mt-2 block max-w-md text-sm leading-relaxed text-white/65">Screen capture, copying, downloading and printing are disabled. Every preview remains visibly watermarked.</span></span>
  </div>;
}
