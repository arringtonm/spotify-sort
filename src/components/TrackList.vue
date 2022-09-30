<template>
  <div>
    <v-container>
      <div class="filters-container">
        <div class="filter">
          <div v-for="pitch in pitches" :key="pitch" class="checkrow">
            <v-checkbox
              type="checkbox"
              :value="pitch"
              :key="pitch"
              :id="pitch"
              :label="pitch"
              color="hsl(209, 58%, 36%)"
              v-model="selectedPitches"
            />
            <div class="checkrow-sub">
              <v-checkbox
                label="min"
                color="hsl(209, 58%, 36%)"
                :disabled="!selectedPitches.includes(pitch)"
                v-model="selectedPitchModes[pitch]['min']"
              />
              <v-checkbox
                label="maj"
                color="hsl(209, 58%, 36%)"
                :disabled="!selectedPitches.includes(pitch)"
                v-model="selectedPitchModes[pitch]['maj']"
              />
            </div>
          </div>
        </div>
        <div class="filter">
          <v-range-slider
            v-model="tempoRange"
            hint="Im a hint"
            max="180"
            min="70"
            thumb-label="always"
            label="BPM Min/Max Range"
            track-color="hsl(209, 85%, 95%)"
            track-fill-color="hsl(209, 58%, 36%"
            thumb-color="hsl(209, 58%, 36%"
            color="white"
          >
          </v-range-slider>
          <v-text-field
            v-model="textSearchQuery"
            label="Artist or song name"
            clearable
            color="hsl(209, 58%, 36%)"
          ></v-text-field>
        </div>
      </div>

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
      return this.tracks.filter(
        (track) =>
          this.selectedPitches.includes(track.key) &&
          this.selectedPitchModes[track.key][track.mode] &&
          track.tempo >= this.tempoRange[0] &&
          track.tempo <= this.tempoRange[1] &&
          (track.title.includes(this.textSearchFilter) ||
            track.artist.includes(this.textSearchFilter))
      );
    },
    textSearchFilter() {
      if (this.textSearchQuery.length) {
        return this.textSearchQuery;
      }
      return '';
    },

    // showMode(pitch) {
    //   return this.selectedPitches.includes(pitch);
    // },
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
    selectedPitchModes: {
      C: { min: true, maj: true },
      'C#': { min: true, maj: true },
      D: { min: true, maj: true },
      Eb: { min: true, maj: true },
      E: { min: true, maj: true },
      F: { min: true, maj: true },
      'F#': { min: true, maj: true },
      G: { min: true, maj: true },
      Ab: { min: true, maj: true },
      A: { min: true, maj: true },
      Bb: { min: true, maj: true },
      B: { min: true, maj: true },
    },
    tempoRange: [90, 130],
    textSearchQuery: '',
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

label.v-label {
  min-width: 2.5ch;
}

fieldset {
  border: none;
  margin-left: 16px;
}

.v-input--checkbox {
  margin-top: 0 !important;
  padding-top: 0;
  padding-bottom: 0;
  margin-bottom: -8px;
}

.v-input__slider {
  margin: 2rem 0 1rem;
}
.v-messages {
  display: none;
}

.checkrow {
  display: flex;
  flex-direction: row;
}
.checkrow-sub {
  display: flex;
  // flex-direction: column;
  align-self: end;
  margin-left: 8px;
  label {
    min-width: 4ch;
  }
}

.theme--light.v-input--is-disabled {
  // .theme--light.v-label--is-disabled {
  color: hsl(209, 85%, 95%) !important;
}

.filters-container {
  display: flex;
  flex-direction: row;
}
.filter {
  width: auto;
}
.filter:nth-of-type(2) {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-content: center;
  align-self: center;
  // padding: 16px;
  margin-left: 64px;
}

.v-text-field {
  padding-right: 8px;
}
.theme--light.v-text-field > .v-input__control > .v-input__slot:before {
  border-color: hsl(209, 85%, 95%) !important;
  border-width: 1px;
}
</style>
