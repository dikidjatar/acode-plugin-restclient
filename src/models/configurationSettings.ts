import { RequestHeaders } from "./base";
import { RequestMetadata } from "./requestMetadata";

const appSettings = acode.require("settings");

export class SystemSettings implements IRestClientSettings {
  private _followRedirect!: boolean;
  private _defaultHeaders!: RequestHeaders;
  private _timeoutInSeconds!: number;
  private _requestNameAsResponseTabTitle!: boolean;
  private _previewResponseInUntitledDocument!: boolean;
  private _useContentDispositionFilename!: boolean;
  private _mimeAndFileExtensionMapping!: { [key: string]: string };

  public get followRedirect() {
    return this._followRedirect;
  }

  public get defaultHeaders() {
    return this._defaultHeaders;
  }

  public get timeoutInSeconds() {
    return this._timeoutInSeconds;
  }

  public get requestNameAsResponseTabTitle() {
    return this._requestNameAsResponseTabTitle;
  }

  public get previewResponseInUntitledDocument() {
    return this._previewResponseInUntitledDocument;
  }

  public get useContentDispositionFilename() {
    return this._useContentDispositionFilename;
  }

  public get mimeAndFileExtensionMapping() {
    return this._mimeAndFileExtensionMapping;
  }

  private constructor() {
    appSettings.on("update:restClient", () => {
      this.initializeSettings();
    });
    this.initializeSettings();
  }

  private initializeSettings(): void {
    const restClientSettings =
      appSettings.get("restClient") ?? SystemSettings.DefaultSettings;
    this._followRedirect = restClientSettings.followRedirect;
    this._defaultHeaders = restClientSettings.defaultHeaders;
    this._timeoutInSeconds = restClientSettings.timeoutInSeconds;
    this._requestNameAsResponseTabTitle =
      restClientSettings.requestNameAsResponseTabTitle;
    this._previewResponseInUntitledDocument =
      restClientSettings.previewResponseInUntitledDocument;
    this._useContentDispositionFilename =
      restClientSettings.useContentDispositionFilename;
    this._mimeAndFileExtensionMapping =
      restClientSettings.mimeAndFileExtensionMapping;
  }

  private static _instance: SystemSettings;
  public static get Instance(): SystemSettings {
    if (!this._instance) {
      this._instance = new SystemSettings();
    }

    return this._instance;
  }

  private static _defaultSettings: IRestClientSettings | undefined;
  public static get DefaultSettings(): IRestClientSettings {
    if (!this._defaultSettings) {
      this._defaultSettings = {
        followRedirect: true,
        defaultHeaders: {
          "User-Agent": "acode-restclient",
        },
        timeoutInSeconds: 0,
        requestNameAsResponseTabTitle: false,
        previewResponseInUntitledDocument: false,
        useContentDispositionFilename: true,
        mimeAndFileExtensionMapping: {},
      };
    }
    return this._defaultSettings;
  }
}

export class RequestSettings implements Partial<IRestClientSettings> {
  private _followRedirect?: boolean = undefined;

  public get followRedirect() {
    return this._followRedirect;
  }

  public constructor(metadatas: Map<RequestMetadata, string | undefined>) {
    if (metadatas.has(RequestMetadata.NoRedirect)) {
      this._followRedirect = false;
    }
  }
}

export class RestClientSettings implements IRestClientSettings {
  public get followRedirect() {
    return (
      this.requestSettings.followRedirect ?? this.systemSettings.followRedirect
    );
  }

  public get defaultHeaders() {
    return this.systemSettings.defaultHeaders;
  }

  public get timeoutInSeconds() {
    return this.systemSettings.timeoutInSeconds;
  }

  public get requestNameAsResponseTabTitle() {
    return this.systemSettings.requestNameAsResponseTabTitle;
  }

  public get previewResponseInUntitledDocument() {
    return this.systemSettings.previewResponseInUntitledDocument;
  }

  public get useContentDispositionFilename() {
    return this.systemSettings.useContentDispositionFilename;
  }

  public get mimeAndFileExtensionMapping() {
    return this.systemSettings.mimeAndFileExtensionMapping;
  }

  private readonly systemSettings = SystemSettings.Instance;

  public constructor(private readonly requestSettings: RequestSettings) {}
}
