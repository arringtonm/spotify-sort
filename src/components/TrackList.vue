<template>
  <v-container>
    <v-data-table
      :headers="headers"
      :items="tracks"
      :sort-by="['artist', 'title', 'tempo', 'key']"
      :sort-desc="[false, true]"  
      :items-per-page="50"   
      class="elevation-1"
      hide-default-footer
    >

    </v-data-table>

    </v-container>
</template>

<script>
  export default {
    name: 'TrackList',
    methods: {
     //
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
          value: 'artist'
        },
        { text: 'Title', value: 'title' },
        { text: 'Key', value: 'key' },
        { text: 'Tempo', value: 'tempo' }
      ],
      tracks: [
    {
        "artist": "Lawrence Rothman",
        "title": "Wolves Still Cry - Classixx Remix",
        "id": "4FiJ9JT9nicjc8Oadnf2gA",
        "key": "F min",
        "tempo": 111
    },
    {
        "artist": "Biyo",
        "title": "pantone",
        "id": "10kHVbCpdjspXvhKIGhaYp",
        "key": "Bb min",
        "tempo": 118
    },
    {
        "artist": "Goldroom",
        "title": "I Can Feel It",
        "id": "2Pe8kPCiJSI363uO0Q4eB2",
        "key": "G min",
        "tempo": 124
    },
    {
        "artist": "The Magician",
        "title": "Hippies (feat. Two Another)",
        "id": "6X6Czunvadm5759A96SjFD",
        "key": "C maj",
        "tempo": 121
    },
    {
        "artist": "Foster The People",
        "title": "Lamb's Wool (with Poolside)",
        "id": "2Kv2ihNE3KAztq2GWassEZ",
        "key": "B maj",
        "tempo": 89
    },
    {
        "artist": "Majestique",
        "title": "Must Get There - Dubka Remix",
        "id": "4akabTDyDj0agFz8Jat7xM",
        "key": "G maj",
        "tempo": 118
    },
    {
        "artist": "warner case",
        "title": "ok",
        "id": "30j17PGHg0vmx4IgKpZsWu",
        "key": "C maj",
        "tempo": 122
    },
    {
        "artist": "Dynamique",
        "title": "Ways of Love feat. Klory Starling - TEO remix",
        "id": "6GmBx0BPB0anvYZeePNx7r",
        "key": "F maj",
        "tempo": 105
    },
    {
        "artist": "Indigo Eyes",
        "title": "Jaded",
        "id": "7l9u9r0IewXqHQfWYYu4nT",
        "key": "F# maj",
        "tempo": 108
    },
    {
        "artist": "Kraak & Smaak",
        "title": "Don't Want This to Be Over - Jean Tonique Remix",
        "id": "0FHMBoChyeHGQcLzV90Mvv",
        "key": "B maj",
        "tempo": 106
    },
    {
        "artist": "The Avalanches",
        "title": "Wherever You Go (feat. Jamie xx, Neneh Cherry & CLYPSO)",
        "id": "0IgbHKFkJxu7dEWJPK02CL",
        "key": "F min",
        "tempo": 110
    },
    {
        "artist": "Jafunk",
        "title": "The Baddest",
        "id": "3ncpLDd2Jap0gWr1vXgosv",
        "key": "F min",
        "tempo": 117
    },
    {
        "artist": "SG Lewis",
        "title": "Feed The Fire (feat. Lucky Daye)",
        "id": "0yU8ftsMI0LDMtee8TDsDR",
        "key": "G maj",
        "tempo": 122
    },
    {
        "artist": "Galantis",
        "title": "Dandelion",
        "id": "4NexTaCZZ7Ehnf03A6SVjt",
        "key": "C maj",
        "tempo": 118
    },
    {
        "artist": "Gilligan Moss",
        "title": "Slow Down",
        "id": "3963Fpo8sgV4xtYfllajVW",
        "key": "C maj",
        "tempo": 124
    },
    {
        "artist": "spüke",
        "title": "Emanate",
        "id": "0ie6osPoPkFdAFFQh0vohz",
        "key": "Bb min",
        "tempo": 120
    },
    {
        "artist": "Autolaser",
        "title": "Naikira",
        "id": "5dc2UVT3rtMUM4vf4Vsrlc",
        "key": "Eb min",
        "tempo": 90
    },
    {
        "artist": "Courage",
        "title": "Long Way Up",
        "id": "4QLNLQoDhnY5bjvO3iDDyX",
        "key": "Eb min",
        "tempo": 170
    },
    {
        "artist": "Les Loups",
        "title": "Enough",
        "id": "0jeUsJ5tuxVZgq8Cc2OIgn",
        "key": "C min",
        "tempo": 122
    },
    {
        "artist": "Lxury",
        "title": "Acid Rain - Edit",
        "id": "14PKyZQsD9qZLVXuWM84ZU",
        "key": "Ab maj",
        "tempo": 124
    },
    {
        "artist": "Fwdslxsh",
        "title": "4U",
        "id": "3XRJvjVyccZw9WNiLHxfMk",
        "key": "F# min",
        "tempo": 129
    },
    {
        "artist": "Snowk",
        "title": "This Is Good (feat. Miraa May)",
        "id": "155S4GydOrhSbmHtUXwVZu",
        "key": "C# min",
        "tempo": 105
    },
    {
        "artist": "Men I Trust",
        "title": "Dazed (feat. Gabrielle & Geoffroy)",
        "id": "7BaZ7WlAdhOaGjIUYWsUWy",
        "key": "F# min",
        "tempo": 120
    },
    {
        "artist": "Pat Lok",
        "title": "Might Be on Fire",
        "id": "3UyWkLdiamzEBeGLvHuM6v",
        "key": "F# min",
        "tempo": 116
    },
    {
        "artist": "Channel Tres",
        "title": "Topdown",
        "id": "56dDonzTxrZKWuVDqUOYGd",
        "key": "C# maj",
        "tempo": 120
    },
    {
        "artist": "Tentendo",
        "title": "Make Me High",
        "id": "3FyABxkdjGLbqAZFmOMQij",
        "key": "D min",
        "tempo": 125
    },
    {
        "artist": "iamalex",
        "title": "1998",
        "id": "1TIBMsOQof1RI7vPxVGxNu",
        "key": "Eb min",
        "tempo": 122
    },
    {
        "artist": "Giraffage",
        "title": "Slowly",
        "id": "0G8cT5tSi9q8OXQ68An917",
        "key": "B min",
        "tempo": 109
    },
    {
        "artist": "Whethan",
        "title": "Sunshine (with The Knocks)",
        "id": "2jokLd93nobhAlHcWiGusC",
        "key": "G maj",
        "tempo": 122
    },
    {
        "artist": "Kartell",
        "title": "Attracted",
        "id": "28YlX3Q04G33EdDXpCUxXn",
        "key": "B min",
        "tempo": 120
    },
    {
        "artist": "Ekkah",
        "title": "Figure It Out - Night Edit",
        "id": "3nRcAT9aoplAv9y18rQXRi",
        "key": "C maj",
        "tempo": 107
    },
    {
        "artist": "Big Words",
        "title": "TTYDTM",
        "id": "7pIREk1eDQpjTw5N9PMVJk",
        "key": "G maj",
        "tempo": 106
    },
    {
        "artist": "spüke",
        "title": "Emanate",
        "id": "6otMqBmdJD8V7rAUnLMs1D",
        "key": "Bb min",
        "tempo": 120
    },
    {
        "artist": "Maxzwell",
        "title": "Need You",
        "id": "0EhVmKK4E4ZOYBc29kfIOI",
        "key": "D min",
        "tempo": 74
    },
    {
        "artist": "Fabich",
        "title": "Beach House",
        "id": "7Ix3p9gFRVLLRQFpxiN9oB",
        "key": "Ab maj",
        "tempo": 95
    },
    {
        "artist": "Jarreau Vandal",
        "title": "Someone That You Love - Franc Moody Remix",
        "id": "0mb2iFADjXFYsZJ6lmTeIA",
        "key": "F# min",
        "tempo": 105
    },
    {
        "artist": "Ninajirachi",
        "title": "Pure Luck (feat. Freya Staer)",
        "id": "5F9Td50J660cg3XgoNFzLN",
        "key": "B min",
        "tempo": 180
    },
    {
        "artist": "Nicolaas",
        "title": "Never Too Late - Jean Tonique Remix",
        "id": "72XngRprcvlCVlv4Y0FCk4",
        "key": "Ab maj",
        "tempo": 115
    },
    {
        "artist": "daste.",
        "title": "SOBER",
        "id": "15gUsLGaGz43tr2A4ILXFU",
        "key": "F# min",
        "tempo": 110
    },
    {
        "artist": "The Undercover Dream Lovers",
        "title": "Chardonnay - Poolside Remix",
        "id": "64UvV0e3BwArToWazMVo9h",
        "key": "C min",
        "tempo": 106
    },
    {
        "artist": "TCTS",
        "title": "Live For Something - Kartell Remix",
        "id": "1S17xmU7gFHVxlLlSYMNoO",
        "key": "E min",
        "tempo": 120
    },
    {
        "artist": "Poolside",
        "title": "Next To You",
        "id": "2M7fA5L6zH9oxq53WsaYB4",
        "key": "E min",
        "tempo": 94
    },
    {
        "artist": "Jean Tonique",
        "title": "Something to Talk About",
        "id": "4UFyPeCWmb7yvth4dIL0xw",
        "key": "G min",
        "tempo": 117
    },
    {
        "artist": "Goldroom",
        "title": "Till Sunrise (feat. Mammals)",
        "id": "1pnwoWbZcS77Dx0jQVYK8X",
        "key": "C maj",
        "tempo": 84
    },
    {
        "artist": "Blood Cultures",
        "title": "Best for You - DJ ST THOMAS Remix",
        "id": "4yLxi0yFHpjB0FiW668fhI",
        "key": "D maj",
        "tempo": 101
    },
    {
        "artist": "Kllo",
        "title": "Walls To Build - Mall Grab Remix",
        "id": "5gzYmAhQ8XplVsMSThvCYn",
        "key": "Bb min",
        "tempo": 124
    },
    {
        "artist": "Haywyre",
        "title": "Do You Don't You",
        "id": "08MChfwzCjuzC5jD4tDZ74",
        "key": "F min",
        "tempo": 115
    },
    {
        "artist": "Ben Macklin",
        "title": "I Need You",
        "id": "7G6h7mnvP3xBNJsShiYBuE",
        "key": "Bb min",
        "tempo": 115
    },
    {
        "artist": "Lewis OfMan",
        "title": "Attitude",
        "id": "0DPenz1hSSH4O8PXyEaggl",
        "key": "B min",
        "tempo": 101
    },
    {
        "artist": "Jerry Folk",
        "title": "I'm Honestly Not a Gangster",
        "id": "2QXlFiKu516LyFVFJO6yqG",
        "key": "A min",
        "tempo": 116
    }
]
    }),
  }
</script>
