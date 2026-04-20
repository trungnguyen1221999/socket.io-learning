import express from "express";
import http from "http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

io.on("connection", (socket) => {
    console.log("user connected at: ", socket.id);

    socket.emit("self id", socket.id);

    socket.on("send all", (msg) => {
        io.emit("chat message", `[ALL][${socket.id}] ${msg}`);
    });

    socket.on("send others", (msg) => {
        socket.broadcast.emit("chat message", `[OTHERS][${socket.id}] ${msg}`);
    });

    socket.on("send to id", ({ targetId, message }) => {
        if (!targetId || !message) return;
        io.to(targetId).emit("chat message", `[PRIVATE][${socket.id}] ${message}`);
    });

    //disconnected
    socket.on("disconnect", () => {
        console.log("user disconnected at: ", socket.id);
    });
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});

app.get("/", (req, res) => {
        res.sendFile(path.join(__dirname, "index.html"));
});