import { css, html } from "js-beautify";
import { createScanner, SyntaxKind } from "jsonc-parser";
import * as Constants from "../common/constants";
import { MimeUtility } from "./mimeUtility";
import { isJSONString } from "./misc";

export class ResponseFormatUtility {
  private static readonly jsonSpecialTokenMapping = {
    [SyntaxKind.OpenBraceToken]: "{",
    [SyntaxKind.CloseBraceToken]: "}",
    [SyntaxKind.OpenBracketToken]: "[",
    [SyntaxKind.CloseBracketToken]: "]",
    [SyntaxKind.ColonToken]: ":",
    [SyntaxKind.CommaToken]: ",",
    [SyntaxKind.NullKeyword]: "null",
    [SyntaxKind.TrueKeyword]: "true",
    [SyntaxKind.FalseKeyword]: "false",
  };

  public static formatBody(
    body: string,
    contentType: string | undefined,
    suppressValidation: boolean
  ): string {
    if (contentType) {
      if (MimeUtility.isJSON(contentType)) {
        if (isJSONString(body)) {
          body = this.jsonPrettify(body);
        } else if (body && !suppressValidation) {
          acode.pushNotification(
            "WARNING",
            "The content type of response is application/json, while response body is not a valid json string",
            {
              type: "warning",
            }
          );
        }
      } else if (MimeUtility.isXml(contentType)) {
        body = html(body, {
          indent_size: 2,
          preserve_newlines: false,
          wrap_line_length: 0,
        });
      } else if (MimeUtility.isCSS(contentType)) {
        body = css(body, { indent_size: 2 });
      } else {
        // Add this for the case that the content type of response body is not very accurate #239
        if (isJSONString(body)) {
          body = this.jsonPrettify(body);
        }
      }
    }

    return body;
  }

  private static jsonPrettify(text: string, indentSize = 2) {
    const scanner = createScanner(text, true);

    let indentLevel = 0;

    function newLineAndIndent() {
      return Constants.EOL + " ".repeat(indentLevel * indentSize);
    }

    function scanNext(): [SyntaxKind, string] {
      const token = scanner.scan();
      const offset = scanner.getTokenOffset();
      const length = scanner.getTokenLength();
      const value = text.substr(offset, length);
      return [token, value];
    }

    let [firstToken, firstTokenValue] = scanNext();
    let secondToken: SyntaxKind;
    let secondTokenValue: string;
    let result = "";

    while (firstToken !== SyntaxKind.EOF) {
      [secondToken, secondTokenValue] = scanNext();

      switch (firstToken) {
        case SyntaxKind.OpenBraceToken:
          result += this.jsonSpecialTokenMapping[firstToken];
          if (secondToken !== SyntaxKind.CloseBraceToken) {
            indentLevel++;
            result += newLineAndIndent();
          }
          break;
        case SyntaxKind.OpenBracketToken:
          result += this.jsonSpecialTokenMapping[firstToken];
          if (secondToken !== SyntaxKind.CloseBracketToken) {
            indentLevel++;
            result += newLineAndIndent();
          }
          break;
        case SyntaxKind.CloseBraceToken:
        case SyntaxKind.CloseBracketToken:
        case SyntaxKind.NullKeyword:
        case SyntaxKind.TrueKeyword:
        case SyntaxKind.FalseKeyword:
          result += this.jsonSpecialTokenMapping[firstToken];
          if (
            secondToken === SyntaxKind.CloseBraceToken ||
            secondToken === SyntaxKind.CloseBracketToken
          ) {
            indentLevel--;
            result += newLineAndIndent();
          }
          break;
        case SyntaxKind.CommaToken:
          result += this.jsonSpecialTokenMapping[firstToken];
          if (
            secondToken === SyntaxKind.CloseBraceToken ||
            secondToken === SyntaxKind.CloseBracketToken
          ) {
            indentLevel--;
          }
          result += newLineAndIndent();
          break;
        case SyntaxKind.ColonToken:
          result += this.jsonSpecialTokenMapping[firstToken] + " ";
          break;
        case SyntaxKind.StringLiteral:
        case SyntaxKind.NumericLiteral:
        case SyntaxKind.Unknown:
          result += firstTokenValue;
          if (
            secondToken === SyntaxKind.CloseBraceToken ||
            secondToken === SyntaxKind.CloseBracketToken
          ) {
            indentLevel--;
            result += newLineAndIndent();
          }
          break;
        default:
          result += firstTokenValue;
      }

      firstToken = secondToken;
      firstTokenValue = secondTokenValue;
    }

    return result;
  }
}
