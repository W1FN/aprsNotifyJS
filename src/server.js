const WebSocket = require("ws");
const net = require("net");
const fs = require("fs");

const client = new net.Socket();
const wss = new WebSocket.Server({ host: "127.0.0.1", port: 4321 });

wss.broadcast = function(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

client.connect(14580, "rotate.aprs2.net", () =>
  client.write("user KC1GDW pass -1 filter r/43.90/-72.15/75\r\n")
);

function datestamp(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

client.on("data", function(data) {
  let str = data.toString("utf8").replace(/^\s+|\s+$/g, "");
  console.log(str);

  // strip whitespace, then handle multiple APRS packets per TCP packet
  str.split("\r\n").forEach(packet => {
    if (!packet.startsWith("#")) {
      // ignore comments
      let date = new Date();
      fs.appendFile(
        `log${datestamp(date)}.json`,
        JSON.stringify([date, packet]) + "\n",
        err => {
          if (err) throw err;
        }
      );
      wss.broadcast(JSON.stringify([date, packet]));
    }
  });
});

wss.on("connection", ws => {
  let date = new Date();
  fs.readFileSync(`log${datestamp(date)}.json`)
    .toString()
    .split("\n")
    .forEach(line => ws.send(line));
});
