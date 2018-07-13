let stations = {};

let messages = [];

const timeoutLength = 20 * 60 * 1000; // 20 Minutes
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
  "KC1GDW-6": "Rover 1",
  "K1EHZ-9": "Rover 2",
  "N0JSR-9": "Rover 3",
  "W1KUA-9": "Manager",
  "KC1GDW-13": "Coordinator",
  "WB1BRE-12": "EMS",
  "KC1GDW-11": "Bike Tech",
  "KC1GDW-14": "Something (panel van thing)"
};

const lowVoltage = 11.9;

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
  for (let callsign in stations) {
    let station = stations[callsign];
    let nowDelta = new Date(new Date() - station.lastHeard);

    let tr = table.appendChild(document.createElement('tr'));
    // TODO: should be set by same thing that sends alert
    if (nowDelta.getTime() > timeoutLength) {
      tr.classList.add('timedOut');
    }
    if (station.lastVoltage < lowVoltage) {
      tr.classList.add('lowVoltage');
    }
    tr.innerHTML =
      `<td>${getTactical(callsign)}</td>` +
      `<td>${station.lastHeard.toLocaleTimeString('en-GB')}</td>` +
      `<td>${nowDelta.toLocaleTimeString('en-GB', {timeZone: "UTC"})}</td>` +
      `<td>${station.lastVoltage||''}</td>` +
      `<td>${station.lastTemperature||''}</td>`;

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

let aprsStream = new WebSocket("wss://adamgoldsmith.name/APRSws");
aprsStream.onmessage = function(event) {
  let message = JSON.parse(event.data);
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
};

window.addEventListener("load", redrawTable);
window.setInterval(redrawTable, 1000);
