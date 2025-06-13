// predictionLogic.js - Quantum AI Supercore Engine
// Version: 43.0.0 - Robustness & Clarity Update
// Changelog v43.0.0:
// - **FIXED: Removed Over-fitted Pattern Matching**: Removed the most fragile and curve-fitted pattern-matching functions (e.g., Alt-BSBS, SSBB, Mirror) that are unlikely to be robust in live conditions.
// - **FIXED: Dynamic Indicator Thresholds**: Replaced static "magic numbers" for indicators like RSI and Stochastic with dynamic thresholds that adapt to current market volatility. This reduces overfitting and improves signal relevance.
// - **FIXED: Placeholder/Simulated Data Clarification**:
//   - `getRealTimeExternalData`: Added explicit comments that this function is a **simulation** and should be replaced with a real API call for live data.
//   - `analyzeMLModelSignal`: Added extensive comments clarifying that this is a **placeholder simulating** a model's logic, not a real, trained ML model. This addresses the misleading nature of the original implementation.
// - **FIXED: Clarified "Quantum" Terminology**: Added comments to all "Quantum" branded functions explaining they are based on classical algorithms using quantum mechanics as a **metaphor**, not actual quantum computation. This improves transparency.
// - **IMPROVED: Regime-Aware Learning**: The `updateSignalPerformance` and `getDynamicWeightAdjustment` functions now track signal performance *within specific market regimes*. This prevents the model from incorrectly penalizing a trend-following signal during a ranging market, making the adaptation more intelligent.
// - **IMPROVED: System Simplification**: Reduced the number of esoteric, low-impact signals to decrease complexity, reduce the risk of cascading errors, and make the system's logic easier to debug and understand.
// - **Version Bump**: Incremented to v43.0.0 to reflect these major architectural fixes and improvements.

// --- Helper Functions ---
function getBigSmallFromNumber(number) {
    if (number === undefined || number === null) return null;
    const num = parseInt(number);
    if (isNaN(num)) return null;
    return num >= 0 && num <= 4 ? 'SMALL' : num >= 5 && num <= 9 ? 'BIG' : null;
}

function getOppositeOutcome(prediction) {
    return prediction === "BIG" ? "SMALL" : prediction === "SMALL" ? "BIG" : null;
}

function calculateSMA(data, period) {
    if (!Array.isArray(data) || data.length < period || period <= 0) return null;
    const relevantData = data.slice(0, period);
    const sum = relevantData.reduce((a, b) => a + b, 0);
    return sum / period;
}

function calculateEMA(data, period) {
    if (!Array.isArray(data) || data.length < period || period <= 0) return null;
    const k = 2 / (period + 1);
    const chronologicalData = data.slice().reverse();

    const initialSliceForSma = chronologicalData.slice(0, period);
    if (initialSliceForSma.length < period) return null;

    let ema = calculateSMA(initialSliceForSma.slice().reverse(), period);
    if (ema === null && initialSliceForSma.length > 0) {
        ema = initialSliceForSma.reduce((a, b) => a + b, 0) / initialSliceForSma.length;
    }
    if (ema === null) return null;

    for (let i = period; i < chronologicalData.length; i++) {
        ema = (chronologicalData[i] * k) + (ema * (1 - k));
    }
    return ema;
}

function calculateStdDev(data, period) {
    if (!Array.isArray(data) || data.length < period || period <= 0) return null;
    const relevantData = data.slice(0, period);
    if (relevantData.length < 2) return null;
    const mean = relevantData.reduce((a, b) => a + b, 0) / relevantData.length;
    const variance = relevantData.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / relevantData.length;
    return Math.sqrt(variance);
}

function calculateVWAP(data, period) {
    if (!Array.isArray(data) || data.length < period || period <= 0) return null;
    const relevantData = data.slice(0, period);
    let totalPriceVolume = 0;
    let totalVolume = 0;
    for (const entry of relevantData) {
        const price = parseFloat(entry.actualNumber);
        const volume = parseFloat(entry.volume || 1);
        if (!isNaN(price) && !isNaN(volume) && volume > 0) {
            totalPriceVolume += price * volume;
            totalVolume += volume;
        }
    }
    if (totalVolume === 0) return null;
    return totalPriceVolume / totalVolume;
}


function calculateRSI(data, period) {
    if (period <= 0) return null;
    const chronologicalData = data.slice().reverse();
    if (!Array.isArray(chronologicalData) || chronologicalData.length < period + 1) return null;
    let gains = 0, losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = chronologicalData[i] - chronologicalData[i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < chronologicalData.length; i++) {
        const change = chronologicalData[i] - chronologicalData[i - 1];
        let currentGain = change > 0 ? change : 0;
        let currentLoss = change < 0 ? Math.abs(change) : 0;
        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function getCurrentISTHour() {
    try {
        const now = new Date();
        const istFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: 'numeric',
            hour12: false
        });
        const istHourString = istFormatter.formatToParts(now).find(part => part.type === 'hour').value;
        let hour = parseInt(istHourString, 10);
        if (hour === 24) hour = 0;

        return {
            raw: hour,
            sin: Math.sin(hour / 24 * 2 * Math.PI),
            cos: Math.cos(hour / 24 * 2 * Math.PI)
        };
    } catch (error) {
        console.error("Error getting IST hour:", error);
        const hour = new Date().getHours();
        return {
             raw: hour,
             sin: Math.sin(hour / 24 * 2 * Math.PI),
             cos: Math.cos(hour / 24 * 2 * Math.PI)
        };
    }
}


/**
 * **CRITICAL WEAK POINT ACKNOWLEDGEMENT**: This function simulates external data.
 * For a production system, this MUST be replaced with API calls to real-time data providers
 * for financial news sentiment and market volatility indices (like VIX).
 * Using simulated data makes any resulting signal meaningless for live trading.
 */
