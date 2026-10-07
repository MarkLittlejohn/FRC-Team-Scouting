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
