import 'ol/ol.css';
import {Map as olMap, View} from 'ol';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import {OSM, Vector as VectorSource} from 'ol/source';
import Feature from 'ol/Feature';
import {fromLonLat} from 'ol/proj';
import {Icon, Fill, Stroke, Style, Text} from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import Projection from 'ol/proj/Projection';
import {LineString, Point} from 'ol/geom';

import {readFileSync} from 'fs';
const packetLog = readFileSync(__dirname + '/../IS_packets.txt', 'utf-8');

import {APRSParser} from 'aprs-parser';

import icon from "./arrow.png";

let tile_layer = new TileLayer({source: new OSM()});

let map = new olMap({
  target: 'map',
  layers: [
    tile_layer
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
  let vector_layer = new VectorLayer({
    source: new VectorSource(),
    style: pathStyle
  });
  map.addLayer(vector_layer);

  packets
    .filter(packet => packet.date > new Date("2018-07-14") && packet.date < new Date("2018-07-15"))
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

      vector_layer.getSource().addFeature(pathFeature);
      pathFeature.getGeometry().transform(new Projection({code: "EPSG:4326"}),
                                          tile_layer.getSource().getProjection());
    });
}

function plotPacketPaths(packets) {
  function pathToString(path) {
    return path
      .filter(station => !station.call.match(/WIDE[12]|qA?|UV[123]|.*\*$|UNCAN/))
      .map(station => station.toString().trim().replace(/\*$/, ""));
  }

  let digiCalls =
      new Set(packets
              .map(packet => pathToString(packet.via))
              .reduce((acc, stations) => acc.concat(stations)));

  let digiPos = packets
      // filter to digis
      .filter(packet => digiCalls.has(packet.from.toString().trim()))
      // filter to just positional data
      .filter(packet => 'data' in packet && 'latitude' in packet.data)
      // convert to callsign -> position mapping
      .reduce((stations, packet) =>
              stations.set(packet.from.toString().trim(),
                           [packet.data.longitude, packet.data.latitude]),
              new Map());

  // TODO: merge with ColorGenerator
  let mult = Math.floor(360 / digiPos.size);
  let colors = Array.from(Array(digiPos.size).keys()) .map(x => x * mult);
  let colorMap = Array.from(digiPos.keys())
      .reduce((acc, callsign, index) => acc.set(callsign, colors[index]), new Map());

  console.log(colorMap);

  // plot digis
  // TODO: icons
  let digi_style = new Style({
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({color: 'grey'})
    }),
    text: new Text({
      font: 'bold 11px "Open Sans", "Arial Unicode MS", "sans-serif"',
      overflow: true,
      fill: new Fill({color: 'black'})
    })
  });
  let digi_layer = new VectorLayer({
    zIndex: 1, // TODO: probably not the best way to do this
    source: new VectorSource(),
    style: feature => {
      digi_style.getText().setText(feature.get('callsign'));
      return digi_style;
    }
  });
  map.addLayer(digi_layer);

  digiPos.forEach((position, callsign) => {
    let feature = new Feature({
      geometry: new Point(position),
      callsign: callsign
    });

    digi_layer.getSource().addFeature(feature);
    feature.getGeometry().transform(new Projection({code: "EPSG:4326"}),
                                        tile_layer.getSource().getProjection());
  });

  let packet_path_layer = new VectorLayer({source: new VectorSource()});
  map.addLayer(packet_path_layer);
  packets
    .filter(packet => packet.date > new Date("2018-07-14") && packet.date < new Date("2018-07-15"))
    // filter by callsign
    //.filter(packet => packet.from.toString() === "W1HS-9")
    // filter to just positional data
    .filter(packet => 'data' in packet && 'latitude' in packet.data)
    .forEach(packet => {
      pathToString(packet.via)
        .forEach((station, index, stations) => {
          if (digiPos.get(station) === undefined) {
            console.log(station);
          }
          let previous;
          if (index === 0) {
            previous = [packet.data.longitude, packet.data.latitude];
          }
          else {
            previous = digiPos.get(stations[index - 1]) || [0, 0];
          }

          let pathFeature = new Feature(
            new LineString([previous, digiPos.get(station) || [0, 0]]));

          // TODO: want to color per station that hears it, probably means
          // making a lot more features
          let color = colorMap.get(station);
          pathFeature.setStyle(new Style(
            {stroke: new Stroke(
              {color: 'hsl(' + color + ', 60%, 60%)', width: 2}
            )}));

          packet_path_layer.getSource().addFeature(pathFeature);
          pathFeature.getGeometry().transform(new Projection({code: "EPSG:4326"}),
                                              tile_layer.getSource().getProjection());
        });
    });
}

function parsePackets(packetLog) {
  let parser = new APRSParser();
  return packetLog.trim().split("\n")
  // parse to Date and APRS packet
    .map(line => {
      let packet = parser.parse(line.slice(29));
      packet.date = new Date(line.slice(0,18));
      return packet;
    });
}

let packets = parsePackets(packetLog);
plotPaths(packets);
plotPacketPaths(packets);
