const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false, // for security, disable node integration in renderer
      contextIsolation: true, // isolate context for renderer
      preload: path.join(__dirname, "preload.js"), // optional: preload script
    },
  });

  // Load a local HTML file or remote URL
  win.loadURL("http://localhost:5173");

  // Uncomment to open DevTools on launch
  // win.webContents.openDevTools();
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed (except macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Re-open a window on macOS when dock icon is clicked & no other windows open
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
