import { LanguageSupport, StreamLanguage } from "@codemirror/language";
import plugin from "../plugin.json";
import { RequestController } from "./controllers/requestController";
import { httpCodeLensExtension } from "./language/httpCodeLensProvider";
import { httpStreamParser } from "./language/httpLanguage";
import { SystemSettings } from "./models/configurationSettings";
import { getFileExtension } from "./utils/misc";
import { StateEffect } from "@codemirror/state";

const editorLanguages = acode.require("editorLanguages");
const commands = acode.require("commands");
const Url = acode.require("Url");
const appSettings = acode.require("settings");

function isHttpFile(file: Acode.EditorFile): boolean {
  if (!file) {
    return false;
  }
  const extension = getFileExtension(file.name);
  return ["http", "rest"].includes(extension);
}

class AcodePlugin {
  private requestController!: RequestController;
  private style!: HTMLLinkElement;

  constructor() {
    if (!appSettings.value["restClient"]) {
      appSettings.value["restClient"] = SystemSettings.DefaultSettings;
      appSettings.update({}, true, true);
    }
    this.dispatchView = this.dispatchView.bind(this);
  }

  init(context: Acode.PluginContext): void {
    this.requestController = new RequestController(context);
    this.setupStyle(context);
    this.registerHttpLanguage();
    this.registerCommands();
    this.registerListeners();
    this.dispatchView(editorManager.activeFile);
  }

  private setupStyle(context: Acode.PluginContext): void {
    this.style = tag("link", {
      rel: "stylesheet",
      href: Url.join(context.baseUrl, "styles/codelens.css"),
    });
    document.head.appendChild(this.style);
  }

  private registerHttpLanguage(): void {
    const httpLanguage = StreamLanguage.define(httpStreamParser);
    const httpLanguageSupport = new LanguageSupport(httpLanguage);
    editorLanguages.register(
      "http",
      ["http", "rest"],
      "HTTP / REST Client",
      () => httpLanguageSupport
    );
    editorManager.files.forEach((file) => {
      if (!isHttpFile(file)) {
        return;
      }
      file.setMode("http");
    });
  }

  private registerCommands(): void {
    commands.addCommand({
      name: "rest-client.request",
      description: "Rest Client: Send Request",
      exec: async (view: any, range: any) => {
        this.requestController.run(range as any);
        return undefined;
      },
    });
    commands.addCommand({
      name: "rest-client.copy-response-body",
      description: "Rest Client: Copy Response Body",
      exec: async () => {
        await this.requestController.responseView.copyBody();
      },
    });
    commands.addCommand({
      name: "rest-client.save-response",
      description: "Rest Client: Save Response",
      exec: async () => {
        await this.requestController.responseView.save();
      },
    });
    commands.addCommand({
      name: "rest-client.save-response-body",
      description: "Rest Client: Save Response Body",
      exec: async () => {
        await this.requestController.responseView.saveBody();
      },
    });
  }

  private registerListeners(): void {
    editorManager.on("new-file", this.dispatchView);
    editorManager.on("switch-file", this.dispatchView);
  }

  private dispatchView(file: Acode.EditorFile): void {
    if (!isHttpFile(file)) {
      return;
    }

    setTimeout(() => {
      const view = editorManager.editor;
      view.dispatch({
        effects: StateEffect.appendConfig.of(httpCodeLensExtension),
      });
    }, 500);
  }

  destroy() {
    try {
      this.requestController.responseView.dispose();
      commands.removeCommand("rest-client.request");
      commands.removeCommand("rest-client.copy-response-body");
      commands.removeCommand("rest-client.save-response");
      commands.removeCommand("rest-client.save-response-body");
      editorLanguages.unregister("http");
      editorManager.off("new-file", this.dispatchView);
      editorManager.off("switch-file", this.dispatchView);
      appSettings.update({ restClient: undefined }, false, true);
      this.style.remove();
    } catch (error) {
      console.log("failed to destroy:", error);
    }
  }
}

function restClientSettings(): Acode.PluginSettings {
  const restClientSettings = appSettings.get("restClient")!;

  return {
    list: [
      {
        key: "followRedirect",
        checkbox: restClientSettings.followRedirect,
        text: "Followredirect",
        info: "Follow HTTP 3xx responses as redirects.",
      },
      {
        key: "defaultHeaders",
        value: JSON.stringify(restClientSettings.defaultHeaders),
        text: "Default Headers",
        info: "If particular headers are omitted in request headers, these will be added as headers for each request.",
        prompt: "Default Headers",
        promptType: "textarea",
      },
      {
        key: "timeoutInSeconds",
        value: restClientSettings.timeoutInSeconds,
        text: "Timeout Seconds",
        info: "Timeout in seconds. 0 for infinity",
        prompt: "Timeout Seconds",
        promptType: "number",
      },
      {
        key: "requestNameAsResponseTabTitle",
        checkbox: restClientSettings.requestNameAsResponseTabTitle,
        text: "Request Name As Response Tab Title",
        info: "Show request name as the response tab title",
      },
      {
        key: "previewResponseInUntitledDocument",
        checkbox: restClientSettings.previewResponseInUntitledDocument,
        text: "Preview Response In Untitled Document",
        info: "tPreview response in untitled document if set to true, otherwise displayed in html view",
      },
      {
        key: "useContentDispositionFilename",
        checkbox: restClientSettings.useContentDispositionFilename,
        text: "Use Content Disposition Filename",
        info: "Enable/disable using filename from 'content-disposition' header, when saving response body",
      },
      {
        key: "mimeAndFileExtensionMapping",
        value: JSON.stringify(restClientSettings.mimeAndFileExtensionMapping),
        text: "Rest-client: Mime And File Extension Mapping",
        info: 'Sets the custom mapping of mime type and file extension of saved response body (e.g., {"application/atom+xml": "xml"})',
        prompt: "Mime And File Extension Mapping",
        promptType: "textarea",
      },
    ],
    cb: (key: string, value: any) => {
      if (key === "defaultHeaders") {
        try {
          value = JSON.parse(value);
        } catch {
          value = SystemSettings.DefaultSettings.defaultHeaders;
        }
      } else if (key === "mimeAndFileExtensionMapping") {
        try {
          value = JSON.parse(value);
        } catch {
          return;
        }
      }

      const settings = appSettings.get("restClient")!;
      appSettings.update(
        { restClient: { ...settings, [key]: value } },
        true,
        true
      );
    },
  };
}

if (window.acode) {
  const acodePlugin = new AcodePlugin();
  acode.setPluginInit(
    plugin.id,
    async (baseUrl: string) => {
      if (!baseUrl.endsWith("/")) {
        baseUrl += "/";
      }
      acodePlugin.init({ baseUrl } as any);
    },
    restClientSettings()
  );
  acode.setPluginUnmount(plugin.id, () => {
    acodePlugin.destroy();
  });
}
