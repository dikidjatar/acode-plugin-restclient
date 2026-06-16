import plugin from "../plugin.json";
import { RequestController } from "./controllers/requestController";
import { httpCodeLensExtension } from "./language/httpCodeLensProvider";
import { httpStreamParser } from "./language/httpLanguage";
import { SystemSettings } from "./models/configurationSettings";
import { getFileExtension } from "./utils/misc";

const editorLanguages = acode.require("editorLanguages");
const { StreamLanguage, LanguageSupport } = acode.require(
  "@codemirror/language"
);
const { StateEffect } = acode.require("@codemirror/state");
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
      commands.removeCommand("rest-client.request");
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
  const settings = appSettings.get("restClient")!;

  return {
    list: [
      {
        key: "followRedirect",
        checkbox: settings.followRedirect,
        text: "Followredirect",
        info: "Follow HTTP 3xx responses as redirects.",
      },
      {
        key: "defaultHeaders",
        value: JSON.stringify(settings.defaultHeaders),
        text: "Default Headers",
        info: "If particular headers are omitted in request headers, these will be added as headers for each request.",
        prompt: "Default Headers",
        promptType: "textarea",
      },
      {
        key: "timeoutInSeconds",
        value: settings.timeoutInSeconds,
        text: "Timeout Seconds",
        info: "Timeout in seconds. 0 for infinity",
        prompt: "Timeout Seconds",
        promptType: "number",
      },
      {
        key: "requestNameAsResponseTabTitle",
        checkbox: settings.requestNameAsResponseTabTitle,
        text: "Request Name As Response Tab Title",
        info: "Show request name as the response tab title",
      },
      {
        key: "previewResponseInUntitledDocument",
        checkbox: settings.previewResponseInUntitledDocument,
        text: "Preview Response In Untitled Document",
        info: "tPreview response in untitled document if set to true, otherwise displayed in html view",
      },
    ],
    cb: (key: string, value: any) => {
      if (key === "defaultHeaders") {
        try {
          value = JSON.parse(value);
        } catch {
          value = SystemSettings.DefaultSettings.defaultHeaders;
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