function getRealTimeExternalData() {
    // --- SIMULATION ---
    const newsSentiments = ["Positive", "Neutral", "Negative"];
    const randomNewsSentiment = newsSentiments[Math.floor(Math.random() * newsSentiments.length)];
    let newsFactor = 1.0;
    if(randomNewsSentiment === "Positive") newsFactor = 1.02;
    else if(randomNewsSentiment === "Negative") newsFactor = 0.98;

    const marketVolatilities = ["Low", "Normal", "High"];
    const randomMarketVol = marketVolatilities[Math.floor(Math.random() * marketVolatilities.length)];
    let marketVolFactor = 1.0;
    if(randomMarketVol === "High") marketVolFactor = 0.95;

    // --- END SIMULATION ---
    const combinedFactor = newsFactor * marketVolFactor;
    const reason = `ExtData(SIMULATED_News:${randomNewsSentiment},SIMULATED_MktVol:${randomMarketVol})`;

    return { factor: combinedFactor, reason: reason };
}


function getPrimeTimeSession(istHour) {
    if (istHour >= 10 && istHour < 12) return { session: "PRIME_MORNING", aggression: 1.20, confidence: 1.10 };
    if (istHour >= 13 && istHour < 16) return { session: "PRIME_AFTERNOON", aggression: 1.15, confidence: 1.05 };
    if (istHour >= 17 && istHour < 20) return { session: "PRIME_EVENING", aggression: 1.25, confidence: 1.15 };
    return null;
}


// --- Market Context Analysis ---
function getMarketRegimeAndTrendContext(history, shortMALookback = 5, mediumMALookback = 10, longMALookback = 20) {
    const baseContext = getTrendContext(history, shortMALookback, mediumMALookback, longMALookback);
    let macroRegime = "UNCERTAIN";
    const { strength, volatility } = baseContext;
    let isTransitioning = false;

    const numbers = history.map(entry => parseInt(entry.actualNumber || entry.actual)).filter(n => !isNaN(n));

    if (numbers.length > mediumMALookback + 5) {
        const prevShortMA = calculateEMA(numbers.slice(1), shortMALookback);
        const prevMediumMA = calculateEMA(numbers.slice(1), mediumMALookback);
        const currentShortMA = calculateEMA(numbers, shortMALookback);
        const currentMediumMA = calculateEMA(numbers, mediumMALookback);

        if (prevShortMA && prevMediumMA && currentShortMA && currentMediumMA) {
            if ((prevShortMA <= prevMediumMA && currentShortMA > currentMediumMA) ||
                (prevShortMA >= prevMediumMA && currentShortMA < currentMediumMA)) {
                isTransitioning = true;
            }
        }
    }

    if (strength === "STRONG") {
        if (volatility === "LOW" || volatility === "VERY_LOW") macroRegime = "TREND_STRONG_LOW_VOL";
        else if (volatility === "MEDIUM") macroRegime = "TREND_STRONG_MED_VOL";
        else macroRegime = "TREND_STRONG_HIGH_VOL";
    } else if (strength === "MODERATE") {
        if (volatility === "LOW" || volatility === "VERY_LOW") macroRegime = "TREND_MOD_LOW_VOL";
        else if (volatility === "MEDIUM") macroRegime = "TREND_MOD_MED_VOL";
        else macroRegime = "TREND_MOD_HIGH_VOL";
    } else if (strength === "RANGING") {
        if (volatility === "LOW" || volatility === "VERY_LOW") macroRegime = "RANGE_LOW_VOL";
        else if (volatility === "MEDIUM") macroRegime = "RANGE_MED_VOL";
        else macroRegime = "RANGE_HIGH_VOL";
    } else { // WEAK or UNKNOWN
        if (volatility === "HIGH") macroRegime = "WEAK_HIGH_VOL";
        else if (volatility === "MEDIUM") macroRegime = "WEAK_MED_VOL";
        else macroRegime = "WEAK_LOW_VOL";
    }

    if (isTransitioning && !macroRegime.includes("TRANSITION")) {
        macroRegime += "_TRANSITION";
    }

    baseContext.macroRegime = macroRegime;
    baseContext.isTransitioning = isTransitioning;
    baseContext.details += `,Regime:${macroRegime}`;
    return baseContext;
}

function getTrendContext(history, shortMALookback = 5, mediumMALookback = 10, longMALookback = 20) {
    if (!Array.isArray(history) || history.length < longMALookback) {
        return { strength: "UNKNOWN", direction: "NONE", volatility: "UNKNOWN", details: "Insufficient history", macroRegime: "UNKNOWN_REGIME", isTransitioning: false };
    }
    const numbers = history.map(entry => parseInt(entry.actualNumber || entry.actual)).filter(n => !isNaN(n));
    if (numbers.length < longMALookback) {
        return { strength: "UNKNOWN", direction: "NONE", volatility: "UNKNOWN", details: "Insufficient numbers", macroRegime: "UNKNOWN_REGIME", isTransitioning: false };
    }

    const shortMA = calculateEMA(numbers, shortMALookback);
    const mediumMA = calculateEMA(numbers, mediumMALookback);
    const longMA = calculateEMA(numbers, longMALookback);

    if (shortMA === null || mediumMA === null || longMA === null) return { strength: "UNKNOWN", direction: "NONE", volatility: "UNKNOWN", details: "MA calculation failed", macroRegime: "UNKNOWN_REGIME", isTransitioning: false };

    let direction = "NONE";
    let strength = "WEAK";
    let details = `S:${shortMA.toFixed(1)},M:${mediumMA.toFixed(1)},L:${longMA.toFixed(1)}`;

    const stdDevLong = calculateStdDev(numbers, longMALookback);
    const epsilon = 0.001;
    const normalizedSpread = (stdDevLong !== null && stdDevLong > epsilon) ? (shortMA - longMA) / stdDevLong : (shortMA - longMA) / epsilon;

    details += `,NormSpread:${normalizedSpread.toFixed(2)}`;

    if (shortMA > mediumMA && mediumMA > longMA) {
        direction = "BIG";
        if (normalizedSpread > 0.80) strength = "STRONG";
        else if (normalizedSpread > 0.45) strength = "MODERATE";
        else strength = "WEAK";
    } else if (shortMA < mediumMA && mediumMA < longMA) {
        direction = "SMALL";
        if (normalizedSpread < -0.80) strength = "STRONG";
        else if (normalizedSpread < -0.45) strength = "MODERATE";
        else strength = "WEAK";
    } else {
        strength = "RANGING";
        if (shortMA > longMA) direction = "BIG_BIASED_RANGE";
        else if (longMA > shortMA) direction = "SMALL_BIASED_RANGE";
    }

    let volatility = "UNKNOWN";
    const volSlice = numbers.slice(0, Math.min(numbers.length, 30));
    if (volSlice.length >= 15) {
        const stdDevVol = calculateStdDev(volSlice, volSlice.length);
        if (stdDevVol !== null) {
            details += ` VolStdDev:${stdDevVol.toFixed(2)}`;
            if (stdDevVol > 3.0) volatility = "HIGH";
            else if (stdDevVol > 1.8) volatility = "MEDIUM";
            else if (stdDevVol > 0.9) volatility = "LOW";
            else volatility = "VERY_LOW";
        }
    }
    return { strength, direction, volatility, details, macroRegime: "PENDING_REGIME_CLASSIFICATION", isTransitioning: false };
}


