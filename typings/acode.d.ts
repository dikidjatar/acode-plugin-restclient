interface IRestClientSettings {
  readonly followRedirect: boolean;
  readonly defaultHeaders: Record<string, string>;
  readonly timeoutInSeconds: number;
  readonly requestNameAsResponseTabTitle: boolean;
  readonly previewResponseInUntitledDocument: boolean;
}

declare namespace Acode {
  interface PluginContext {
    readonly baseUrl: string;
  }

  interface ISettings {
    restClient: IRestClientSettings | undefined;
  }
}

type CordovaHttpResponseType = "text" | "json" | "arrayBuffer" | "blob";

interface CordovaHttpOptions {
  method: string;
  headers?: Record<string, string>;
  data?: string;
  followRedirect?: boolean;
  responseType?: CordovaHttpResponseType;
  serializer?: string;
  timeout?: number;
}

interface CordovaHttpResponse {
  status: number;
  data: any;
  error?: string;
  headers: Record<string, string>;
  url: string;
}

interface CordovaHttp {
  sendRequest(
    url: string,
    options: CordovaHttpOptions,
    success: (response: CordovaHttpResponse) => void,
    failure: (response: CordovaHttpResponse) => void
  ): void;
}

interface CordovaPlugin {
  http: CordovaHttp;
}

interface Cordova {
  plugin: CordovaPlugin;
}
