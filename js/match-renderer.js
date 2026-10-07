function handleTeamSearch(e) {
    renderTeams(currentData.teams);
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
                    <span style="font-size: 1.1em; font-weight: bold; display: flex; align-items: center;">${escapeHtml(teamNum)}${indicatorHtml}</span>
                    <span style="font-size: 0.7em; opacity: 0.8; font-weight: normal; margin-top: 0.1rem; line-height: 1.1;">EPA: ${epaStr}</span>
                    <span style="font-size: 0.7em; opacity: 0.8; font-weight: normal; line-height: 1.1;">Rank: ${escapeHtml(rankStr)}</span>
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
                    <a href="https://youtube.com/watch?v=${encodeURIComponent(ytVideo.key)}" target="_blank" rel="noopener noreferrer" class="video-link" title="Watch Match Video">
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
                    ${escapeHtml(matchTitle)}
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
        const title = escapeHtml(alliance.name || `Alliance ${idx + 1}`);
        const picks = alliance.picks.map(p => p.replace('frc', ''));
        const captain = escapeHtml(picks[0] || '');

        let subPicksHtml = '';
        if (picks.length > 1) {
            subPicksHtml = picks.slice(1).map((p, i) => `<span style="opacity: 0.8;">Pick ${i + 1}: </span><strong>${escapeHtml(p)}</strong>`).join('<br>');
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
