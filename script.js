// Solar Power Plant Simulation - Main JavaScript File

// Global state
const state = {
    currentTime: new Date(),
    simulationTime: null,
    capacity: 100, // MW
    currentGeneration: 0,
    dailyCumulative: 0,
    lastUpdateTime: new Date(),
    environmentalFactors: {
        temperature: 30,
        dustLevel: 5,
        cloudCover: 7,
        humidity: 10
    },
    manualEnvironmentControl: true,
    simulatedEnvironmentalFactors: {
        temperature: 35,
        dustLevel: 20,
        cloudCover: 10,
        humidity: 30
    },
    anomalyOverrides: {
        dustLevel: null,
        cloudCover: null
    },
    anomalies: [],
    anomalyCheckInterval: null,
    equipmentHealth: {},
    logs: [],
    droneScanning: false,
    dronePosition: { x: 0, y: 0 },
    autoDownloadEnabled: false,
    autoDownloadInterval: null,
    lastLogDownload: null,
    settings: {
        llmBaseUrl: 'http://127.0.0.1:1234',
        aiAnalysisInterval: 180,
        logDownloadInterval: 600
    }
};

// Initialize application
document.addEventListener('DOMContentLoaded', init);

function init() {
    loadSettings();
    initializeTheme();
    initializeEquipment();
    setupEventListeners();
    startSimulation();
    showView('map');
    updateTimeDisplay();
    log('System initialized', 'info');
}

// Initialize equipment
function initializeEquipment() {
    const equipmentTypes = [
        { prefix: 'Panel', count: 20 },
        { prefix: 'Inverter', count: 5 },
        { prefix: 'Battery', count: 3 },
        { prefix: 'Transformer', count: 2 }
    ];
    
    equipmentTypes.forEach(type => {
        for (let i = 1; i <= type.count; i++) {
            const id = `${type.prefix}-${i}`;
            state.equipmentHealth[id] = {
                name: `${type.prefix} ${i}`,
                health: 95 + Math.random() * 5,
                status: 'healthy',
                issues: []
            };
        }
    });
}


// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.getElementById('nav-toggle').addEventListener('click', toggleNav);
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            showView(view);
        });
    });
    
    // Time controls
    document.getElementById('time-input').addEventListener('change', handleTimeChange);
    document.getElementById('reset-time').addEventListener('click', resetTime);
    document.getElementById('advance-time').addEventListener('click', advanceTime);
    
    // Anomaly generator
    document.getElementById('generate-anomaly').addEventListener('click', generateAnomaly);
    
    // Map controls
    document.getElementById('scan-panels').addEventListener('click', startDroneScan);
    document.getElementById('download-logs').addEventListener('click', downloadLogs);
    document.getElementById('auto-download-btn').addEventListener('click', toggleAutoDownload);
    document.getElementById('ai-report-btn').addEventListener('click', generateAIReport);
    
    // Environmental controls
    document.getElementById('manual-control-toggle').addEventListener('change', toggleManualControl);
    document.getElementById('reset-environment').addEventListener('click', resetEnvironment);
    
    // AI Assistant controls
    document.getElementById('ai-assistant-toggle').addEventListener('change', toggleAIAssistant);
    document.getElementById('analyze-events').addEventListener('click', () => handleQuickAction('analyze'));
    document.getElementById('predict-maintenance').addEventListener('click', () => handleQuickAction('predict'));
    document.getElementById('optimize-performance').addEventListener('click', () => handleQuickAction('optimize'));
    document.getElementById('ai-send-btn').addEventListener('click', sendChatMessage);
    document.getElementById('ai-chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    
    // Resize handle
    setupResizeHandle();
    
    // Settings modal
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('close-settings').addEventListener('click', closeSettings);
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    document.getElementById('reset-settings').addEventListener('click', resetSettings);
    
    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        const settingsModal = document.getElementById('settings-modal');
        const reportModal = document.getElementById('report-modal');
        
        if (e.target === settingsModal) {
            closeSettings();
        } else if (e.target === reportModal) {
            closeReportModal();
        }
    });
    
    // Report modal controls
    document.getElementById('close-report').addEventListener('click', closeReportModal);
    document.getElementById('download-report').addEventListener('click', downloadHTMLReport);
    
    // Factor sliders and inputs
    ['temp', 'dust', 'cloud', 'humidity'].forEach(factor => {
        const slider = document.getElementById(`${factor}-slider`);
        const input = document.getElementById(`${factor}-input`);
        
        slider.addEventListener('input', (e) => updateFactorFromSlider(factor, e.target.value));
        input.addEventListener('change', (e) => updateFactorFromInput(factor, e.target.value));
    });
    
    // Window resize
    window.addEventListener('resize', handleResize);
}

// Navigation toggle
function toggleNav() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

