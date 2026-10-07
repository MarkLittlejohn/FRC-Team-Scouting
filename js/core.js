// Constants & Configuration
const TBA_API_BASE = 'https://www.thebluealliance.com/api/v3';

// DOM Elements
const form = document.getElementById('setup-form');
const eventKeyInput = document.getElementById('event-key');
const eventSuggestions = document.getElementById('event-suggestions');
const submitBtn = document.getElementById('fetch-btn');

// Settings Elements
const settingsModalOverlay = document.getElementById('settings-modal-overlay');
const openSettingsBtn = document.getElementById('open-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const apiKeyInput = document.getElementById('tba-api-key');
const eventListLabel = document.getElementById('event-list-label');

// Tools Elements
const toolsModalOverlay = document.getElementById('tools-modal-overlay');
const openToolsBtn = document.getElementById('open-tools-btn');
const closeToolsBtn = document.getElementById('close-tools-btn');

// Fav Team Elements
const favTeamInput = document.getElementById('favorite-team');
const favTeamDashboard = document.getElementById('favorite-team-dashboard');
const favTeamTitle = document.getElementById('fav-team-title');
const favTeamName = document.getElementById('fav-team-name');
const favTeamSummary = document.getElementById('fav-team-summary');
const favTeamEventsList = document.getElementById('fav-team-events-list');

const mainContent = document.getElementById('main-content');
const tabs = document.querySelectorAll('.tab-btn');
const viewPanels = document.querySelectorAll('.view-panel');

const statusMessage = document.getElementById('status-message');
const teamSortSelect = document.getElementById('team-sort-select');
const eventTeamsSummary = document.getElementById('event-teams-summary');
const teamsGrid = document.getElementById('teams-grid');
const teamSearch = document.getElementById('team-search');
const matchesList = document.getElementById('matches-list');
const matchTeamFilter = document.getElementById('match-team-filter');
const matchTimeOffset = document.getElementById('match-time-offset');
const rankingsBody = document.getElementById('rankings-table-body');
const alliancesGrid = document.getElementById('alliances-grid');
const alliancesContainer = document.getElementById('alliances-container');
const matchesSectionTitle = document.getElementById('matches-section-title');

// Simulator Elements
const runSimBtn = document.getElementById('run-sim-btn');
const simStatus = document.getElementById('sim-status');
const simStatusText = document.getElementById('sim-status-text');
const simResults = document.getElementById('sim-results');
const simRankingsBody = document.getElementById('sim-rankings-body');
const simMatchesBody = document.getElementById('sim-matches-body');
const simAlliancesList = document.getElementById('sim-alliances-list');
const simChampionCard = document.getElementById('sim-champion-card');

const printModalOverlay = document.getElementById('print-modal-overlay');
const closePrintModalBtn = document.getElementById('close-print-modal-btn');
const openPrintBtn = document.getElementById('open-print-btn');
const printScheduleBody = document.getElementById('print-schedule-body');

// Modal Elements
const modalOverlay = document.getElementById('team-modal-overlay');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalTeamTitle = document.getElementById('modal-team-title');
const modalTeamName = document.getElementById('modal-team-name');
const modalYearSummary = document.getElementById('modal-year-summary');
const modalEventsList = document.getElementById('modal-events-list');

const matchModalOverlay = document.getElementById('match-modal-overlay');
const closeMatchModalBtn = document.getElementById('close-match-modal-btn');
const matchModalTitle = document.getElementById('modal-match-title');
const matchModalLoading = document.getElementById('match-modal-loading');
const matchModalStats = document.getElementById('match-modal-stats');

// State Management
let currentData = {
    teams: [],
    matches: [],
    rankings: [],
    alliances: [],
    playedStatus: {},
    epaData: {},
    districtPoints: {},
    matchEPAStats: {}
};

// IndexedDB Caching Wrapper
async function fetchWithCache(url, options = {}, bypassCache = false, maxAgeMs = null) {
    if (!window.idbKeyval) return fetch(url, options); // Fallback if CDN blocked

    let cachedResponse = null;
    let isStale = false;

    if (!bypassCache) {
        try {
            cachedResponse = await idbKeyval.get(url);
            if (cachedResponse) {
                isStale = maxAgeMs !== null && (Date.now() - cachedResponse.timestamp > maxAgeMs);
                if (!isStale) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => cachedResponse.data,
                        _isCached: true,
                        _timestamp: cachedResponse.timestamp
                    };
                }
            }
        } catch (e) {
            console.warn('IDB Read Error', e);
        }
    }

    try {
        let fetchUrl = url;
        const fetchOptions = { ...options };
        
        if (bypassCache) {
            // Completely bust HTTP/Proxy caches by making the URL unique on every bypass fetch
            fetchUrl = new URL(url, window.location.origin);
            fetchUrl.searchParams.append('_t', Date.now());
            fetchUrl = fetchUrl.toString();
        }

        const response = await fetch(fetchUrl, fetchOptions);
        if (response.ok) {
            try {
                const cloned = response.clone();
                const data = await cloned.json();
                // We always write back to the original URL without the _t param
                await idbKeyval.set(url, { data, timestamp: Date.now() });
            } catch (e) {
                console.warn('IDB Write Error', e);
            }
        }
        return response;
    } catch (err) {
        // Fallback to stale cache if offline
        if (cachedResponse) {
            console.warn('Network error, falling back to stale cache for:', url);
            return {
                ok: true,
                status: 200,
                json: async () => cachedResponse.data,
                _isCached: true,
                _timestamp: cachedResponse.timestamp
            };
        }
        throw err;
    }
}

