export function isRange(obj: unknown): obj is Range {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "start" in obj &&
    "end" in obj &&
    typeof obj.start === "number" &&
    typeof obj.end === "number"
  );
}

export function isUndefined(obj: unknown): obj is undefined {
  return typeof obj === "undefined";
}

export function isUndefinedOrNull(obj: unknown): obj is undefined | null {
  return isUndefined(obj) || obj === null;
}
