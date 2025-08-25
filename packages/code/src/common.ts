import { languages } from "monaco-editor";
import "vscode/default-extensions/theme-defaults";
import "vscode/default-extensions/json";
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

export const createLanguageClient = (
  transports: MessageTransports
): MonacoLanguageClient => {
  return new MonacoLanguageClient({
    name: "Sample Language Client",
    clientOptions: {
      documentSelector: ["json"],

      errorHandler: {
        error: () => ({ action: ErrorAction.Continue }),
        closed: () => ({ action: CloseAction.DoNotRestart }),
      },
    },

    connectionProvider: {
      get: () => {
        return Promise.resolve(transports);
      },
    },
  });
};

export const createUrl = (
  hostname: string,
  port: number,
  path: string
): string => {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${hostname}:${port}${path}`;
};

export const createWebSocketAndStartClient = (url: string): WebSocket => {
  const webSocket = new WebSocket(url);
  webSocket.onopen = () => {
    const socket = toSocket(webSocket);
    const reader = new WebSocketMessageReader(socket);
    const writer = new WebSocketMessageWriter(socket);
    const languageClient = createLanguageClient({
      reader,
      writer,
    });
    languageClient.start();
    reader.onClose(() => languageClient.stop());
  };
  return webSocket;
};

export const performInit = async (vscodeApiInit: boolean) => {
  if (vscodeApiInit === true) {
    await initServices({
      enableThemeService: true,
      enableTextmateService: true,
      enableModelService: true,
      configureEditorOrViewsService: {},
      enableKeybindingsService: true,
      enableLanguagesService: true,
      enableOutputService: true,
      enableAccessibilityService: true,
      debugLogging: false,
    });

    languages.register({
      id: "json",
      extensions: [".json", ".jsonc"],
      aliases: ["JSON", "json"],
      mimetypes: ["application/json"],
    });
  }
};