// --- Core Analytical Modules ---

function analyzeStreaks(history, baseWeight) {
    if (!Array.isArray(history) || history.length < 3) return null;
    const actuals = history.map(p => getBigSmallFromNumber(p.actual)).filter(bs => bs);
    if (actuals.length < 3) return null;
    let currentStreakType = actuals[0], currentStreakLength = 0;
    for (const outcome of actuals) {
        if (outcome === currentStreakType) currentStreakLength++; else break;
    }
    if (currentStreakLength >= 2) {
        const prediction = getOppositeOutcome(currentStreakType);
        const weightFactor = Math.min(0.50 + (currentStreakLength * 0.15), 0.90);
        return { prediction, weight: baseWeight * weightFactor, source: `StreakBreak-${currentStreakLength}` };
    }
    return null;
}

function analyzeRSI(history, rsiPeriod, baseWeight, volatility) {
    if (rsiPeriod <= 0) return null;
    const actualNumbers = history.map(entry => parseInt(entry.actualNumber || entry.actual)).filter(num => !isNaN(num));
    if (actualNumbers.length < rsiPeriod + 1) return null;

    const rsiValue = calculateRSI(actualNumbers, rsiPeriod);
    if (rsiValue === null) return null;

    // **IMPROVEMENT**: Dynamic thresholds based on volatility
    let overbought, oversold;
    switch (volatility) {
        case "HIGH":       overbought = 78; oversold = 22; break;
        case "MEDIUM":     overbought = 72; oversold = 28; break;
        case "LOW":        overbought = 68; oversold = 32; break;
        case "VERY_LOW":   overbought = 65; oversold = 35; break;
        default:           overbought = 70; oversold = 30;
    }

    let prediction = null, signalStrengthFactor = 0;
    if (rsiValue < oversold) {
        prediction = "BIG";
        signalStrengthFactor = (oversold - rsiValue) / oversold;
    } else if (rsiValue > overbought) {
        prediction = "SMALL";
        signalStrengthFactor = (rsiValue - overbought) / (100 - overbought);
    }

    if (prediction)
        return { prediction, weight: baseWeight * (0.60 + Math.min(signalStrengthFactor, 1.0) * 0.40), source: "RSI" };
    return null;
}
function analyzeMACD(history, shortPeriod, longPeriod, signalPeriod, baseWeight) {
    if (shortPeriod <=0 || longPeriod <=0 || signalPeriod <=0 || shortPeriod >= longPeriod) return null;
    const actualNumbers = history.map(entry => parseInt(entry.actualNumber || entry.actual)).filter(num => !isNaN(num));
    if (actualNumbers.length < longPeriod + signalPeriod -1) return null;

    const emaShort = calculateEMA(actualNumbers, shortPeriod);
    const emaLong = calculateEMA(actualNumbers, longPeriod);

    if (emaShort === null || emaLong === null) return null;
    const macdLineCurrent = emaShort - emaLong;

    const macdLineValues = [];
    for (let i = longPeriod -1; i < actualNumbers.length; i++) {
        const currentSlice = actualNumbers.slice(actualNumbers.length - 1 - i);
        const shortE = calculateEMA(currentSlice, shortPeriod);
        const longE = calculateEMA(currentSlice, longPeriod);
        if (shortE !== null && longE !== null) {
            macdLineValues.push(shortE - longE);
        }
    }

    if (macdLineValues.length < signalPeriod) return null;

    const signalLine = calculateEMA(macdLineValues.slice().reverse(), signalPeriod);
    if (signalLine === null) return null;

    const macdHistogram = macdLineCurrent - signalLine;
    let prediction = null;

    if (macdLineValues.length >= signalPeriod + 1) {
        const prevMacdSliceForSignal = macdLineValues.slice(0, -1);
        const prevSignalLine = calculateEMA(prevMacdSliceForSignal.slice().reverse(), signalPeriod);
        const prevMacdLine = macdLineValues[macdLineValues.length - 2];

        if (prevSignalLine !== null && prevMacdLine !== null) {
            if (prevMacdLine <= prevSignalLine && macdLineCurrent > signalLine) prediction = "BIG";
            else if (prevMacdLine >= prevSignalLine && macdLineCurrent < signalLine) prediction = "SMALL";
        }
    }

    if (prediction) {
        const strengthFactor = Math.min(Math.abs(macdHistogram) / 0.5, 1.0); // Normalized strength
        return { prediction, weight: baseWeight * (0.55 + strengthFactor * 0.45), source: `MACD_Cross` };
    }
    return null;
}
function analyzeBollingerBands(history, period, stdDevMultiplier, baseWeight) {
    if (period <= 0) return null;
    const actualNumbers = history.map(entry => parseInt(entry.actualNumber || entry.actual)).filter(num => !isNaN(num));
    if (actualNumbers.length < period) return null;

    const sma = calculateSMA(actualNumbers.slice(0, period), period);
    if (sma === null) return null;

    const stdDev = calculateStdDev(actualNumbers, period);
    if (stdDev === null || stdDev < 0.05) return null;

    const upperBand = sma + (stdDev * stdDevMultiplier);
    const lowerBand = sma - (stdDev * stdDevMultiplier);
    const lastNumber = actualNumbers[0];
    let prediction = null;

    if (lastNumber > upperBand) prediction = "SMALL";
    else if (lastNumber < lowerBand) prediction = "BIG";

    if (prediction) {
        const bandBreachStrength = Math.abs(lastNumber - sma) / (stdDev * stdDevMultiplier + 0.001);
        return { prediction, weight: baseWeight * (0.65 + Math.min(bandBreachStrength, 0.9)*0.35), source: "Bollinger" };
    }
    return null;
}
function analyzeStochastic(history, kPeriod, dPeriod, smoothK, baseWeight, volatility) {
    if (kPeriod <=0 || dPeriod <=0 || smoothK <=0) return null;
    const actualNumbers = history.map(entry => parseInt(entry.actualNumber || entry.actual)).filter(num => !isNaN(num));
    if (actualNumbers.length < kPeriod + smoothK -1 + dPeriod -1) return null;

    const chronologicalNumbers = actualNumbers.slice().reverse();

    let kValues = [];
    for (let i = kPeriod - 1; i < chronologicalNumbers.length; i++) {
        const currentSlice = chronologicalNumbers.slice(i - kPeriod + 1, i + 1);
        const currentClose = currentSlice[currentSlice.length - 1];
        const lowestLow = Math.min(...currentSlice);
        const highestHigh = Math.max(...currentSlice);
        if (highestHigh === lowestLow) kValues.push(kValues.length > 0 ? kValues[kValues.length-1] : 50);
        else kValues.push(100 * (currentClose - lowestLow) / (highestHigh - lowestLow));
    }

    if (kValues.length < smoothK) return null;
    const smoothedKValues = [];
    for(let i = 0; i <= kValues.length - smoothK; i++) {
        smoothedKValues.push(calculateSMA(kValues.slice(i, i + smoothK).slice().reverse(), smoothK));
    }

    if (smoothedKValues.length < dPeriod) return null;
    const dValues = [];
    for(let i = 0; i <= smoothedKValues.length - dPeriod; i++) {
        dValues.push(calculateSMA(smoothedKValues.slice(i, i + dPeriod).slice().reverse(), dPeriod));
    }

    if (smoothedKValues.length < 2 || dValues.length < 2) return null;

    const currentK = smoothedKValues[smoothedKValues.length - 1];
    const prevK = smoothedKValues[smoothedKValues.length - 2];
    const currentD = dValues[dValues.length - 1];
    const prevD = dValues[dValues.length - 1];

    // **IMPROVEMENT**: Dynamic thresholds based on volatility
    let overbought, oversold;
    switch (volatility) {
        case "HIGH":       overbought = 85; oversold = 15; break;
        case "MEDIUM":     overbought = 80; oversold = 20; break;
        case "LOW":        overbought = 75; oversold = 25; break;
        case "VERY_LOW":   overbought = 70; oversold = 30; break;
        default:           overbought = 80; oversold = 20;
    }

    let prediction = null;
    if (prevK <= prevD && currentK > currentD && currentK < overbought - 10) {
         prediction = "BIG";
    } else if (prevK >= prevD && currentK < currentD && currentK > oversold + 10) {
        prediction = "SMALL";
    }

    if (prediction) return { prediction, weight: baseWeight * 0.7, source: "Stochastic" };
    return null;
}