// Show view
function showView(viewName) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
    
    // Update content
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${viewName}-view`).classList.add('active');
    
    // Update specific view content
    switch(viewName) {
        case 'map':
            renderMap();
            break;
        case 'dashboard':
            updateDashboard();
            break;
        case 'equipment':
            renderEquipment();
            break;
        case 'environment':
            updateEnvironment();
            break;
        case 'anomalies':
            renderAnomalyView();
            break;
    }
}

// Time management
function handleTimeChange(e) {
    const [hours, minutes] = e.target.value.split(':').map(Number);
    const newTime = new Date();
    newTime.setHours(hours, minutes, 0, 0);
    state.simulationTime = newTime;
    
    // Initialize system with new time
    initializeSystemState(true); // Preserve logs
    
    addAlert(`System initialized with simulation time ${hours}:${minutes.toString().padStart(2, '0')}`, 'info');
    
    updateSimulation();
    updateAllViews();
}

function resetTime() {
    state.simulationTime = null;
    document.getElementById('time-input').value = '';
    
    // Initialize system with current time
    initializeSystemState(true); // Preserve logs
    
    addAlert('System initialized with current time - Real-time mode active', 'info');
    
    updateSimulation();
    updateAllViews();
}

function getCurrentTime() {
    return state.simulationTime || new Date();
}

// Initialize system state when time changes
function initializeSystemState(preserveLogs = false) {
    const currentTime = getCurrentTime();
    
    // Reset generation and cumulative
    state.currentGeneration = 0;
    state.dailyCumulative = 0;
    state.lastUpdateTime = currentTime;
    
    // Clear all active anomalies
    state.anomalies = [];
    
    // Reset equipment health to initial values
    Object.keys(state.equipmentHealth).forEach(id => {
        state.equipmentHealth[id].health = 95 + Math.random() * 5;
        state.equipmentHealth[id].status = 'healthy';
        state.equipmentHealth[id].anomaly = null;
        state.equipmentHealth[id].issues = [];
    });
    
    // Reset environmental factors to defaults if in manual mode
    if (state.manualEnvironmentControl) {
        state.environmentalFactors = {
            temperature: 30,
            dustLevel: 5,
            cloudCover: 7,
            humidity: 10
        };
        
        // Update UI sliders and inputs
        document.getElementById('temp-slider').value = 30;
        document.getElementById('temp-input').value = 30;
        document.getElementById('dust-slider').value = 5;
        document.getElementById('dust-input').value = 5;
        document.getElementById('cloud-slider').value = 7;
        document.getElementById('cloud-input').value = 7;
        document.getElementById('humidity-slider').value = 10;
        document.getElementById('humidity-input').value = 10;
    }
    
    // Clear anomaly overrides
    state.anomalyOverrides = {
        dustLevel: null,
        cloudCover: null
    };
    
    // Reset drone state
    state.droneScanning = false;
    state.dronePosition = { x: 0, y: 0 };
    state.currentScanPanel = 0;
    
    // Clear logs if requested
    if (!preserveLogs) {
        state.logs = [];
        updateLogCounter();
    }
    
    // Log the initialization
    log(`System initialized at ${currentTime.toLocaleTimeString()}`, 'system');
}

function updateTimeDisplay() {
    const time = getCurrentTime();
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    if (!state.simulationTime) {
        document.getElementById('time-input').value = `${hours}:${minutes}`;
    }
}

// Advance simulation time by 1 hour
function advanceTime() {
    const currentTime = getCurrentTime();
    const newTime = new Date(currentTime);
    newTime.setHours(newTime.getHours() + 1);
    
    // Set as simulation time (without reinitializing)
    state.simulationTime = newTime;
    
    // Update time input display
    const hours = newTime.getHours().toString().padStart(2, '0');
    const minutes = newTime.getMinutes().toString().padStart(2, '0');
    document.getElementById('time-input').value = `${hours}:${minutes}`;
    
    // Check if we crossed midnight
    if (newTime.getHours() === 0) {
        state.dailyCumulative = 0;
        addAlert('Midnight - Daily cumulative reset', 'info');
    }
    
    log(`Time advanced to ${hours}:${minutes}`, 'system');
    addAlert(`Time advanced to ${hours}:${minutes}`, 'info');
    
    updateSimulation();
    updateAllViews();
}

// Update all views when time changes
function updateAllViews() {
    // Update whichever view is currently active
    const activeView = document.querySelector('.view.active');
    if (activeView) {
        const viewId = activeView.id.replace('-view', '');
        switch(viewId) {
            case 'map':
                renderMap();
                break;
            case 'dashboard':
                updateDashboard();
                break;
            case 'equipment':
                renderEquipment();
                break;
            case 'environment':
                updateEnvironment();
                break;
            case 'anomalies':
                renderAnomalyView();
                break;
        }
    }
}

// Solar generation calculation
function calculateSolarGeneration(time) {
    const hour = time.getHours() + time.getMinutes() / 60;
    
    // Base generation curve (0 at night, peak at noon)
    let baseGeneration = 0;
    if (hour >= 6 && hour <= 18) {
        // Simplified solar curve
        const dayProgress = (hour - 6) / 12;
        baseGeneration = Math.sin(dayProgress * Math.PI) * state.capacity;
    }
    
    // Get effective environmental values (considering overrides)
    const effectiveDust = state.anomalyOverrides.dustLevel !== null ? 
        state.anomalyOverrides.dustLevel : state.environmentalFactors.dustLevel;
    const effectiveCloud = state.anomalyOverrides.cloudCover !== null ? 
        state.anomalyOverrides.cloudCover : state.environmentalFactors.cloudCover;
    
    // Apply environmental factors
    const tempFactor = 1 - Math.max(0, (state.environmentalFactors.temperature - 25) * 0.004);
    const dustFactor = 1 - (effectiveDust / 100) * 0.3;
    const cloudFactor = 1 - (effectiveCloud / 100) * 0.5;
    
    // Apply anomaly impacts (only for non-environmental anomalies)
    let anomalyFactor = 1;
    state.anomalies.forEach(anomaly => {
        if (anomaly.active && anomaly.impact && 
            anomaly.type !== 'dust-storm' && anomaly.type !== 'cloud-cover') {
            const impactValue = parseFloat(anomaly.impact.replace('%', '')) / 100;
            anomalyFactor *= (1 - impactValue);
        }
    });
    
    return baseGeneration * tempFactor * dustFactor * cloudFactor * anomalyFactor;
}

// Update simulation
function updateSimulation() {
    const currentTime = getCurrentTime();
    state.currentGeneration = calculateSolarGeneration(currentTime);
    
    // Update cumulative (simplified - resets at midnight)
    const lastHour = state.lastUpdateTime.getHours();
    const currentHour = currentTime.getHours();
    
    // Check if we crossed midnight
    if (lastHour === 23 && currentHour === 0) {
        state.dailyCumulative = 0;
        addAlert('Midnight - Daily cumulative reset', 'info');
    } else {
        const timeDiff = (currentTime - state.lastUpdateTime) / 3600000; // hours
        state.dailyCumulative += state.currentGeneration * timeDiff;
    }
    
    state.lastUpdateTime = new Date(currentTime);
    
    // Update all views
    updateDashboard();
    updateEnvironment();
    renderMap();
}

// Start simulation intervals
function startSimulation() {
    // Update simulation every second
    setInterval(() => {
        if (!state.simulationTime) {
            // Real-time mode: update normally
            updateSimulation();
            updateTimeDisplay();
        } else {
            // Simulation mode: advance time by 1 second
            state.simulationTime = new Date(state.simulationTime.getTime() + 1000);
            updateSimulation();
            
            // Update time display
            const hours = state.simulationTime.getHours().toString().padStart(2, '0');
            const minutes = state.simulationTime.getMinutes().toString().padStart(2, '0');
            document.getElementById('time-input').value = `${hours}:${minutes}`;
        }
    }, 1000);
    
    // Environmental changes every 10 seconds
    setInterval(updateEnvironmentalFactors, 10000);
    
    // Anomaly checks every 10 seconds for smoother updates
    setInterval(checkAnomalies, 10000);
    
    // Random events every 15 seconds
    setInterval(generateRandomEvent, 15000);
    
    // Monitor equipment health every 10 seconds
    setInterval(monitorEquipmentHealth, 10000);
    
    // Degrade equipment health every 60 seconds
    setInterval(degradeEquipmentHealth, 60000);
}

// Environmental factors simulation
function updateEnvironmentalFactors() {
    // Only update if not in manual control mode
    if (!state.manualEnvironmentControl) {
        // Temperature variation (25-45°C for Rajasthan)
        state.simulatedEnvironmentalFactors.temperature = 25 + Math.random() * 20 + 
            (Math.sin(getCurrentTime().getHours() / 24 * Math.PI * 2 - Math.PI/2) + 1) * 5;
        
        // Dust level (higher in dry season)
        state.simulatedEnvironmentalFactors.dustLevel = Math.min(100, 
            state.simulatedEnvironmentalFactors.dustLevel + (Math.random() - 0.4) * 10);
        state.simulatedEnvironmentalFactors.dustLevel = Math.max(0, state.simulatedEnvironmentalFactors.dustLevel);
        
        // Cloud cover
        state.simulatedEnvironmentalFactors.cloudCover = Math.min(100, 
            state.simulatedEnvironmentalFactors.cloudCover + (Math.random() - 0.5) * 15);
        state.simulatedEnvironmentalFactors.cloudCover = Math.max(0, state.simulatedEnvironmentalFactors.cloudCover);
        
        // Humidity (lower in Rajasthan)
        state.simulatedEnvironmentalFactors.humidity = 20 + Math.random() * 30;
        
        // Copy simulated values to actual values
        state.environmentalFactors = { ...state.simulatedEnvironmentalFactors };
    }
    
    updateEnvironment();
}

// Toggle manual control
function toggleManualControl() {
    state.manualEnvironmentControl = document.getElementById('manual-control-toggle').checked;
    const resetBtn = document.getElementById('reset-environment');
    const controls = ['temp', 'dust', 'cloud', 'humidity'];
    
    if (state.manualEnvironmentControl) {
        // Enable controls
        resetBtn.disabled = false;
        controls.forEach(factor => {
            document.getElementById(`${factor}-slider`).disabled = false;
            document.getElementById(`${factor}-input`).disabled = false;
        });
        
        addAlert('Manual environmental control enabled', 'info');
        log('Manual environmental control enabled', 'control');
    } else {
        // Disable controls and revert to simulation
        resetBtn.disabled = true;
        controls.forEach(factor => {
            document.getElementById(`${factor}-slider`).disabled = true;
            document.getElementById(`${factor}-input`).disabled = true;
        });
        
        // Revert to simulated values
        state.environmentalFactors = { ...state.simulatedEnvironmentalFactors };
        updateEnvironment();
        
        addAlert('Returned to automatic simulation', 'info');
        log('Manual environmental control disabled', 'control');
    }
}

// Reset environment to simulation values
function resetEnvironment() {
    state.environmentalFactors = { ...state.simulatedEnvironmentalFactors };
    updateEnvironment();
    addAlert('Environmental factors reset to simulation values', 'info');
    log('Environmental factors reset', 'control');
}

// Update factor from slider
function updateFactorFromSlider(factor, value) {
    if (!state.manualEnvironmentControl) return;
    
    const numValue = parseFloat(value);
    const inputId = `${factor}-input`;
    document.getElementById(inputId).value = numValue;
    
    switch(factor) {
        case 'temp':
            state.environmentalFactors.temperature = numValue;
            break;
        case 'dust':
            state.environmentalFactors.dustLevel = numValue;
            break;
        case 'cloud':
            state.environmentalFactors.cloudCover = numValue;
            break;
        case 'humidity':
            state.environmentalFactors.humidity = numValue;
            break;
    }
    
    updateEnvironment();
    updateSimulation();
}

// Update factor from input
function updateFactorFromInput(factor, value) {
    if (!state.manualEnvironmentControl) return;
    
    const numValue = parseFloat(value);
    const sliderId = `${factor}-slider`;
    document.getElementById(sliderId).value = numValue;
    
    switch(factor) {
        case 'temp':
            state.environmentalFactors.temperature = numValue;
            break;
        case 'dust':
            state.environmentalFactors.dustLevel = numValue;
            break;
        case 'cloud':
            state.environmentalFactors.cloudCover = numValue;
            break;
        case 'humidity':
            state.environmentalFactors.humidity = numValue;
            break;
    }
    
    updateEnvironment();
    updateSimulation();
}

// Anomaly generation
function generateAnomaly() {
    const select = document.getElementById('anomaly-type');
    const type = select.value;
    
    if (!type) {
        addAlert('Please select an anomaly type', 'warning');
        return;
    }
    
    const anomalyTypes = {
        'panel-fault': {
            name: 'Panel Fault',
            location: `Section ${Math.floor(Math.random() * 10) + 1}`,
            impact: '15%',
            severity: 'critical'
        },
        'dust-accumulation': {
            name: 'Dust Accumulation',
            location: `Section ${Math.floor(Math.random() * 10) + 1}`,
            impact: '10%',
            severity: 'warning'
        },
        'dust-storm': {
            name: 'Dust Storm',
            location: 'Entire facility',
            impact: '30%',
            severity: 'warning'
        },
        'inverter-overload': {
            name: 'Inverter Overload',
            location: `Inverter ${Math.floor(Math.random() * 5) + 1}`,
            impact: '20%',
            severity: 'critical'
        },
        'cloud-cover': {
            name: 'Cloud Cover Spike',
            location: 'Regional',
            impact: '40%',
            severity: 'info'
        }
    };
    
    const anomaly = {
        id: Date.now(),
        type,
        ...anomalyTypes[type],
        timestamp: new Date(),
        active: true,
        escalationLevel: 0,
        lastEscalation: new Date()
    };
    
    state.anomalies.push(anomaly);
    select.value = '';
    
    // Apply visual effects and environmental overrides
    if (type === 'dust-storm') {
        applyDustStormEffect();
        // Override dust level
        state.anomalyOverrides.dustLevel = Math.min(100, state.environmentalFactors.dustLevel + 50);
        updateEnvironment();
        updateSimulation();
    } else if (type === 'cloud-cover') {
        // Override cloud cover
        state.anomalyOverrides.cloudCover = Math.min(100, state.environmentalFactors.cloudCover + 60);
        updateEnvironment();
        updateSimulation();
    }
    
    // Update affected equipment
    if (type === 'panel-fault' || type === 'dust-accumulation') {
        // Select a random starting point for the fault/dust cluster
        const startRow = Math.floor(Math.random() * 8); // 0-7 to leave room for cluster
        const startCol = Math.floor(Math.random() * 8);
        const clusterSize = Math.floor(Math.random() * 3) + 2; // 2-4 panels in cluster
        
        // Store affected equipment
        anomaly.affectedEquipment = [];
        
        // Select a subset of panels to affect
        const panelIds = Object.keys(state.equipmentHealth).filter(id => id.startsWith('Panel-'));
        const numToAffect = Math.floor(Math.random() * 3) + 2; // 2-4 panels
        
        // Select random panels
        for (let i = 0; i < numToAffect && i < panelIds.length; i++) {
            const randomIndex = Math.floor(Math.random() * panelIds.length);
            const equipmentId = panelIds[randomIndex];
            
            // Make sure we don't affect the same panel twice
            if (!anomaly.affectedEquipment.includes(equipmentId) && state.equipmentHealth[equipmentId]) {
                // Set appropriate status based on anomaly type
                if (type === 'dust-accumulation') {
                    state.equipmentHealth[equipmentId].status = 'degraded';
                    state.equipmentHealth[equipmentId].issues = ['dust accumulation'];
                } else {
                    state.equipmentHealth[equipmentId].status = 'faulty';
                    state.equipmentHealth[equipmentId].issues = ['panel fault'];
                }
                
                state.equipmentHealth[equipmentId].anomaly = anomaly.id;
                
                // Different health impact for dust accumulation vs panel fault
                const healthReduction = type === 'dust-accumulation' ? 30 : 50;
                state.equipmentHealth[equipmentId].health = Math.max(20, state.equipmentHealth[equipmentId].health - healthReduction);
                anomaly.affectedEquipment.push(equipmentId);
            }
        }
        
        // Update location to be more specific
        anomaly.location = `Section ${startRow + 1}-${startCol + 1}`;
    } else if (type === 'inverter-overload') {
        // Affect a specific inverter
        const inverterId = `Inverter-${anomaly.location.match(/\d+/)[0]}`;
        anomaly.affectedEquipment = [inverterId];
        
        if (state.equipmentHealth[inverterId]) {
            state.equipmentHealth[inverterId].status = 'faulty';
            state.equipmentHealth[inverterId].anomaly = anomaly.id;
            state.equipmentHealth[inverterId].health = Math.max(30, state.equipmentHealth[inverterId].health - 40);
        }
    }
    
    addAlert(`Anomaly generated: ${anomaly.name} at ${anomaly.location}`, anomaly.severity);
    log(`Anomaly generated: ${anomaly.name}`, 'anomaly');
    
    updateSimulation();
    renderAnomalyList();
    
    // Update equipment view if it's currently active
    if (document.getElementById('equipment-view').classList.contains('active')) {
        renderEquipment();
    }
    
    // Update anomaly view if it's currently active
    if (document.getElementById('anomalies-view').classList.contains('active')) {
        renderAnomalyView();
    }
}

// Check and auto-resolve anomalies
function checkAnomalies() {
    const now = new Date();
    
    state.anomalies.forEach(anomaly => {
        if (anomaly.active) {
            // Calculate time since anomaly started
            const timeSinceStart = (now - anomaly.timestamp) / 1000; // seconds
            const timeSinceLastEscalation = (now - anomaly.lastEscalation) / 1000;
            
            // Auto-correct after 200 seconds (3 minutes 20 seconds)
            if (timeSinceStart >= 200) {
                anomaly.active = false;
                anomaly.resolvedAt = new Date();
                anomaly.resolvedBy = 'auto-timeout';
                
                // Different messages for environmental vs equipment anomalies
                if (anomaly.type === 'dust-storm' || anomaly.type === 'cloud-cover') {
                    addAlert(`Environmental condition cleared: ${anomaly.name}`, 'info');
                    log(`Environmental anomaly cleared after 200 seconds: ${anomaly.name}`, 'resolution');
                } else {
                    addAlert(`Anomaly auto-corrected after timeout: ${anomaly.name}`, 'info');
                    log(`Anomaly auto-corrected after 200 seconds: ${anomaly.name}`, 'resolution');
                }
                
                // Clear visual effects and restore equipment
                if (anomaly.type === 'panel-fault' || anomaly.type === 'dust-accumulation' || anomaly.type === 'inverter-overload') {
                    // Restore equipment health
                    if (anomaly.affectedEquipment) {
                        anomaly.affectedEquipment.forEach(equipmentId => {
                            if (state.equipmentHealth[equipmentId]) {
                                state.equipmentHealth[equipmentId].status = 'healthy';
                                state.equipmentHealth[equipmentId].anomaly = null;
                                state.equipmentHealth[equipmentId].issues = [];
                                state.equipmentHealth[equipmentId].health = 96 + Math.random() * 4; // 96-100%
                            }
                        });
                    }
                    
                } else if (anomaly.type === 'dust-storm') {
                    removeDustStormEffect();
                    state.anomalyOverrides.dustLevel = null;
                    updateEnvironment();
                    updateSimulation();
                    // Generate dust accumulation after dust storm
                    generateDustAccumulationAfterStorm();
                } else if (anomaly.type === 'cloud-cover') {
                    state.anomalyOverrides.cloudCover = null;
                    updateEnvironment();
                    updateSimulation();
                }
                return; // Skip further processing for this anomaly
            }
            
            // Escalate every 60 seconds
            if (timeSinceLastEscalation >= 60 && anomaly.escalationLevel < 3) {
                // Environmental anomalies don't escalate beyond level 1
                const maxEscalation = (anomaly.type === 'dust-storm' || anomaly.type === 'cloud-cover') ? 1 : 3;
                
                if (anomaly.escalationLevel < maxEscalation) {
                    anomaly.escalationLevel++;
                    anomaly.lastEscalation = now;
                    
                    // Different escalation messages for environmental vs equipment anomalies
                    if (anomaly.type === 'dust-storm' || anomaly.type === 'cloud-cover') {
                        addAlert(`${anomaly.name} ongoing for ${Math.floor(timeSinceStart / 60)} minutes - Environmental condition`, 'warning');
                    } else {
                        // Equipment anomaly escalation
                        if (anomaly.escalationLevel === 1) {
                            addAlert(`ESCALATION: ${anomaly.name} has been active for ${Math.floor(timeSinceStart / 60)} minutes`, 'warning');
                        } else if (anomaly.escalationLevel === 2) {
                            addAlert(`CRITICAL ESCALATION: ${anomaly.name} requires immediate attention!`, 'critical');
                        } else if (anomaly.escalationLevel === 3) {
                            addAlert(`MAXIMUM ESCALATION: ${anomaly.name} will auto-correct in ${Math.ceil((200 - timeSinceStart) / 60)} minutes`, 'critical');
                        }
                    }
                    
                    log(`Anomaly escalated: ${anomaly.name} - Level ${anomaly.escalationLevel}`, 'escalation');
                }
            }
            
            // Optional: Small chance of early auto-resolution (very rare)
            // Disabled for now to ensure anomalies run their full course
            /*
            if (timeSinceStart > 30 && timeSinceStart < 150) {
                const resolveChance = 0.01; // 1% chance per 10-second check
                if (Math.random() < resolveChance) {
                    anomaly.active = false;
                    anomaly.resolvedAt = new Date();
                    addAlert(`Anomaly auto-resolved early: ${anomaly.name}`, 'info');
                    log(`Anomaly auto-resolved early: ${anomaly.name}`, 'resolution');
                    
                    // Clear visual effects
                    if (anomaly.type === 'panel-fault') {
                        state.panels.forEach(panel => {
                            if (panel.anomaly === anomaly.id) {
                                panel.anomaly = null;
                            }
                        });
                    } else if (anomaly.type === 'dust-storm') {
                        removeDustStormEffect();
                    }
                }
            }
            */
        }
    });
    
    updateSimulation();
    renderAnomalyList();
    updateAlertBar();
    
    // Update equipment view if it's currently active
    if (document.getElementById('equipment-view').classList.contains('active')) {
        renderEquipment();
    }
    
    // Update anomaly view if it's currently active
    if (document.getElementById('anomalies-view').classList.contains('active')) {
        renderAnomalyView();
    }
}

// Manual anomaly correction
function correctAnomaly(anomalyId) {
    const anomaly = state.anomalies.find(a => a.id === anomalyId);
    if (anomaly && anomaly.active) {
        anomaly.active = false;
        anomaly.resolvedAt = new Date();
        anomaly.resolvedBy = 'user';
        
        addAlert(`Anomaly corrected: ${anomaly.name}`, 'info');
        log(`Anomaly manually corrected: ${anomaly.name}`, 'resolution');
        
        // Clear visual effects and restore equipment
        if (anomaly.type === 'panel-fault' || anomaly.type === 'dust-accumulation' || anomaly.type === 'inverter-overload') {
            // Restore equipment health
            if (anomaly.affectedEquipment) {
                anomaly.affectedEquipment.forEach(equipmentId => {
                    if (state.equipmentHealth[equipmentId]) {
                        state.equipmentHealth[equipmentId].status = 'healthy';
                        state.equipmentHealth[equipmentId].anomaly = null;
                        state.equipmentHealth[equipmentId].health = 96 + Math.random() * 4; // 96-100%
                        state.equipmentHealth[equipmentId].issues = [];
                    }
                });
            }
            
        } else if (anomaly.type === 'dust-storm') {
            removeDustStormEffect();
            state.anomalyOverrides.dustLevel = null;
            updateEnvironment();
            updateSimulation();
            // Generate dust accumulation after dust storm
            generateDustAccumulationAfterStorm();
        } else if (anomaly.type === 'cloud-cover') {
            state.anomalyOverrides.cloudCover = null;
            updateEnvironment();
            updateSimulation();
        }
        
        updateSimulation();
        renderAnomalyList();
        
        // Update equipment view if it's currently active
        if (document.getElementById('equipment-view').classList.contains('active')) {
            renderEquipment();
        }
    }
}

// Render anomaly list
function renderAnomalyList() {
    const container = document.getElementById('anomaly-list');
    const activeAnomalies = state.anomalies.filter(a => a.active);
    
    container.innerHTML = activeAnomalies.length === 0 
        ? '<p>No active anomalies</p>'
        : activeAnomalies.map(anomaly => {
            const escalationClass = anomaly.escalationLevel >= 2 ? 'anomaly-critical' : 
                                   anomaly.escalationLevel === 1 ? 'anomaly-escalated' : '';
            const timeSinceStart = (new Date() - anomaly.timestamp) / 1000; // seconds
            const timeSinceStartMinutes = Math.floor(timeSinceStart / 60); // minutes
            const timeRemaining = Math.max(0, 200 - timeSinceStart); // seconds remaining
            const timeRemainingMinutes = Math.ceil(timeRemaining / 60);
            
            return `
                <div class="anomaly-item ${escalationClass}">
                    <div class="anomaly-info">
                        <h4>${anomaly.name} ${anomaly.escalationLevel > 0 && (anomaly.type !== 'dust-storm' && anomaly.type !== 'cloud-cover') ? `(Level ${anomaly.escalationLevel})` : ''}</h4>
                        <p>Location: ${anomaly.location} | Impact: -${anomaly.impact} generation</p>
                        <p class="anomaly-duration">Active: ${timeSinceStartMinutes}m | ${(anomaly.type === 'dust-storm' || anomaly.type === 'cloud-cover') ? 'Natural event - Will clear in' : 'Auto-correct in'}: ${timeRemainingMinutes}m</p>
                    </div>
                    ${(anomaly.type === 'dust-storm' || anomaly.type === 'cloud-cover') ? 
                        '<div class="environmental-label">🌍 Environmental</div>' :
                        `<button class="correct-btn" onclick="correctAnomaly(${anomaly.id})">
                            Correct
                        </button>`
                    }
                </div>
            `;
        }).join('');
    
    // Update anomaly count in dashboard
    const countElement = document.getElementById('anomaly-count');
    if (countElement) {
        countElement.textContent = activeAnomalies.length;
    }
}

// Generate anomaly programmatically
function generateAnomalyForEquipment(type, equipmentId) {
    const anomalyTypes = {
        'panel-fault': {
            name: 'Panel Fault',
            location: `Section ${Math.floor(Math.random() * 10) + 1}`,
            impact: '15%',
            severity: 'critical'
        },
        'dust-accumulation': {
            name: 'Dust Accumulation',
            location: `Section ${Math.floor(Math.random() * 10) + 1}`,
            impact: '10%',
            severity: 'warning'
        },
        'inverter-overload': {
            name: 'Inverter Overload',
            location: `Inverter ${Math.floor(Math.random() * 4) + 1}`,
            impact: '20%',
            severity: 'critical'
        }
    };
    
    const anomalyData = anomalyTypes[type];
    const anomaly = {
        id: state.anomalies.length + 1,
        type: type,
        name: anomalyData.name,
        location: anomalyData.location,
        impact: anomalyData.impact,
        severity: anomalyData.severity,
        timestamp: new Date(),
        active: true,
        escalationLevel: 0,
        lastEscalation: new Date(),
        affectedEquipment: []
    };
    
    // Apply effects based on type
    if (type === 'panel-fault') {
        anomaly.affectedEquipment = [equipmentId];
        state.equipmentHealth[equipmentId].status = 'faulty';
        state.equipmentHealth[equipmentId].anomaly = anomaly.id;
        state.equipmentHealth[equipmentId].issues = ['Panel fault detected'];
        const healthReduction = 30;
        state.equipmentHealth[equipmentId].health = Math.max(20, state.equipmentHealth[equipmentId].health - healthReduction);
    } else if (type === 'dust-accumulation') {
        anomaly.affectedEquipment = [equipmentId];
        state.equipmentHealth[equipmentId].status = 'degraded';
        state.equipmentHealth[equipmentId].anomaly = anomaly.id;
        state.equipmentHealth[equipmentId].issues = ['Dust accumulation'];
        const healthReduction = 25;
        state.equipmentHealth[equipmentId].health = Math.max(20, state.equipmentHealth[equipmentId].health - healthReduction);
    } else if (type === 'inverter-overload') {
        anomaly.affectedEquipment = [equipmentId];
        state.equipmentHealth[equipmentId].status = 'faulty';
        state.equipmentHealth[equipmentId].anomaly = anomaly.id;
        state.equipmentHealth[equipmentId].issues = ['Overload detected'];
        state.equipmentHealth[equipmentId].health = Math.max(30, state.equipmentHealth[equipmentId].health - 40);
    }
    
    state.anomalies.push(anomaly);
    updateSimulation();
    renderAnomalyList();
    
    return anomaly.id;
}

// Monitor equipment health and auto-generate anomalies when health < 80%
function monitorEquipmentHealth() {
    Object.entries(state.equipmentHealth).forEach(([equipmentId, equipment]) => {
        // Only check healthy equipment
        if (equipment.status === 'healthy' && equipment.health < 80) {
            // Check if there's already an active anomaly for this equipment
            const existingAnomaly = state.anomalies.find(a => 
                a.active && a.affectedEquipment && a.affectedEquipment.includes(equipmentId)
            );
            
            if (!existingAnomaly) {
                // Auto-generate appropriate anomaly based on equipment type
                const type = equipmentId.split('-')[0];
                let anomalyType = 'panel-fault';
                
                if (type === 'Panel') {
                    // 70% chance of dust accumulation, 30% panel fault for low health
                    anomalyType = Math.random() > 0.3 ? 'dust-accumulation' : 'panel-fault';
                } else if (type === 'Inverter') {
                    anomalyType = 'inverter-overload';
                }
                
                // Generate the anomaly
                const anomalyId = generateAnomalyForEquipment(anomalyType, equipmentId);
                
                // Log the auto-generation
                addAlert(`Auto-generated ${anomalyType} for ${equipment.name} (health dropped to ${equipment.health.toFixed(1)}%)`, 'warning');
                log(`Auto-generated ${anomalyType} for ${equipmentId} (health: ${equipment.health.toFixed(1)}%)`, 'anomaly');
            }
        }
    });
}

// Gradually degrade equipment health over time
function degradeEquipmentHealth() {
    // Get all healthy equipment that can be degraded
    const degradableEquipment = Object.entries(state.equipmentHealth).filter(([equipmentId, equipment]) => {
        // Check if equipment has active anomaly
        const hasActiveAnomaly = state.anomalies.some(a => 
            a.active && a.affectedEquipment && a.affectedEquipment.includes(equipmentId)
        );
        
        // Only consider healthy equipment above 80% without active anomalies
        return equipment.status === 'healthy' && equipment.health > 80 && !hasActiveAnomaly;
    });
    
    // Only degrade 25% of degradable equipment
    const equipmentToDegrade = Math.ceil(degradableEquipment.length * 0.25);
    
    // Randomly select which equipment to degrade
    const shuffled = degradableEquipment.sort(() => Math.random() - 0.5);
    const selectedEquipment = shuffled.slice(0, equipmentToDegrade);
    
    // Apply degradation to selected equipment
    selectedEquipment.forEach(([equipmentId, equipment]) => {
        // Random degradation: 0.1-0.5% per minute
        const degradation = 0.1 + Math.random() * 0.4;
        equipment.health = Math.max(75, equipment.health - degradation);
    });
    
    // Update equipment view if active and any equipment was degraded
    if (selectedEquipment.length > 0 && document.getElementById('equipment-view').classList.contains('active')) {
        renderEquipment();
    }
}

// Map rendering
function renderMap() {
    const canvas = document.getElementById('solar-map');
    const ctx = canvas.getContext('2d');
    const time = getCurrentTime();
    
    // Set canvas size based on container width
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth - 40; // Account for padding
    canvas.width = containerWidth;
    canvas.height = containerWidth * 0.75; // Maintain 4:3 aspect ratio
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background gradient based on time
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    const hour = time.getHours();
    
    if (hour < 6 || hour > 18) {
        // Night
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
    } else if (hour < 8) {
        // Dawn
        gradient.addColorStop(0, '#ff8c42');
        gradient.addColorStop(1, '#ffd700');
    } else if (hour > 16) {
        // Dusk
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(1, '#ff8c42');
    } else {
        // Day
        gradient.addColorStop(0, '#87ceeb');
        gradient.addColorStop(1, '#f0f8ff');
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Group equipment by type
    const equipmentByType = {};
    Object.entries(state.equipmentHealth).forEach(([id, equipment]) => {
        const type = id.split('-')[0];
        if (!equipmentByType[type]) equipmentByType[type] = [];
        equipmentByType[type].push({ id, ...equipment });
    });
    
    // Calculate scale based on canvas width
    const scale = canvas.width / 1000; // Base design was for 1000px width
    
    // Draw title
    ctx.fillStyle = '#2c3e50';
    ctx.font = `bold ${16 * scale}px Arial`;
    ctx.fillText('Solar Plant Equipment Map', 50 * scale, 30 * scale);
    
    // Draw panels section
    if (equipmentByType.Panel) {
        ctx.font = `${14 * scale}px Arial`;
        ctx.fillText('Solar Panels', 50 * scale, 60 * scale);
        
        const panelSize = 50 * scale;
        const panelGap = 10 * scale;
        const startX = 50 * scale;
        const startY = 80 * scale;
        const panelsPerRow = 10;
        
        equipmentByType.Panel.forEach((panel, index) => {
            const row = Math.floor(index / panelsPerRow);
            const col = index % panelsPerRow;
            const x = startX + col * (panelSize + panelGap);
            const y = startY + row * (panelSize + panelGap);
            
            // Check for anomaly
            const hasAnomaly = panel.anomaly && state.anomalies.find(a => a.id === panel.anomaly && a.active);
            
            // Determine color based on status and generation
            let color;
            if (hasAnomaly) {
                color = '#e74c3c'; // Red for anomaly
            } else if (panel.status === 'faulty') {
                color = '#e74c3c';
            } else if (panel.status === 'warning') {
                color = '#f39c12';
            } else if (state.currentGeneration === 0) {
                color = '#2c3e50'; // Dark for night
            } else {
                const efficiency = (panel.health / 100) * (state.currentGeneration / state.capacity);
                if (efficiency > 0.7) {
                    color = '#27ae60'; // Green for optimal
                } else if (efficiency > 0.4) {
                    color = '#ff8c42'; // Orange for reduced
                } else {
                    color = '#ff6b6b'; // Light red for low
                }
            }
            
            ctx.fillStyle = color;
            ctx.fillRect(x, y, panelSize, panelSize);
            ctx.strokeStyle = '#34495e';
            ctx.strokeRect(x, y, panelSize, panelSize);
            
            // Add panel number
            ctx.fillStyle = 'white';
            ctx.font = `${10 * scale}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(panel.name.split(' ')[1], x + panelSize/2, y + panelSize/2 + 3 * scale);
            
            // Add flickering effect for anomalies
            if (hasAnomaly && Math.random() > 0.5) {
                ctx.fillStyle = 'rgba(231, 76, 60, 0.5)';
                ctx.fillRect(x, y, panelSize, panelSize);
            }
        });
    }
    
    // Draw inverters section
    if (equipmentByType.Inverter) {
        const inverterY = 320 * scale;
        ctx.fillStyle = '#2c3e50';
        ctx.font = `${14 * scale}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText('Inverters', 50 * scale, inverterY);
        
        equipmentByType.Inverter.forEach((inverter, index) => {
            const x = (50 + index * 120) * scale;
            const y = inverterY + 20 * scale;
            const width = 100 * scale;
            const height = 60 * scale;
            
            // Check for anomaly
            const hasAnomaly = inverter.anomaly && state.anomalies.find(a => a.id === inverter.anomaly && a.active);
            
            // Determine color
            let color;
            if (hasAnomaly || inverter.status === 'faulty') {
                color = '#e74c3c';
            } else if (inverter.status === 'warning') {
                color = '#f39c12';
            } else {
                color = '#27ae60';
            }
            
            ctx.fillStyle = color;
            ctx.fillRect(x, y, width, height);
            ctx.strokeStyle = '#34495e';
            ctx.strokeRect(x, y, width, height);
            
            // Add text
            ctx.fillStyle = 'white';
            ctx.font = `${12 * scale}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(inverter.name, x + width/2, y + height/2 - 5 * scale);
            ctx.font = `${10 * scale}px Arial`;
            ctx.fillText(`${inverter.health.toFixed(0)}%`, x + width/2, y + height/2 + 10 * scale);
        });
    }
    
    // Draw batteries section
    if (equipmentByType.Battery) {
        const batteryY = 420 * scale;
        ctx.fillStyle = '#2c3e50';
        ctx.font = `${14 * scale}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText('Batteries', 50 * scale, batteryY);
        
        equipmentByType.Battery.forEach((battery, index) => {
            const x = (50 + index * 90) * scale;
            const y = batteryY + 20 * scale;
            const width = 70 * scale;
            const height = 40 * scale;
            
            // Determine color
            let color = battery.status === 'faulty' ? '#e74c3c' : 
                       battery.status === 'warning' ? '#f39c12' : '#27ae60';
            
            ctx.fillStyle = color;
            ctx.fillRect(x, y, width, height);
            ctx.strokeStyle = '#34495e';
            ctx.strokeRect(x, y, width, height);
            
            // Battery terminal
            ctx.fillRect(x + width, y + height/3, 5 * scale, height/3);
            
            // Add text
            ctx.fillStyle = 'white';
            ctx.font = `${10 * scale}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(battery.name, x + width/2, y + height/2 + 3 * scale);
        });
    }
    
    // Draw transformers section
    if (equipmentByType.Transformer) {
        const transformerY = 500 * scale;
        ctx.fillStyle = '#2c3e50';
        ctx.font = `${14 * scale}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText('Transformers', 50 * scale, transformerY);
        
        equipmentByType.Transformer.forEach((transformer, index) => {
            const x = (50 + index * 140) * scale;
            const y = transformerY + 20 * scale;
            const size = 80 * scale;
            
            // Determine color
            let color = transformer.status === 'faulty' ? '#e74c3c' : 
                       transformer.status === 'warning' ? '#f39c12' : '#27ae60';
            
            // Draw transformer symbol (simplified)
            ctx.strokeStyle = color;
            ctx.lineWidth = 3 * scale;
            ctx.beginPath();
            ctx.arc(x + size/2, y + size/2, size/3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x + size/2, y + size/2, size/3 - 10 * scale, 0, Math.PI * 2);
            ctx.stroke();
            
            // Add text
            ctx.fillStyle = color;
            ctx.font = `${10 * scale}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(transformer.name, x + size/2, y + size + 15 * scale);
        });
    }
    
    ctx.textAlign = 'left';
    
    // Draw drone if scanning
    if (state.droneScanning) {
        ctx.save();
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(state.dronePosition.x * scale, state.dronePosition.y * scale, 15 * scale, 0, Math.PI * 2);
        ctx.fill();
        
        // Drone propellers
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        ctx.moveTo(state.dronePosition.x * scale - 20 * scale, state.dronePosition.y * scale);
        ctx.lineTo(state.dronePosition.x * scale + 20 * scale, state.dronePosition.y * scale);
        ctx.moveTo(state.dronePosition.x * scale, state.dronePosition.y * scale - 20 * scale);
        ctx.lineTo(state.dronePosition.x * scale, state.dronePosition.y * scale + 20 * scale);
        ctx.stroke();
        ctx.restore();
    }
}

