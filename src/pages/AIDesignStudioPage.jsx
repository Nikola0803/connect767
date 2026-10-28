import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// ─── Data ─────────────────────────────────────────────────────────────────────

const PRODUCT_TYPES = [
  { id: "t-shirt",   label: "T-Shirt",   icon: "ri-t-shirt-line",      desc: "Classic crew or v-neck tee" },
  { id: "jersey",    label: "Jersey",    icon: "ri-football-line",      desc: "Sports performance jersey" },
  { id: "hoodie",    label: "Hoodie",    icon: "ri-temp-cold-line",     desc: "Pullover or zip-up sweatshirt" },
  { id: "polo",      label: "Polo",      icon: "ri-shirt-line",         desc: "Collared polo shirt" },
  { id: "cap",       label: "Cap",       icon: "ri-landscape-line",     desc: "Snapback or fitted cap" },
  { id: "tote-bag",  label: "Tote Bag",  icon: "ri-shopping-bag-line",  desc: "Canvas carry-all bag" },
];

const STYLES = [
  { id: "modern-bold",      label: "Modern & Bold",     desc: "Strong geometry, high contrast, clean lines",        palette: ["#111111","#FFFFFF","#00CC66"] },
  { id: "classic-clean",    label: "Classic & Clean",   desc: "Timeless typography, balanced layout",               palette: ["#1A2A4A","#FFFFFF","#C8A96E"] },
  { id: "minimal-elegant",  label: "Minimal & Elegant", desc: "Lots of whitespace, refined detail, subtle accents", palette: ["#F5F0EB","#2D2D2D","#888888"] },
  { id: "retro-vintage",    label: "Retro & Vintage",   desc: "Distressed texture, varsity lettering, aged feel",   palette: ["#D4572A","#F7E8C8","#4A3728"] },
  { id: "street-edgy",      label: "Street & Edgy",     desc: "Urban energy, bold type, raw attitude",              palette: ["#000000","#FF2D55","#FFCC00"] },
];

const PRESETS_A = ["#111111","#1A2A4A","#D4572A","#00CC66","#4A90D9"];
const PRESETS_B = ["#FFFFFF","#C8A96E","#FF2D55","#FFCC00","#7B2FBE"];

// ─── Components ───────────────────────────────────────────────────────────────

