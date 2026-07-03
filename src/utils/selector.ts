import { SelectionRange } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { isUndefinedOrNull } from "../base/types";
import * as Constants from "../common/constants";
import {
  fromString as ParseReqMetaKey,
  RequestMetadata,
} from "../models/requestMetadata";
import { SelectedRequest } from "../models/selectedRequest";
import { VariableProcessor } from "./variableProcessor";

export interface RequestRangeOptions {
  ignoreCommentLine?: boolean;
  ignoreEmptyLine?: boolean;
  ignoreFileVariableDefinitionLine?: boolean;
  ignoreResponseRange?: boolean;
}

interface PromptVariableDefinition {
  name: string;
  description?: string;
}

export class Selector {
  private static readonly responseStatusLineRegex = /^\s*HTTP\/[\d.]+/;

  public static async getRequest(
    editor: EditorView,
    range: SelectionRange | null = null
  ): Promise<SelectedRequest | null> {
    if (!editor.state) {
      return null;
    }

    let selectedText: string | null;
    const mainSelection = editor.state.selection.main;

    if (mainSelection.empty || range) {
      const activePos = range ? range.from : mainSelection.head;
      const activeLine = editor.state.doc.lineAt(activePos).number;
      selectedText = this.getDelimitedText(
        editor.state.doc.toString(),
        activeLine
      );
    } else {
      selectedText = editor.state.sliceDoc(
        mainSelection.from,
        mainSelection.to
      );
    }

    if (selectedText === null) {
      return null;
    }

    // convert request text into lines
    const lines = selectedText.split(Constants.LineSplitterRegex);

    // parse request metadata
    const metadatas = this.parseReqMetadatas(lines);

    // process #@prompt comment metadata
    const promptVariablesDefinitions =
      this.parsePromptMetadataForVariableDefinitions(
        metadatas.get(RequestMetadata.Prompt)
      );
    const promptVariables = await this.promptForInput(
      promptVariablesDefinitions
    );
    if (!promptVariables) {
      return null;
    }

    // parse actual request lines
    const rawLines = lines.filter((l) => !this.isCommentLine(l));
    const requestRange = this.getRequestRanges(rawLines)[0];
    if (!requestRange) {
      return null;
    }

    selectedText = rawLines
      .slice(requestRange[0], requestRange[1] + 1)
      .join(Constants.EOL);

    // variables replacement
    selectedText = await VariableProcessor.processRawRequest(
      selectedText,
      promptVariables
    );

    return { text: selectedText, metadatas };
  }

  public static parseReqMetadatas(
    lines: string[]
  ): Map<RequestMetadata, string | undefined> {
    const metadatas = new Map<RequestMetadata, string | undefined>();
    for (const line of lines) {
      if (this.isEmptyLine(line) || this.isFileVariableDefinitionLine(line)) {
        continue;
      }

      if (!this.isCommentLine(line)) {
        // find the first request line
        break;
      }

      // here must be a comment line
      const matched = line.match(Constants.RequestMetadataRegex);
      if (!matched) {
        continue;
      }

      const metaKey = matched[1];
      const metaValue = matched[2];
      const metadata = ParseReqMetaKey(metaKey);
      if (metadata) {
        if (metadata === RequestMetadata.Prompt) {
          this.handlePromptMetadata(metadatas, line);
        } else {
          metadatas.set(metadata, metaValue || undefined);
        }
      }
    }
    return metadatas;
  }

  public static getRequestRanges(
    lines: string[],
    options?: RequestRangeOptions
  ): [number, number][] {
    options = {
      ignoreCommentLine: true,
      ignoreEmptyLine: true,
      ignoreFileVariableDefinitionLine: true,
      ignoreResponseRange: true,
      ...options,
    };
    const requestRanges: [number, number][] = [];
    const delimitedLines = this.getDelimiterRows(lines);
    delimitedLines.push(lines.length);

    let prev = -1;
    for (const current of delimitedLines) {
      let start = prev + 1;
      let end = current - 1;
      while (start <= end) {
        const startLine = lines[start];
        if (
          options.ignoreResponseRange &&
          this.isResponseStatusLine(startLine)
        ) {
          break;
        }

        if (
          (options.ignoreCommentLine && this.isCommentLine(startLine)) ||
          (options.ignoreEmptyLine && this.isEmptyLine(startLine)) ||
          (options.ignoreFileVariableDefinitionLine &&
            this.isFileVariableDefinitionLine(startLine))
        ) {
          start++;
          continue;
        }

        const endLine = lines[end];
        if (
          (options.ignoreCommentLine && this.isCommentLine(endLine)) ||
          (options.ignoreEmptyLine && this.isEmptyLine(endLine))
        ) {
          end--;
          continue;
        }

        requestRanges.push([start, end]);
        break;
      }
      prev = current;
    }

    return requestRanges;
  }

