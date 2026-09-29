import { useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { getDirectoryCategories, matchListings } from "../data/repository";
import { priceOptions } from "../data/directory";
import DirectoryListingCard from "../components/DirectoryListingCard";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/FormField";
import { Spinner, ErrorState, EmptyState } from "../components/ui/States";

const steps = [
  { n: 1, label: "What you need" },
  { n: 2, label: "Budget & location" },
  { n: 3, label: "What matters most" },
];

const priorities = [
  { value: "rating", label: "Highest rated", icon: "ri-star-line", desc: "Best reviews first" },
  { value: "value", label: "Best value", icon: "ri-price-tag-3-line", desc: "Budget-friendly first" },
  { value: "location", label: "Closest to me", icon: "ri-map-pin-line", desc: "Nearby first" },
  { value: "top-tier", label: "Top-tier only", icon: "ri-vip-crown-line", desc: "Classified & Featured first" },
];

function StepDots({ current }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={step.n} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold ${
              step.n === current
                ? "bg-primary-500 text-background-50"
                : step.n < current
                ? "bg-primary-100 text-primary-800"
                : "bg-background-100 text-foreground-500"
            }`}
          >
            {step.n < current ? <i className="ri-check-line" /> : step.n}
          </div>
          {i < steps.length - 1 && <div className="w-6 h-px bg-background-300" />}
        </div>
      ))}
    </div>
  );
}

export default function MatchPage() {
  const [step, setStep] = useState(1);
  const [criteria, setCriteria] = useState({
    categorySlug: "",
    priceTiers: [],
    location: "",
    priority: "rating",
  });
  const [results, setResults] = useState(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState(null);

  const { data: categories, loading: loadingCategories } = useAsync(
    () => getDirectoryCategories(),
    []
  );

  const togglePriceTier = (value) => {
    setCriteria((c) => ({
      ...c,
      priceTiers: c.priceTiers.includes(value)
        ? c.priceTiers.filter((p) => p !== value)
        : [...c.priceTiers, value],
    }));
  };

  const handleGetMatched = async () => {
    setMatching(true);
    setMatchError(null);
    try {
      const data = await matchListings(criteria);
      setResults(data);
    } catch (err) {
      setMatchError(err);
    } finally {
      setMatching(false);
    }
  };

  const startOver = () => {
    setResults(null);
    setStep(1);
  };

  // ---------- Results view ----------
  if (matching) {
    return (
      <div className="pt-16 md:pt-20 min-h-[70vh] flex flex-col items-center justify-center px-4">
        <div className="w-12 h-12 border-2 border-background-300 border-t-primary-500 rounded-full animate-spin mb-6" />
        <p className="text-sm text-foreground-600 font-label">Finding your best-fit matches…</p>
      </div>
    );
  }

  if (results) {
    return (
      <div className="pt-16 md:pt-20">
        <div className="w-full px-4 md:px-8 lg:px-12 py-10">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-100 text-accent-900 text-xs font-medium mb-3">
                  <i className="ri-sparkling-2-fill" />
                  Your matches
                </div>
                <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950">
                  {results.length} businesses ranked for you
                </h1>
              </div>
              <button
                type="button"
                onClick={startOver}
                className="inline-flex items-center gap-2 text-sm font-semibold text-foreground-600 hover:text-foreground-900 cursor-pointer"
              >
                <i className="ri-refresh-line" />
                Start over
              </button>
            </div>

            {matchError && <ErrorState message="Couldn't compute matches." onRetry={handleGetMatched} />}

            {!matchError && results.length === 0 && (
              <EmptyState
                icon="ri-search-line"
                title="No matches found"
                description="Try loosening a filter and start over"
              />
            )}

            {!matchError && results.length > 0 && (
              <div className="flex flex-col gap-5">
                {results.map((listing) => (
                  <DirectoryListingCard
                    key={listing.slug}
                    listing={listing}
                    view="list"
                    matchScore={listing.matchScore}
                  />
                ))}
              </div>
            )}

            <div className="mt-10 text-center">
              <Link to="/listings" className="text-sm font-semibold text-primary-700 hover:text-primary-800">
                Or browse the full directory →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Quiz view ----------
  return (
    <div className="pt-16 md:pt-20">
      <div className="w-full px-4 md:px-8 lg:px-12 py-6 border-b border-background-200/70 bg-background-50">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Link
              className="text-xs font-label text-foreground-500 hover:text-foreground-800 cursor-pointer flex items-center gap-1"
              to="/"
            >
              <i className="ri-arrow-left-line" />
              Home
            </Link>
            <span className="text-foreground-300">/</span>
            <span className="text-xs font-label text-foreground-800 font-medium">AI Matching</span>
          </div>
          <StepDots current={step} />
        </div>
      </div>

      <div className="w-full px-4 md:px-8 lg:px-12 py-10">
        <div className="max-w-2xl mx-auto">
          {step === 1 && (
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 mb-3">
                What are you <span className="text-accent-500 italic">looking for?</span>
              </h1>
              <p className="text-sm text-foreground-600 font-label mb-8">
                Pick a category, or skip if you're not sure yet.
              </p>
              {loadingCategories ? (
                <Spinner />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {categories
                    .filter((c) => c.slug !== "all")
                    .map((cat) => (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() =>
                          setCriteria((c) => ({
                            ...c,
                            categorySlug: c.categorySlug === cat.slug ? "" : cat.slug,
                          }))
                        }
                        className={`text-left p-4 rounded-xl border-2 transition-colors cursor-pointer ${
                          criteria.categorySlug === cat.slug
                            ? "border-primary-500 bg-primary-50/50"
                            : "border-background-200/70 hover:border-background-400"
                        }`}
                      >
                        <span className="text-sm font-semibold text-foreground-900">
                          {cat.label}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 mb-3">
                Budget <span className="text-accent-500 italic">& location</span>
              </h1>
              <p className="text-sm text-foreground-600 font-label mb-8">
                Both optional — skip anything you don't have a preference on.
              </p>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-foreground-800 mb-2">
                    Price range
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {priceOptions
                      .filter((p) => p.value !== "all")
                      .map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => togglePriceTier(p.value)}
                          className={`px-4 py-2.5 text-sm font-semibold rounded-lg border cursor-pointer transition-colors ${
                            criteria.priceTiers.includes(p.value)
                              ? "bg-primary-500 text-background-50 border-primary-500"
                              : "bg-background-50 text-foreground-700 border-background-300 hover:bg-background-100"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground-800 mb-2" htmlFor="matchLocation">
                    Location
                  </label>
                  <Input
                    id="matchLocation"
                    icon="ri-map-pin-line"
                    placeholder="City, region, or country — e.g. Roseau"
                    value={criteria.location}
                    onChange={(e) => setCriteria((c) => ({ ...c, location: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-light text-foreground-950 mb-3">
                What matters <span className="text-accent-500 italic">most?</span>
              </h1>
              <p className="text-sm text-foreground-600 font-label mb-8">
                We'll weigh your matches around this.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {priorities.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setCriteria((c) => ({ ...c, priority: p.value }))}
                    className={`text-left p-4 rounded-xl border-2 transition-colors cursor-pointer ${
                      criteria.priority === p.value
                        ? "border-primary-500 bg-primary-50/50"
                        : "border-background-200/70 hover:border-background-400"
                    }`}
                  >
                    <i
                      className={`${p.icon} text-lg mb-1.5 block ${
                        criteria.priority === p.value ? "text-primary-600" : "text-foreground-500"
                      }`}
                    />
                    <div className="text-sm font-semibold text-foreground-900">{p.label}</div>
                    <div className="text-xs text-foreground-500 font-label">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              icon="ri-arrow-left-line"
              iconPosition="left"
            >
              Back
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => setStep((s) => Math.min(3, s + 1))}
                icon="ri-arrow-right-line"
              >
                Continue
              </Button>
            ) : (
              <Button type="button" variant="accent" onClick={handleGetMatched} icon="ri-sparkling-2-fill" iconPosition="left">
                Get Matched
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
