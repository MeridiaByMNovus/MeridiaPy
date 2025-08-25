# MeridiaPy 🚀

_All-in-one Python Language Server + Monaco Editor bundle._
Run Python LSP (Pyright) directly in the browser or on a Node.js backend with zero setup.

MeridiaPy ships everything you need — Monaco Editor, vscode-languageclient, Pyright, JSON-RPC bridge — so you can get completions, hovers, diagnostics, and workspace support in just a few lines of code.

---

## ✨ Features

- 🖥 Works in the **browser** (Monaco + Python LSP preconfigured)
- 📦 Ships with **all dependencies included** — no extra installs
- ⚡ Simple APIs: `MeridiaPy`, `runServer`
- 🔧 Powered by **Pyright**, `monaco-languageclient`, and `vscode-ws-jsonrpc`
- 🧪 Tested with **Vite** and **Electron**

---

## 📦 Installation

```sh
npm install meridia-py
# or
yarn add meridia-py
```

---

## 🚀 Usage

### 1. Client (Browser)

See a working example in [examples/browser](./examples/browser).

```ts
import { MeridiaPy } from "meridia-py";

async function startPyEditor() {
  const container = document.getElementById("editor-container");
  if (!container) throw new Error("Editor container not found");

  const workspaceUrl = "file:///workspace";
  const editorApp = new MeridiaPy(container, workspaceUrl, 3000);

  const editor = await editorApp.createEditor();

  const mainPyModel = await editorApp.createModel(
    "/workspace/main.py",
    `print("Hello, Pyright with Meridia!")`
  );

  editorApp.setModel(mainPyModel);
}

startPyEditor().catch(console.error);
```

---

### Example HTML Wrapper

```html
<!DOCTYPE html>
<html>
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
    <script type="module" src="./editor.ts"></script>
  </body>
</html>
```

Run with:

```bash
npx vite
```

---

### 2. Server (Node.js)

See a working example in [examples/server](./examples/server).

```ts
import { runServer } from "meridia-py/server";

runServer(30000); // Pyright LSP on ws://localhost:30000/pyright
```

The browser client connects via WebSocket automatically.

---

## 📂 Project Structure

```
packages/
  code/
    python/
      client.ts   # Browser/Node client (Monaco + LSP)
      server.ts   # Node.js Pyright server
    utils/
      fs-utils.ts # helper utilities
dist/             # compiled output
examples/         # working usage demos
```

---

## 🧪 Examples

The repository contains runnable examples inside the `examples/` directory:

- **[examples/browser](./examples/browser)** → Run Monaco + Python in a browser with Vite.
- **[examples/electron](./examples/electron)** → Run Monaco + Python in electron.

You can clone the repo and try:

```bash
git clone https://github.com/MeridiaByMNovus/meridia-py.git
cd meridia-py/examples/browser
npm install
npm run dev
```

---

## 🤝 Contributing

Pull requests are welcome!
Please open an issue first to discuss changes or new ideas.

---

## 📜 License

MIT © [MNovus]
