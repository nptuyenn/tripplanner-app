import jwt from "jsonwebtoken";

export function requireAuth(jwtSecret) {
  return (request, response, next) => {
    const authorization = request.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return response.status(401).json({ message: "Authentication required" });
    }

    try {
      const payload = jwt.verify(authorization.slice(7), jwtSecret);
      request.user = { id: payload.sub };
      return next();
    } catch {
      return response.status(401).json({ message: "Invalid or expired token" });
    }
  };
}
