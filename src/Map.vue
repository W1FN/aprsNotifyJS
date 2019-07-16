<template>
  <vl-map data-projection="EPSG:4326">
    <vl-view :zoom="10" :center="[-72.15, 43.9]">
      <vl-layer-tile>
        <vl-source-osm> </vl-source-osm>
      </vl-layer-tile>
      <vl-layer-group>
        <vl-layer-vector v-for="(gpxURL, name) in routes" :key="name">
          <vl-source-vector :url="gpxURL" :format-factory="gpxFormatFactory">
          </vl-source-vector>
          <vl-style-box>
            <vl-style-stroke color="hsl(200, 90%, 30%)" :width="5">
            </vl-style-stroke>
          </vl-style-box>
        </vl-layer-vector>
      </vl-layer-group>

      <!-- Station Paths -->
      <vl-layer-group>
        <vl-layer-group
          v-for="(packets, callsign, idx) in stationPaths"
          :key="callsign"
        >
          <!--Paths -->
          <vl-layer-vector>
            <vl-source-vector>
              <vl-feature>
                <vl-geom-line-string
                  :coordinates="packetsToStationPathPoints(packets)"
                >
                </vl-geom-line-string>
              </vl-feature>
            </vl-source-vector>
            <vl-style-box>
              <vl-style-stroke :color="stationColors[idx].hex()" :width="2">
              </vl-style-stroke>
            </vl-style-box>
          </vl-layer-vector>

          <!-- Points -->
          <vl-layer-vector>
            <vl-source-vector>
              <vl-feature>
                <vl-geom-multi-point
                  :coordinates="packetsToStationPathPoints(packets)"
                >
                </vl-geom-multi-point>
              </vl-feature>
            </vl-source-vector>
            <vl-style-box>
              <vl-style-circle :radius="3">
                <vl-style-fill :color="stationColors[idx].hex()">
                </vl-style-fill>
              </vl-style-circle>
            </vl-style-box>
          </vl-layer-vector>
        </vl-layer-group>
      </vl-layer-group>

      <!-- Digipeater locations -->
      <vl-layer-vector>
        <vl-source-vector>
          <vl-feature v-for="(position, callsign) in digiPos" :key="callsign">
            <vl-geom-point :coordinates="position"> </vl-geom-point>
            <vl-style-box>
              <vl-style-circle>
                <vl-style-fill :color="digiColors[callsign].hex()">
                </vl-style-fill
              ></vl-style-circle>
              <vl-style-text :text="callsign" :offsetY="12"> </vl-style-text>
            </vl-style-box>
          </vl-feature>
        </vl-source-vector>
      </vl-layer-vector>

      <!-- Packet Paths -->
      <vl-layer-group>
        <vl-layer-group
          v-for="(pkts, callsign) in stationPaths"
          :key="callsign"
        >
          <!--Paths -->
          <vl-layer-vector render-mode="image">
            <vl-source-vector>
              <template v-for="packet in pkts">
                <vl-feature
                  v-for="[coords, digi] in packetToPacketPathPoints(packet)"
                  :key="digi"
                >
                  <vl-geom-line-string :coordinates="coords">
                  </vl-geom-line-string>
                  <vl-style-box>
                    <vl-style-stroke :color="colorForDigi(digi)">
                    </vl-style-stroke>
                  </vl-style-box>
                </vl-feature>
              </template>
            </vl-source-vector>
          </vl-layer-vector>
        </vl-layer-group>
      </vl-layer-group>
    </vl-view>
  </vl-map>
</template>

<script>
import { APRSParser } from "aprs-parser";
import distinctColors from "distinct-colors";

import { Control } from "ol/control";
import { GPX } from "ol/format";

import Vue from "vue";
import VueLayers from "vuelayers";
import "vuelayers/lib/style.css";

Vue.use(VueLayers);

import route_data from "gpx/*.gpx";
import { readFileSync } from "fs";
const packetLog = readFileSync(__dirname + "/../IS_packets.txt", "utf-8");

function parsePackets(packetLog) {
  let parser = new APRSParser();
  return (
    packetLog
      .trim()
      .split("\n")
      // parse to Date and APRS packet
      .map(line => {
        let packet = parser.parse(line.slice(29));
        packet.date = new Date(line.slice(0, 18));
        return packet;
      })
  );
}

export default {
  data() {
    return {
      packets: parsePackets(packetLog),
      routes: route_data
    };
  },

  methods: {
    gpxFormatFactory(options) {
      return new GPX(options);
    },

    packetsToStationPathPoints(packets) {
      return packets.map(packet => [
        packet.data.longitude,
        packet.data.latitude
      ]);
    },

    packetToPacketPathPoints(packet) {
      return this.pathToString(packet.via).map((hop, index, hops) => {
        if (this.digiPos[hop] === undefined) {
          console.log(hop);
        }

        // first point in path is originating station
        let previous =
          index === 0
            ? [packet.data.longitude, packet.data.latitude]
            : this.digiPos[hops[index - 1]] || [0, 0];

        return [[previous, this.digiPos[hop] || [0, 0]], hop];
      });
    },

    pathToString(path) {
      return path
        .filter(
          station => !station.call.match(/WIDE[12]|qA?|UV[123]|.*\*$|UNCAN/)
        )
        .map(station =>
          station
            .toString()
            .trim()
            .replace(/\*$/, "")
        );
    },

    groupByCall(acc, packet) {
      let callsign = packet.from.toString().trim();
      if (!(callsign in acc)) acc[callsign] = [];
      acc[callsign].push(packet);
      return acc;
    },

    colorForDigi(digi) {
      if (digi in this.digiColors) {
        return this.digiColors[digi].hex();
      } else {
        return "black";
      }
    }
  },

  computed: {
    stationPaths() {
      return (
        this.packets
          .filter(
            packet =>
              packet.date > new Date("2018-07-13") &&
              packet.date < new Date("2018-07-14")
          )
          // filter to just positional data
          .filter(packet => "data" in packet && "latitude" in packet.data)
          // group by callsign
          .reduce(this.groupByCall, {})
      );
    },

    digis() {
      let digiCalls = new Set(
        this.packets
          .map(packet => this.pathToString(packet.via))
          .reduce((acc, stations) => acc.concat(stations))
      );

      return (
        this.packets
          // filter to digis
          .filter(packet => digiCalls.has(packet.from.toString().trim()))
          // filter to just positional data
          .filter(packet => "data" in packet && "latitude" in packet.data)
          // group by call
          .reduce(this.groupByCall, {})
      );
    },

    digiPos() {
      return Object.entries(this.digis).reduce((acc, [digi, packets]) => {
        let lastPacket = packets[packets.length - 1];
        acc[digi] = [lastPacket.data.longitude, lastPacket.data.latitude];
        return acc;
      }, {});
    },

    stationColors() {
      return distinctColors({
        count: Object.keys(this.stationPaths).length,
        lightMin: 20,
        lightMax: 80
      });
    },

    digiColors() {
      let colors = distinctColors({
        count: Object.keys(this.digis).length,
        lightMin: 20,
        lightMax: 80
      });
      return Object.keys(this.digis).reduce((acc, callsign, index) => {
        acc[callsign] = colors[index];
        return acc;
      }, {});
    }
  }
};
</script>

<style>
html,
body {
  height: 100%;
  margin: 0;
}

.map {
  height: 100%;
  width: 100%;
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
  content: "\25B6";
}

.expand:checked + span::before {
  content: "\25BC";
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
