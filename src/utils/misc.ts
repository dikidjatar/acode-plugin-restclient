import {
  RequestHeaders,
  RequestHeaderValue,
  ResponseHeaders,
  ResponseHeaderValue,
} from "../models/base";

export function getHeader(
  headers: ResponseHeaders,
  name: string
): ResponseHeaderValue;
export function getHeader(
  headers: RequestHeaders,
  name: string
): RequestHeaderValue;
export function getHeader(
  headers: RequestHeaders | ResponseHeaders,
  name: string
): RequestHeaderValue | ResponseHeaderValue {
  if (!headers || !name) {
    return undefined;
  }

  const headerName = Object.keys(headers).find(
    (h) => h.toLowerCase() === name.toLowerCase()
  );
  return headerName && headers[headerName];
}

export function hasHeader(
  headers: RequestHeaders | ResponseHeaders,
  name: string
): boolean {
  return !!(
    headers &&
    name &&
    Object.keys(headers).some((h) => h.toLowerCase() === name.toLowerCase())
  );
}

export function getContentType(
  headers: RequestHeaders | ResponseHeaders
): string | undefined {
  const value = getHeader(headers, "content-type");
  return value?.toString();
}

export function removeHeader(
  headers: RequestHeaders | ResponseHeaders,
  name: string
) {
  if (!headers || !name) {
    return;
  }

  const headerName = Object.keys(headers).find(
    (h) => h.toLowerCase() === name.toLowerCase()
  );
  if (headerName) {
    delete headers[headerName];
  }
}

export function formatHeaders(
  headers: RequestHeaders | ResponseHeaders
): string {
  let headerString = "";
  for (const header in headers) {
    if (headers.hasOwnProperty(header)) {
      let value: any = headers[header];
      // Handle set-cookie as a special case since multiple entries
      // should appear as their own header. For example:
      //     set-cookie: a=b
      //     set-cookie: c=d
      // Not:
      //     set-cookie: a=b,c=d
      if (header.toLowerCase() === "set-cookie") {
        if (typeof value === "string") {
          value = [value];
        }
        for (const cookie of <Array<string>>value) {
          headerString += `${header}: ${cookie}\n`;
        }
      } else {
        headerString += `${header}: ${value}\n`;
      }
    }
  }
  return headerString;
}

export function base64(text: string): string {
  return text;
}

export function isJSONString(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts[parts.length - 1] ?? "";
}
