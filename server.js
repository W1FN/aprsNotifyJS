const WebSocket = require('ws');
const net = require('net');
const aprs = require("aprs-parser");
const fs = require('fs');

const parser = new aprs.APRSParser();
const client = new net.Socket();
const wss = new WebSocket.Server({host: "127.0.0.1", port: 1234});

wss.broadcast = function(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

client.connect(
  14580, "rotate.aprs2.net",
  () => client.write("user KC1GDW pass -1 filter r/43.90/-72.15/75\r\n"));

client.on('data', function(data) {
  let str = data.toString('utf8').replace(/^\s+|\s+$/g, "");
  console.log(str);

  // strip whitespace, then handle multiple APRS packets per TCP packet
  str.split("\r\n").forEach(packet => {
    if (!packet.startsWith('#')) { // ignore comments
      let message = parser.parse(packet);
      let date = new Date();
      let datestamp = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
      message.recieved = date;
      console.log(message);
      fs.appendFile("log" + datestamp + ".json", JSON.stringify(message) + ",\n",
                    err => {if (err) throw err;});
      wss.broadcast(JSON.stringify(message));
    }
  });
});
