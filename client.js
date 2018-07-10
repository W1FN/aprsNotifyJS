let calls = {};

let messages = [];

const timeoutLength = 20 * 60 * 1000; // 20 Minutes

Notification.requestPermission(permission => {
  if (permission === "granted") {
    new Notification("Test notification", {body: "whatever"});
  }
});


function alertNotHeard(callsign) {
  new Notification(`${callsign} has not been heard for 20 Minutes!`,
                   {body: `Last Heard: ${calls[callsign].lastHeard.toLocaleTimeString('en-GB')}`});
}

let aprsStream = new WebSocket("ws://localhost:1234");
aprsStream.onmessage = function(event) {
  let message = JSON.parse(event.data);
  let callsign = `${message.from.call}-${message.from.ssid || 0}`;
  let date = new Date(message.recieved);

  console.log(message);
  messages.push(message);

  if (!(callsign in calls)) {
    calls[callsign] = {
      lastHeard: date,
    };
  }

  else {
    window.clearTimeout(calls[callsign].timeout);
  }

  calls[callsign].delta = date - calls[callsign].lastHeard;
  calls[callsign].timeout = window.setTimeout(
    alertNotHeard, timeoutLength, callsign);
};

