const https = require('https');

https.get('https://api.statbotics.io/v3/team_events?event=2024casj', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(data.substring(0, 1000)));
});
