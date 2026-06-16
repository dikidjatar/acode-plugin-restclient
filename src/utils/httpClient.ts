import { SystemSettings } from "../models/configurationSettings";
import { HttpRequest } from "../models/httpRequest";
import { HttpRequestError } from "../models/httpRequestError";
import { HttpResponse } from "../models/httpResponse";
import { getHeader } from "./misc";
import { getStatusMessage } from "./statusMessage";
import encodeUrl = require("encodeurl");

function getHttpVersion(response: CordovaHttpResponse): string {
  const protocol = getHeader(response.headers, "x-android-selected-protocol");
  return protocol?.split("/")?.[1] ?? "";
}

function getTotalTimingPhases(response: CordovaHttpResponse): number {
  const sentMillis = getHeader(response.headers, "x-android-sent-millis");
  const receiveMillis = getHeader(
    response.headers,
    "x-android-received-millis"
  );

  if (!sentMillis || !receiveMillis) {
    return -1;
  }

  const sentTime = parseInt(sentMillis, 10);
  const receivedTime = parseInt(receiveMillis, 10);
  return receivedTime - sentTime;
}

function sendRequest(
  requestUrl: string,
  options: CordovaHttpOptions
): Promise<CordovaHttpResponse> {
  return new Promise<CordovaHttpResponse>((resolve, reject) => {
    cordova.plugin.http.sendRequest(
      requestUrl,
      options,
      (response) => resolve(response),
      (error) =>
        error.status > 0
          ? resolve(error)
          : reject(new HttpRequestError(error.status, error.error))
    );
  });
}

export class HttpClient {
  public async send(
    httpRequest: HttpRequest,
    settings?: IRestClientSettings
  ): Promise<HttpResponse> {
    settings = settings || SystemSettings.Instance;
    const requestUrl = encodeUrl(httpRequest.url);
    const options = this.prepareOptions(httpRequest, settings);
    const response = await sendRequest(requestUrl, options);
    const httpVersion = getHttpVersion(response);
    const totalTime = getTotalTimingPhases(response);

    return new HttpResponse(
      response.status,
      getStatusMessage(response.status),
      httpVersion,
      response.headers,
      response.data ?? response.error,
      totalTime,
      new HttpRequest(
        options.method,
        requestUrl,
        response.headers,
        response.data ?? response.error,
        httpRequest.name
      )
    );
  }

  private prepareOptions(
    httpRequest: HttpRequest,
    settings: IRestClientSettings
  ): CordovaHttpOptions {
    const options: CordovaHttpOptions = {
      method: httpRequest.method,
      headers: httpRequest.headers,
      data: httpRequest.body,
      followRedirect: settings.followRedirect,
      responseType: "text",
      serializer: "utf8",
    };

    if (settings.timeoutInSeconds > 0) {
      options.timeout = settings.timeoutInSeconds;
    }

    return options;
  }
}
