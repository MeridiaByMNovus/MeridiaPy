import { WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { URL } from "url";
import { Socket } from "net";
import express from "express";
import { resolve } from "path";
import {
  IWebSocket,
  WebSocketMessageReader,
  WebSocketMessageWriter,
} from "vscode-ws-jsonrpc";
import {
  createConnection,
  createServerProcess,
  forward,
} from "vscode-ws-jsonrpc/server";
import {
  Message,
  InitializeRequest,
  InitializeParams,
} from "vscode-languageserver";
import { getLocalDirectory } from "../utils/fs-utils.js";

const launchLanguageServer = (socket: IWebSocket) => {
  const serverName = "PYRIGHT";
  const ls = resolve(
    getLocalDirectory(import.meta.url),
    "../pyright/dist/pyright-langserver.js"
  );
  const serverProcesses = createServerProcess(serverName, "node", [
    ls,
    "--stdio",
  ]);
  if (serverProcesses?.serverProcess?.stdout !== null) {
    serverProcesses?.serverProcess?.stdout.on("data", (data) =>
      console.log(`${serverName} Server: ${data}`)
    );
  }

  const reader = new WebSocketMessageReader(socket);
  const writer = new WebSocketMessageWriter(socket);
  const socketConnection = createConnection(reader, writer, () =>
    socket.dispose()
  );
  if (serverProcesses?.connection) {
    forward(socketConnection, serverProcesses.connection, (message) => {
      if (Message.isRequest(message)) {
        console.log(message);
        if (message.method === InitializeRequest.type.method) {
          const initializeParams = message.params as InitializeParams;
          initializeParams.processId = process.pid;
        }
      }
      return message;
    });
  }
};

export const runServer = (port: number = 3000) => {
  process.on("uncaughtException", function (err: any) {
    console.error("Uncaught Exception: ", err.toString());
    if (err.stack) {
      console.error(err.stack);
    }
  });

  const app = express();

  const dir = getLocalDirectory(import.meta.url);
  app.use(express.static(dir));

  const server = app.listen(port);

  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
  });

  server.on(
    "upgrade",
    (request: IncomingMessage, socket: Socket, head: Buffer) => {
      const baseURL = `http://${request.headers.host}/`;
      const pathname = request.url
        ? new URL(request.url, baseURL).pathname
        : undefined;
      if (pathname === "/pyright") {
        wss.handleUpgrade(request, socket, head, (webSocket) => {
          const socket: IWebSocket = {
            send: (content) =>
              webSocket.send(content, (error) => {
                if (error) {
                  throw error;
                }
              }),
            onMessage: (cb) =>
              webSocket.on("message", (data) => {
                console.log(data.toString());
                cb(data);
              }),
            onError: (cb) => webSocket.on("error", cb),
            onClose: (cb) => webSocket.on("close", cb),
            dispose: () => webSocket.close(),
          };

          if (webSocket.readyState === webSocket.OPEN) {
            launchLanguageServer(socket);
          } else {
            webSocket.on("open", () => {
              launchLanguageServer(socket);
            });
          }
        });
      }
    }
  );

  return server;
};
