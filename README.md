# Mausam: Personalized Weather App

A 4-member class project: a mobile-first weather app that adapts to each person. It
has a personalized homepage, a live radar map, Farm and Health hubs, journey and
event planning, and community weather reports on its own backend.

This is a student prototype. It is not an official India Meteorological Department
(IMD) product, and its alerts are not official warnings.

## Run it

You need [Node.js](https://nodejs.org) 22 or newer. There is nothing to install.

```bash
npm start
```

Then open http://localhost:4173. On a laptop you get a dashboard layout. For the
phone layout in Chrome or Edge, press F12 and turn on the device toolbar.

To use the app on phones on the same Wi-Fi, so everyone can post community reports:

```bash
HOST=0.0.0.0 npm start
```

On Windows PowerShell, use this instead:

```powershell
$env:HOST='0.0.0.0'; npm start
```

Then open `http://<your-laptop-ip>:4173` on the phone. To demo without internet, add
`?demo` to the address. This uses clearly labelled sample data, and the map and live
searches will not work.

## Run the tests

```bash
npm test
```

## The four modules

Each member owns one module. The names below are placeholders for your team.

| Member | Module | Main files |
|---|---|---|
| Member 1 | Home and personalization | `cards.js`, `insights.js`, `personas.js`, `lifestyle.js`, `astro.js`, `sky.js`, `voice.js`, `share.js` |
| Member 2 | Maps, data and climate | `api.js`, `screen-map.js`, `charts.js`, `climate.js`, compare and climate in `screen-plan.js` |
| Member 3 | Farm and Health hubs | `farm.js`, `screen-farm.js`, `health.js`, `screen-health.js` |
| Member 4 | Planning, community and backend | `trip.js`, best day and trip in `screen-plan.js`, `screen-community.js`, `achievements.js`, `server.js`, `server/reports.js` |

The app shell (`main.js`, `app.css`, `i18n.js`, `sw.js`) is shared by everyone.

## Features

**Home**
- Animated sky that follows the real weather: rain, stars, clouds, fog and lightning
- A one-line summary of the day, and a greeting by name
- Daily briefing read aloud in English or Hindi
- What to wear and carry
- Scores for eight activities, such as cricket, drying clothes and stargazing
- Next 24 hours with temperature, rain, wind and humidity views, and parts of the day
- 14-day forecast, with tap-for-detail on any day
- Moon phase, daylight and golden hour
- Share a weather card as an image
- Cards that reorder around your interests and the day's weather, and say why

**Map**
- Animated rain radar for the last 2 hours
- Temperature, air quality and wind across 32 Indian cities
- Community reports on the map
- Tap anywhere for a forecast, and save that place

**Farm hub**
- Eight crops at three growth stages
- 7-day water plan comparing rain with crop need
- Spray calendar for the next three days
- Crop risks: heat, cold, fungal disease, waterlogging, wind and dry soil
- Soil moisture and temperature, growing degree days, and the longest dry spell

**Health hub**
- Advice for asthma, heart conditions, older adults and children
- Safe outdoor hours for the next 24 hours
- Air quality forecast and six pollutants compared with guideline levels
- Sun protection times and the heat index

**Plan**
- Best-day finder for seven activities over 14 days
- Journey planner with weather at each stage, and the least risky departure time
- Side-by-side comparison of saved places
- 30-day comparison with last year, a monsoon tracker, and this date in past years

**Community and more**
- Live local reports with confirmations, stored on the project's own server
- Alert centre with personal limits, history and notifications
- Daily streak and eight badges
- English and Hindi, light and dark themes, larger text, °C/°F and km/h/mph
- Installable on phones, with offline support

## How it is organised

There are no frameworks and no installed packages. Logic files such as `farm.js` are
pure functions with no screen code, so they can be tested directly. Files named
`screen-*.js` and `cards.js` turn that logic into HTML. `main.js` holds app state and
user actions.

To use a different weather source, such as IMD's own API, change only `api.js` so it
returns the same format.

## Data and privacy

| Service | Used for |
|---|---|
| [Open-Meteo](https://open-meteo.com) | Forecasts, air quality, history and place search (non-commercial use) |
| [RainViewer](https://www.rainviewer.com) | Rain radar images |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Map background |
| [Leaflet](https://leafletjs.com) | Map library, loaded when the Map tab opens |
| [Google Fonts](https://fonts.google.com/specimen/Mukta) | The Mukta typeface |

- The profile stays in the browser. There is no account or password.
- Open-Meteo receives place searches and the coordinates of chosen places. Device
  location is rounded to about 1 km first.
- Community reports are stored in `data/reports.json` with rounded locations, and
  disappear after 6 hours. Only the optional display name and note are shared.

## Known limitations

- It has not been tested with real farmers, commuters or patients.
- Crop values and advice rules are general guidance, not agricultural or medical advice.
- Air quality uses the US AQI scale, not India's CPCB index.
- Journey routes are straight lines at an assumed 55 km/h, not real roads.
- Community reports are not moderated or verified.
- Alerts appear only while the app is open. Background alerts would need push messaging.
- Spoken Hindi needs a Hindi voice installed on the device.
- Over plain `http://` on Wi-Fi, phones can't use device location or offline mode, because
  browsers allow those only on `localhost` or `https://`. Place search still works.
- OpenStreetMap's public tiles are fine for a class demo, but not for heavy use.
