const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require("./routes/auth.js");
const { Server } = require("socket.io");
const http = require("http");
const Messages = require("./models/Messages.js");
const { Socket } = require("dgram");
const User = require("./models/User.js");
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.use(express.json());
app.use(cors());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Mongodb connected."))
  .catch(() => console.error(error));

app.use("/auth", authRoutes);

// socket io logic
io.on("connection", (socket) => {
  console.log("User Connected", socket.id);

  socket.on("join", (username) => {
    socket.username = username;
    socket.join(username);
  });

  socket.on("send_message", async (data) => {
    const { sender, receiver, message } = data;
    const newMessage = new Messages({
      sender,
      receiver,
      message,
      status: "sent",
    });
    await newMessage.save();

    io.to(receiver).emit("receive_message", newMessage);

    io.to(sender).emit("message_status", {
      messageId: newMessage._id,
      status: "sent",
    });
  });

  socket.on("mark_delivered", async ({ sender, receiver }) => {
    await Messages.updateMany(
      { sender, receiver, status: "sent" },
      { $set: { status: "delivered" } }
    );
    io.to(sender).emit("message_status_bulk", {
      sender: receiver,
      status: "delivered",
    });
  });

  socket.on("mark_seen", async ({ sender, receiver }) => {
    await Messages.updateMany(
      { sender, receiver, status: { $ne: "seen" } },
      { $set: { status: "seen" } }
    );
    io.to(sender).emit("message_status_bulk", {
      sender: receiver,
      status: "seen",
    });
  });


  socket.on("typing", ({sender, receiver, isTyping}) => {
    io.to(receiver).emit("typing_status", {sender, isTyping})
  })

  socket.on("disconnect", () => {
    console.log("User Disconnected", socket.id);
  });
});

app.get("/messages", async (req, res) => {
  const { sender, receiver } = req.query;
  try {
    const messages = await Messages.find({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender },
      ],
    }).sort({ createdAt: 1 });
    return res.status(200).json({ success: true, data: messages });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Error fetching messages" });
  }
});

app.get("/users", async (req, res) => {
  const { currentUser } = req.query;
  try {
    const users = await User.find({ username: { $ne: currentUser } });
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Error fetching Users" });
  }
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
