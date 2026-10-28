import { useState } from "react";
import { Link } from "react-router-dom";

// ─── Step data ────────────────────────────────────────────────────────────────

const PRODUCT_TYPES = [
  { id: "t-shirt", label: "T-Shirt", icon: "ri-t-shirt-line", desc: "Classic crew or v-neck tee" },
  { id: "jersey", label: "Jersey", icon: "ri-football-line", desc: "Sports performance jersey" },
  { id: "hoodie", label: "Hoodie", icon: "ri-cloud-windy-line", desc: "Pullover or zip-up sweatshirt" },
  { id: "polo", label: "Polo", icon: "ri-shirt-line", desc: "Collared polo shirt" },
  { id: "cap", label: "Cap", icon: "ri-landscape-line", desc: "Snapback or fitted cap" },
  { id: "tote-bag", label: "Tote Bag", icon: "ri-shopping-bag-line", desc: "Canvas carry-all bag" },
];

const STYLES = [
  {
    id: "modern-bold",
    label: "Modern & Bold",
    desc: "Strong geometry, high contrast, clean lines",
    palette: ["#111111", "#FFFFFF", "#00CC66"],
  },
  {
    id: "classic-clean",
    label: "Classic & Clean",
    desc: "Timeless typography, balanced layout",
    palette: ["#1A2A4A", "#FFFFFF", "#C8A96E"],
  },
  {
    id: "minimal-elegant",
    label: "Minimal & Elegant",
    desc: "Lots of space, refined detail, subtle accents",
    palette: ["#F5F0EB", "#2D2D2D", "#888888"],
  },
  {
    id: "retro-vintage",
    label: "Retro & Vintage",
    desc: "Distressed texture, varsity lettering, aged feel",
    palette: ["#D4572A", "#F7E8C8", "#4A3728"],
  },
  {
    id: "street-edgy",
    label: "Street & Edgy",
    desc: "Urban graffiti energy, bold type, raw attitude",
    palette: ["#000000", "#FF2D55", "#FFCC00"],
  },
];

const PRESET_COLORS = [
  "#111111", "#FFFFFF", "#1A2A4A", "#D4572A", "#00CC66",
  "#C8A96E", "#FF2D55", "#4A90D9", "#7B2FBE", "#F59E0B",
];

