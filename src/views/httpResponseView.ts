import hljs from "highlight.js";
import { SystemSettings } from "../models/configurationSettings";
import { HttpRequest } from "../models/httpRequest";
import { HttpResponse } from "../models/httpResponse";
import { MimeUtility } from "../utils/mimeUtility";
import { formatHeaders, isJSONString } from "../utils/misc";
import { ResponseFormatUtility } from "../utils/responseFormatUtility";

const EditorFile = acode.require("EditorFile");
const Url = acode.require("Url");

type FoldingRange = [number, number];

export class HttpResponseView {
  private readonly container: HTMLElement;
  private readonly editorFiles: Acode.EditorFile[] = [];
  private readonly settings: SystemSettings = SystemSettings.Instance;

  constructor(private readonly context: Acode.PluginContext) {
    this.container = tag("div", { className: "rest-client-container" });
    this.container.style.userSelect = "auto";
  }

  public render(response: HttpResponse): void {
    let editorFile: Acode.EditorFile;
    if (this.editorFiles.length === 0) {
      editorFile = new EditorFile(this.getTitle(response), {
        type: "custom",
        content: this.container,
        hideQuickTools: true,
        stylesheets: [
          Url.join(this.context.baseUrl, "styles/acode.css"),
          Url.join(this.context.baseUrl, "styles/rest-client.css"),
        ],
      });

      editorFile.on("close", () => {
        const index = this.editorFiles.findIndex((f) => f === editorFile);
        if (index !== -1) {
          this.editorFiles.splice(index, 1);
        }
      });

      this.editorFiles.push(editorFile);
    } else {
      editorFile = this.editorFiles[this.editorFiles.length - 1];
      editorFile.filename = this.getTitle(response);
    }

    this.container.innerHTML = this.getHtmlForWebview(response);
    editorFile.setCustomTitle(
      () => `${response.statusCode} ${response.statusMessage}`
    );
    editorFile.makeActive();
  }

  private getTitle(response: HttpResponse): string {
    const prefix =
      (this.settings.requestNameAsResponseTabTitle && response.request.name) ||
      "Response";
    return `${prefix}(${response.timeTaken}ms)`;
  }

  private getHtmlForWebview(response: HttpResponse): string {
    let innerHtml: string;
    let contentType = response.contentType;
    if (contentType) {
      contentType = contentType.trim();
    }
    if (
      MimeUtility.isBrowserSupportedImageFormat(contentType) &&
      HttpResponseView.isHeadRequest(response)
    ) {
      innerHtml = `<img src="data:${contentType};base64,${response.body}">`;
    } else {
      const code = this.highlightResponse(response);
      innerHtml = `<pre><code>${this.addLineNums(code)}</code></pre>`;
    }
    return `<div>${innerHtml}</div>`;
  }

  private highlightResponse(response: HttpResponse): string {
    const responseNonBodyPart = hljs.highlight(
      `HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage}
${formatHeaders(response.headers)}\r\n`,
      { language: "http" }
    ).value;
    const responseBodyPart = `${ResponseFormatUtility.formatBody(response.body, response.contentType, false)}`;
    const bodyLanguageAlias = HttpResponseView.getHighlightLanguageAlias(
      response.contentType,
      responseBodyPart
    );
    if (bodyLanguageAlias) {
      return (
        responseNonBodyPart +
        hljs.highlight(responseBodyPart, { language: bodyLanguageAlias }).value
      );
    }
    return responseNonBodyPart + hljs.highlightAuto(responseBodyPart).value;
  }

  private addLineNums(code: any): string {
    code = code.replace(/([\r\n]\s*)(<\/span>)/gi, "$2$1");

    code = this.cleanLineBreaks(code);

    code = code.split(/\r\n|\r|\n/);
    const max = (1 + code.length).toString().length;

    const foldingRanges = this.getFoldingRange(code);

    code = code
      .map(function (line: any, i: number) {
        const lineNum = i + 1;
        const range = foldingRanges.has(lineNum)
          ? ` range-start="${foldingRanges.get(lineNum)![0]}" range-end="${foldingRanges.get(lineNum)![1]}"`
          : "";
        const folding = foldingRanges.has(lineNum)
          ? '<span class="icon"></span>'
          : "";
        return `<span class="line width-${max}" start="${lineNum}"${range}>${line}${folding}</span>`;
      })
      .join("\n");
    return code;
  }

  private cleanLineBreaks(code: string): string {
    const openSpans: string[] = [],
      matcher = /<\/?span[^>]*>|\r\n|\r|\n/gi,
      newline = /\r\n|\r|\n/,
      closingTag = /^<\//;

    return code.replace(matcher, function (match: string) {
      if (newline.test(match)) {
        if (openSpans.length) {
          return (
            openSpans.map(() => "</span>").join("") + match + openSpans.join("")
          );
        } else {
          return match;
        }
      } else if (closingTag.test(match)) {
        openSpans.pop();
        return match;
      } else {
        openSpans.push(match);
        return match;
      }
    });
  }

  private getFoldingRange(lines: string[]): Map<number, FoldingRange> {
    const result = new Map<number, FoldingRange>();
    const stack: [number, number][] = [];

    const leadingSpaceCount = lines
      .map((line, index) => [index, line.search(/\S/)])
      .filter(([, num]) => num !== -1);
    for (const [index, [lineIndex, count]] of leadingSpaceCount.entries()) {
      if (index === 0) {
        continue;
      }

      const [prevLineIndex, prevCount] = leadingSpaceCount[index - 1];
      if (prevCount < count) {
        stack.push([prevLineIndex, prevCount]);
      } else if (prevCount > count) {
        let prev;
        while ((prev = stack.slice(-1)[0]) && prev[1] >= count) {
          stack.pop();
          result.set(prev[0] + 1, [prev[0] + 1, lineIndex]);
        }
      }
    }
    return result;
  }

  private static getHighlightLanguageAlias(
    contentType: string | undefined,
    content: string | null = null
  ): string | null {
    if (MimeUtility.isJSON(contentType)) {
      return "json";
    } else if (MimeUtility.isJavaScript(contentType)) {
      return "javascript";
    } else if (MimeUtility.isXml(contentType)) {
      return "xml";
    } else if (MimeUtility.isHtml(contentType)) {
      return "html";
    } else if (MimeUtility.isCSS(contentType)) {
      return "css";
    } else {
      // If content is provided, guess from content if not content type is matched
      if (content && isJSONString(content)) {
        return "json";
      }
      return null;
    }
  }

  private static isHeadRequest({
    request: { method },
  }: {
    request: HttpRequest;
  }): boolean {
    return method.toLowerCase() === "head";
  }
}
