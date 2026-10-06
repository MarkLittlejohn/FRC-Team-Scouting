const https = require('https');

https.get('https://api.statbotics.io/v3/team_year/238/2024', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(data));
});