  public static isCommentLine(line: string): boolean {
    return Constants.CommentIdentifiersRegex.test(line);
  }

  public static isEmptyLine(line: string): boolean {
    return line.trim() === "";
  }

  public static isFileVariableDefinitionLine(line: string): boolean {
    return Constants.FileVariableDefinitionRegex.test(line);
  }

  public static isResponseStatusLine(line: string): boolean {
    return this.responseStatusLineRegex.test(line);
  }

  public static getPrompVariableDefinition(
    text: string
  ): PromptVariableDefinition | undefined {
    const matched = text.match(Constants.PromptCommentRegex);
    if (matched) {
      const name = matched[1];
      const description = matched[2];
      return { name, description };
    }
  }

  public static parsePromptMetadataForVariableDefinitions(
    text: string | undefined
  ): PromptVariableDefinition[] {
    const varDefs: PromptVariableDefinition[] = [];
    const parsedDefs = JSON.parse(text || "[]");
    if (Array.isArray(parsedDefs)) {
      for (const parsedDef of parsedDefs) {
        varDefs.push({
          name: parsedDef["name"],
          description: parsedDef["description"],
        });
      }
    }

    return varDefs;
  }

  public static getDelimitedText(
    fullText: string,
    currentLine: number
  ): string | null {
    const lines: string[] = fullText.split(Constants.LineSplitterRegex);
    const delimiterLineNumbers: number[] = this.getDelimiterRows(lines);
    if (delimiterLineNumbers.length === 0) {
      return fullText;
    }

    // return null if cursor is in delimiter line
    if (delimiterLineNumbers.includes(currentLine)) {
      return null;
    }

    if (currentLine < delimiterLineNumbers[0]) {
      return lines.slice(0, delimiterLineNumbers[0]).join(Constants.EOL);
    }

    if (currentLine > delimiterLineNumbers[delimiterLineNumbers.length - 1]) {
      return lines
        .slice(delimiterLineNumbers[delimiterLineNumbers.length - 1] + 1)
        .join(Constants.EOL);
    }

    for (let index = 0; index < delimiterLineNumbers.length - 1; index++) {
      const start = delimiterLineNumbers[index];
      const end = delimiterLineNumbers[index + 1];
      if (start < currentLine && currentLine < end) {
        return lines.slice(start + 1, end).join(Constants.EOL);
      }
    }

    return null;
  }

  private static getDelimiterRows(lines: string[]): number[] {
    return Object.entries(lines)
      .filter(([, value]) => /^#{3,}/.test(value))
      .map(([index]) => +index);
  }

  private static handlePromptMetadata(
    metadatas: Map<RequestMetadata, string | undefined>,
    text: string
  ) {
    const promptVarDef = this.getPrompVariableDefinition(text);
    if (promptVarDef) {
      const varDefs = this.parsePromptMetadataForVariableDefinitions(
        metadatas.get(RequestMetadata.Prompt)
      );
      varDefs.push(promptVarDef);
      metadatas.set(RequestMetadata.Prompt, JSON.stringify(varDefs));
    }
  }

  private static async promptForInput(
    defs: PromptVariableDefinition[]
  ): Promise<Map<string, string> | null> {
    const promptVariables = new Map<string, string>();
    for (const { name, description } of defs) {
      const value = await acode.prompt(
        `Input value for "${name}"`,
        "",
        "text",
        { placeholder: description }
      );
      if (!isUndefinedOrNull(value)) {
        promptVariables.set(name, value);
      } else {
        return null;
      }
    }
    return promptVariables;
  }
}
