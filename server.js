import http from "http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { app } from "./index.js";

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usernameToSocketId = new Map();
const socketIdToUsername = new Map();

const emitUserList = () => {
    const users = Array.from(usernameToSocketId.keys()).sort((a, b) => a.localeCompare(b));
    io.emit("user:list", users);
};

const emitSystemMessage = (text) => {
    io.emit("chat:receive", {
        type: "system",
        text,
        at: Date.now(),
    });
};

io.on("connection", (socket) => {
    console.log("user connected at: ", socket.id);

    socket.emit("self id", socket.id);

    socket.on("join", ({ username }) => {
        const cleanUsername = String(username || "").trim();

        if (!cleanUsername) {
            socket.emit("join:error", "Username is required");
            return;
        }

        if (usernameToSocketId.has(cleanUsername)) {
            socket.emit("join:error", "Username already exists");
            return;
        }

        usernameToSocketId.set(cleanUsername, socket.id);
        socketIdToUsername.set(socket.id, cleanUsername);

        socket.emit("join:ok", { username: cleanUsername });
        emitSystemMessage(`${cleanUsername} joined the chat`);
        emitUserList();
    });

    socket.on("chat:group", ({ text }) => {
        const username = socketIdToUsername.get(socket.id);
        const cleanText = String(text || "").trim();
        if (!username || !cleanText) return;

        io.emit("chat:receive", {
            type: "group",
            from: username,
            text: cleanText,
            at: Date.now(),
        });
    });

    // socket.on("send others", ...) // bỏ: không cần cho use case group + 1:1

    socket.on("chat:private", ({ to, text }) => {
        const from = socketIdToUsername.get(socket.id);
        const toUsername = String(to || "").trim();
        const cleanText = String(text || "").trim();

        if (!from || !toUsername || !cleanText) return;

        const targetSocketId = usernameToSocketId.get(toUsername);
        if (!targetSocketId) {
            socket.emit("chat:receive", {
                type: "system",
                text: `User ${toUsername} is offline`,
                at: Date.now(),
            });
            return;
        }

        const payload = {
            type: "private",
            from,
            to: toUsername,
            text: cleanText,
            at: Date.now(),
        };

        io.to(targetSocketId).emit("chat:receive", payload);

        if (targetSocketId !== socket.id) {
            socket.emit("chat:receive", payload);
        }
    });

    // disconnected
    socket.on("disconnect", () => {
        const username = socketIdToUsername.get(socket.id);
        if (username) {
            usernameToSocketId.delete(username);
            socketIdToUsername.delete(socket.id);
            emitSystemMessage(`${username} left the chat`);
            emitUserList();
        }

        console.log("user disconnected at: ", socket.id);
    });
});

server.listen(3000, () => {
    console.log("Server is running on port 3000");
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});