import 'ol/ol.css';
import {Map as olMap, View} from 'ol';
import {Control} from 'ol/control';
import {Group as LayerGroup, Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import {OSM, Vector as VectorSource} from 'ol/source';
import {GPX} from 'ol/format';
import Feature from 'ol/Feature';
import {fromLonLat} from 'ol/proj';
import {Circle as CircleStyle, Icon, Fill, Stroke, Style, Text} from 'ol/style';
import Projection from 'ol/proj/Projection';
import {LineString, Point} from 'ol/geom';

import {readFileSync} from 'fs';
const packetLog = readFileSync(__dirname + '/../IS_packets.txt', 'utf-8');

import {APRSParser} from 'aprs-parser';

let tile_layer = new TileLayer({source: new OSM()});

import route_data from 'gpx/*.gpx';

let routes = new LayerGroup({
  title: "Routes",
  layers: Object.keys(route_data).map(name => new VectorLayer({
    title: name.replace(/_/g, " "),
    source: new VectorSource({
      url: route_data[name],
      format: new GPX()
    }),
    style: new Style({
      stroke: new Stroke(
        {color: 'hsl(200, 90%, 30%)', width: 5}
      )})
  }))
});


let map = new olMap({
  target: 'map',
  layers: [
    tile_layer,
    routes
  ],
  view: new View({
    center: fromLonLat([-72.15, 43.90]),
    zoom: 10
  })
});

class ColorGenerator {
  constructor(count) {
    let mult = Math.floor(360 / count);
    this.hues = Array.from(Array(count).keys()).map(x => x * mult);

    // Shuffle (this is not a great shuffle, but I don't care)
    this.hues.forEach((current, index, arr) => {
      let randomIndex = Math.floor(Math.random() * index);
      [arr[index], arr[randomIndex]] = [arr[randomIndex], arr[index]];
    });
  }
  get() {
    return this.hues.pop();
  }
};

function transformGeometry(geometry) {
  return geometry.transform(new Projection({code: "EPSG:4326"}),
                            tile_layer.getSource().getProjection());
}

function plotPaths(packets) {
  let path_layers = new LayerGroup({title: "Station Paths"});
  map.addLayer(path_layers);

  let paths = packets
      .filter(packet => packet.date > new Date("2018-07-14") && packet.date < new Date("2018-07-15"))
      // filter to just positional data
      .filter(packet => 'data' in packet && 'latitude' in packet.data)
      // join into Arrays of points
      .reduce((acc, packet) => {
        let callsign = packet.from.toString().trim();
        if (!acc.has(callsign)) acc.set(callsign, []);
        acc.get(callsign).push([packet.data.longitude, packet.data.latitude]);
        return acc;
      }, new Map());

  let colorGen = new ColorGenerator(paths.size);

  // plot on map
  paths.forEach((points, callsign) => {
    let path_layer = new VectorLayer({
      title: callsign,
      source: new VectorSource({features: [
        new Feature({
          geometry: transformGeometry(new LineString(points))
        })
      ]}),
      style: new Style({
        stroke: new Stroke(
          {color: 'hsl(' + colorGen.get() + ', 75%, 50%)', width: 2}
        )})
    });
    path_layers.getLayers().push(path_layer);
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

  let colorGen = new ColorGenerator(digiPos.size);
  let colorMap = Array.from(digiPos.keys()).reduce(
    (acc, callsign, index) =>
      acc.set(callsign, colorGen.hues[index]), new Map());

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
    title: "Digipeater Labels",
    zIndex: 1, // TODO: probably not the best way to do this
    source: new VectorSource({
      features: Array.from(digiPos.keys()).map(callsign =>
        new Feature({
          geometry: transformGeometry(new Point(digiPos.get(callsign))),
          callsign: callsign
        })
      )}),
    style: feature => {
      digi_style.setText(new Text({
        text: feature.get('callsign'),
        offsetY: 12
      }));
      return digi_style;
    }
  });
  map.addLayer(digi_layer);

  let packet_path_layers = new LayerGroup({title: "Packet Paths"});
  let layers_map = new Map();
  map.addLayer(packet_path_layers);
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

          // first point in path is originating station
          let previous = (index === 0) ?
              [packet.data.longitude, packet.data.latitude] :
              digiPos.get(stations[index - 1]) || [0, 0];

          let pathFeature = new Feature(transformGeometry(
            new LineString([previous, digiPos.get(station) || [0, 0]])));

          // TODO: want to color per station that hears it, probably means
          // making a lot more features
          let color = colorMap.get(station);
          pathFeature.setStyle(new Style({
            stroke: new Stroke(
              {color: 'hsl(' + color + ', 60%, 60%)', width: 2}
            )}));

          if (!layers_map.has(station)) {
            layers_map.set(station, new VectorLayer({
              title: station,
              source: new VectorSource(),
              renderMode: 'image'
            }));
            packet_path_layers.getLayers().push(layers_map.get(station));
          }
          layers_map.get(station).getSource().addFeature(pathFeature);
        });
    });
}

function layer_toggle(layer, parentElement) {
  if (layer.toggle_element === undefined) {
    layer.toggle_element = parentElement.appendChild(
      document.createElement('label'));

    let checkbox = layer.toggle_element.appendChild(
      document.createElement('input'));
    checkbox.type = "checkbox";
    checkbox.checked = layer.getVisible();
    checkbox.addEventListener('change', event => {
      layer.setVisible(event.target.checked);
    });
    layer.toggle_element.appendChild(
      document.createTextNode(layer.get('title')));
  }
  return layer.toggle_element;
}

function render_layer_toggles(event, element) {
  event.map.getLayers().getArray()
    .filter(layer => layer.get('title') !== undefined)
    .forEach(layer => {
      if (layer instanceof LayerGroup) {
        if (layer.group_toggle === undefined) {
          let label = layer.group_toggle = element.appendChild(
            document.createElement('label'));
          let input = label.appendChild(document.createElement('input'));
          input.type = 'checkbox';
          input.className = "expand";
          label.appendChild(document.createElement('span'));

          layer_toggle(layer, label); // whole LayerGroup

          let child_toggle_element = label.appendChild(
            document.createElement('input'));
          child_toggle_element.type = 'checkbox';
          child_toggle_element.checked = true;
          child_toggle_element.addEventListener('change', event => {
            console.log("test");
            layer.getLayers().forEach(subLayer => {
              subLayer.setVisible(event.target.checked);
              subLayer.toggle_element.querySelector("input").checked =
                event.target.checked;
            });
          });

          let container = label.appendChild(document.createElement('div'));
          container.className = 'collapsible-content';
          layer.getLayers().forEach(
            sublayer => layer_toggle(sublayer, container));
        }
      }
      else {
        layer_toggle(layer, element);
    }
    });
}

(function makeLayerToogleControl() {
  let element = document.createElement('div');
  element.className = 'layer-toggles ol-unselectable ol-control';
  let inner = element.appendChild(document.createElement('div'));

  let control = new Control(
    {element: element,
     render: event => render_layer_toggles(event, inner)});
  map.addControl(control);
})();


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
