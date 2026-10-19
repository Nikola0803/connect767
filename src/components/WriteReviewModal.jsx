import { useState } from "react";
import StarRating from "./ui/StarRating";
import { submitReview } from "../data/repository";

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="text-2xl cursor-pointer transition-colors"
        >
          <i
            className={`${
              star <= (hover || value) ? "ri-star-fill text-accent-500" : "ri-star-line text-background-400"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function WriteReviewButton({ listingSlug, listingTitle }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-accent-300 text-accent-700 hover:bg-accent-50 transition-colors cursor-pointer whitespace-nowrap"
      >
        <i className="ri-edit-line" />
        Write a Review
      </button>
      {open && (
        <WriteReviewModal
          listingSlug={listingSlug}
          listingTitle={listingTitle}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export default function WriteReviewModal({ listingSlug, listingTitle, onClose }) {
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) { setError("Please select a star rating."); return; }
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!text.trim()) { setError("Please write your review."); return; }
    setError("");
    setSubmitting(true);
    try {
      await submitReview(listingSlug, { rating, name, text });
      setDone(true);
    } catch {
      setError("Couldn't submit your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground-950/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background-50 rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading text-xl font-medium text-foreground-950">
            Review <span className="text-primary-700">{listingTitle}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-500 hover:bg-background-100 cursor-pointer"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-primary-100 text-primary-600 mb-4">
              <i className="ri-check-line text-2xl" />
            </div>
            <p className="font-semibold text-foreground-950 mb-1">Review submitted!</p>
            <p className="text-sm text-foreground-500 font-label">
              Thank you — it will appear after a brief review.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 px-5 py-2.5 rounded-lg bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground-800 mb-2">
                Your rating <span className="text-accent-500">*</span>
              </label>
              <StarPicker value={rating} onChange={setRating} />
            </div>
            <div>
              <label htmlFor="review-name" className="block text-sm font-semibold text-foreground-800 mb-1.5">
                Your name <span className="text-accent-500">*</span>
              </label>
              <input
                id="review-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane D."
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-background-300 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 font-label"
              />
            </div>
            <div>
              <label htmlFor="review-text" className="block text-sm font-semibold text-foreground-800 mb-1.5">
                Your review <span className="text-accent-500">*</span>
              </label>
              <textarea
                id="review-text"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Share your experience..."
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-background-300 bg-background-50 text-foreground-950 placeholder-foreground-400 focus:outline-none focus:border-primary-400 font-label resize-y"
              />
            </div>
            {error && (
              <p className="text-xs text-accent-700 font-label">{error}</p>
            )}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-background-300 text-sm font-semibold text-foreground-700 hover:bg-background-100 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                {submitting ? "Submitting…" : "Submit Review"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
