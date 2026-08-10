import express from "express";
import { dbPromise } from "../db.js";
import { createIntegrationService } from "../features/integrations/integrationService.js";

export function createIntegrationsRouter({ databasePromise = dbPromise, serviceOptions } = {}) {
  const router = express.Router();
  const withService = async () => createIntegrationService(await databasePromise, serviceOptions);
  const fail = (res, error) => res.status(Number(error?.status) || 500).json({ error: Number(error?.status) ? error.message : "Integration request failed" });

  router.get("/", async (_req, res) => { try { res.json(await (await withService()).listStatuses()); } catch (error) { fail(res, error); } });
  router.put("/:provider", async (req, res) => { try { res.json(await (await withService()).configure(req.params.provider, req.body)); } catch (error) { fail(res, error); } });
  router.delete("/:provider/key", async (req, res) => { try { res.json(await (await withService()).clearCredential(req.params.provider)); } catch (error) { fail(res, error); } });
  router.post("/:provider/test", async (req, res) => { try { res.json(await (await withService()).testConnection(req.params.provider)); } catch (error) { fail(res, error); } });

  router.post("/googleMaps/geocode", async (req, res) => {
    try {
      const key = await (await withService()).enabledCredential("googleMaps");
      const query = String(req.body?.query || "").trim();
      if (!query) return res.status(400).json({ error: "query is required" });
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=GB&key=${encodeURIComponent(key)}`);
      const body = await response.json();
      const location = body?.results?.[0]?.geometry?.location;
      if (!response.ok || body?.status !== "OK" || !location) return res.status(422).json({ error: "Location could not be resolved" });
      return res.json({ lat: location.lat, lng: location.lng });
    } catch (error) { return fail(res, error); }
  });

  router.post("/googleMaps/route", async (req, res) => {
    try {
      const key = await (await withService()).enabledCredential("googleMaps");
      const origin = req.body?.origin, destination = req.body?.destination;
      if (![origin?.lat, origin?.lng, destination?.lat, destination?.lng].every(Number.isFinite)) return res.status(400).json({ error: "valid route coordinates are required" });
      const response = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&units=metric&key=${encodeURIComponent(key)}`);
      const body = await response.json();
      const element = body?.rows?.[0]?.elements?.[0];
      if (!response.ok || body?.status !== "OK" || element?.status !== "OK") return res.status(422).json({ error: "Route could not be calculated" });
      return res.json({ distanceKm: element.distance.value / 1000, durationMinutes: Math.ceil(element.duration.value / 60) });
    } catch (error) { return fail(res, error); }
  });

  router.post("/what3words/coordinates", async (req, res) => {
    try {
      const key = await (await withService()).enabledCredential("what3words");
      const words = String(req.body?.words || "").trim();
      const response = await fetch(`https://api.what3words.com/v3/convert-to-coordinates?words=${encodeURIComponent(words)}&key=${encodeURIComponent(key)}`);
      const body = await response.json();
      if (!response.ok || !body?.coordinates) return res.status(422).json({ error: "what3words address could not be resolved" });
      return res.json({ lat: body.coordinates.lat, lng: body.coordinates.lng });
    } catch (error) { return fail(res, error); }
  });

  router.post("/what3words/address", async (req, res) => {
    try {
      const key = await (await withService()).enabledCredential("what3words");
      const lat = Number(req.body?.lat), lng = Number(req.body?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: "valid coordinates are required" });
      const response = await fetch(`https://api.what3words.com/v3/convert-to-3wa?coordinates=${encodeURIComponent(`${lat},${lng}`)}&key=${encodeURIComponent(key)}`);
      const body = await response.json();
      if (response.status === 402) return res.status(402).json({ error: "what3words plan does not support conversion" });
      if (!response.ok || typeof body?.words !== "string") return res.status(422).json({ error: "Coordinates could not be converted" });
      return res.json({ words: body.words });
    } catch (error) { return fail(res, error); }
  });

  return router;
}

export default createIntegrationsRouter();
