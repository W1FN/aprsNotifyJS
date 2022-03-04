<template>
  <div>
    <table>
      <tr>
        <th>Callsign</th>
        <th>Last Heard</th>
        <th>Time since Last Heard</th>
        <th>Avg. Period</th>
        <th>Last MicE</th>
        <th>Last Voltage</th>
        <th>Last Temperature</th>
        <th>Last Comment</th>
      </tr>

      <StationRow
        v-for="(tactical, callsign) in trackedStations"
        :key="callsign"
        :callsign="callsign"
        :tactical="tactical"
        :messages="messagesFromStation[callsign] || []"
        :now="now"
      >
      </StationRow>
    </table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import APRSParser from 'aprs-parser/lib/APRSParser';

import StationRow from './StationRow.vue';
import config from './status_config.yaml';

const parser = new APRSParser();
let aprsStream = null;
const messages = ref([]);
const messagesFromStation = ref({});
const now = ref(new Date());
const trackedStations = ref(config.trackedStations);

onMounted(() => {
  // request notification permissions
  if (Notification.permission !== 'granted') {
    Notification.requestPermission((permission) => {
      if (permission === 'granted') {
        new Notification('Test notification', { body: 'whatever' });
      }
    });
  }

  // Connect to websocket aprs stream
  connectToStream();

  // update shared current time every second
  window.setInterval(() => (now.value = new Date()), 1000);
});

function connectToStream() {
  aprsStream = new WebSocket('ws://localhost:4321');
  aprsStream.onclose = () => {
    // Try to reconnect every 5 seconds
    let interval = window.setTimeout(() => {
      window.clearInterval(interval);
      connectToStream();
    }, 5000);
  };
  aprsStream.onmessage = (event) => {
    if (event.data !== '') {
      handleMessage(JSON.parse(event.data));
    }
  };
}

function handleMessage(packet) {
  let message = parser.parse(packet[1]);
  message.date = new Date(packet[0]);

  console.info(message);
  messages.value.push(message);
  let callsign = message.from && message.from.toString();
  if (callsign in messagesFromStation.value) {
    messagesFromStation.value[callsign].push(message);
  } else {
    messagesFromStation.value[callsign] = [message];
  }

  // message to TACTICAL setting a tactical nickname from an
  // authorized call, so add/update it in trackedStations
  if (
    message.data &&
    message.data.addressee &&
    message.data.addressee.call === 'TACTICAL' &&
    config.TACTICAL_whitelist.includes(message.from.toString())
  ) {
    message.data.text.split(';').map((tac_assoc) => {
      let [call, tac] = tac_assoc.split('=', 2);
      if (tac) {
        trackedStations.value[call] = tac;
      } else {
        delete trackedStations.value[call];
      }
    });
  }
}
</script>

<style>
table {
  border-collapse: collapse;
}

table td,
table th {
  border: 1px solid black;
  padding: 2px;
}

table th {
  background: white;
  position: sticky;
  top: 0px;
}

/* border magic for sticky header */
/* https://stackoverflow.com/questions/50361698/border-style-do-not-work-with-sticky-position-element */
th::before {
  content: '';
  position: absolute;
  left: 0;
  width: 100%;
  height: 100%;
  border-right: 1px solid black;
  display: block;
  top: 1px;
}
th::after {
  content: '';
  position: absolute;
  left: 0;
  width: 100%;
  height: 100%;
  border-bottom: 1px solid black;
  border-top: 1px solid black;
  display: block;
  top: -1px;
}
</style>
