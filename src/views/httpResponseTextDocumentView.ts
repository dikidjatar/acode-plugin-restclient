import * as Constants from "../common/constants";
import { HttpResponse } from "../models/httpResponse";
import { formatHeaders } from "../utils/misc";
import { ResponseFormatUtility } from "../utils/responseFormatUtility";

const EditorFile = acode.require("EditorFile");

export class HttpResponseTextDocumentView {
  private readonly editorFiles: Acode.EditorFile[] = [];

  public constructor() {
    editorManager.on("remove-file", (file) => {
      const index = this.editorFiles.indexOf(file);
      if (index !== -1) {
        this.editorFiles.splice(index, 1);
      }
    });
  }

  public render(response: HttpResponse): void {
    const content = this.getTextDocumentContent(response);
    const language = this.getAcodeDocumentLanguageId();
    let editorFile: Acode.EditorFile;
    if (this.editorFiles.length === 0) {
      editorFile = new EditorFile("untitled.txt", { isUnsaved: true });
      editorFile.setMode(language);
      editorFile.onload = () => {
        this.setContent(editorFile, content);
      };
      this.editorFiles.push(editorFile);
    } else {
      editorFile = this.editorFiles[this.editorFiles.length - 1];
      editorFile.setMode(language);
      editorFile.makeActive();
      this.setContent(editorFile, content);
    }
  }

  private getTextDocumentContent(response: HttpResponse): string {
    let content = `HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage}${Constants.EOL}`;
    content += formatHeaders(response.headers);
    content += `${Constants.EOL}${ResponseFormatUtility.formatBody(response.body, response.contentType, true)}`;
    return content;
  }

  private setContent(editorFile: Acode.EditorFile, content: string): void {
    const view = editorManager.editor;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
    });
  }

  private getAcodeDocumentLanguageId(): "http" {
    return "http";
  }
}
