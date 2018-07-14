// null here means just use the original callsign
const trackedStations = {
  // Digis/iGates
  "W1FN-1": null,
  "W1FN-3": null,
  "W1FN-5": null,
  "W1FN-6": null,
  "W1FN-7": null,
  "W1FN-8": null,
  "W1FN-9": null,
  "W1FN-10": null,
  "N1GMC-1": null,
  "N1GMC-2": null,

  // Vehicles
  "KC1GDW-6": "Metric Rover",
  "WB1BRE-10": "Recovery 1",
  "KC1GDW-10": "Recovery 2",
  "W1LKS-9": "Recovery 3",
  "WB1BRE-11": "Rover 1-2 (VT)",
  "KC1GDW-5": "Rover 2-1 (NH)",
  "WB1BRE-9": "Rover 2-3",
  "N0JSR-9": "Rover 2-8 (VT)",
  "N1EMF-7": "Rover 3-4",
  "K1DSP-9": "Rover 4-5",
  "WB1BRE-15": "Rover 5-6",
  "AB1XQ-9": "Rover 5-8",
  "KC1BOS-2": "Rover 6-7",
  "K1EHZ-3": "Rover 7-8",
  "KC1GDW-8": "Rover 8-2 (NH)",
  "WB1BRE-13": "Rover FPL",
  "W1HS-9": "Rover SF-1",
  "W1KUA-9": "Safety 1",
  "KC1GDW-12": "Shuttle 1",
  "KC1GDW-13": "Shuttle 2",
  "KC1GDW-14": "Supply 1",
  "KC1GDW-11": "Supply 2",
  "WB1BRE-14": "Supply 3",
  "WB1BRE-8": "Trouble 1 (North)",
  "AE1H-8": "Trouble 2 (South)",
};

const timeoutLength = 10 * 60 * 1000; // 10 Minutes
const lowVoltage = 11.9;


///////// End of Config /////////

let stations = {};
let messages = [];
let aprsStream;

if (Notification.permission !== "granted") {
  Notification.requestPermission(permission => {
    if (permission === "granted") {
      new Notification("Test notification", {body: "whatever"});
    }
  });
}

function getTactical(callsign) {
  if (trackedStations[callsign])
    return `${trackedStations[callsign]} [${callsign}]`;
  else
    return callsign;
}

function prettyDuration(duration) {
  let date = new Date(timeoutLength);
  return date.getUTCHours() > 0 ? date.getUTCHours() + " Hours": "" +
      date.getUTCMinutes() > 0 ? date.getUTCMinutes() + " Minutes": "" +
      date.getUTCSeconds() > 0 ? date.getUTCSeconds() + " Seconds": "" +
      date.getUTCMilliseconds() > 0 ? date.getUTCMilliseconds() + " Milliseconds" : "";
}

function redrawTable() {
  let table = document.querySelector('table.stations');
  table.innerHTML =
    `<tr><th>Callsign</th>` +
    `<th>Last Heard</th>` +
    `<th>Time since Last Heard</th>` +
    `<th>Last Voltage</th>` +
    `<th>Last Temperature</th>`;
  for (let callsign in trackedStations) {
    let tr = table.appendChild(document.createElement('tr'));
    tr.innerHTML = `<td>${getTactical(callsign)}</td>`;
    if (!(callsign in stations)) {
      tr.classList.add('neverHeard');
      tr.innerHTML +=
        '<td>Never Heard</td>' +
        '<td>Never Heard</td>' +
        '<td>Never Heard</td>' +
        '<td>Never Heard</td>';
    }

    else {
      let station = stations[callsign];
      let nowDelta = new Date(new Date() - station.lastHeard);

      // TODO: should be set by same thing that sends alert
      if (nowDelta.getTime() > timeoutLength) {
        tr.classList.add('timedOut');
      }
      if (station.lastVoltage < lowVoltage) {
        tr.classList.add('lowVoltage');
      }
      tr.innerHTML +=
        `<td>${station.lastHeard.toLocaleTimeString('en-GB')}</td>` +
        `<td>${nowDelta.toLocaleTimeString('en-GB', {timeZone: "UTC"})}</td>` +
        `<td>${station.lastVoltage||''}</td>` +
        `<td>${station.lastTemperature||''}</td>`;
    }
  }
}

function notify(title, body) {
  return new Notification(title, {body: body, requireInteraction: true});
}

function alertNotHeard(callsign) {
  notify(`${getTactical(callsign)} has not been heard for ${prettyDuration(timeoutLength)}!`,
         `Last Heard: ${stations[callsign].lastHeard.toLocaleTimeString('en-GB')}`);
}

function alertVoltage(callsign) {
  notify(`${getTactical(callsign)}'s battery has dropepd below ${lowVoltage}V`,
         `Voltage: ${stations[callsign].lastVoltage}`);
}

function handleMessage(message) {
  let callsign = `${message.from.call}-${message.from.ssid || 0}`;
  let date = new Date(); // TODO: could remove "message.recieved" from server

  console.log(message);
  messages.push(message);

  // TODO: hacky filter
  if (callsign in trackedStations) {

    if (!(callsign in stations)) {
      stations[callsign] = {};
    }
    else {
      window.clearTimeout(stations[callsign].timeout);
    }

    stations[callsign].lastHeard = date;
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
  }
}

function connectToStream() {
  aprsStream = new WebSocket("wss://adamgoldsmith.name/APRSws");
  aprsStream.onclose = () => {
    // Try to reconnect every 5 seconds
    let interval = window.setInterval(() => {
      window.clearInterval(interval);
      connectToStream();
    }, 5000);
  };
  aprsStream.onmessage = event => handleMessage(JSON.parse(event.data));
}

connectToStream();

window.addEventListener("load", redrawTable);
window.setInterval(redrawTable, 1000);