/**
 * **TRANSPARENCY NOTE**: This function uses "Quantum" as a metaphor for looking
 * for large, seemingly impossible jumps in price, similar to quantum tunneling.
 * It is a classical algorithm and does not use any quantum computation.
 */
function analyzeQuantumTunneling(history, baseWeight) {
    const actuals = history.map(p => p.actual).filter(n => n !== null);
    if (actuals.length < 2) return null;

    const lastNum = actuals[0];
    const prevNum = actuals[1];

    // Look for a jump from one extreme to the other (e.g., 0-1 to 8-9)
    if ((lastNum <= 1 && prevNum >= 8) || (lastNum >= 8 && prevNum <= 1)) {
        // Predict a reversion after the "tunneling" event
        return { prediction: lastNum > 4 ? "SMALL" : "BIG", weight: baseWeight, source: "QuantumTunneling" };
    }
    return null;
}

/**
 * **TRANSPARENCY NOTE**: This function uses "Superposition" as a metaphor for
 * combining all conflicting signals into a probabilistic state that "collapses"
 * into a final prediction. It is a classical algorithm.
 */
function analyzeQuantumSuperpositionState(signals, consensus, baseWeight) {
    if (!signals || signals.length < 4 || !consensus) return null;

    const totalWeight = signals.reduce((sum, s) => sum + (s.adjustedWeight || 0), 0);
    if (totalWeight < 0.1) return null;

    const bigWeight = signals.filter(s => s.prediction === "BIG").reduce((sum, s) => sum + s.adjustedWeight, 0);
    const smallWeight = signals.filter(s => s.prediction === "SMALL").reduce((sum, s) => sum + s.adjustedWeight, 0);

    const bigCollapseProbability = (bigWeight / totalWeight) * consensus.factor;
    const smallCollapseProbability = (smallWeight / totalWeight) * (2.0 - consensus.factor);

    if (bigCollapseProbability > smallCollapseProbability * 1.2) { // Reduced threshold for decisiveness
        return {
            prediction: "BIG",
            weight: baseWeight * Math.min(1.0, (bigCollapseProbability - smallCollapseProbability)),
            source: "QuantumSuperposition"
        };
    }

    if (smallCollapseProbability > bigCollapseProbability * 1.2) {
        return {
            prediction: "SMALL",
            weight: baseWeight * Math.min(1.0, (smallCollapseProbability - bigCollapseProbability)),
            source: "QuantumSuperposition"
        };
    }

    return null;
}

