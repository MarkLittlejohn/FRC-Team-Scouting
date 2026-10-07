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