// Drone scanning
function startDroneScan() {
    if (state.droneScanning) return;
    
    state.droneScanning = true;
    state.droneScanReport = {
        startTime: new Date(),
        panelsScanned: 0,
        issuesFound: [],
        dustLevel: state.anomalyOverrides.dustLevel !== null ? 
            state.anomalyOverrides.dustLevel : state.environmentalFactors.dustLevel,
        observations: []
    };
    
    // Start position at first panel
    state.dronePosition = { x: 50, y: 80 };
    state.currentScanPanel = 0;
    
    const button = document.getElementById('scan-panels');
    button.textContent = 'Scanning...';
    button.disabled = true;
    
    addAlert('Drone scan initiated - Checking all solar panels', 'info');
    log('Drone scan started', 'scan');
    
    animateDrone();
}

function animateDrone() {
    const panelIds = Object.keys(state.equipmentHealth)
        .filter(id => id.startsWith('Panel-'))
        .sort((a, b) => {
            const numA = parseInt(a.split('-')[1]);
            const numB = parseInt(b.split('-')[1]);
            return numA - numB;
        });
    
    if (state.currentScanPanel >= panelIds.length) {
        finishDroneScan();
        return;
    }
    
    // Calculate target position for current panel (unscaled coordinates)
    const panelIndex = state.currentScanPanel;
    const row = Math.floor(panelIndex / 10);
    const col = panelIndex % 10;
    const targetX = 50 + col * 60 + 25; // Center of panel (unscaled)
    const targetY = 80 + row * 60 + 25; // (unscaled)
    
    const animate = () => {
        const dx = targetX - state.dronePosition.x;
        const dy = targetY - state.dronePosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
            state.dronePosition.x += dx / distance * 8;
            state.dronePosition.y += dy / distance * 8;
            renderMap();
            requestAnimationFrame(animate);
        } else {
            // Scan current panel
            scanPanel(panelIds[state.currentScanPanel]);
            state.currentScanPanel++;
            
            // Continue to next panel
            setTimeout(() => animateDrone(), 300);
        }
    };
    
    animate();
}

function scanPanel(panelId) {
    const equipment = state.equipmentHealth[panelId];
    if (!equipment) return;
    
    state.droneScanReport.panelsScanned++;
    
    // Check for various issues
    const issues = [];
    
    // Check health status
    if (equipment.status === 'faulty' || equipment.health < 70) {
        issues.push({
            type: 'damage',
            severity: 'high',
            panel: equipment.name
        });
        state.droneScanReport.issuesFound.push(`${equipment.name}: Potential damage detected (Health: ${equipment.health.toFixed(0)}%)`);
    }
    
    // Check for dust accumulation impact
    if (state.droneScanReport.dustLevel > 40) {
        if (Math.random() > 0.7) { // 30% of panels show heavy dust
            issues.push({
                type: 'dust',
                severity: 'medium',
                panel: equipment.name
            });
            state.droneScanReport.observations.push(`${equipment.name}: Heavy dust accumulation`);
        }
    } else if (state.droneScanReport.dustLevel > 20) {
        if (Math.random() > 0.8) { // 20% of panels show moderate dust
            issues.push({
                type: 'dust',
                severity: 'low',
                panel: equipment.name
            });
            state.droneScanReport.observations.push(`${equipment.name}: Moderate dust accumulation`);
        }
    }
    
    // Check for anomaly effects
    if (equipment.anomaly) {
        const anomaly = state.anomalies.find(a => a.id === equipment.anomaly && a.active);
        if (anomaly) {
            issues.push({
                type: 'anomaly',
                severity: 'high',
                panel: equipment.name,
                anomalyType: anomaly.name
            });
            state.droneScanReport.issuesFound.push(`${equipment.name}: Affected by ${anomaly.name}`);
        }
    }
    
    // Visual feedback during scan
    if (issues.length > 0) {
        const severity = issues.some(i => i.severity === 'high') ? 'warning' : 'info';
        addAlert(`Scanning ${equipment.name}: ${issues.length} issue(s) found`, severity);
    }
}

function finishDroneScan() {
    state.droneScanning = false;
    const button = document.getElementById('scan-panels');
    button.textContent = 'Start Drone Scan';
    button.disabled = false;
    
    // Generate scan report
    const report = state.droneScanReport;
    const scanDuration = Math.floor((new Date() - report.startTime) / 1000);
    
    // Summary statistics
    const dustAffectedPanels = report.observations.filter(o => o.includes('dust')).length;
    const damagedPanels = report.issuesFound.filter(i => i.includes('damage')).length;
    const anomalyAffectedPanels = report.issuesFound.filter(i => i.includes('Affected by')).length;
    
    // Generate summary message
    let summary = `Drone scan completed in ${scanDuration}s - Scanned ${report.panelsScanned} panels. `;
    
    if (report.issuesFound.length === 0 && report.observations.length === 0) {
        summary += 'All panels operating normally. No issues detected.';
        addAlert(summary, 'info');
    } else {
        // Build detailed summary
        const issues = [];
        
        if (damagedPanels > 0) {
            issues.push(`${damagedPanels} damaged`);
        }
        
        if (dustAffectedPanels > 0) {
            issues.push(`${dustAffectedPanels} with dust accumulation`);
        }
        
        if (anomalyAffectedPanels > 0) {
            issues.push(`${anomalyAffectedPanels} affected by anomalies`);
        }
        
        summary += `Found: ${issues.join(', ')}.`;
        
        // Add dust level observation
        if (report.dustLevel > 40) {
            summary += ` High dust levels detected (${report.dustLevel.toFixed(0)}%) - cleaning recommended.`;
        } else if (report.dustLevel > 20) {
            summary += ` Moderate dust levels (${report.dustLevel.toFixed(0)}%).`;
        }
        
        addAlert(summary, 'warning');
        
        // Add detailed findings to alerts
        if (report.issuesFound.length > 0) {
            report.issuesFound.slice(0, 3).forEach(issue => {
                addAlert(issue, 'warning');
            });
            
            if (report.issuesFound.length > 3) {
                addAlert(`...and ${report.issuesFound.length - 3} more issues`, 'info');
            }
        }
    }
    
    // Log the complete report
    log(`Drone scan completed: ${report.panelsScanned} panels scanned, ${report.issuesFound.length} issues found, ${dustAffectedPanels} panels with dust`, 'scan');
    
    // Store report for download
    state.lastDroneScanReport = {
        timestamp: new Date(),
        duration: scanDuration,
        ...report
    };
    
    renderMap();
}

