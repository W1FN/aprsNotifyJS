let stations = {};

let messages = [];

const timeoutLength = 20 * 60 * 1000; // 20 Minutes
const lowVoltage = 11.9;

Notification.requestPermission(permission => {
  if (permission === "granted") {
    new Notification("Test notification", {body: "whatever"});
  }
});

function redrawTable() {
  let table = document.querySelector('table.stations');
  table.innerHTML =
    `<tr><th>Callsign</th>` +
    `<th>Last Heard</th>` +
    `<th>Time since Last Heard</th>` +
    `<th>Last Voltage</th>` +
    `<th>Last Temperature</th>`;
  for (let callsign in stations) {
    let station = stations[callsign];
    let nowDelta = new Date(new Date() - station.lastHeard);

    let tr = table.appendChild(document.createElement('tr'));
    if (nowDelta.getTime() > timeoutLength) {
      tr.classList.add('timedOut');
    }
    if (station.lastVoltage < lowVoltage) {
      tr.classList.add('lowVoltage');
    }
    tr.innerHTML =
      `<td>${callsign}</td>` +
      `<td>${station.lastHeard.toLocaleTimeString('en-GB')}</td>` +
      `<td>${nowDelta.toLocaleTimeString('en-GB', {timeZone: "UTC"})}</td>` +
      `<td>${station.lastVoltage||''}</td>` +
      `<td>${station.lastTemperature||''}</td>`;

  }
}

function alertNotHeard(callsign) {
  new Notification(`${callsign} has not been heard for 20 Minutes!`,
                   {body: `Last Heard: ${stations[callsign].lastHeard.toLocaleTimeString('en-GB')}`});
}

function alertVoltage(callsign) {
  new Notification(`${callsign}'s battery has dropepd below ${lowVoltage}V`,
                   {body: `Voltage: ${stations[callsign].lastVoltage}`});
}

let aprsStream = new WebSocket("ws://localhost:1234");
aprsStream.onmessage = function(event) {
  let message = JSON.parse(event.data);
  let callsign = `${message.from.call}-${message.from.ssid || 0}`;
  let date = new Date(message.recieved);

  console.log(message);
  messages.push(message);

  if (!(callsign in stations)) {
    stations[callsign] = {
      lastHeard: date,
    };
  }

  else {
    window.clearTimeout(stations[callsign].timeout);
  }

  stations[callsign].delta = date - stations[callsign].lastHeard;
  stations[callsign].timeout = window.setTimeout(
    alertNotHeard, timeoutLength, callsign);

  if ('data' in message && 'analog' in message.data) {
    stations[callsign].lastVoltage = message.data.analog[0] / 10;
    stations[callsign].lastTemperature = message.data.analog[1];

    if (stations[callsign].lastVoltage <= lowVoltage) {
      alertVoltage(callsign);
    }
  }

  redrawTable();
};

window.addEventListener("load", redrawTable);
window.setInterval(redrawTable, 1000);
