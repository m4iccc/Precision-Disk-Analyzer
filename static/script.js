document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded and parsed.");

    // --- Get references to elements (CRITICAL: Check IDs carefully!) ---
    const pathInput = document.getElementById('pathInput');
    const analyzeButton = document.getElementById('analyzeButton');
    const upButton = document.getElementById('upButton');
    const refreshButton = document.getElementById('refreshButton');
    const resultsBody = document.getElementById('resultsBody');         // Check HTML: <tbody id="resultsBody">
    const errorDisplay = document.getElementById('errorDisplay');       // Check HTML: <div id="errorDisplay">...</div>
    const infoDisplay = document.getElementById('infoDisplay');         // Check HTML: <div id="infoDisplay">...</div>
    const loadingIndicator = document.getElementById('loadingIndicator'); // Check HTML: <div id="loadingIndicator">...</div>
    const loadingStatusText = document.getElementById('loadingStatusText'); // Check HTML: <span id="loadingStatusText">...</span>
    const currentPathDisplay = document.getElementById('currentPathDisplay'); // Check HTML: <div id="currentPathDisplay">...</div>
    const summaryDisplay = document.getElementById('summary');           // Check HTML: <p id="summary">...</p>
    const logDisplay = document.getElementById('logDisplay');           // Check HTML: <pre id="logDisplay">...</pre>
    const logDisplayHeader = document.getElementById('logDisplayHeader'); // Check HTML: <div id="logDisplayHeader">...</div>
    const resultsContainer = document.getElementById('results');         // Check HTML: <div id="results">...</div>
    // Session elements
    const sessionNameInput = document.getElementById('sessionNameInput');
    const useSessionButton = document.getElementById('useSessionButton');
    const clearSessionButton = document.getElementById('clearSessionButton');
    const currentSessionDisplay = document.getElementById('currentSessionDisplay');
    // New Session Selector elements
    const sessionSelector = document.getElementById('sessionSelector');
    const loadSelectedSessionButton = document.getElementById('loadSelectedSessionButton');
    const deleteSelectedSessionButton = document.getElementById('deleteSelectedSessionButton');

    // --- Global variable for session state ---
    let activeSessionName = null;
    let sessionCache = {};

    // --- Constants for localStorage Keys ---
    const CACHE_PREFIX = 'diskAnalyzerCache_';
    const SESSION_LIST_KEY = 'diskAnalyzerSessionList';

    // --- Helper: Safely add event listeners ---
    function safeAddEventListener(element, eventType, handler, elementIdForError) {
        if (element) {
            element.addEventListener(eventType, handler);
        } else {
            console.error(`Init Error: Element '${elementIdForError}' not found. Cannot add ${eventType} listener.`);
            // Display error only for critical missing elements
            if (['analyzeButton', 'pathInput', 'resultsBody'].includes(elementIdForError)) {
                showError(`UI element '${elementIdForError}' is missing. App may fail.`, 'error');
            }
        }
    }

    // --- Session List Management Functions ---
    function getSessionList() { try { const listJson = localStorage.getItem(SESSION_LIST_KEY); return listJson ? JSON.parse(listJson) : []; } catch (e) { console.error("Err parsing session list:", e); localStorage.removeItem(SESSION_LIST_KEY); return []; } }
    function saveSessionList(list) { try { const uniqueSortedList = [...new Set(list)].sort(); localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(uniqueSortedList)); } catch (e) { console.error("Err saving session list:", e); showError("Could not save session list."); } }
    function addSessionToList(sessionName) { if (!sessionName) return; const list = getSessionList(); if (!list.includes(sessionName)) { list.push(sessionName); saveSessionList(list); populateSessionSelector(); } }
    function removeSessionFromList(sessionName) { if (!sessionName) return; let list = getSessionList(); list = list.filter(name => name !== sessionName); saveSessionList(list); populateSessionSelector(); }
    function populateSessionSelector() { const list = getSessionList(); const currentSelection = sessionSelector?.value; if (sessionSelector) { sessionSelector.innerHTML = '<option selected disabled value="">Select saved session...</option>'; list.forEach(name => { const option = document.createElement('option'); option.value = name; option.textContent = name; sessionSelector.appendChild(option); }); sessionSelector.disabled = list.length === 0; if (list.includes(activeSessionName)) { sessionSelector.value = activeSessionName; } else if (list.includes(currentSelection)) { sessionSelector.value = currentSelection; } else { sessionSelector.value = ""; } } if (loadSelectedSessionButton) loadSelectedSessionButton.disabled = !sessionSelector?.value; if (deleteSelectedSessionButton) deleteSelectedSessionButton.disabled = !sessionSelector?.value; }

     // --- Caching Functions ---
    function getCacheKey(sessionName) { return `${CACHE_PREFIX}${sessionName}`; }
    function loadSessionCache(sessionName) { if (!sessionName) return {}; const cacheKey = getCacheKey(sessionName); try { const cachedData = localStorage.getItem(cacheKey); if (cachedData) { const parsedData = JSON.parse(cachedData); if (parsedData && typeof parsedData === 'object') { return parsedData; } else { console.warn(`Invalid cache format for '${sessionName}'. Ignoring.`); localStorage.removeItem(cacheKey); removeSessionFromList(sessionName); return {}; } } } catch (e) { console.error(`Err parsing cache for '${sessionName}':`, e); showError(`Err loading cache for '${sessionName}'. Corrupt?`); localStorage.removeItem(cacheKey); removeSessionFromList(sessionName); } return {}; }
    function saveSessionCache() { if (!activeSessionName || !sessionCache) return; const cacheKey = getCacheKey(activeSessionName); try { localStorage.setItem(cacheKey, JSON.stringify(sessionCache)); console.log(`Session '${activeSessionName}' cache saved.`); } catch (e) { console.error(`Err saving cache for '${activeSessionName}':`, e); if (e.name === 'QuotaExceededError') { showError(`Storage limit reached for '${activeSessionName}'.`); } else { showError(`Could not save analysis to '${activeSessionName}'. Err: ${e.message}`); } } }
    function updateCacheForPath(path, data) { if (!activeSessionName) return; const canonicalPath = data?.path; if (canonicalPath) { sessionCache[canonicalPath] = data; console.log(`Cached data for: ${canonicalPath} in '${activeSessionName}'`); saveSessionCache(); } else { console.warn("Cannot cache: No path from backend.", data); } }
    function clearCurrentSessionCache() { if (!activeSessionName) { showError("No active session to clear."); return; } const sessionNameToClear = activeSessionName; const cacheKey = getCacheKey(sessionNameToClear); try { localStorage.removeItem(cacheKey); removeSessionFromList(sessionNameToClear); sessionCache = {}; activeSessionName = null; if (sessionNameInput) sessionNameInput.value = ''; updateSessionDisplay(); clearInterface(); if (sessionSelector) sessionSelector.value = ""; alert(`Session '${sessionNameToClear}' cleared.`); } catch (e) { console.error(`Err removing session '${sessionNameToClear}':`, e); showError(`Could not clear session '${sessionNameToClear}'.`); } }
    function deleteSelectedSessionCache() { const selectedSession = sessionSelector?.value; if (!selectedSession) { showError("No session selected to delete."); return; } if (!confirm(`Delete session '${selectedSession}'?`)) { return; } const cacheKey = getCacheKey(selectedSession); try { localStorage.removeItem(cacheKey); removeSessionFromList(selectedSession); if (activeSessionName === selectedSession) { activeSessionName = null; sessionCache = {}; if (sessionNameInput) sessionNameInput.value = ''; clearInterface(); } updateSessionDisplay(); alert(`Session '${selectedSession}' deleted.`); } catch (e) { console.error(`Err deleting session '${selectedSession}':`, e); showError(`Failed to delete '${selectedSession}'.`); } }

    // --- Session Management UI ---
    function updateSessionDisplay() { if (activeSessionName) { if(currentSessionDisplay) currentSessionDisplay.textContent = `Active: ${activeSessionName}`; if(currentSessionDisplay) currentSessionDisplay.style.fontWeight = 'bold'; if(clearSessionButton) clearSessionButton.disabled = false; if(sessionSelector) sessionSelector.value = activeSessionName; if (sessionSelector?.value !== activeSessionName) { activeSessionName = null; sessionCache = {}; updateSessionDisplay(); } } else { if(currentSessionDisplay) currentSessionDisplay.textContent = `No active session.`; if(currentSessionDisplay) currentSessionDisplay.style.fontWeight = 'normal'; if(clearSessionButton) clearSessionButton.disabled = true; if(sessionSelector) sessionSelector.value = ""; if(refreshButton) refreshButton.disabled = true; } if(loadSelectedSessionButton) loadSelectedSessionButton.disabled = !sessionSelector?.value; if(deleteSelectedSessionButton) deleteSelectedSessionButton.disabled = !sessionSelector?.value; console.log(`updateSessionDisplay: Active=${activeSessionName}, ClearBtn=${clearSessionButton?.disabled}, RefreshBtn=${refreshButton?.disabled}`);}

    // --- Core Action: Activate a Session ---
    function activateSession(sessionName) { console.log(`>>> Activating session: "${sessionName}"`); activeSessionName = sessionName; addSessionToList(activeSessionName); sessionCache = loadSessionCache(activeSessionName); if (sessionNameInput) sessionNameInput.value = activeSessionName; updateSessionDisplay(); clearInterface(); console.log(`<<< Session "${activeSessionName}" active. Cache items: ${Object.keys(sessionCache).length}. Analyze Btn Disabled: ${analyzeButton?.disabled}`); }

    // --- Clear UI Function ---
    function clearInterface() {
        console.log("--- Clearing Interface ---");
        clearResults(); // Handles results table, summary, cache indicator, disables refresh
        clearError(); // Hides error display
        clearInfo(); // Hides info display
        clearLogs(); // Hides log display
        updateCurrentPath(''); // Clears current path text
        // Explicitly set button states after clearing
        if (analyzeButton) analyzeButton.disabled = false;
        if (refreshButton) refreshButton.disabled = true; // Needs path context
        if (pathInput) pathInput.disabled = false;
        updateUpButton(pathInput?.value); // Update Up based on path input
    }

    // --- Event Listeners Setup ---
    safeAddEventListener(useSessionButton, 'click', () => { const sessionName = sessionNameInput?.value?.trim(); if (!sessionName) { showError("Enter session name."); return; } activateSession(sessionName); }, 'useSessionButton');
    safeAddEventListener(sessionSelector, 'change', () => { const selectedValue = sessionSelector?.value; if(loadSelectedSessionButton) loadSelectedSessionButton.disabled = !selectedValue; if(deleteSelectedSessionButton) deleteSelectedSessionButton.disabled = !selectedValue; }, 'sessionSelector');
    safeAddEventListener(loadSelectedSessionButton, 'click', () => { const selectedSession = sessionSelector?.value; if (!selectedSession) { showError("No session selected."); return; } if (selectedSession === activeSessionName) { showInfo(`Session '${selectedSession}' already active.`); return; } activateSession(selectedSession); showInfo(`Session '${selectedSession}' loaded.`); }, 'loadSelectedSessionButton');
    safeAddEventListener(deleteSelectedSessionButton, 'click', deleteSelectedSessionCache, 'deleteSelectedSessionButton');
    safeAddEventListener(analyzeButton, 'click', () => { console.log(">>> Analyze button clicked. Disabled state:", analyzeButton?.disabled); if (analyzeButton?.disabled) { console.warn("Analyze button is disabled, aborting."); return; } const path = pathInput?.value?.trim(); console.log(" Path value:", `"${path}"`); if (path) { console.log(" Path found, calling fetchAnalysis..."); fetchAnalysis(path, false); } else { console.log(" Path is empty, showing error."); showError("Please enter a directory path."); clearInterface(); } console.log("<<< Analyze click handler finished."); }, 'analyzeButton');
    safeAddEventListener(refreshButton, 'click', () => { console.log(">>> Refresh button clicked. Disabled state:", refreshButton?.disabled); if (refreshButton?.disabled) return; const path = pathInput?.value?.trim(); if (path) { fetchAnalysis(path, true); } else { showError("No path to refresh."); } }, 'refreshButton');
    safeAddEventListener(pathInput, 'keypress', function(event) { if (event.key === 'Enter') { event.preventDefault(); console.log("Enter key pressed in path input."); analyzeButton?.click(); } }, 'pathInput');
    safeAddEventListener(upButton, 'click', () => { const currentPath = pathInput?.value?.trim(); if(currentPath){ let parentPath = getParentPath(currentPath); if(parentPath !== null) { if(pathInput) pathInput.value = parentPath; fetchAnalysis(parentPath, false); } } }, 'upButton');
    safeAddEventListener(resultsBody, 'click', handlePathClick, 'resultsBody'); // Listener for clicking items in results

    // --- Path/Click Handling ---
    function handlePathClick(event) { const target = event.target; const clickableSpan = target.closest('.clickable-path'); if (clickableSpan && clickableSpan.dataset.path) { const newPath = clickableSpan.dataset.path; if(pathInput) pathInput.value = newPath; fetchAnalysis(newPath, false); } }
    function getParentPath(currentPath) { if (!currentPath) return null; if (currentPath.match(/^[a-zA-Z]:\\?$/i) || currentPath === '/') return null; const ls = currentPath.lastIndexOf('/'); const lbs = currentPath.lastIndexOf('\\'); const sep = Math.max(ls, lbs); if (sep > 0) { let p = currentPath.substring(0, sep); if (p.match(/^[a-zA-Z]:$/i) && currentPath.includes('\\')) { return p + '\\'; } return p; } else if (sep === 0 && currentPath.length > 1) { return '/'; } else if (sep === 2 && currentPath.match(/^[a-zA-Z]:\\/i)) { return currentPath.substring(0, 3); } console.log("Cannot get parent for:", currentPath); return null; }


    // --- Core Analysis Function ---
    function fetchAnalysis(path, forceRefresh = false) {
        console.log(`>>> fetchAnalysis - Path: "${path}", Force: ${forceRefresh}, Session: ${activeSessionName}`);
        clearInterface(); // Clear display elements and reset buttons (disables refresh)

        const cacheLookupPath = path;

        // --- Caching Logic ---
        console.log(`   Checking cache for "${cacheLookupPath}"... (forceRefresh=${forceRefresh})`);
        if (!forceRefresh && activeSessionName && sessionCache[cacheLookupPath]) {
            const cachedData = sessionCache[cacheLookupPath];
            // DEFENSIVE CHECK
            if (!cachedData || typeof cachedData !== 'object' || cachedData === null) { console.error(`   Invalid cache data for "${cacheLookupPath}". Forcing refresh.`, cachedData); delete sessionCache[cacheLookupPath]; saveSessionCache(); setTimeout(() => fetchAnalysis(path, true), 50); return; }
            // END CHECK
            console.log(`   CACHE HIT for "${cacheLookupPath}"`);
            showLoading(false); // Ensure UI is interactive
            displayResults(cachedData);
            const displayPath = cachedData.path || path;
            updateCurrentPath(displayPath, !!cachedData.error, true);
            updateUpButton(displayPath);
            displayLogs(cachedData.logs);
            let summaryText = `(Cached) Analyzed ${cachedData.total_items_in_dir ?? 'N/A'} items...`; if (cachedData.hasOwnProperty('error') && cachedData.error) { summaryText = `Error: ${cachedData.error}. ${summaryText}`; showError(cachedData.error); } updateSummary(summaryText);
            console.log(`<<< fetchAnalysis finished (loaded from cache).`);
            return; // Stop: loaded from cache
        }
        // --- End Caching Logic ---

        console.log(`   CACHE MISS or refresh forced for "${path}".`);
        const loadingMessage = forceRefresh ? "Refreshing..." : "Analyzing...";
        showLoading(true, loadingMessage); // Disable buttons, show progress

        const url = `/analyze?path=${encodeURIComponent(path)}`;
        console.log("   FETCHING URL:", url);

        fetch(url)
            .then(response => { console.log("   Fetch response status:", response.status); const responseClone = response.clone(); return response.json().then(data => ({ ok: response.ok, status: response.status, data })).catch(async (jsonError) => { console.error("   Failed to parse JSON:", jsonError); const textResponse = await responseClone.text(); console.error("   Response Text:", textResponse); throw { status: response.status, message: `Server error ${response.status}. Not valid JSON. Body: ${textResponse.substring(0, 500)}...` }; }); })
            .then(({ ok, status, data }) => { console.log("   Fetch OK:", ok, "Processing data..."); showLoading(false); displayLogs(data?.logs); if (!ok || (data && data.hasOwnProperty('error') && data.error)) { console.error("   Analysis Error received from server."); const errorMsg = (data?.error) || `Request failed (${status})`; showError(errorMsg); const displayPathOnError = data?.path || path; updateCurrentPath(displayPathOnError, true); } else { console.log("   Analysis successful."); displayResults(data); const confirmedPath = data.path || path; updateCurrentPath(confirmedPath, false); updateUpButton(confirmedPath); let summaryText = `Analyzed ${data.total_items_in_dir ?? 'N/A'} items...`; updateSummary(summaryText); updateCacheForPath(confirmedPath, data); } })
            .catch(error => { console.error('   FETCH API ERROR:', error); showLoading(false); showError(error.message || 'Network error or server unreachable.'); updateCurrentPath(path, true); updateUpButton(path); clearLogs(); })
            .finally(() => { console.log(`<<< fetchAnalysis finished (network request attempt).`); });
    }


    // --- UI Update Functions (with null checks) ---
    function displayResults(data) { if(!resultsBody) return; resultsBody.innerHTML = ''; if(resultsContainer) resultsContainer.style.display = (data && data.results && !data.error) ? 'block' : 'none'; if (data && data.results && data.results.length > 0) { data.results.forEach(item => { if (!item) { console.warn("Null item in results"); return; } const row = resultsBody.insertRow(); if (item.hasOwnProperty('error') && item.error) { row.classList.add('table-warning'); } const typeCell = row.insertCell(); const nameCell = row.insertCell(); const sizeCell = row.insertCell(); const pathCell = row.insertCell(); const statusCell = row.insertCell(); let iconClass = ''; let nameContent = escapeHtml(item.name ?? 'N/A'); if (item.hasOwnProperty('error') && item.error) { iconClass = 'error-icon'; statusCell.textContent = item.error; statusCell.style.color = '#dc3545'; statusCell.style.fontWeight = 'bold'; } else { statusCell.textContent = 'OK'; statusCell.style.color = '#198754'; if (item.type === 'directory') { iconClass = 'folder-icon'; nameContent = `<span class="clickable-path" data-path="${escapeHtml(item.path)}" title="Click to analyze">${escapeHtml(item.name ?? 'N/A')}</span>`; } else if (item.type === 'file') { iconClass = 'file-icon'; } else if (item.type === 'symlink') { iconClass = 'symlink-icon'; } else { iconClass = ''; } } typeCell.innerHTML = `<span class="icon ${iconClass}" title="${escapeHtml(item.type ?? 'unknown')}"></span>`; nameCell.innerHTML = nameContent; sizeCell.textContent = item.human_readable_size ?? '[Error]'; pathCell.textContent = item.path ?? '[No Path]'; pathCell.style.wordBreak = 'break-all'; }); } else if (data && !data.error && data.results && data.results.length === 0) { if(resultsContainer) resultsContainer.style.display = 'block'; const row = resultsBody.insertRow(); const cell = row.insertCell(); cell.colSpan = 5; cell.textContent = 'Directory is empty.'; cell.style.textAlign = 'center'; cell.style.fontStyle = 'italic'; } }
    function displayLogs(logs) { if (logs && Array.isArray(logs) && logs.length > 0) { if(logDisplayHeader) logDisplayHeader.style.display = 'block'; if(logDisplay) logDisplay.style.display = 'block'; if(logDisplay) logDisplay.textContent = logs.map(log => escapeHtml(log)).join('\n'); if(logDisplay) logDisplay.scrollTop = logDisplay.scrollHeight; } else { clearLogs(); } }
    function updateUpButton(currentPath) { if (!upButton) return; const pathVal = currentPath ?? ''; const isWindowsRootDriveOnly = /^[a-zA-Z]:$/i.test(pathVal); const isWindowsRootDir = /^[a-zA-Z]:\\$/i.test(pathVal); const isUnixRoot = /^\/$/.test(pathVal); const isEmpty = !pathVal; upButton.disabled = isWindowsRootDriveOnly || isWindowsRootDir || isUnixRoot || isEmpty; upButton.title = upButton.disabled ? "Cannot go up" : "Go Up"; }
    function escapeHtml(unsafe) { if (unsafe === null || typeof unsafe === 'undefined') return ""; try { return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); } catch (e) { console.error("Err escaping HTML:", unsafe, e); return "[EscErr]"; } }
    function showError(message, type = 'error') { if (!errorDisplay) return; if (type === 'info') { showInfo(message); return; } errorDisplay.textContent = message; errorDisplay.style.display = message ? 'block' : 'none'; errorDisplay.className = 'error-message mb-3 alert alert-danger'; clearInfo(); } // Clear info when error shows
    function showInfo(message) { if (!infoDisplay) return; infoDisplay.textContent = message; infoDisplay.style.display = message ? 'block' : 'none'; infoDisplay.className = 'alert alert-info mt-3'; clearError(); } // Clear error when info shows
    function clearError() { if (!errorDisplay) return; errorDisplay.textContent = ''; errorDisplay.style.display = 'none'; }
    function clearInfo() { if (!infoDisplay) return; infoDisplay.textContent = ''; infoDisplay.style.display = 'none'; }
    function clearResults() { console.log("Clearing results display."); if (resultsBody) resultsBody.innerHTML = ''; if (summaryDisplay) summaryDisplay.textContent = ''; if (resultsContainer) resultsContainer.style.display = 'none'; const cacheIndicator = currentPathDisplay?.querySelector('.cache-hit-indicator'); if (cacheIndicator) { cacheIndicator.remove(); } if (refreshButton) refreshButton.disabled = true; }
    function clearLogs() { if (logDisplay) logDisplay.textContent = ''; if (logDisplayHeader) logDisplayHeader.style.display = 'none'; if (logDisplay) logDisplay.style.display = 'none'; }
    function updateCurrentPath(path, isError = false, fromCache = false) { if (!currentPathDisplay) return; const existingIndicator = currentPathDisplay.querySelector('.cache-hit-indicator'); if (existingIndicator) { existingIndicator.remove(); } if (path) { currentPathDisplay.innerHTML = `Current: ${escapeHtml(path)} `; /* Use innerHTML because of indicator */ currentPathDisplay.style.color = isError ? '#dc3545' : '#6c757d'; /* Use Bootstrap text-muted color */ currentPathDisplay.style.fontWeight = isError ? 'bold' : 'normal'; if (fromCache) { const cacheSpan = document.createElement('span'); cacheSpan.className = 'cache-hit-indicator'; cacheSpan.textContent = '(Cached)'; currentPathDisplay.appendChild(cacheSpan); } } else { currentPathDisplay.textContent = ''; } }
    function updateSummary(text) { if (summaryDisplay) summaryDisplay.textContent = text; }

    // --- REVISED showLoading Function ---
    function showLoading(isLoading, statusText = "Analyzing...") {
        console.log(`showLoading: ${isLoading}`);
        if(loadingStatusText) loadingStatusText.textContent = statusText;
        if(loadingIndicator) loadingIndicator.style.display = isLoading ? 'block' : 'none';

        // --- Disable/Enable Controls ---
        const controlsToToggle = [ analyzeButton, refreshButton, pathInput, useSessionButton, loadSelectedSessionButton, deleteSelectedSessionButton, sessionSelector, clearSessionButton, upButton ];
        controlsToToggle.forEach(control => { if (control) { control.disabled = isLoading; } });

        // --- Specific Logic when loading FINISHES ---
        if (!isLoading) {
            console.log("Loading finished, re-evaluating button states.");
            // Re-evaluate based on context
            if(pathInput) updateUpButton(pathInput.value);
            if(refreshButton && pathInput) refreshButton.disabled = !pathInput.value.trim();
            if(sessionSelector) sessionSelector.disabled = getSessionList().length === 0;
            if(loadSelectedSessionButton) loadSelectedSessionButton.disabled = !sessionSelector?.value || sessionSelector?.disabled;
            if(deleteSelectedSessionButton) deleteSelectedSessionButton.disabled = !sessionSelector?.value || sessionSelector?.disabled;
            if(clearSessionButton) clearSessionButton.disabled = !activeSessionName;
             // Ensure Analyze button is definitely enabled if not loading
             if(analyzeButton) analyzeButton.disabled = false;
        }
    }
    // --- End REVISED showLoading Function ---

     // --- Initial Setup ---
     console.log(">>> Initializing application...");
     // Add checks before calling functions that rely on elements
     if (pathInput) updateUpButton(pathInput.value); else console.error("Initial Setup Error: pathInput not found.");
     clearInterface(); // Use consolidated clearer
     populateSessionSelector(); // Populate dropdown
     updateSessionDisplay(); // Initialize session display and related button states
     console.log("<<< Initialization complete.");

});