// Dashboard updates
function updateDashboard() {
    document.getElementById('current-generation').textContent = 
        `${state.currentGeneration.toFixed(1)} MW`;
    document.getElementById('generation-percentage').textContent = 
        `${((state.currentGeneration / state.capacity) * 100).toFixed(1)}%`;
    document.getElementById('daily-cumulative').textContent = 
        `${state.dailyCumulative.toFixed(1)} MWh`;
    
    // Update anomaly count
    const anomalyCount = document.getElementById('anomaly-count');
    if (anomalyCount) {
        anomalyCount.textContent = state.anomalies.filter(a => a.active).length;
    }
    
    renderAnomalyList();
    renderGenerationChart();
}

// Generation chart
function renderGenerationChart() {
    const canvas = document.getElementById('generation-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Get theme colors
    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue('--text-secondary').trim();
    const gridColor = styles.getPropertyValue('--chart-grid').trim();
    const primaryColor = styles.getPropertyValue('--chart-1').trim();
    const warningColor = styles.getPropertyValue('--accent-warning').trim();
    const errorColor = styles.getPropertyValue('--accent-error').trim();
    const bgColor = styles.getPropertyValue('--primary-bg').trim();
    
    // Clear canvas with background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
    
    // Chart dimensions
    const padding = 60;
    const chartWidth = width - (padding * 2);
    const chartHeight = height - (padding * 1.5);
    const chartLeft = padding;
    const chartTop = padding / 2;
    const chartBottom = height - padding;
    
    // Draw grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([5, 5]);
    
    // Horizontal grid lines (power levels)
    for (let i = 0; i <= 5; i++) {
        const y = chartTop + (i * chartHeight / 5);
        ctx.beginPath();
        ctx.moveTo(chartLeft, y);
        ctx.lineTo(chartLeft + chartWidth, y);
        ctx.stroke();
        
        // Power labels
        ctx.fillStyle = textColor;
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        const powerValue = (100 - (i * 20));
        ctx.fillText(`${powerValue} MW`, chartLeft - 10, y + 4);
    }
    
    // Vertical grid lines (hours)
    for (let hour = 0; hour <= 24; hour += 2) {
        const x = chartLeft + (hour / 24) * chartWidth;
        ctx.beginPath();
        ctx.moveTo(x, chartTop);
        ctx.lineTo(x, chartBottom);
        ctx.stroke();
        
        // Hour labels
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.fillText(`${hour}:00`, x, chartBottom + 20);
    }
    
    ctx.setLineDash([]);
    
    // Draw axes
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartLeft, chartTop);
    ctx.lineTo(chartLeft, chartBottom);
    ctx.lineTo(chartLeft + chartWidth, chartBottom);
    ctx.stroke();
    
    // Draw theoretical generation curve (ideal conditions)
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    
    for (let hour = 0; hour <= 24; hour += 0.25) {
        const time = new Date();
        time.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);
        
        // Calculate ideal generation (no environmental factors)
        let idealGeneration = 0;
        if (hour >= 6 && hour < 18) {
            const dayProgress = (hour - 6) / 12;
            idealGeneration = state.capacity * Math.sin(dayProgress * Math.PI);
        }
        
        const x = chartLeft + (hour / 24) * chartWidth;
        const y = chartBottom - (idealGeneration / state.capacity) * chartHeight;
        
        if (hour === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw actual generation curve
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    // Fill area under curve
    ctx.fillStyle = primaryColor + '20'; // Add transparency
    ctx.beginPath();
    ctx.moveTo(chartLeft, chartBottom);
    
    for (let hour = 0; hour <= 24; hour += 0.25) {
        const time = new Date();
        time.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);
        const generation = calculateSolarGeneration(time);
        
        const x = chartLeft + (hour / 24) * chartWidth;
        const y = chartBottom - (generation / state.capacity) * chartHeight;
        
        ctx.lineTo(x, y);
    }
    
    ctx.lineTo(chartLeft + chartWidth, chartBottom);
    ctx.closePath();
    ctx.fill();
    
    // Draw the line
    ctx.strokeStyle = primaryColor;
    ctx.beginPath();
    for (let hour = 0; hour <= 24; hour += 0.25) {
        const time = new Date();
        time.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);
        const generation = calculateSolarGeneration(time);
        
        const x = chartLeft + (hour / 24) * chartWidth;
        const y = chartBottom - (generation / state.capacity) * chartHeight;
        
        if (hour === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    
    // Mark current time
    const currentHour = getCurrentTime().getHours() + getCurrentTime().getMinutes() / 60;
    const currentX = chartLeft + (currentHour / 24) * chartWidth;
    
    ctx.strokeStyle = warningColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentX, chartTop - 10);
    ctx.lineTo(currentX, chartBottom);
    ctx.stroke();
    
    // Current time label
    ctx.fillStyle = warningColor;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NOW', currentX, chartTop - 15);
    
    // Mark anomaly events
    state.anomalies.forEach(anomaly => {
        const anomalyHour = anomaly.timestamp.getHours() + anomaly.timestamp.getMinutes() / 60;
        const anomalyX = chartLeft + (anomalyHour / 24) * chartWidth;
        
        // Draw anomaly marker
        ctx.fillStyle = errorColor;
        ctx.strokeStyle = errorColor;
        ctx.lineWidth = 1;
        
        // Triangle marker
        ctx.beginPath();
        ctx.moveTo(anomalyX, chartTop - 5);
        ctx.lineTo(anomalyX - 5, chartTop - 15);
        ctx.lineTo(anomalyX + 5, chartTop - 15);
        ctx.closePath();
        ctx.fill();
        
        // Vertical line
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(anomalyX, chartTop);
        ctx.lineTo(anomalyX, chartBottom);
        ctx.stroke();
        ctx.setLineDash([]);
    });
    
    // Legend
    const legendY = 15;
    ctx.font = '11px monospace';
    
    // Ideal generation
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(width - 200, legendY);
    ctx.lineTo(width - 170, legendY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.fillText('Ideal', width - 165, legendY + 4);
    
    // Actual generation
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width - 120, legendY);
    ctx.lineTo(width - 90, legendY);
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.fillText('Actual', width - 85, legendY + 4);
    
    // Anomaly marker
    ctx.fillStyle = errorColor;
    ctx.beginPath();
    ctx.moveTo(width - 40, legendY - 2);
    ctx.lineTo(width - 35, legendY - 7);
    ctx.lineTo(width - 30, legendY - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.fillText('Anomaly', width - 25, legendY + 4);
}

// Equipment rendering
function renderEquipment() {
    // Clear all grids
    const panelsGrid = document.getElementById('panels-grid');
    const invertersGrid = document.getElementById('inverters-grid');
    const storageGrid = document.getElementById('storage-grid');
    
    if (panelsGrid) panelsGrid.innerHTML = '';
    if (invertersGrid) invertersGrid.innerHTML = '';
    if (storageGrid) storageGrid.innerHTML = '';
    
    // Categorize and render equipment
    Object.entries(state.equipmentHealth).forEach(([id, equipment]) => {
        const div = document.createElement('div');
        div.className = `equipment-item ${equipment.status}`;
        
        // Check if this equipment has an active anomaly
        const hasAnomaly = equipment.anomaly && state.anomalies.find(a => a.id === equipment.anomaly && a.active);
        const anomalyClass = hasAnomaly ? 'anomaly-affected' : '';
        
        div.innerHTML = `
            <div class="equipment-name">${equipment.name}</div>
            <div class="equipment-status ${anomalyClass}">Health</div>
            <div class="equipment-health">${equipment.health.toFixed(1)}%</div>
            ${hasAnomaly ? '<div class="anomaly-indicator">⚠️</div>' : ''}
        `;
        div.addEventListener('click', () => showEquipmentDetails(id, hasAnomaly));
        
        // Append to appropriate grid based on equipment type
        if (id.startsWith('Panel-') && panelsGrid) {
            panelsGrid.appendChild(div);
        } else if (id.startsWith('Inverter-') && invertersGrid) {
            invertersGrid.appendChild(div);
        } else if ((id.startsWith('Battery-') || id.startsWith('Transformer-')) && storageGrid) {
            storageGrid.appendChild(div);
        }
    });
}

function showEquipmentDetails(equipmentId, hasAnomaly) {
    const equipment = state.equipmentHealth[equipmentId];
    const anomaly = hasAnomaly ? state.anomalies.find(a => a.id === equipment.anomaly) : null;
    
    if (anomaly) {
        addAlert(`${equipment.name}: Health ${equipment.health.toFixed(1)}% - Affected by ${anomaly.name}`, 'warning');
    } else {
        addAlert(`${equipment.name}: Health ${equipment.health.toFixed(1)}%`, 'info');
    }
}

// Environmental factors update
function updateEnvironment() {
    let { temperature, dustLevel, cloudCover, humidity } = state.environmentalFactors;
    
    // Apply anomaly overrides if active
    if (state.anomalyOverrides.dustLevel !== null) {
        dustLevel = state.anomalyOverrides.dustLevel;
    }
    if (state.anomalyOverrides.cloudCover !== null) {
        cloudCover = state.anomalyOverrides.cloudCover;
    }
    
    document.getElementById('temperature').textContent = `${temperature.toFixed(1)}°C`;
    document.getElementById('dust-level').textContent = `${dustLevel.toFixed(0)}%`;
    document.getElementById('cloud-cover').textContent = `${cloudCover.toFixed(0)}%`;
    document.getElementById('humidity').textContent = `${humidity.toFixed(0)}%`;
    
    // Update progress bars
    document.getElementById('temp-bar').style.width = `${((temperature - 20) / 30) * 100}%`;
    document.getElementById('dust-bar').style.width = `${dustLevel}%`;
    document.getElementById('cloud-bar').style.width = `${cloudCover}%`;
    document.getElementById('humidity-bar').style.width = `${humidity}%`;
    
    // Update sliders and inputs - disable if overridden
    document.getElementById('temp-slider').value = temperature;
    document.getElementById('temp-input').value = temperature.toFixed(1);
    
    document.getElementById('dust-slider').value = dustLevel;
    document.getElementById('dust-input').value = Math.round(dustLevel);
    if (state.anomalyOverrides.dustLevel !== null) {
        document.getElementById('dust-slider').disabled = true;
        document.getElementById('dust-input').disabled = true;
    } else if (state.manualEnvironmentControl) {
        document.getElementById('dust-slider').disabled = false;
        document.getElementById('dust-input').disabled = false;
    }
    
    document.getElementById('cloud-slider').value = cloudCover;
    document.getElementById('cloud-input').value = Math.round(cloudCover);
    if (state.anomalyOverrides.cloudCover !== null) {
        document.getElementById('cloud-slider').disabled = true;
        document.getElementById('cloud-input').disabled = true;
    } else if (state.manualEnvironmentControl) {
        document.getElementById('cloud-slider').disabled = false;
        document.getElementById('cloud-input').disabled = false;
    }
    
    document.getElementById('humidity-slider').value = humidity;
    document.getElementById('humidity-input').value = Math.round(humidity);
    
    // Calculate total impact
    const tempImpact = Math.max(0, (temperature - 25) * 0.4);
    const dustImpact = dustLevel * 0.3;
    const cloudImpact = cloudCover * 0.5;
    const totalImpact = tempImpact + dustImpact + cloudImpact;
    
    document.getElementById('total-impact').textContent = `${totalImpact.toFixed(1)}% reduction`;
}

// Alert system
function addAlert(message, severity = 'info') {
    const alertList = document.getElementById('alert-list');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert-item ${severity}`;
    
    const time = getCurrentTime();
    const timeString = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    
    alertDiv.innerHTML = `
        <div class="alert-time">${timeString}</div>
        <div>${message}</div>
    `;
    
    alertList.insertBefore(alertDiv, alertList.firstChild);
    
    // Log all alerts to the logging system
    log(message, `alert-${severity}`);
    
    // Keep only last 20 alerts
    while (alertList.children.length > 20) {
        alertList.removeChild(alertList.lastChild);
    }
}

// Random events
function generateRandomEvent() {
    // Only generate normal events if no active anomalies
    const hasActiveAnomalies = state.anomalies.some(a => a.active);
    
    if (hasActiveAnomalies) {
        // Generate anomaly-related events
        if (Math.random() > 0.8) {
            const anomalyEvents = [
                { message: 'System performance degraded due to active anomalies', severity: 'warning' },
                { message: 'Monitoring active anomalies for changes', severity: 'info' },
                { message: 'Maintenance team notified of ongoing issues', severity: 'info' }
            ];
            const event = anomalyEvents[Math.floor(Math.random() * anomalyEvents.length)];
            addAlert(event.message, event.severity);
        }
    } else {
        // Normal operation events - check actual conditions
        const events = [];
        
        // Always safe events
        events.push(
            { message: 'System operating normally', severity: 'info' },
            { message: 'Maintenance check scheduled', severity: 'info' },
            { message: 'Grid synchronization stable', severity: 'info' }
        );
        
        // Conditional events based on actual values
        const effectiveTemp = state.environmentalFactors.temperature;
        const effectiveDust = state.anomalyOverrides.dustLevel !== null ? 
            state.anomalyOverrides.dustLevel : state.environmentalFactors.dustLevel;
        
        // Only add temperature warning if actually high
        if (effectiveTemp > 35) {
            events.push({ message: 'Temperature rising above optimal', severity: 'warning' });
        }
        
        // Only add dust warning if actually high
        if (effectiveDust > 30) {
            events.push({ message: 'Dust accumulation detected', severity: 'warning' });
        }
        
        // Add positive events when conditions are good
        if (effectiveTemp <= 30 && effectiveDust <= 20) {
            events.push({ message: 'Operating conditions optimal', severity: 'info' });
        }
        
        if (Math.random() > 0.7) {
            const event = events[Math.floor(Math.random() * events.length)];
            addAlert(event.message, event.severity);
        }
    }
}

// Logging system
function log(message, type = 'info') {
    state.logs.push({
        timestamp: new Date(),
        message,
        type
    });
    updateLogCounter();
}

// Update log counter display
function updateLogCounter() {
    const counter = document.getElementById('log-counter');
    if (counter) {
        counter.textContent = `Session Logs: ${state.logs.length} entries`;
    }
}

function downloadLogs() {
    const timestamp = new Date().toISOString();
    let logContent = `=== SOLAR PLANT OPERATION LOGS ===\n`;
    logContent += `Generated: ${timestamp}\n`;
    logContent += `Session Duration: ${Math.floor((new Date() - state.logs[0]?.timestamp || new Date()) / 60000)} minutes\n`;
    logContent += `Total Log Entries: ${state.logs.length}\n\n`;
    
    // Add current system state
    logContent += '--- Current System State ---\n';
    logContent += `Time: ${getCurrentTime().toLocaleTimeString()}\n`;
    logContent += `Generation: ${state.currentGeneration.toFixed(2)} MW (${(state.currentGeneration / state.capacity * 100).toFixed(1)}%)\n`;
    logContent += `Daily Cumulative: ${state.dailyCumulative.toFixed(2)} MWh\n`;
    logContent += `Active Anomalies: ${state.anomalies.filter(a => a.active).length}\n`;
    logContent += `Environmental Control: ${state.manualEnvironmentControl ? 'Manual' : 'Automatic'}\n`;
    logContent += `Temperature: ${state.environmentalFactors.temperature.toFixed(1)}°C\n`;
    logContent += `Dust Level: ${state.environmentalFactors.dustLevel.toFixed(1)}%\n`;
    logContent += `Cloud Cover: ${state.environmentalFactors.cloudCover.toFixed(1)}%\n`;
    logContent += `Humidity: ${state.environmentalFactors.humidity.toFixed(1)}%\n\n`;
    
    // Separate logs by type
    const alertLogs = state.logs.filter(log => log.type.startsWith('alert-'));
    const anomalyLogs = state.logs.filter(log => log.type === 'anomaly' || log.type === 'escalation' || log.type === 'resolution');
    const systemLogs = state.logs.filter(log => !log.type.startsWith('alert-') && !['anomaly', 'escalation', 'resolution'].includes(log.type));
    
    // Add alerts section
    if (alertLogs.length > 0) {
        logContent += '--- Alerts & Notifications ---\n';
        alertLogs.forEach(log => {
            const severity = log.type.replace('alert-', '');
            logContent += `${log.timestamp.toISOString()} [${severity.toUpperCase()}] ${log.message}\n`;
        });
        logContent += '\n';
    }
    
    // Add anomaly section
    if (anomalyLogs.length > 0) {
        logContent += '--- Anomaly History ---\n';
        anomalyLogs.forEach(log => {
            logContent += `${log.timestamp.toISOString()} [${log.type.toUpperCase()}] ${log.message}\n`;
        });
        logContent += '\n';
    }
    
    // Add system logs
    logContent += '--- System Operations ---\n';
    systemLogs.forEach(log => {
        logContent += `${log.timestamp.toISOString()} [${log.type.toUpperCase()}] ${log.message}\n`;
    });
    
    // Add active anomalies details
    const activeAnomalies = state.anomalies.filter(a => a.active);
    if (activeAnomalies.length > 0) {
        logContent += '\n--- Active Anomalies Details ---\n';
        activeAnomalies.forEach(anomaly => {
            const duration = Math.floor((new Date() - anomaly.timestamp) / 60000);
            logContent += `\n${anomaly.name}:\n`;
            logContent += `  Type: ${anomaly.type}\n`;
            logContent += `  Location: ${anomaly.location}\n`;
            logContent += `  Impact: ${anomaly.impact}\n`;
            logContent += `  Duration: ${duration} minutes\n`;
            logContent += `  Escalation Level: ${anomaly.escalationLevel}\n`;
            if (anomaly.affectedEquipment) {
                logContent += `  Affected Equipment: ${anomaly.affectedEquipment.join(', ')}\n`;
            }
        });
    }
    
    // Add last drone scan report if available
    if (state.lastDroneScanReport) {
        logContent += '\n--- Last Drone Scan Report ---\n';
        logContent += `Scan Date: ${state.lastDroneScanReport.timestamp.toISOString()}\n`;
        logContent += `Duration: ${state.lastDroneScanReport.duration} seconds\n`;
        logContent += `Panels Scanned: ${state.lastDroneScanReport.panelsScanned}\n`;
        logContent += `Dust Level at Scan: ${state.lastDroneScanReport.dustLevel.toFixed(0)}%\n`;
        
        if (state.lastDroneScanReport.issuesFound.length > 0) {
            logContent += '\nIssues Found:\n';
            state.lastDroneScanReport.issuesFound.forEach(issue => {
                logContent += `  - ${issue}\n`;
            });
        }
        
        if (state.lastDroneScanReport.observations.length > 0) {
            logContent += '\nObservations:\n';
            state.lastDroneScanReport.observations.forEach(obs => {
                logContent += `  - ${obs}\n`;
            });
        }
    }
    
    // Add AI Assistant conversation history if available
    if (typeof aiAssistant !== 'undefined' && aiAssistant.conversationHistory.length > 0) {
        logContent += '\n--- AI Assistant Conversation History ---\n';
        logContent += `Total Messages: ${aiAssistant.conversationHistory.length}\n`;
        logContent += `Last Analysis: ${aiAssistant.lastAutoAnalysis ? aiAssistant.lastAutoAnalysis.toISOString() : 'N/A'}\n\n`;
        
        // Extract AI messages from DOM for better formatting with timestamps
        const aiChatMessages = document.getElementById('ai-chat-messages');
        if (aiChatMessages) {
            const messages = aiChatMessages.querySelectorAll('.ai-message');
            messages.forEach(msgElement => {
                const timeElement = msgElement.querySelector('.ai-message-time');
                const contentElement = msgElement.querySelector('.ai-message-content');
                
                if (msgElement.classList.contains('system')) {
                    logContent += `[SYSTEM] ${msgElement.textContent.trim()}\n`;
                } else if (msgElement.classList.contains('user')) {
                    const time = timeElement ? timeElement.textContent : 'N/A';
                    const content = contentElement ? contentElement.textContent : msgElement.textContent;
                    logContent += `[${time}] USER: ${content}\n`;
                } else if (msgElement.classList.contains('assistant')) {
                    const time = timeElement ? timeElement.textContent : 'N/A';
                    const content = contentElement ? contentElement.textContent : msgElement.textContent;
                    logContent += `[${time}] AI: ${content}\n`;
                } else if (msgElement.classList.contains('error')) {
                    const time = timeElement ? timeElement.textContent : 'N/A';
                    const content = contentElement ? contentElement.textContent : msgElement.textContent;
                    logContent += `[${time}] ERROR: ${content}\n`;
                }
                logContent += '\n';
            });
        } else {
            // Fallback to conversation history if DOM not available
            aiAssistant.conversationHistory.forEach((msg, index) => {
                const role = msg.role.toUpperCase();
                logContent += `[Message ${index + 1}] ${role}: ${msg.content}\n\n`;
            });
        }
    }
    
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solar_plant_logs_${timestamp.split('T')[0]}_${timestamp.split('T')[1].split('.')[0].replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Store last download time
    state.lastLogDownload = new Date();
    
    // Update UI to show last download time
    const lastDownloadSpan = document.getElementById('last-download');
    const downloadTimeSpan = document.getElementById('download-time');
    if (lastDownloadSpan && downloadTimeSpan) {
        lastDownloadSpan.style.display = 'block';
        downloadTimeSpan.textContent = state.lastLogDownload.toLocaleTimeString();
    }
}

// Auto-download functionality
function toggleAutoDownload() {
    state.autoDownloadEnabled = !state.autoDownloadEnabled;
    
    if (state.autoDownloadEnabled) {
        // Start auto-download every 30 minutes
        state.autoDownloadInterval = setInterval(() => {
            downloadLogs();
            addAlert('Auto-download: Logs saved successfully', 'info');
        }, state.settings.logDownloadInterval * 1000);
        
        addAlert(`Auto-download enabled - Logs will be saved every ${state.settings.logDownloadInterval} seconds`, 'info');
        log('Auto-download enabled', 'system');
    } else {
        // Stop auto-download
        if (state.autoDownloadInterval) {
            clearInterval(state.autoDownloadInterval);
            state.autoDownloadInterval = null;
        }
        
        addAlert('Auto-download disabled', 'info');
        log('Auto-download disabled', 'system');
    }
    
    // Update button text
    const button = document.getElementById('auto-download-btn');
    if (button) {
        button.textContent = state.autoDownloadEnabled ? 'Disable Auto-Download' : 'Enable Auto-Download';
    }
}

// Visual effects
function applyDustStormEffect() {
    const mapView = document.getElementById('map-view');
    let overlay = mapView.querySelector('.dust-overlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'dust-overlay';
        mapView.appendChild(overlay);
    }
    
    setTimeout(() => {
        overlay.classList.add('active');
    }, 100);
}

function removeDustStormEffect() {
    const overlay = document.querySelector('.dust-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 2000);
    }
}

// Generate dust accumulation after dust storm
function generateDustAccumulationAfterStorm() {
    // Create a dust accumulation anomaly
    const anomaly = {
        id: Date.now(),
        type: 'dust-accumulation',
        name: 'Dust Accumulation',
        location: `Multiple Sections`,
        impact: '10%',
        severity: 'warning',
        timestamp: new Date(),
        active: true,
        escalationLevel: 0,
        lastEscalation: new Date(),
        causedBy: 'dust-storm'
    };
    
    // Store affected equipment
    anomaly.affectedEquipment = [];
    
    // Select 4-8 random panels to affect (more than normal dust accumulation)
    const panelIds = Object.keys(state.equipmentHealth).filter(id => id.startsWith('Panel-'));
    const numToAffect = Math.floor(Math.random() * 5) + 4; // 4-8 panels
    
    // Select random panels
    for (let i = 0; i < numToAffect && i < panelIds.length; i++) {
        const randomIndex = Math.floor(Math.random() * panelIds.length);
        const equipmentId = panelIds[randomIndex];
        
        // Make sure we don't affect the same panel twice
        if (!anomaly.affectedEquipment.includes(equipmentId) && state.equipmentHealth[equipmentId]) {
            state.equipmentHealth[equipmentId].status = 'degraded';
            state.equipmentHealth[equipmentId].issues = ['dust accumulation'];
            state.equipmentHealth[equipmentId].anomaly = anomaly.id;
            state.equipmentHealth[equipmentId].health = Math.max(20, state.equipmentHealth[equipmentId].health - 25);
            anomaly.affectedEquipment.push(equipmentId);
        }
    }
    
    state.anomalies.push(anomaly);
    
    addAlert(`Dust accumulation detected on ${anomaly.affectedEquipment.length} panels after dust storm`, 'warning');
    log(`Dust accumulation anomaly generated after dust storm on ${anomaly.affectedEquipment.length} panels`, 'anomaly');
    
    updateSimulation();
    renderAnomalyList();
    
    // Update equipment view if it's currently active
    if (document.getElementById('equipment-view').classList.contains('active')) {
        renderEquipment();
    }
    
    // Update anomaly view if it's currently active
    if (document.getElementById('anomalies-view').classList.contains('active')) {
        renderAnomalyView();
    }
}

// Responsive handling
function handleResize() {
    // Re-render the map when window is resized
    if (document.getElementById('map-view').classList.contains('active')) {
        renderMap();
    }
}

// Render anomaly view
function renderAnomalyView() {
    // Update statistics
    const activeAnomalies = state.anomalies.filter(a => a.active);
    const resolvedAnomalies = state.anomalies.filter(a => !a.active);
    
    document.getElementById('active-anomaly-count').textContent = activeAnomalies.length;
    document.getElementById('total-anomaly-count').textContent = state.anomalies.length;
    document.getElementById('resolved-anomaly-count').textContent = resolvedAnomalies.length;
    
    // Update section headers with counts
    const anomalySectionHeader = document.querySelector('.anomaly-section h2');
    const historyHeader = document.querySelector('.anomaly-history h2');
    
    if (anomalySectionHeader) {
        anomalySectionHeader.setAttribute('data-count', activeAnomalies.length);
    }
    
    if (historyHeader) {
        historyHeader.setAttribute('data-count', resolvedAnomalies.length);
    }
    
    // Render active anomalies
    renderAnomalyList();
    
    // Render anomaly history
    renderAnomalyHistory();
}

// Render anomaly history
function renderAnomalyHistory() {
    const container = document.getElementById('anomaly-history');
    const resolvedAnomalies = state.anomalies
        .filter(a => !a.active)
        .sort((a, b) => (b.resolvedAt || new Date()) - (a.resolvedAt || new Date()))
        .slice(0, 10); // Show last 10 resolved
    
    container.innerHTML = resolvedAnomalies.length === 0 
        ? '<p>No resolved anomalies yet</p>'
        : resolvedAnomalies.map(anomaly => {
            const duration = anomaly.resolvedAt ? 
                Math.floor((anomaly.resolvedAt - anomaly.timestamp) / 60000) : 0;
            const resolvedTime = anomaly.resolvedAt ? 
                anomaly.resolvedAt.toLocaleTimeString() : '';
            
            return `
                <div class="history-item resolved">
                    <div class="history-info">
                        <div>
                            <h4>${anomaly.name}</h4>
                            <p>Location: ${anomaly.location}</p>
                            <p>Duration: ${duration} minutes</p>
                            <p>Resolved by: ${anomaly.resolvedBy || 'auto'}</p>
                        </div>
                        <div class="history-time">
                            ${resolvedTime}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
}

// Update alert bar for critical anomalies
function updateAlertBar() {
    const criticalAnomalies = state.anomalies.filter(a => a.active && a.escalationLevel >= 2);
    
    // Add blinking effect to alert bar if critical anomalies exist
    const alertBar = document.getElementById('alert-bar');
    if (criticalAnomalies.length > 0) {
        alertBar.classList.add('critical-alert');
    } else {
        alertBar.classList.remove('critical-alert');
    }
}

// Initial resize check
handleResize();

// Setup resize handle for alert bar
function setupResizeHandle() {
    const resizeHandle = document.getElementById('resize-handle');
    const alertBar = document.getElementById('alert-bar');
    const content = document.getElementById('content');
    const container = document.getElementById('container');
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let alertBarWidth = 300; // Default width
    
    // Load saved width from localStorage
    const savedWidth = localStorage.getItem('alertBarWidth');
    if (savedWidth) {
        alertBarWidth = parseInt(savedWidth);
        updateLayout(alertBarWidth);
    }
    
    resizeHandle.addEventListener('mousedown', initResize);
    
    function initResize(e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = alertBar.offsetWidth;
        
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
        
        // Prevent text selection while resizing
        document.body.style.userSelect = 'none';
        resizeHandle.classList.add('active');
    }
    
    function doResize(e) {
        if (!isResizing) return;
        
        const diff = startX - e.clientX;
        let newWidth = startWidth + diff;
        
        // Set min and max width constraints
        const minWidth = 250;
        const maxWidth = window.innerWidth * 0.6; // Max 60% of window width
        
        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        
        updateLayout(newWidth);
        alertBarWidth = newWidth;
    }
    
    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
        
        // Re-enable text selection
        document.body.style.userSelect = '';
        resizeHandle.classList.remove('active');
        
        // Save width to localStorage
        localStorage.setItem('alertBarWidth', alertBarWidth);
    }
    
    function updateLayout(width) {
        // Update grid template columns
        if (window.innerWidth > 768) {
            container.style.gridTemplateColumns = `250px 1fr 5px ${width}px`;
            resizeHandle.style.display = 'block';
        } else {
            // Reset for mobile
            container.style.gridTemplateColumns = '';
            resizeHandle.style.display = 'none';
        }
    }
    
    // Update layout on window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            updateLayout(alertBarWidth);
        } else {
            container.style.gridTemplateColumns = '';
            resizeHandle.style.display = 'none';
        }
    });
}

