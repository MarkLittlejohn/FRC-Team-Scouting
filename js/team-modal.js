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
                    <div class="event-name"><span class="event-title-link" data-event="${escapeHtml(evt.key)}">${escapeHtml(evt.name)}</span></div>
                    <div class="event-dates">${escapeHtml(dateStr)} • ${escapeHtml(evt.city)}, ${escapeHtml(evt.state_prov)}</div>
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
