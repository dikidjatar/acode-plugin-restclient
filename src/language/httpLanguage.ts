import { StreamParser, StringStream } from "@codemirror/language";

export type HttpLanguageMode = "top" | "json" | "xml" | "curl";

export type HttpLanguageLineKind =
  | "metaComment"
  | "query"
  | "header"
  | "fileVar"
  | "request"
  | "response"
  | null;

export interface HttpLanguageState {
  mode: HttpLanguageMode;
  lineKind: HttpLanguageLineKind;
  lineStep: number;
  xmlTag: boolean;
  xmlTagNameDone: boolean;
  xmlComment: boolean;
}

const METHODS_RE =
  /^(get|post|put|delete|patch|head|options|connect|trace|lock|unlock|propfind|proppatch|copy|move|mkcol|mkcalendar|acl|search)\b/i;

const SEPARATOR_RE = /^\s*#{3,}/;

function startState(): HttpLanguageState {
  return {
    mode: "top",
    lineKind: null,
    lineStep: 0,
    xmlTag: false,
    xmlTagNameDone: false,
    xmlComment: false,
  };
}

function copyState(state: HttpLanguageState): HttpLanguageState {
  return { ...state };
}

function blankLine(state: HttpLanguageState, indentUnit: number): void {
  //noop
}

function tryEndBody(stream: StringStream, state: HttpLanguageState): boolean {
  if (stream.sol() && SEPARATOR_RE.test(stream.string)) {
    state.mode = "top";
    state.lineKind = null;
    state.lineStep = 0;
    return true;
  }
  return false;
}

function tokenQuotedString(stream: StringStream): string {
  const quote = stream.next();
  let escaped = false;
  while (!stream.eol()) {
    const c = stream.next();
    if (c === quote && !escaped) break;
    escaped = c === "\\" && !escaped;
  }
  return "string";
}

