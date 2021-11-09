<template>
  <v-app>
    <v-main>
      <TrackList/>
    </v-main>
  </v-app>
</template>

<script>
import TrackList from './components/TrackList';

export default {
  name: 'App',

  components: {
    TrackList,
  },

  data: () => ({
    // 
    //
  }),
};
</script>
