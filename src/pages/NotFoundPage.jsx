import Button from "../components/ui/Button";

export default function NotFoundPage() {
  return (
    <div className="pt-16 md:pt-20 min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-background-100 mb-6">
          <i className="ri-map-pin-line text-2xl text-foreground-300" />
        </div>
        <h1 className="font-heading text-4xl font-light text-foreground-950 mb-3">
          404 <span className="italic text-accent-500">Not found</span>
        </h1>
        <p className="text-sm text-foreground-600 font-label mb-8">
          That page doesn't exist — it may have moved, or the link might be off.
        </p>
        <Button to="/" icon="ri-arrow-right-line">
          Back to home
        </Button>
      </div>
    </div>
  );
}