function tokenTop(
  stream: StringStream,
  state: HttpLanguageState
): string | null {
  if (stream.sol()) {
    const line = stream.string;

    if (/^\s*curl\b/i.test(line)) {
      state.mode = "curl";
      return tokenCurl(stream, state);
    }
    if (/^\s*(\[|\{(?!\{))/.test(line)) {
      state.mode = "json";
      return tokenJSON(stream, state);
    }
    if (/^\s*<\S/.test(line)) {
      state.mode = "xml";
      state.xmlTag = false;
      state.xmlTagNameDone = false;
      state.xmlComment = false;
      return tokenXML(stream, state);
    }

    if (/^\s*(#+|\/{2,})\s*@(name|note|prompt)\b/.test(line)) {
      state.lineKind = "metaComment";
    } else if (/^\s*(#+|\/{2,})/.test(line)) {
      stream.skipToEnd();
      return "comment";
    } else if (/^\s*@[^\s=]+\s*=/.test(line)) {
      state.lineKind = "fileVar";
    } else if (/^\s*[?&][^=\s]+=/.test(line)) {
      state.lineKind = "query";
    } else if (/^[\w-]+\s*:/.test(line)) {
      state.lineKind = "header";
    } else if (METHODS_RE.test(line)) {
      state.lineKind = "request";
    } else if (/^\s*HTTP\/\S+\s[1-5]\d\d\b/i.test(line)) {
      state.lineKind = "response";
    } else {
      stream.skipToEnd();
      return null;
    }

    state.lineStep = 0;
  }

  switch (state.lineKind) {
    case "metaComment":
      return tokenMetaComment(stream, state);
    case "fileVar":
      return tokenFileVar(stream, state);
    case "query":
      return tokenQuery(stream, state);
    case "header":
      return tokenHeader(stream, state);
    case "request":
      return tokenRequest(stream, state);
    case "response":
      return tokenResponse(stream, state);
    default:
      stream.skipToEnd();
      return null;
  }
}

// # @name foo / // @prompt password
function tokenMetaComment(
  stream: StringStream,
  state: HttpLanguageState
): string | null {
  switch (state.lineStep) {
    case 0:
      stream.match(/^\s*(#+|\/{2,})\s*/);
      state.lineStep = 1;
      return "comment";
    case 1:
      stream.match(/^@(name|note|prompt)/);
      state.lineStep = 2;
      return "propertyName";
    case 2:
      if (stream.eol()) return null;
      stream.eatSpace();
      if (stream.match(/^[^\s]+/)) {
        state.lineStep = 3;
        return "tagName";
      }
      stream.skipToEnd();
      return "comment";
    default:
      if (stream.eol()) return null;
      stream.skipToEnd();
      return "string";
  }
}

// @baseUrl = https://example.com
function tokenFileVar(
  stream: StringStream,
  state: HttpLanguageState
): string | null {
  switch (state.lineStep) {
    case 0:
      stream.eatSpace();
      stream.match(/^@/);
      state.lineStep = 1;
      return "definitionKeyword";
    case 1:
      stream.match(/^[^\s=]+/);
      state.lineStep = 2;
      return "variableName";
    case 2:
      stream.match(/^\s*=\s*/);
      state.lineStep = 3;
      return "operator";
    default:
      if (stream.eol()) return null;
      stream.skipToEnd();
      return "string";
  }
}

// ?key=value / &key=value
function tokenQuery(
  stream: StringStream,
  state: HttpLanguageState
): string | null {
  switch (state.lineStep) {
    case 0:
      stream.eatSpace();
      stream.match(/^[?&]/);
      state.lineStep = 1;
      return "operator";
    case 1:
      stream.match(/^[^=\s]+/);
      state.lineStep = 2;
      return "variableName";
    case 2:
      stream.match(/^=/);
      state.lineStep = 3;
      return "operator";
    default:
      if (stream.eol()) return null;
      stream.skipToEnd();
      return "string";
  }
}

// Header-Name: value
function tokenHeader(
  stream: StringStream,
  state: HttpLanguageState
): string | null {
  switch (state.lineStep) {
    case 0:
      stream.match(/^[\w-]+/);
      state.lineStep = 1;
      return "tagName";
    case 1:
      stream.match(/^\s*:\s*/);
      state.lineStep = 2;
      return "operator";
    default:
      if (stream.eol()) return null;
      stream.skipToEnd();
      return "string";
  }
}

// GET /api/users HTTP/1.1
function tokenRequest(
  stream: StringStream,
  state: HttpLanguageState
): string | null {
  if (stream.eol()) {
    return null;
  }

  switch (state.lineStep) {
    case 0:
      stream.match(METHODS_RE);
      state.lineStep = 1;
      return "keyword";
    case 1:
      stream.eatSpace();
      state.lineStep = 2;
      return null;
    case 2: {
      const rest = stream.string.slice(stream.pos);
      const m = rest.match(/^(.*\S)(\s+)(HTTP\/\S+)\s*$/i);
      if (m) {
        stream.match(new RegExp("^.{" + m[1].length + "}"));
        state.lineStep = 3;
      } else {
        stream.skipToEnd();
        state.lineStep = 99;
      }
      return "url";
    }
    case 3:
      stream.eatSpace();
      state.lineStep = 4;
      return null;
    case 4:
      stream.match(/^HTTP/i);
      state.lineStep = 5;
      return "keyword";
    case 5:
      stream.match(/^\//);
      state.lineStep = 6;
      return "punctuation";
    default:
      if (!stream.match(/^\S+/)) stream.skipToEnd();
      return "number";
  }
}

// HTTP/1.1 200 OK
function tokenResponse(
  stream: StringStream,
  state: HttpLanguageState
): string | null {
  if (stream.eol()) return null;
  switch (state.lineStep) {
    case 0:
      stream.eatSpace();
      stream.match(/^HTTP/i);
      state.lineStep = 1;
      return "keyword";
    case 1:
      stream.match(/^\//);
      state.lineStep = 2;
      return "punctuation";
    case 2:
      stream.match(/^\S+/);
      state.lineStep = 3;
      return "number";
    case 3:
      stream.eatSpace();
      state.lineStep = 4;
      return null;
    case 4:
      stream.match(/^[1-5][0-9][0-9]/);
      state.lineStep = 5;
      return "number";
    case 5:
      stream.eatSpace();
      state.lineStep = 6;
      return null;
    default:
      if (stream.eol()) return null;
      stream.skipToEnd();
      return "string";
  }
}

function tokenJSON(
  stream: StringStream,
  state: HttpLanguageState
): string | null {
  if (tryEndBody(stream, state)) return tokenTop(stream, state);
  if (stream.eatSpace()) return null;
  if (stream.eol()) return null;

  const ch = stream.peek();
  if (ch === '"') return tokenQuotedString(stream);
  if (ch === "{" || ch === "}" || ch === "[" || ch === "]") {
    stream.next();
    return "bracket";
  }
  if (ch === ":" || ch === ",") {
    stream.next();
    return "punctuation";
  }
  if (stream.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/)) return "number";
  if (stream.match(/^(true|false|null)\b/)) return "atom";

  stream.next();
  return null;
}

function tokenXML(
  stream: StringStream,
  state: HttpLanguageState
): string | null {
  if (tryEndBody(stream, state)) {
    return tokenTop(stream, state);
  }

  if (stream.eol()) {
    return null;
  }

  if (state.xmlComment) {
    if (stream.match(/^[\s\S]*?-->/)) state.xmlComment = false;
    else stream.skipToEnd();
    return "comment";
  }

  if (stream.eatSpace()) {
    return null;
  }

  if (stream.match(/^<!--/)) {
    state.xmlComment = true;
    return "comment";
  }

  if (stream.match(/^<\?/) || stream.match(/^\?>/)) {
    return "meta";
  }

  if (stream.match(/^<\//) || stream.match(/^</)) {
    state.xmlTag = true;
    state.xmlTagNameDone = false;
    return "punctuation";
  }

  if (stream.match(/^\/>/) || stream.match(/^>/)) {
    state.xmlTag = false;
    return "punctuation";
  }

  if (state.xmlTag) {
    if (!state.xmlTagNameDone && stream.match(/^[a-zA-Z_:][-a-zA-Z0-9_:.]*/)) {
      state.xmlTagNameDone = true;
      return "keyword";
    }
    if (stream.match(/^[a-zA-Z_:][-a-zA-Z0-9_:]*/)) {
      return "attributeName";
    }
    if (stream.match(/^=/)) {
      return "operator";
    }
    if (stream.peek() === '"' || stream.peek() === "'") {
      const q = stream.next() as string;
      while (!stream.eol()) {
        if (stream.next() === q) break;
      }
      return "attributeValue";
    }
    stream.next();
    return null;
  }

  if (stream.match(/^[^<{]+/)) {
    return null;
  }
  stream.next();
  return null;
}

function tokenCurl(stream: any, state: HttpLanguageState): string | null {
  if (tryEndBody(stream, state)) {
    return tokenTop(stream, state);
  }
  if (stream.eatSpace()) {
    return null;
  }
  if (stream.eol()) {
    return null;
  }
  if (stream.match(/^curl\b/i)) {
    return "keyword";
  }
  if (stream.match(/^--[A-Za-z][\w-]*/) || stream.match(/^-[A-Za-z]\b/)) {
    return "attributeName";
  }
  if (stream.peek() === '"' || stream.peek() === "'")
    return tokenQuotedString(stream);
  if (stream.match(/^https?:\/\/\S+/)) {
    return "url";
  }
  if (stream.match(/^\\$/)) {
    return "punctuation";
  }

  stream.next();
  return null;
}

function token(stream: StringStream, state: HttpLanguageState): string | null {
  const startPos = stream.pos;
  let type: string | null;

  switch (state.mode) {
    case "json":
      type = tokenJSON(stream, state);
      break;
    case "xml":
      type = tokenXML(stream, state);
      break;
    case "curl":
      type = tokenCurl(stream, state);
      break;
    default:
      type = tokenTop(stream, state);
      break;
  }

  if (stream.pos === startPos && !stream.eol()) {
    stream.next();
    return type ?? null;
  }
  return type;
}

export const httpStreamParser: StreamParser<HttpLanguageState> = {
  name: "http",
  startState,
  copyState,
  token,
  blankLine,
  languageData: {
    commentTokens: { line: "#" },
  },
};
