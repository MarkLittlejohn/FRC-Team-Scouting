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

// Initialize App
function init() {
    // Load saved API key from localStorage if available
    const savedKey = localStorage.getItem('tba_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
    }

    // Load saved Event key from localStorage if available
    const savedEvent = localStorage.getItem('tba_event_key');
    if (savedEvent) {
        eventKeyInput.value = savedEvent;
    }

    // Load Fav Team
    const savedFavTeam = localStorage.getItem('tba_fav_team');
    if (savedFavTeam) {
        favTeamInput.value = savedFavTeam;
    }

    if (savedKey && savedFavTeam) {
        fetchFavoriteTeam();
    } else if (savedKey && !savedFavTeam) {
        fetchAllEventsForYear();
    }

    // Set up event listeners
    form.addEventListener('submit', handleFetchData);

    // Tools Modal
    if (openToolsBtn) openToolsBtn.addEventListener('click', () => toolsModalOverlay.classList.remove('hidden'));
    if (closeToolsBtn) closeToolsBtn.addEventListener('click', () => toolsModalOverlay.classList.add('hidden'));

    // Settings Modal
    if (openSettingsBtn) openSettingsBtn.addEventListener('click', () => settingsModalOverlay.classList.remove('hidden'));
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => settingsModalOverlay.classList.add('hidden'));
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', () => {
        const team = favTeamInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) localStorage.setItem('tba_api_key', apiKey);
        if (team) {
            localStorage.setItem('tba_fav_team', team);
            if (apiKey) fetchFavoriteTeam();
        } else {
            localStorage.removeItem('tba_fav_team');
            favTeamDashboard.classList.add('hidden');
            if (apiKey) fetchAllEventsForYear();
        }
        settingsModalOverlay.classList.add('hidden');
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    teamSearch.addEventListener('input', handleTeamSearch);
    if (teamSortSelect) {
        teamSortSelect.addEventListener('change', () => {
             renderTeams(currentData.teams);
        });
    }

    if (matchTeamFilter) {
        matchTeamFilter.addEventListener('input', () => {
             renderMatches(currentData.matches);
        });
    }

    if (matchTimeOffset) {
        matchTimeOffset.addEventListener('input', () => {
             renderMatches(currentData.matches);
        });
    }

    // Modal Close Events
    closeModalBtn.addEventListener('click', closeTeamModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeTeamModal();
    });

    closeMatchModalBtn.addEventListener('click', closeMatchModal);
    matchModalOverlay.addEventListener('click', (e) => {
        if (e.target === matchModalOverlay) closeMatchModal();
    });

    if (openPrintBtn) openPrintBtn.addEventListener('click', openPrintModal);
    if (closePrintModalBtn) closePrintModalBtn.addEventListener('click', () => printModalOverlay.classList.add('hidden'));

    if (runSimBtn) {
        runSimBtn.addEventListener('click', runSimulator);
    }
}

async function fetchFavoriteTeam() {
    const apiKey = apiKeyInput.value.trim();
    let teamKey = favTeamInput.value.trim();
    if (!apiKey || !teamKey) return;

    if (!teamKey.startsWith('frc')) {
        teamKey = 'frc' + teamKey;
        favTeamInput.value = teamKey;
    }

    if (eventListLabel) {
        eventListLabel.innerHTML = `<i class="ph ph-star-fill" style="color: #fbbf24; margin-right: 0.25rem;"></i> Events for ${teamKey.toUpperCase()}`;
    }

    favTeamDashboard.classList.remove('hidden');
    favTeamTitle.innerText = `Team ${teamKey.replace('frc', '')}`;
    favTeamName.innerText = 'Loading...';
    favTeamSummary.innerHTML = '';
    favTeamEventsList.innerHTML = `
        <div class="status-container">
            <div class="spinner"></div>
            <p>Loading My Team data...</p>
        </div>
    `;

    try {
        const year = new Date().getFullYear();
        const TTL_LONG = 24 * 60 * 60 * 1000;
        const TTL_SHORT = 2 * 60 * 60 * 1000;

        const teamReq = await fetchWithCache(`${TBA_API_BASE}/team/${teamKey}/simple`, { headers: { 'X-TBA-Auth-Key': apiKey } }, false, TTL_LONG);
        const eventsReq = await fetchWithCache(`${TBA_API_BASE}/team/${teamKey}/events/${year}/simple`, { headers: { 'X-TBA-Auth-Key': apiKey } }, false, TTL_LONG);

        let events = [];
        let isOngoing = false;
        if (eventsReq.ok) {
            events = await eventsReq.json();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            isOngoing = events.some(e => {
                if (!e.start_date || !e.end_date) return false;
                const start = new Date(e.start_date);
                const end = new Date(e.end_date);
                return today >= start && today <= end;
            });
        }
        
        const dynamicTTL = isOngoing ? TTL_SHORT : TTL_LONG;

        const [statusesReq, epaReq] = await Promise.all([
            fetchWithCache(`${TBA_API_BASE}/team/${teamKey}/events/${year}/statuses`, { headers: { 'X-TBA-Auth-Key': apiKey } }, isOngoing, dynamicTTL),
            fetchWithCache(`https://api.statbotics.io/v3/team_year/${teamKey.replace('frc', '')}/${year}`, {}, isOngoing, dynamicTTL).catch(() => null)
        ]);

        if (!teamReq.ok || !eventsReq.ok || !statusesReq.ok) throw new Error('Failed to fetch favorite team details.');

        const teamData = await teamReq.json();
        const statuses = await statusesReq.json();
        let epaData = null;
        if (epaReq && epaReq.ok) epaData = await epaReq.json();

        let districtCutoff = 75;
        if (epaData && epaData.district) {
            try {
                const distReq = await fetchWithCache(`${TBA_API_BASE}/district/${year}${epaData.district}/rankings`, { headers: { 'X-TBA-Auth-Key': apiKey } }, false, TTL_SHORT);
                if (distReq.ok) {
                    const distRanks = await distReq.json();
                    const capacities = { 'fim': 160, 'tx': 85, 'fit': 85, 'ne': 90, 'pnw': 50, 'fma': 60, 'ont': 80, 'chs': 60, 'in': 32, 'fin': 32, 'nc': 40, 'pch': 50, 'isr': 45, 'ca': 100 };
                    const distCap = capacities[epaData.district] || Math.floor(distRanks.length * 0.5) || 50;
                    
                    const activeTeams = distRanks.filter(t => t.point_total > 0);
                    if (activeTeams.length > 0 && distRanks.length > 0) {
                        const advancementRate = distCap / distRanks.length;
                        const currentTargetRank = Math.max(1, Math.floor(activeTeams.length * advancementRate));
                        const cutoffPts = activeTeams[currentTargetRank - 1].point_total;
                        
                        if (cutoffPts > 0) districtCutoff = cutoffPts;
                    }
                }
            } catch (e) { console.error('Failed to parse dynamic district cutoff'); }
        }

        favTeamName.innerText = teamData.nickname || 'Unknown Name';

        // Populate Event Suggestions Dropdown
        if (eventSuggestions) {
            eventSuggestions.innerHTML = '';

            // Build unified event list
            const allEvents = events.map(e => ({ key: e.key, name: e.name, start_date: e.start_date || `${year}-12-31` }));

            // Add custom global events with mock dates for sorting
            const week0 = { key: `${year}week0`, name: '[Global] Official Week 0', start_date: `${year}-02-15` };
            if (!allEvents.some(e => e.key === week0.key)) allEvents.push(week0);

            if (epaData && epaData.district) {
                const dcmp = { key: `${year}${epaData.district}cmp`, name: `[Global] ${epaData.district.toUpperCase()} District Championship`, start_date: `${year}-04-05` };
                if (!allEvents.some(e => e.key === dcmp.key)) allEvents.push(dcmp);
            }

            const cmp = { key: `${year}cmptx`, name: '[Global] FIRST Championship (Houston)', start_date: `${year}-04-18` };
            if (!allEvents.some(e => e.key === cmp.key)) allEvents.push(cmp);

            // Sort events chronologically
            allEvents.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

            // Populate Datalist
            allEvents.forEach(evt => {
                const opt = document.createElement('option');
                opt.value = evt.key;
                opt.textContent = evt.name;
                eventSuggestions.appendChild(opt);
            });
        }

        renderTeamHistoryData(teamKey, events, statuses, epaData, null, favTeamSummary, favTeamEventsList, null, districtCutoff);
    } catch (err) {
        console.error(err);
        favTeamEventsList.innerHTML = `
            <div class="status-container" style="padding: 2rem;">
                <i class="ph ph-warning-circle" style="font-size: 2rem; color: #ef4444;"></i>
                <p class="error-text">Failed to load My Team data.</p>
            </div>
        `;
    }
}

