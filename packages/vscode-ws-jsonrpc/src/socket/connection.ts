import {
  MessageConnection,
  createMessageConnection,
  Logger,
} from "vscode-jsonrpc";
import { IWebSocket } from "./socket.js";
import { WebSocketMessageReader } from "./reader.js";
import { WebSocketMessageWriter } from "./writer.js";

export function createWebSocketConnection(
  socket: IWebSocket,
  logger: Logger
): MessageConnection {
  const messageReader = new WebSocketMessageReader(socket);
  const messageWriter = new WebSocketMessageWriter(socket);
  const connection = createMessageConnection(
    messageReader,
    messageWriter,
    logger
  );
  connection.onClose(() => connection.dispose());
  return connection;
}
