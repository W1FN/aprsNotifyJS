const WebSocket = require('ws');
const net = require('net');
const fs = require('fs');

const client = new net.Socket();
const wss = new WebSocket.Server({ host: '127.0.0.1', port: 4321 });

wss.broadcast = function (data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

client.connect(14580, 'rotate.aprs2.net', () =>
  client.write('user KC1GDW pass -1 filter r/43.90/-72.15/75\r\n')
);

function datestamp(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

client.on('data', function (data) {
  let str = data.toString('utf8').replace(/^\s+|\s+$/g, '');
  console.log(str);

  // strip whitespace, then handle multiple APRS packets per TCP packet
  str.split('\r\n').forEach((packet) => {
    // ignore comments and empty lines
    if (!packet.startsWith('#') || packet === '') {
      let date = new Date();
      // create log dir if it doesn't exist
      if (!fs.existsSync('log')) fs.mkdirSync('log');
      fs.appendFile(
        `log/log${datestamp(date)}.json`,
        JSON.stringify([date, packet]) + '\n',
        (err) => {
          if (err) throw err;
        }
      );
      wss.broadcast(JSON.stringify([date, packet]));
    }
  });
});

wss.on('connection', (ws) => {
  let date = new Date();
  let filename = `log/log${datestamp(date)}.json`;

  if (fs.existsSync(filename)) {
    fs.readFileSync(filename)
      .toString()
      .split('\n')
      .filter((line) => line !== '')
      .forEach((line) => ws.send(line));
  }
});
