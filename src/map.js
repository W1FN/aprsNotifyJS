import * as Vue from 'vue';

import OpenLayersMap from 'vue3-openlayers';
import 'vue3-openlayers/dist/vue3-openlayers.css';

import Map from './Map.vue';

const app = Vue.createApp(Map);
app.use(OpenLayersMap);

app.mount('#app');
