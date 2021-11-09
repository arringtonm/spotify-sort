<template>
  <v-container>
    <v-data-table
      :headers="headers"
      :items="tracks"
      :sort-by="['artist', 'title', 'tempo', 'key']"
      :items-per-page="150"   
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
        { text: 'Tempo', value: 'tempo' },
        { text: 'Key', value: 'key' }
      ],
      tracks: [
        {
            "artist": "Télépopmusik",
            "title": "Breathe - Kartell Club Remix",
            "id": "5OooVYLYftkAdVz1k7QY3H",
            "tempo": 120,
            "key": "F min"
        },
        {
            "artist": "Soda State",
            "title": "Way to Go - Club Soda Mix",
            "id": "2kXcKyonAMXWjW0iWTnm2P",
            "tempo": 123,
            "key": "C# min"
        },
        {
            "artist": "The Aces",
            "title": "Daydream - Snakehips Remix",
            "id": "0qZ5dtH8DLmw8RHVvMfg6H",
            "tempo": 123,
            "key": "B maj"
        },
        {
            "artist": "L'Impératrice",
            "title": "Peur des filles",
            "id": "00mO8JKk2wQ7VqdPcY1r4O",
            "tempo": 102,
            "key": "C# min"
        },
        {
            "artist": "L'Impératrice",
            "title": "Voodoo?",
            "id": "3pr0y5h4MkBngy6gyozLDV",
            "tempo": 108,
            "key": "F# min"
        },
        {
            "artist": "Pat Lok",
            "title": "So Fine (Franc Moody Remix)",
            "id": "2w8jk4NAkqURAJ7WvTI98W",
            "tempo": 125,
            "key": "D min"
        },
        {
            "artist": "Cannons",
            "title": "Mood Ring (Blue Motel Tropical Remix) [feat. Blue Motel]",
            "id": "5TN0L28AWCj6YxjacVhG5O",
            "tempo": 100,
            "key": "Ab min"
        },
        {
            "artist": "Winston Surfshirt",
            "title": "Complicated (feat. Young Franco)",
            "id": "0qjOgJ8BLIt5d9VgYEYq75",
            "tempo": 114,
            "key": "Bb min"
        },
        {
            "artist": "Purple Disco Machine",
            "title": "Money Money",
            "id": "1zwTQonG2ZiQRXZNa4dJOr",
            "tempo": 120,
            "key": "C maj"
        },
        {
            "artist": "YesYou",
            "title": "Everybody's Got to Learn Sometime (Tentendo Remix)",
            "id": "1xGmkIDQy5pFMS8d2K5lpX",
            "tempo": 113,
            "key": "F# maj"
        },
        {
            "artist": "Touch Sensitive",
            "title": "Lay Down",
            "id": "4cLYmYHG10Rzb8bZqlo7Dx",
            "tempo": 110,
            "key": "C min"
        },
        {
            "artist": "Cosmo's Midnight",
            "title": "Talk to Me (feat. Tove Styrke)",
            "id": "4rjV9NFV51DrGXC2jbK2EN",
            "tempo": 110,
            "key": "A min"
        },
        {
            "artist": "Flight Facilities",
            "title": "FOREVER",
            "id": "7GqrUxuTqiup3RGffuQ0y8",
            "tempo": 126,
            "key": "C# maj"
        },
        {
            "artist": "RAC",
            "title": "We Belong - Odesza Remix",
            "id": "4tO93FtEpqdVA0b9RXK4xI",
            "tempo": 115,
            "key": "C maj"
        },
        {
            "artist": "Midnight Pool Party",
            "title": "With You",
            "id": "79NDVigWzX27r5RMFeYLwE",
            "tempo": 112,
            "key": "F# maj"
        },
        {
            "artist": "Hablot Brown",
            "title": "GO (Detroit Swindle Remix)",
            "id": "3dBUKgLv3oFrE9kYhboIXm",
            "tempo": 105,
            "key": "G min"
        },
        {
            "artist": "Durand Jones & The Indications",
            "title": "Witchoo",
            "id": "6W9rbkBueZQrwuzO24GHZ2",
            "tempo": 118,
            "key": "B min"
        },
        {
            "artist": "Satin Jackets",
            "title": "Never Say Never",
            "id": "0IKrQjdwqIUeyjSpyqXEBq",
            "tempo": 115,
            "key": "D min"
        },
        {
            "artist": "Jean Tonique",
            "title": "Let Your Body Move",
            "id": "0yQ5KcZnBCrUycJ81ewF5F",
            "tempo": 117,
            "key": "F# min"
        },
        {
            "artist": "Kid Francescoli",
            "title": "Moon (And It Went Like)",
            "id": "24upABZ8A0sAepfu91sEYr",
            "tempo": 118,
            "key": "G maj"
        },
        {
            "artist": "Sam Gellaitry",
            "title": "LONG DISTANCE",
            "id": "6ih6vYggeYPomAbJupA4hA",
            "tempo": 76,
            "key": "Eb maj"
        },
        {
            "artist": "Sam Gellaitry",
            "title": "Duo",
            "id": "0KbMjhlUH1xUGDgeIQzLsn",
            "tempo": 127,
            "key": "Bb min"
        },
        {
            "artist": "Lil Nas X",
            "title": "SCOOP (feat. Doja Cat)",
            "id": "6bpq1jGkVz66Q3LYeoXdjZ",
            "tempo": 164,
            "key": "F# maj"
        },
        {
            "artist": "Magnus Chapple",
            "title": "As Much As I Can",
            "id": "4w2a774X4DrGv4llRy7xEM",
            "tempo": 107,
            "key": "C# min"
        },
        {
            "artist": "Christian Rich",
            "title": "Tender Love",
            "id": "6DakDX3plNUKLCy6VvsaNE",
            "tempo": 110,
            "key": "D min"
        },
        {
            "artist": "Nao",
            "title": "In the Morning - Mura Masa Edit",
            "id": "1VEGmzJ4VfaTHe5HSkpvQe",
            "tempo": 100,
            "key": "F maj"
        },
        {
            "artist": "Vantage",
            "title": "50//50",
            "id": "385DGwXBspwtI6HfrG3XOM",
            "tempo": 124,
            "key": "G maj"
        },
        {
            "artist": "Touch Sensitive",
            "title": "Lose It All",
            "id": "1LbAuOX6r8dlDuYXUdkkhL",
            "tempo": 109,
            "key": "B min"
        },
        {
            "artist": "Wesley Curtis",
            "title": "Afraid - Remix",
            "id": "5hfKUtSUSMJBWnOhtt0F6m",
            "tempo": 114,
            "key": "B min"
        },
        {
            "artist": "Dom Dolla",
            "title": "Take It",
            "id": "14fIlfcmFPlj4V2IazeJ25",
            "tempo": 123,
            "key": "C maj"
        },
        {
            "artist": "Surrender",
            "title": "This Feeling",
            "id": "1tiGi2e9Xjl1SyQXGX31TT",
            "tempo": 127,
            "key": "B min"
        },
        {
            "artist": "Bodysync",
            "title": "Suenos Bravos",
            "id": "0GvR5AtuXU05hbkRA5o4WT",
            "tempo": 120,
            "key": "D maj"
        },
        {
            "artist": "Romy",
            "title": "Lifetime - Jayda G Baleen Mix",
            "id": "2w3dLUIDO4WqPxTbYEU5B0",
            "tempo": 127,
            "key": "Bb min"
        },
        {
            "artist": "SENTO",
            "title": "Vicious",
            "id": "7i7X2zUD576ycCNO9im8V7",
            "tempo": 121,
            "key": "Ab maj"
        },
        {
            "artist": "Stevedreez",
            "title": "1-800-HITMYLINE",
            "id": "0DkpnbiHYv3tbhzL6HHxZQ",
            "tempo": 114,
            "key": "G maj"
        },
        {
            "artist": "Stevedreez",
            "title": "High Road",
            "id": "6dEuEAemft3D0wVFH1hPWN",
            "tempo": 178,
            "key": "Ab maj"
        },
        {
            "artist": "Stevedreez",
            "title": "Smoking Section",
            "id": "4MVSZAYwa4nPssQmagMhYA",
            "tempo": 103,
            "key": "F# min"
        },
        {
            "artist": "Shawn Mendes",
            "title": "Lost In Japan - Remix",
            "id": "575NJxNUVDqwJGdzBrlLbv",
            "tempo": 107,
            "key": "Bb maj"
        },
        {
            "artist": "Satin Jackets",
            "title": "Only You - Orginal Mix",
            "id": "5yYt6GfIp1lLApx9zZUjYP",
            "tempo": 113,
            "key": "D min"
        },
        {
            "artist": "Caribou",
            "title": "Never Come Back",
            "id": "2xxKJgIpgiancRpSup5dHU",
            "tempo": 128,
            "key": "F maj"
        },
        {
            "artist": "Dj Streaks",
            "title": "Greatest Love",
            "id": "3E0Kgz8U9vEY7kZG8rbKS1",
            "tempo": 127,
            "key": "Bb maj"
        },
        {
            "artist": "James Vincent McMorrow",
            "title": "I Should Go (feat. Kenny Beats) - Nic Fanciulli Remix",
            "id": "2bYfke1FMBPjcrozjz4wBq",
            "tempo": 128,
            "key": "A min"
        },
        {
            "artist": "Louis La Roche",
            "title": "Snstvty",
            "id": "0BUqmsbdo6NNrxrkw14e5g",
            "tempo": 120,
            "key": "Ab min"
        },
        {
            "artist": "Rhye",
            "title": "Black Rain - Jayda G Remix",
            "id": "2xvaAfj3UwqdVBUT7Y4scx",
            "tempo": 128,
            "key": "C maj"
        },
        {
            "artist": "Cosmo's Midnight",
            "title": "Titanic",
            "id": "0EUwAADV8ggf1CjB4uzZqE",
            "tempo": 102,
            "key": "F maj"
        },
        {
            "artist": "Umii",
            "title": "Dangerous",
            "id": "0aMn1LbfjyhZunY2K7oPLg",
            "tempo": 115,
            "key": "C min"
        },
        {
            "artist": "Ian Ewing",
            "title": "Riri Thick - Moods Remix",
            "id": "0xT4knFEialXamJIax97Yx",
            "tempo": 116,
            "key": "C# maj"
        },
        {
            "artist": "Castelle",
            "title": "See You There",
            "id": "4S0F00VeLl8ykdb9CRaESp",
            "tempo": 119,
            "key": "G min"
        },
        {
            "artist": "Jai Piccone",
            "title": "Care",
            "id": "7eT788aFqbLJNZbYf3QaJl",
            "tempo": 121,
            "key": "Ab maj"
        },
        {
            "artist": "The Undercover Dream Lovers",
            "title": "Chardonnay - Poolside Remix",
            "id": "64UvV0e3BwArToWazMVo9h",
            "tempo": 106,
            "key": "C min"
        },
        {
            "artist": "Poolside",
            "title": "Next To You",
            "id": "2M7fA5L6zH9oxq53WsaYB4",
            "tempo": 94,
            "key": "E min"
        },
        {
            "artist": "Jean Tonique",
            "title": "Something to Talk About",
            "id": "4UFyPeCWmb7yvth4dIL0xw",
            "tempo": 117,
            "key": "G min"
        },
        {
            "artist": "Jean Tonique",
            "title": "Take Control",
            "id": "1eT6DNF0mNMYGSn6lCy6SV",
            "tempo": 79,
            "key": "Ab maj"
        },
        {
            "artist": "Nicolaas",
            "title": "Never Too Late - Jean Tonique Remix",
            "id": "72XngRprcvlCVlv4Y0FCk4",
            "tempo": 115,
            "key": "Ab maj"
        },
        {
            "artist": "daste.",
            "title": "SOBER",
            "id": "15gUsLGaGz43tr2A4ILXFU",
            "tempo": 110,
            "key": "F# min"
        },
        {
            "artist": "Ninajirachi",
            "title": "Pure Luck (feat. Freya Staer)",
            "id": "5F9Td50J660cg3XgoNFzLN",
            "tempo": 180,
            "key": "B min"
        },
        {
            "artist": "Jarreau Vandal",
            "title": "Someone That You Love - Franc Moody Remix",
            "id": "0mb2iFADjXFYsZJ6lmTeIA",
            "tempo": 105,
            "key": "F# min"
        },
        {
            "artist": "Run The Jewels",
            "title": "JU$T (feat. Pharrell Williams & Zack de la Rocha) - Toy Selectah Remix",
            "id": "0qUJzbdCMh1RtnReloWUMh",
            "tempo": 133,
            "key": "Ab maj"
        },
        {
            "artist": "Fabich",
            "title": "Beach House",
            "id": "7Ix3p9gFRVLLRQFpxiN9oB",
            "tempo": 95,
            "key": "Ab maj"
        },
        {
            "artist": "Foster The People",
            "title": "Lamb's Wool (with Poolside)",
            "id": "2Kv2ihNE3KAztq2GWassEZ",
            "tempo": 89,
            "key": "B maj"
        },
        {
            "artist": "Majestique",
            "title": "Must Get There - Dubka Remix",
            "id": "4akabTDyDj0agFz8Jat7xM",
            "tempo": 118,
            "key": "G maj"
        },
        {
            "artist": "Jerry Folk",
            "title": "Slow",
            "id": "5QyHXXW3lUlVeoapWCXW2Y",
            "tempo": 108,
            "key": "G min"
        },
        {
            "artist": "Purple Disco Machine",
            "title": "Fireworks (feat. Moss Kena & The Knocks) - Breakbot & Irfane Remix",
            "id": "0DTmkoLOu7Q32o48ndII6V",
            "tempo": 118,
            "key": "Ab min"
        },
        {
            "artist": "warner case",
            "title": "ok",
            "id": "30j17PGHg0vmx4IgKpZsWu",
            "tempo": 122,
            "key": "C maj"
        },
        {
            "artist": "TOKiMONSTA",
            "title": "Naked",
            "id": "5dyFpHnCShXfEmDoKIg0J5",
            "tempo": 120,
            "key": "C# maj"
        },
        {
            "artist": "Biyo",
            "title": "pantone",
            "id": "10kHVbCpdjspXvhKIGhaYp",
            "tempo": 118,
            "key": "Bb min"
        },
        {
            "artist": "Elkka",
            "title": "Burnt Orange - Edit",
            "id": "1O73n53LZxJNLeGdhwChtt",
            "tempo": 122,
            "key": "B min"
        },
        {
            "artist": "Ross Quinn",
            "title": "So High - salute Remix",
            "id": "1IAIENjT9cwAlo3Grr2pCY",
            "tempo": 135,
            "key": "F min"
        },
        {
            "artist": "Armando Young",
            "title": "Loved Ones (Saudades)",
            "id": "5xHvxOGmmVWSo5CL27zFml",
            "tempo": 117,
            "key": "C# maj"
        },
        {
            "artist": "Anoraak",
            "title": "Fire Inside",
            "id": "52bquqZTybGrB2YhzCnez8",
            "tempo": 109,
            "key": "G maj"
        },
        {
            "artist": "CAPYAC",
            "title": "Creature of Desire",
            "id": "7fUI2T6Sx1EpMimBu9Xy81",
            "tempo": 113,
            "key": "C min"
        },
        {
            "artist": "Shook",
            "title": "Tonight",
            "id": "2aABK62Y0c34iWFPmkHfry",
            "tempo": 121,
            "key": "D min"
        },
        {
            "artist": "Yuksek",
            "title": "Break My Heart",
            "id": "03GDYRhbhzQp1Q9upftqpi",
            "tempo": 120,
            "key": "G min"
        },
        {
            "artist": "Ryan Cole",
            "title": "Somethin' Somethin'",
            "id": "0kPKdQrJV2tnXCAQD2h9Or",
            "tempo": 120,
            "key": "Bb maj"
        },
        {
            "artist": "LEFTI",
            "title": "Stand Up",
            "id": "2lzp4o3KojHuKUaNAnND6h",
            "tempo": 121,
            "key": "C maj"
        },
        {
            "artist": "Deena O",
            "title": "I'm In Love - Noce Remix",
            "id": "5TkJoL617ISCOLZdxJ1bs9",
            "tempo": 102,
            "key": "E min"
        },
        {
            "artist": "Dynamique",
            "title": "Ways of Love feat. Klory Starling - TEO remix",
            "id": "6GmBx0BPB0anvYZeePNx7r",
            "tempo": 105,
            "key": "F maj"
        },
        {
            "artist": "Indigo Eyes",
            "title": "Jaded",
            "id": "7l9u9r0IewXqHQfWYYu4nT",
            "tempo": 108,
            "key": "F# maj"
        },
        {
            "artist": "Elijah Fox",
            "title": "Barcelona",
            "id": "0p72li6MndeHXC1tsCsjgD",
            "tempo": 180,
            "key": "C# maj"
        },
        {
            "artist": "Crackazat",
            "title": "Waterfalls",
            "id": "1AJleS43X4yVpgXLgUkRvj",
            "tempo": 122,
            "key": "C min"
        },
        {
            "artist": "Parcels",
            "title": "Lightenup - Breakbot Remix",
            "id": "0M2Mt7RzKZb9LNRFbNulKO",
            "tempo": 123,
            "key": "F maj"
        },
        {
            "artist": "Kraak & Smaak",
            "title": "Don't Want This to Be Over - Jean Tonique Remix",
            "id": "0FHMBoChyeHGQcLzV90Mvv",
            "tempo": 106,
            "key": "B maj"
        },
        {
            "artist": "Kasbo",
            "title": "Found You",
            "id": "05IyD7K9Q4lgu8W4Xfi9Lx",
            "tempo": 180,
            "key": "C maj"
        },
        {
            "artist": "Charlotte Dos Santos",
            "title": "Away From You",
            "id": "5JiCeno6rEQWIpZKcFwrP1",
            "tempo": 100,
            "key": "D min"
        },
        {
            "artist": "Brijean",
            "title": "Hey Boy - DRAMA Remix",
            "id": "4idBrYWOnMfNQ3jqpFCanc",
            "tempo": 118,
            "key": "Bb min"
        },
        {
            "artist": "NASAYA",
            "title": "TEMPO",
            "id": "2IUFjc60BspwuMtmZaRSPW",
            "tempo": 124,
            "key": "D maj"
        },
        {
            "artist": "BIA",
            "title": "WHOLE LOTTA MONEY",
            "id": "5yorXJWdBan1Vlh116ZtQ7",
            "tempo": 81,
            "key": "C# maj"
        },
        {
            "artist": "Majid Jordan",
            "title": "Been Through That",
            "id": "2cZbLHnTKtdSYUsVYlrnSi",
            "tempo": 94,
            "key": "D min"
        },
        {
            "artist": "Snakehips",
            "title": "Run It Up",
            "id": "4Tla2jt77nO70DgGwFejbK",
            "tempo": 120,
            "key": "D maj"
        },
        {
            "artist": "Galantis",
            "title": "Dandelion",
            "id": "4NexTaCZZ7Ehnf03A6SVjt",
            "tempo": 118,
            "key": "C maj"
        },
        {
            "artist": "Polo & Pan",
            "title": "Magic",
            "id": "4XsrQYCU60mBHzjFVImgFf",
            "tempo": 111,
            "key": "G maj"
        },
        {
            "artist": "Dayglow",
            "title": "Close To You",
            "id": "4ReJJcpW8HtVnqzhf6DwNV",
            "tempo": 140,
            "key": "F# maj"
        },
        {
            "artist": "Poolside",
            "title": "I Feel High (with DRAMA)",
            "id": "0OEuPpfFyTP90MmfSua2np",
            "tempo": 113,
            "key": "D maj"
        },
        {
            "artist": "nimino",
            "title": "How You Holding Up",
            "id": "2OolzGY8DXkFiF0ZxasiSP",
            "tempo": 204,
            "key": "F# min"
        },
        {
            "artist": "Punctual",
            "title": "Addicted To You",
            "id": "3fTYP43eZyetLRxhaYpR4v",
            "tempo": 124,
            "key": "F# min"
        },
        {
            "artist": "1tbsp",
            "title": "Calico",
            "id": "2lJM9fK3zYQRXVXOTauwhZ",
            "tempo": 126,
            "key": "Ab maj"
        },
        {
            "artist": "Channel Tres",
            "title": "Sexy Black Timberlake - SG Lewis Remix",
            "id": "2eQfQs006dCFa9qEBPxbBK",
            "tempo": 119,
            "key": "A maj"
        },
        {
            "artist": "Tseba",
            "title": "Must Be Love (feat. Electric Fields)",
            "id": "4sVKF8qaWjwt9WatIfXAHU",
            "tempo": 122,
            "key": "F maj"
        },
        {
            "artist": "Satin Jackets",
            "title": "Think About It",
            "id": "5nlDPa9bBGnAvfUzUS0eq3",
            "tempo": 111,
            "key": "Ab maj"
        },
        {
            "artist": "Mel Blue",
            "title": "Yesterday",
            "id": "1l0cPiIm4i7AX7wukAP1GE",
            "tempo": 115,
            "key": "C maj"
        },
        {
            "artist": "Clear Mortifee",
            "title": "So Much More",
            "id": "3MdZDEWBG0EQVWSugxHEAH",
            "tempo": 114,
            "key": "G maj"
        },
        {
            "artist": "Slow Magic",
            "title": "Closer 2 U - Ukiyo Remix",
            "id": "2P56AzhY5sIktQy39qxkWN",
            "tempo": 116,
            "key": "E min"
        },
        {
            "artist": "Ryan Hemsworth",
            "title": "This Feeling",
            "id": "6JgsM60tGk5pfPijyMGEfU",
            "tempo": 114,
            "key": "B min"
        },
        {
            "artist": "Toro y Moi",
            "title": "Who I Am",
            "id": "7mMLKwFMq8STlXOBexSwqf",
            "tempo": 120,
            "key": "Ab maj"
        },
        {
            "artist": "Franc Moody",
            "title": "Let It Kick In",
            "id": "7GDX0yWYfixxWmbkjJVlSJ",
            "tempo": 120,
            "key": "E min"
        },
        {
            "artist": "Korey Wade",
            "title": "Keep the Spark Alive",
            "id": "4ortOUyHPtxAmM1T0xXEhZ",
            "tempo": 118,
            "key": "C# maj"
        },
        {
            "artist": "Koji Ono",
            "title": "Inner Rhythms",
            "id": "3uk9T5jf8jG2S9iXX6veyX",
            "tempo": 118,
            "key": "D maj"
        },
        {
            "artist": "Cool Company",
            "title": "Floatin'",
            "id": "4xWmsJ6aZCOJqYCCiIFdLR",
            "tempo": 98,
            "key": "B min"
        },
        {
            "artist": "Phairo",
            "title": "Pelican",
            "id": "0WCHiHxRqplja7YBhuuVeZ",
            "tempo": 117,
            "key": "Bb min"
        },
        {
            "artist": "Tentendo",
            "title": "Make Me High",
            "id": "3FyABxkdjGLbqAZFmOMQij",
            "tempo": 125,
            "key": "D min"
        },
        {
            "artist": "Chris Malinchak",
            "title": "Lore",
            "id": "0QswOQrUWKn93eOYBh6wWC",
            "tempo": 123,
            "key": "D maj"
        },
        {
            "artist": "Gilligan Moss",
            "title": "Slow Down",
            "id": "3963Fpo8sgV4xtYfllajVW",
            "tempo": 124,
            "key": "C maj"
        },
        {
            "artist": "Gilligan Moss",
            "title": "Slow Down",
            "id": "4fORxdaRkRYkA3Fn5JP1KT",
            "tempo": 124,
            "key": "C maj"
        },
        {
            "artist": "Jessie Ware",
            "title": "Hot N Heavy",
            "id": "3sIPjLfkLNnm8KLxR9aInw",
            "tempo": 120,
            "key": "F# min"
        },
        {
            "artist": "Mat Zo",
            "title": "Colours",
            "id": "22y2mqIBERBviZF0fa86iw",
            "tempo": 125,
            "key": "C# maj"
        },
        {
            "artist": "Masego",
            "title": "Yebo/Sema",
            "id": "7tFZNqsXf7ESFsT8pYd2RV",
            "tempo": 118,
            "key": "F min"
        },
        {
            "artist": "Yung Bae",
            "title": "Magic",
            "id": "6vvNdPCp4Zm37fnArWrgmH",
            "tempo": 118,
            "key": "F min"
        },
        {
            "artist": "Wave Racer",
            "title": "What Are We Waiting For?",
            "id": "5NiJueESUJfrgcamG9ZRPO",
            "tempo": 122,
            "key": "Ab maj"
        },
        {
            "artist": "My Brothers And I",
            "title": "When You're Ready - Tentendo Remix",
            "id": "4RkiPKxQlebFysLjXS6b3g",
            "tempo": 120,
            "key": "Bb min"
        },
        {
            "artist": "Raphael Futura",
            "title": "Heartbeat",
            "id": "3S0Of5onstYIDZQFaIVIwk",
            "tempo": 110,
            "key": "C min"
        },
        {
            "artist": "Snowk",
            "title": "This Is Good (feat. Miraa May)",
            "id": "155S4GydOrhSbmHtUXwVZu",
            "tempo": 105,
            "key": "C# min"
        },
        {
            "artist": "Mild Minds",
            "title": "FORMATIONS",
            "id": "350GZffkwwRXduUjD3pfu9",
            "tempo": 114,
            "key": "E min"
        },
        {
            "artist": "Bit Funk",
            "title": "Vertical Takeoff",
            "id": "6ycdv62AOFd8uJ7XAMndTn",
            "tempo": 108,
            "key": "Ab min"
        },
        {
            "artist": "Bad Colours",
            "title": "Feelin' Like",
            "id": "0mx1gpysb3usa8UsG40icX",
            "tempo": 112,
            "key": "Bb min"
        },
        {
            "artist": "Ark Patrol",
            "title": "Let Go - Robotaki Remix",
            "id": "7IcEtFBae7f3uNNZyy0ptv",
            "tempo": 150,
            "key": "G maj"
        },
        {
            "artist": "The Magician",
            "title": "Hippies (feat. Two Another)",
            "id": "6X6Czunvadm5759A96SjFD",
            "tempo": 121,
            "key": "C maj"
        },
        {
            "artist": "CAPYAC",
            "title": "Simultaneous",
            "id": "1MJIZ2l5YZ83EtqqbjmlvL",
            "tempo": 111,
            "key": "E min"
        },
        {
            "artist": "Sam Gellaitry",
            "title": "Assumptions",
            "id": "4NczzeHBQPPDO0B9AAmB8d",
            "tempo": 126,
            "key": "B maj"
        },
        {
            "artist": "What So Not",
            "title": "Trust - Plastic Plates Remix",
            "id": "2jdonhI9FKN7vFR1BSiDod",
            "tempo": 94,
            "key": "C# maj"
        },
        {
            "artist": "L'Impératrice",
            "title": "Voodoo?",
            "id": "4Ni2AUpC7d4M7nFMa3oquY",
            "tempo": 108,
            "key": "F# min"
        },
        {
            "artist": "L'Impératrice",
            "title": "Submarine",
            "id": "0QSlgbKl5MZW7AbjTbj8jw",
            "tempo": 114,
            "key": "E maj"
        },
        {
            "artist": "L'Impératrice",
            "title": "Agitations tropicales",
            "id": "2La21GqU4fKTQLcfLxTeoz",
            "tempo": 116,
            "key": "C# min"
        },
        {
            "artist": "Riva Starr",
            "title": "Ride This Sound (Pat Lok Remix)",
            "id": "4QgdmeWPqy7k45vAqZqUhb",
            "tempo": 126,
            "key": "Ab min"
        },
        {
            "artist": "Turbotito",
            "title": "To Feel In Love",
            "id": "27T4BesA3BmrPviZI2gFdD",
            "tempo": 92,
            "key": "G maj"
        },
        {
            "artist": "Jungle",
            "title": "Keep Moving - The Blessed Madonna remix / Edit",
            "id": "7wrW0eAXIEcKF6tgUXYNa7",
            "tempo": 126,
            "key": "Bb min"
        },
        {
            "artist": "NTEIBINT",
            "title": "Love Is Everywhere - Satin Jackets Remix",
            "id": "13u1tWCghqtXleLfUEbHNK",
            "tempo": 108,
            "key": "A min"
        },
        {
            "artist": "KAPPEKOFF",
            "title": "Why You - Funkin Matt Remix",
            "id": "0fiLUTuGIXt733mRVK1evp",
            "tempo": 120,
            "key": "G min"
        },
        {
            "artist": "SACHI",
            "title": "Enchanté - Phantoms Remix",
            "id": "2Xy7vD3rzZojXUYNtcrC3z",
            "tempo": 122,
            "key": "D min"
        },
        {
            "artist": "Miguel Migs",
            "title": "Misunderstood - Stripped & Salty Vocal",
            "id": "4ssMGbh1uwZNfz9dnTi6dO",
            "tempo": 120,
            "key": "E min"
        },
        {
            "artist": "Night Tales",
            "title": "Want",
            "id": "5gnOmuO3peV22Px4S9dK6a",
            "tempo": 118,
            "key": "Ab maj"
        },
        {
            "artist": "Kousto",
            "title": "The Job",
            "id": "08PYbuNnYryBc3EifUQoCk",
            "tempo": 123,
            "key": "F# min"
        },
        {
            "artist": "Aevion",
            "title": "Closer",
            "id": "2uRCNWP7u6JSo1ypJ7qJMx",
            "tempo": 115,
            "key": "C# min"
        },
        {
            "artist": "Jafunk",
            "title": "The Baddest",
            "id": "3ncpLDd2Jap0gWr1vXgosv",
            "tempo": 117,
            "key": "F min"
        },
        {
            "artist": "isle&fever",
            "title": "U Never Know",
            "id": "6ngfBeWnkydrBRrhqvxiXu",
            "tempo": 103,
            "key": "E min"
        },
        {
            "artist": "Jazmine Sullivan",
            "title": "Price Tags (feat. Anderson .Paak) - kryptogram Remix",
            "id": "417n6UbUWOdel5iXcROCd0",
            "tempo": 119,
            "key": "F# maj"
        },
        {
            "artist": "Jamiroquai",
            "title": "Cosmic Girl - Dimitri from Paris Remix",
            "id": "5vujFdzIo1IVZHHYfMvUNo",
            "tempo": 120,
            "key": "C# min"
        },
        {
            "artist": "CHEBO",
            "title": "Tonight",
            "id": "4BerEwKV2FDiw50F7014Ik",
            "tempo": 115,
            "key": "G maj"
        },
        {
            "artist": "Ayzon",
            "title": "YOU CAN DO IT",
            "id": "4hQjxwio9Crkg5uN10fxuv",
            "tempo": 120,
            "key": "G maj"
        },
        {
            "artist": "Satin Jackets",
            "title": "Girl, Forever",
            "id": "4Gwa9KIlsUOvgqcVopzJRV",
            "tempo": 111,
            "key": "A min"
        },
        {
            "artist": "Satin Jackets",
            "title": "So I Heard",
            "id": "7fbrktqR8WKYWb8riSmBQo",
            "tempo": 105,
            "key": "C min"
        },
        {
            "artist": "Doja Cat",
            "title": "Kiss Me More (feat. SZA)",
            "id": "748mdHapucXQri7IAO8yFK",
            "tempo": 111,
            "key": "Ab maj"
        },
        {
            "artist": "DRAMA",
            "title": "Give No Fucks - Justin Martin Remix",
            "id": "5Vw30WcvOvopojvM2vhoVh",
            "tempo": 123,
            "key": "B min"
        },
        {
            "artist": "Dugong Jr",
            "title": "Slow It Down (feat. Jordan Dennis)",
            "id": "5S3nUmVLBUNFDGYzMXF7Hx",
            "tempo": 110,
            "key": "A maj"
        },
        {
            "artist": "Jungle",
            "title": "Beat 54 (All Good Now)",
            "id": "1bWvNgH2N0LprU8Z9hzUUD",
            "tempo": 106,
            "key": "D maj"
        },
        {
            "artist": "Satin Jackets",
            "title": "Northern Lights",
            "id": "43IlJpP6BV65PXadzJ3CwM",
            "tempo": 111,
            "key": "F maj"
        },
        {
            "artist": "KLOUD",
            "title": "VIRUS (Odd Mob Remix)",
            "id": "3BBtBgwmSXmcJgbTKiB4ap",
            "tempo": 126,
            "key": "C# maj"
        },
        {
            "artist": "Remi Wolf",
            "title": "Disco Man - Little Dragon Remix",
            "id": "6sYNjDSlD5Tjx1cmwK6TBO",
            "tempo": 85,
            "key": "F# min"
        },
        {
            "artist": "Mike Mago",
            "title": "Smells Good",
            "id": "3XEYQpuxWEjTapRLZpIwF4",
            "tempo": 126,
            "key": "F min"
        },
        {
            "artist": "ROMderful",
            "title": "Free As A Bird",
            "id": "53s2IQej3rsf8duK8gb4QC",
            "tempo": 87,
            "key": "G maj"
        },
        {
            "artist": "chaz",
            "title": "Don't Text Me",
            "id": "4AzAlLyr7QqxLfJwqLJOtC",
            "tempo": 112,
            "key": "F# min"
        },
        {
            "artist": "Whethan",
            "title": "Sunshine (with The Knocks)",
            "id": "2jokLd93nobhAlHcWiGusC",
            "tempo": 122,
            "key": "G maj"
        },
        {
            "artist": "ROMES",
            "title": "All The Time",
            "id": "2VD6mTF7u2UFfAKrg4pRgX",
            "tempo": 120,
            "key": "C# maj"
        },
        {
            "artist": "POOLCLVB",
            "title": "Shooting Stars",
            "id": "3j4Q0OcxYgvJYev93mevxz",
            "tempo": 120,
            "key": "F# min"
        },
        {
            "artist": "Poolside",
            "title": "Getting There From Here (with Todd Edwards) – Miami Horror & Lazywax Remix",
            "id": "4Hi4wA1Mn6TQ3jrF7uQAci",
            "tempo": 112,
            "key": "A min"
        },
        {
            "artist": "CHIC",
            "title": "I Want Your Love - Stonebridge Mix",
            "id": "6oRHXZpfn10q93kErLiDmJ",
            "tempo": 121,
            "key": "A min"
        },
        {
            "artist": "Umii",
            "title": "Not Alone (Danny Dwyer Remix)",
            "id": "1DfSMwomwQzfHh3KSXd6Pr",
            "tempo": 94,
            "key": "F min"
        },
        {
            "artist": "Goldroom",
            "title": "Everybody's Lonely",
            "id": "0iOxWUTNUqTdPnXiVmKkT4",
            "tempo": 116,
            "key": "G min"
        },
        {
            "artist": "Kartell",
            "title": "AWAKEN",
            "id": "0k1fodghuD7tnthBqLtzwk",
            "tempo": 110,
            "key": "C# maj"
        },
        {
            "artist": "Doja Cat",
            "title": "Streets - Disclosure Remix",
            "id": "4k6Emp6KJ4GNRyf6wUKODl",
            "tempo": 118,
            "key": "D maj"
        },
        {
            "artist": "Le Youth",
            "title": "Walk Away",
            "id": "35Z3y7yRsLAzX91hO2C2sC",
            "tempo": 118,
            "key": "G maj"
        },
        {
            "artist": "Midnight Magic",
            "title": "I Gotta Feeling",
            "id": "6HYPHFaCupsJyET9rTDuVo",
            "tempo": 119,
            "key": "C maj"
        },
        {
            "artist": "Aeroplane",
            "title": "Love On Hold (feat. Tawatha Agee)",
            "id": "04pnOy580O0I2Htn3VT9b3",
            "tempo": 115,
            "key": "F min"
        },
        {
            "artist": "LUXXURY",
            "title": "Feel The Night",
            "id": "1m305EwDHOk0iIw6w1kOYB",
            "tempo": 120,
            "key": "G maj"
        },
        {
            "artist": "Busta Rhymes",
            "title": "The Don & The Boss - KAYTRANADA Remix",
            "id": "2RDqjfQ2tmmDJpYWkhXJ7K",
            "tempo": 112,
            "key": "Bb min"
        },
        {
            "artist": "Victoria Monét",
            "title": "New Love",
            "id": "1KARZZIAZxCCiUpLD7Wv4D",
            "tempo": 101,
            "key": "Bb min"
        },
        {
            "artist": "Ariana Grande",
            "title": "MONOPOLY (with Victoria Monét)",
            "id": "6tsOcBnaKgzK22yEiqRh8P",
            "tempo": 144,
            "key": "C maj"
        },
        {
            "artist": "Victoria Monét",
            "title": "Experience",
            "id": "2oap3QptGISyIvwKpnJJId",
            "tempo": 112,
            "key": "A maj"
        },
        {
            "artist": "Stevedreez",
            "title": "Smoking Section",
            "id": "3YYSTOsem7yFoAU7QqeRkP",
            "tempo": 103,
            "key": "F# min"
        },
        {
            "artist": "Touch Sensitive",
            "title": "Perfume",
            "id": "1d6TktLS0xOjZywxJ6BRxV",
            "tempo": 108,
            "key": "C maj"
        },
        {
            "artist": "Inner State 81",
            "title": "Honey Eye",
            "id": "5ljvcERlitTM6VPFvCzhLW",
            "tempo": 80,
            "key": "B min"
        },
        {
            "artist": "Rabo De Saia",
            "title": "Ripa Na Xulipa - Extended Charles Maurice Version",
            "id": "7sepjx5LqGAp7lVsjmYsFK",
            "tempo": 119,
            "key": "D maj"
        },
        {
            "artist": "Roosevelt",
            "title": "Echoes",
            "id": "3w0PoZcluoJetM1ygo0c8A",
            "tempo": 124,
            "key": "C# maj"
        },
        {
            "artist": "Mogul",
            "title": "Mixed Messages",
            "id": "2PeMqzto6dz8TTOkOAKBlh",
            "tempo": 112,
            "key": "F min"
        },
        {
            "artist": "Namy",
            "title": "Disco Dancing (feat. Ayoni) - Lazywax Remix",
            "id": "0lAz0LS3LhreVvWy58Sdo9",
            "tempo": 118,
            "key": "Bb min"
        },
        {
            "artist": "French Braids",
            "title": "Legend",
            "id": "1zabe8PVAoBuXV2SEX1vHh",
            "tempo": 113,
            "key": "C maj"
        },
        {
            "artist": "Dj Streaks",
            "title": "The Best Rapper Alive",
            "id": "4tPQDofr1qmip4bbWFs9Qf",
            "tempo": 126,
            "key": "G maj"
        },
        {
            "artist": "Tom Misch",
            "title": "What Kinda Music - Jordan Rakei Remix",
            "id": "0FMgzGbCh8yNMibGY5L2cM",
            "tempo": 115,
            "key": "Bb min"
        },
        {
            "artist": "Kito",
            "title": "Recap (with VanJess & Channel Tres)",
            "id": "2m3RjRXib3un5AEh08k8Fe",
            "tempo": 115,
            "key": "B min"
        },
        {
            "artist": "Two Another",
            "title": "Feeling Free - With Pretty Boy Aaron",
            "id": "70y34niYNRbQGqvwf0eRgr",
            "tempo": 115,
            "key": "F min"
        },
        {
            "artist": "Miami Horror",
            "title": "Emagination - B-Side",
            "id": "1lqnXDtm2nEjJwBF0DnvfS",
            "tempo": 125,
            "key": "C min"
        },
        {
            "artist": "Jerry Folk",
            "title": "Low",
            "id": "5SBlfw8rNCcerJxbNUGxue",
            "tempo": 86,
            "key": "A min"
        },
        {
            "artist": "Les Loups",
            "title": "Enough - Feiertag Remix",
            "id": "2AnmcqWvJj6YdmWMxmpJwE",
            "tempo": 122,
            "key": "C min"
        },
        {
            "artist": "Bickle",
            "title": "Naked",
            "id": "5Vth7eImumlAyhsW8PqqAM",
            "tempo": 126,
            "key": "C# maj"
        },
        {
            "artist": "Blood Orange",
            "title": "Charcoal Baby",
            "id": "3bBmpVl9rQKJsFFGLFilIS",
            "tempo": 183,
            "key": "G min"
        },
        {
            "artist": "Mija",
            "title": "Gypsy Woman (She's Homeless) [House Kitsuné America]",
            "id": "2ZL0cFicHe5xM38lqxXFps",
            "tempo": 122,
            "key": "A min"
        },
        {
            "artist": "Shallou",
            "title": "Truth",
            "id": "0C7sbRykiD9VGrz1rXmv0T",
            "tempo": 104,
            "key": "B maj"
        },
        {
            "artist": "Sherwyn",
            "title": "Off You",
            "id": "3b2pfV1sGo8ni5lhF6IQRM",
            "tempo": 115,
            "key": "G maj"
        },
        {
            "artist": "Private Agenda",
            "title": "Instinct",
            "id": "1o7o7ZGGfUETsjfOMCrGB5",
            "tempo": 94,
            "key": "C# maj"
        },
        {
            "artist": "Kasket Club",
            "title": "Miles Away",
            "id": "47DfpIKV6weaEKVgo0Y6wH",
            "tempo": 102,
            "key": "C min"
        },
        {
            "artist": "Vanilla",
            "title": "Turn Me Loose",
            "id": "6iSE6SQWvO7Sm1dg7my6oY",
            "tempo": 108,
            "key": "C min"
        },
        {
            "artist": "Adeline",
            "title": "After Midnight - Kraak & Smaak Remix",
            "id": "1u5yiXTZcwbwEDWeisR8q5",
            "tempo": 120,
            "key": "Ab maj"
        },
        {
            "artist": "Knox Brown",
            "title": "FLEX",
            "id": "2OJAJkXXfuNHLElpkteLCk",
            "tempo": 100,
            "key": "F# min"
        },
        {
            "artist": "Kimbra",
            "title": "I Look to You (feat. Kimbra) - Franc Moody Remix",
            "id": "64lDdI6emxdpv1zJmga87N",
            "tempo": 118,
            "key": "G maj"
        },
        {
            "artist": "Yuksek",
            "title": "The Only Reason",
            "id": "1QNDO3MwgnruqQiTkLubFI",
            "tempo": 208,
            "key": "Bb maj"
        },
        {
            "artist": "Courage",
            "title": "Long Way Up",
            "id": "4QLNLQoDhnY5bjvO3iDDyX",
            "tempo": 170,
            "key": "Eb min"
        },
        {
            "artist": "Kraak & Smaak",
            "title": "Twilight - Aeroplane Remix",
            "id": "3SGjKTyvOAZTY8HRpUaOvQ",
            "tempo": 122,
            "key": "A min"
        },
        {
            "artist": "SG Lewis",
            "title": "One More (feat. Nile Rodgers)",
            "id": "5bZlKUqFIf0uM3MW03bhlG",
            "tempo": 120,
            "key": "F min"
        },
        {
            "artist": "Miami Horror",
            "title": "Luv Is Not Enough (feat. Clear Mortifee) - Cabu Remix",
            "id": "07gCFVEn7e2h2bdN0RxFxR",
            "tempo": 114,
            "key": "C# min"
        },
        {
            "artist": "CAPYAC",
            "title": "Alright",
            "id": "5DDTfsOUB1LVbha1Zjy7r3",
            "tempo": 115,
            "key": "Bb min"
        },
        {
            "artist": "Jengi",
            "title": "Get Down",
            "id": "6XbXmwYo3ly2rUeXQSRa56",
            "tempo": 118,
            "key": "F min"
        },
        {
            "artist": "Lewis OfMan",
            "title": "Attitude",
            "id": "0DPenz1hSSH4O8PXyEaggl",
            "tempo": 101,
            "key": "B min"
        },
        {
            "artist": "Tuxedo",
            "title": "The Right Time (Jean Tonique Remix)",
            "id": "5qf4x3K8Qv33uGIaWNjndC",
            "tempo": 119,
            "key": "A maj"
        },
        {
            "artist": "Goldroom",
            "title": "U",
            "id": "702C2RiojKSUzBvp6rwdHC",
            "tempo": 122,
            "key": "C# maj"
        },
        {
            "artist": "jackLNDN",
            "title": "Drop Out",
            "id": "5N9JftycaePdP6024l7uEB",
            "tempo": 122,
            "key": "Ab min"
        },
        {
            "artist": "Zacari",
            "title": "Foggy Windows",
            "id": "0eWxDnXDbsR4h1kVk6rZdy",
            "tempo": 114,
            "key": "Bb min"
        },
        {
            "artist": "SG Lewis",
            "title": "Coming Up",
            "id": "21p0edNF107qz1uPc9F7EK",
            "tempo": 105,
            "key": "B min"
        },
        {
            "artist": "Sunni Colón",
            "title": "Feel4U",
            "id": "1dcnVMj2kEIChuHnae5PMp",
            "tempo": 113,
            "key": "C# maj"
        },
        {
            "artist": "Cosmo's Midnight",
            "title": "Polarised",
            "id": "7qjuiTw148Qqxh544oniQe",
            "tempo": 112,
            "key": "A min"
        },
        {
            "artist": "Latroit",
            "title": "Hungover",
            "id": "5qSbxxwtFKH5XA85ixQP2V",
            "tempo": 120,
            "key": "Ab min"
        },
        {
            "artist": "Kyson",
            "title": "Every High - Young & Sick in-Flight Remix",
            "id": "0b8llsVuNdqBiXloRSKsVg",
            "tempo": 120,
            "key": "Bb min"
        },
        {
            "artist": "Kraak & Smaak",
            "title": "Naked - Georges Remix",
            "id": "0wGTFEi44dM2oAIUi5xHir",
            "tempo": 104,
            "key": "E min"
        },
        {
            "artist": "Mura Masa",
            "title": "Firefly",
            "id": "2s9C5THb9llwyVXtjveV4E",
            "tempo": 110,
            "key": "Bb maj"
        },
        {
            "artist": "The Avalanches",
            "title": "Interstellar Love",
            "id": "4PUGAmAvt5VxbbefkhV0x5",
            "tempo": 116,
            "key": "D maj"
        },
        {
            "artist": "Anoraak",
            "title": "Gang",
            "id": "4nMEzMTIfUVlhZzuP2Em5V",
            "tempo": 106,
            "key": "D min"
        },
        {
            "artist": "Daniel T.",
            "title": "Windy Lady - Turbotito Remix",
            "id": "4WQllP6JUK7i5f6yQSQCqM",
            "tempo": 105,
            "key": "A maj"
        },
        {
            "artist": "High Klassified",
            "title": "Ns Bounce",
            "id": "6wUuMSgi7CVstyIr68xIFo",
            "tempo": 113,
            "key": "C maj"
        },
        {
            "artist": "Social Lovers",
            "title": "Drop Me A Line",
            "id": "1MhOWHOOgbcD0Ef9KBdOzH",
            "tempo": 116,
            "key": "F# min"
        },
        {
            "artist": "Mr. Fingers",
            "title": "Praise to the Vibes - Mr. Fingers Alternate Version",
            "id": "51MvFPygVSJQHeleNBmo8o",
            "tempo": 116,
            "key": "Ab min"
        },
        {
            "artist": "TOKiMONSTA",
            "title": "Get Me Some",
            "id": "54bJVMbRyGmVHWslFpU4nK",
            "tempo": 117,
            "key": "C# maj"
        },
        {
            "artist": "Hot Chip",
            "title": "Spell",
            "id": "2yhKDrTVMCLBWYd0aIfOfy",
            "tempo": 122,
            "key": "C min"
        },
        {
            "artist": "Little Dragon",
            "title": "The Other Lover (Little Dragon & Moses Sumney)",
            "id": "3U12nxwFolQ6hsG6zcyEqc",
            "tempo": 162,
            "key": "Eb maj"
        },
        {
            "artist": "Young Franco",
            "title": "Miss You",
            "id": "3MRuglRyXY8EbGzUj7FAUx",
            "tempo": 115,
            "key": "F maj"
        },
        {
            "artist": "BAYNK",
            "title": "go with u",
            "id": "4PdLup4OaCGktZG8cvbkBz",
            "tempo": 109,
            "key": "C# min"
        },
        {
            "artist": "Anderson .Paak",
            "title": "Lite Weight (feat. The Free Nationals United Fellowship Choir)",
            "id": "2vJIsdYIthbnWgLaLD9yrj",
            "tempo": 120,
            "key": "Ab min"
        },
        {
            "artist": "Dbow",
            "title": "Get Involved - Director's Cut Classic House Mix",
            "id": "65MB7hOKVj7MLGD8LGKRZO",
            "tempo": 125,
            "key": "C# maj"
        },
        {
            "artist": "Jungle",
            "title": "Beat 54 - Krystal Klear 12\" Mix",
            "id": "1YvPha8501VatLuzsR9Gj7",
            "tempo": 115,
            "key": "B min"
        },
        {
            "artist": "Jarami",
            "title": "Bahía",
            "id": "5LGcwHXNb6yoK5MuKRjM8d",
            "tempo": 107,
            "key": "B min"
        },
        {
            "artist": "Marco Faraone",
            "title": "Armaghetton - Aeroplane Remix",
            "id": "7K0NRDpluahVsxekmJ3ufu",
            "tempo": 119,
            "key": "F maj"
        },
        {
            "artist": "Bakai",
            "title": "Under Those Trees",
            "id": "65tyqaj5gmXxzzaeMapqEL",
            "tempo": 110,
            "key": "E min"
        },
        {
            "artist": "Tycho",
            "title": "For How Long - Harvey Sutherland Remix",
            "id": "3xtaMLzfZDkF3tTYvq6A1r",
            "tempo": 128,
            "key": "C# min"
        },
        {
            "artist": "Megan Thee Stallion",
            "title": "Body",
            "id": "0A1hoCfMLkiAgvhWkkucJa",
            "tempo": 94,
            "key": "Ab min"
        },
        {
            "artist": "Yuna",
            "title": "Pink Youth",
            "id": "6XhnayiqvBCpmzTvbb0bMr",
            "tempo": 113,
            "key": "F# min"
        },
        {
            "artist": "iamalex",
            "title": "Friend Zone",
            "id": "5PUeCNJwsLNRRMXIft3lIM",
            "tempo": 78,
            "key": "G maj"
        },
        {
            "artist": "Saint Pepsi",
            "title": "We Belong Together",
            "id": "6OxxJOWzxftaKBocVrBRnZ",
            "tempo": 127,
            "key": "C# maj"
        },
        {
            "artist": "Sally Green",
            "title": "Deja Vu",
            "id": "6fgcoGF6moPUdCY1DVSaNW",
            "tempo": 116,
            "key": "C# maj"
        },
        {
            "artist": "Disclosure",
            "title": "Watch Your Step (Harvey Sutherland Remix)",
            "id": "3yjN1QyJncu2e7jm8jSR4g",
            "tempo": 123,
            "key": "E min"
        },
        {
            "artist": "SG Lewis",
            "title": "Feed The Fire",
            "id": "79kboDrbvAf0OUqJvKUudi",
            "tempo": 122,
            "key": "G maj"
        },
        {
            "artist": "Bosq",
            "title": "Can't Seem to Hide",
            "id": "6FL889fKz4f4ekhX6pcrUk",
            "tempo": 121,
            "key": "F# min"
        },
        {
            "artist": "SG Lewis",
            "title": "Aura",
            "id": "4qEEERg5kM60N2vcna11oq",
            "tempo": 117,
            "key": "E min"
        },
        {
            "artist": "kenzie",
            "title": "Donuts (feat. Yung Bae)",
            "id": "2xubfBD4QUOmcMUq1EZz6h",
            "tempo": 108,
            "key": "A min"
        },
        {
            "artist": "Archr",
            "title": "She Mindful",
            "id": "3uB2cfbGsoLa8CYzNCNp8N",
            "tempo": 130,
            "key": "C# maj"
        },
        {
            "artist": "Genesis Owusu",
            "title": "Vultures",
            "id": "7ehHEilN0sRlAH8BnZPgZl",
            "tempo": 83,
            "key": "B min"
        },
        {
            "artist": "Genesis Owusu",
            "title": "WUTD",
            "id": "6WuoAqaiIfhgA4ftXLFiX5",
            "tempo": 104,
            "key": "E min"
        },
        {
            "artist": "Harry Nathan",
            "title": "High",
            "id": "7cM8ovLTjCup48oQ8crgVA",
            "tempo": 118,
            "key": "F# maj"
        },
        {
            "artist": "AlunaGeorge",
            "title": "Kaleidoscope Love - Kaytranada Edition",
            "id": "0eTX0DeAdYZGCUIpUNNbLw",
            "tempo": 115,
            "key": "E min"
        },
        {
            "artist": "GRAACE",
            "title": "21st Century Love - Douvelle19 Remix",
            "id": "4Kr86ACbSArSaGwOqXhbWh",
            "tempo": 124,
            "key": "D min"
        },
        {
            "artist": "Fresh Mode",
            "title": "The Vibe (feat. FUEG)",
            "id": "1KQB30IDcuG2cnNJh7UGH6",
            "tempo": 121,
            "key": "C maj"
        },
        {
            "artist": "Jessie Ware",
            "title": "Mirage (Don’t Stop)",
            "id": "5CZ53WFltsPPyLmx34QJwh",
            "tempo": 113,
            "key": "B min"
        },
        {
            "artist": "Change",
            "title": "The Glow of Love",
            "id": "2tpRtiVvuI4WnwpPYwk9Z6",
            "tempo": 118,
            "key": "E min"
        },
        {
            "artist": "SG Lewis",
            "title": "Feed The Fire (feat. Lucky Daye)",
            "id": "0yU8ftsMI0LDMtee8TDsDR",
            "tempo": 122,
            "key": "G maj"
        },
        {
            "artist": "Mix Chopin",
            "title": "Friends With Benefits",
            "id": "5GpvSdoj5FxTRIuB3YcZ96",
            "tempo": 116,
            "key": "Bb min"
        },
        {
            "artist": "Channel Tres",
            "title": "skate depot",
            "id": "5L9q6ezwkinZ47fUwj2Jfl",
            "tempo": 124,
            "key": "C maj"
        },
        {
            "artist": "Big Words",
            "title": "TTYDTM",
            "id": "7pIREk1eDQpjTw5N9PMVJk",
            "tempo": 106,
            "key": "G maj"
        },
        {
            "artist": "PREP",
            "title": "Who's Got You Singing Again",
            "id": "6zeS1N6ls8cG4TMablZtFu",
            "tempo": 118,
            "key": "C maj"
        },
        {
            "artist": "PREP",
            "title": "Cheapest Flight",
            "id": "7yj6i3TaFhBvxbLGejrvfw",
            "tempo": 80,
            "key": "F min"
        },
        {
            "artist": "Men I Trust",
            "title": "Norton Commander (Album V)",
            "id": "0DltZY7z8YvuDBSAbsIgPc",
            "tempo": 166,
            "key": "C# maj"
        },
        {
            "artist": "Men I Trust",
            "title": "Tailwhip (Album V)",
            "id": "3rRAR3YHRFShjEaHP0o9Xi",
            "tempo": 114,
            "key": "A min"
        },
        {
            "artist": "Bea Miller",
            "title": "FEEL SOMETHING DIFFERENT",
            "id": "5Q4UX8hxcaJEtAE9RtsmSY",
            "tempo": 125,
            "key": "C maj"
        },
        {
            "artist": "Engelwood",
            "title": "Tasty Jam",
            "id": "6smHuWvMAMQfVO855qtTDw",
            "tempo": 192,
            "key": "G maj"
        },
        {
            "artist": "Elohim",
            "title": "Good Day Bad Day - Snakehips Remix",
            "id": "6eJEvusOC02GMOArociVqe",
            "tempo": 118,
            "key": "C# maj"
        },
        {
            "artist": "Mike Dunn",
            "title": "Have It 4 U Babe (feat. Jass Mann) - Extended MixX",
            "id": "0EwQzledAlRhMl79C1PnvP",
            "tempo": 125,
            "key": "C# min"
        },
        {
            "artist": "Channel Tres",
            "title": "Brilliant Nigga",
            "id": "0R43dXnNgF209Ygdgct0fP",
            "tempo": 119,
            "key": "C# maj"
        },
        {
            "artist": "Anderson .Paak",
            "title": "Lite Weight",
            "id": "3MANUf7LqfyIw7f9lPQf0l",
            "tempo": 120,
            "key": "Ab min"
        },
        {
            "artist": "James Vincent McMorrow",
            "title": "Get Low",
            "id": "0R4ZIyB0wMl4rVN8MLZsbk",
            "tempo": 75,
            "key": "A min"
        },
        {
            "artist": "Goldroom",
            "title": "Till Sunrise (feat. Mammals)",
            "id": "1pnwoWbZcS77Dx0jQVYK8X",
            "tempo": 84,
            "key": "C maj"
        },
        {
            "artist": "Goldroom",
            "title": "Silhouette",
            "id": "4Vdbb7QK3czCJVdfxOBbCZ",
            "tempo": 115,
            "key": "C maj"
        },
        {
            "artist": "Alina Baraz",
            "title": "Morocco (feat. 6LACK) - Devault Remix",
            "id": "5kaDI9LykHWbLUqaFIuYMo",
            "tempo": 88,
            "key": "F# min"
        },
        {
            "artist": "BAYNK",
            "title": "go with u - Louis La Roche Remix",
            "id": "5FxcDJENpjWY6lL9CnbHgc",
            "tempo": 112,
            "key": "C# min"
        },
        {
            "artist": "Pastel",
            "title": "Until the End",
            "id": "2z8vXzBhv7psCBgYbEjbLZ",
            "tempo": 110,
            "key": "A min"
        },
        {
            "artist": "Wilma Archer",
            "title": "Like A Hunger",
            "id": "7lgZSvDebog8YgblEudPYA",
            "tempo": 100,
            "key": "F# min"
        },
        {
            "artist": "Werkha",
            "title": "Favourite Corner",
            "id": "6cv12CVQrwaK8X4C7MmxXj",
            "tempo": 124,
            "key": "G maj"
        },
        {
            "artist": "Tame Impala",
            "title": "Borderline - Blood Orange Remix",
            "id": "7IbGa7PhnXHvUOvhELtGgL",
            "tempo": 174,
            "key": "Bb min"
        },
        {
            "artist": "Goldroom",
            "title": "I Can Feel It",
            "id": "2Pe8kPCiJSI363uO0Q4eB2",
            "tempo": 124,
            "key": "G min"
        },
        {
            "artist": "Baird",
            "title": "Chasing Deer",
            "id": "1WcHoYYPnlVYoaOE24aBL6",
            "tempo": 120,
            "key": "E min"
        },
        {
            "artist": "Sticks & Stonez",
            "title": "You're My",
            "id": "5ulWUXo2mV3xy2PzzuVTuB",
            "tempo": 111,
            "key": "D maj"
        },
        {
            "artist": "Catz 'n Dogz",
            "title": "Good Touch - Maurice Fulton Remix",
            "id": "0We5TGc7c66ugaLgCWAg3k",
            "tempo": 113,
            "key": "B min"
        },
        {
            "artist": "Channel Tres",
            "title": "Topdown",
            "id": "56dDonzTxrZKWuVDqUOYGd",
            "tempo": 120,
            "key": "C# maj"
        },
        {
            "artist": "Jean Tonique",
            "title": "Open Market - Louis La Roche Remix",
            "id": "1zqW5Hf0df7AJrvVLse1pG",
            "tempo": 111,
            "key": "G min"
        },
        {
            "artist": "iamalex",
            "title": "1998",
            "id": "7grSj8rFpBJEoxqZFRO0K6",
            "tempo": 122,
            "key": "Eb min"
        },
        {
            "artist": "Robyn",
            "title": "Ever Again - Soulwax Remix",
            "id": "5zcDts5QaOLEXH2Q5RI1JX",
            "tempo": 120,
            "key": "E min"
        },
        {
            "artist": "Phairo",
            "title": "Celadon",
            "id": "4OVyOzLlwbiPLxRAlnuM87",
            "tempo": 118,
            "key": "F# min"
        },
        {
            "artist": "Euføeni",
            "title": "Avocado Pop",
            "id": "5yE0FS5xIEaiuMH7bv6Uqs",
            "tempo": 120,
            "key": "F min"
        },
        {
            "artist": "Young Franco",
            "title": "Two Feet",
            "id": "7umNx2x8ve6JGZSZOUw9xU",
            "tempo": 106,
            "key": "B min"
        },
        {
            "artist": "TOKiMONSTA",
            "title": "Get Me Some - AC Slater Remix",
            "id": "069pvWyJuhdaNKMGkwSlHS",
            "tempo": 128,
            "key": "A min"
        },
        {
            "artist": "Mura Masa",
            "title": "helpline (feat. Tom Tripp)",
            "id": "69KwifIzigF2uIn2GuAnCE",
            "tempo": 95,
            "key": "G maj"
        },
        {
            "artist": "Dj Streaks",
            "title": "Greatest Love - Edit",
            "id": "6wmtEikDlY2JbV0nlrscxy",
            "tempo": 127,
            "key": "Bb maj"
        },
        {
            "artist": "Roosevelt",
            "title": "Echoes",
            "id": "6EIfJylePExknqICZx8Uxi",
            "tempo": 124,
            "key": "C# maj"
        },
        {
            "artist": "Model Man",
            "title": "Why?",
            "id": "5r4zBVQFYh2JKcpr1Tjdmg",
            "tempo": 121,
            "key": "F maj"
        },
        {
            "artist": "Sushi + Kash",
            "title": "Shatter",
            "id": "131Ke96HBGDpEh67GBifQh",
            "tempo": 120,
            "key": "C min"
        },
        {
            "artist": "GoldLink",
            "title": "Palm Trees - Motez Remix",
            "id": "1Z5B5x1vsgwmR6M4B8ndwU",
            "tempo": 113,
            "key": "D maj"
        }
      ]
    }),
  }
</script>
