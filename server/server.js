// server.js
import express from "express";
import cors from "cors";
import crypto from "crypto";

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

const users = [
  {
    id: 1,
    name: "Admin User",
    email: "admin@viek.test",
    password: hashPassword("password123")
  }
];

let clients = [
  { id: 1, name: "Acme Limited", email: "contact@acme.test" },
  { id: 2, name: "Bright Solutions", email: "hello@bright.test" }
];

const projects = [
  { id: 1, name: "Website Development", clientId: 1 },
  { id: 2, name: "Mobile Application", clientId: 2 },
  { id: 3, name: "UI/UX Design", clientId: 1 }
];

// simple in-memory token store: token -> userId
const sessions = new Map();

app.post("/api/login", (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = users.find(
      (item) => item.email === email && item.password === hashPassword(password)
    );

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, user.id);

    const { password: _pw, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    next(err);
  }
});

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.userId = sessions.get(token);
  next();
}

app.get("/api/clients", authenticate, (req, res) => {
  res.json({ data: clients });
});

app.post("/api/clients", authenticate, (req, res) => {
  const { name, email } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ message: "Name and email are required" });
  }
  const newClient = {
    id: clients.length ? Math.max(...clients.map((c) => c.id)) + 1 : 1,
    name,
    email
  };
  clients.push(newClient);
  res.status(201).json({ data: newClient });
});

app.delete("/api/clients/:id", authenticate, (req, res) => {
  const id = Number(req.params.id);
  const originalLength = clients.length;
  clients = clients.filter((client) => client.id !== id);

  if (clients.length === originalLength) {
    return res.status(404).json({ message: "Client not found" });
  }
  res.json({ message: "Client deleted successfully" });
});

app.get("/api/projects", authenticate, (req, res) => {
  const { clientId } = req.query;
  let result = projects;
  if (clientId) {
    result = projects.filter((project) => project.clientId === Number(clientId));
  }
  res.json({ projects: result });
});

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});