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
        <p>Fetching data for event <strong>${escapeHtml(eventKey)}</strong>...</p>
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
            <p class="error-text">${escapeHtml(err.message)}</p>
            <p style="font-size: 0.85rem;">Check the console for more details.</p>
        `;
    } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector('span').innerText = 'Fetch Data';
    }
}

// Render Teams
