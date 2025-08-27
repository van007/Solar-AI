// AI Assistant Module for Solar Monitor
// Connects to local LLM server at http://127.0.0.1:1234

class AIAssistant {
    constructor() {
        this.baseUrl = 'http://127.0.0.1:1234';
        this.conversationHistory = [];
        this.isConnected = false;
        this.autoAnalysisInterval = null;
        this.lastAutoAnalysis = null;
    }

    // Check if LLM server is available
    async checkConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/v1/models`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            this.isConnected = response.ok;
            return this.isConnected;
        } catch (error) {
            this.isConnected = false;
            return false;
        }
    }

    // Send message to LLM
    async sendMessage(prompt, systemPrompt = null, maxTokens = 150) {
        if (!await this.checkConnection()) {
            return { error: 'LLM server not available. Please ensure it is running on http://127.0.0.1:1234' };
        }

        const messages = [];
        
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        // Validate conversation history before using it
        this.validateConversationHistory();
        
        // Add conversation history
        messages.push(...this.conversationHistory);
        
        // Add current prompt
        messages.push({ role: 'user', content: prompt });

        try {
            const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: maxTokens
                })
            });

            if (!response.ok) {
                let errorMsg = `LLM server returned ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMsg += `: ${errorData.error.message || errorData.error}`;
                    }
                    console.error('LLM Error Response:', errorData);
                } catch (e) {
                    // If response isn't JSON, try to get text
                    try {
                        const errorText = await response.text();
                        if (errorText) {
                            errorMsg += `: ${errorText}`;
                        }
                    } catch (e2) {
                        // Ignore if we can't read the response
                    }
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            const assistantMessage = data.choices[0].message.content;

            // Update conversation history - always add both messages to maintain alternation
            this.conversationHistory.push({ role: 'user', content: prompt });
            this.conversationHistory.push({ role: 'assistant', content: assistantMessage });

            // Keep only last 25 messages for auto-analysis efficiency
            if (this.conversationHistory.length > 25) {
                this.conversationHistory = this.conversationHistory.slice(-25);
            }

            return { message: assistantMessage };
        } catch (error) {
            console.error('LLM Error:', error);
            return { error: `Failed to communicate with LLM: ${error.message}` };
        }
    }

    // Analyze logs for health status
    async analyzeLogs(logs, systemState) {
        const recentLogs = logs.slice(-25); // Last 25 entries for faster processing
        
        const logSummary = this.summarizeLogs(recentLogs);
        const systemSummary = this.summarizeSystemState(systemState);
        
        const prompt = `Analyze solar plant status (be very concise, max 150 words):

System: ${systemSummary}
Logs: ${logSummary}

EQUIPMENT STATUS DEFINITIONS:
- Healthy: Normal operation
- Degraded: Reduced performance (dust, needs cleaning) - NOT a failure
- Faulty: Actual equipment failure requiring repair

ANOMALY TYPES:
- Equipment: Panel faults, inverter issues (critical)
- Maintenance: Dust accumulation (routine cleaning needed)
- Environmental: Weather effects (temporary)

IMPORTANT: 
- "Degraded" equipment just needs cleaning, NOT failing
- Low generation in evening/night is NORMAL
- Compare actual vs EXPECTED generation (which includes environmental impacts)
- Performance >95% of expected = Excellent, 80-95% = Normal, <80% = Investigate
- If system shows "Operating conditions optimal", performance is acceptable regardless of percentage
- Environmental impact is already factored into expected generation
- If logs show "SYSTEM NORMAL" or no active anomalies, Health = Normal
- Past/resolved anomalies should NOT affect current health status

Provide only:
1. Health: Normal/Warning/Critical (use "Normal" when system is operating normally)
2. Main issue (if any - distinguish maintenance from failures)
3. Action needed (1 line - prioritize critical over routine)`;

        const systemPrompt = `You are a solar plant AI assistant. Key understanding:
1. Equipment with "degraded" status has dust accumulation and needs cleaning - it is NOT failing or broken
2. Only "faulty" status indicates actual equipment failure
3. Maintenance anomalies (dust) are routine - not critical
4. Environmental anomalies are temporary weather effects
5. Solar generation naturally varies with time - zero at night, low in morning/evening
6. Expected generation already includes environmental impacts (temperature, dust, clouds)
7. Performance ratio compares actual vs expected - not vs theoretical ideal
8. Performance thresholds: >95% = Excellent, 80-95% = Normal, <80% = Investigate
9. Focus on actual failures and performance below 80% of expected
10. When logs show "SYSTEM NORMAL" it means the plant is operating optimally - report Health as "Normal"
11. Do not consider past/resolved anomalies when determining current health status
12. "Operating conditions optimal" means the system is performing as expected for current conditions
13. Performance ratios 80-85% can be normal with high environmental impacts
14. Only flag as critical if performance is unexpectedly low compared to conditions`;

        return await this.sendMessage(prompt, systemPrompt);
    }

    // Summarize logs for analysis
    summarizeLogs(logs) {
        // Find the most recent "System operating normally" message
        let relevantLogs = logs;
        const normalOperationIndex = logs.map((l, i) => 
            (l.message.includes('System operating normally') || 
             l.message.includes('Operating conditions optimal')) ? i : -1
        ).filter(i => i >= 0).pop();
        
        if (normalOperationIndex !== undefined) {
            // Only consider logs after the last "System operating normally" message
            relevantLogs = logs.slice(normalOperationIndex);
        }
        
        const criticalCount = relevantLogs.filter(l => l.type === 'alert-critical' || l.type === 'critical').length;
        
        // Count only new anomaly generation messages, excluding escalations and degradation messages
        const anomalyCount = relevantLogs.filter(l => {
            const msg = l.message.toLowerCase();
            return (l.type === 'anomaly' && l.message.includes('generated')) &&
                   !msg.includes('escalation') &&
                   !msg.includes('system performance degraded') &&
                   !msg.includes('resolved') &&
                   !msg.includes('corrected');
        }).length;
        
        // Check for normal operation in relevant logs
        const hasNormalOperation = relevantLogs.some(l => 
            l.message.includes('System operating normally') || 
            l.message.includes('Operating conditions optimal')
        );
        
        let summary = `${relevantLogs.length} logs, ${criticalCount} critical`;
        
        if (hasNormalOperation) {
            summary += ', SYSTEM NORMAL';
        } else if (anomalyCount > 0) {
            summary += `, ${anomalyCount} active anomalies`;
        } else {
            summary += ', no active issues';
        }
        
        return summary;
    }

    // Summarize system state
    summarizeSystemState(state) {
        // Equipment status breakdown
        const equipment = Object.values(state.equipmentHealth);
        const statusCounts = {
            healthy: equipment.filter(e => e.status === 'healthy').length,
            degraded: equipment.filter(e => e.status === 'degraded').length,
            faulty: equipment.filter(e => e.status === 'faulty').length,
            total: equipment.length
        };
        
        // Anomaly breakdown by type
        const activeAnomalies = state.anomalies.filter(a => a.status === 'active');
        const anomalyTypes = {
            equipment: activeAnomalies.filter(a => ['panel-fault', 'inverter-overload'].includes(a.type)).length,
            maintenance: activeAnomalies.filter(a => a.type === 'dust-accumulation').length,
            environmental: activeAnomalies.filter(a => ['dust-storm', 'cloud-cover'].includes(a.type)).length
        };
        
        // Calculate ideal generation for current time
        const currentTime = state.simulationTime || state.currentTime;
        const hour = currentTime.getHours();
        const minute = currentTime.getMinutes();
        const hourDecimal = hour + minute / 60;
        
        let idealGeneration = 0;
        if (hourDecimal >= 6 && hourDecimal <= 18) {
            const solarAngle = ((hourDecimal - 6) / 12) * Math.PI;
            idealGeneration = state.capacity * Math.sin(solarAngle);
        }
        
        // Calculate expected generation with environmental factors
        let expectedGeneration = idealGeneration;
        if (idealGeneration > 0) {
            // Apply environmental factors (matching calculateSolarGeneration logic)
            const env = state.environmentalFactors;
            
            // Temperature impact: 0.4% loss per degree above 25°C
            const tempFactor = 1 - Math.max(0, (env.temperature - 25) * 0.004);
            
            // Dust impact: up to 30% loss
            const dustFactor = 1 - (env.dustLevel / 100) * 0.3;
            
            // Cloud impact: up to 50% loss
            const cloudFactor = 1 - (env.cloudCover / 100) * 0.5;
            
            expectedGeneration = idealGeneration * tempFactor * dustFactor * cloudFactor;
        }
        
        // Calculate performance ratio against expected (not ideal)
        const performanceRatio = expectedGeneration > 0 ? 
            ((state.currentGeneration / expectedGeneration) * 100).toFixed(1) : 'N/A';
        
        // Calculate environmental impact percentage
        const envImpactPercent = idealGeneration > 0 ? 
            (((idealGeneration - expectedGeneration) / idealGeneration) * 100).toFixed(1) : '0';
        
        // Environmental conditions
        const env = state.environmentalFactors;
        const envConditions = `Temp:${env.temperature}°C, Dust:${env.dustLevel}%, Cloud:${env.cloudCover}%`;
        
        // Build comprehensive summary
        let summary = `Time:${currentTime.toLocaleTimeString()}, Gen:${state.currentGeneration.toFixed(1)}MW/Expected:${expectedGeneration.toFixed(1)}MW (${performanceRatio}%), ${envConditions}, EnvImpact:-${envImpactPercent}%`;
        
        // Add equipment status details
        summary += `, Equipment[Healthy:${statusCounts.healthy}, Degraded:${statusCounts.degraded}, Faulty:${statusCounts.faulty}]`;
        
        // Add anomaly details
        if (activeAnomalies.length > 0) {
            summary += `, Anomalies[Equipment:${anomalyTypes.equipment}, Maintenance:${anomalyTypes.maintenance}, Environmental:${anomalyTypes.environmental}]`;
        } else {
            summary += ', No active anomalies';
        }
        
        return summary;
    }

    // Quick action: Analyze recent events
    async analyzeRecentEvents(logs) {
        const recentLogs = logs.slice(-25);
        const eventSummary = this.summarizeLogs(recentLogs);
        
        const prompt = `Recent solar plant events: ${eventSummary}. Identify main pattern or issue in 50 words max.`;

        return await this.sendMessage(prompt);
    }

    // Quick action: Predict maintenance needs
    async predictMaintenance(systemState) {
        const degraded = Object.entries(systemState.equipmentHealth)
            .filter(([_, data]) => data.status === 'degraded')
            .map(([id, data]) => `${id} (${data.issues ? data.issues.join(', ') : 'degraded'})`);
        
        const faulty = Object.entries(systemState.equipmentHealth)
            .filter(([_, data]) => data.status === 'faulty')
            .map(([id, data]) => `${id} (${data.issues ? data.issues.join(', ') : 'fault'})`);

        const prompt = `Equipment status - Faulty (needs repair): ${faulty.join(', ') || 'None'}. Degraded (needs cleaning): ${degraded.join(', ') || 'None'}. Prioritize critical repairs over routine cleaning. Give top maintenance action in 50 words.`;

        const systemPrompt = `Distinguish between equipment failures (faulty status) that need immediate repair and degraded equipment that just needs cleaning. Dust accumulation is routine maintenance, not a failure.`;

        return await this.sendMessage(prompt, systemPrompt);
    }

    // Quick action: Optimize performance
    async optimizePerformance(systemState) {
        const efficiency = ((systemState.currentGeneration / systemState.capacity) * 100).toFixed(0);
        const env = systemState.environmentalFactors;
        
        const prompt = `Solar at ${efficiency}% efficiency. Dust:${env.dustLevel}%, Temp:${env.temperature}°C. Give ONE actionable optimization in 50 words.`;

        return await this.sendMessage(prompt);
    }

    // Start auto-analysis
    startAutoAnalysis(callback, intervalMs = 180000) {
        if (this.autoAnalysisInterval) {
            clearInterval(this.autoAnalysisInterval);
        }

        // Run immediately
        callback();
        this.lastAutoAnalysis = new Date();

        // Then run at specified interval
        this.autoAnalysisInterval = setInterval(() => {
            callback();
            this.lastAutoAnalysis = new Date();
        }, intervalMs);
    }

    // Stop auto-analysis
    stopAutoAnalysis() {
        if (this.autoAnalysisInterval) {
            clearInterval(this.autoAnalysisInterval);
            this.autoAnalysisInterval = null;
        }
    }

    // Clear conversation history
    clearHistory() {
        this.conversationHistory = [];
    }
    
    // Validate and fix conversation history alternation
    validateConversationHistory() {
        if (this.conversationHistory.length === 0) return;
        
        const fixed = [];
        let expectedRole = 'user';
        
        for (const msg of this.conversationHistory) {
            if (msg.role === expectedRole) {
                fixed.push(msg);
                expectedRole = expectedRole === 'user' ? 'assistant' : 'user';
            } else if (msg.role === 'user' && expectedRole === 'assistant') {
                // Missing assistant response, add placeholder
                fixed.push({ role: 'assistant', content: 'I understand.' });
                fixed.push(msg);
                expectedRole = 'assistant';
            } else if (msg.role === 'assistant' && expectedRole === 'user') {
                // Missing user message, skip this assistant message
                console.warn('Skipping orphaned assistant message in history');
            }
        }
        
        // Ensure history ends with assistant message
        if (fixed.length > 0 && fixed[fixed.length - 1].role === 'user') {
            fixed.push({ role: 'assistant', content: 'I understand. Please continue.' });
        }
        
        this.conversationHistory = fixed;
    }
}

// Export for use in main script
const aiAssistant = new AIAssistant();