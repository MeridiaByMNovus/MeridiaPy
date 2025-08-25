# MeridiaPy Examples

This folder contains runnable example projects demonstrating various ways to use MeridiaPy — a Python Language Server + Monaco Editor bundle.

Each example is organized as its own workspace package inside this folder.

---

## Examples Included

### Server

- Run server before running any example

```bash
npm run start:server # run the in the examples/ folder and not in browser/ or electron/
```

### Browser

- Runs the Monaco Editor with Python LSP fully in the browser.
- Uses Vite as a development server to serve the app.
- Start it with:

```bash
cd browser
npm install
npm run start:browser
```

- Uses vite to bundle the app and serve it in the browser.

### Electron

- Runs the Monaco Editor with Python LSP inside an Electron desktop app.
- Connects to a running Vite server or loads a built app.
- Start it with:

```bash
cd electron
npm install
npm run start:electron
```

---

## Running Examples Using Workspaces

From the `examples` root folder, run these scripts to start the different examples:

```bash
npm install
npm run start:example:browser   # runs browser workspace example
npm run start:example:electron  # runs electron workspace example
npm run start:server            # runs server workspace example
```

---

## Notes

- Make sure you have Node.js and npm/yarn installed.
- All examples are tested with Vite 7.x and Electron.
- Ports and workspace URLs can be customized in the example source code.
- The server workspace should be started before clients that connect to it.
