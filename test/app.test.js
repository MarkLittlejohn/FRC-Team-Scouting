const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createElement(overrides = {}) {
    return {
        innerHTML: '',
        value: '',
        style: {},
        classList: {
            add() {},
            remove() {},
        },
        children: [],
        appendChild(child) {
            this.children.push(child);
        },
        addEventListener() {},
        ...overrides,
    };
}

function createAppContext({ idbKeyval, fetch } = {}) {
    const elements = new Map();
    const document = {
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, createElement());
            return elements.get(id);
        },
        querySelectorAll() {
            return [];
        },
        createElement() {
            return createElement();
        },
    };

    const context = {
        console,
        Date,
        Math,
        JSON,
        Promise,
        URL,
        parseInt,
        document,
        window: { idbKeyval },
        idbKeyval,
        fetch,
        setTimeout,
        clearTimeout,
    };
    context.globalThis = context;
    vm.createContext(context);
    return { context, elements };
}

function load(context, file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {
        filename: file,
    });
}

function setState(context, expression) {
    vm.runInContext(expression, context);
}

test('fetchWithCache falls back to fetch when IndexedDB is unavailable', async () => {
    let requestedUrl;
    const response = { ok: true, status: 200 };
    const { context } = createAppContext({
        fetch: async url => {
            requestedUrl = url;
            return response;
        },
    });
    load(context, 'js/core.js');

    const result = await context.fetchWithCache('https://example.test/data');

    assert.equal(result, response);
    assert.equal(requestedUrl, 'https://example.test/data');
});

test('fetchWithCache returns a fresh cached response without a network request', async () => {
    let fetchCalls = 0;
    const cached = { data: { teams: [1, 2] }, timestamp: Date.now() };
    const { context } = createAppContext({
        idbKeyval: {
            async get() {
                return cached;
            },
        },
        fetch: async () => {
            fetchCalls++;
            return { ok: true };
        },
    });
    load(context, 'js/core.js');

    const result = await context.fetchWithCache('https://example.test/data');

    assert.equal(fetchCalls, 0);
    assert.equal(result.ok, true);
    assert.equal(result._isCached, true);
    assert.deepEqual(await result.json(), cached.data);
});

test('fetchWithCache refreshes stale data and stores the new response', async () => {
    const writes = [];
    const cached = { data: { old: true }, timestamp: Date.now() - 10_000 };
    const networkData = { fresh: true };
    let requestedUrl;
    const { context } = createAppContext({
        idbKeyval: {
            async get() {
                return cached;
            },
            async set(url, value) {
                writes.push({ url, value });
            },
        },
        fetch: async url => {
            requestedUrl = url;
            return {
                ok: true,
                clone() {
                    return { json: async () => networkData };
                },
                json: async () => networkData,
            };
        },
    });
    load(context, 'js/core.js');

    const result = await context.fetchWithCache(
        'https://example.test/data',
        {},
        false,
        1
    );

    assert.equal(result.ok, true);
    assert.equal(requestedUrl, 'https://example.test/data');
    assert.equal(writes.length, 1);
    assert.equal(writes[0].url, 'https://example.test/data');
    assert.deepEqual(JSON.parse(JSON.stringify(writes[0].value.data)), networkData);
    assert.equal(typeof writes[0].value.timestamp, 'number');
});

test('fetchWithCache serves stale cached data when the network fails', async () => {
    const cached = { data: { offline: true }, timestamp: 123 };
    const { context } = createAppContext({
        idbKeyval: {
            async get() {
                return cached;
            },
        },
        fetch: async () => {
            throw new Error('offline');
        },
    });
    load(context, 'js/core.js');

    const result = await context.fetchWithCache(
        'https://example.test/data',
        {},
        false,
        1
    );

    assert.equal(result.ok, true);
    assert.equal(result._isCached, true);
    assert.equal(result._timestamp, cached.timestamp);
    assert.deepEqual(await result.json(), cached.data);
});

test('renderRankings renders empty state when rankings are unavailable', () => {
    const { context, elements } = createAppContext();
    load(context, 'js/core.js');
    load(context, 'js/rankings.js');

    context.renderRankings([]);

    assert.match(elements.get('rankings-table-body').innerHTML, /No rankings available yet/);
});

test('renderRankings formats records, RP, EPA, and district points', () => {
    const { context, elements } = createAppContext();
    load(context, 'js/core.js');
    load(context, 'js/rankings.js');
    setState(context, `currentData.epaData = {
        1678: { epa: { total_points: 92.36 } },
    };`);
    setState(context, `currentData.districtPoints = {
        frc1678: { total: 42 },
    };`);
    setState(context, `currentData.teams = [
        { key: 'frc1678', team_number: 1678, nickname: 'Citrus Circuits' },
    ];`);

    context.renderRankings([{
        rank: 1,
        team_key: 'frc1678',
        record: { wins: 8, losses: 1, ties: 0 },
        sort_orders: [3.14159],
    }]);

    const rows = elements.get('rankings-table-body').children;
    assert.equal(rows.length, 1);
    assert.match(rows[0].innerHTML, />1678</);
    assert.match(rows[0].innerHTML, />8-1-0</);
    assert.match(rows[0].innerHTML, />3.14</);
    assert.match(rows[0].innerHTML, />92.4</);
    assert.match(rows[0].innerHTML, />42</);
});

test('renderTeams filters by search text and orders teams by number', () => {
    const { context, elements } = createAppContext();
    load(context, 'js/core.js');
    load(context, 'js/team-renderer.js');
    setState(context, `currentData.playedStatus = {
        frc10: false,
        frc2: false,
    };`);
    elements.get('team-search').value = 'circuit';
    elements.get('team-sort-select').value = 'number-asc';

    context.renderTeams([
        { key: 'frc10', team_number: 10, nickname: 'Circuit Breakers' },
        { key: 'frc2', team_number: 2, nickname: 'Other Team' },
    ]);

    const cards = elements.get('teams-grid').children;
    assert.equal(cards.length, 1);
    assert.match(cards[0].innerHTML, />10</);
    assert.match(elements.get('event-teams-summary').innerHTML, /Total Teams:.*2/);
});
