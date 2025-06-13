// server.js
const express = require('express');
const axios = require('axios');
const { ultraAIPredict } = require('./predictionLogic.js');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory cache to store state between predictions.
// For production, consider a more persistent solution like Redis.
let sharedPredictionState = {
    // This object will be updated by the prediction logic after each call.
};

/**
 * Gets the current date as a 'YYYYMMDD' string in the IST timezone.
 * @returns {string} The formatted date string.
 */
function getISTDateString() {
    // Current time in UTC, then add 5.5 hours for IST
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
}

/**
 * Calculates the next period number based on the last one.
 * Handles the daily rollover of the period counter.
 * @param {string} lastPeriod - The most recent period number (e.g., "202406121440").
 * @returns {string|null} The next period number, or null if the format is invalid.
 */
function calculateNextPeriodNumber(lastPeriod) {
    if (!lastPeriod || typeof lastPeriod !== 'string' || lastPeriod.length < 9) {
        console.error("Invalid lastPeriod format:", lastPeriod);
        return null;
    }
    
    const todayStr = getISTDateString();
    const lastPeriodDateStr = lastPeriod.substring(0, 8);
    const counterStr = lastPeriod.substring(8);
    const counterLen = counterStr.length;
    const lastPeriodCounter = parseInt(counterStr, 10);

    if (isNaN(lastPeriodCounter)) {
         console.error("Could not parse counter from period:", lastPeriod);
        return null;
    }
    
    // If the date part of the last period is today's date, just increment the counter.
    if (lastPeriodDateStr === todayStr) {
        const nextCounter = String(lastPeriodCounter + 1).padStart(counterLen, '0');
        return `${todayStr}${nextCounter}`;
    } else {
        // Otherwise, it's a new day, so reset the counter to 1.
        const startCounter = '1'.padStart(counterLen, '0');
        return `${todayStr}${startCounter}`;
    }
}


/**
 * Fetches the latest game results from the external API.
 */
async function fetchGameHistory() {
    try {
        // WARNING: The 'random' and 'signature' values are hardcoded based on your example.
        // These will likely expire or need to be generated dynamically. You MUST figure out
        // the correct algorithm to generate these values for the API to work long-term.
        const requestBody = {
            pageSize: 10, // MODIFIED: Page size is now 10 as requested.
            pageNo: 1,
            typeId: 1,
            language: 0,
            random: "4a0522c6ecd8410496260e686be2a57c",
            signature: "334B5E70A0C9B8918B0B15E517E2069C",
            timestamp: Math.floor(Date.now() / 1000)
        };

        const response = await axios.post("https://api.bdg88zf.com/api/webapi/GetNoaverageEmerdList", requestBody, {
            headers: { "Content-Type": "application/json" }
        });
        
        if (response.data && response.data.code === 200 && response.data.data?.list) {
            return response.data.data.list;
        } else {
            console.error("API Error:", response.data?.message || "Unknown API error");
            return null;
        }
    } catch (error) {
        console.error("Failed to fetch game history:", error.message);
        return null;
    }
}

/**
 * Transforms the raw API data into the format expected by the prediction logic.
 * @param {Array} rawHistory - The list of results from the external API.
 * @returns {Array} - The formatted history.
 */
function formatHistoryForPrediction(rawHistory) {
    if (!rawHistory || rawHistory.length === 0) return [];

    return rawHistory.map(item => {
        const number = parseInt(item.number, 10);
        return {
            period: item.issueNumber,
            actual: number, 
            actualNumber: number,
            status: "Win" 
        };
    });
}


// Define the /predict endpoint
app.get('/predict', async (req, res) => {
    console.log("Received prediction request...");

    const rawHistory = await fetchGameHistory();
    if (!rawHistory) {
        return res.status(500).json({ error: "Failed to fetch game history from the source API." });
    }
    
    const lastCompletedPeriod = rawHistory[0]?.issueNumber;
    if (!lastCompletedPeriod) {
        return res.status(500).json({ error: "Could not determine the last completed period from the API response." });
    }
    const nextPeriodNumber = calculateNextPeriodNumber(lastCompletedPeriod);

    const formattedHistory = formatHistoryForPrediction(rawHistory);
    
    // REMOVED: The check for history length > 52 has been removed.
    // The prediction logic will now handle insufficient data internally.

    try {
        const predictionResult = ultraAIPredict(formattedHistory, sharedPredictionState);

        sharedPredictionState = {
            longTermGlobalAccuracy: res.longTermGlobalAccuracy, 
            lastPredictedOutcome: predictionResult.lastPredictedOutcome,
            lastFinalConfidence: predictionResult.lastFinalConfidence,
            lastConfidenceLevel: predictionResult.lastConfidenceLevel,
            lastMacroRegime: predictionResult.lastMacroRegime,
            lastPredictionSignals: predictionResult.lastPredictionSignals,
            periodFull: new Date().getTime(),
        };
        
        const finalResponse = {
            predictionForPeriod: nextPeriodNumber,
            ...predictionResult
        };

        res.json(finalResponse);

    } catch (error) {
        console.error("Error during prediction:", error);
        res.status(500).json({ error: "An internal error occurred while generating the prediction." });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Prediction server is running on port ${PORT}`);
});