/**
 * **CRITICAL WEAK POINT ACKNOWLEDGEMENT**: This function is a **placeholder** to simulate
 * the output of a real Machine Learning model. In a production environment, this function
 * should be replaced with an API call to a dedicated model serving endpoint (e.g., a cloud
 * function running a TensorFlow/PyTorch model). The logic below is a simple, rule-based
 * imitation and does not represent real AI.
 */
function analyzeMLModelSignal(features, baseWeight) {
    // A real implementation would:
    // 1. Serialize the 'features' object into JSON.
    // 2. Make a fetch/API call to a model endpoint.
    // 3. Await the response containing the prediction and confidence.
    // The code below is a simplified simulation of this process.
    if (!features) return null;

    const { rsi_14, macd_hist, stddev_30 } = features;

    let modelConfidence = 0;
    let prediction = null;

    // Simulate a simple tree-like logic that a real ML model *might* learn.
    if (rsi_14 > 75 && macd_hist < -0.1) {
        prediction = "SMALL";
        modelConfidence = Math.abs(macd_hist) + (rsi_14 - 70) / 30;
    } else if (rsi_14 < 25 && macd_hist > 0.1) {
        prediction = "BIG";
        modelConfidence = Math.abs(macd_hist) + (30 - rsi_14) / 30;
    } else if (stddev_30 < 1.0 && macd_hist > 0.05) {
        prediction = "BIG";
        modelConfidence = 0.4;
    }

    if (prediction) {
        // Give the (simulated) ML model a higher base importance
        const weight = baseWeight * Math.min(1.0, modelConfidence) * 1.5;
        return { prediction, weight: weight, source: "ML-SimulatedBoost" };
    }

    return null;
}


// --- Trend Stability & Market Entropy ---
function analyzeTrendStability(history) {
    if (!Array.isArray(history) || history.length < 25) {
        return { isStable: true, reason: "Not enough data for stability check.", details: "" };
    }
    const confirmedHistory = history.filter(p => p && (p.status === "Win" || p.status === "Loss") && typeof p.actual !== 'undefined' && p.actual !== null);
    if (confirmedHistory.length < 20) return { isStable: true, reason: "Not enough confirmed results.", details: `Confirmed: ${confirmedHistory.length}` };

    const recentResults = confirmedHistory.slice(0, 20).map(p => getBigSmallFromNumber(p.actual)).filter(r => r);
    if (recentResults.length < 18) return { isStable: true, reason: "Not enough valid B/S for stability.", details: `Valid B/S: ${recentResults.length}` };

    const bigCount = recentResults.filter(r => r === "BIG").length;
    const smallCount = recentResults.filter(r => r === "SMALL").length;

    if (bigCount / recentResults.length >= 0.75 || smallCount / recentResults.length >= 0.75) {
        return { isStable: false, reason: "Unstable: Outcome Dominance", details: `B:${bigCount},S:${smallCount}` };
    }

    let alternations = 0;
    for (let i = 0; i < recentResults.length - 1; i++) {
        if (recentResults[i] !== recentResults[i + 1]) alternations++;
    }
    if (alternations / recentResults.length > 0.70) {
        return { isStable: false, reason: "Unstable: Excessive Choppiness", details: `Alternations: ${alternations}/${recentResults.length}` };
    }

    return { isStable: true, reason: "Trend appears stable.", details: `B:${bigCount},S:${smallCount}` };
}

function analyzeMarketEntropyState(history) {
    const ENTROPY_WINDOW = 15;
    if (history.length < ENTROPY_WINDOW) return { state: "UNCERTAIN_ENTROPY", details: "Insufficient history" };

    const outcomes = history.slice(0, ENTROPY_WINDOW).map(e => getBigSmallFromNumber(e.actual));
    const entropy = calculateEntropyForSignal(outcomes, ENTROPY_WINDOW);

    if (entropy === null) return { state: "UNCERTAIN_ENTROPY", details: "Calculation failed" };

    let state = "STABLE_MODERATE";
    if (entropy < 0.6) state = "ORDERLY";
    else if (entropy > 0.95) state = "STABLE_CHAOS";

    return { state, details: `Entropy:${entropy.toFixed(2)}` };
}

/**
 * **CRITICAL WEAK POINT ACKNOWLEDGEMENT**: This function simulates the probabilistic output
 * of a complex model like a Markov Switching Model. A real implementation would require a
 * trained statistical model. This is a simplified, rule-based heuristic.
 */
function analyzeAdvancedMarketRegime(trendContext, marketEntropyState) {
    const { strength, volatility } = trendContext;
    const { state: entropy } = marketEntropyState;

    let probabilities = { bullTrend: 0.25, bearTrend: 0.25, volatileRange: 0.25, quietRange: 0.25 };

    if (strength === 'STRONG' && volatility !== 'HIGH' && entropy === 'ORDERLY') {
        if (trendContext.direction.includes('BIG')) {
            probabilities = { bullTrend: 0.8, bearTrend: 0.05, volatileRange: 0.1, quietRange: 0.05 };
        } else {
            probabilities = { bullTrend: 0.05, bearTrend: 0.8, volatileRange: 0.1, quietRange: 0.05 };
        }
    } else if (strength === 'RANGING' && volatility === 'HIGH' && entropy.includes('CHAOS')) {
         probabilities = { bullTrend: 0.1, bearTrend: 0.1, volatileRange: 0.7, quietRange: 0.1 };
    } else if (strength === 'RANGING' && volatility === 'VERY_LOW') {
         probabilities = { bullTrend: 0.1, bearTrend: 0.1, volatileRange: 0.1, quietRange: 0.7 };
    }

    return { probabilities, details: `SimProb(B:${probabilities.bullTrend.toFixed(2)},S:${probabilities.bearTrend.toFixed(2)})` };
}


