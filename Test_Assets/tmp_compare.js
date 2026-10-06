const https = require('https');

https.get('https://api.statbotics.io/v3/team_events?event=2024njski&team=238', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log("TEAM_EVENTS:", data));
});

https.get('https://api.statbotics.io/v3/team_year/238/2024', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log("TEAM_YEAR:", data.substring(0, 500)));
});
