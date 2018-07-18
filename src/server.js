const WebSocket = require('ws');
const net = require('net');
const fs = require('fs');

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
      let date = new Date();
      let datestamp = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
      let data = [datestamp, packet];
      console.log(data);
      fs.appendFile("log" + datestamp + ".json", JSON.stringify(data) + ",\n",
                    err => {if (err) throw err;});
      wss.broadcast(JSON.stringify(data));
    }
  });
});

// wss.on('connection', ws => {
//   let datestamp = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
//   fs.readFileSync("log" + datestamp + ".json")
//     .toString().split('\n').forEach(line =>  ws.send(line));
// });