const STEPS = ["Product", "Style", "Details", "Generate", "Result"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  done
                    ? "bg-primary-500 text-white"
                    : active
                    ? "bg-foreground-950 text-background-50"
                    : "bg-background-200 text-foreground-500"
                }`}
              >
                {done ? <i className="ri-check-line text-sm" /> : i + 1}
              </div>
              <span
                className={`text-[10px] font-label whitespace-nowrap ${
                  active ? "text-foreground-950 font-semibold" : "text-foreground-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-8 sm:w-14 mx-1 mb-4 transition-colors ${
                  done ? "bg-primary-500" : "bg-background-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SelectCard({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${
        selected
          ? "border-primary-500 bg-primary-50"
          : "border-background-200 bg-background-50 hover:border-background-300 hover:bg-background-100"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AIDesignStudioPage() {
  const [step, setStep] = useState(0);

  // Selections
  const [productType, setProductType] = useState(null);
  const [style, setStyle] = useState(null);
  const [brandName, setBrandName] = useState("");
  const [tagline, setTagline] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#111111");
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF");
  const [notes, setNotes] = useState("");

  // Generation state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { b64, revisedPrompt }
  const [loadingDot, setLoadingDot] = useState(0);

  const selectedProduct = PRODUCT_TYPES.find((p) => p.id === productType);
  const selectedStyle = STYLES.find((s) => s.id === style);

  // ── Step actions ──────────────────────────────────────────────────────────

  const generate = async () => {
    setStep(3);
    setLoading(true);
    setError(null);
    setResult(null);

    // Animate the dots while waiting
    const interval = setInterval(() => setLoadingDot((d) => (d + 1) % 4), 500);

    try {
      const res = await fetch("/api/generate-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType: selectedProduct?.label,
          style: selectedStyle?.label,
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
      clearInterval(interval);
      setLoading(false);
    }
  };

  const regenerate = () => {
    setStep(2);
    setResult(null);
    setError(null);
  };

  const downloadImage = () => {
    if (!result?.b64) return;
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${result.b64}`;
    a.download = `${brandName.replace(/\s+/g, "-").toLowerCase()}-design.png`;
    a.click();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-background-200">
        <Link to="/" className="flex items-center gap-2 text-foreground-950 hover:opacity-70 transition-opacity">
          <i className="ri-arrow-left-line text-lg" />
          <span className="text-sm font-label font-medium">Back</span>
        </Link>
        <div className="flex flex-col items-center">
          <p className="text-xs text-foreground-500 font-label font-semibold uppercase tracking-widest">
            AI Design Studio
          </p>
        </div>
        <div className="w-16" />
      </div>

      {/* Step bar */}
      {step < 4 && (
        <div className="flex justify-center py-5 px-4 border-b border-background-100">
          <StepBar current={step} />
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Step 0: Product type ── */}
        {step === 0 && (
          <div className="max-w-2xl mx-auto px-4 py-10">
            <h1 className="font-heading text-2xl md:text-3xl font-light text-foreground-950 mb-2">
              What are we designing?
            </h1>
            <p className="text-sm text-foreground-500 font-label mb-8">
              Pick the product you want a design for.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PRODUCT_TYPES.map((p) => (
                <SelectCard
                  key={p.id}
                  selected={productType === p.id}
                  onClick={() => setProductType(p.id)}
                >
                  <i className={`${p.icon} text-2xl mb-2 block ${productType === p.id ? "text-primary-600" : "text-foreground-400"}`} />
                  <p className="font-label font-semibold text-sm text-foreground-950">{p.label}</p>
                  <p className="text-[11px] text-foreground-500 mt-0.5 font-label">{p.desc}</p>
                </SelectCard>
              ))}
            </div>
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                disabled={!productType}
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next — Choose style
                <i className="ri-arrow-right-line" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Style ── */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto px-4 py-10">
            <h1 className="font-heading text-2xl md:text-3xl font-light text-foreground-950 mb-2">
              What's the vibe?
            </h1>
            <p className="text-sm text-foreground-500 font-label mb-8">
              This shapes how the AI interprets your design.
            </p>
            <div className="flex flex-col gap-3">
              {STYLES.map((s) => (
                <SelectCard key={s.id} selected={style === s.id} onClick={() => setStyle(s.id)}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-label font-semibold text-sm text-foreground-950">{s.label}</p>
                      <p className="text-[11px] text-foreground-500 mt-0.5 font-label">{s.desc}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {s.palette.map((c) => (
                        <div
                          key={c}
                          className="w-5 h-5 rounded-full border border-background-200"
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                </SelectCard>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-background-200 text-sm font-label text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer"
              >
                <i className="ri-arrow-left-line" />
                Back
              </button>
              <button
                type="button"
                disabled={!style}
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next — Your details
                <i className="ri-arrow-right-line" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Details ── */}
        {step === 2 && (
          <div className="max-w-2xl mx-auto px-4 py-10">
            <h1 className="font-heading text-2xl md:text-3xl font-light text-foreground-950 mb-2">
              Tell us about your brand
            </h1>
            <p className="text-sm text-foreground-500 font-label mb-8">
              The more specific you are, the better the result.
            </p>

            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-label font-semibold text-foreground-700 mb-1.5 uppercase tracking-wide">
                  Brand / Team Name <span className="text-accent-500">*</span>
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Island FC, Zola's Café, Team 767"
                  className="w-full px-4 py-3 rounded-xl border border-background-200 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 font-label text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-label font-semibold text-foreground-700 mb-1.5 uppercase tracking-wide">
                  Tagline <span className="text-foreground-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Born to Run, Made in 767, Est. 2020"
                  className="w-full px-4 py-3 rounded-xl border border-background-200 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 font-label text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-label font-semibold text-foreground-700 mb-1.5 uppercase tracking-wide">
                    Primary Color
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {PRESET_COLORS.slice(0, 5).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setPrimaryColor(c)}
                        className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                          primaryColor === c ? "border-primary-500 scale-110" : "border-background-200"
                        }`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-full h-10 rounded-lg border border-background-200 cursor-pointer p-0.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-label font-semibold text-foreground-700 mb-1.5 uppercase tracking-wide">
                    Secondary Color
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {PRESET_COLORS.slice(5, 10).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSecondaryColor(c)}
                        className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                          secondaryColor === c ? "border-primary-500 scale-110" : "border-background-200"
                        }`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-full h-10 rounded-lg border border-background-200 cursor-pointer p-0.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-label font-semibold text-foreground-700 mb-1.5 uppercase tracking-wide">
                  Anything else? <span className="text-foreground-400 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Include a football, use tropical leaf motifs, keep it clean and professional"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-background-200 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 font-label text-sm resize-none"
                />
              </div>

              {/* Summary card */}
              <div className="rounded-2xl bg-background-100 border border-background-200 p-4 text-sm font-label">
                <p className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-2">Your brief</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-semibold">
                    {selectedProduct?.label}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-800 text-xs font-semibold">
                    {selectedStyle?.label}
                  </span>
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-background-50 border border-background-200 text-xs">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ background: primaryColor }} />
                    <span className="w-3 h-3 rounded-full inline-block" style={{ background: secondaryColor }} />
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

            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-background-200 text-sm font-label text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer"
              >
                <i className="ri-arrow-left-line" />
                Back
              </button>
              <button
                type="button"
                disabled={!brandName.trim()}
                onClick={generate}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <i className="ri-sparkling-2-fill" />
                Generate Design
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Generating ── */}
        {step === 3 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mb-6 animate-pulse">
              <i className="ri-sparkling-2-fill text-primary-600 text-3xl" />
            </div>
            <h2 className="font-heading text-2xl font-light text-foreground-950 mb-2">
              Creating your design{".".repeat(loadingDot + 1)}
            </h2>
            <p className="text-sm text-foreground-500 font-label max-w-sm">
              The AI is generating a custom <strong>{selectedProduct?.label}</strong> design in{" "}
              <strong>{selectedStyle?.label}</strong> style for <strong>{brandName}</strong>. This takes about 20 seconds.
            </p>
            {error && (
              <div className="mt-8 flex flex-col items-center gap-4">
                <div className="flex items-start gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-label max-w-sm">
                  <i className="ri-error-warning-line mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={regenerate}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-background-200 text-sm font-label text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer"
                >
                  <i className="ri-arrow-left-line" />
                  Go back and try again
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Result ── */}
        {step === 4 && result && (
          <div className="max-w-3xl mx-auto px-4 py-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
                <i className="ri-check-line text-white text-sm" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-medium text-foreground-950">Your design is ready</h1>
                <p className="text-xs text-foreground-500 font-label">1024 × 1024 px · print-ready PNG</p>
              </div>
            </div>

            {/* Image */}
            <div className="rounded-2xl overflow-hidden border border-background-200 bg-background-100 mb-6">
              <img
                src={`data:image/png;base64,${result.b64}`}
                alt={`AI generated ${selectedProduct?.label} design for ${brandName}`}
                className="w-full"
              />
            </div>

            {/* Brief recap */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="px-2.5 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-semibold font-label">
                {selectedProduct?.label}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-800 text-xs font-semibold font-label">
                {selectedStyle?.label}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-background-100 border border-background-200 text-foreground-700 text-xs font-label">
                {brandName}
              </span>
              {tagline && (
                <span className="px-2.5 py-1 rounded-full bg-background-100 border border-background-200 text-foreground-700 text-xs font-label">
                  "{tagline}"
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={downloadImage}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-foreground-950 text-background-50 text-sm font-semibold hover:bg-foreground-800 transition-colors cursor-pointer"
              >
                <i className="ri-download-2-line" />
                Download PNG
              </button>
              <Link
                to="/uniforms"
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer"
              >
                <i className="ri-shirt-line" />
                Order Custom Uniforms
              </Link>
              <button
                type="button"
                onClick={regenerate}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full border border-background-200 text-foreground-700 text-sm font-semibold hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-refresh-line" />
                Regenerate
              </button>
            </div>

            {result.revisedPrompt && (
              <details className="mt-6">
                <summary className="text-xs text-foreground-400 font-label cursor-pointer hover:text-foreground-600">
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
