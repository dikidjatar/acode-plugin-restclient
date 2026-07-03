import { EditorView } from "@codemirror/view";
import { HttpResponse } from "../../models/httpResponse";
import { VariableType } from "../../models/variableType";

export type HttpVariableValue = string | {} | HttpResponse;

export interface HttpVariable {
  name: string;
  value?: HttpVariableValue;
  error?: any;
  warning?: any;
}

export interface HttpVariableContext {
  rawRequest: string;
  parsedRequest: string;
}

export interface HttpVariableProvider {
  readonly type: VariableType;
  has(
    name: string,
    view?: EditorView,
    context?: HttpVariableContext
  ): Promise<boolean>;
  get(
    name: string,
    view?: EditorView,
    context?: HttpVariableContext
  ): Promise<HttpVariable>;
  getAll(
    view?: EditorView,
    context?: HttpVariableContext
  ): Promise<HttpVariable[]>;
}
