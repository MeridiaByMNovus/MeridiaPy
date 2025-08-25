# MeridiaPy

All-in-one Python Language Server + Monaco Editor bundle.  
Run Python LSP (Pyright) directly in the browser or on a Node.js backend with zero setup.

MeridiaPy ships everything you need — Monaco editor, vscode-languageclient, Pyright, JSON-RPC bridge — so you can get completions, hovers, diagnostics, and workspace support in just a few lines of code.

---

## Features

- Works in the browser (Monaco + Python LSP preconfigured)
- Node.js server support (runs Pyright as a language server)
- Ships with all dependencies included — no extra installs
- Simple APIs: `MeridiaPy`, `runServer`
- Powered by Pyright, monaco-languageclient, and vscode-ws-jsonrpc
- Tested with Vite

---

## Installation

```sh
npm install meridia-py
# or
yarn add meridia-py
```

---

## Usage

### Client (Browser)

editor.ts

```ts
import { MeridiaPy } from "meridia-py";

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
```

index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>MeridiaPy Example</title>
    <style>
      #editor-container {
        width: 100%;
        height: 90vh;
        border: 1px solid #ccc;
      }
    </style>
  </head>

  <body>
    <div id="editor-container"></div>
    <script type="module" src="path/to/your/editor.ts"></script>
  </body>
</html>
```

This creates a Monaco editor instance in the browser with Python LSP features enabled.

---

```bash
npx vite
```

This will start the app.

### Server (Node.js)

```ts
import { runServer } from "meridia-py/server";

runServer(30000); // starts Pyright LSP on ws://localhost:30000/pyright
```

The browser client automatically connects via WebSocket.

---

## Project Structure

```
packages/
    code/
        python/
          client.ts   # Browser/Node client (Monaco + LSP)
          server.ts   # Node.js Pyright server
        utils/
          fs-utils.ts # helper utilities
dist/           # compiled output
```

---

## Contributing

Pull requests are welcome. Please open an issue first to discuss changes.

---

## License

MIT
