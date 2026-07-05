import Image from "next/image";
import type { LiveListing } from "@/lib/sources/redfin-live";
import { usd } from "@/lib/format";

/** One live-listing photo card (Deals grid). Whole card links to the listing. */
export default function ListingCard({
  listing: l,
}: {
  listing: LiveListing & { milesToWork?: number | null };
}) {
  return (
    <a
      href={l.url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="card group overflow-hidden !p-0 transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-[var(--surface-2)]">
        {l.photoUrl ? (
          <Image
            src={l.photoUrl}
            alt={l.address ? `Photo of ${l.address}` : "Listing photo"}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            referrerPolicy="no-referrer"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-sm text-[var(--muted)]">No photo</div>
        )}
        {l.daysOnMarket !== null && l.daysOnMarket <= 3 && (
          <span className="absolute left-2 top-2 rounded-full bg-[var(--brand)] px-2 py-0.5 text-xs font-medium text-white">
            New
          </span>
        )}
        <span className="absolute bottom-2 left-2 rounded-lg bg-black/65 px-2 py-1 text-base font-bold tabular-nums text-white">
          {usd(l.price)}
        </span>
      </div>
      <div className="space-y-1 p-3">
        <p className="text-sm text-[var(--text-2)]">
          {[
            l.beds !== null ? `${l.beds} bd` : null,
            l.baths !== null ? `${l.baths} ba` : null,
            l.sqft ? `${l.sqft.toLocaleString()} sqft` : null,
            l.pricePerSqft ? `$${Math.round(l.pricePerSqft)}/sqft` : null,
          ]
            .filter(Boolean)
            .join(" · ") || l.propertyType}
        </p>
        <p className="truncate text-sm font-medium">{l.address || "Address withheld"}</p>
        <p className="truncate text-xs text-[var(--muted)]">
          {l.city}, {l.state} {l.zip}
          {l.yearBuilt ? ` · built ${l.yearBuilt}` : ""}
          {l.daysOnMarket ? ` · ${l.daysOnMarket} day${l.daysOnMarket === 1 ? "" : "s"} listed` : ""}
          {l.milesToWork != null ? ` · ${l.milesToWork.toFixed(l.milesToWork < 10 ? 1 : 0)} mi to work` : ""}
        </p>
      </div>
    </a>
  );
}
