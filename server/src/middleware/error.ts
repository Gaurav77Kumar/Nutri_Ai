import { Request, Response, NextFunction } from "express";

/**
 * Global error handler middleware.
 */
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status || 500;
  const message = err.message || "Internal server error";

  console.error(`[Error] ${status}:`, err);

  // Prisma known errors
  if (err.code === "P2002") {
    res.status(409).json({
      error: "A record with this unique value already exists",
    });
    return;
  }

  if (err.code === "P2025") {
    res.status(404).json({
      error: "Record not found",
    });
    return;
  }

  res.status(status).json({
    error: status === 500 && process.env.NODE_ENV !== "development" 
      ? "Internal server error" 
      : message,
  });
}

/**
 * Async route wrapper to catch errors and forward to error handler.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
