<template>
  <div>
    <v-container>
      <v-checkbox
        v-for="pitch in pitches"
        type="checkbox"
        :value="pitch"
        :key="pitch"
        :id="pitch"
        :label="pitch"
        color="hsl(209, 58%, 36%)"
        v-model="selectedPitches"
      />
      <v-data-table
        id="tracklist"
        :headers="headers"
        :items="filteredTracks"
        :sort-by="['artist', 'title', 'tempo', 'key', 'mode']"
        :items-per-page="1000"
        hide-default-footer
      >
        <template v-slot:item.title="{ item }">
          <a
            target="_blank"
            :href="`https://open.spotify.com/track/${item.id}`"
          >
            {{ item.title }}
          </a>
        </template>
      </v-data-table>
    </v-container>
  </div>
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
      return track;
    },
    // crude filter by key
    filteredTracks() {
      return this.tracks.filter((track) =>
        this.selectedPitches.includes(track.key)
      );
    },
  },
  data: () => ({
    pitches: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
    selectedPitches: [
      'C',
      'C#',
      'D',
      'Eb',
      'E',
      'F',
      'F#',
      'G',
      'Ab',
      'A',
      'Bb',
      'B',
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
      { text: 'Mode', value: 'mode' },
      // { text: 'Mode', value: 'mode' }
    ],
    tracks: tracklist,
  }),
};
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
  a {
    color: #173e64;
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
  tr:nth-of-type(1n):hover a {
    color: white;
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

fieldset {
  border: none;
  margin-left: 16px;
}

.v-input {
  margin: 0 !important;
  padding-top: 0;
  // line-height: 1;
}
.v-messages {
  display: none;
}
</style>
