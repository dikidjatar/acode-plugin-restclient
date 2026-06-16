export const RequestMetadataRegex: RegExp =
  /^\s*(?:#|\/{2})\s*@([\w-]+)(?:\s+(.*?))?\s*$/;

export const CommentIdentifiersRegex: RegExp = /^\s*(#|\/{2})/;

export const FileVariableDefinitionRegex: RegExp =
  /^\s*@([^\s=]+)\s*=\s*(.*?)\s*$/;

export const RequestVariableDefinitionWithNameRegexFactory = (
  name: string,
  flags?: string
): RegExp =>
  new RegExp(`^\\s*(?:#{1,}|\\/{2,})\\s+@name\\s+(${name})\\s*$`, flags);

export const LineSplitterRegex: RegExp = /\r?\n/g;

export const PromptCommentRegex =
  /^\s*(?:#{1,}|\/{2,})\s*@prompt\s+([^\s]+)(?:\s+(.*))?\s*$/;

export const EOL = "\n";
