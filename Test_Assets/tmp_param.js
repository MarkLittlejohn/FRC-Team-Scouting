const https = require('https');

https.get('https://api.statbotics.io/v3/team_year/238/2024?_t=12345', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(res.statusCode, data.substring(0, 100)));
}).on('error', e => console.error(e));
