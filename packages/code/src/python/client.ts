// Import core Monaco Editor and VSCode compatibility packages for browser/standalone mode.
import "monaco-editor/esm/vs/editor/editor.all.js"; // Monaco core editor
import "monaco-editor/esm/vs/editor/standalone/browser/iPadShowKeyboard/iPadShowKeyboard.js"; // iPad keyboard support
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js"; // Monaco API
import * as vscode from "vscode"; // VSCode API shim for Monaco/Browser

// Import built-in VSCode extensions for themes and Python language support
import "vscode/default-extensions/theme-defaults"; // VSCode default themes
import "vscode/default-extensions/python"; // Python language extension (syntax, completion, etc.)

import { updateUserConfiguration } from "vscode/service-override/configuration"; // Dynamic VSCode settings
import { LogLevel } from "vscode/services"; // VSCode service log levels

import { createConfiguredEditor, createModelReference } from "vscode/monaco"; // Monaco editor helpers from VSCode API
import { ExtensionHostKind, registerExtension } from "vscode/extensions"; // Register extensions in VSCode API

import { initServices, MonacoLanguageClient } from "monaco-languageclient"; // Monaco Language Client (LSP bridge)
import {
  CloseAction,
  ErrorAction,
  MessageTransports,
} from "vscode-languageclient"; // LSP message transport/error handling

import {
  WebSocketMessageReader,
  WebSocketMessageWriter,
  toSocket,
} from "vscode-ws-jsonrpc"; // WebSocket RPC for LSP protocol

// --- Monaco Editor Workers ---
// Spin up the Monaco worker definitions so syntax features work in browser environments.
import { buildWorkerDefinition } from "monaco-editor-workers";
buildWorkerDefinition(
  "../../../node_modules/monaco-editor-workers/dist/workers/",
  new URL("", window.location.href).href,
  false
);

// -----------------------------------------
//            HELPER FUNCTIONS
// -----------------------------------------

// Detect if running on Windows platform for file path normalization
const isWindows = navigator.platform.indexOf("Win") > -1;

/**
 * Ensures file paths are properly formatted depending on OS.
 * Converts `/` to `\` on Windows for compatibility.
 */
