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

