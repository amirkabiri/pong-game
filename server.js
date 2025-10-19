const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }, // allow all origins for testing
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

const waitingQueue = []; // users waiting for a match
const matches = {}; // { socket.id: partnerId }

io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);

    // Add to queue
    if (waitingQueue.length > 0) {
        // Match with the first waiting player
        const opponentId = waitingQueue.shift();
        matches[socket.id] = opponentId;
        matches[opponentId] = socket.id;

        console.log(`🎮 Match made: ${socket.id} ↔ ${opponentId}`);

        // Notify both players
        io.to(socket.id).emit("start", { opponentId, main: true });
        io.to(opponentId).emit("start", { opponentId: socket.id });
    } else {
        // No one waiting → put this user in queue
        waitingQueue.push(socket.id);
        console.log(`🕓 ${socket.id} waiting for opponent...`);
    }

    socket.on('send', ({ id, data }) => {
        io.to(id).emit(...data);
    })

    // Handle disconnection
    socket.on("disconnect", () => {
        console.log("❌ User disconnected:", socket.id);

        // Remove from waiting queue if they were waiting
        const index = waitingQueue.indexOf(socket.id);
        if (index !== -1) waitingQueue.splice(index, 1);

        // Notify opponent if they had one
        const opponentId = matches[socket.id];
        if (opponentId) {
            io.to(opponentId).emit("opponent_disconnected");
            delete matches[opponentId];
        }
        delete matches[socket.id];
    });
});

server.listen(3000, () => {
    console.log("🚀 Server running on http://localhost:3000");
});
