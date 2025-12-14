const express = require("express");

const bodyParser = require("body-parser");



const app = express();
const PORT = 3000;

// In-memory storage
let parts = []; // from Roblox Lua
let kickQueue = []; // queue of player IDs to kick

app.use(bodyParser.json());
app.use(express.static("public")); // serve your HTML/JS

// --- Endpoint to receive parts from Lua ---
app.post("/parts", (req, res) => {
  parts = req.body;
  res.sendStatus(200);
});

// --- Endpoint for JS to request a kick ---
app.post("/kick/:id", (req, res) => {
  const playerId = req.params.id;
  if (!kickQueue.includes(playerId)) kickQueue.push(playerId);
  console.log("Kick requested for:", playerId);
  res.send({ success: true });
});

// --- Endpoint for Lua to fetch kick queue ---
app.get("/kickqueue", (req, res) => {
  res.json(kickQueue);
  kickQueue = []; // clear queue after sending
});

// --- Endpoint to serve current parts for JS ---
app.get("/parts", (req, res) => {
  res.json(parts);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
