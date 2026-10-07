const https = require('https');

const EVENT_KEY = '2024pncmp'; // PNW District Championship (or any standard district 2024waahs)
const API_KEY = process.env.TBA_API_KEY;

if (!API_KEY) {
    throw new Error('Set TBA_API_KEY before running this test.');
}

async function run() {
    console.log("Fetching district points for 2024waahs...");
}
run();
