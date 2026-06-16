import type { EditorView } from "@codemirror/view";
import * as Constants from "../../common/constants";
import { DocumentCache } from "../../models/documentCache";
import {
  ResolveErrorMessage,
  ResolveResult,
  ResolveState,
  ResolveWarningMessage,
} from "../../models/httpVariableResolveResult";
import { VariableType } from "../../models/variableType";
import { RequestVariableCache } from "../requestVariableCache";
import { RequestVariableCacheValueProcessor } from "../requestVariableCacheValueProcessor";
import { HttpVariable, HttpVariableProvider } from "./httpVariableProvider";

export class RequestVariableProvider implements HttpVariableProvider {
  private static _instance: RequestVariableProvider;

  public static get Instance(): RequestVariableProvider {
    if (!this._instance) {
      this._instance = new RequestVariableProvider();
    }
    return this._instance;
  }

  private readonly requestVariableCache = new DocumentCache<string[]>();

  private constructor() {}

  public readonly type: VariableType = VariableType.Request;

  public async has(name: string, view: EditorView): Promise<boolean> {
    const [variableName] = name.trim().split(".");
    const variables = this.getRequestVariables(view);
    return variables.includes(variableName);
  }

  public async get(name: string, view: EditorView): Promise<HttpVariable> {
    const [variableName] = name.trim().split(".");
    const variables = this.getRequestVariables(view);
    if (!variables.includes(variableName)) {
      return {
        name: variableName,
        error: ResolveErrorMessage.RequestVariableNotExist,
      };
    }
    const value = RequestVariableCache.get(view, variableName);
    if (value === undefined) {
      return {
        name: variableName,
        warning: ResolveWarningMessage.RequestVariableNotSent,
      };
    }

    const resolveResult =
      RequestVariableCacheValueProcessor.resolveRequestVariable(value, name);
    return this.convertToHttpVariable(variableName, resolveResult);
  }

  public async getAll(view: EditorView): Promise<HttpVariable[]> {
    const variables = this.getRequestVariables(view);
    return variables.map((v) => ({
      name: v,
      value: RequestVariableCache.get(view, v),
    }));
  }

  private getRequestVariables(view: EditorView): string[] {
    if (this.requestVariableCache.has(view)) {
      return this.requestVariableCache.get(view)!;
    }

    const fileContent = view.state.doc.toString();
    const requestVariableReferenceRegex = new RegExp(
      Constants.RequestVariableDefinitionWithNameRegexFactory("\\w+"),
      "mg"
    );

    const variableNames = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = requestVariableReferenceRegex.exec(fileContent))) {
      const name = match[1];
      variableNames.add(name);
    }

    const values = [...variableNames];
    this.requestVariableCache.set(view, values);
    return values;
  }

  private convertToHttpVariable(
    name: string,
    result: ResolveResult
  ): HttpVariable {
    if (result.state === ResolveState.Success) {
      return { name, value: result.value };
    } else if (result.state === ResolveState.Warning) {
      return { name, value: result.value, warning: result.message };
    } else {
      return { name, error: result.message };
    }
  }
}
