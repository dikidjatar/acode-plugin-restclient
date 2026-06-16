import type { EditorView } from "@codemirror/view";
import { DocumentCache } from "../models/documentCache";
import { HttpResponse } from "../models/httpResponse";

// type RequestVariableEvent = {
//   name: string;
//   view: EditorView;
// };

export class RequestVariableCache {
  private static cache = new DocumentCache<Map<string, HttpResponse>>(true);

  public static add(view: EditorView, name: string, response: HttpResponse) {
    if (!this.cache.has(view)) {
      this.cache.set(view, new Map<string, HttpResponse>());
    }

    this.cache.get(view)!.set(name, response);
  }

  public static has(view: EditorView, name: string): boolean {
    return this.cache.has(view) && this.cache.get(view)!.has(name);
  }

  public static get(view: EditorView, name: string): HttpResponse | undefined {
    return this.cache.get(view)?.get(name);
  }
}
