export function Spinner({ className = "" }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <div className="w-8 h-8 border-2 border-background-300 border-t-primary-500 rounded-full animate-spin" />
    </div>
  );
}

export function CardSkeleton({ count = 4, className = "" }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-background-200/70 overflow-hidden animate-pulse"
        >
          <div className="w-full h-52 bg-background-200" />
          <div className="p-4 space-y-3">
            <div className="h-3 w-1/2 bg-background-200 rounded" />
            <div className="h-4 w-3/4 bg-background-200 rounded" />
            <div className="h-3 w-1/3 bg-background-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon = "ri-inbox-line", title, description }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-background-100 mb-4">
        <i className={`${icon} text-2xl text-foreground-300`} />
      </div>
      <p className="text-foreground-600 text-sm mb-1">{title}</p>
      {description && <p className="text-foreground-400 text-xs">{description}</p>}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-accent-50 mb-4">
        <i className="ri-error-warning-line text-2xl text-accent-500" />
      </div>
      <p className="text-foreground-700 text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-background-300 text-sm font-semibold text-foreground-800 hover:bg-background-100"
        >
          <i className="ri-refresh-line" />
          Try again
        </button>
      )}
    </div>
  );
}
