<template>
  <v-container>
    <v-data-table
      id="tracklist"
      :headers="headers"
      :items="tracks"
      :sort-by="['artist', 'title', 'tempo', 'key', 'mode']"
      :items-per-page="1000"   
      hide-default-footer
    >
    </v-data-table>

  </v-container>
</template>

<script>
  const tracklist = require('./tracks.json');

  export default {
    name: 'TrackList',
    methods: {
     //
    },
    computed: {
        returnCamelot(track) {
            return track
        }
    },
    data: () => ({
      pitches: [
        'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'
      ],
      headers: [
        {
          text: 'Artist',
          align: 'start',
          sortable: true,
          value: 'artist',
        },
        { text: 'Title', value: 'title' },
        { text: 'Tempo', value: 'tempo' },
        { text: 'Key', value: 'key' },
        { text: 'Mode', value: 'mode' }
        // { text: 'Mode', value: 'mode' }
      ],
      tracks: tracklist
      })
    }
</script>

<style lang="scss">
  
  #tracklist {

    td {
      border: none;
      border-image-width: 0;
      border-bottom-width: 0;
    }
    @media screen and (min-width: 600px) {
      td,
      th {
        padding: 0 0.5rem;
      }
    }

    td:nth-of-type(3n) {
      min-width: 6rem;
    }
    td:nth-of-type(4n) {
      min-width: 5rem;
    }

    tr:nth-of-type(2n) {
      background-color: hsl(209, 85%, 95%);
    }
    th,
    tr,
    i {
      color: hsl(209, 63%, 24%);
    }
    tr:hover {
      background-color: hsl(209, 58%, 36%);
      color: white;
    }
    thead *:hover {
      background-color: white;
    }
  }

</style>