const getSafePath = (path: string): string => {
  if (isWindows) {
    return path.replace(/\//g, "\\");
  }
  return path;
};

// Track service initialization state for idempotency
let servicesInitialized = false;

/**
 * Initializes VSCode/Monaco backend services ONCE.
 * Enables languages, themes, config, file model services, keybindings, etc.
 *
 * @param workspaceUrl The URI string of the workspace to attach.
 */
const initializeServicesOnce = async (workspaceUrl: string): Promise<void> => {
  if (servicesInitialized) {
    // Prevent duplicate initialization
    return;
  }
  try {
    await initServices({
      enableModelService: true, // Enables Monaco text model service
      enableThemeService: true, // Enables dynamic theme switching
      enableTextmateService: true, // Textmate grammars for syntax coloring
      configureConfigurationService: { defaultWorkspaceUri: workspaceUrl },
      enableLanguagesService: true, // Language service for code intelligence
      enableKeybindingsService: true, // Keyboard shortcut support
      debugLogging: false,
      logLevel: LogLevel.Info,
    });
    servicesInitialized = true;
  } catch (error) {
    throw error;
  }
};

/**
 * Registers Python language extension and associated commands & keybindings.
 * Pyright features (restart server, organize imports, etc.) are mapped here.
 */
const registerLanguageExtensions = (): void => {
  try {
    const extension = {
      name: "python-client",
      publisher: "monaco-languageclient-project",
      version: "1.0.0",
      engines: {
        vscode: "^1.78.0",
      },
      contributes: {
        languages: [
          {
            id: "python",
            aliases: ["Python"],
            extensions: [".py", ".pyi"],
          },
        ],
        commands: [
          {
            command: "pyright.restartserver",
            title: "Pyright: Restart Server",
            category: "Pyright",
          },
          {
            command: "pyright.organizeimports",
            title: "Pyright: Organize Imports",
            category: "Pyright",
          },
        ],
        keybindings: [
          {
            key: "ctrl+k",
            command: "pyright.restartserver",
            when: "editorTextFocus",
          },
        ],
      },
    };
    registerExtension(extension, ExtensionHostKind.LocalProcess);
  } catch (error) {
    // Ignore extension registration errors gracefully
  }
};

// -----------------------------------------
//            MAIN CLASS: MeridiaPy
// -----------------------------------------

/**
 * MeridiaPy
 *
 * Provides an editor wrapper around Monaco + VSCode API, integrated with Pyright LSP for Python.
 * Handles all initialization, model creation, and language server client setup.
 */
export class MeridiaPy {
  public editor: monaco.editor.IStandaloneCodeEditor; // Monaco Editor instance
  public languageClient: MonacoLanguageClient; // Python LSP client
  public models: Map<string, monaco.editor.ITextModel> = new Map(); // File models

  constructor(
    private readonly container: HTMLElement, // Parent DOM node for editor
    private readonly workspaceUrl: string, // Workspace URI for context
    private readonly port: number = 3000 // Pyright LSP websocket port
  ) {}

  /**
   * Opens a websocket to the Python Language Server (Pyright).
   * Handles connection, errors, timeouts, and binding to language client.
   *
   * @param url The WebSocket endpoint (usually /pyright).
   * @returns Promise that resolves when connection is established.
   */
  private createSafeWebSocket = (url: string): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      try {
        const webSocket = new WebSocket(url);

        webSocket.onopen = async () => {
          try {
            const socket = toSocket(webSocket);
            const reader = new WebSocketMessageReader(socket);
            const writer = new WebSocketMessageWriter(socket);

            // Attach message transport to the language client
            this.languageClient = this.createLanguageClient({ reader, writer });

            // Start the LSP client for code intelligence, diagnostics, etc.
            await this.languageClient.start();
            reader.onClose(() => this.languageClient.stop());

            // Command registration for Pyright server actions via VSCode API
            vscode.commands.registerCommand(
              "pyright.restartserver",
              async (...args: unknown[]) => {
                try {
                  await this.languageClient.sendRequest(
                    "workspace/executeCommand",
                    {
                      command: "pyright.restartserver",
                      arguments: args,
                    }
                  );
                } catch (error) {}
              }
            );

            resolve(webSocket);
          } catch (error) {
            reject(error);
          }
        };

        // Collect connection errors and surface to caller
        webSocket.onerror = (error) => {
          reject(new Error(`WebSocket connection failed: ${error}`));
        };

        // Handle abnormal closure (unexpected disconnects)
        webSocket.onclose = (event) => {
          if (event.code !== 1000) {
            // Unexpected disconnect handler (could augment for UX/log)
          }
        };

        // Timeout logic: fail if connection not ready within 10s
        setTimeout(() => {
          if (webSocket.readyState === WebSocket.CONNECTING) {
            webSocket.close();
            reject(new Error("WebSocket connection timeout"));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  };

  /**
   * Constructs a Monaco language client for Pyright LSP.
   *
   * @param transports LSP message transport channels.
   * @returns MonacoLanguageClient instance configured for Python.
   */
  private createLanguageClient = (
    transports: MessageTransports
  ): MonacoLanguageClient => {
    return new MonacoLanguageClient({
      name: "Pyright Language Client",
      clientOptions: {
        documentSelector: ["python"], // File type to bind LSP
        errorHandler: {
          error: () => ({ action: ErrorAction.Continue }),
          closed: () => ({ action: CloseAction.DoNotRestart }),
        },
        workspaceFolder: {
          index: 0,
          name: this.workspaceUrl,
          uri: monaco.Uri.parse(this.workspaceUrl),
        },
        synchronize: {
          fileEvents: [vscode.workspace.createFileSystemWatcher("**")],
        },
      },
      connectionProvider: {
        get: () => {
          return Promise.resolve(transports);
        },
      },
    });
  };

  /**
   * Creates and configures the Monaco editor instance in the supplied DOM node.
   * Initializes all required services and registers Python language extensions.
   *
   * @returns Monaco standalone code editor instance
   */
  createEditor = async (): Promise<monaco.editor.IStandaloneCodeEditor> => {
    await initializeServicesOnce(this.workspaceUrl);
    registerLanguageExtensions();
    await this.createSafeWebSocket(`ws://localhost:${this.port}/pyright`);

    // User configuration: set font size and default theme
    updateUserConfiguration(`{
        "editor.fontSize": 14,
        "workbench.colorTheme": "Default Dark Modern"
    }`);

    this.editor = await createConfiguredEditor(this.container);
    return this.editor;
  };

  /**
   * Creates a new Monaco model (opens file buffer) for Python in workspace.
   *
   * @param fileUri File path or URI.
   * @param content Initial contents for new model.
   * @returns Monaco TextModel instance for editing and LSP features.
   */
  createModel = async (
    fileUri: string,
    content: string
  ): Promise<monaco.editor.ITextModel> => {
    // Normalize file URI for Windows compatibility
    const normalizedUri = isWindows
      ? monaco.Uri.file(getSafePath(fileUri))
      : monaco.Uri.file(fileUri);

    // Create Monaco model reference (buffer)
    const modelRef = await createModelReference(normalizedUri, content);

    if (!modelRef || !modelRef.object) {
      throw new Error("Failed to create model reference");
    }

    const model = modelRef.object.textEditorModel as monaco.editor.ITextModel;

    if (!model) {
      throw new Error("Failed to get text editor model");
    }

    this.models.set(fileUri, model);

    return model;
  };

  /** Retrieve a Monaco model by its file URI. */
  getModel(fileUri: string) {
    return this.models.get(fileUri);
  }

  /** List all open models currently stored. */
  getAllModels() {
    return this.models;
  }

  /** Set an existing model as the active editor buffer. */
  setModel(model: monaco.editor.ITextModel) {
    this.editor.setModel(model);
  }

  /** Switch editor to a model from fileUri. */
  setModelByUri(fileUri: string) {
    this.editor.setModel(this.models.get(fileUri)!);
  }

  /** Remove and destroy a model from the store. */
  removeModel(fileUri: string) {
    this.models.delete(fileUri);
  }

  /** Clear all models from editor and store. */
  clearModels() {
    this.models.clear();
  }

  /** Dispose the Monaco editor, models, and registered services. */
  dispose() {
    this.resetServices();
    this.editor.dispose();
    this.models = null as any;
  }

  /**
   * Create and switch to a NEW empty model for the given fileUri.
   * Useful for creating new files or quick changes.
   */
  switchModel = async (fileUri: string): Promise<void> => {
    const model = await this.createModel(fileUri, "");
    await this.editor.setModel(model);
  };

  /**
   * Reset VSCode/Monaco services (useful for hot reload/development).
   * Stops language client and allows full re-init.
   */
  resetServices = (): void => {
    servicesInitialized = false;
    if (this.languageClient) {
      this.languageClient.stop();
    }
  };
}
