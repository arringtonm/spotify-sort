<template>
  <v-app>
    <v-app-bar
      app
      color="primary"
      dark
    >
        <v-spacer></v-spacer>   
    </v-app-bar>

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
