import { Component } from "react";

/**
 * Without this, any uncaught error anywhere in the render tree — a bad
 * API response shape, a third-party data surprise, anything — takes down
 * the entire app to a blank white screen with no way to recover except a
 * hard refresh, and no indication anything went wrong. This catches it at
 * the page level and shows a real, recoverable message instead. Doesn't
 * replace fixing the actual bug (see ProductDetailPage.jsx's variation
 * matching for a real example) — it's the safety net underneath that.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Uncaught render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="pt-16 md:pt-20 min-h-[70vh] flex items-center justify-center px-4 py-14">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-accent-100 text-accent-600 mb-5">
              <i className="ri-error-warning-line text-2xl" />
            </div>
            <h1 className="font-heading text-2xl font-light text-foreground-950 mb-3">
              Something went wrong
            </h1>
            <p className="text-sm text-foreground-600 mb-8">
              This page hit an unexpected error. Try reloading — if it keeps happening, let us
              know what you were doing when it broke.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 cursor-pointer"
            >
              <i className="ri-refresh-line" />
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
