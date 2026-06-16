import { RequestHeaders } from "./base";

export class HttpRequest {
  public constructor(
    public method: string,
    public url: string,
    public headers: RequestHeaders,
    public body?: string,
    public name?: string
  ) {
    this.method = method.toLocaleUpperCase();
  }
}
