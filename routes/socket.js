const express = require("express");
const app = express();
const router = express.Router();
const http = require("../server.js");
const io = require("socket.io")(http);
const util = require("util");
const mongoose = require("mongoose");
const User = require("../models/user.js");
const Message = require("../models/message.js");
const redis = require("redis");
const redisOptions = { host: "localhost", port: 6379 };
const rclient = redis.createClient(redisOptions);
rclient.on("connect", () => {
  console.log("connected to redis");
});
module.exports = rclient;
let userCount = 0;
let socketHandler = function(socket) {
  socket.on("disconnect", function() {
    userCount--;
    console.log("user disconnected: ", userCount);
  });
  userCount++;
  console.log("Connected Online: " + userCount);

  socket.on("authentication", data => {
    if (!data.id) {
      //If failed to authenticate return here
      socket.emit("failed");
      return;
    }
    let fbId = data.id;
    let sSocketId = socket.id;
    console.log(`${fbId} dataId ${sSocketId} SocketId`);
    rclient.set(fbId, sSocketId);
    rclient.set(sSocketId, fbId);
    socket.emit("authenticated");
    socket.on("message", (data, fn) => {
      fn("sent");
      let message = new Message({
        from: data.from,
        to: data.to,
        message: data.message
      });
      message.save((err, message) => {
        if (err) return 500, { error: err };
        console.log("message saved");
      });
      io.emit("message", data);
      console.log("message" + data.message);
    });
    socket.on("private", data => {
      let message = new Message({
        from: data.from,
        to: data.to,
        message: data.message,
        private: true
      });
      console.log(data.to + " to id");
      message.save((err, message) => {
        if (err) return 500, { error: err };
        console.log("private message saved " + message.message);
      });
      rclient.get(data.to, (err, reply) => {
        socket.to(reply).emit("private", data);
        socket.to(data.from).emit("private", data);
      });
    });
  });
};
io.on("connection", socketHandler);
module.exports = router;
