<template>
  <tr :class="{ timedOut, isLowVoltage, neverHeard: !stationStatus.lastHeard }">
    <td :title="callsign">{{ tacticalAndOrCall }}</td>
    <template v-if="stationStatus.lastHeard">
      <td>{{ formatTime(stationStatus.lastHeard) }}</td>
      <td>{{ formatTime(now - stationStatus.lastHeard, true) }}</td>
      <td>{{ formatTime(Math.round(stationStatus.avgDelta), true) }}</td>
      <td>{{ stationStatus.lastMicE }}</td>
      <td>{{ stationStatus.lastVoltage || '' }}</td>
      <td>{{ stationStatus.lastTemperature || '' }}</td>
      <td>{{ stationStatus.lastComment }}</td>
    </template>
    <template v-else>
      <td>Never Heard</td>
      <td>Never Heard</td>
      <td>Never Heard</td>
      <td>Never Heard</td>
      <td>Never Heard</td>
      <td>Never Heard</td>
      <td>Never Heard</td>
    </template>
  </tr>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import parseDuration from 'parse-duration';

const props = defineProps({
  callsign: String,
  tactical: String,
  timeoutLength: String,
  lowVoltage: Number,
  finishedReplay: Boolean,
  messages: Array,
  now: Date,
});

function formatTime(time, isDuration = false) {
  return new Date(time).toLocaleTimeString(
    'en-GB',
    isDuration ? { timeZone: 'UTC' } : {}
  );
}

const timeoutLengthMs = computed(() => {
  return parseDuration(props.timeoutLength);
});

function prettyDuration(duration) {
  let date = new Date(duration);
  return [
    ...Object.entries({
      hours: date.getUTCHours(),
      minutes: date.getUTCMinutes(),
      seconds: date.getUTCSeconds(),
      milliseconds: date.getUTCMilliseconds(),
    }),
  ]
    .filter(([suffix, num]) => num > 0)
    .map(([suffix, num]) => num + ' ' + suffix)
    .join(' ');
}

const tacticalAndOrCall = computed(() => {
  return props.tactical
    ? `${props.tactical} [${props.callsign}]`
    : props.callsign;
});

const timedOut = computed(() => {
  if (stationStatus.value.lastHeard === null) {
    return false;
  } else {
    return (
      props.now.getTime() - stationStatus.value.lastHeard >
      timeoutLengthMs.value
    );
  }
});

const isLowVoltage = computed(() => {
  return (
    stationStatus.value.lastVoltage &&
    stationStatus.value.lastVoltage < props.lowVoltage
  );
});

const stationStatus = computed(() => {
  const status = {
    lastHeard: null,
    delta: null,
    lastVoltage: null,
    lastTemperature: null,
  };

  Object.assign(
    status,
    props.messages.reduce((acc, message, idx, arr) => {
      acc.lastHeard = message.date.getTime();
      if (idx === 0) {
        acc.avgDelta = 0;
      } else {
        let delta = message.date.getTime() - arr[idx - 1].date.getTime();
        acc.avgDelta = (acc.avgDelta * (idx - 1) + delta) / idx;
      }
      if ('data' in message) {
        if ('analog' in message.data) {
          acc.lastVoltage = message.data.analog[0] / 10;
          acc.lastTemperature = message.data.analog[1];
        }
        acc.lastMicE = message.data.mice || acc.lastMicE;
        acc.lastComment = message.data.comment || acc.lastComment;
      }
      return acc;
    }, {})
  );
  return status;
});
</script>

<style>
tr.timedOut {
  background-color: red;
}

tr.isLowVoltage {
  background-color: yellow;
}

tr.neverHeard {
  background-color: purple;
  color: #eee;
}
</style>