// AI Assistant Functions
async function toggleAIAssistant(e) {
    const isEnabled = e.target.checked;
    const aiSection = document.getElementById('ai-assistant-section');
    const alertsSection = document.getElementById('alerts-section');
    
    if (isEnabled) {
        // Expand AI Assistant section
        aiSection.classList.remove('collapsed');
        aiSection.classList.add('expanded');
        
        // Adjust alerts section height
        alertsSection.style.maxHeight = '40%';
        
        // Check connection
        const connected = await aiAssistant.checkConnection();
        updateConnectionStatus(connected);
        
        if (connected) {
            // Enable chat
            document.getElementById('ai-chat-input').disabled = false;
            document.getElementById('ai-send-btn').disabled = false;
            
            // Start auto-analysis with configured interval
            aiAssistant.startAutoAnalysis(() => autoAnalyzeLogs(), state.settings.aiAnalysisInterval * 1000);
            
            // Run initial analysis
            addAIMessage('Running initial system analysis...', 'system');
            autoAnalyzeLogs();
        }
        
        log('AI Assistant enabled', 'system');
    } else {
        // Collapse AI Assistant section
        aiSection.classList.remove('expanded');
        aiSection.classList.add('collapsed');
        
        // Restore alerts section height
        alertsSection.style.maxHeight = '100%';
        
        // Stop auto-analysis
        aiAssistant.stopAutoAnalysis();
        
        // Hide auto-analysis info
        document.getElementById('ai-auto-analysis').style.display = 'none';
        
        log('AI Assistant disabled', 'system');
    }
}

function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('ai-connection-status');
    if (connected) {
        statusElement.textContent = '🟢 Connected to LLM';
        statusElement.className = 'status-indicator connected';
    } else {
        statusElement.textContent = '🔴 LLM Not Available';
        statusElement.className = 'status-indicator disconnected';
        document.getElementById('ai-chat-input').disabled = true;
        document.getElementById('ai-send-btn').disabled = true;
        addAIMessage('Unable to connect to LLM server. Please ensure it is running on http://127.0.0.1:1234', 'error');
    }
}

async function autoAnalyzeLogs() {
    const response = await aiAssistant.analyzeLogs(state.logs, state);
    
    if (response.error) {
        addAIMessage(`Error: ${response.error}`, 'error');
    } else {
        addAIMessage(`Auto-Analysis Results:\n${response.message}`, 'assistant');
    }
    
    // Update last analysis time
    const autoAnalysisElement = document.getElementById('ai-auto-analysis');
    const analysisTimeElement = document.getElementById('analysis-time');
    autoAnalysisElement.style.display = 'inline';
    analysisTimeElement.textContent = new Date().toLocaleTimeString();
}

async function handleQuickAction(action) {
    let response;
    
    switch (action) {
        case 'analyze':
            addAIMessage('Analyzing recent events...', 'system');
            response = await aiAssistant.analyzeRecentEvents(state.logs);
            break;
        case 'predict':
            addAIMessage('Predicting maintenance needs...', 'system');
            response = await aiAssistant.predictMaintenance(state);
            break;
        case 'optimize':
            addAIMessage('Analyzing optimization opportunities...', 'system');
            response = await aiAssistant.optimizePerformance(state);
            break;
    }
    
    if (response.error) {
        addAIMessage(`Error: ${response.error}`, 'error');
    } else {
        addAIMessage(response.message, 'assistant');
    }
}

