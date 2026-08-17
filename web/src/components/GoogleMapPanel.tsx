import React, { useEffect, useRef, useState } from "react";

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

function markerColor(variant: GoogleMapMarkerVariant | undefined) {
  if (variant === "installation") return resolvedToken("--qs-operational-installations");
  if (variant === "completed") return resolvedToken("--qs-semantic-success");
  if (variant === "order") return resolvedToken("--qs-semantic-success");
  if (variant === "lost") return resolvedToken("--qs-semantic-error");
  return resolvedToken("--qs-theme-text");
}

function markerIcon(variant: GoogleMapMarkerVariant | undefined) {
  const fill = markerColor(variant);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
      <circle cx="17" cy="17" r="11" fill="${fill}" stroke="${resolvedToken("--qs-brand-white")}" stroke-width="4" />
    </svg>
  `;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(34, 34),
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
  height?: number;
  emptyText?: string;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Array<{ id: string; marker: google.maps.Marker }>>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [loadError, setLoadError] = useState<string>("");

  const buildInfoWindowContent = (item: GoogleMapMarkerItem) => {
    const content = document.createElement("div");
    content.className = "google-map-panel__info";
    const title = document.createElement("div");
    title.className = "google-map-panel__info-title";
    title.textContent = item.title;
    content.appendChild(title);
    if (item.subtitle) {
      const subtitle = document.createElement("div");
      subtitle.className = "google-map-panel__info-subtitle";
      subtitle.textContent = item.subtitle;
      content.appendChild(subtitle);
    }
    if (item.reference || item.stage) {
      const details = document.createElement("div");
      details.className = "google-map-panel__info-subtitle";
      details.textContent = [item.reference, item.stage].filter(Boolean).join(" · ");
      content.appendChild(details);
    }
    if (onOpen) {
      const open = document.createElement("button");
      open.type = "button";
      open.className = "ui-button";
      open.textContent = "Open";
      open.addEventListener("click", () => onOpen(item.id));
      content.appendChild(open);
    }
    return content;
  };

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

    const openInfoWindow = (item: GoogleMapMarkerItem, marker: google.maps.Marker) => {
      if (!infoWindowRef.current) return;
      infoWindowRef.current.setContent(buildInfoWindowContent(item) as unknown as string);
      infoWindowRef.current.open({
        map: mapRef.current!,
        anchor: marker,
      });
    };

    markersRef.current = items.map((item) => {
      const marker = new window.google!.maps.Marker({
        map: mapRef.current!,
        position: { lat: item.lat, lng: item.lng },
        title: item.title,
        icon: markerIcon(item.variant),
      });

      marker.addListener("click", () => {
        openInfoWindow(item, marker);
        onSelect?.(item.id);
      });

      bounds.extend(marker.getPosition()!);
      return { id: item.id, marker };
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
  }, [items, onSelect, selectedId]);

  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const selected = items.find((item) => item.id === selectedId);
    if (!selected) return;
    mapRef.current.panTo({ lat: selected.lat, lng: selected.lng });
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 5, 8));

    const selectedMarker = markersRef.current.find((entry) => entry.id === selectedId)?.marker;
    if (!selectedMarker || !infoWindowRef.current) return;

    infoWindowRef.current.setContent(buildInfoWindowContent(selected) as unknown as string);
    infoWindowRef.current.open({
      map: mapRef.current,
      anchor: selectedMarker,
    });
  }, [items, selectedId]);

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
