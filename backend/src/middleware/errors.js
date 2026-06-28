export function notFound(request, response) {
  response.status(404).json({
    message: `Route ${request.method} ${request.originalUrl} not found`,
  });
}

export function errorHandler(error, request, response, next) {
  void request;
  void next;

  if (error.name === "ValidationError") {
    return response.status(400).json({
      message: "Validation failed",
      details: Object.values(error.errors).map((item) => item.message),
    });
  }

  if (error.name === "CastError") {
    return response.status(400).json({ message: "Invalid resource identifier" });
  }

  if (error.code === 11000) {
    return response.status(409).json({ message: "Resource already exists" });
  }

  const statusCode = error.statusCode ?? 500;
  if (statusCode >= 500) {
    console.error(error);
  }

  return response.status(statusCode).json({
    message: statusCode >= 500 ? "Internal server error" : error.message,
  });
}
