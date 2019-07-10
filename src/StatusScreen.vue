<template>
  <div>
    <table>
      <tr>
        <th>Callsign</th>
        <th>Last Heard</th>
        <th>Time since Last Heard</th>
        <th>Last Voltage</th>
        <th>Last Temperature</th>
      </tr>

      <StationRow
        v-for="(tactical, callsign) in config.trackedStations"
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

<script>
import aprs from "aprs-parser";

import StationRow from "./StationRow.vue";

import config from "./status_config.yaml";

export default {
  name: "StationStatus",
  components: { StationRow },
  data() {
    return {
      config: config,
      aprsStream: null,
      parser: new aprs.APRSParser(),
      messages: [],
      messagesFromStation: {},
      now: new Date()
    };
  },

  mounted() {
    // request notification permissions
    if (Notification.permission !== "granted") {
      Notification.requestPermission(permission => {
        if (permission === "granted") {
          new Notification("Test notification", { body: "whatever" });
        }
      });
    }

    // Connect to websocket aprs stream
    this.connectToStream();

    // update shared current time every second
    window.setInterval(() => (this.now = new Date()), 1000);
  },

  methods: {
    connectToStream() {
      this.aprsStream = new WebSocket("ws://localhost:4321");
      this.aprsStream.onclose = () => {
        // Try to reconnect every 5 seconds
        let interval = window.setTimeout(() => {
          window.clearInterval(interval);
          this.connectToStream();
        }, 5000);
      };
      this.aprsStream.onmessage = event =>
        this.handleMessage(JSON.parse(event.data));
    },

    handleMessage(packet) {
      let message = this.parser.parse(packet[1]);
      message.date = new Date(); // TODO: use data[0] instead

      console.log(message);
      this.messages.push(message);
      let callsign = message.from && message.from.toString();
      if (callsign in this.messagesFromStation) {
        this.messagesFromStation[callsign].push(message);
      } else {
        this.$set(this.messagesFromStation, callsign, [message]);
      }
    }
  }
};
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
</style>
