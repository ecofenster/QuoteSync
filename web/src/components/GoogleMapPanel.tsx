import React, { useEffect, useRef, useState } from "react";

export type GoogleMapMarkerVariant = "open" | "order" | "lost" | "installation";

export type GoogleMapMarkerItem = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  variant?: GoogleMapMarkerVariant;
};

declare global {
  interface Window {
    google?: typeof google;
    __quotesyncGoogleMapsPromise?: Promise<typeof google>;
  }
}

function markerColor(variant: GoogleMapMarkerVariant | undefined) {
  if (variant === "installation") return "#2563eb";
  if (variant === "order") return "#16a34a";
  if (variant === "lost") return "#dc2626";
  return "#18181b";
}

function markerIcon(variant: GoogleMapMarkerVariant | undefined) {
  const fill = markerColor(variant);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
      <circle cx="17" cy="17" r="11" fill="${fill}" stroke="#ffffff" stroke-width="4" />
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
  onApiReady,
  onMapClick,
  height = 600,
  emptyText = "No map items available.",
}: {
  apiKey: string;
  items: GoogleMapMarkerItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
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

  useEffect(() => {
    let cancelled = false;

    if (!apiKey) {
      setLoadError("Google Maps API key missing. Add VITE_GOOGLE_MAPS_API_KEY to .env.local.");
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
      const subtitleHtml = item.subtitle
        ? `<div style="margin-top:4px;color:#52525b;font-size:12px;line-height:1.4;">${item.subtitle}</div>`
        : "";
      infoWindowRef.current.setContent(
        `<div style="min-width:220px;padding:2px 4px;"><div style="font-weight:800;color:#18181b;font-size:13px;line-height:1.35;">${item.title}</div>${subtitleHtml}</div>`
      );
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

    const subtitleHtml = selected.subtitle
      ? `<div style="margin-top:4px;color:#52525b;font-size:12px;line-height:1.4;">${selected.subtitle}</div>`
      : "";
    infoWindowRef.current.setContent(
      `<div style="min-width:220px;padding:2px 4px;"><div style="font-weight:800;color:#18181b;font-size:13px;line-height:1.35;">${selected.title}</div>${subtitleHtml}</div>`
    );
    infoWindowRef.current.open({
      map: mapRef.current,
      anchor: selectedMarker,
    });
  }, [items, selectedId]);

  if (loadError) {
    return (
      <div style={{ borderRadius: 14, border: "1px dashed var(--color-border)", background: "var(--color-surface)", minHeight: height, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text-primary)" }}>Google Maps unavailable</div>
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--color-text-secondary)" }}>{loadError}</div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", minHeight: height }}>
      <div
        ref={mapElementRef}
        style={{
          width: "100%",
          minHeight: height,
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
        }}
      />
      {!items.length && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            pointerEvents: "none",
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--color-text-secondary)",
              background: "var(--ui-popover-background, var(--color-surface))",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              padding: "10px 14px",
            }}
          >
            {emptyText}
          </div>
        </div>
      )}
    </div>
  );
}
