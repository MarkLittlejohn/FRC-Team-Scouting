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
        const safeTeamKey = escapeHtml(team.key);
        const safeNickname = escapeHtml(team.nickname || 'Unknown Name');
        const safeLocation = escapeHtml(locationStr || 'Location Unknown');

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
                   <div id="badge-${safeTeamKey}">${badgeHtml}</div>
                </div>
            </div>
            <div class="team-name" title="${safeNickname}">${safeNickname}</div>
            <div class="team-location">
                <i class="ph ph-map-pin"></i>
                <span title="${safeLocation}">${safeLocation}</span>
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