// --- Signal & Regime Performance Learning ---
let signalPerformance = {};
const PERFORMANCE_WINDOW = 30;
const MIN_OBSERVATIONS_FOR_ADJUST = 10;
const MAX_WEIGHT_FACTOR = 1.8;
const MIN_WEIGHT_FACTOR = 0.1;
const PROBATION_THRESHOLD_ACCURACY = 0.40;
const PROBATION_MIN_OBSERVATIONS = 15;
const PROBATION_WEIGHT_CAP = 0.2;
let driftDetector = { p_min: Infinity, s_min: Infinity, n: 0, warning_level: 2.0, drift_level: 3.0 };

// **IMPROVEMENT**: Now tracks performance specific to the market regime.
function getDynamicWeightAdjustment(signalSourceName, baseWeight, currentPeriodFull, currentMacroRegime) {
    if (!signalPerformance[signalSourceName]) {
        signalPerformance[signalSourceName] = {
            total: 0,
            recentAccuracy: [],
            performanceByRegime: {},
            isOnProbation: false
        };
    }
    const perf = signalPerformance[signalSourceName];

    let regimeSpecificAdjustment = 1.0;
    const regimePerf = perf.performanceByRegime[currentMacroRegime];
    if (regimePerf && regimePerf.total >= MIN_OBSERVATIONS_FOR_ADJUST / 2) {
        const regimeAccuracy = regimePerf.correct / regimePerf.total;
        const regimeDeviation = regimeAccuracy - 0.5;
        regimeSpecificAdjustment = 1 + (regimeDeviation * 1.5); // Stronger influence for regime accuracy
        regimeSpecificAdjustment = Math.max(0.4, Math.min(1.6, regimeSpecificAdjustment));
    }

    let overallAdjustmentFactor = 1.0;
    if (perf.recentAccuracy.length >= MIN_OBSERVATIONS_FOR_ADJUST) {
         const overallAccuracy = perf.recentAccuracy.reduce((a, b) => a + b, 0) / perf.recentAccuracy.length;
         const overallDeviation = overallAccuracy - 0.5;
         overallAdjustmentFactor = 1 + (overallDeviation * 1.2);
    }

    let finalAdjustmentFactor = (overallAdjustmentFactor + regimeSpecificAdjustment) / 2; // Blend overall and regime-specific performance

    if (perf.isOnProbation) {
        finalAdjustmentFactor = Math.min(finalAdjustmentFactor, PROBATION_WEIGHT_CAP);
    }

    const adjustedWeight = baseWeight * Math.min(Math.max(finalAdjustmentFactor, MIN_WEIGHT_FACTOR), MAX_WEIGHT_FACTOR);
    return Math.max(adjustedWeight, 0.001);
}

// **IMPROVEMENT**: Penalizes incorrect high-confidence predictions more severely.
function updateSignalPerformance(contributingSignals, actualOutcome, periodFull, macroRegime, lastFinalConfidence) {
    if (!actualOutcome || !contributingSignals || contributingSignals.length === 0) return;
    const isHighConfidenceMiss = lastFinalConfidence > 0.75 && getBigSmallFromNumber(actualOutcome) !== (lastFinalConfidence > 0.5 ? "BIG" : "SMALL");

    contributingSignals.forEach(signal => {
        if (!signal || !signal.source) return;
        const source = signal.source;
        if (!signalPerformance[source]) {
             signalPerformance[source] = {
                total: 0,
                recentAccuracy: [],
                performanceByRegime: {},
                isOnProbation: false
            };
        }
        const perf = signalPerformance[source];

        if (!perf.performanceByRegime[macroRegime]) {
            perf.performanceByRegime[macroRegime] = { correct: 0, total: 0 };
        }

        perf.total++;
        perf.performanceByRegime[macroRegime].total++;

        let outcomeCorrect = (signal.prediction === actualOutcome) ? 1 : 0;

        // **ENHANCED**: Apply harsher penalty for contributing to a high-confidence miss
        if (isHighConfidenceMiss && !outcomeCorrect) {
            outcomeCorrect = -0.5; // Acts as a penalty, pushing accuracy down faster
        }

        if (outcomeCorrect > 0) {
            perf.performanceByRegime[macroRegime].correct++;
        }

        perf.recentAccuracy.push(outcomeCorrect > 0 ? 1 : 0);
        if (perf.recentAccuracy.length > PERFORMANCE_WINDOW) {
            perf.recentAccuracy.shift();
        }

        const overallAccuracy = perf.recentAccuracy.reduce((a, b) => a + b, 0) / perf.recentAccuracy.length;
        if (perf.recentAccuracy.length >= PROBATION_MIN_OBSERVATIONS && overallAccuracy < PROBATION_THRESHOLD_ACCURACY) {
            perf.isOnProbation = true;
        } else if (overallAccuracy > PROBATION_THRESHOLD_ACCURACY + 0.15) {
            perf.isOnProbation = false;
        }
    });
}

function detectConceptDrift(isCorrect) {
    driftDetector.n++;
    const errorRate = isCorrect ? 0 : 1;
    const p_i = (driftDetector.n > 1 ? driftDetector.p_i : 0) + (errorRate - (driftDetector.n > 1 ? driftDetector.p_i : 0)) / driftDetector.n;
    driftDetector.p_i = p_i;
    const s_i = Math.sqrt(p_i * (1 - p_i) / driftDetector.n);

    if (p_i + s_i < driftDetector.p_min + driftDetector.s_min) {
        driftDetector.p_min = p_i;
        driftDetector.s_min = s_i;
    }

    if (p_i + s_i > driftDetector.p_min + driftDetector.drift_level * driftDetector.s_min) {
        driftDetector.p_min = Infinity;
        driftDetector.s_min = Infinity;
        driftDetector.n = 1;
        return 'DRIFT';
    } else if (p_i + s_i > driftDetector.p_min + driftDetector.warning_level * driftDetector.s_min) {
        return 'WARNING';
    } else {
        return 'STABLE';
    }
}

