export class HttpRequestError extends Error {
  public status: number;

  constructor(status: number, message?: string) {
    super(message);
    this.status = status;
    this.name = "HttpRequestError";
    Error.captureStackTrace(this, this.constructor);
  }
}
