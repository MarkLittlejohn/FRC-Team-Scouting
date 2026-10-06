const https = require('https');

https.get('https://api.statbotics.io/v3/team_years?year=2024&team=238,254,1678', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(data.substring(0, 1000)));
});
