import { MeridiaPy } from "meridia-py";

/**
 * Example: Bootstrapping a Python Monaco editor
 */
async function startPyEditor() {
  // Grab an HTML container where Monaco will be mounted
  const container = document.getElementById("editor-container");
  if (!container) {
    throw new Error("Editor container not found in DOM.");
  }

  // Assume you have your workspace URL (can be a local fs path or virtual URI)
  const workspaceUrl = "file:///workspace";

  // Create an instance of MeridiaPy
  const editorApp = new MeridiaPy(container, workspaceUrl, 3000);

  // ⚡ Start editor (connects to Pyright running on ws://localhost:3000/pyright)
  // Make sure your Pyright LSP (language server) is running locally.
  const editor = await editorApp.createEditor();
  editor.updateOptions({
    automaticLayout: true,
  });

  // Create an initial Python file model
  const mainPyModel = await editorApp.createModel(
    "/workspace/main.py",
    `print("Hello, Pyright with Meridia!")`
  );

  // Attach the model to the editor
  editorApp.setModel(mainPyModel);
}

// Boot editor on page load
startPyEditor().catch((err) => console.error("Failed to start editor:", err));
