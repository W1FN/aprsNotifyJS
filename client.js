let calls = {};

let messages = [];

const checkTime = 1000; // 1 second
const timeOut = 20 * 60 * 1000; // 20 Minutes
//const timeOut = 60 * 1000; // 1 Minute

Notification.requestPermission(permission => {
  if (permission === "granted") {
    new Notification("Test notification", {body: "whatever"});
  }
});

function checkNotHeard() {
  let now = new Date();
  for (let call in calls) {
    let lastHeard = new Date(calls[call]);
    console.log(call, now - lastHeard);

    if (now - lastHeard > timeOut) {
      new Notification(`${call} has not been heard for 20 Minutes!`,
                       {body: `Last Heard: ${lastHeard}`});
    }
  };
}

let aprsStream = new WebSocket("ws://localhost:1234");
aprsStream.onmessage = function(event) {
  let message = JSON.parse(event.data);
  let call = `${message.from.call}-${message.from.ssid || 0}`;
  let date = message.recieved;

  console.log(message);

  if (call in calls) {
    message.delta = date - calls[call];
  }
  calls[call] = date;
  messages.push(message);
};

window.setInterval(checkNotHeard, checkTime);
