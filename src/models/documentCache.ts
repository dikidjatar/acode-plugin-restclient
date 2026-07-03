import { Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

type Container<T> = {
  value: T;
  doc: Text;
};

export class DocumentCache<T> {
  private readonly _cache: Map<EditorView, Container<T>>;

  public constructor(private readonly ignoreVersion: boolean = false) {
    this._cache = new Map<EditorView, Container<T>>();
  }

  public get(view: EditorView): T | undefined {
    const result = this._cache.get(view);
    if (result === undefined) {
      return undefined;
    }
    const { value, doc } = result;
    return this.ignoreVersion
      ? value
      : doc === view.state.doc
        ? value
        : undefined;
  }

  public set(view: EditorView, value: T): this {
    this._cache.set(view, { value, doc: view.state.doc });
    return this;
  }

  public delete(view: EditorView): boolean {
    return this._cache.delete(view);
  }

  public clear(): void {
    this._cache.clear();
  }

  public has(view: EditorView): boolean {
    if (!this._cache.has(view)) {
      return false;
    }
    if (this.ignoreVersion) {
      return true;
    }
    return this._cache.get(view)!.doc === view.state.doc;
  }
}
