import 'ol/ol.css';
import {Map as olMap, View} from 'ol';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import {OSM, Vector as VectorSource} from 'ol/source';
import Feature from 'ol/Feature';
import {fromLonLat} from 'ol/proj';
import {Icon, Stroke, Style} from 'ol/style';
import Projection from 'ol/proj/Projection';
import {LineString, Point} from 'ol/geom';

import {readFileSync} from 'fs';
const packetLog = readFileSync(__dirname + '/../IS_packets.txt', 'utf-8');

import {APRSParser} from 'aprs-parser';

import icon from "./arrow.png";

let parser = new APRSParser();

let tile_layer = new TileLayer({source: new OSM()});
let vector_layer = new VectorLayer({
  source: new VectorSource()
});

let map = new olMap({
  target: 'map',
  layers: [
    tile_layer,
    vector_layer
  ],
  view: new View({
    center: fromLonLat([-72.15, 43.90]),
    zoom: 10
  })
});

let colorGen = {
  hues: null,
  get: function (totalNum) {
    if (this.hues === null) {
      let mult = Math.floor(360 / totalNum);
      this.hues = Array.from(Array(totalNum).keys())
        .map(x => x * mult);

      // Shuffle (this is not a great shuffle, but I don't care)
      this.hues.forEach((current, index, arr) => {
        let randomIndex = Math.floor(Math.random() * index);
        [arr[index], arr[randomIndex]] =
          [arr[randomIndex], arr[index]];
      });
    }
    return this.hues.pop();
  }
};

function pathStyle(feature) {
  let styles = [
    new Style({stroke: new Stroke(
      {color: 'hsl(' + feature.getProperties().hue + ', 75%, 50%)', width: 2}
    )})
  ];

  feature.getGeometry().forEachSegment((start, end) => {
    let dx = end[0] - start[0];
    let dy = end[1] - start[1];
    let rotation = Math.atan2(dy, dx);
    // arrows
    styles.push(new Style({
      geometry: new Point(end),
      image: new Icon({
        src: icon,
        anchor: [0.75, 0.5],
        rotateWithView: true,
        rotation: -rotation
      })
    }));
  });
  return styles;
}

function plotPaths(packets) {
  packets
    // filter by callsign
    .filter(packet => (packet.from !== undefined) &&
            (packet.from.toString() === "W1HS-9"))
    // filter to just positional data
    .filter(packet => 'data' in packet && 'latitude' in packet.data)
    // join into Arrays of points
    .reduce((acc, packet) => {
      if (!acc.has(packet.from.toString())) acc.set(packet.from.toString(), []);
      acc.get(packet.from.toString()).push([packet.data.longitude,
                                            packet.data.latitude]);
      return acc;
    }, new Map())
    // plot on map
    .forEach((points, callsign, map) => {
      let pathFeature = new Feature({
        geometry: new LineString(points),
        hue: colorGen.get(map.size)
      });

      pathFeature.setStyle(pathStyle);

      vector_layer.getSource().addFeature(pathFeature);
      pathFeature.getGeometry().transform(new Projection({code: "EPSG:4326"}),
                                          tile_layer.getSource().getProjection());
    });
}

let packets = packetLog.split("\n")
    // restrict to just prouty times
    .filter(line => {
      let date = new Date(line.slice(0,18));
      return date > new Date("2018-07-14") && date < new Date("2018-07-15");
    })
    // parse to APRS packet
    .map(line => parser.parse(line.slice(29)));

plotPaths(packets);
