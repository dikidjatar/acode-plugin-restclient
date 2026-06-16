const openFolder = acode.require("openfolder");

export function getWorkspaceRootPath(): string | undefined {
  const activeFile = editorManager.activeFile;
  if (activeFile) {
    const fileUri = activeFile.uri;
    const workspaceFolder = openFolder.find(fileUri) as unknown as Acode.Folder;
    if (workspaceFolder) {
      return workspaceFolder.url;
    }
  }
  return undefined;
}