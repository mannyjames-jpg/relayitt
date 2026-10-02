/** Error thrown by shared services; carries an HTTP-ish status for REST handlers. */
export class ServiceError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 500, code = "internal_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Map a PostgREST error to a ServiceError, keeping the original message. */
export function fromDbError(error: { message: string; code?: string }): ServiceError {
  if (error.code === "PGRST116") return new ServiceError(error.message, 404, "not_found");
  return new ServiceError(error.message, 500, "internal_error");
}
