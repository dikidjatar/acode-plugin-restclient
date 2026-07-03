import { EditorView } from "@codemirror/view";
import { FileVariableProvider } from "./httpVariableProviders/fileVariableProvider";
import { HttpVariableProvider } from "./httpVariableProviders/httpVariableProvider";
import { RequestVariableProvider } from "./httpVariableProviders/requestVariableProvider";

export class VariableProcessor {
  private static readonly providers: [HttpVariableProvider, boolean][] = [
    [RequestVariableProvider.Instance, true],
    [FileVariableProvider.Instance, true],
  ];

  public static async processRawRequest(
    request: string,
    resolvedVariables: Map<string, string> = new Map<string, string>()
  ): Promise<string> {
    const variableReferenceRegex = /\{{2}(.+?)\}{2}/g;
    let result = "";
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    variable: while ((match = variableReferenceRegex.exec(request))) {
      result += request.substring(lastIndex, match.index);
      lastIndex = variableReferenceRegex.lastIndex;
      const name = match[1].trim();
      const view = editorManager.editor as unknown as EditorView;
      const context = { rawRequest: request, parsedRequest: result };
      for (const [provider, cacheable] of this.providers) {
        if (resolvedVariables.has(name)) {
          result += resolvedVariables.get(name);
          continue variable;
        }
        if (await provider.has(name, view, context)) {
          const { value, error, warning } = await provider.get(
            name,
            view,
            context
          );
          if (!error && !warning) {
            if (cacheable) {
              resolvedVariables.set(name, value as string);
            }
            result += value;
            continue variable;
          } else {
            break;
          }
        }
      }

      result += `{{${name}}}`;
    }
    result += request.substring(lastIndex);
    return result;
  }
}
