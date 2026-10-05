import { EventEmitter } from "node:events";
import { io } from "socket.io-client";

export class ApiError extends Error {
  constructor(status, body) {
    super(apiErrorMessage(status, body));
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function apiErrorMessage(status, body) {
  if (body && typeof body === "object" && "message" in body) {
    const message = body.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return `HTTP ${status}`;
}

export class Message {
  constructor(client, raw) {
    this.client = client;
    this.id = raw.id;
    this.channelId = raw.channelId;
    this.content = raw.content;
    this.attachments = Array.isArray(raw.attachments) ? raw.attachments : [];
    this.author = {
      id: raw.senderId,
      username: raw.sender?.name ?? "Unknown",
      bot: Boolean(raw.sender?.isBot),
    };
  }

  reply(content) {
    return this.client.post(`/channels/${this.channelId}/messages`, {
      content,
      replyToId: this.id,
    });
  }
}

/**
 * Minimal JeiChat bot client: REST with `Authorization: Bot <token>`
 * plus Socket.IO `auth.token` for `new_message`.
 */
export class JeiChat extends EventEmitter {
  constructor(options = {}) {
    super();
    this.user = null;
    this.token = "";
    this.socket = null;
    this.apiUrl = (
      options.apiUrl ??
      process.env.JEICHAT_API_URL ??
      "http://localhost:3001"
    ).replace(/\/$/, "");
  }

  async login(token) {
    this.token = token;
    this.user = await this.get("/bots/@me");
    await this.connectGateway();
    this.emit("ready");
    return this.user;
  }

  get(path) {
    return this.request("GET", path);
  }

  post(path, body) {
    return this.request("POST", path, body);
  }

  patch(path, body) {
    return this.request("PATCH", path, body);
  }

  async request(method, path, body) {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bot ${this.token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    const parsed = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new ApiError(response.status, parsed);
    }
    return parsed;
  }

  connectGateway() {
    return new Promise((resolve, reject) => {
      this.socket?.disconnect();
      const socket = io(this.apiUrl, {
        transports: ["websocket"],
        auth: { token: this.token },
      });
      this.socket = socket;
      socket.once("connect", () => resolve());
      socket.once("connect_error", (error) => reject(error));
      socket.on("new_message", (payload) => {
        this.emit("messageCreate", new Message(this, payload));
      });
    });
  }
}
