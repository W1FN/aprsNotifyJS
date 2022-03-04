<template>
  <ol-map
    :loadTilesWhileAnimating="true"
    :loadTilesWhileInteracting="true"
    class="map"
  >
    <ol-view :zoom="10" :center="[-72.15, 43.9]" projection="EPSG:4326" />

    <ol-tile-layer>
      <ol-source-osm />
    </ol-tile-layer>

    <ol-vector-layer v-for="gpxURL in routes" :key="gpxURL">
      <ol-source-vector :url="gpxURL" :format="new GPX()"> </ol-source-vector>
      <ol-style>
        <ol-style-stroke color="hsl(200, 90%, 30%)" :width="5">
        </ol-style-stroke>
      </ol-style>
    </ol-vector-layer>

    <!-- Station Paths -->
    <div>
      <div v-for="(packets, callsign, idx) in stationPaths" :key="callsign">
        <!--Paths -->
        <ol-vector-layer render-mode="image">
          <ol-source-vector>
            <ol-feature>
              <ol-geom-line-string
                :coordinates="packetsToStationPathPoints(packets)"
              >
              </ol-geom-line-string>
            </ol-feature>
          </ol-source-vector>
          <ol-style>
            <ol-style-stroke :color="stationColors[idx].hex()" :width="2">
            </ol-style-stroke>
          </ol-style>
        </ol-vector-layer>

        <!-- Points -->
        <ol-vector-layer render-mode="image">
          <ol-source-vector>
            <ol-feature>
              <ol-geom-multi-point
                :coordinates="packetsToStationPathPoints(packets)"
              >
              </ol-geom-multi-point>
            </ol-feature>
          </ol-source-vector>
          <ol-style>
            <ol-style-circle :radius="3">
              <ol-style-fill :color="stationColors[idx].hex()"> </ol-style-fill>
            </ol-style-circle>
          </ol-style>
        </ol-vector-layer>
      </div>
    </div>

    <!-- Digipeater locations -->
    <ol-vector-layer>
      <ol-source-vector>
        <ol-feature v-for="(position, callsign) in digiPos" :key="callsign">
          <ol-geom-point :coordinates="position"> </ol-geom-point>
          <ol-style>
            <ol-style-circle>
              <ol-style-fill :color="digiColors[callsign].hex()">
              </ol-style-fill>
            </ol-style-circle>
            <ol-style-text :text="callsign" :offsetY="12"> </ol-style-text>
          </ol-style>
        </ol-feature>
      </ol-source-vector>
    </ol-vector-layer>

    <!-- Packet Paths -->
    <ol-vector-layer>
      <ol-source-vector :features="packetPaths"> </ol-source-vector>
      <!-- TODO: fix style -->
      <!-- <ol-style :overrideStyleFunction="packetPathStyleFunc"> </ol-style> -->
    </ol-vector-layer>
  </ol-map>
</template>

<script setup>
import { computed, ref } from 'vue';

import APRSParser from 'aprs-parser/lib/APRSParser';
import distinctColors from 'distinct-colors';

import { GPX } from 'ol/format';
import Feature from 'ol/Feature';
import MultiLineString from 'ol/geom/MultiLineString';
import LineString from 'ol/geom/LineString';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';

import packetLog from '/../IS_packets.txt?raw';
const routes = Object.values(import.meta.globEager('./gpx/*.gpx')).map(
  (gpx) => gpx.default
);

const parser = new APRSParser();
const packets = packetLog
  .trim()
  .split('\n')
  // parse to Date and APRS packet
  .map((line) => {
    let packet = parser.parse(line.slice(29));
    packet.date = new Date(line.slice(0, 18));
    return packet;
  });

function packetsToStationPathPoints(packets) {
  return packets.map((packet) => [packet.data.longitude, packet.data.latitude]);
}

function pathToString(path) {
  return path
    .filter(
      (station) => !station.call.match(/WIDE[12]|qA?|UV[123]|.*\*$|UNCAN/)
    )
    .map((station) => station.toString().trim().replace(/\*$/, ''));
}

function groupByCall(acc, packet) {
  let callsign = packet.from.toString().trim();
  if (!(callsign in acc)) acc[callsign] = [];
  acc[callsign].push(packet);
  return acc;
}