async function sendChatMessage() {
    const input = document.getElementById('ai-chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    addAIMessage(message, 'user');
    input.value = '';
    
    // Get AI response
    const systemContext = `Current solar plant state: ${aiAssistant.summarizeSystemState(state)}`;
    const response = await aiAssistant.sendMessage(message, systemContext);
    
    if (response.error) {
        addAIMessage(`Error: ${response.error}`, 'error');
    } else {
        addAIMessage(response.message, 'assistant');
    }
}

function addAIMessage(message, type) {
    const chatMessages = document.getElementById('ai-chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ${type}`;
    
    // Add timestamp for non-system messages
    if (type !== 'system') {
        const timestamp = document.createElement('span');
        timestamp.className = 'ai-message-time';
        timestamp.textContent = new Date().toLocaleTimeString();
        messageDiv.appendChild(timestamp);
    }
    
    const content = document.createElement('div');
    content.className = 'ai-message-content';
    content.textContent = message;
    messageDiv.appendChild(content);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Log AI interactions to main logs for record keeping
    if (type === 'user') {
        log(`AI - User: ${message}`, 'ai-chat');
    } else if (type === 'assistant') {
        log(`AI - Assistant: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`, 'ai-chat');
    } else if (type === 'error') {
        log(`AI - Error: ${message}`, 'ai-error');
    }
}

// Settings Functions
function loadSettings() {
    const savedSettings = localStorage.getItem('solarMonitorSettings');
    if (savedSettings) {
        state.settings = { ...state.settings, ...JSON.parse(savedSettings) };
    }
    
    // Update AI assistant base URL if it exists
    if (typeof aiAssistant !== 'undefined') {
        aiAssistant.baseUrl = state.settings.llmBaseUrl;
    }
}

function openSettings() {
    const modal = document.getElementById('settings-modal');
    modal.style.display = 'block';
    
    // Load current settings into inputs
    document.getElementById('llm-base-url').value = state.settings.llmBaseUrl;
    document.getElementById('ai-analysis-interval').value = state.settings.aiAnalysisInterval;
    document.getElementById('log-download-interval').value = state.settings.logDownloadInterval;
}

function closeSettings() {
    const modal = document.getElementById('settings-modal');
    modal.style.display = 'none';
}

function saveSettings() {
    // Get values from inputs
    const llmBaseUrl = document.getElementById('llm-base-url').value.trim();
    const aiAnalysisInterval = parseInt(document.getElementById('ai-analysis-interval').value);
    const logDownloadInterval = parseInt(document.getElementById('log-download-interval').value);
    
    // Validate inputs
    if (!llmBaseUrl) {
        alert('Please enter a valid LLM Base URL');
        return;
    }
    
    if (aiAnalysisInterval < 30 || aiAnalysisInterval > 3600) {
        alert('AI Analysis Interval must be between 30 and 3600 seconds');
        return;
    }
    
    if (logDownloadInterval < 60 || logDownloadInterval > 7200) {
        alert('Log Download Interval must be between 60 and 7200 seconds');
        return;
    }
    
    // Update settings
    state.settings.llmBaseUrl = llmBaseUrl;
    state.settings.aiAnalysisInterval = aiAnalysisInterval;
    state.settings.logDownloadInterval = logDownloadInterval;
    
    // Save to localStorage
    localStorage.setItem('solarMonitorSettings', JSON.stringify(state.settings));
    
    // Apply settings
    applySettings();
    
    // Close modal
    closeSettings();
    
    addAlert('Settings saved successfully', 'info');
    log('Settings updated', 'system');
}

function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
        state.settings = {
            llmBaseUrl: 'http://127.0.0.1:1234',
            aiAnalysisInterval: 180,
            logDownloadInterval: 600
        };
        
        // Update inputs
        document.getElementById('llm-base-url').value = state.settings.llmBaseUrl;
        document.getElementById('ai-analysis-interval').value = state.settings.aiAnalysisInterval;
        document.getElementById('log-download-interval').value = state.settings.logDownloadInterval;
        
        // Save and apply
        localStorage.setItem('solarMonitorSettings', JSON.stringify(state.settings));
        applySettings();
        
        addAlert('Settings reset to defaults', 'info');
        log('Settings reset to defaults', 'system');
    }
}

function applySettings() {
    // Update AI assistant base URL
    if (typeof aiAssistant !== 'undefined') {
        aiAssistant.baseUrl = state.settings.llmBaseUrl;
    }
    
    // If AI assistant is active, restart auto-analysis with new interval
    const aiToggle = document.getElementById('ai-assistant-toggle');
    if (aiToggle && aiToggle.checked) {
        aiAssistant.stopAutoAnalysis();
        aiAssistant.startAutoAnalysis(() => autoAnalyzeLogs(), state.settings.aiAnalysisInterval * 1000);
    }
    
    // If auto-download is active, restart with new interval
    if (state.autoDownloadEnabled) {
        // Stop current interval
        if (state.autoDownloadInterval) {
            clearInterval(state.autoDownloadInterval);
        }
        
        // Start with new interval
        state.autoDownloadInterval = setInterval(() => {
            downloadLogs();
            addAlert('Auto-download: Logs saved successfully', 'info');
        }, state.settings.logDownloadInterval * 1000);
    }
}

// AI Report Generation Functions
let currentReportHTML = '';

