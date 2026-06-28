import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";

function validateRegistration(body) {
  const errors = [];
  if (typeof body.name !== "string" || body.name.trim().length < 2) {
    errors.push("Name must contain at least 2 characters");
  }
  if (typeof body.email !== "string" || !/^\S+@\S+\.\S+$/.test(body.email)) {
    errors.push("A valid email is required");
  }
  if (typeof body.password !== "string" || body.password.length < 8) {
    errors.push("Password must contain at least 8 characters");
  }
  return errors;
}

export function createAuthRouter(authService) {
  const router = Router();

  router.post(
    "/register",
    asyncHandler(async (request, response) => {
      const errors = validateRegistration(request.body);
      if (errors.length > 0) {
        return response.status(400).json({ message: "Validation failed", details: errors });
      }

      const result = await authService.register(request.body);
      return response.status(201).json(result);
    }),
  );

  router.post(
    "/login",
    asyncHandler(async (request, response) => {
      const { email, password } = request.body;
      if (typeof email !== "string" || typeof password !== "string") {
        return response.status(400).json({ message: "Email and password are required" });
      }

      const result = await authService.login({ email, password });
      return response.json(result);
    }),
  );

  return router;
}
