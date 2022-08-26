# Spotify sort table

Quick demonstration of data-heavy display and CSS (using some hard-coded Spotify JSON). Leans heavily on existing Vuetify table component but tidied up visually.

## Project setup
```
yarn install
```

### Compiles and hot-reloads for development
```
yarn serve
```

### Compiles and minifies for production
```
yarn build
```

### Lints and fixes files
```
yarn lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

___

## ToDo
* Dump Vuetify and manually build tables (or DIVs/etc)
  - Maintain clickable columns to alternate sorting by BPM, Key, etc
* Combine Key number and mode type into addtional data property `keyWithMode` (Ab, minor -> Ab minor) 
* Create "suggest compatabile songs" feature
  - With any given song input, feature would return songs that are within either a fixed (~3+/-) or flexible BPM range of input song, and with a Key that [Camelot](https://mixedinkey.com/harmonic-mixing-guide/) expects to work (+/-1 Key value at the same mode, or same key value at different mode (7B returns 8B, 6B, 7A, and 12A returns 11A, 1A, 12B)
* Add auth and/or dynamic library import to this app by following [Spotify API documentation](https://developer.spotify.com/documentation/web-api/) or harvesting parts from [this other repo](https://github.com/arringtonm/spotify-playlist-app)
  - And/or use that app to grab your library (or subset from favorites, etc) by hardcoding in the `GET` path to match returned values.
  - Export additional `JSON` file from project and import it here
  - Filter out songs that are <95bpm and >128bpm 
  - Save new filtered `JSON`
* Add link to track URL, where URL is `https://open.spotify.com/track/${track.id}`. Might require dumping Vuetify