async function generateAIReport() {
    const modal = document.getElementById('report-modal');
    const loading = document.getElementById('report-loading');
    const iframe = document.getElementById('report-iframe');
    
    // Show modal and loading
    modal.style.display = 'block';
    loading.style.display = 'block';
    iframe.style.display = 'none';
    
    try {
        // Prepare data for AI analysis
        const reportData = prepareReportData();
        
        // Generate AI analysis
        const aiAnalysis = await getAIReportAnalysis(reportData);
        
        // Generate HTML report
        currentReportHTML = generateHTMLReport(reportData, aiAnalysis);
        
        // Display in iframe
        const blob = new Blob([currentReportHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        iframe.src = url;
        iframe.style.display = 'block';
        loading.style.display = 'none';
        
    } catch (error) {
        loading.innerHTML = `<p style="color: var(--alert-red);">Error generating report: ${error.message}</p>`;
        addAlert('Failed to generate AI report', 'critical');
    }
}

function prepareReportData() {
    const now = new Date();
    const logs = state.logs.slice(-50); // Last 50 logs
    
    // Calculate statistics
    const totalAnomalies = state.anomalies.length;
    const activeAnomalies = state.anomalies.filter(a => a.status === 'active').length;
    const resolvedAnomalies = totalAnomalies - activeAnomalies;
    
    const equipmentStatus = Object.entries(state.equipmentHealth).map(([id, data]) => ({
        id,
        health: data.health,
        status: data.status,
        issues: data.issues
    }));
    
    const healthyEquipment = equipmentStatus.filter(e => e.status === 'healthy').length;
    const totalEquipment = equipmentStatus.length;
    
    // Generation efficiency over time (mock historical data for now)
    const avgEfficiency = state.currentGeneration > 0 ? 
        (state.currentGeneration / state.capacity * 100).toFixed(1) : 0;
    
    // Analyze log patterns
    const logAnalysis = analyzeLogPatterns(logs);
    
    // Equipment performance breakdown
    const equipmentBreakdown = {
        panels: equipmentStatus.filter(e => e.id.includes('Panel')),
        inverters: equipmentStatus.filter(e => e.id.includes('Inverter')),
        batteries: equipmentStatus.filter(e => e.id.includes('Battery')),
        transformers: equipmentStatus.filter(e => e.id.includes('Transformer'))
    };
    
    // Calculate performance metrics
    const performanceMetrics = {
        avgPanelHealth: equipmentBreakdown.panels.reduce((sum, p) => sum + p.health, 0) / equipmentBreakdown.panels.length,
        avgInverterHealth: equipmentBreakdown.inverters.reduce((sum, i) => sum + i.health, 0) / equipmentBreakdown.inverters.length,
        criticalEquipment: equipmentStatus.filter(e => e.health < 80),
        maintenanceNeeded: equipmentStatus.filter(e => e.issues.length > 0)
    };
    
    return {
        timestamp: now,
        plantInfo: {
            capacity: state.capacity,
            currentGeneration: state.currentGeneration,
            dailyCumulative: state.dailyCumulative,
            efficiency: avgEfficiency,
            currentTime: getCurrentTime()
        },
        environmental: state.environmentalFactors,
        anomalies: {
            total: totalAnomalies,
            active: activeAnomalies,
            resolved: resolvedAnomalies,
            details: state.anomalies,
            avgResolutionTime: calculateAvgResolutionTime(state.anomalies)
        },
        equipment: {
            total: totalEquipment,
            healthy: healthyEquipment,
            details: equipmentStatus,
            breakdown: equipmentBreakdown,
            metrics: performanceMetrics
        },
        logs: logs,
        logAnalysis: logAnalysis,
        lastDroneScan: state.lastDroneScanReport || null,
        operationalInsights: generateOperationalInsights(state),
        environmentalImpact: calculateEnvironmentalImpact(state.environmentalFactors)
    };
}

function analyzeLogPatterns(logs) {
    // Filter logs after "System operating normally" as per documentation
    let relevantLogs = logs;
    const normalOperationIndex = logs.map((l, i) => 
        (l.message.includes('System operating normally') || 
         l.message.includes('Operating conditions optimal')) ? i : -1
    ).filter(i => i >= 0).pop();
    
    if (normalOperationIndex !== undefined) {
        relevantLogs = logs.slice(normalOperationIndex + 1);
    }
    
    const patterns = {
        criticalEvents: relevantLogs.filter(l => l.type === 'alert-critical'),
        warnings: relevantLogs.filter(l => l.type === 'alert-warning'),
        anomalies: relevantLogs.filter(l => l.type === 'anomaly' && 
                                          !l.message.includes('ESCALATION') &&
                                          !l.message.includes('System performance degraded')),
        systemEvents: relevantLogs.filter(l => l.type === 'system'),
        
        // Time-based analysis
        eventsByHour: {},
        mostActiveHour: null,
        
        // Pattern detection
        patterns: identifyRecurringIssues(relevantLogs)
    };
    
    // Analyze event timing
    relevantLogs.forEach(log => {
        const hour = new Date(log.timestamp).getHours();
        patterns.eventsByHour[hour] = (patterns.eventsByHour[hour] || 0) + 1;
    });
    
    // Find most active hour
    let maxEvents = 0;
    Object.entries(patterns.eventsByHour).forEach(([hour, count]) => {
        if (count > maxEvents) {
            maxEvents = count;
            patterns.mostActiveHour = parseInt(hour);
        }
    });
    
    return patterns;
}

function identifyRecurringIssues(logs) {
    const issueCount = {};
    
    logs.forEach(log => {
        if (log.type === 'anomaly' || log.type === 'alert-warning' || log.type === 'alert-critical') {
            // Extract equipment ID from message
            const equipmentMatch = log.message.match(/(Panel|Inverter|Battery|Transformer)-\d+/);
            if (equipmentMatch) {
                const equipment = equipmentMatch[0];
                issueCount[equipment] = (issueCount[equipment] || 0) + 1;
            }
        }
    });
    
    // Return equipment with recurring issues (2+ occurrences)
    return Object.entries(issueCount)
        .filter(([_, count]) => count >= 2)
        .map(([equipment, count]) => ({ equipment, count }));
}

function calculateAvgResolutionTime(anomalies) {
    const resolved = anomalies.filter(a => a.status === 'resolved');
    if (resolved.length === 0) return 'N/A';
    
    const totalTime = resolved.reduce((sum, a) => {
        if (a.resolvedAt && a.timestamp) {
            return sum + (new Date(a.resolvedAt) - new Date(a.timestamp));
        }
        return sum;
    }, 0);
    
    const avgMinutes = Math.floor(totalTime / resolved.length / 60000);
    return `${avgMinutes} minutes`;
}

function generateOperationalInsights(state) {
    const insights = [];
    
    // Environmental impact analysis
    if (state.environmentalFactors.dustLevel > 20) {
        insights.push({
            type: 'environmental',
            severity: 'warning',
            message: `High dust levels (${state.environmentalFactors.dustLevel}%) are reducing generation efficiency by approximately ${(state.environmentalFactors.dustLevel * 0.5).toFixed(1)}%`
        });
    }
    
    // Temperature efficiency
    if (state.environmentalFactors.temperature > 35) {
        const tempLoss = (state.environmentalFactors.temperature - 25) * 0.4;
        insights.push({
            type: 'environmental',
            severity: 'warning',
            message: `High temperature (${state.environmentalFactors.temperature}°C) causing ${tempLoss.toFixed(1)}% efficiency loss`
        });
    }
    
    // Equipment health insights
    const unhealthyEquipment = Object.values(state.equipmentHealth).filter(e => e.health < 85);
    if (unhealthyEquipment.length > 0) {
        insights.push({
            type: 'equipment',
            severity: unhealthyEquipment.some(e => e.health < 70) ? 'critical' : 'warning',
            message: `${unhealthyEquipment.length} equipment units require attention (health below 85%)`
        });
    }
    
    // Generation insights
    const currentHour = getCurrentTime().getHours();
    const isDayTime = currentHour >= 6 && currentHour <= 18;
    if (isDayTime && state.currentGeneration < state.capacity * 0.5) {
        insights.push({
            type: 'generation',
            severity: 'warning',
            message: `Generation below 50% capacity during peak hours - investigate potential issues`
        });
    }
    
    return insights;
}

async function getAIReportAnalysis(data) {
    if (!await aiAssistant.checkConnection()) {
        return {
            summary: "AI analysis unavailable - LLM not connected",
            healthAssessment: "Unable to assess",
            recommendations: ["Connect to LLM for detailed analysis"],
            predictions: ["AI predictions unavailable"],
            riskAssessment: "Unable to assess risks",
            efficiencyAnalysis: "Analysis unavailable",
            maintenancePlan: "Unable to generate maintenance plan"
        };
    }
    
    // Build comprehensive equipment summary
    const equipmentSummary = `
Panels: ${data.equipment.breakdown.panels.length} units, Avg Health: ${data.equipment.metrics.avgPanelHealth.toFixed(1)}%
Inverters: ${data.equipment.breakdown.inverters.length} units, Avg Health: ${data.equipment.metrics.avgInverterHealth.toFixed(1)}%
Critical Equipment (<80% health): ${data.equipment.metrics.criticalEquipment.length} units
Maintenance Required: ${data.equipment.metrics.maintenanceNeeded.length} units`;

    // Build anomaly details
    const anomalyDetails = data.anomalies.active > 0 ? 
        data.anomalies.details.filter(a => a.status === 'active')
            .map(a => `- ${a.name} at ${a.location} (Impact: ${a.impact})`)
            .join('\n') : 'No active anomalies';

    // Build insights summary
    const insightsSummary = data.operationalInsights.length > 0 ?
        data.operationalInsights.map(i => `- [${i.severity.toUpperCase()}] ${i.message}`).join('\n') :
        'No critical operational issues detected';

    // Calculate environmental impacts
    const envImpact = calculateEnvironmentalImpact(data.environmental);
    
    // Calculate ideal and expected generation for current time
    const hour = data.plantInfo.currentTime.getHours();
    let idealGeneration = 0;
    let expectedGeneration = 0;
    
    if (hour >= 6 && hour <= 18) {
        const timeInDaylight = (hour - 6) / 12;
        idealGeneration = data.plantInfo.capacity * Math.sin(timeInDaylight * Math.PI);
        
        // Apply environmental factors to get expected generation
        const tempFactor = 1 - (parseFloat(envImpact.temperatureLoss) / 100);
        const dustFactor = 1 - (parseFloat(envImpact.dustLoss) / 100);
        const cloudFactor = 1 - (parseFloat(envImpact.cloudLoss) / 100);
        expectedGeneration = idealGeneration * tempFactor * dustFactor * cloudFactor;
    }
    
    const performanceRatio = expectedGeneration > 0 ? 
        ((data.plantInfo.currentGeneration / expectedGeneration) * 100).toFixed(1) : 'N/A';

    const prompt = `You are an expert solar plant analyst. Generate a DETAILED and COMPREHENSIVE analysis report based on this operational data:

=== PLANT OVERVIEW ===
Facility: 100MW Solar Power Plant - Rajasthan
Current Time: ${data.plantInfo.currentTime.toLocaleString()}
Operating Status: ${data.plantInfo.currentGeneration > 0 ? 'ONLINE' : 'OFFLINE'}

=== GENERATION METRICS ===
- Current Output: ${data.plantInfo.currentGeneration.toFixed(2)}MW (${data.plantInfo.efficiency}% of capacity)
- Daily Production: ${data.plantInfo.dailyCumulative.toFixed(2)}MWh
- Expected Daily Target: ${(data.plantInfo.capacity * 6).toFixed(0)}MWh (6 peak sun hours)
- Performance vs Target: ${((data.plantInfo.dailyCumulative / (data.plantInfo.capacity * 6)) * 100).toFixed(1)}%
- Ideal Generation (current time): ${idealGeneration.toFixed(2)}MW
- Expected Generation (with env factors): ${expectedGeneration.toFixed(2)}MW
- Performance Ratio: ${performanceRatio}%

=== EQUIPMENT STATUS ===
${equipmentSummary}

Detailed Issues:
${data.equipment.metrics.maintenanceNeeded.map(e => `- ${e.id}: ${e.issues.join(', ')}`).join('\n') || 'No equipment issues reported'}

=== ENVIRONMENTAL CONDITIONS ===
- Temperature: ${data.environmental.temperature}°C (Impact: ${envImpact.temperatureLoss})
- Dust Level: ${data.environmental.dustLevel}% (Impact: ${envImpact.dustLoss})
- Cloud Cover: ${data.environmental.cloudCover}% (Impact: ${envImpact.cloudLoss})
- Total Environmental Impact: ${envImpact.totalImpact}

=== ANOMALY STATUS ===
Active/Total/Resolved: ${data.anomalies.active}/${data.anomalies.total}/${data.anomalies.resolved}
Average Resolution Time: ${data.anomalies.avgResolutionTime}

Active Anomalies:
${anomalyDetails}

=== OPERATIONAL INSIGHTS ===
${insightsSummary}

=== LOG ANALYSIS (Last 50 entries) ===
- Critical Events: ${data.logAnalysis.criticalEvents.length}
- Warnings: ${data.logAnalysis.warnings.length}
- Anomaly Events: ${data.logAnalysis.anomalies.length}
- System Events: ${data.logAnalysis.systemEvents.length}
- Most Active Hour: ${data.logAnalysis.mostActiveHour !== null ? `${data.logAnalysis.mostActiveHour}:00` : 'N/A'}
- Recurring Issues: ${data.logAnalysis.patterns.length > 0 ? 
    data.logAnalysis.patterns.map(p => `${p.equipment} (${p.count} times)`).join(', ') : 'None'}

IMPORTANT GUIDELINES:
1. Be specific with numbers and percentages
2. Prioritize actionable insights
3. Consider environmental impacts (already calculated above)
4. Focus on ROI and efficiency improvements
5. Provide clear timelines for all recommendations

Generate a comprehensive report with these sections:

### Executive Summary
Provide 3-5 bullet points summarizing plant status, key metrics, and critical issues.

### Equipment Health Assessment
Detailed analysis of equipment status by category (panels, inverters, batteries, transformers). Include health percentages, degradation patterns, and maintenance needs.

### Efficiency Analysis
- Current vs expected generation analysis
- Environmental losses breakdown
- Equipment-related efficiency impacts
- Optimization opportunities

### Risk Assessment
Categorize risks by severity:
- Critical: Immediate action required
- High: Action within 24 hours
- Medium: Scheduled maintenance
- Low: Monitoring recommended

### Recommendations
Provide prioritized, actionable recommendations with expected impact and ROI.

### Maintenance Plan
7-day maintenance schedule with:
- Daily tasks
- Equipment-specific maintenance
- Resource requirements
- Priority matrix

### Performance Predictions
24-48 hour forecast including:
- Expected generation levels
- Weather impact projections
- Potential issues
- Optimal operating windows`;

    const response = await aiAssistant.sendMessage(prompt, 
        "You are an expert solar plant analyst with 20 years of experience. Provide detailed, technical analysis with specific metrics and actionable insights. Use professional language and be thorough in your assessment.", 
        2000);  // Increased token limit for detailed report
    
    if (response.error) {
        return {
            summary: "AI analysis error",
            healthAssessment: response.error,
            recommendations: ["Check LLM connection"],
            predictions: ["Unable to generate predictions"],
            riskAssessment: "Error in analysis",
            efficiencyAnalysis: "Analysis failed",
            maintenancePlan: "Unable to generate"
        };
    }
    
    // Parse AI response into structured format
    return parseDetailedAIResponse(response.message);
}

function calculateEnvironmentalImpact(environmental) {
    // Temperature impact (0.4% loss per degree above 25°C)
    const tempImpact = Math.max(0, (environmental.temperature - 25) * 0.4);
    
    // Dust impact (up to 30% loss based on dust level)
    const dustImpact = (environmental.dustLevel / 100) * 30;
    
    // Cloud cover impact (up to 50% loss based on cloud cover)
    const cloudImpact = (environmental.cloudCover / 100) * 50;
    
    const totalImpact = tempImpact + dustImpact + cloudImpact;
    
    // Return structured object as per documentation
    return {
        temperatureLoss: tempImpact.toFixed(1) + '%',
        dustLoss: dustImpact.toFixed(1) + '%',
        cloudLoss: cloudImpact.toFixed(1) + '%',
        totalImpact: totalImpact.toFixed(1) + '%',
        expectedGeneration: null // Will be calculated with actual ideal generation
    };
}

function parseDetailedAIResponse(aiText) {
    const sections = {
        executivesummary: "",
        equipmenthealthassessment: "",
        efficiencyanalysis: "",
        riskassessment: "",
        recommendations: "",
        maintenanceplan: "",
        performancepredictions: ""
    };
    
    const sectionHeaders = [
        'Executive Summary',
        'Equipment Health Assessment',
        'Efficiency Analysis',
        'Risk Assessment',
        'Recommendations',
        'Maintenance Plan',
        'Performance Predictions'
    ];
    
    sectionHeaders.forEach((header, index) => {
        const startPattern = new RegExp(`${header}:?\\s*\\n`, 'i');
        const nextHeader = sectionHeaders[index + 1];
        const endPattern = nextHeader ? 
            new RegExp(`${nextHeader}:?\\s*\\n`, 'i') : null;
        
        const sectionKey = header.toLowerCase().replace(/\s+/g, '');
        
        // Extract content between patterns
        let content = '';
        if (endPattern) {
            const startMatch = aiText.match(startPattern);
            const endMatch = aiText.match(endPattern);
            if (startMatch && endMatch) {
                const startIdx = startMatch.index + startMatch[0].length;
                const endIdx = endMatch.index;
                content = aiText.substring(startIdx, endIdx).trim();
            }
        } else {
            // Last section
            const startMatch = aiText.match(startPattern);
            if (startMatch) {
                const startIdx = startMatch.index + startMatch[0].length;
                content = aiText.substring(startIdx).trim();
            }
        }
        
        sections[sectionKey] = content || 'Section not available';
    });
    
    // Convert recommendations and predictions to arrays if they look like lists
    if (sections.recommendations && typeof sections.recommendations === 'string') {
        const recArray = sections.recommendations.split('\n')
            .filter(r => r.trim().match(/^\d+\.|^-|^•/))
            .map(r => r.replace(/^\d+\.|^-|^•/, '').trim());
        sections.recommendations = recArray.length > 0 ? recArray : ["Continue monitoring system performance"];
    }
    
    if (sections.performancepredictions && typeof sections.performancepredictions === 'string') {
        const predArray = sections.performancepredictions.split('\n')
            .filter(p => p.trim().match(/^\d+\.|^-|^•/))
            .map(p => p.replace(/^\d+\.|^-|^•/, '').trim());
        sections.predictions = predArray.length > 0 ? predArray : ["Generation expected to maintain current efficiency levels"];
    }
    
    // Map new structure to old for backward compatibility
    return {
        summary: sections.executivesummary,
        healthAssessment: sections.equipmenthealthassessment,
        efficiencyAnalysis: sections.efficiencyanalysis,
        riskAssessment: sections.riskassessment,
        recommendations: Array.isArray(sections.recommendations) ? sections.recommendations : [sections.recommendations],
        maintenancePlan: sections.maintenanceplan,
        predictions: sections.predictions || ["Performance analysis pending"]
    };
}

function parseAIResponse(aiText) {
    // Simple parsing - in production, you'd want more robust parsing
    const sections = aiText.split('\n\n');
    
    return {
        summary: sections[0] || "No summary available",
        healthAssessment: sections[1] || "Assessment pending",
        recommendations: sections[2] ? sections[2].split('\n').filter(r => r.trim()) : ["No recommendations"],
        predictions: sections[3] ? sections[3].split('\n').filter(p => p.trim()) : ["No predictions"]
    };
}

// Markdown to HTML conversion functions
function convertMarkdownToHTML(text) {
    if (!text) return '';
    
    // Convert headers
    text = text.replace(/^### (.+)$/gm, '<h3 class="report-subsection">$1</h3>');
    text = text.replace(/^## (.+)$/gm, '<h2 class="report-section-title">$1</h2>');
    text = text.replace(/^# (.+)$/gm, '<h1 class="report-title">$1</h1>');
    
    // Convert lists
    text = convertMarkdownLists(text);
    
    // Convert tables
    text = convertMarkdownTables(text);
    
    // Convert emphasis
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    text = text.replace(/_(.+?)_/g, '<em>$1</em>');
    
    // Convert line breaks to paragraphs
    text = text.split('\n\n').map(para => {
        if (para.trim() && 
            !para.startsWith('<h') && 
            !para.startsWith('<ul') && 
            !para.startsWith('<ol') && 
            !para.startsWith('<table')) {
            return `<p>${para.trim()}</p>`;
        }
        return para;
    }).join('\n');
    
    return text;
}

function convertMarkdownLists(text) {
    // Convert unordered lists
    const lines = text.split('\n');
    let inList = false;
    let listItems = [];
    let result = [];
    
    lines.forEach((line, index) => {
        if (line.match(/^[-*] (.+)$/)) {
            const item = line.replace(/^[-*] (.+)$/, '$1');
            if (!inList) {
                inList = true;
                listItems = [];
            }
            listItems.push(`<li>${item}</li>`);
        } else if (line.match(/^\d+\. (.+)$/)) {
            const item = line.replace(/^\d+\. (.+)$/, '$1');
            if (!inList) {
                inList = true;
                listItems = [];
            }
            listItems.push(`<li>${item}</li>`);
        } else {
            if (inList) {
                result.push(`<ul class="report-list">\n${listItems.join('\n')}\n</ul>`);
                inList = false;
                listItems = [];
            }
            result.push(line);
        }
    });
    
    // Handle list at end of text
    if (inList) {
        result.push(`<ul class="report-list">\n${listItems.join('\n')}\n</ul>`);
    }
    
    return result.join('\n');
}

function convertMarkdownTables(text) {
    const tableRegex = /\|(.+)\|\n\|(-+\|)+\n((\|.+\|\n?)+)/g;
    
    return text.replace(tableRegex, function(match, header, separator, body) {
        const headers = header.split('|').filter(h => h.trim());
        const rows = body.trim().split('\n').map(row => 
            row.split('|').filter(cell => cell.trim())
        );
        
        let html = '<table class="report-table">\n<thead>\n<tr>\n';
        headers.forEach(h => {
            html += `<th>${h.trim()}</th>\n`;
        });
        html += '</tr>\n</thead>\n<tbody>\n';
        
        rows.forEach(row => {
            html += '<tr>\n';
            row.forEach(cell => {
                html += `<td>${cell.trim()}</td>\n`;
            });
            html += '</tr>\n';
        });
        
        html += '</tbody>\n</table>';
        return html;
    });
}

function generateHTMLReport(data, aiAnalysis) {
    const reportDate = data.timestamp.toLocaleDateString();
    const reportTime = data.timestamp.toLocaleTimeString();
    
    // Get current theme
    const currentTheme = localStorage.getItem('solarMonitorTheme') || 'dark';
    
    const html = `
<!DOCTYPE html>
<html lang="en" data-theme="${currentTheme}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Solar Plant AI Report - ${reportDate}</title>
    <style>
        /* Import JetBrains Mono font */
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        
        /* Theme Variables */
        :root {
            /* Light Theme */
            --report-bg: #f5f5f5;
            --report-card-bg: #ffffff;
            --report-text: #333333;
            --report-heading: #1a1a1a;
            --report-border: #e0e0e0;
            --report-accent-success: #27ae60;
            --report-accent-warning: #f39c12;
            --report-accent-danger: #e74c3c;
            --report-accent-info: #3498db;
            --report-accent-purple: #9b59b6;
            --report-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        [data-theme="dark"] {
            /* Dark Theme */
            --report-bg: #1a1a1a;
            --report-card-bg: rgba(255, 255, 255, 0.05);
            --report-text: #e0e0e0;
            --report-heading: #ffffff;
            --report-border: rgba(255, 255, 255, 0.1);
            --report-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        
        /* Base Styles */
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
            line-height: 1.6;
            color: var(--report-text);
            background: var(--report-bg);
            margin: 0;
            padding: 0;
        }
        
        .report-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        
        /* Ensure all content stays within section bounds */
        .report-section > * {
            max-width: 100%;
        }
        
        /* Prevent horizontal scrolling */
        .report-section p,
        .report-section div,
        .report-section ul,
        .report-section ol {
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        /* Report Header */
        .report-header {
            background: linear-gradient(135deg, #2c5282 0%, #2d3748 100%);
            color: white;
            padding: 40px;
            border-radius: 12px;
            margin-bottom: 40px;
            text-align: center;
            backdrop-filter: blur(10px);
        }
        
        .report-title {
            font-size: 2.5rem;
            font-weight: 700;
            margin: 0 0 20px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
        }
        
        .report-meta {
            display: flex;
            justify-content: space-around;
            margin-top: 30px;
            font-size: 0.9375rem;
            opacity: 0.95;
        }
        
        .report-meta strong {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
        }
        
        /* Section Styles */
        .report-section {
            background: var(--report-card-bg);
            border: 1px solid var(--report-border);
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: var(--report-shadow);
            overflow: hidden; /* Ensure content doesn't overflow */
        }
        
        [data-theme="dark"] .report-section {
            backdrop-filter: blur(10px);
        }
        
        /* Ensure all section content stays within bounds */
        .section-content {
            width: 100%;
            overflow-wrap: break-word;
        }
        
        .report-section-title {
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--report-heading);
            margin: 0 0 25px 0;
            padding-bottom: 15px;
            border-bottom: 2px solid var(--report-border);
        }
        
        .report-subsection {
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--report-heading);
            margin: 20px 0 15px 0;
        }
        
        /* Executive Summary */
        .executive-summary {
            background: linear-gradient(135deg, 
                rgba(52, 152, 219, 0.1) 0%, 
                rgba(52, 152, 219, 0.05) 100%);
            border-left: 4px solid var(--report-accent-info);
            padding: 25px;
            border-radius: 8px;
            margin: 20px 0;
            width: 100%;
            box-sizing: border-box;
        }
        
        .summary-points {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .summary-point {
            position: relative;
            padding-left: 30px;
            margin-bottom: 15px;
            line-height: 1.8;
        }
        
        .summary-point::before {
            content: "•";
            position: absolute;
            left: 10px;
            color: var(--report-accent-info);
            font-weight: bold;
            font-size: 1.2em;
        }
        
        /* Metrics Grid */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 25px 0;
        }
        
        .metric-card {
            background: var(--report-card-bg);
            border: 1px solid var(--report-border);
            border-radius: 10px;
            padding: 25px;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        [data-theme="dark"] .metric-card {
            background: rgba(255, 255, 255, 0.03);
        }
        
        .metric-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .metric-label {
            font-size: 0.875rem;
            color: var(--report-text);
            opacity: 0.8;
            margin-bottom: 10px;
            font-weight: 500;
        }
        
        .metric-value {
            font-size: 2.25rem;
            font-weight: 700;
            color: var(--report-heading);
            margin: 10px 0;
        }
        
        .metric-sub {
            font-size: 0.875rem;
            color: var(--report-text);
            opacity: 0.7;
        }
        
        /* Status Colors */
        .status-good { color: var(--report-accent-success); }
        .status-warning { color: var(--report-accent-warning); }
        .status-critical { color: var(--report-accent-danger); }
        
        /* Tables */
        .report-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: var(--report-card-bg);
            border-radius: 8px;
            overflow: hidden;
            box-shadow: var(--report-shadow);
            table-layout: fixed; /* Prevent table from expanding */
        }
        
        /* Ensure table content wraps */
        .report-table td,
        .report-table th {
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        
        .report-table thead {
            background: rgba(52, 152, 219, 0.1);
        }
        
        .report-table th {
            padding: 15px;
            text-align: left;
            font-weight: 600;
            color: var(--report-heading);
            border-bottom: 2px solid var(--report-border);
        }
        
        .report-table td {
            padding: 12px 15px;
            border-bottom: 1px solid var(--report-border);
        }
        
        .report-table tr:hover {
            background: rgba(52, 152, 219, 0.05);
        }
        
        /* Lists */
        .report-list {
            list-style: none;
            padding: 0;
            margin: 15px 0;
        }
        
        .report-list li {
            position: relative;
            padding-left: 25px;
            margin-bottom: 10px;
        }
        
        .report-list li::before {
            content: "▸";
            position: absolute;
            left: 5px;
            color: var(--report-accent-info);
            font-weight: bold;
        }
        
        /* Risk Cards */
        .risk-grid {
            display: grid;
            gap: 20px;
            margin: 25px 0;
            width: 100%;
        }
        
        .risk-card {
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid;
        }
        
        .risk-critical {
            background: rgba(231, 76, 60, 0.1);
            border-left-color: var(--report-accent-danger);
        }
        
        .risk-high {
            background: rgba(243, 156, 18, 0.1);
            border-left-color: var(--report-accent-warning);
        }
        
        .risk-medium {
            background: rgba(52, 152, 219, 0.1);
            border-left-color: var(--report-accent-info);
        }
        
        .risk-low {
            background: rgba(39, 174, 96, 0.1);
            border-left-color: var(--report-accent-success);
        }
        
        /* Health Indicators */
        .health-indicator {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.875rem;
            font-weight: 500;
        }
        
        .health-good {
            background: rgba(39, 174, 96, 0.2);
            color: var(--report-accent-success);
        }
        
        .health-warning {
            background: rgba(243, 156, 18, 0.2);
            color: var(--report-accent-warning);
        }
        
        .health-critical {
            background: rgba(231, 76, 60, 0.2);
            color: var(--report-accent-danger);
        }
        
        /* Equipment Breakdown */
        .equipment-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin: 20px 0;
            width: 100%;
        }
        
        .equipment-category {
            background: var(--report-card-bg);
            border: 1px solid var(--report-border);
            border-radius: 10px;
            padding: 20px;
        }
        
        [data-theme="dark"] .equipment-category {
            background: rgba(255, 255, 255, 0.03);
        }
        
        .equipment-category h4 {
            color: var(--report-heading);
            margin: 0 0 15px 0;
            font-weight: 600;
        }
        
        /* Maintenance Timeline */
        .maintenance-timeline {
            position: relative;
            padding-left: 40px;
            margin: 20px 0;
        }
        
        .maintenance-day {
            position: relative;
            padding: 20px;
            margin-bottom: 20px;
            background: var(--report-card-bg);
            border: 1px solid var(--report-border);
            border-radius: 8px;
        }
        
        /* Recent Events Container */
        .recent-events-container {
            max-height: 300px;
            overflow-y: auto;
            padding: 10px;
            background: var(--report-card-bg);
            border-radius: 8px;
            border: 1px solid var(--report-border);
            width: 100%;
            box-sizing: border-box;
        }
        
        /* Report Footer */
        .report-footer {
            text-align: center;
            opacity: 0.8;
        }
        
        /* Print Styles */
        @media print {
            body {
                background: white;
                color: black;
            }
            
            .report-container {
                padding: 20px;
            }
            
            .report-section {
                page-break-inside: avoid;
                border: 1px solid #ddd;
                box-shadow: none;
            }
            
            .report-header {
                background: #f0f0f0 !important;
                color: black !important;
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
            
            .no-print {
                display: none;
            }
        }
        
        /* Responsive Design */
        @media (max-width: 768px) {
            .metrics-grid {
                grid-template-columns: 1fr;
            }
            
            .report-container {
                padding: 20px 10px;
            }
            
            .report-section {
                padding: 20px;
            }
            
            .report-title {
                font-size: 2rem;
            }
            
            .report-meta {
                flex-direction: column;
                gap: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <h1 class="report-title">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.55 18.54l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8zM11 22.45h2V19.5h-2v2.95zM4 10.5H1v2h3v-2zm11-4.19V1.5H9v4.81C7.21 7.35 6 9.28 6 11.5c0 3.31 2.69 6 6 6s6-2.69 6-6c0-2.22-1.21-4.15-3-5.19zm5 4.19v2h3v-2h-3zm-2.76 7.66l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4z"/>
                </svg>
                Solar Plant AI Analysis Report
            </h1>
            <div class="report-meta">
                <div>
                    <strong>Generated</strong>
                    ${reportDate} at ${reportTime}
                </div>
                <div>
                    <strong>Plant Capacity</strong>
                    ${data.plantInfo.capacity} MW
                </div>
                <div>
                    <strong>Analysis Type</strong>
                    Comprehensive Report
                </div>
            </div>
        </div>

        <!-- Executive Summary -->
        <div class="report-section">
            <h2 class="report-section-title">Executive Summary</h2>
            <div class="executive-summary">
                ${convertMarkdownToHTML(aiAnalysis.summary)}
            </div>
        </div>

        <!-- Current Plant Status -->
        <div class="report-section">
            <h2 class="report-section-title">Current Plant Status</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Current Generation</div>
                    <div class="metric-value">${data.plantInfo.currentGeneration.toFixed(2)} MW</div>
                    <div class="metric-sub">${data.plantInfo.efficiency}% of capacity</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Daily Production</div>
                    <div class="metric-value">${data.plantInfo.dailyCumulative.toFixed(2)} MWh</div>
                    <div class="metric-sub">Target: ${(data.plantInfo.capacity * 6).toFixed(0)} MWh</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Equipment Health</div>
                    <div class="metric-value ${data.equipment.healthy === data.equipment.total ? 'status-good' : 'status-warning'}">
                        ${data.equipment.healthy}/${data.equipment.total}
                    </div>
                    <div class="metric-sub">healthy units</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Active Anomalies</div>
                    <div class="metric-value ${data.anomalies.active === 0 ? 'status-good' : data.anomalies.active > 2 ? 'status-critical' : 'status-warning'}">
                        ${data.anomalies.active}
                    </div>
                    <div class="metric-sub">of ${data.anomalies.total} total today</div>
                </div>
            </div>
        </div>

        <!-- Environmental Conditions -->
        <div class="report-section">
            <h2 class="report-section-title">Environmental Conditions</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Temperature</div>
                    <div class="metric-value">${data.environmental.temperature}°C</div>
                    <div class="metric-sub">${data.environmentalImpact ? `Impact: ${data.environmentalImpact.temperatureLoss}` : 'Optimal: 25°C'}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Dust Level</div>
                    <div class="metric-value ${data.environmental.dustLevel > 30 ? 'status-warning' : 'status-good'}">
                        ${data.environmental.dustLevel}%
                    </div>
                    <div class="metric-sub">${data.environmentalImpact ? `Impact: ${data.environmentalImpact.dustLoss}` : 'Acceptable: <10%'}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Cloud Cover</div>
                    <div class="metric-value">${data.environmental.cloudCover}%</div>
                    <div class="metric-sub">${data.environmentalImpact ? `Impact: ${data.environmentalImpact.cloudLoss}` : ''}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Humidity</div>
                    <div class="metric-value">${data.environmental.humidity}%</div>
                    <div class="metric-sub">Ambient conditions</div>
                </div>
        </div>
            </div>
            ${data.environmentalImpact ? `
            <div class="executive-summary" style="margin-top: 25px;">
                <h3 class="report-subsection">Environmental Impact on Generation</h3>
                <p><strong>Total Impact:</strong> ${data.environmentalImpact.totalImpact} reduction in generation</p>
                <p>This represents the combined effect of temperature, dust, and cloud cover on solar panel efficiency.</p>
            </div>
            ` : ''}
        </div>

        <!-- Equipment Health Assessment -->
        <div class="report-section">
            <h2 class="report-section-title">Equipment Health Assessment</h2>
            <div class="section-content">
                ${convertMarkdownToHTML(aiAnalysis.healthAssessment)}
            </div>
            <div class="equipment-grid">
                <div class="equipment-category">
                    <h4>Solar Panels</h4>
                    <p><strong>Total Units:</strong> ${data.equipment.breakdown.panels.length}</p>
                    <p><strong>Average Health:</strong> <span class="${data.equipment.metrics.avgPanelHealth >= 90 ? 'health-good' : data.equipment.metrics.avgPanelHealth >= 80 ? 'health-warning' : 'health-critical'}">${data.equipment.metrics.avgPanelHealth.toFixed(1)}%</span></p>
                    <p><strong>Units with Issues:</strong> ${data.equipment.breakdown.panels.filter(p => p.issues.length > 0).length}</p>
                </div>
                <div class="equipment-category">
                    <h4>Inverters</h4>
                    <p><strong>Total Units:</strong> ${data.equipment.breakdown.inverters.length}</p>
                    <p><strong>Average Health:</strong> <span class="${data.equipment.metrics.avgInverterHealth >= 90 ? 'health-good' : data.equipment.metrics.avgInverterHealth >= 80 ? 'health-warning' : 'health-critical'}">${data.equipment.metrics.avgInverterHealth.toFixed(1)}%</span></p>
                    <p><strong>Units with Issues:</strong> ${data.equipment.breakdown.inverters.filter(i => i.issues.length > 0).length}</p>
                </div>
                <div class="equipment-category">
                    <h4>Batteries</h4>
                    <p><strong>Total Units:</strong> ${data.equipment.breakdown.batteries.length}</p>
                    <p><strong>Average Health:</strong> ${data.equipment.breakdown.batteries.length > 0 ? 
                        `<span class="health-good">${(data.equipment.breakdown.batteries.reduce((sum, b) => sum + b.health, 0) / data.equipment.breakdown.batteries.length).toFixed(1)}%</span>` : 'N/A'}</p>
                    <p><strong>Status:</strong> ${data.equipment.breakdown.batteries.length > 0 ? 'Operational' : 'N/A'}</p>
                </div>
                <div class="equipment-category">
                    <h4>Transformers</h4>
                    <p><strong>Total Units:</strong> ${data.equipment.breakdown.transformers.length}</p>
                    <p><strong>Average Health:</strong> ${data.equipment.breakdown.transformers.length > 0 ? 
                        `<span class="health-good">${(data.equipment.breakdown.transformers.reduce((sum, t) => sum + t.health, 0) / data.equipment.breakdown.transformers.length).toFixed(1)}%</span>` : 'N/A'}</p>
                    <p><strong>Status:</strong> ${data.equipment.breakdown.transformers.length > 0 ? 'Operational' : 'N/A'}</p>
                </div>
        </div>
    </div>

        <!-- Efficiency Analysis -->
        <div class="report-section">
            <h2 class="report-section-title">Efficiency Analysis</h2>
            <div class="section-content">
                ${convertMarkdownToHTML(aiAnalysis.efficiencyAnalysis)}
            </div>
        </div>

        <!-- Risk Assessment -->
        <div class="report-section">
            <h2 class="report-section-title">Risk Assessment</h2>
            <div class="section-content">
                ${convertMarkdownToHTML(aiAnalysis.riskAssessment)}
            </div>
        </div>

        <!-- Operational Insights -->
        <div class="report-section">
            <h2 class="report-section-title">Operational Insights</h2>
            ${data.operationalInsights.length > 0 ? 
                `<div class="risk-grid">
                    ${data.operationalInsights.map(insight => `
                        <div class="risk-card risk-${insight.severity === 'critical' ? 'critical' : insight.severity === 'warning' ? 'high' : 'medium'}">
                            <strong>${insight.type.toUpperCase()}:</strong> ${insight.message}
                        </div>
                    `).join('')}
                </div>` : 
                '<p>No operational concerns detected at this time.</p>'
            }
        </div>

        <!-- Recommendations -->
        <div class="report-section">
            <h2 class="report-section-title">Recommendations</h2>
            <div class="section-content">
                ${Array.isArray(aiAnalysis.recommendations) ? 
                    `<ul class="report-list">
                        ${aiAnalysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>` : 
                    convertMarkdownToHTML(aiAnalysis.recommendations)
                }
            </div>
        </div>

        <!-- Maintenance Plan -->
        <div class="report-section">
            <h2 class="report-section-title">Maintenance Plan</h2>
            <div class="section-content">
                ${convertMarkdownToHTML(aiAnalysis.maintenancePlan)}
            </div>
        </div>

        <!-- Active Anomalies -->
        <div class="report-section">
            <h2 class="report-section-title">Active Anomalies</h2>
            ${data.anomalies.active > 0 ? `
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Anomaly</th>
                        <th>Location</th>
                        <th>Duration</th>
                        <th>Impact</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                ${data.anomalies.details
                    .filter(a => a.status === 'active')
                    .map(a => {
                        const duration = Math.floor((data.timestamp - new Date(a.timestamp)) / 60000);
                        return `
                        <tr>
                            <td>${a.name}</td>
                            <td>${a.location}</td>
                            <td>${duration} minutes</td>
                            <td>${a.impact}</td>
                            <td><span class="health-indicator health-warning">Active</span></td>
                        </tr>
                        `;
                    }).join('')}
            </tbody>
            </table>
            ` : '<p>No active anomalies detected.</p>'}
        </div>

        <!-- Recent Event Summary -->
        <div class="report-section">
            <h2 class="report-section-title">Recent Event Summary</h2>
            <h3 class="report-subsection">Last 50 Log Entries Analysis</h3>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Critical Events</div>
                    <div class="metric-value status-critical">${data.logAnalysis.criticalEvents.length}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Warnings</div>
                    <div class="metric-value status-warning">${data.logAnalysis.warnings.length}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Anomaly Events</div>
                    <div class="metric-value">${data.logAnalysis.anomalies.length}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">System Events</div>
                    <div class="metric-value">${data.logAnalysis.systemEvents.length}</div>
                </div>
            </div>
        
            <h3 class="report-subsection">Recent Critical Events</h3>
            <div class="recent-events-container">
                ${data.logs
                    .filter(l => l.type === 'alert-critical' || l.type === 'anomaly')
                    .slice(-10)
                    .map(log => {
                        const severity = log.type === 'alert-critical' ? 'critical' : 'high';
                        return `
                        <div class="risk-card risk-${severity}" style="margin-bottom: 10px;">
                            <strong>${new Date(log.timestamp).toLocaleTimeString()}</strong> - ${log.message}
                        </div>
                        `;
                    }).join('') || '<p>No critical events in recent history.</p>'}
            </div>
        </div>

        <!-- Performance Predictions -->
        <div class="report-section">
            <h2 class="report-section-title">Performance Predictions</h2>
            <div class="section-content">
                ${Array.isArray(aiAnalysis.predictions) && aiAnalysis.predictions.length > 0 ? 
                    `<ul class="report-list">
                        ${aiAnalysis.predictions.map(pred => `<li>${pred}</li>`).join('')}
                    </ul>` : 
                    convertMarkdownToHTML(aiAnalysis.performancepredictions || 'Generation expected to maintain current efficiency levels. Monitor environmental conditions for optimal performance.')
                }
            </div>
        </div>

        <!-- Footer -->
        <div class="report-section report-footer">
            <p><small>This report was generated using AI analysis of plant operational data.<br>
            For critical decisions, please verify with manual inspection and additional data sources.</small></p>
            <p><small>Powered by Solar Monitor AI Assistant • Report Version 2.0</small></p>
        </div>
    </div>
</body>
</html>
    `;
    
    return html;
}

function closeReportModal() {
    const modal = document.getElementById('report-modal');
    modal.style.display = 'none';
    
    // Clean up iframe
    const iframe = document.getElementById('report-iframe');
    if (iframe.src && iframe.src.startsWith('blob:')) {
        URL.revokeObjectURL(iframe.src);
    }
    iframe.src = '';
}

function downloadHTMLReport() {
    if (!currentReportHTML) {
        addAlert('No report available to download', 'warning');
        return;
    }
    
    const blob = new Blob([currentReportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solar_plant_ai_report_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
    
    addAlert('AI Report downloaded successfully', 'info');
    log('AI Report downloaded', 'system');
}

// Theme Management Functions
function initializeTheme() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('solarMonitorTheme');
    
    if (savedTheme) {
        // Use saved theme
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = prefersDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('solarMonitorTheme', theme);
    }
    
    // Update theme toggle button state
    updateThemeToggle();
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // Apply theme
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('solarMonitorTheme', newTheme);
    
    // Update toggle button
    updateThemeToggle();
    
    // Log theme change
    addAlert(`Switched to ${newTheme} theme`, 'info');
    log(`Theme changed to ${newTheme}`, 'system');
}

function updateThemeToggle() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const themeToggle = document.getElementById('theme-toggle');
    
    if (themeToggle) {
        themeToggle.innerHTML = currentTheme === 'dark' ? '☀️' : '🌙';
        themeToggle.title = `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} theme`;
    }
}

// Check for system theme preference changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // Only update if user hasn't manually set a theme
    if (!localStorage.getItem('solarMonitorTheme')) {
        const theme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        updateThemeToggle();
    }
});