function colorForDigi(digi) {
  if (digi in digiColors.value) {
    return digiColors.value[digi].hex();
  } else {
    return '#000000';
  }
}

function packetPathStyleFunc(feature, resolution) {
  let paths = feature.getProperties().properties.paths.slice(0);
  let styles = [];

  feature
    .getGeometry()
    .getLineStrings()
    .forEach((ls) => {
      let path = paths.shift().slice(0);
      ls.forEachSegment((start, end) => {
        let color = colorForDigi(path.shift());

        styles.push(
          new Style({
            geometry: new LineString([start, end]),
            stroke: new Stroke({ color: color, width: 2 }),
          })
        );
      });
    });

  console.log(styles);

  return styles;
}

const positionalPackets = computed(() => {
  return (
    packets
      .filter(
        (packet) =>
          packet.date > new Date('2018-07-13') &&
          packet.date < new Date('2018-07-14')
      )
      // filter to just positional data
      .filter((packet) => 'data' in packet && 'latitude' in packet.data)
  );
});

const stationPaths = computed(() => {
  // group by callsign
  return positionalPackets.value.reduce(groupByCall, {});
});

const digis = computed(() => {
  let digiCalls = new Set(
    packets
      .map((packet) => pathToString(packet.via))
      .reduce((acc, stations) => acc.concat(stations))
  );

  return (
    packets
      // filter to digis
      .filter((packet) => digiCalls.has(packet.from.toString().trim()))
      // filter to just positional data
      .filter((packet) => 'data' in packet && 'latitude' in packet.data)
      // group by call
      .reduce(groupByCall, {})
  );
});

const digiPos = computed(() => {
  return Object.entries(digis.value).reduce((acc, [digi, packets]) => {
    let lastPacket = packets[packets.length - 1];
    acc[digi] = [lastPacket.data.longitude, lastPacket.data.latitude];
    return acc;
  }, {});
});

const packetPaths = computed(() => {
  let digipeaterPostitions = digiPos.value;
  return Object.entries(stationPaths.value).map(([station, packets]) => {
    let lines = packets.map((packet) => {
      let path = pathToString(packet.via);
      return {
        // first point in path is originating station
        coords: [
          [packet.data.longitude, packet.data.latitude],
          ...path.map((hop) => digipeaterPostitions[hop] || [0, 0]),
        ],
        path: path,
      };
    });

    return new Feature({
      id: station,
      geometry: new MultiLineString(lines.map((p) => p.coords)),
      properties: { paths: lines.map((p) => p.path) },
    });
  });
});

const stationColors = computed(() => {
  return distinctColors({
    count: Object.keys(stationPaths.value).length,
    lightMin: 20,
    lightMax: 80,
  });
});

const digiColors = computed(() => {
  let colors = distinctColors({
    count: Object.keys(digis.value).length,
    lightMin: 20,
    lightMax: 80,
  });
  return Object.keys(digis.value).reduce((acc, callsign, index) => {
    acc[callsign] = colors[index];
    return acc;
  }, {});
});
</script>

<style>
html,
body {
  height: 100%;
  margin: 0;
}

.map {
  width: 100vw;
  height: 100vh;
}

.ol-control.layer-toggles {
  top: 0.5em;
  right: 0.5em;
  background-color: rgba(70, 115, 164, 0.7);
  color: #eee;
  white-space: nowrap;
  max-height: calc(100vh - 1em);
  overflow-y: auto;
}

.layer-toggles > div {
  margin: 0.5em;
  margin-right: 1em;
}

.ol-control.layer-toggles:hover {
  background-color: rgba(0, 60, 136, 0.7);
}

.layer-toggles > div > label {
  display: block;
}

.expand {
  display: none;
}

.expand + span::before {
  content: '\25B6';
}

.expand:checked + span::before {
  content: '\25BC';
}

.expand ~ .collapsible-content {
  display: none;
}

.expand:checked ~ .collapsible-content {
  display: block;
}

.collapsible-content {
  margin-left: 0.8em;
}

.collapsible-content > label {
  display: block;
}
</style>