function StepBar({ current }) {
  const steps = ["Product","Style","Details","Generate","Result"];
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${done ? "bg-primary-500 text-white" : active ? "bg-foreground-950 text-background-50" : "bg-background-200 text-foreground-400"}`}>
                {done ? <i className="ri-check-line text-sm" /> : i + 1}
              </div>
              <span className={`text-[10px] font-label whitespace-nowrap ${active ? "text-foreground-950 font-semibold" : "text-foreground-400"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-8 sm:w-12 mx-1 mb-4 transition-colors ${done ? "bg-primary-500" : "bg-background-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Card({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer
        ${selected
          ? "border-primary-500 bg-primary-50 shadow-sm"
          : "border-background-200 bg-background-50 hover:border-background-300 hover:bg-background-100"
        }`}
    >
      {children}
    </button>
  );
}

function NavBtn({ onClick, disabled, children, primary }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
        ${primary
          ? "bg-primary-500 text-white hover:bg-primary-600"
          : "border border-background-200 text-foreground-700 hover:bg-background-100"
        }`}
    >
      {children}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AIDesignStudioPage() {
  const [step, setStep]               = useState(0);
  const [productType, setProductType] = useState(null);
  const [style, setStyle]             = useState(null);
  const [brandName, setBrandName]     = useState("");
  const [tagline, setTagline]         = useState("");
  const [primaryColor, setPrimary]    = useState("#111111");
  const [secondaryColor, setSecondary] = useState("#FFFFFF");
  const [notes, setNotes]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [result, setResult]           = useState(null);
  const [dots, setDots]               = useState(1);
  const intervalRef                   = useRef(null);

  const selectedProduct = PRODUCT_TYPES.find(p => p.id === productType);
  const selectedStyle   = STYLES.find(s => s.id === style);

  // Cleanup interval on unmount
  useEffect(() => () => clearInterval(intervalRef.current), []);

  const startDots = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => setDots(d => d === 3 ? 1 : d + 1), 600);
  };

  const stopDots = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const generate = async () => {
    setStep(3);
    setLoading(true);
    setError(null);
    setResult(null);
    startDots();

    try {
      const res = await fetch("/api/generate-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType: selectedProduct?.label,
          style:       selectedStyle?.label,
          brandName,
          tagline,
          primaryColor,
          secondaryColor,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setResult(data);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      stopDots();
      setLoading(false);
    }
  };

  const tryAgain = () => {
    setStep(2);
    setError(null);
    setResult(null);
  };

  const downloadImage = () => {
    if (!result?.b64) return;
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${result.b64}`;
    a.download = `${brandName.replace(/\s+/g,"-").toLowerCase()}-design.png`;
    a.click();
  };

  // ─── Layout ─────────────────────────────────────────────────────────────────
  // h-[100dvh] + inner overflow-y-auto so it works inside the chromeless Chrome wrapper

  return (
    <div className="h-[100dvh] bg-background-50 flex flex-col">

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-background-200 bg-background-50">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-label text-foreground-600 hover:text-foreground-950 transition-colors">
          <i className="ri-arrow-left-line" />
          Back
        </Link>
        <p className="text-xs font-label font-semibold uppercase tracking-widest text-foreground-500">
          AI Design Studio
        </p>
        <div className="w-14" />
      </div>

      {/* ── Step bar ── */}
      {step < 4 && (
        <div className="flex-shrink-0 flex justify-center py-4 border-b border-background-100">
          <StepBar current={step} />
        </div>
      )}

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Step 0 — Product */}
        {step === 0 && (
          <div className="max-w-2xl mx-auto px-4 py-8">
            <h1 className="font-heading text-2xl font-light text-foreground-950 mb-1">What are we designing?</h1>
            <p className="text-sm text-foreground-500 font-label mb-6">Pick the product you want a design for.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
              {PRODUCT_TYPES.map(p => (
                <Card key={p.id} selected={productType === p.id} onClick={() => setProductType(p.id)}>
                  <i className={`${p.icon} text-2xl mb-2 block ${productType === p.id ? "text-primary-600" : "text-foreground-400"}`} />
                  <p className="font-label font-semibold text-sm text-foreground-950">{p.label}</p>
                  <p className="text-[11px] text-foreground-500 mt-0.5 font-label">{p.desc}</p>
                </Card>
              ))}
            </div>
            <div className="flex justify-end">
              <NavBtn primary disabled={!productType} onClick={() => setStep(1)}>
                Next — Choose style <i className="ri-arrow-right-line" />
              </NavBtn>
            </div>
          </div>
        )}

        {/* Step 1 — Style */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto px-4 py-8">
            <h1 className="font-heading text-2xl font-light text-foreground-950 mb-1">What's the vibe?</h1>
            <p className="text-sm text-foreground-500 font-label mb-6">This shapes how the AI interprets your design.</p>
            <div className="flex flex-col gap-3 mb-8">
              {STYLES.map(s => (
                <Card key={s.id} selected={style === s.id} onClick={() => setStyle(s.id)}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-label font-semibold text-sm text-foreground-950">{s.label}</p>
                      <p className="text-[11px] text-foreground-500 mt-0.5 font-label">{s.desc}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {s.palette.map(c => (
                        <div key={c} className="w-5 h-5 rounded-full border border-black/10" style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <div className="flex justify-between">
              <NavBtn onClick={() => setStep(0)}><i className="ri-arrow-left-line" /> Back</NavBtn>
              <NavBtn primary disabled={!style} onClick={() => setStep(2)}>
                Next — Your details <i className="ri-arrow-right-line" />
              </NavBtn>
            </div>
          </div>
        )}

        {/* Step 2 — Details */}
        {step === 2 && (
          <div className="max-w-2xl mx-auto px-4 py-8">
            <h1 className="font-heading text-2xl font-light text-foreground-950 mb-1">Tell us about your brand</h1>
            <p className="text-sm text-foreground-500 font-label mb-6">The more specific you are, the better the result.</p>

            <div className="flex flex-col gap-5 mb-8">
              {/* Brand name */}
              <div>
                <label className="block text-xs font-label font-semibold text-foreground-700 mb-1.5 uppercase tracking-wide">
                  Brand / Team Name <span className="text-accent-500">*</span>
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={e => setBrandName(e.target.value)}
                  placeholder="e.g. Island FC, Zola's Café, Team 767"
                  className="w-full px-4 py-3 rounded-xl border border-background-200 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 font-label text-sm"
                />
              </div>

              {/* Tagline */}
              <div>
                <label className="block text-xs font-label font-semibold text-foreground-700 mb-1.5 uppercase tracking-wide">
                  Tagline <span className="text-foreground-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  placeholder="e.g. Born to Run, Made in 767, Est. 2020"
                  className="w-full px-4 py-3 rounded-xl border border-background-200 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 font-label text-sm"
                />
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Primary Color",   val: primaryColor,   set: setPrimary,   presets: PRESETS_A },
                  { label: "Secondary Color", val: secondaryColor, set: setSecondary, presets: PRESETS_B },
                ].map(({ label, val, set, presets }) => (
                  <div key={label}>
                    <label className="block text-xs font-label font-semibold text-foreground-700 mb-1.5 uppercase tracking-wide">{label}</label>
                    <div className="flex gap-1.5 mb-2">
                      {presets.map(c => (
                        <button key={c} type="button" onClick={() => set(c)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${val === c ? "border-primary-500 scale-110" : "border-background-200"}`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    <input type="color" value={val} onChange={e => set(e.target.value)}
                      className="w-full h-10 rounded-lg border border-background-200 cursor-pointer p-0.5 bg-background-50"
                    />
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-label font-semibold text-foreground-700 mb-1.5 uppercase tracking-wide">
                  Anything else? <span className="text-foreground-400 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Include a football, tropical leaf motifs, keep it professional, no text on the back"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-background-200 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 font-label text-sm resize-none"
                />
              </div>

              {/* Summary */}
              <div className="rounded-2xl bg-background-100 border border-background-200 p-4">
                <p className="text-[10px] font-label font-semibold text-foreground-400 uppercase tracking-wide mb-2">Your brief</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-semibold font-label">{selectedProduct?.label}</span>
                  <span className="px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-800 text-xs font-semibold font-label">{selectedStyle?.label}</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background-50 border border-background-200 text-xs font-label">
                    <span className="w-3 h-3 rounded-full border border-black/10" style={{ background: primaryColor }} />
                    <span className="w-3 h-3 rounded-full border border-black/10" style={{ background: secondaryColor }} />
                    Colors
                  </span>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-label">
                  <i className="ri-error-warning-line mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <NavBtn onClick={() => setStep(1)}><i className="ri-arrow-left-line" /> Back</NavBtn>
              <NavBtn primary disabled={!brandName.trim() || loading} onClick={generate}>
                <i className="ri-sparkling-2-fill" /> Generate Design
              </NavBtn>
            </div>
          </div>
        )}

        {/* Step 3 — Generating */}
        {step === 3 && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 py-16 text-center">
            <div className={`w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mb-6 ${loading ? "animate-pulse" : ""}`}>
              <i className={`ri-sparkling-2-fill text-primary-600 text-3xl ${loading ? "" : "opacity-40"}`} />
            </div>
            {loading ? (
              <>
                <h2 className="font-heading text-2xl font-light text-foreground-950 mb-2">
                  Creating your design{"." .repeat(dots)}
                </h2>
                <p className="text-sm text-foreground-500 font-label max-w-sm leading-relaxed">
                  Generating a <strong>{selectedProduct?.label}</strong> in <strong>{selectedStyle?.label}</strong> style for{" "}
                  <strong>{brandName}</strong>. This takes about 20–30 seconds.
                </p>
              </>
            ) : error ? (
              <>
                <h2 className="font-heading text-xl font-medium text-foreground-950 mb-2">Generation failed</h2>
                <p className="text-sm text-red-600 font-label mb-6 max-w-sm">{error}</p>
                <NavBtn onClick={tryAgain}><i className="ri-arrow-left-line" /> Go back and try again</NavBtn>
              </>
            ) : null}
          </div>
        )}

        {/* Step 4 — Result */}
        {step === 4 && result && (
          <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                <i className="ri-check-line text-white text-sm" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-medium text-foreground-950">Your design is ready</h1>
                <p className="text-xs text-foreground-500 font-label">1024 × 1024 px · print-ready PNG</p>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden border border-background-200 bg-white mb-5">
              <img
                src={`data:image/png;base64,${result.b64}`}
                alt={`AI generated ${selectedProduct?.label} design for ${brandName}`}
                className="w-full"
              />
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              <span className="px-2.5 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-semibold font-label">{selectedProduct?.label}</span>
              <span className="px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-800 text-xs font-semibold font-label">{selectedStyle?.label}</span>
              <span className="px-2.5 py-1 rounded-full bg-background-100 border border-background-200 text-foreground-700 text-xs font-label">{brandName}</span>
              {tagline && <span className="px-2.5 py-1 rounded-full bg-background-100 border border-background-200 text-foreground-700 text-xs font-label">"{tagline}"</span>}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={downloadImage}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-foreground-950 text-background-50 text-sm font-semibold hover:bg-foreground-800 transition-colors cursor-pointer"
              >
                <i className="ri-download-2-line" /> Download PNG
              </button>
              <Link
                to="/uniforms"
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer"
              >
                <i className="ri-shirt-line" /> Order Uniforms
              </Link>
              <button
                type="button"
                onClick={tryAgain}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full border border-background-200 text-foreground-700 text-sm font-semibold hover:bg-background-100 transition-colors cursor-pointer"
              >
                <i className="ri-refresh-line" /> Regenerate
              </button>
            </div>

            {result.revisedPrompt && (
              <details className="mt-5">
                <summary className="text-xs text-foreground-400 font-label cursor-pointer hover:text-foreground-600 select-none">
                  Show AI prompt used
                </summary>
                <p className="mt-2 text-xs text-foreground-500 font-label leading-relaxed bg-background-100 p-3 rounded-xl">
                  {result.revisedPrompt}
                </p>
              </details>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
