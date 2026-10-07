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

