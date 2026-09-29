import { Link, useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { getListingBySlug, getListings } from "../data/repository";
import { Spinner, ErrorState } from "../components/ui/States";
import ListingProfile from "../components/ListingProfile";

const genericAmenities = ["Free Wi-Fi", "Wheelchair accessible", "Parking"];
const genericHours = ["Mon–Sat 9:00 AM – 6:00 PM", "Sun Closed"];

export default function ListingDetailPage() {
  const { slug } = useParams();

  const {
    data: full,
    loading: loadingFull,
    error: errorFull,
    reload,
  } = useAsync(() => getListingBySlug(slug), [slug]);
  const { data: allListings, loading: loadingList } = useAsync(() => getListings(), []);

  const loading = loadingFull || loadingList;
  const summary = allListings?.find((l) => l.slug === slug) || null;

  if (loading) {
    return <Spinner className="pt-16 md:pt-20 min-h-[60vh]" />;
  }

  if (errorFull) {
    return (
      <div className="pt-16 md:pt-20">
        <ErrorState message="Couldn't load this listing." onRetry={reload} />
      </div>
    );
  }

  if (!full && !summary) {
    return (
      <div className="pt-16 md:pt-20 px-4 md:px-8 lg:px-12 py-24 text-center">
        <h1 className="font-heading text-2xl text-foreground-950 mb-2">Listing not found</h1>
        <p className="text-sm text-foreground-600 mb-6">
          We couldn't find a listing at this address.
        </p>
        <Link
          to="/listings"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600"
        >
          Back to directory
          <i className="ri-arrow-right-line" />
        </Link>
      </div>
    );
  }

  // Build a display model, using rich `full` data where available and
  // falling back to the directory summary otherwise.
  const data = full || {
    slug: summary.slug,
    title: summary.title,
    category: summary.category,
    categoryPath: "",
    categoryLabel: summary.category.split(" · ")[0],
    badge: summary.badge,
    badgeIcon: summary.badgeIcon,
    verified: summary.verified,
    rating: summary.rating,
    reviewCount: summary.reviews.replace(/[()]/g, ""),
    location: summary.location,
    price: summary.price,
    description: `${summary.title} is part of the Connect767 directory. Full profile details for this business haven't been added yet — check back soon, or contact them directly.`,
    tags: [],
    amenities: genericAmenities,
    hours: genericHours,
    gallery: [{ alt: summary.title, src: summary.image }],
    reviews: [],
    contact: null,
    mapEmbedUrl: null,
    logo: "",
  };

  return (
    <div className="pt-16 md:pt-20">
      <ListingProfile data={data} />
    </div>
  );
}
