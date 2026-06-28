import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";

const editableFields = ["destination", "startDate", "endDate", "notes", "status"];

function tripPayload(body) {
  return Object.fromEntries(
    editableFields
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );
}

function validateTrip(data, requireAll = true) {
  const errors = [];

  if (requireAll && (typeof data.destination !== "string" || !data.destination.trim())) {
    errors.push("Destination is required");
  }
  if (requireAll && !data.startDate) errors.push("Start date is required");
  if (requireAll && !data.endDate) errors.push("End date is required");

  if (data.startDate && Number.isNaN(Date.parse(data.startDate))) {
    errors.push("Start date is invalid");
  }
  if (data.endDate && Number.isNaN(Date.parse(data.endDate))) {
    errors.push("End date is invalid");
  }
  if (
    data.startDate &&
    data.endDate &&
    !Number.isNaN(Date.parse(data.startDate)) &&
    !Number.isNaN(Date.parse(data.endDate)) &&
    new Date(data.endDate) < new Date(data.startDate)
  ) {
    errors.push("End date must be on or after start date");
  }

  return errors;
}

export function createTripRouter({ tripService, cache, requireAuth }) {
  const router = Router();
  router.use(requireAuth);

  router.get(
    "/",
    asyncHandler(async (request, response) => {
      const cacheKey = `tripplanner:trips:${request.user.id}`;
      const cachedTrips = await cache.get(cacheKey);
      if (cachedTrips) {
        return response.set("X-Cache", "HIT").json({ trips: cachedTrips });
      }

      const trips = await tripService.list(request.user.id);
      await cache.set(cacheKey, trips);
      return response.set("X-Cache", "MISS").json({ trips });
    }),
  );

  router.post(
    "/",
    asyncHandler(async (request, response) => {
      const data = tripPayload(request.body);
      const errors = validateTrip(data);
      if (errors.length > 0) {
        return response.status(400).json({ message: "Validation failed", details: errors });
      }

      const trip = await tripService.create(request.user.id, data);
      await cache.delete(`tripplanner:trips:${request.user.id}`);
      return response.status(201).json({ trip });
    }),
  );

  router.put(
    "/:id",
    asyncHandler(async (request, response) => {
      const data = tripPayload(request.body);
      const errors = validateTrip(data, false);
      if (Object.keys(data).length === 0) errors.push("No editable fields supplied");
      if (errors.length > 0) {
        return response.status(400).json({ message: "Validation failed", details: errors });
      }

      const trip = await tripService.update(request.user.id, request.params.id, data);
      if (!trip) return response.status(404).json({ message: "Trip not found" });

      await cache.delete(`tripplanner:trips:${request.user.id}`);
      return response.json({ trip });
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (request, response) => {
      const trip = await tripService.remove(request.user.id, request.params.id);
      if (!trip) return response.status(404).json({ message: "Trip not found" });

      await cache.delete(`tripplanner:trips:${request.user.id}`);
      return response.status(204).send();
    }),
  );

  return router;
}