async function fetchAllEventsForYear() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) return;

    if (eventListLabel) {
        eventListLabel.innerHTML = '<i class="ph ph-globe" style="color: #60a5fa; margin-right: 0.25rem;"></i> All Events (Loading...)';
    }

    try {
        const year = new Date().getFullYear();
        const TTL_LONG = 24 * 60 * 60 * 1000;
        const eventsReq = await fetchWithCache(`${TBA_API_BASE}/events/${year}/simple`, { headers: { 'X-TBA-Auth-Key': apiKey } }, false, TTL_LONG);
        if (!eventsReq.ok) throw new Error('Failed to fetch events');
        
        const events = await eventsReq.json();
        
        if (eventListLabel) {
            eventListLabel.innerHTML = `<i class="ph ph-globe" style="color: #60a5fa; margin-right: 0.25rem;"></i> All Events (${year})`;
        }

        // Populate Event Suggestions Dropdown
        if (eventSuggestions) {
            eventSuggestions.innerHTML = '';
            
            // Build unified event list
            const allEvents = events.map(e => ({ key: e.key, name: e.name, start_date: e.start_date || `${year}-12-31` }));

            // Sort events chronologically
            allEvents.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

            // Populate Datalist
            allEvents.forEach(evt => {
                const opt = document.createElement('option');
                opt.value = evt.key;
                opt.textContent = evt.name;
                eventSuggestions.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('Error fetching all events: ', e);
        if (eventListLabel) {
            eventListLabel.innerHTML = '<i class="ph ph-warning" style="color: #ef4444; margin-right: 0.25rem;"></i> Failed to load events';
        }
    }
}

function closeTeamModal() {
    modalOverlay.classList.add('hidden');
    // Clear out data to prevent flickering on next open
    modalTeamTitle.innerText = 'Team -';
    modalTeamName.innerText = '';
    modalYearSummary.innerHTML = '';
    modalEventsList.innerHTML = '';
}

function closeMatchModal() {
    matchModalOverlay.classList.add('hidden');
}

function openPrintModal() {
    printModalOverlay.classList.remove('hidden');
    renderPrintSchedule();
}

function renderPrintSchedule() {
    if (!printScheduleBody) return;
    printScheduleBody.innerHTML = '';
    
    const matches = currentData.matches || [];
    const filterTerm = matchTeamFilter ? matchTeamFilter.value.trim().toLowerCase() : '';
    let filteredMatches = matches;
    
    if (filterTerm) {
        filteredMatches = matches.filter(m => {
            const redTeams = m.alliances.red.team_keys.map(k => k.replace('frc', ''));
            const blueTeams = m.alliances.blue.team_keys.map(k => k.replace('frc', ''));
            return redTeams.includes(filterTerm) || blueTeams.includes(filterTerm);
        });
    }

    if (filteredMatches.length === 0) {
        printScheduleBody.innerHTML = '<tr><td colspan="4" style="padding: 1rem;">No matches to print.</td></tr>';
        return;
    }

    filteredMatches.forEach(match => {
        let matchTitle = '';
        switch (match.comp_level) {
            case 'qm': matchTitle = `Q${match.match_number}`; break;
            case 'ef': matchTitle = `E${match.set_number}M${match.match_number}`; break;
            case 'qf': matchTitle = `QF${match.set_number}M${match.match_number}`; break;
            case 'sf': matchTitle = `SF${match.set_number}M${match.match_number}`; break;
            case 'f': matchTitle = `F${match.match_number}`; break;
            default: matchTitle = match.key;
        }

        const timeStamp = match.actual_time || match.predicted_time || match.time;
        let timeStr = '';
        if (timeStamp) {
            const offsetMins = matchTimeOffset ? (parseInt(matchTimeOffset.value) || 0) : 0;
            const date = new Date((timeStamp + (offsetMins * 60)) * 1000);
            timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        const formatTeams = (teamKeys, color) => {
            return teamKeys.map(k => {
                const teamNum = k.replace('frc', '');
                if (filterTerm && teamNum === filterTerm) {
                    return `<span style="font-weight: bold; background-color: rgba(255, 255, 0, 0.4); padding: 0.1rem 0.2rem; border-radius: 4px; color: ${color};">${teamNum}</span>`;
                }
                return teamNum;
            }).join(', ');
        };

        const redTeamsStr = formatTeams(match.alliances.red.team_keys, '#d32f2f');
        const blueTeamsStr = formatTeams(match.alliances.blue.team_keys, '#1976d2');

        printScheduleBody.innerHTML += `
            <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 0.5rem; text-align: left; font-weight: bold;">${matchTitle}</td>
                <td style="padding: 0.5rem; text-align: left;">${timeStr}</td>
                <td style="padding: 0.5rem; color: #d32f2f;">${redTeamsStr}</td>
                <td style="padding: 0.5rem; color: #1976d2;">${blueTeamsStr}</td>
            </tr>
        `;
    });
}

// Tab Switching Logic
function switchTab(tabId) {
    // Update active tab button
    tabs.forEach(tab => {
        if (tab.dataset.tab === tabId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Update active view panel
    viewPanels.forEach(panel => {
        if (panel.id === `view-${tabId}`) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });
}

// Main Fetch Handler
async function handleFetchData(e) {
    e.preventDefault();

    const apiKey = apiKeyInput.value.trim();
    const eventKey = eventKeyInput.value.trim();

    if (!apiKey || !eventKey) return;

    // Save API & Event key
    localStorage.setItem('tba_api_key', apiKey);
    localStorage.setItem('tba_event_key', eventKey);

    // Update UI state to loading
    mainContent.classList.remove('hidden');
    viewPanels.forEach(p => p.classList.remove('active'));
    statusMessage.classList.remove('hidden');

    // Clear old content
    teamsGrid.innerHTML = '';
    matchesList.innerHTML = '';
    if (rankingsBody) rankingsBody.innerHTML = '';
    if (alliancesGrid) alliancesGrid.innerHTML = '';
    if (alliancesContainer) alliancesContainer.classList.add('hidden');

    // Clear Simulator content
    if (simResults) simResults.classList.add('hidden');
    if (simStatus) simStatus.classList.add('hidden');
    if (simRankingsBody) simRankingsBody.innerHTML = '';
    if (simAlliancesList) simAlliancesList.innerHTML = '';
    if (simChampionCard) simChampionCard.innerHTML = '';

    currentData.playedStatus = {};
    currentData.epaData = {};
    currentData.rankings = [];
    currentData.alliances = [];
    currentData.districtPoints = {};
    currentData.matchEPAStats = {};
    statusMessage.innerHTML = `
        <div class="spinner"></div>
        <p>Fetching data for event <strong>${eventKey}</strong>...</p>
    `;

    try {
        submitBtn.disabled = true;
        submitBtn.querySelector('span').innerText = 'Fetching...';

        let bypassCache = false;
        try {
            const evtReq = await fetchWithCache(`${TBA_API_BASE}/event/${eventKey}`, { headers: { 'X-TBA-Auth-Key': apiKey } }, false);
            if (evtReq.ok) {
                const evtData = await evtReq.json();
                if (evtData.end_date) {
                    const endDate = new Date(evtData.end_date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Normalize today to midnight for comparison
                    // If the event is ongoing or in the future, bypass the cache to get live match updates
                    if (endDate >= today) {
                        bypassCache = true;
                    } else if (evtReq._isCached) {
                        // If it's a past event, but our cached version was saved BEFORE the event finished 
                        // (plus a 1-day buffer for final rankings), bypass cache to get final results!
                        const eventFinishedTime = endDate.getTime() + (24 * 60 * 60 * 1000); // 1 day after end date
                        if (evtReq._timestamp && evtReq._timestamp < eventFinishedTime) {
                            bypassCache = true;
                            // Also need to refetch the event data itself to overwrite its cache
                            fetchWithCache(`${TBA_API_BASE}/event/${eventKey}`, { headers: { 'X-TBA-Auth-Key': apiKey } }, true).catch(e => console.warn(e));
                        }
                    }
                }
            }
        } catch (e) { console.warn('Failed to check event date for caching', e); }

        // Fetch Both Teams and Matches simultaneously
        const [teamsReq, matchesReq, rankingsReq, alliancesReq, districtPointsReq] = await Promise.all([
            fetchWithCache(`${TBA_API_BASE}/event/${eventKey}/teams/simple`, {
                headers: { 'X-TBA-Auth-Key': apiKey }
            }, bypassCache),
            fetchWithCache(`${TBA_API_BASE}/event/${eventKey}/matches`, {
                headers: { 'X-TBA-Auth-Key': apiKey }
            }, bypassCache),
            fetchWithCache(`${TBA_API_BASE}/event/${eventKey}/rankings`, {
                headers: { 'X-TBA-Auth-Key': apiKey }
            }, bypassCache).catch(() => null),
            fetchWithCache(`${TBA_API_BASE}/event/${eventKey}/alliances`, {
                headers: { 'X-TBA-Auth-Key': apiKey }
            }, bypassCache).catch(() => null),
            fetchWithCache(`${TBA_API_BASE}/event/${eventKey}/district_points`, {
                headers: { 'X-TBA-Auth-Key': apiKey }
            }, bypassCache).catch(() => null)
        ]);

        if (!teamsReq.ok || !matchesReq.ok) {
            let errorMsg = 'Failed to fetch data. ';
            if (teamsReq.status === 401 || matchesReq.status === 401) {
                errorMsg = 'Invalid API Key. Please verify your TBA Auth Key.';
            } else if (teamsReq.status === 404) {
                errorMsg = `Event ${eventKey} not found.`;
            }
            throw new Error(errorMsg);
        }

        const teams = await teamsReq.json();
        const matches = await matchesReq.json();

        if (rankingsReq && rankingsReq.ok) {
            const rankingsData = await rankingsReq.json();
            if (rankingsData && rankingsData.rankings) {
                currentData.rankings = rankingsData.rankings;
            }
        }

        if (alliancesReq && alliancesReq.ok) {
            currentData.alliances = await alliancesReq.json();
        }

        if (districtPointsReq && districtPointsReq.ok) {
            const dpData = await districtPointsReq.json();
            if (dpData && dpData.points) {
                currentData.districtPoints = dpData.points;
            }
        }

        // Sort teams by number
        currentData.teams = teams.sort((a, b) => a.team_number - b.team_number);

        // Sort matches by match number (Simplistic sort by comp_level then match_number)
        const compLevelOrd = { 'qm': 1, 'ef': 2, 'qf': 3, 'sf': 4, 'f': 5 };
        currentData.matches = matches.sort((a, b) => {
            if (compLevelOrd[a.comp_level] !== compLevelOrd[b.comp_level]) {
                return compLevelOrd[a.comp_level] - compLevelOrd[b.comp_level];
            }
            if (a.set_number !== b.set_number) {
                return a.set_number - b.set_number;
            }
            return a.match_number - b.match_number;
        });

        // Render Data
        renderTeams(currentData.teams);
        renderMatches(currentData.matches);
        renderRankings(currentData.rankings);
        renderAlliances(currentData.alliances);

        // Fetch EPA asynchronously
        fetchEPAForEvent(eventKey, bypassCache);

        // Hide Status, Show Default Tab (Teams)
        statusMessage.classList.add('hidden');
        switchTab('teams');

    } catch (err) {
        console.error(err);
        statusMessage.innerHTML = `
            <i class="ph ph-warning-circle" style="font-size: 3rem; color: #ef4444;"></i>
            <p class="error-text">${err.message}</p>
            <p style="font-size: 0.85rem;">Check the console for more details.</p>
        `;
    } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector('span').innerText = 'Fetch Data';
    }
}

// Render Teams
function renderTeams(teams) {
    if (!teamsGrid) return;
    teamsGrid.innerHTML = '';
    
    // Filter logic based on teamSearch
    const term = teamSearch.value.toLowerCase();
    let displayTeams = teams.filter(t =>
        t.team_number.toString().includes(term) ||
        (t.nickname && t.nickname.toLowerCase().includes(term))
    );
    
    // Sorting Logic
    if (teamSortSelect) {
        const sortMode = teamSortSelect.value;
        displayTeams.sort((a, b) => {
            if (sortMode === 'epa-desc' || sortMode === 'epa-asc') {
                const epaA = currentData.epaData[a.team_number]?.epa?.total_points || 0;
                const epaB = currentData.epaData[b.team_number]?.epa?.total_points || 0;
                if (epaA !== epaB) {
                    return sortMode === 'epa-desc' ? epaB - epaA : epaA - epaB;
                }
            } else if (sortMode === 'data-avail') {
                const statusWeights = { 'official': 3, 'week0': 2, false: 1, 'fetching': 0, undefined: 0 };
                const weightA = statusWeights[currentData.playedStatus[a.key]] || 0;
                const weightB = statusWeights[currentData.playedStatus[b.key]] || 0;
                if (weightA !== weightB) {
                    return weightB - weightA; // Higher weight first
                }
            }
            // Default / Fallback: Team Number ASC
            return a.team_number - b.team_number;
        });
    }

    if (eventTeamsSummary) {
        // Compute Summary Stats on FULL team list (not filtered)
        let totalEPA = 0;
        let epaCount = 0;
        teams.forEach(t => {
            const epa = currentData.epaData[t.team_number]?.epa?.total_points;
            if (epa) {
                totalEPA += epa;
                epaCount++;
            }
        });
        const avgEPA = epaCount > 0 ? (totalEPA / epaCount).toFixed(1) : 'N/A';

        eventTeamsSummary.innerHTML = `
            <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); padding: 0.5rem 1rem; border-radius: 8px; display: flex; align-items: center;">
                <i class="ph ph-users" style="color: #818cf8; margin-right: 0.5rem; font-size: 1.1rem;"></i> 
                <span>Total Teams: <strong style="color: var(--text-primary); margin-left: 0.25rem;">${teams.length}</strong></span>
            </div>
            <div style="background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.2); padding: 0.5rem 1rem; border-radius: 8px; display: flex; align-items: center;">
                <i class="ph ph-trend-up" style="color: #34d399; margin-right: 0.5rem; font-size: 1.1rem;"></i> 
                <span>Event Avg EPA: <strong style="color: var(--text-primary); margin-left: 0.25rem;">${avgEPA}</strong></span>
            </div>
            <div id="epa-sync-indicator" style="display: none; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #f59e0b; padding: 0.5rem 1rem; border-radius: 8px; align-items: center;">
                <i class="ph ph-spinner ph-spin" style="margin-right: 0.5rem;"></i> <span id="epa-sync-text">Syncing Live EPA...</span>
            </div>
        `;
    }

    if (displayTeams.length === 0) {
        teamsGrid.innerHTML = '<p class="text-tertiary">No teams found for this event.</p>';
        return;
    }

    displayTeams.forEach(team => {
        const card = document.createElement('div');
        card.className = 'team-card';

        const locationStr = [team.city, team.state_prov, team.country].filter(Boolean).join(', ');

        // Check cache status
        const status = currentData.playedStatus[team.key];
        let badgeHtml = '';
        if (status === 'official') {
            badgeHtml = '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border-color: rgba(16, 185, 129, 0.3); font-size: 0.65rem;"><i class="ph ph-calendar-check"></i> Official Data</span>';
        } else if (status === 'week0') {
            badgeHtml = '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #fca5a5; border-color: rgba(239, 68, 68, 0.3); font-size: 0.65rem;"><i class="ph ph-warning"></i> Wk 0 Data</span>';
        } else if (status === false) {
            badgeHtml = '<span class="badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-tertiary); border-color: var(--surface-border); font-size: 0.65rem;">No Data</span>';
        } else {
            badgeHtml = '<div class="spinner" style="width: 14px; height: 14px; border-width: 2px; border-color: rgba(255,255,255,0.1); border-top-color: var(--text-tertiary);"></div>';

            // Trigger fetch if not already in progress
            if (status === undefined) {
                currentData.playedStatus[team.key] = 'fetching';
                checkTeamPlayedStatus(team.key);
            }
        }

        const epaObj = currentData.epaData[team.team_number];
        let epaBadgeHtml = '';
        if (epaObj && epaObj.epa) {
            epaBadgeHtml = `<span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; border-color: rgba(99, 102, 241, 0.3); font-size: 0.65rem;" title="Expected Points Added"><i class="ph ph-trend-up"></i> EPA: ${epaObj.epa.total_points.toFixed(1)}</span>`;
        }

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.25rem;">
                <div class="team-number" style="margin-bottom: 0;">${team.team_number}</div>
                <div style="display: flex; gap: 0.25rem; flex-wrap: wrap; justify-content: flex-end; align-items:flex-start; margin-top: 0.25rem;">
                   ${epaBadgeHtml}
                   <div id="badge-${team.key}">${badgeHtml}</div>
                </div>
            </div>
            <div class="team-name" title="${team.nickname}">${team.nickname || 'Unknown Name'}</div>
            <div class="team-location">
                <i class="ph ph-map-pin"></i>
                <span title="${locationStr}">${locationStr || 'Location Unknown'}</span>
            </div>
        `;

        // Add click listener to open modal
        card.addEventListener('click', () => openTeamModal(team.key, team.team_number, team.nickname));

        teamsGrid.appendChild(card);
    });
}

// Background auto-fetch for EPA Metric
async function fetchEPAForEvent(eventKey, bypassCache = false) {
    // 1. Fetch Team EPAs (usually stable)
    try {
        const teamsReq = await fetchWithCache(`https://api.statbotics.io/v3/team_events?event=${eventKey}`, {}, bypassCache);
        if (teamsReq.ok) {
            const data = await teamsReq.json();
            data.forEach(item => {
                currentData.epaData[item.team] = item;
                // Live update rankings tab if it's already rendered
                const tdEpa = document.getElementById(`ranking-epa-${item.team}`);
                if (tdEpa) {
                    tdEpa.innerText = item.epa.total_points.toFixed(1);
                }
            });

            // If this is a live/upcoming event, team_events might be stale (it often reflects the team's EPA before the event or an old snapshot).
            // We should fetch live team_year EPAs directly to ensure accuracy in the Match Schedule.
            // We run this unconditionally so even past events show the current year's actual EPA instead of an old time-capsule EPA.
            if (currentData.teams && currentData.teams.length > 0) {
                const yearMatch = eventKey.match(/^(\d{4})/);
                const year = yearMatch ? yearMatch[1] : new Date().getFullYear();
                
                // Fetch in throttled parallel chunks to avoid Statbotics 429 Rate Limits
                const activeTeams = currentData.teams.map(t => t.team_number);
                const liveResults = [];
                
                const syncIndicator = document.getElementById('epa-sync-indicator');
                const syncText = document.getElementById('epa-sync-text');
                if (syncIndicator) syncIndicator.style.display = 'flex';
                
                // Allow a 15-minute local cache window during live events to prevent aggressive 3-second redraws when reloading immediately.
                const dynamicEpaTTL = bypassCache ? 15 * 60 * 1000 : null;
                
                for (let i = 0; i < activeTeams.length; i += 5) {
                    if (syncText) {
                        const percent = Math.floor((i / activeTeams.length) * 100);
                        syncText.innerText = `Syncing Live EPA (${percent}%)`;
                    }
                    
                    const batch = activeTeams.slice(i, i + 5);
                    const batchPromises = batch.map(teamNum => 
                        fetchWithCache(`https://api.statbotics.io/v3/team_year/${teamNum}/${year}`, {}, false, dynamicEpaTTL)
                            .then(res => res.ok ? res : null)
                            .catch(() => null)
                    );
                    
                    const batchResponses = await Promise.all(batchPromises);
                    
                    // Parse JSON payload while keeping track of cache hits
                    const batchResults = await Promise.all(batchResponses.map(async r => {
                        if (!r) return null;
                        const data = await r.json();
                        return { data, isCached: r._isCached };
                    }));
                    
                    liveResults.push(...batchResults.filter(r => r !== null).map(r => r.data));
                    
                    const allCached = batchResults.every(r => r && r.isCached);
                    if (i + 5 < activeTeams.length && !allCached) {
                        // Sleep 300ms between batches to respect rate limits, but ONLY if we actually hit the network!
                        await new Promise(r => setTimeout(r, 300));
                    }
                }
                
                if (syncIndicator) {
                    syncIndicator.innerHTML = '<i class="ph ph-check-circle" style="margin-right: 0.5rem; color: #10b981;"></i> <span>EPA Sync Complete</span>';
                    syncIndicator.style.background = 'rgba(16, 185, 129, 0.1)';
                    syncIndicator.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                    syncIndicator.style.color = '#10b981';
                }
                
                liveResults.forEach(liveItem => {
                    if (liveItem && liveItem.epa) {
                        if (!currentData.epaData[liveItem.team]) {
                            currentData.epaData[liveItem.team] = {};
                        }
                        currentData.epaData[liveItem.team].epa = liveItem.epa;
                        
                        const tdEpa = document.getElementById(`ranking-epa-${liveItem.team}`);
                        if (tdEpa) {
                            tdEpa.innerText = liveItem.epa.total_points.toFixed(1);
                        }
                    }
                });
            }

            // Re-render currently viewed subset to show EPA badges
            if (teamSortSelect) {
                 renderTeams(currentData.teams);
            } else {
                 const term = teamSearch.value.toLowerCase();
                 const filtered = currentData.teams.filter(t =>
                     t.team_number.toString().includes(term) ||
                     (t.nickname && t.nickname.toLowerCase().includes(term))
                 );
                 renderTeams(filtered);
            }

            // Re-render matches to show freshly fetched EPAs
            renderMatches(currentData.matches);
        }
    } catch (e) {
        console.warn('Failed to fetch Team EPA for event:', e);
    }

    // 2. Fetch bulk Match Predictions (with retry for 503/429 Rate Limits)
    let retries = 3;
    while (retries > 0) {
        try {
            const matchesReq = await fetchWithCache(`https://api.statbotics.io/v3/matches?event=${eventKey}`, {}, bypassCache);
            if (matchesReq.ok) {
                const matchesData = await matchesReq.json();
                currentData.matchEPAStats = {};
                matchesData.forEach(matchInfo => {
                    currentData.matchEPAStats[matchInfo.match] = matchInfo;
                });
                break; // Exit retry loop on success
            } else if (matchesReq.status === 429 || matchesReq.status === 503 || matchesReq.status === 500) {
                throw new Error(`Rate limited or Server Error (${matchesReq.status})`);
            }
        } catch (e) {
            retries--;
            if (retries === 0) {
                console.warn('Failed to bulk fetch Match EPAs after retries. The Match Modal will fall back to individual requests or local estimation.', e);
            } else {
                // Wait 30 seconds as requested by the Statbotics 429 response
                console.warn(`Statbotics rate limit hit. Retrying in 30 seconds... (${retries} attempts left)`);
                await new Promise(r => setTimeout(r, 30000));
            }
        }
    }
}

// Background auto-fetch function to determine prior play status
async function checkTeamPlayedStatus(teamKey) {
    const apiKey = apiKeyInput.value.trim();
    const evtKey = eventKeyInput.value.trim();
    const yearMatch = evtKey.match(/^(\d{4})/);
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear();

    try {
        const TTL_LONG = 24 * 60 * 60 * 1000;
        const TTL_SHORT = 2 * 60 * 60 * 1000;

        const eventsReq = await fetchWithCache(`${TBA_API_BASE}/team/${teamKey}/events/${year}/simple`, { headers: { 'X-TBA-Auth-Key': apiKey } }, false, TTL_LONG);
        
        let events = [];
        let isOngoing = false;
        if (eventsReq.ok) {
            events = await eventsReq.json();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            isOngoing = events.some(e => {
                if (!e.start_date || !e.end_date) return false;
                const start = new Date(e.start_date);
                const end = new Date(e.end_date);
                return today >= start && today <= end;
            });
        }
        
        const dynamicTTL = isOngoing ? TTL_SHORT : TTL_LONG;
        
        const statusesReq = await fetchWithCache(`${TBA_API_BASE}/team/${teamKey}/events/${year}/statuses`, { headers: { 'X-TBA-Auth-Key': apiKey } }, false, dynamicTTL);

        if (!eventsReq.ok || !statusesReq.ok) throw new Error();

        const statuses = await statusesReq.json();

        let hasOfficial = false;
        let hasWeek0 = false;

        events.forEach(evt => {
            const status = statuses[evt.key];

            if (status) {
                // Determine if event is truly played (has rank or playoff data)
                const played = (status.qual && status.qual.ranking && status.qual.ranking.rank > 0) || status.playoff || status.alliance;

                if (played) {
                    if (evt.event_type === 100) {
                        hasWeek0 = true;
                    } else if (evt.event_type < 99) {
                        hasOfficial = true;
                    }
                }
            }
        });

        let statusValue = false;
        if (hasOfficial) {
            statusValue = 'official';
        } else if (hasWeek0) {
            statusValue = 'week0';
        }

        currentData.playedStatus[teamKey] = statusValue;

        // Update DOM if badge is currently visible
        const badgeEl = document.getElementById(`badge-${teamKey}`);
        if (badgeEl) {
            if (statusValue === 'official') {
                badgeEl.innerHTML = '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border-color: rgba(16, 185, 129, 0.3); font-size: 0.65rem;"><i class="ph ph-calendar-check"></i> Official Data</span>';
            } else if (statusValue === 'week0') {
                badgeEl.innerHTML = '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #fca5a5; border-color: rgba(239, 68, 68, 0.3); font-size: 0.65rem;"><i class="ph ph-warning"></i> Wk 0 Data</span>';
            } else {
                badgeEl.innerHTML = '<span class="badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-tertiary); border-color: var(--surface-border); font-size: 0.65rem;">No Data</span>';
            }
        }
        
        // If the user is sorting by data availability, re-render to put this newly loaded item in the right spot
        if (teamSortSelect && teamSortSelect.value === 'data-avail') {
             renderTeams(currentData.teams);
        }
    } catch (err) {
        currentData.playedStatus[teamKey] = null; // failed
        const badgeEl = document.getElementById(`badge-${teamKey}`);
        if (badgeEl) badgeEl.innerHTML = '';
    }
}

// Modal Logic
async function openTeamModal(teamKey, teamNumber, teamName) {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) return;

    modalOverlay.classList.remove('hidden');
    modalTeamTitle.innerText = `Team ${teamNumber}`;
    modalTeamName.innerText = teamName || 'Unknown Name';

    // Set loading state
    modalYearSummary.innerHTML = '';
    modalEventsList.innerHTML = `
        <div class="status-container">
            <div class="spinner"></div>
            <p>Loading team history...</p>
        </div>
    `;

    try {
        // We'll use the year from the event key, defaulting to current year if parsing fails
        const evtKey = eventKeyInput.value.trim();
        const yearMatch = evtKey.match(/^(\d{4})/);
        const year = yearMatch ? yearMatch[1] : new Date().getFullYear();

        // Fetch events and statuses 
        const TTL_LONG = 24 * 60 * 60 * 1000;
        const TTL_SHORT = 2 * 60 * 60 * 1000;

        const eventsReq = await fetchWithCache(`${TBA_API_BASE}/team/${teamKey}/events/${year}/simple`, { headers: { 'X-TBA-Auth-Key': apiKey } }, false, TTL_LONG);
        
        let events = [];
        let isOngoing = false;
        if (eventsReq.ok) {
            events = await eventsReq.json();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            isOngoing = events.some(e => {
                if (!e.start_date || !e.end_date) return false;
                const start = new Date(e.start_date);
                const end = new Date(e.end_date);
                return today >= start && today <= end;
            });
        }
        
        const dynamicTTL = isOngoing ? TTL_SHORT : TTL_LONG;

        const [statusesReq, epaReq] = await Promise.all([
            fetchWithCache(`${TBA_API_BASE}/team/${teamKey}/events/${year}/statuses`, { headers: { 'X-TBA-Auth-Key': apiKey } }, isOngoing, dynamicTTL),
            fetchWithCache(`https://api.statbotics.io/v3/team_year/${teamNumber}/${year}`, {}, isOngoing, dynamicTTL).catch(() => null)
        ]);

        if (!eventsReq.ok || !statusesReq.ok) throw new Error('Failed to fetch team details.');

        const statuses = await statusesReq.json();
        let epaData = null;
        if (epaReq && epaReq.ok) epaData = await epaReq.json();

        let districtCutoff = 75;
        if (epaData && epaData.district) {
            try {
                const distReq = await fetchWithCache(`${TBA_API_BASE}/district/${year}${epaData.district}/rankings`, { headers: { 'X-TBA-Auth-Key': apiKey } }, false, TTL_SHORT);
                if (distReq.ok) {
                    const distRanks = await distReq.json();
                    const capacities = { 'fim': 160, 'tx': 85, 'fit': 85, 'ne': 90, 'pnw': 50, 'fma': 60, 'ont': 80, 'chs': 60, 'in': 32, 'fin': 32, 'nc': 40, 'pch': 50, 'isr': 45, 'ca': 100 };
                    const distCap = capacities[epaData.district] || Math.floor(distRanks.length * 0.5) || 50;
                    
                    const activeTeams = distRanks.filter(t => t.point_total > 0);
                    if (activeTeams.length > 0 && distRanks.length > 0) {
                        const advancementRate = distCap / distRanks.length;
                        const currentTargetRank = Math.max(1, Math.floor(activeTeams.length * advancementRate));
                        const cutoffPts = activeTeams[currentTargetRank - 1].point_total;
                        
                        if (cutoffPts > 0) districtCutoff = cutoffPts;
                    }
                }
            } catch (e) { console.error('Failed to parse dynamic district cutoff'); }
        }

        renderTeamHistoryData(teamKey, events, statuses, epaData, evtKey, modalYearSummary, modalEventsList, closeTeamModal, districtCutoff);
    } catch (err) {
        console.error(err);
        modalEventsList.innerHTML = `
            <div class="status-container" style="padding: 2rem;">
                <i class="ph ph-warning-circle" style="font-size: 2rem; color: #ef4444;"></i>
                <p class="error-text">Failed to load team data.</p>
            </div>
        `;
    }
}

function renderTeamHistoryData(teamKey, events, statuses, epaData, currentEvtKey, summaryContainer, listContainer, closeAction, districtCutoff = 75) {
    let officialEvents = events.filter(e => e.event_type < 99);
    let week0Events = events.filter(e => e.event_type === 100);

    // We only consider an event "played" if it actually has stats (e.g. event has passed)
    let hasPlayedOfficial = officialEvents.some(e => {
        const s = statuses[e.key];
        return s && ((s.qual && s.qual.ranking && s.qual.ranking.rank > 0) || s.playoff || s.alliance);
    });
    let hasPlayedWeek0 = week0Events.some(e => {
        const s = statuses[e.key];
        return s && ((s.qual && s.qual.ranking && s.qual.ranking.rank > 0) || s.playoff || s.alliance);
    });

    // Determine which events populate the list and summary 
    // We WANT to include the current event if they haven't played anything else, 
    // or include it with the official events.
    let eventsToDisplay = officialEvents;
    let warningHtml = '';

    // If they have strictly no played official events, but DO have played week 0 events, 
    // show them the week 0 events in addition to upcoming official events.
    if (!hasPlayedOfficial && hasPlayedWeek0) {
        eventsToDisplay = [...week0Events, ...officialEvents];
        warningHtml = '<div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; padding: 0.75rem; border-radius: 8px; font-size: 0.85rem; margin-bottom: 1.5rem;"><i class="ph ph-warning-circle" style="vertical-align: middle; margin-right: 0.25rem; font-size: 1.1rem;"></i> Showing Preseason (Week 0) stats since no official events have been played.</div>';
    }

    // We also want to include the current event in the display list if it isn't already there
    // For instance, if it's an official event but we are showing week 0 stats, we still want to show
    // the current event as an upcoming official event in the history list.
    if (!eventsToDisplay.some(e => e.key === currentEvtKey)) {
        const currentEvtObj = events.find(e => e.key === currentEvtKey);
        if (currentEvtObj) eventsToDisplay.push(currentEvtObj);
    }

    // 1. Calculate Summary Stats
    let totalWins = 0;
    let totalLosses = 0;
    let totalTies = 0;
    let bestRank = Infinity;
    let eventsPlayed = 0;

    // Filter events to only include ones that actually happened and have statuses
    const playedEvents = eventsToDisplay.filter(evt => statuses[evt.key]);

    playedEvents.forEach(evt => {
        const stats = statuses[evt.key];
        if (stats && stats.qual && stats.qual.ranking) {
            const rank = stats.qual.ranking.rank;
            const record = stats.qual.ranking.record;

            // Only aggregate stats if the team has actually completed a match and received a rank integer
            if (rank && rank > 0) {
                if (rank < bestRank) bestRank = rank;

                if (record) {
                    totalWins += record.wins;
                    totalLosses += record.losses;
                    totalTies += record.ties;
                    eventsPlayed++;
                }
            }
        }
    });

    // EPA Breakdown & Rankings
    let epaHtml = '';
    let ranksHtml = '';
    if (epaData && epaData.epa) {
        const epa = epaData.epa.breakdown;
        epaHtml = `
            <div class="section-title" style="margin-top: 1rem; font-size: 1rem;">
                <i class="ph ph-trend-up"></i> EPA Breakdown
            </div>
            <div class="stats-grid" style="margin-bottom: 0.5rem;">
                <div class="stat-card" style="border-color: rgba(99, 102, 241, 0.3);">
                    <div class="stat-value" style="color: #818cf8;">${epaData.epa.total_points.toFixed(1)}</div>
                    <div class="stat-label">Total EPA</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${epa.auto_points.toFixed(1)}</div>
                    <div class="stat-label">Auto EPA</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${epa.teleop_points.toFixed(1)}</div>
                    <div class="stat-label">Teleop EPA</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${epa.endgame_points.toFixed(1)}</div>
                    <div class="stat-label">Endgame EPA</div>
                </div>
            </div>
        `;

        const r = epaData.epa.ranks;
        if (r) {
            const teamNum = teamKey.replace('frc', '');

            // Event types 3 and 4 are Worlds Divisions and Worlds Finals
            const hasCMP = events.some(e => e.event_type === 3 || e.event_type === 4);
            // Event types 2 and 5 are District Championships (and DCMP Divisions)
            const hasDCMP = events.some(e => e.event_type === 2 || e.event_type === 5);

            const badgeStyle = "background: rgba(255,255,255,0.1); color: var(--text-secondary); text-decoration: none; padding: 0.35rem 0.6rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.25rem; border: 1px solid var(--surface-border); transition: all 0.2s;";
            const badgeHover = "this.style.background='rgba(255,255,255,0.2)'";
            const badgeOut = "this.style.background='rgba(255,255,255,0.1)'";

            const greenStyle = "background: rgba(52, 211, 153, 0.2); color: #34d399; text-decoration: none; padding: 0.35rem 0.6rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.25rem; border: 1px solid rgba(52, 211, 153, 0.4); transition: all 0.2s; font-weight: bold;";
            const greenHover = "this.style.background='rgba(52, 211, 153, 0.3)'";
            const greenOut = "this.style.background='rgba(52, 211, 153, 0.2)'";

            ranksHtml = `
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem; font-size: 0.8rem; flex-wrap: wrap;">
                    ${r.total ? `<a href="https://statbotics.io/team/${teamNum}#${epaData.year}" target="_blank" style="${hasCMP ? greenStyle : badgeStyle}" onmouseover="${hasCMP ? greenHover : badgeHover}" onmouseout="${hasCMP ? greenOut : badgeOut}">World Rank: ${r.total.rank} ${hasCMP ? '<i class="ph ph-check-circle"></i>' : ''} <i class="ph ph-arrow-square-out"></i></a>` : ''}
                    ${r.country ? `<a href="https://statbotics.io/team/${teamNum}#${epaData.year}" target="_blank" style="${badgeStyle}" onmouseover="${badgeHover}" onmouseout="${badgeOut}">National Rank: ${r.country.rank} <i class="ph ph-arrow-square-out"></i></a>` : ''}
                    ${r.district ? `<a href="https://statbotics.io/team/${teamNum}#${epaData.year}" target="_blank" style="${hasDCMP ? greenStyle : badgeStyle}" onmouseover="${hasDCMP ? greenHover : badgeHover}" onmouseout="${hasDCMP ? greenOut : badgeOut}">District Rank: ${r.district.rank} ${hasDCMP ? '<i class="ph ph-check-circle"></i>' : ''} <i class="ph ph-arrow-square-out"></i></a>` : ''}
                    ${r.state ? `<a href="https://statbotics.io/team/${teamNum}#${epaData.year}" target="_blank" style="${badgeStyle}" onmouseover="${badgeHover}" onmouseout="${badgeOut}">State Rank: ${r.state.rank} <i class="ph ph-arrow-square-out"></i></a>` : ''}
                </div>
            `;

            // Append District Points Qualification Tracker
            if (epaData.district) {
                const pts = epaData.district_points || 0;
                let needed = Math.max(0, districtCutoff - pts);
                let neededText = needed === 0 ? 'DCMP Secured' : `Points Needed (${districtCutoff} Est.)`;
                let neededVal = needed === 0 ? '0' : needed;
                let neededColor = needed === 0 ? '#34d399' : 'var(--text-tertiary)';

                if (hasDCMP) {
                    neededText = 'Qualified!';
                    neededVal = '<i class="ph ph-check-circle"></i>';
                    neededColor = '#34d399';
                }

                ranksHtml += `
                    <div style="margin-top: 1rem; padding: 0.75rem 1rem; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid var(--surface-border); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;"><i class="ph ph-map-pin"></i> District Points</div>
                            <div style="font-size: 1.25rem; font-weight: bold; color: var(--accent-color);">${pts}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">${neededText}</div>
                            <div style="font-size: 1.25rem; font-weight: bold; color: ${neededColor};">${neededVal}</div>
                        </div>
                    </div>
                `;
            } else {
                // Calculate Mock Regional Points (estimating District point rules)
                let mockPts = 0;

                playedEvents.forEach(evt => {
                    const stats = statuses[evt.key];
                    if (stats) {
                        // 1. Qual Rank Points (approximate table mapping, simplified)
                        if (stats.qual && stats.qual.ranking) {
                            const rank = stats.qual.ranking.rank;
                            const numTeams = stats.qual.num_teams || 40;
                            // District formula approximation: roughly 22 points for rank 1, degrading down
                            const alpha = 1.07;
                            const rankPoints = Math.max(0, Math.ceil(
                                44.0 * (Math.exp(-alpha * (rank - 1.0) / (numTeams - 1.0)) - Math.exp(-alpha)) / (1.0 - Math.exp(-alpha))
                            ) - 22);
                            mockPts += (22 + rankPoints); // Roughly 4-22 base + rank curve
                        }

                        // 2. Alliance Selection Points
                        if (stats.alliance) {
                            const pickNum = stats.alliance.pick;
                            const isCaptain = pickNum === 0;
                            const allianceNum = parseInt(stats.alliance.name.replace('Alliance ', '')) || 8;

                            if (isCaptain) {
                                mockPts += (17 - allianceNum); // Captains 1-8 get 16-9
                            } else if (pickNum === 1) {
                                mockPts += (17 - allianceNum); // 1st picks get 16-9
                            } else {
                                mockPts += (allianceNum); // 2nd/3rd picks get 1-8
                            }
                        }

                        // 3. Playoff Advancement Points
                        if (stats.playoff && stats.playoff.status !== 'eliminated') {
                            const level = stats.playoff.level;
                            if (level === 'qf') mockPts += 5; // Won QF
                            else if (level === 'sf') mockPts += 10; // Won SF (or equivalent in Double Elim)
                            else if (level === 'f') {
                                if (stats.playoff.status === 'won') mockPts += 20; // Won event
                                else mockPts += 15; // Event Finalist
                            }
                        }
                    }
                });

                let needed = Math.max(0, 75 - mockPts);
                let neededText = needed === 0 ? 'DCMP Secured' : 'Points Needed (75 Est.)';
                let neededVal = needed === 0 ? '0' : needed;
                let neededColor = needed === 0 ? '#34d399' : 'var(--text-tertiary)';

                if (hasCMP) {
                    neededText = 'Qualified!';
                    neededVal = '<i class="ph ph-check-circle"></i>';
                    neededColor = '#34d399';
                }

                ranksHtml += `
                    <div style="margin-top: 1rem; padding: 0.75rem 1rem; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid var(--surface-border); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;"><i class="ph ph-map-pin"></i> Regional Points (Est)</div>
                            <div style="font-size: 1.25rem; font-weight: bold; color: var(--accent-color);">${mockPts}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">${neededText}</div>
                            <div style="font-size: 1.25rem; font-weight: bold; color: ${neededColor};">${neededVal}</div>
                        </div>
                    </div>
                `;
            }
        }
    }

    // 2. Render Summary Area
    summaryContainer.innerHTML = `
        ${warningHtml}
        <div class="section-title">
            <i class="ph ph-chart-bar"></i> Year Overview
        </div>
        <div class="stats-grid" style="margin-bottom: 0.5rem;">
            <div class="stat-card">
                <div class="stat-value">${eventsPlayed}</div>
                <div class="stat-label">Events Played</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${bestRank === Infinity ? '-' : bestRank}</div>
                <div class="stat-label">Best Rank</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #34d399;">${totalWins}-${totalLosses}-${totalTies}</div>
                <div class="stat-label">Qual Record</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalWins + totalLosses + totalTies === 0 ? '-' : ((totalWins / (totalWins + totalLosses + totalTies)) * 100).toFixed(1) + '%'}</div>
                <div class="stat-label">Win Rate</div>
            </div>
        </div>
        ${epaHtml}
        ${ranksHtml}
    `;

    // 3. Render Events List
    listContainer.innerHTML = `
        <div class="section-title" style="margin-top: 1rem;">
            <i class="ph ph-calendar"></i> Event History
        </div>
    `;

    if (eventsToDisplay.length === 0) {
        listContainer.innerHTML += '<p class="text-tertiary">No events found for this team this year.</p>';
        return;
    }

    // Sort events by date
    eventsToDisplay.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    eventsToDisplay.forEach(evt => {
        const stats = statuses[evt.key];
        const isPlayed = !!stats;

        let badgesHtml = '';
        if (isPlayed) {
            if (stats.qual && stats.qual.ranking && stats.qual.ranking.rank) {
                badgesHtml += `<span class="badge">Rank ${stats.qual.ranking.rank}</span>`;
            }
            if (stats.alliance) {
                badgesHtml += `<span class="badge" style="background: rgba(99, 102, 241, 0.15); border-color: rgba(99,102,241,0.3); color: #818cf8;">Alliance ${stats.alliance.number}</span>`;
            }
            if (stats.playoff && stats.playoff.status === 'won') {
                badgesHtml += `<span class="badge win"><i class="ph ph-trophy"></i> Winner</span>`;
            }
        } else {
            badgesHtml += `<span class="badge" style="opacity: 0.5;">Upcoming / Playing</span>`;
        }

        const dateStr = new Date(evt.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        const row = document.createElement('div');
        row.className = 'event-row';
        row.innerHTML = `
            <div class="event-header">
                <div class="event-info">
                    <div class="event-name"><span class="event-title-link" data-event="${evt.key}">${evt.name}</span></div>
                    <div class="event-dates">${dateStr} • ${evt.city}, ${evt.state_prov}</div>
                </div>
                <div class="event-badges" style="display:flex; gap: 0.5rem; align-items:center;">
                    ${badgesHtml}
                    <button class="icon-btn toggle-matches-btn" title="View event details">
                        <i class="ph ph-caret-down"></i>
                    </button>
                </div>
            </div>
            <div class="event-matches-content">
                <div class="status-container" style="padding: 1rem;">
                    <div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>
                </div>
            </div>
        `;

        listContainer.appendChild(row);

        // Click to navigate to event
        const titleLink = row.querySelector('.event-title-link');
        titleLink.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevents the accordion from toggling
            const targetEventKey = titleLink.dataset.event;
            eventKeyInput.value = targetEventKey;

            if (closeAction) closeAction();
            // Trigger the main form fetch
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        });

        // Click to toggle and lazy-load details
        const header = row.querySelector('.event-header');
        const contentContainer = row.querySelector('.event-matches-content');
        const toggleIcon = row.querySelector('.toggle-matches-btn i');
        let loaded = false;

        header.addEventListener('click', async () => {
            const isOpen = row.classList.toggle('open');
            toggleIcon.className = isOpen ? 'ph ph-caret-up' : 'ph ph-caret-down';

            if (isOpen && !loaded) {
                loaded = true;
                contentContainer.innerHTML = '<p class="text-tertiary" style="font-size: 0.85rem; padding: 1rem; text-align: center;">Fetching event matches...</p>';

                try {
                    const apiKey = apiKeyInput.value.trim();
                    const req = await fetch(`${TBA_API_BASE}/team/${teamKey}/event/${evt.key}/matches/simple`, {
                        headers: { 'X-TBA-Auth-Key': apiKey }
                    });
                    if (!req.ok) throw new Error('Fetch failed');

                    const matches = await req.json();

                    // Sort matches
                    const compLevelOrd = { 'qm': 1, 'ef': 2, 'qf': 3, 'sf': 4, 'f': 5 };
                    matches.sort((a, b) => {
                        if (compLevelOrd[a.comp_level] !== compLevelOrd[b.comp_level]) {
                            return compLevelOrd[a.comp_level] - compLevelOrd[b.comp_level];
                        }
                        if (a.set_number !== b.set_number) {
                            return a.set_number - b.set_number;
                        }
                        return a.match_number - b.match_number;
                    });

                    // Render mini match list
                    if (matches.length === 0) {
                        contentContainer.innerHTML = '<p class="text-tertiary" style="font-size:0.85rem;">No matches found / Event has not started.</p>';
                    } else {
                        let html = '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
                        matches.forEach(m => {
                            const isRed = m.alliances.red.team_keys.includes(teamKey);
                            const myAlliance = isRed ? m.alliances.red : m.alliances.blue;
                            const theirAlliance = isRed ? m.alliances.blue : m.alliances.red;
                            const won = m.winning_alliance === (isRed ? 'red' : 'blue');
                            const played = m.actual_time !== null;

                            let resultStr = '-';
                            let resultColor = 'var(--text-tertiary)';
                            if (played) {
                                if (m.winning_alliance === '') { resultStr = 'T'; resultColor = '#fbbf24'; }
                                else if (won) { resultStr = 'W'; resultColor = '#34d399'; }
                                else { resultStr = 'L'; resultColor = '#f87171'; }
                            }

                            // Format title
                            let mTitle = '';
                            switch (m.comp_level) {
                                case 'qm': mTitle = `Q${m.match_number}`; break;
                                case 'ef': mTitle = `E${m.match_number}`; break;
                                case 'qf': mTitle = `QF${m.match_number}`; break;
                                case 'sf': mTitle = `SF${m.match_number}`; break;
                                case 'f': mTitle = `F${m.match_number}`; break;
                            }

                            html += `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: rgba(255,255,255,0.02); border-radius: 4px; font-size: 0.85rem;">
                                    <div style="width: 50px; font-weight: 600;">${mTitle}</div>
                                    <div style="flex: 1; text-align: center;">
                                        <span style="color: ${isRed ? 'var(--alliance-red-text)' : 'var(--alliance-blue-text)'}">${played ? myAlliance.score : '?'}</span>
                                        <span style="opacity: 0.5; margin: 0 0.5rem;">-</span>
                                        <span style="color: ${isRed ? 'var(--alliance-blue-text)' : 'var(--alliance-red-text)'}">${played ? theirAlliance.score : '?'}</span>
                                    </div>
                                    <div style="width: 30px; text-align: right; font-weight: 700; color: ${resultColor};">${resultStr}</div>
                                </div>
                            `;
                        });
                        html += '</div>';
                        contentContainer.innerHTML = html;
                    }

                } catch (err) {
                    contentContainer.innerHTML = '<p class="error-text" style="font-size:0.85rem;">Failed to load matches.</p>';
                }
            }
        });
    });
}

// Handle Team Search Filtering
function handleTeamSearch(e) {
    const term = e.target.value.toLowerCase();
    const filtered = currentData.teams.filter(t =>
        t.team_number.toString().includes(term) ||
        (t.nickname && t.nickname.toLowerCase().includes(term))
    );
    renderTeams(filtered);
}

// Render Matches
function renderMatches(matches) {
    if (!matchesList) return;
    matchesList.innerHTML = '';

    // Apply filtering
    const filterTerm = matchTeamFilter ? matchTeamFilter.value.trim().toLowerCase() : '';
    let filteredMatches = matches;
    if (filterTerm) {
        filteredMatches = matches.filter(m => {
            const redTeams = m.alliances.red.team_keys.map(k => k.replace('frc', ''));
            const blueTeams = m.alliances.blue.team_keys.map(k => k.replace('frc', ''));
            return redTeams.includes(filterTerm) || blueTeams.includes(filterTerm);
        });
    }

    if (filteredMatches.length === 0) {
        matchesList.innerHTML = '<p class="text-tertiary" style="text-align:center; padding: 2rem;">No matches found matching criteria.</p>';
        return;
    }

    filteredMatches.forEach(match => {
        const card = document.createElement('div');
        card.className = 'match-card';

        // Formatting standard title e.g. "Quals 1", "Semis 2 Match 1"
        let matchTitle = '';
        switch (match.comp_level) {
            case 'qm': matchTitle = `Qualifiers ${match.match_number}`; break;
            case 'ef': matchTitle = `Eighth Finals ${match.set_number} Match ${match.match_number}`; break;
            case 'qf': matchTitle = `Quarterfinals ${match.set_number} Match ${match.match_number}`; break;
            case 'sf': matchTitle = `Semifinals ${match.set_number} Match ${match.match_number}`; break;
            case 'f': matchTitle = `Finals ${match.match_number}`; break;
            default: matchTitle = match.key;
        }

        const redAlliance = match.alliances.red;
        const blueAlliance = match.alliances.blue;

        const getEpa = (teamKey) => {
            const teamNum = teamKey.replace('frc', '');
            if (currentData.epaData && currentData.epaData[teamNum] && currentData.epaData[teamNum].epa) {
                return currentData.epaData[teamNum].epa.total_points;
            }
            return -999; // Missing EPA sorted to bottom
        };

        const redSortedKeys = [...redAlliance.team_keys].sort((a, b) => getEpa(b) - getEpa(a));
        const blueSortedKeys = [...blueAlliance.team_keys].sort((a, b) => getEpa(b) - getEpa(a));

        const formatTeamInfo = (teamKey, allianceSortedKeys) => {
            const teamNum = teamKey.replace('frc', '');
            
            let epaStr = '-';
            if (currentData.epaData && currentData.epaData[teamNum] && currentData.epaData[teamNum].epa) {
                epaStr = currentData.epaData[teamNum].epa.total_points.toFixed(1);
            }
            
            let rankStr = '-';
            if (currentData.rankings) {
                const rankObj = currentData.rankings.find(r => r.team_key === teamKey);
                if (rankObj) {
                    rankStr = rankObj.rank;
                }
            }

            const epaRank = allianceSortedKeys.indexOf(teamKey);
            let indicatorHtml = '';
            // Only show targets if we actually have EPA data for them
            if (epaStr !== '-') {
                if (epaRank === 0) {
                    indicatorHtml = '<i class="ph-fill ph-crosshair" style="color: #ef4444; margin-left: 0.25rem;" title="Primary Target (1st EPA)"></i>';
                } else if (epaRank === 1) {
                    indicatorHtml = '<i class="ph-fill ph-target" style="color: #f59e0b; margin-left: 0.25rem; font-size: 0.9em;" title="Secondary Target (2nd EPA)"></i>';
                }
            }
            
            return `
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <span style="font-size: 1.1em; font-weight: bold; display: flex; align-items: center;">${teamNum}${indicatorHtml}</span>
                    <span style="font-size: 0.7em; opacity: 0.8; font-weight: normal; margin-top: 0.1rem; line-height: 1.1;">EPA: ${epaStr}</span>
                    <span style="font-size: 0.7em; opacity: 0.8; font-weight: normal; line-height: 1.1;">Rank: ${rankStr}</span>
                </div>
            `;
        };

        const redTeamsStr = redAlliance.team_keys.map(k => formatTeamInfo(k, redSortedKeys)).join('');
        const blueTeamsStr = blueAlliance.team_keys.map(k => formatTeamInfo(k, blueSortedKeys)).join('');

        const isRedWinner = match.winning_alliance === 'red';
        const isBlueWinner = match.winning_alliance === 'blue';
        const isPlayed = match.actual_time !== null;

        // Video Link logic
        let videoLinkHTML = '';
        if (match.videos && match.videos.length > 0) {
            // Prefer YouTube
            const ytVideo = match.videos.find(v => v.type === 'youtube');
            if (ytVideo) {
                videoLinkHTML = `
                    <a href="https://youtube.com/watch?v=${ytVideo.key}" target="_blank" rel="noopener noreferrer" class="video-link" title="Watch Match Video">
                        <i class="ph ph-youtube-logo" style="font-size:1.2rem;"></i> Watch
                    </a>
                `;
            }
        }

        // Time logic (fallback to scheduled if not played, or just empty)
        const timeStamp = match.actual_time || match.predicted_time || match.time;
        let timeStr = '';
        if (timeStamp) {
            const offsetMins = matchTimeOffset ? (parseInt(matchTimeOffset.value) || 0) : 0;
            const date = new Date((timeStamp + (offsetMins * 60)) * 1000);
            timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        // Add playoff class highlighting normally to visually separate playoff matches
        if (match.comp_level !== 'qm') {
            card.style.borderLeft = '4px solid var(--accent-color)';
        }

        card.innerHTML = `
            <div class="match-header">
                <div class="match-title">
                    <i class="ph ph-flag-pennant"></i>
                    ${matchTitle}
                </div>
                <div class="match-time">${timeStr}</div>
            </div>
            <div class="match-content">
                <div class="alliance red ${isRedWinner ? 'winner' : ''}">
                    <div class="alliance-teams">${redTeamsStr}</div>
                    <div class="alliance-score">${isPlayed ? redAlliance.score : '-'}</div>
                </div>
                
                <div class="vs-divider">
                    <span style="font-size: 0.8em; opacity: 0.5;">VS</span>
                    ${videoLinkHTML}
                </div>

                <div class="alliance blue ${isBlueWinner ? 'winner' : ''}">
                    <div class="alliance-teams">${blueTeamsStr}</div>
                    <div class="alliance-score">${isPlayed ? blueAlliance.score : '-'}</div>
                </div>
            </div>
        `;

        // Click event to open strategy predictor
        card.addEventListener('click', () => openMatchModal(match));

        matchesList.appendChild(card);
    });
}

function renderAlliances(alliances) {
    if (!alliancesContainer || !alliancesGrid) return;
    alliancesGrid.innerHTML = '';

    if (!alliances || alliances.length === 0) {
        alliancesContainer.classList.add('hidden');
        return;
    }

    alliancesContainer.classList.remove('hidden');

    alliances.forEach((alliance, idx) => {
        const title = alliance.name || `Alliance ${idx + 1}`;
        const picks = alliance.picks.map(p => p.replace('frc', ''));
        const captain = picks[0];

        let subPicksHtml = '';
        if (picks.length > 1) {
            subPicksHtml = picks.slice(1).map((p, i) => `<span style="opacity: 0.8;">Pick ${i + 1}: </span><strong>${p}</strong>`).join('<br>');
        }

        const card = document.createElement('div');
        card.className = 'glass-panel';
        card.style.padding = '1rem';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '0.5rem';

        card.innerHTML = `
            <div style="font-weight: 700; color: var(--accent-color); font-size: 1.1rem; border-bottom: 1px solid var(--surface-border); padding-bottom: 0.5rem;">${title}</div>
            <div style="font-size: 0.95rem;">
                <div style="margin-bottom: 0.25rem;"><span style="opacity: 0.8;">Captain: </span><strong style="font-size: 1.1em;">${captain}</strong></div>
                ${subPicksHtml}
            </div>
        `;
        alliancesGrid.appendChild(card);
    });
}

// Open Match Predictor
async function openMatchModal(match) {
    matchModalOverlay.classList.remove('hidden');
    let title = match.comp_level.toUpperCase() + ' ';
    if (match.comp_level === 'qm') {
        title += match.match_number;
    } else {
        title += `${match.set_number} Match ${match.match_number}`;
    }
    matchModalTitle.innerText = title;
    matchModalLoading.classList.remove('hidden');
    matchModalStats.classList.add('hidden');
    matchModalStats.innerHTML = '';

    try {
        let predData = null;

        // Check Batch Cache First
        if (currentData.matchEPAStats && currentData.matchEPAStats[match.key] && currentData.matchEPAStats[match.key].pred) {
            predData = currentData.matchEPAStats[match.key].pred;
        } else {
            // Fallback to fetch if not found in batch
            const req = await fetchWithCache(`https://api.statbotics.io/v3/match/${match.key}`);
            if (!req.ok) {
                if (req.status === 404) throw new Error('data_missing');
                if (req.status === 429) throw new Error('rate_limit');
                throw new Error('network_error');
            }
            const data = await req.json();
            if (!data.pred) throw new Error('data_missing');
            predData = data.pred;
        }

        const redProb = (predData.red_win_prob * 100).toFixed(1);
        const blueProb = ((1 - predData.red_win_prob) * 100).toFixed(1);

        const winProbHtml = `
            <div style="margin-bottom: 2rem;">
                <h3 style="text-align: center; margin-bottom: 0.5rem; font-size: 1.1rem; color: var(--text-secondary);">Win Probability</h3>
                <div style="display: flex; height: 32px; border-radius: 16px; overflow: hidden; font-weight: bold; color: white; align-items: stretch;">
                    <div style="width: ${redProb}%; background: rgba(239, 68, 68, 0.85); display: flex; align-items: center; justify-content: flex-start; padding-left: 1rem; transition: width 0.5s;">
                        ${redProb}%
                    </div>
                    <div style="width: ${blueProb}%; background: rgba(59, 130, 246, 0.85); display: flex; align-items: center; justify-content: flex-end; padding-right: 1rem; transition: width 0.5s;">
                        ${blueProb}%
                    </div>
                </div>
            </div>
        `;

        const scoreHtml = `
            <div style="display: flex; justify-content: space-around; margin-bottom: 1.5rem; text-align: center; background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--surface-border);">
                <div>
                    <div style="font-size: 2.5rem; font-weight: 800; color: #ef4444; line-height: 1;">${predData.red_score.toFixed(1)}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem; letter-spacing: 0.05em; text-transform: uppercase;">Red EPA Sum</div>
                </div>
                <div style="font-size: 1.5rem; font-weight: bold; color: var(--text-tertiary); display: flex; align-items: center;">
                    VS
                </div>
                <div>
                    <div style="font-size: 2.5rem; font-weight: 800; color: #3b82f6; line-height: 1;">${predData.blue_score.toFixed(1)}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem; letter-spacing: 0.05em; text-transform: uppercase;">Blue EPA Sum</div>
                </div>
            </div>
        `;

        matchModalStats.innerHTML = winProbHtml + scoreHtml;
        matchModalLoading.classList.add('hidden');
        matchModalStats.classList.remove('hidden');

    } catch (e) {
        // Fallback: Calculate manually using Team EPAs
        try {
            const evtKey = document.getElementById('event-key').value.trim();
            const yearMatch = evtKey.match(/^(\d{4})/);
            const year = yearMatch ? yearMatch[1] : new Date().getFullYear();

            const redTeams = match.alliances.red.team_keys.map(k => parseInt(k.replace('frc', '')));
            const blueTeams = match.alliances.blue.team_keys.map(k => parseInt(k.replace('frc', '')));

            const getEpa = async (teamNum) => {
                if (currentData.epaData && currentData.epaData[teamNum] && currentData.epaData[teamNum].epa) {
                    return currentData.epaData[teamNum].epa.total_points;
                }
                try {
                    const req = await fetch(`https://api.statbotics.io/v3/team_year/${teamNum}/${year}`);
                    if (req.ok) {
                        const data = await req.json();
                        if (data && data.epa) return data.epa.total_points;
                    }
                } catch (err) { }
                return 25.0; // Baseline fallback
            };

            const redEpas = await Promise.all(redTeams.map(t => getEpa(t)));
            const blueEpas = await Promise.all(blueTeams.map(t => getEpa(t)));

            const redScore = redEpas.reduce((a, b) => a + b, 0);
            const blueScore = blueEpas.reduce((a, b) => a + b, 0);

            // Simple win probability estimation
            let redProb = 50;
            let blueProb = 50;
            const diff = redScore - blueScore;
            // Approx 1% per point difference, capped at 99%
            redProb = Math.min(Math.max(50 + diff, 1), 99).toFixed(1);
            blueProb = (100 - redProb).toFixed(1);

            const winProbHtml = `
                <div style="margin-bottom: 2rem;">
                    <h3 style="text-align: center; margin-bottom: 0.5rem; font-size: 1.1rem; color: var(--text-secondary);">Win Probability (Estimated EPA Fallback)</h3>
                    <div style="display: flex; height: 32px; border-radius: 16px; overflow: hidden; font-weight: bold; color: white; align-items: stretch;">
                        <div style="width: ${redProb}%; background: rgba(239, 68, 68, 0.85); display: flex; align-items: center; justify-content: flex-start; padding-left: 1rem; transition: width 0.5s;">
                            ${redProb}%
                        </div>
                        <div style="width: ${blueProb}%; background: rgba(59, 130, 246, 0.85); display: flex; align-items: center; justify-content: flex-end; padding-right: 1rem; transition: width 0.5s;">
                            ${blueProb}%
                        </div>
                    </div>
                </div>
            `;

            const scoreHtml = `
                <div style="display: flex; justify-content: space-around; margin-bottom: 1.5rem; text-align: center; background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--surface-border);">
                    <div>
                        <div style="font-size: 2.5rem; font-weight: 800; color: #ef4444; line-height: 1;">${redScore.toFixed(1)}</div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem; letter-spacing: 0.05em; text-transform: uppercase;">Red EPA Sum</div>
                    </div>
                    <div style="font-size: 1.5rem; font-weight: bold; color: var(--text-tertiary); display: flex; align-items: center;">
                        VS
                    </div>
                    <div>
                        <div style="font-size: 2.5rem; font-weight: 800; color: #3b82f6; line-height: 1;">${blueScore.toFixed(1)}</div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem; letter-spacing: 0.05em; text-transform: uppercase;">Blue EPA Sum</div>
                    </div>
                </div>
            `;

            matchModalStats.innerHTML = winProbHtml + scoreHtml;
            matchModalLoading.classList.add('hidden');
            matchModalStats.classList.remove('hidden');

        } catch (fallbackErr) {
            matchModalLoading.classList.add('hidden');

            let errorTitle = 'Prediction API Unexpected Error';
            let errorDesc = 'Statbotics prediction models could not be reached. Showing estimated local EPA fallback.';
            let errorIcon = 'ph-warning-circle';

            if (e.message === 'data_missing') {
                errorTitle = 'Prediction Data Unavailable';
                errorDesc = 'Statbotics prediction models have not parsed this match yet, or it is an unofficial event (like Week 0). Showing estimated local EPA fallback.';
                errorIcon = 'ph-prohibit';
            } else if (e.message === 'rate_limit') {
                errorTitle = 'API Rate Limited (429)';
                errorDesc = 'Too many requests were sent to the Statbotics API in a short time. Showing estimated local EPA fallback.';
                errorIcon = 'ph-hourglass-high';
            } else if (e.message === 'network_error') {
                errorTitle = 'Network Connection Failed';
                errorDesc = 'Could not connect to the Statbotics server. Showing estimated local EPA fallback.';
                errorIcon = 'ph-wifi-slash';
            }

            matchModalStats.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); padding: 1.5rem; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px dashed var(--surface-border); margin-bottom: 2rem;">
                    <i class="ph ${errorIcon}" style="font-size: 2rem; margin-bottom: 0.5rem; display: block; color: var(--accent-secondary);"></i>
                    <span style="font-weight: bold; font-size: 1.1rem; color: var(--text-primary);">${errorTitle}</span>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem; opacity: 0.8;">${errorDesc}</p>
                </div>
            ` + winProbHtml + scoreHtml;

            matchModalStats.classList.remove('hidden');
        }
    }
}

// Render Rankings
function renderRankings(rankings) {
    if (!rankingsBody) return;
    rankingsBody.innerHTML = '';

    if (!rankings || rankings.length === 0) {
        rankingsBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-tertiary);">No rankings available yet.</td></tr>';
        return;
    }

    rankings.forEach(row => {
        const teamNum = row.team_key.replace('frc', '');

        let recordStr = '-';
        if (row.record) recordStr = `${row.record.wins}-${row.record.losses}-${row.record.ties}`;

        // Find average RP from sort orders normally or if RP is provided
        // TBA sort order 0 is usually ranking score (Avg RP) for modern games.
        let avgRpStr = '-';
        if (row.sort_orders && row.sort_orders.length > 0) {
            avgRpStr = row.sort_orders[0].toFixed(2);
        }

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--surface-border)';
        tr.style.transition = 'background 0.2s';
        tr.style.cursor = 'pointer';

        // Hover logic
        tr.addEventListener('mouseenter', () => tr.style.background = 'rgba(255,255,255,0.02)');
        tr.addEventListener('mouseleave', () => tr.style.background = 'transparent');

        // EPA lookup
        let epaStr = '-';
        if (currentData.epaData[teamNum] && currentData.epaData[teamNum].epa) {
            epaStr = currentData.epaData[teamNum].epa.total_points.toFixed(1);
        }

        // District Points lookup
        let districtPtsStr = '-';
        if (currentData.districtPoints && currentData.districtPoints[row.team_key] && currentData.districtPoints[row.team_key].total !== undefined) {
            districtPtsStr = currentData.districtPoints[row.team_key].total;
        } else {
            // Estimate District Points if event is in progress and TBA doesn't have them yet
            let qualPoints = 0;
            const N = rankings.length;
            const R = row.rank;
            const alpha = 1.07;
            
            // Winitzki's approximation for inverse error function
            const erfinv = (x) => {
                const a = 0.147;
                const ln1minusx2 = Math.log(1 - x * x);
                const p1 = 2 / (Math.PI * a) + ln1minusx2 / 2;
                const p2 = ln1minusx2 / a;
                const sign = x < 0 ? -1 : 1;
                return sign * Math.sqrt(Math.sqrt(Math.max(0, p1 * p1 - p2)) - p1);
            };

            if (N > 0) {
                const val = (N - 2 * R + 2) / (alpha * N);
                qualPoints = Math.round(12 + (10 / erfinv(1 / alpha)) * erfinv(val));
            }

            // 2. Alliance Selection Points
            let alliancePoints = 0;
            let eventWinner = false;
            if (currentData.alliances && currentData.alliances.length > 0) {
                currentData.alliances.forEach((alliance, index) => {
                    if (alliance.picks) {
                        const pickOrder = alliance.picks.indexOf(row.team_key);
                        if (pickOrder !== -1) {
                            const allianceRank = index + 1;
                            if (pickOrder === 0 || pickOrder === 1) { // Captain or Pick 1
                                alliancePoints = 17 - allianceRank;
                            } else if (pickOrder === 2 || pickOrder === 3) { // Pick 2 or Pick 3
                                alliancePoints = allianceRank;
                            }
                            // Event Winner check
                            if (alliance.status && alliance.status.status === 'won') {
                                eventWinner = true;
                            }
                        }
                    }
                });
            }

            // 3. Playoff Points (Double Elimination)
            let elimPoints = 0;
            if (currentData.matches && currentData.matches.length > 0) {
                currentData.matches.forEach(m => {
                    if (m.comp_level !== 'qm' && m.comp_level !== 'f' && m.winning_alliance) {
                        const winnerKeys = m.alliances[m.winning_alliance]?.team_keys || [];
                        if (winnerKeys.includes(row.team_key)) {
                            elimPoints += 7; // 7 points per bracket win
                        }
                    }
                });
            }
            if (eventWinner) {
                elimPoints += 30; // 30 points for event champion
            }

            const estimatedTotal = Math.max(0, qualPoints + alliancePoints + elimPoints);
            if (estimatedTotal > 0) {
                districtPtsStr = `${estimatedTotal} <span style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 400;">(Est)</span>`;
            }
        }

        tr.innerHTML = `
            <td style="padding: 1rem 0.5rem; font-weight: 600;">${row.rank}</td>
            <td style="padding: 1rem 0.5rem;">
                <span style="font-size: 1.1rem; font-weight: 700;">${teamNum}</span>
            </td>
            <td style="padding: 1rem 0.5rem; color: #34d399;">${recordStr}</td>
            <td style="padding: 1rem 0.5rem; font-family: monospace;">${avgRpStr}</td>
            <td style="padding: 1rem 0.5rem; font-weight: 600; color: #818cf8;" id="ranking-epa-${teamNum}">${epaStr}</td>
            <td style="padding: 1rem 0.5rem; font-weight: 600; color: var(--text-primary);">${districtPtsStr}</td>
        `;

        tr.addEventListener('click', () => {
            const teamInfo = currentData.teams.find(t => t.team_number == teamNum);
            if (teamInfo) {
                openTeamModal(teamInfo.key, teamInfo.team_number, teamInfo.nickname);
            }
        });

        rankingsBody.appendChild(tr);
    });
}

// --- Competition Simulator ---
async function runSimulator() {
    if (!currentData.teams || currentData.teams.length === 0) {
        alert("Please fetch an event first.");
        return;
    }

    try {
        runSimBtn.disabled = true;
        simResults.classList.add('hidden');
        simStatus.classList.remove('hidden');
        simStatusText.innerText = 'Fetching historical EPA data for all teams...';

    const currentYear = new Date().getFullYear();
    const eventYearMatch = eventKeyInput.value.trim().match(/^(\d{4})/);
    const eventYear = eventYearMatch ? parseInt(eventYearMatch[1]) : currentYear;
    const weights = [0.60, 0.25, 0.10, 0.05]; // current, -1, -2, -3

    // 1. Calculate Composite EPA for each team
    const teamEPAs = {}; // teamNum => predicted EPA
    const teamNums = currentData.teams.map(t => t.team_number);

    for (let i = 0; i < teamNums.length; i++) {
        const teamNum = teamNums[i];
        let compEpa = 0;
        let weightSum = 0;

        // Fetch current event year
        if (currentData.epaData[teamNum] && currentData.epaData[teamNum].epa) {
            compEpa += currentData.epaData[teamNum].epa.total_points * weights[0];
            weightSum += weights[0];
        } else {
            try {
                const req = await fetch(`https://api.statbotics.io/v3/team_year/${teamNum}/${eventYear}`);
                if (req.ok) {
                    const data = await req.json();
                    if (data && data.epa) {
                        compEpa += data.epa.total_points * weights[0];
                        weightSum += weights[0];
                    }
                }
            } catch (e) { }
        }

        // Fetch historical years concurrently
        const promises = [];
        for (let y = 1; y <= 3; y++) {
            promises.push(
                fetch(`https://api.statbotics.io/v3/team_year/${teamNum}/${eventYear - y}`)
                    .then(res => res.ok ? res.json() : null)
                    .catch(() => null)
            );
        }

        const histData = await Promise.all(promises);
        histData.forEach((data, idx) => {
            if (data && data.epa && data.epa.total_points) {
                compEpa += data.epa.total_points * weights[idx + 1];
                weightSum += weights[idx + 1];
            }
        });

        // Normalize
        teamEPAs[teamNum] = weightSum > 0 ? (compEpa / weightSum) : 25.0; // Baseline FRC median

        // Update UI Progress
        if (i % 5 === 0) {
            simStatusText.innerText = `Fetching historical data... (${Math.round((i / teamNums.length) * 100)}%)`;
        }
    }

    simStatusText.innerText = 'Simulating Qualification Matches...';

    // 2. Predict Qualification Rankings
    const simStandings = {};
    teamNums.forEach(t => simStandings[t] = { rp: 0, epa: teamEPAs[t], wins: 0, matches: 0 });

    let qualMatches = currentData.matches ? currentData.matches.filter(m => m.comp_level === 'qm') : [];
    const simulatedMatches = [];

    if (qualMatches.length > 0) {
        qualMatches.forEach(match => {
            const redTeams = match.alliances.red.team_keys.map(k => parseInt(k.replace('frc', '')));
            const blueTeams = match.alliances.blue.team_keys.map(k => parseInt(k.replace('frc', '')));

            const redEpa = redTeams.reduce((sum, t) => sum + (teamEPAs[t] || 25), 0);
            const blueEpa = blueTeams.reduce((sum, t) => sum + (teamEPAs[t] || 25), 0);

            let redRp = 0; let blueRp = 0;

            if (redEpa > blueEpa) {
                redRp += 2;
                if (redEpa > blueEpa + 15) redRp += 1; // Bonus RP estimator
                redTeams.forEach(t => { if (simStandings[t]) simStandings[t].wins++; });
            } else if (blueEpa > redEpa) {
                blueRp += 2;
                if (blueEpa > redEpa + 15) blueRp += 1; // Bonus RP estimator
                blueTeams.forEach(t => { if (simStandings[t]) simStandings[t].wins++; });
            } else {
                redRp += 1; blueRp += 1; // Tie
            }

            redTeams.forEach(t => { if (simStandings[t]) { simStandings[t].rp += redRp; simStandings[t].matches++; } });
            blueTeams.forEach(t => { if (simStandings[t]) { simStandings[t].rp += blueRp; simStandings[t].matches++; } });

            simulatedMatches.push({
                matchObj: match,
                redEpa: redEpa,
                blueEpa: blueEpa,
                redRp: redRp,
                blueRp: blueRp,
                winner: redEpa > blueEpa ? 'red' : (blueEpa > redEpa ? 'blue' : 'tie')
            });
        });
    } else {
        // Estimate RP strictly by EPA power distribution
        teamNums.forEach(t => {
            simStandings[t].rp = Math.floor(teamEPAs[t] * 0.4);
            simStandings[t].matches = 12; // Assuming 12 quals
        });
    }

    const sortedRanks = Object.keys(simStandings).map(t => parseInt(t)).sort((a, b) => {
        // Sort by average RP
        const aRp = simStandings[a].matches > 0 ? (simStandings[a].rp / simStandings[a].matches) : simStandings[a].rp;
        const bRp = simStandings[b].matches > 0 ? (simStandings[b].rp / simStandings[b].matches) : simStandings[b].rp;
        if (Math.abs(bRp - aRp) > 0.01) return bRp - aRp;
        // Tie breaker by EPA
        return simStandings[b].epa - simStandings[a].epa;
    });

    simStatusText.innerText = 'Drafting Alliances...';

    // 3. Draft Alliances
    const alliances = [];
    let availableTeams = [...sortedRanks];

    // Captains 1-8
    for (let i = 0; i < 8; i++) {
        if (availableTeams.length > 0) {
            alliances.push({ captain: availableTeams.shift(), picks: [] });
        }
    }

    // First Picks (Captains pick the highest true EPA remaining)
    for (let i = 0; i < 8; i++) {
        if (alliances[i] && availableTeams.length > 0) {
            availableTeams.sort((a, b) => simStandings[b].epa - simStandings[a].epa);
            alliances[i].picks.push(availableTeams.shift());
        }
    }

    // Second Picks (Serpentine draft)
    for (let i = 7; i >= 0; i--) {
        if (alliances[i] && availableTeams.length > 0) {
            availableTeams.sort((a, b) => simStandings[b].epa - simStandings[a].epa);
            alliances[i].picks.push(availableTeams.shift());
        }
    }

    alliances.forEach(a => {
        a.totalEpa = teamEPAs[a.captain] +
            (a.picks[0] ? teamEPAs[a.picks[0]] : 0) +
            (a.picks[1] ? teamEPAs[a.picks[1]] : 0);
    });

    simStatusText.innerText = 'Simulating Playoffs...';

    // 4. Simulate Playoffs
    const advance = (a1, a2) => (a1.totalEpa > a2.totalEpa ? a1 : a2);
    let winner = null;

    if (alliances.length === 8) {
        const sf1 = advance(alliances[0], alliances[7]);
        const sf2 = advance(alliances[3], alliances[4]);
        const sf3 = advance(alliances[1], alliances[6]);
        const sf4 = advance(alliances[2], alliances[5]);

        const f1 = advance(sf1, sf2);
        const f2 = advance(sf3, sf4);

        winner = advance(f1, f2);
    } else {
        winner = alliances[0] || null;
    }

    // 5. Render Results
    simRankingsBody.innerHTML = '';
    sortedRanks.forEach((t, i) => {
        const stats = simStandings[t];
        const avgRp = stats.matches > 0 ? (stats.rp / stats.matches).toFixed(2) : stats.rp.toFixed(2);
        simRankingsBody.innerHTML += `
            <tr style="border-bottom: 1px solid var(--surface-border);">
                <td style="padding: 0.75rem 0.5rem; font-weight: 600;">${i + 1}</td>
                <td style="padding: 0.75rem 0.5rem; color: var(--accent-color); font-weight: 700;">${t}</td>
                <td style="padding: 0.75rem 0.5rem;">${avgRp} <span style="color: var(--text-tertiary); font-size: 0.75rem; margin-left: 0.25rem;">(${stats.epa.toFixed(1)} EPA)</span></td>
            </tr>
        `;
    });

    // 6. Render Match Breakdown
    simMatchesBody.innerHTML = '';
    if (simulatedMatches.length > 0) {
        simulatedMatches.sort((a, b) => a.matchObj.match_number - b.matchObj.match_number);

        simulatedMatches.forEach(sim => {
            const redKeys = sim.matchObj.alliances.red.team_keys.map(k => k.replace('frc', '')).join(', ');
            const blueKeys = sim.matchObj.alliances.blue.team_keys.map(k => k.replace('frc', '')).join(', ');

            simMatchesBody.innerHTML += `
                <tr style="border-bottom: 1px solid var(--surface-border); background: rgba(255,255,255,0.02);">
                    <td style="padding: 0.75rem 0.5rem; font-weight: 600; text-align: left;">Q${sim.matchObj.match_number}</td>
                    <td style="padding: 0.75rem 0.5rem; font-size: 0.8rem;">${redKeys}</td>
                    <td style="padding: 0.75rem 0.5rem; font-size: 0.8rem;">${blueKeys}</td>
                    <td style="padding: 0.75rem 0.5rem;">
                        <span style="color: var(--alliance-red-text); ${(sim.winner === 'red' || sim.winner === 'tie') ? 'font-weight: bold;' : ''}">${Math.round(sim.redEpa)}</span>
                        <span style="color: var(--text-tertiary); margin: 0 0.5rem;">-</span>
                        <span style="color: var(--alliance-blue-text); ${(sim.winner === 'blue' || sim.winner === 'tie') ? 'font-weight: bold;' : ''}">${Math.round(sim.blueEpa)}</span>
                    </td>
                    <td style="padding: 0.75rem 0.5rem;">
                        <span style="color: var(--alliance-red-text);">${sim.redRp} RP</span>
                        <span style="color: var(--text-tertiary); margin: 0 0.25rem;">/</span>
                        <span style="color: var(--alliance-blue-text);">${sim.blueRp} RP</span>
                    </td>
                </tr>
            `;
        });
    } else {
        simMatchesBody.innerHTML = '<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-tertiary);">No qualification matches found to simulate.</td></tr>';
    }

    simAlliancesList.innerHTML = '';
    alliances.forEach((a, i) => {
        simAlliancesList.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid var(--surface-border);">
                <div style="font-weight: 600;">Alliance ${i + 1}</div>
                <div style="color: var(--text-secondary); text-align: right;">
                    <span style="color: var(--accent-color); font-weight: 700;">${a.captain}</span> 
                    ${a.picks[0] ? `+ ${a.picks[0]}` : ''} 
                    ${a.picks[1] ? `+ ${a.picks[1]}` : ''}
                    <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem;">Power: ${a.totalEpa.toFixed(1)}</div>
                </div>
            </div>
        `;
    });

    if (winner) {
        const champNum = alliances.indexOf(winner) + 1;
        simChampionCard.innerHTML = `
            <i class="ph ph-medal" style="font-size: 4rem; color: #fbbf24; margin-bottom: 1rem;"></i>
            <h2 style="color: #fbbf24; margin-bottom: 0.5rem; font-size: 1.75rem;">Alliance ${champNum} Wins!</h2>
            <p style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">
                <span style="color: var(--accent-color);">${winner.captain}</span> 
                ${winner.picks[0] ? `<span style="color: var(--text-secondary);">+</span> ${winner.picks[0]}` : ''} 
                ${winner.picks[1] ? `<span style="color: var(--text-secondary);">+</span> ${winner.picks[1]}` : ''}
            </p>
            <div style="display: inline-block; padding: 0.5rem 1rem; background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; color: #fbbf24; font-weight: 600;">
                Projected EPA Power: ${winner.totalEpa.toFixed(1)}
            </div>
        `;
    }

        simStatus.classList.add('hidden');
        simResults.classList.remove('hidden');
    } catch (error) {
        console.error('Simulation failed:', error);
        simStatusText.innerText = 'Simulation failed. Please try again.';
    } finally {
        simStatus.classList.add('hidden');
        runSimBtn.disabled = false;
    }
}

// Run Initialization
init();
