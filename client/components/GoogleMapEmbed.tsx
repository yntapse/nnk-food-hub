import { MapPinned, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

interface GoogleMapEmbedProps {
  query: string;
  title?: string;
  className?: string;
  heightClassName?: string;
}

export default function GoogleMapEmbed({
  query,
  title = "Location map",
  className,
  heightClassName = "h-52",
}: GoogleMapEmbedProps) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) return null;

  const encodedQuery = encodeURIComponent(trimmedQuery);
  const embedUrl = `https://www.google.com/maps?q=${encodedQuery}&z=15&output=embed`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;

  return (
    <div className={cn("rounded-2xl overflow-hidden border border-border bg-card", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/40">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPinned size={16} className="text-primary" />
          <span>{title}</span>
        </div>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <Navigation size={12} />
          Open Maps
        </a>
      </div>

      <iframe
        title={title}
        src={embedUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className={cn("w-full border-0", heightClassName)}
      />
    </div>
  );
}