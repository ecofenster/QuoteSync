declare namespace google {
  namespace maps {
    class Size {
      constructor(width: number, height: number);
    }

    class LatLng {
      lat(): number;
      lng(): number;
    }

    class LatLngBounds {
      extend(latLng: LatLng): void;
    }

    type MapsEventListener = {
      remove(): void;
    };

    type MapMouseEvent = {
      latLng: LatLng | null;
    };

    class Map {
      constructor(element: HTMLElement, options: {
        center: { lat: number; lng: number };
        zoom: number;
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
        fullscreenControl?: boolean;
      });
      addListener(eventName: string, handler: (event: MapMouseEvent) => void): MapsEventListener;
      setCenter(position: { lat: number; lng: number }): void;
      setZoom(zoom: number): void;
      getZoom(): number | undefined;
      fitBounds(bounds: LatLngBounds, padding?: number): void;
      panTo(position: { lat: number; lng: number }): void;
    }

    class Marker {
      constructor(options: {
        map: Map;
        position: { lat: number; lng: number };
        title?: string;
        icon?: { url: string; scaledSize: Size };
      });
      addListener(eventName: string, handler: () => void): MapsEventListener;
      getPosition(): LatLng | null;
      setMap(map: Map | null): void;
    }

    class InfoWindow {
      setContent(content: string): void;
      open(options: { map: Map; anchor: Marker }): void;
    }

    type GeocoderStatus = string;

    type GeocoderResult = {
      formatted_address?: string;
      geometry?: {
        location?: LatLng;
      };
    };

    class Geocoder {
      geocode(
        request: { address?: string; location?: { lat: number; lng: number }; region?: string },
        callback: (results: GeocoderResult[] | null, status: GeocoderStatus) => void
      ): void;
    }
  }
}
