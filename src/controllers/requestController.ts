import { SelectionRange } from "@codemirror/state";
import {
  RequestSettings,
  RestClientSettings,
} from "../models/configurationSettings";
import { HttpRequest } from "../models/httpRequest";
import { RequestMetadata } from "../models/requestMetadata";
import { RequestParserFactory } from "../models/requestParserFactory";
import { HttpClient } from "../utils/httpClient";
import { Selector } from "../utils/selector";
import { getCordovaHttpErrorCode } from "../utils/statusMessage";
import { HttpResponseTextDocumentView } from "../views/httpResponseTextDocumentView";
import { HttpResponseView } from "../views/httpResponseView";

export class RequestController {
  private _httpClient: HttpClient;
  private _textDocumentView: HttpResponseTextDocumentView;
  private _view: HttpResponseView;
  public get responseView(): HttpResponseView {
    return this._view;
  }

  constructor(context: Acode.PluginContext) {
    this._httpClient = new HttpClient();
    this._textDocumentView = new HttpResponseTextDocumentView();
    this._view = new HttpResponseView(context);
  }

  public async run(range: SelectionRange): Promise<void> {
    const editor = editorManager.editor;
    const selectedRequest = await Selector.getRequest(editor as any, range);
    if (!selectedRequest) {
      return;
    }

    const { text, metadatas } = selectedRequest;
    const name = metadatas.get(RequestMetadata.Name);

    if (metadatas.has(RequestMetadata.Note)) {
      const note = name
        ? `Are you sure you want to send the request "${name}"?`
        : "Are you sure you want to send this request?";
      const userConfirmed = await acode.confirm("WARNING", note);
      if (userConfirmed !== true) {
        return;
      }
    }

    const requestSettings = new RequestSettings(metadatas);
    const settings: IRestClientSettings = new RestClientSettings(
      requestSettings
    );

    const httpRequest = await RequestParserFactory.createRequestParser(
      text,
      settings
    ).parseHttpRequest(name);

    await this.runCore(httpRequest, settings);
  }

  private async runCore(
    httpRequest: HttpRequest,
    settings: IRestClientSettings
  ) {
    try {
      const response = await this._httpClient.send(httpRequest, settings);
      if (settings.previewResponseInUntitledDocument) {
        this._textDocumentView.render(response);
      } else {
        this._view.render(response);
      }
    } catch (error) {
      const code = getCordovaHttpErrorCode(error.status);
      if (code === "ETIMEDOUT") {
        error.message = `Request timed out. Double-check your network connection and/or raise the timeout duration. Details: ${error}`;
      }
      console.error("failed to send request:", error);
      acode.pushNotification("ERROR", error.message, { type: "error" });
    }
  }
}
