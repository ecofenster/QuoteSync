import React, { useCallback, useEffect, useRef, useState } from "react";

export type GoogleMapMarkerVariant = "open" | "estimate" | "order" | "lost" | "installation" | "completed" | "enquiry";

export type GoogleMapMarkerItem = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  variant?: GoogleMapMarkerVariant;
  stage?: string;
  reference?: string;
};

declare global {
  interface Window {
    google?: typeof google;
    __quotesyncGoogleMapsPromise?: Promise<typeof google>;
  }
}

function resolvedToken(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function markerColor(variant: GoogleMapMarkerVariant | undefined, mixed = false) {
  if (mixed) return resolvedToken("--qs-map-stage-mixed");
  if (variant === "installation") return resolvedToken("--qs-map-stage-installation");
  if (variant === "completed") return resolvedToken("--qs-map-stage-completed");
  if (variant === "order") return resolvedToken("--qs-map-stage-order");
  if (variant === "lost") return resolvedToken("--qs-map-stage-lost");
  return resolvedToken("--qs-map-stage-estimate") || resolvedToken("--qs-theme-text");
}

function markerIcon(variant: GoogleMapMarkerVariant | undefined, count = 1, mixed = false) {
  const fill = markerColor(variant, mixed);
  const contrast = resolvedToken("--qs-brand-white");
  const label = count > 1 ? String(Math.min(count, 99)) : "";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="46" viewBox="0 0 38 46">
      <path d="M19 44C16 37 5 29 5 19C5 11.3 11.3 5 19 5C26.7 5 33 11.3 33 19C33 29 22 37 19 44Z" fill="${fill}" stroke="${contrast}" stroke-width="3" />
      <circle cx="19" cy="19" r="8" fill="${contrast}" fill-opacity="${label ? "0.2" : "1"}" />
      ${label ? `<text x="19" y="23" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="${contrast}">${label}</text>` : ""}
    </svg>
  `;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(38, 46),
  };
}

function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  if (!apiKey) {
    return Promise.reject(new Error("Missing Google Maps API key"));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }

  if (window.__quotesyncGoogleMapsPromise) {
    return window.__quotesyncGoogleMapsPromise;
  }

  window.__quotesyncGoogleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps failed to initialise."));
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps script."));
    document.head.appendChild(script);
  });

  return window.__quotesyncGoogleMapsPromise;
}

export default function GoogleMapPanel({
  apiKey,
  items,
  selectedId,
  onSelect,
  onOpen,
  onApiReady,
  onMapClick,
  fitAllRequest = 0,
  height = 600,
  emptyText = "No map items available.",
}: {
  apiKey: string;
  items: GoogleMapMarkerItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onOpen?: (id: string) => void;
  onApiReady?: () => void;
  onMapClick?: (lat: number, lng: number) => void;
  fitAllRequest?: number;
  height?: number;
  emptyText?: string;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Array<{ ids: string[]; marker: google.maps.Marker; items: GoogleMapMarkerItem[] }>>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [loadError, setLoadError] = useState<string>("");

  const buildInfoWindowContent = useCallback((groupItems: GoogleMapMarkerItem[]) => {
    const content = document.createElement("div");
    content.className = "google-map-panel__info";
    const title = document.createElement("div");
    title.className = "google-map-panel__info-title";
    title.textContent = groupItems.length > 1 ? `${groupItems.length} records at this location` : groupItems[0].title;
    content.appendChild(title);
    if (groupItems.length === 1 && groupItems[0].subtitle) {
      const subtitle = document.createElement("div");
      subtitle.className = "google-map-panel__info-subtitle";
      subtitle.textContent = groupItems[0].subtitle;
      content.appendChild(subtitle);
    }
    const records = document.createElement("div");
    records.className = "google-map-panel__info-records";
    groupItems.forEach((item) => {
      const record = document.createElement("div");
      record.className = "google-map-panel__info-record";
      const details = document.createElement("div");
      details.className = "google-map-panel__info-subtitle";
      details.textContent = groupItems.length > 1 ? `${item.title} · ${[item.reference, item.stage].filter(Boolean).join(" · ")}` : [item.reference, item.stage].filter(Boolean).join(" · ");
      record.appendChild(details);
      if (onOpen) {
        const open = document.createElement("button");
        open.type = "button";
        open.className = "ui-button ui-button--primary google-map-panel__info-open";
        open.textContent = "Open";
        open.addEventListener("click", () => onOpen(item.id));
        record.appendChild(open);
      }
      records.appendChild(record);
    });
    content.appendChild(records);
    return content;
  }, [onOpen]);

  useEffect(() => {
    let cancelled = false;

    if (!apiKey) {
      setLoadError("Map display is not configured for this QuoteSuite deployment.");
      return;
    }

    setLoadError("");

loadGoogleMaps(apiKey)
  .then((googleApi) => {
    if (cancelled || !mapElementRef.current || mapRef.current) return;
    mapRef.current = new googleApi.maps.Map(mapElementRef.current, {
      center: { lat: 54.8, lng: -2.8 },
      zoom: 6,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    infoWindowRef.current = new googleApi.maps.InfoWindow();
    if (onMapClick) {
      mapRef.current.addListener("click", (event: google.maps.MapMouseEvent) => {
        if (!event.latLng) return;
        onMapClick(event.latLng.lat(), event.latLng.lng());
      });
    }
    onApiReady?.();
  })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Google Maps failed to load.");
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, onApiReady, onMapClick]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    markersRef.current.forEach((entry) => entry.marker.setMap(null));
    markersRef.current = [];

    if (!items.length) {
      mapRef.current.setCenter({ lat: 54.5, lng: -3.4 });
      mapRef.current.setZoom(6);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();

    const openInfoWindow = (groupItems: GoogleMapMarkerItem[], marker: google.maps.Marker) => {
      if (!infoWindowRef.current) return;
      infoWindowRef.current.setContent(buildInfoWindowContent(groupItems) as unknown as string);
      infoWindowRef.current.open({
        map: mapRef.current!,
        anchor: marker,
      });
    };

    const uniqueItems = [...new Map(items.map((item) => [item.id, item])).values()];
    const groupedItems = [...uniqueItems.reduce((groups, item) => {
      const key = `${item.lat.toFixed(6)}:${item.lng.toFixed(6)}`;
      groups.set(key, [...(groups.get(key) || []), item]);
      return groups;
    }, new Map<string, GoogleMapMarkerItem[]>()).values()];
    markersRef.current = groupedItems.map((groupItems) => {
      const item = groupItems[0];
      const variants = new Set(groupItems.map((entry) => entry.variant));
      const marker = new window.google!.maps.Marker({
        map: mapRef.current!,
        position: { lat: item.lat, lng: item.lng },
        title: groupItems.length > 1 ? `${groupItems.length} records at this location` : item.title,
        icon: markerIcon(item.variant, groupItems.length, variants.size > 1),
      });

      marker.addListener("click", () => {
        openInfoWindow(groupItems, marker);
        if (groupItems.length === 1) onSelect?.(item.id);
      });

      bounds.extend(marker.getPosition()!);
      return { ids: groupItems.map((entry) => entry.id), marker, items: groupItems };
    });

    if (selectedId) {
      const selected = items.find((item) => item.id === selectedId);
      if (selected) {
        mapRef.current.setCenter({ lat: selected.lat, lng: selected.lng });
        mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 5, 8));
        return;
      }
    }

    mapRef.current.fitBounds(bounds, 60);
  }, [buildInfoWindowContent, items, onSelect, selectedId]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps || !items.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    [...new Map(items.map((item) => [item.id, item])).values()].forEach((item) => bounds.extend(new window.google!.maps.LatLng(item.lat, item.lng)));
    mapRef.current.fitBounds(bounds, 60);
  }, [fitAllRequest, items]);

  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const selected = items.find((item) => item.id === selectedId);
    if (!selected) return;
    mapRef.current.panTo({ lat: selected.lat, lng: selected.lng });
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 5, 8));

    const selectedGroup = markersRef.current.find((entry) => entry.ids.includes(selectedId));
    if (!selectedGroup || !infoWindowRef.current) return;

    infoWindowRef.current.setContent(buildInfoWindowContent(selectedGroup.items) as unknown as string);
    infoWindowRef.current.open({
      map: mapRef.current,
      anchor: selectedGroup.marker,
    });
  }, [buildInfoWindowContent, items, selectedId]);

  if (loadError) {
    return (
      <div className="google-map-panel google-map-panel--error" data-height={height >= 900 ? "tall" : "standard"}>
        <div className="qs-migrated-118">Google Maps unavailable</div>
        <div className="qs-migrated-119">{loadError}</div>
      </div>
    );
  }

  return (
    <div className="google-map-panel" data-height={height >= 900 ? "tall" : "standard"}>
      <div
        ref={mapElementRef}
        className="google-map-panel__canvas"
      />
      {!items.length && (
        <div className="qs-migrated-120"
        >
          <div className="qs-migrated-121"
          >
            {emptyText}
          </div>
        </div>
      )}
    </div>
  );
}
