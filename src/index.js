import * as Vue from 'vue';

// import OpenLayersMap from 'vue3-openlayers';
// import 'vue3-openlayers/dist/vue3-openlayers.css';

import StatusScreen from './StatusScreen.vue';
// import Map from './Map.vue';

const app = Vue.createApp(StatusScreen);
// app.use(OpenLayersMap);

app.mount('#app');
