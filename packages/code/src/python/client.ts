import "monaco-editor/esm/vs/editor/editor.all.js";
import "monaco-editor/esm/vs/editor/standalone/browser/iPadShowKeyboard/iPadShowKeyboard.js";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import * as vscode from "vscode";
import "vscode/default-extensions/theme-defaults";
import "vscode/default-extensions/python";
import { updateUserConfiguration } from "vscode/service-override/configuration";
import { LogLevel } from "vscode/services";
import { createConfiguredEditor, createModelReference } from "vscode/monaco";
import { ExtensionHostKind, registerExtension } from "vscode/extensions";
import { initServices, MonacoLanguageClient } from "monaco-languageclient";
import {
  CloseAction,
  ErrorAction,
  MessageTransports,
} from "vscode-languageclient";
import {
  WebSocketMessageReader,
  WebSocketMessageWriter,
  toSocket,
} from "vscode-ws-jsonrpc";

import { buildWorkerDefinition } from "monaco-editor-workers";
buildWorkerDefinition(
  "../../../node_modules/monaco-editor-workers/dist/workers/",
  new URL("", window.location.href).href,
  false
);

// -----------------------------------------
//            HELPER FUNCTIONS
// -----------------------------------------

// Detect if running on Windows platform
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

let servicesInitialized = false;

/**
 * Initializes VSCode/Monaco backend services ONCE.
 * Enables languages, theming, configuration, file model services, etc.
 *
 * @param workspaceUrl The URI string of the workspace to attach.
 */
const initializeServicesOnce = async (workspaceUrl: string): Promise<void> => {
  if (servicesInitialized) {
    return;
  }

  try {
    await initServices({
      enableModelService: true,
      enableThemeService: true,
      enableTextmateService: true,
      configureConfigurationService: {
        defaultWorkspaceUri: workspaceUrl,
      },
      enableLanguagesService: true,
      enableKeybindingsService: true,
      debugLogging: false,
      logLevel: LogLevel.Info,
    });

    servicesInitialized = true;
  } catch (error) {
    throw error;
  }
};

/**
 * Registers the Python extension compatibility (Pyright features).
 * Defines language id, file extensions, keyboard shortcuts, and commands.
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
 * Provides an editor wrapper around Monaco + VSCode API,
 * integrated with Pyright Language Server for Python.
 */
export class MeridiaPy {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private languageClient: MonacoLanguageClient;
  private models: Map<string, monaco.editor.ITextModel> = new Map();

  constructor(
    private readonly container: HTMLElement, // Parent DOM container for editor
    private readonly workspaceUrl: string, // Workspace URI
    private readonly port: number = 3000 // Language Server connection port
  ) {}

  /**
   * Creates a WebSocket safely with timeout, error handling,
   * and binding to Pyright language client transport.
   *
   * @param url The WebSocket endpoint (usually Language Server endpoint).
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

            // Attach language client with LSP message transports
            this.languageClient = this.createLanguageClient({ reader, writer });

            // Start language client (enables autocomplete, diagnostics, etc.)
            await this.languageClient.start();
            reader.onClose(() => this.languageClient.stop());

            // Register Pyright restart command in VSCode API
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

        // Handle socket failures
        webSocket.onerror = (error) => {
          reject(new Error(`WebSocket connection failed: ${error}`));
        };

        // Handle abnormal closure
        webSocket.onclose = (event) => {
          if (event.code !== 1000) {
            // handle unexpected disconnection
          }
        };

        // Timeout protection: connection must open within 10 seconds
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
   * Create the Monaco Language Client instance for Pyright LSP.
   *
   * @param transports The LSP message transport channels.
   * @param workspaceUrl Workspace URI for context.
   */
  private createLanguageClient = (
    transports: MessageTransports
  ): MonacoLanguageClient => {
    return new MonacoLanguageClient({
      name: "Pyright Language Client",
      clientOptions: {
        // use a language id as a document selector
        documentSelector: ["python"],
        // disable the default error handler
        errorHandler: {
          error: () => ({ action: ErrorAction.Continue }),
          closed: () => ({ action: CloseAction.DoNotRestart }),
        },
        // pyright requires a workspace folder to be presen, otherwise it will not work
        workspaceFolder: {
          index: 0,
          name: this.workspaceUrl,
          uri: monaco.Uri.parse(this.workspaceUrl),
        },
        synchronize: {
          fileEvents: [vscode.workspace.createFileSystemWatcher("**")],
        },
      },
      // create a language client connection from the JSON RPC connection on demand
      connectionProvider: {
        get: () => {
          return Promise.resolve(transports);
        },
      },
    });
  };

  /**
   * Creates and initializes the Monaco editor with all services enabled.
   * @returns An instance of Monaco standalone code editor.
   */
  createEditor = async (): Promise<monaco.editor.IStandaloneCodeEditor> => {
    await initializeServicesOnce(this.workspaceUrl);
    registerLanguageExtensions();
    await this.createSafeWebSocket(`ws://localhost:${this.port}/pyright`);

    updateUserConfiguration(`{
        "editor.fontSize": 14,
        "workbench.colorTheme": "Default Dark Modern"
    }`);

    this.editor = await createConfiguredEditor(this.container);
    return this.editor;
  };

  /**
   * Creates a Monaco model for given file (Python-aware).
   *
   * @param fileUri File path or URI.
   * @param content Initial file content.
   * @returns A text model attached to language services.
   */
  createModel = async (
    fileUri: string,
    content: string
  ): Promise<monaco.editor.ITextModel> => {
    const normalizedUri = isWindows
      ? monaco.Uri.file(getSafePath(fileUri))
      : monaco.Uri.file(fileUri);

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

  /** Get a stored Monaco model by its file URI */
  getModel(fileUri: string) {
    return this.models.get(fileUri);
  }

  /** Set an existing model active in the editor */
  setModel(model: monaco.editor.ITextModel) {
    this.editor.setModel(model);
  }

  /** Switch to a model by fileUri from stored model map */
  setModelByUri(fileUri: string) {
    this.editor.setModel(this.models.get(fileUri)!);
  }

  /** Dispose editor + models + services */
  dispose() {
    this.resetServices();
    this.editor.dispose();
    this.models = null as any;
  }

  /**
   * Creates and switches editor to a new empty model for given fileUri.
   */
  switchModel = async (fileUri: string): Promise<void> => {
    const model = await this.createModel(fileUri, "");
    await this.editor.setModel(model);
  };

  /**
   * Reset VSCode/Monaco services (useful for hot reload/testing).
   * Stops the language client and allows reinitialization.
   */
  resetServices = (): void => {
    servicesInitialized = false;
    if (this.languageClient) {
      this.languageClient.stop();
    }
  };
}
