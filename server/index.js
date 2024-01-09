import express from "express";
import logger from "morgan";
import dotenv from "dotenv"; // importamos el dotenv
import { createClient } from "@libsql/client";

// Importamos la funcionalidad de un server con websockets
// Funcionalidades de socket.io
import { Server } from "socket.io";
// Módulo para crear servidores http de Node
import { createServer } from "node:http";

dotenv.config(); // Lo instanciamos

const port = process.envPORT ?? 3000;

const app = express();
// Creamos un servidor http de la app de node
const server = createServer(app);
// Creamos el servidor de webSockets pasando el servidor
const io = new Server(server, { connectionStateRecovery: {} });

// Creamos la conexión a la DB
const db = createClient({
  url: "libsql://chat-elliotghr.turso.io",
  authToken: process.env.DB_TOKEN,
});

// Ejecutamos una query a la DB
await db.execute(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    user TEXT
  )
`);

// Si tenemos una conexión...
// Socket = Una conexión en concreto
io.on("connection", async (socket) => {
  console.log("an user has connected!");
  // Test de conexión
  io.emit("conex", "an user has connected");

  // Imprimiendo el mensaje
  //   socket.on("chat message", (msg) => {
  // console.log(`Message: ${msg}`);
  //   });

  // Emitimos un mensaje a todos los que estén en la conexión (Broadcast)
  socket.on("chat message", async (msg) => {
    let result;
    const username = socket.handshake.auth.username ?? "anonymus";
    try {
      // Ejecutamos la incersión a la tabla de messages
      result = await db.execute({
        sql: `INSERT INTO messages (content,user) values (:msg, :username)`,
        args: { msg, username },
      });
    } catch (error) {
      console.error(e);
      return;
    }
    // Obtenemos el id del último insert y lo devolvemos
    io.emit("chat message", msg, result.lastInsertRowid.toString(), username);
  });

  // recuperarse los mensajes sin conexión
  if (!socket.recovered) {
    try {
      console.log(socket.handshake.auth.serverOffset);
      const results = await db.execute({
        sql: "SELECT id, content, user FROM messages WHERE id > ?",
        args: [socket.handshake.auth.serverOffset ?? 0],
      });
      console.log(results.rows);

      results.rows.forEach((row) => {
        socket.emit("chat message", row.content, row.id.toString(), row.user);
      });
    } catch (error) {}
  }

  socket.on("disconnect", () => {
    console.log("an user has disconnected!");
  });
});

// Usamos morgan para el log
app.use(logger("dev"));

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/client/index.html");
});

// Escucharemos el servidor, no la aplicación
server.listen(3000, () => {
  console.log(`Server running on port ${port}`);
});
