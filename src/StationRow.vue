<template>
  <tr :class="{ timedOut, lowVoltage, neverHeard: !status.lastHeard }">
    <td :title="callsign">{{ tacticalAndOrCall }}</td>
    <template v-if="status.lastHeard">
      <td>{{ formatTime(status.lastHeard) }}</td>
      <td>{{ formatTime(now - status.lastHeard, true) }}</td>
      <td>{{ status.lastVoltage || "" }}</td>
      <td>{{ status.lastTemperature || "" }}</td>
    </template>
    <template v-else>
      <td>Never Heard</td>
      <td>Never Heard</td>
      <td>Never Heard</td>
      <td>Never Heard</td>
    </template>
  </tr>
</template>

<script>
import config from "./status_config.yaml";

export default {
  name: "StationRow",
  props: { callsign: String, tactical: String, messages: Array, now: Date },

  data() {
    return {
      status: {
        lastHeard: null,
        delta: null,
        lastVoltage: null,
        lastTemperature: null
      }
    };
  },

  methods: {
    notify(title, body) {
      return new Notification(title, { body: body, requireInteraction: true });
    },

    formatTime(time, isDuration = false) {
      return new Date(time).toLocaleTimeString(
        "en-GB",
        isDuration ? { timeZone: "UTC" } : {}
      );
    },

    prettyDuration(duration) {
      let date = new Date(duration);
      return [
        ...Object.entries({
          hours: date.getUTCHours(),
          minutes: date.getUTCMinutes(),
          seconds: date.getUTCSeconds(),
          milliseconds: date.getUTCMilliseconds()
        })
      ]
        .filter(([suffix, num]) => num > 0)
        .map(([suffix, num]) => num + " " + suffix)
        .join(" ");
    }
  },

  watch: {
    messages() {
      Object.assign(
        this.status,
        this.messages.reduce((acc, message) => {
          acc.lastHeard = message.date.getTime();
          acc.delta = message.date - acc.lastHeard;
          if ("data" in message && "analog" in message.data) {
            acc.lastVoltage = message.data.analog[0] / 10;
            acc.lastTemperature = message.data.analog[1];
          }
          return acc;
        }, {})
      );
    },

    lowVoltage(newVal) {
      if (newVal) {
        this.notify(
          `${this.tacticalAndOrCall}'s battery has dropepd below ${config.lowVoltage}V`,
          `Voltage: ${this.status.lastVoltage}`
        );
      }
    },

    timedOut(newVal) {
      if (newVal) {
        this.notify(
          `${
            this.tacticalAndOrCall
          } has not been heard for over ${this.prettyDuration(
            config.timeoutLength
          )}!`,
          `Last Heard: ${this.formatTime(
            this.status.lastHeard
          )} (${this.prettyDuration(this.now - this.status.lastHeard)} ago!)`
        );
      }
    }
  },

  computed: {
    tacticalAndOrCall() {
      return this.tactical
        ? `${this.tactical} [${this.callsign}]`
        : this.callsign;
    },

    timedOut() {
      if (!this.status.lastHeard) {
        return false;
      }

      let nowDelta = new Date(this.now - this.status.lastHeard);
      return nowDelta.getTime() > config.timeoutLength;
    },

    lowVoltage() {
      return (
        this.status.lastVoltage && this.status.lastVoltage < config.lowVoltage
      );
    }
  }
};
</script>

<style>
tr.timedOut {
  background-color: red;
}

tr.lowVoltage {
  background-color: yellow;
}

tr.neverHeard {
  background-color: purple;
  color: #eee;
}
</style>
