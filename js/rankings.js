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
            <td style="padding: 1rem 0.5rem; font-weight: 600;">${escapeHtml(row.rank)}</td>
            <td style="padding: 1rem 0.5rem;">
                <span style="font-size: 1.1rem; font-weight: 700;">${escapeHtml(teamNum)}</span>
            </td>
            <td style="padding: 1rem 0.5rem; color: #34d399;">${escapeHtml(recordStr)}</td>
            <td style="padding: 1rem 0.5rem; font-family: monospace;">${escapeHtml(avgRpStr)}</td>
            <td style="padding: 1rem 0.5rem; font-weight: 600; color: #818cf8;" id="ranking-epa-${escapeHtml(teamNum)}">${escapeHtml(epaStr)}</td>
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