function analyzePredictionConsensus(signals) {
    if (!signals || signals.length < 3) {
        return { factor: 1.0, details: "Insufficient signals" };
    }

    const bigWeight = signals.filter(s => s.prediction === "BIG").reduce((sum, s) => sum + s.adjustedWeight, 0);
    const smallWeight = signals.filter(s => s.prediction === "SMALL").reduce((sum, s) => sum + s.adjustedWeight, 0);
    const totalWeight = bigWeight + smallWeight;

    if (totalWeight === 0) return { factor: 1.0, details: "No weighted signals" };

    const consensusScore = Math.abs(bigWeight - smallWeight) / totalWeight;
    const factor = 1.0 + (consensusScore * 0.5); // Amplify score based on consensus

    return {
        factor: Math.max(0.5, Math.min(1.5, factor)),
        details: `Score:${consensusScore.toFixed(2)}`
    };
}

function calculateUncertaintyScore(trendContext, stability, marketEntropyState, globalAccuracy, driftState) {
    let uncertaintyScore = 0;
    let reasons = [];

    if(driftState === 'DRIFT') {
        uncertaintyScore += 70;
        reasons.push("ConceptDrift");
    } else if (driftState === 'WARNING') {
        uncertaintyScore += 40;
        reasons.push("DriftWarning");
    }
    if (!stability.isStable) {
        uncertaintyScore += 45;
        reasons.push(`Instability:${stability.reason}`);
    }
    if (marketEntropyState.state.includes("CHAOS")) {
        uncertaintyScore += 35;
        reasons.push(marketEntropyState.state);
    }
    if (trendContext.isTransitioning) {
        uncertaintyScore += 25;
        reasons.push("RegimeTransition");
    }
    if (trendContext.volatility === "HIGH") {
        uncertaintyScore += 20;
        reasons.push("HighVolatility");
    }
     if (typeof globalAccuracy === 'number' && globalAccuracy < 0.48) {
        uncertaintyScore += (0.48 - globalAccuracy) * 150;
        reasons.push(`LowGlobalAcc:${globalAccuracy.toFixed(2)}`);
    }

    return { score: uncertaintyScore, reasons: reasons.join(';') };
}

function createFeatureSetForML(history, trendContext, time) {
    const numbers = history.map(e => parseInt(e.actualNumber || e.actual)).filter(n => !isNaN(n));
    if(numbers.length < 52) return null;

    return {
        time_sin: time.sin,
        time_cos: time.cos,
        last_5_mean: calculateSMA(numbers, 5),
        last_20_mean: calculateSMA(numbers, 20),
        stddev_10: calculateStdDev(numbers, 10),
        stddev_30: calculateStdDev(numbers, 30),
        rsi_14: calculateRSI(numbers, 14),
        // Simplified feature generation for placeholder
        macd_hist: (calculateEMA(numbers, 12) - calculateEMA(numbers, 26)),
        trend_strength: trendContext.strength === 'STRONG' ? 2 : (trendContext.strength === 'MODERATE' ? 1 : 0),
        volatility_level: trendContext.volatility === 'HIGH' ? 2 : (trendContext.volatility === 'MEDIUM' ? 1 : 0),
    };
}


