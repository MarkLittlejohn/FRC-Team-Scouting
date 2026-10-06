const https = require('https');
let active = 0, success = 0, fail = 0;

for (let i=0; i<60; i++) {
    active++;
    https.get(`https://api.statbotics.io/v3/team_year/${100+i}/2024`, (res) => {
        if (res.statusCode === 200) success++;
        else fail++;
        active--;
        if (active === 0) console.log(`Success: ${success}, Fail: ${fail}`);
    });
}