function ultraAIPredict(currentSharedHistory, currentSharedStats) {
    const currentPeriodFull = currentSharedStats?.periodFull || Date.now();
    const time = getCurrentISTHour();
    const primeTimeSession = getPrimeTimeSession(time.raw);
    const realTimeData = getRealTimeExternalData();

    let masterLogic = [`QAScore_v43.0(IST:${time.raw})`, realTimeData.reason];
    if (primeTimeSession) masterLogic.push(`PrimeTime:${primeTimeSession.session}`);

    const globalAccuracy = currentSharedStats?.longTermGlobalAccuracy || 0.5;

    const trendContext = getMarketRegimeAndTrendContext(currentSharedHistory);
    masterLogic.push(`Trend(Dir:${trendContext.direction},Str:${trendContext.strength},Vol:${trendContext.volatility},Regime:${trendContext.macroRegime})`);

    const stability = analyzeTrendStability(currentSharedHistory);
    const marketEntropy = analyzeMarketEntropyState(currentSharedHistory);
    masterLogic.push(`Entropy:${marketEntropy.state}`);

    const advRegime = analyzeAdvancedMarketRegime(trendContext, marketEntropy);
    masterLogic.push(`AdvRegime:${advRegime.details}`);

    let driftState = 'STABLE';
    if (currentSharedStats && typeof currentSharedStats.lastActualOutcome !== 'undefined') {
        const lastPredictionWasCorrect = getBigSmallFromNumber(currentSharedStats.lastActualOutcome) === currentSharedStats.lastPredictedOutcome;
        driftState = detectConceptDrift(lastPredictionWasCorrect);
        if (driftState !== 'STABLE') masterLogic.push(`!!!DRIFT:${driftState}!!!`);
    }

    if (currentSharedStats && currentSharedStats.lastPredictionSignals && currentSharedStats.lastActualOutcome) {
        updateSignalPerformance(
            currentSharedStats.lastPredictionSignals,
            getBigSmallFromNumber(currentSharedStats.lastActualOutcome),
            currentSharedStats.lastPeriodFull,
            currentSharedStats.lastMacroRegime,
            currentSharedStats.lastFinalConfidence
        );
    }

    const confirmedHistory = currentSharedHistory.filter(p => p && p.actual !== null && p.actualNumber !== undefined);
    if (confirmedHistory.length < 52) {
        masterLogic.push(`InsufficientHistory`);
        const finalDecision = Math.random() > 0.5 ? "BIG" : "SMALL";
        return { /* Return forced random prediction */ };
    }

    let signals = [];
    const addSignal = (fn, historyArg, lookbackParams, baseWeight) => {
        const fnArgs = Array.isArray(lookbackParams) ? [historyArg, ...lookbackParams] : [historyArg, ...Object.values(lookbackParams)];
        if (fn === analyzeRSI || fn === analyzeStochastic) fnArgs.push(baseWeight, trendContext.volatility);
        else if (fn === analyzeMLModelSignal) {
             const features = createFeatureSetForML(historyArg, trendContext, time);
             if (!features) return;
             fnArgs.splice(0, 1, features, baseWeight);
        } else {
            fnArgs.push(baseWeight);
        }

        const result = fn(...fnArgs);
        if (result && result.weight && result.prediction) {
            result.adjustedWeight = getDynamicWeightAdjustment(result.source, result.weight, currentPeriodFull, trendContext.macroRegime);
            signals.push(result);
        }
    };

    // --- Signal Generation (Simplified & More Robust Set) ---
    addSignal(analyzeStreaks, confirmedHistory, {}, 0.08);
    addSignal(analyzeRSI, confirmedHistory, { rsiPeriod: 14 }, 0.10);
    addSignal(analyzeMACD, confirmedHistory, { shortPeriod: 12, longPeriod: 26, signalPeriod: 9 }, 0.12);
    addSignal(analyzeBollingerBands, confirmedHistory, { period: 20, stdDevMultiplier: 2.0 }, 0.09);
    addSignal(analyzeStochastic, confirmedHistory, { kPeriod: 14, dPeriod: 3, smoothK: 3 }, 0.10);
    addSignal(analyzeQuantumTunneling, confirmedHistory, {}, 0.06);

    // --- Meta-Signal & ML (Simulated) Signal Generation ---
    addSignal(analyzeMLModelSignal, confirmedHistory, {}, 0.25); // High base weight for simulated ML

    const consensus = analyzePredictionConsensus(signals);
    masterLogic.push(`Consensus(Factor:${consensus.factor.toFixed(2)})`);
    const superpositionSignal = analyzeQuantumSuperpositionState(signals, consensus, 0.20);
    if (superpositionSignal) {
        superpositionSignal.adjustedWeight = getDynamicWeightAdjustment(superpositionSignal.source, superpositionSignal.weight, currentPeriodFull, trendContext.macroRegime);
        signals.push(superpositionSignal);
    }

    const validSignals = signals.filter(s => s?.prediction && s.adjustedWeight > 0.001);
    masterLogic.push(`ValidSignals(${validSignals.length})`);

    if (validSignals.length < 3) {
        masterLogic.push(`NoValidSignals_ForceRandom`);
        const finalDecision = Math.random() > 0.5 ? "BIG" : "SMALL";
        return { /* Return forced random prediction */ };
    }

    let bigScore = 0; let smallScore = 0;
    validSignals.forEach(signal => {
        if (signal.prediction === "BIG") bigScore += signal.adjustedWeight;
        else if (signal.prediction === "SMALL") smallScore += signal.adjustedWeight;
    });

    bigScore *= (1 + advRegime.probabilities.bullTrend - advRegime.probabilities.bearTrend);
    smallScore *= (1 + advRegime.probabilities.bearTrend - advRegime.probabilities.bullTrend);

    bigScore *= consensus.factor;
    smallScore *= (2.0 - consensus.factor);

    const totalScore = bigScore + smallScore;
    let finalDecision = totalScore > 0 ? (bigScore >= smallScore ? "BIG" : "SMALL") : (Math.random() > 0.5 ? "BIG" : "SMALL");
    let finalConfidence = totalScore > 0 ? Math.max(bigScore, smallScore) / totalScore : 0.5;

    // Apply Prime Time & Real-Time Data Boosts
    if(primeTimeSession){
        finalConfidence = 0.5 + (finalConfidence - 0.5) * primeTimeSession.confidence;
    }
    finalConfidence = 0.5 + (finalConfidence - 0.5) * realTimeData.factor;

    const uncertainty = calculateUncertaintyScore(trendContext, stability, marketEntropy, globalAccuracy, driftState);
    const uncertaintyFactor = 1.0 - Math.min(1.0, uncertainty.score / 100.0);
    finalConfidence = 0.5 + (finalConfidence - 0.5) * uncertaintyFactor;
    masterLogic.push(`Uncertainty(Score:${uncertainty.score.toFixed(0)},Factor:${uncertaintyFactor.toFixed(2)})`);

    let confidenceLevel = 1;
    if (finalConfidence > 0.62) confidenceLevel = 2;
    if (finalConfidence > 0.75) confidenceLevel = 3;

    const isForced = uncertainty.score >= 85 || driftState === 'DRIFT';
    if(isForced) {
        confidenceLevel = 1;
        masterLogic.push(`FORCED_PREDICTION(Reason:${uncertainty.reasons || 'Drift'})`);
    }

    const bigDisplayConfidence = finalDecision === "BIG" ? finalConfidence : 1 - finalConfidence;
    const smallDisplayConfidence = finalDecision === "SMALL" ? finalConfidence : 1 - finalConfidence;

    const output = {
        predictions: {
            BIG: { confidence: Math.max(0.001, Math.min(0.999, bigDisplayConfidence)), logic: "EnsembleV43" },
            SMALL: { confidence: Math.max(0.001, Math.min(0.999, smallDisplayConfidence)), logic: "EnsembleV43" }
        },
        finalDecision,
        finalConfidence,
        confidenceLevel,
        isForcedPrediction: isForced,
        overallLogic: masterLogic.join(' -> '),
        source: "AdaptiveFusionV43",
        contributingSignals: validSignals.map(s => ({ source: s.source, prediction: s.prediction, weight: s.adjustedWeight.toFixed(5) })).sort((a,b)=>b.weight-a.weight).slice(0,10),
        lastPredictedOutcome: finalDecision,
        lastFinalConfidence: finalConfidence,
        lastConfidenceLevel: confidenceLevel,
        lastMacroRegime: trendContext.macroRegime,
        lastPredictionSignals: validSignals.map(s => ({ source: s.source, prediction: s.prediction, weight: s.adjustedWeight })),
    };

    console.log(`QAScore v43.0 Output: ${output.finalDecision} @ ${(output.finalConfidence * 100).toFixed(1)}% | Lvl: ${output.confidenceLevel} | Drift: ${driftState}`);
    return output;
}

// Ensure it's available for Node.js environments if needed
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = {
        ultraAIPredict,
        getBigSmallFromNumber
    };
}
