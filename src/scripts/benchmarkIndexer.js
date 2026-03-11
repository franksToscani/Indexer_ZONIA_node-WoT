const fs = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const axios = require("axios");
const pool = require("../infrastructure/db");

function parseArgs(args) {
    const parsed = {
        protocolPath: process.env.PROTOCOL_PATH || "",
        outputDir: "reports",
        apiBaseUrl: process.env.API_BASE_URL || "http://localhost:3000",
        sampleSize: 20,
        phaseSeconds: 60,
        onlyPhase: "",
        command1: "npx hardhat run scripts/simulateRequest.js --network localhost",
        command10: "npx hardhat run scripts/simulateRequest.js --network localhost",
        command30: "npx hardhat run scripts/simulateRequest.js --network localhost",
        resetBetweenPhases: false,
    };

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];

        if (arg === "--help" || arg === "-h") {
            parsed.help = true;
            continue;
        }

        if ((arg === "--protocol-path" || arg === "-p") && args[index + 1]) {
            parsed.protocolPath = args[index + 1];
            index += 1;
            continue;
        }

        if ((arg === "--output-dir" || arg === "-o") && args[index + 1]) {
            parsed.outputDir = args[index + 1];
            index += 1;
            continue;
        }

        if ((arg === "--api-base-url" || arg === "-u") && args[index + 1]) {
            parsed.apiBaseUrl = args[index + 1];
            index += 1;
            continue;
        }

        if ((arg === "--sample-size" || arg === "-s") && args[index + 1]) {
            parsed.sampleSize = Number(args[index + 1]);
            index += 1;
            continue;
        }

        if ((arg === "--phase-seconds") && args[index + 1]) {
            parsed.phaseSeconds = Number(args[index + 1]);
            index += 1;
            continue;
        }

        if ((arg === "--only-phase") && args[index + 1]) {
            parsed.onlyPhase = String(args[index + 1]);
            index += 1;
            continue;
        }

        if (arg === "--reset-between-phases") {
            parsed.resetBetweenPhases = true;
            continue;
        }

        if (arg === "--command-1" && args[index + 1]) {
            parsed.command1 = args[index + 1];
            index += 1;
            continue;
        }

        if (arg === "--command-10" && args[index + 1]) {
            parsed.command10 = args[index + 1];
            index += 1;
            continue;
        }

        if (arg === "--command-30" && args[index + 1]) {
            parsed.command30 = args[index + 1];
            index += 1;
        }
    }

    return parsed;
}

function printHelp() {
    console.log("\nUso:");
    console.log("  node src/scripts/benchmarkIndexer.js [opzioni]\n");
    console.log("Opzioni:");
    console.log("  --protocol-path, -p       Path progetto protocol (obbligatorio o PROTOCOL_PATH in .env)");
    console.log("  --output-dir, -o          Directory report (default: reports)");
    console.log("  --api-base-url, -u        URL base API indexer (default: http://localhost:3000)");
    console.log("  --sample-size, -s         Numero requestId da campionare per API latency (default: 20)");
    console.log("  --phase-seconds           Durata di ogni fase benchmark in secondi (default: 60)");
    console.log("  --only-phase              Esegue solo una fase: 1_rpm | 10_rpm | 30_rpm");
    console.log("  --reset-between-phases    TRUNCATE td_matches tra le fasi");
    console.log("  --command-1               Comando single-shot fase 1 req/min (default: npx hardhat run scripts/simulateRequest.js --network localhost)");
    console.log("  --command-10              Comando single-shot fase 10 req/min (default: npx hardhat run scripts/simulateRequest.js --network localhost)");
    console.log("  --command-30              Comando single-shot fase 30 req/min (default: npx hardhat run scripts/simulateRequest.js --network localhost)");
    console.log("  --help, -h               Mostra aiuto\n");
}

function validateOptions(options) {
    if (!options.protocolPath) {
        throw new Error("protocol-path mancante: usa --protocol-path o PROTOCOL_PATH nel file .env");
    }

    if (!Number.isInteger(options.sampleSize) || options.sampleSize <= 0) {
        throw new Error("sample-size non valido: deve essere intero > 0");
    }

    if (!Number.isInteger(options.phaseSeconds) || options.phaseSeconds <= 0) {
        throw new Error("phase-seconds non valido: deve essere intero > 0");
    }

    if (
        options.onlyPhase &&
        !["1_rpm", "10_rpm", "30_rpm"].includes(options.onlyPhase)
    ) {
        throw new Error("only-phase non valido: usa 1_rpm, 10_rpm oppure 30_rpm");
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSingleCommand(command, cwd) {
    return new Promise((resolve) => {
        const child = spawn(command, {
            cwd,
            shell: true,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
        });

        let startupError = "";
        let stdoutTail = [];
        let stderrTail = [];
    let stdoutText = "";
    let stderrText = "";
    const maxCapturedChars = 200000;

        function appendTail(buffer, chunk) {
            const lines = String(chunk)
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean);

            buffer = buffer.concat(lines);
            if (buffer.length > 8) {
                buffer = buffer.slice(buffer.length - 8);
            }

            return buffer;
        }

        child.stdout.on("data", (chunk) => {
            stdoutTail = appendTail(stdoutTail, chunk);
            stdoutText += String(chunk);
            if (stdoutText.length > maxCapturedChars) {
                stdoutText = stdoutText.slice(stdoutText.length - maxCapturedChars);
            }
        });

        child.stderr.on("data", (chunk) => {
            stderrTail = appendTail(stderrTail, chunk);
            stderrText += String(chunk);
            if (stderrText.length > maxCapturedChars) {
                stderrText = stderrText.slice(stderrText.length - maxCapturedChars);
            }
        });

        child.on("error", (error) => {
            startupError = error.message;
        });

        child.on("close", (code, signal) => {
            resolve({
                code,
                signal,
                startupError,
                stdoutTail,
                stderrTail,
                stdoutText,
                stderrText,
            });
        });
    });
}

function toIso(date) {
    return new Date(date).toISOString();
}

function percentile(values, percentileValue) {
    if (!values.length) {
        return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
}

function extractRequestId(outputText) {
    if (!outputText) {
        return "";
    }

    const matches = [...String(outputText).matchAll(/Request\s*ID\s*:\s*(0x[a-fA-F0-9]{64})/gi)];
    if (!matches.length) {
        return "";
    }

    return matches[matches.length - 1][1];
}

function extractQuery(outputText) {
    if (!outputText) {
        return "";
    }

    const match = String(outputText).match(/Query\s*:\s*([A-Za-z0-9_-]+)/i);
    return match ? match[1] : "";
}

function computeSummary(values) {
    if (!values.length) {
        return {
            avgMs: 0,
            minMs: 0,
            maxMs: 0,
        };
    }

    const sum = values.reduce((acc, value) => acc + value, 0);
    const avgMs = sum / values.length;

    return {
        avgMs: Number(avgMs.toFixed(2)),
        minMs: Number(Math.min(...values).toFixed(2)),
        maxMs: Number(Math.max(...values).toFixed(2)),
    };
}

function computeQueryDistribution(submissions) {
    const distribution = {};

    for (const submission of submissions) {
        if (!submission.commandSucceeded) {
            continue;
        }

        const key = submission.query || "unknown";
        distribution[key] = (distribution[key] || 0) + 1;
    }

    return distribution;
}

async function collectDbStats(startedAt, endedAt) {
    const statsQuery = `
        SELECT
            COUNT(DISTINCT request_id)::int AS request_count,
            COUNT(*)::int AS td_match_count
        FROM td_matches
        WHERE matched_at >= $1 AND matched_at <= $2
    `;

    const perRequestQuery = `
        SELECT
            request_id,
            COUNT(*)::int AS match_count,
            MIN(matched_at) AS first_matched_at
        FROM td_matches
        WHERE matched_at >= $1 AND matched_at <= $2
        GROUP BY request_id
        ORDER BY first_matched_at ASC
    `;

    const statsResult = await pool.query(statsQuery, [startedAt, endedAt]);
    const perRequestResult = await pool.query(perRequestQuery, [startedAt, endedAt]);

    const { request_count: requestCount, td_match_count: tdMatchCount } =
        statsResult.rows[0] || { request_count: 0, td_match_count: 0 };

    return {
        requestCount,
        tdMatchCount,
        perRequestRows: perRequestResult.rows,
    };
}

async function sampleApiLatency(apiBaseUrl, requestIds, sampleSize) {
    const sampledRequestIds = requestIds.slice(0, sampleSize);

    if (!sampledRequestIds.length) {
        return {
            sampledRequests: 0,
            successCount: 0,
            errorCount: 0,
            cacheHitCount: 0,
            dbFallbackCount: 0,
            cacheHitRate: 0,
            overall: computeSummary([]),
            cache: computeSummary([]),
            dbFallback: computeSummary([]),
        };
    }

    const overallLatencies = [];
    const cacheLatencies = [];
    const dbFallbackLatencies = [];
    let successCount = 0;
    let errorCount = 0;
    let cacheHitCount = 0;
    let dbFallbackCount = 0;

    for (const requestId of sampledRequestIds) {
        const started = Date.now();

        try {
            const response = await axios.get(`${apiBaseUrl}/data/${requestId}`, {
                timeout: 15000,
            });

            const elapsedMs = Date.now() - started;
            overallLatencies.push(elapsedMs);

            if (response.status >= 200 && response.status < 300) {
                successCount += 1;

                const sourceFromHeader = response.headers?.["x-data-source"];
                const sourceFromBody = response.data?.source;
                const normalizedSource = String(sourceFromHeader || sourceFromBody || "").toLowerCase();

                if (normalizedSource === "cache") {
                    cacheHitCount += 1;
                    cacheLatencies.push(elapsedMs);
                } else if (normalizedSource === "db") {
                    dbFallbackCount += 1;
                    dbFallbackLatencies.push(elapsedMs);
                }
            } else {
                errorCount += 1;
            }
        } catch {
            errorCount += 1;
        }
    }

    const classifiedReads = cacheHitCount + dbFallbackCount;
    const cacheHitRate = classifiedReads > 0
        ? Number(((cacheHitCount / classifiedReads) * 100).toFixed(2))
        : 0;

    return {
        sampledRequests: sampledRequestIds.length,
        successCount,
        errorCount,
        cacheHitCount,
        dbFallbackCount,
        cacheHitRate,
        overall: computeSummary(overallLatencies),
        cache: computeSummary(cacheLatencies),
        dbFallback: computeSummary(dbFallbackLatencies),
    };
}

function computeMatchesPerRequestMetrics(perRequestRows, successfulSubmissions) {
    const matchesPerRequest = perRequestRows.map((row) => Number(row.match_count) || 0);
    const requestWithAtLeastOneMatch = matchesPerRequest.filter((value) => value > 0).length;
    const denominator = Math.max(successfulSubmissions, perRequestRows.length);
    const average = matchesPerRequest.length
        ? matchesPerRequest.reduce((sum, value) => sum + value, 0) / matchesPerRequest.length
        : 0;

    const matchRate = denominator > 0
        ? Number(((requestWithAtLeastOneMatch / denominator) * 100).toFixed(2))
        : 0;

    return {
        avg: Number(average.toFixed(2)),
        min: matchesPerRequest.length ? Math.min(...matchesPerRequest) : 0,
        max: matchesPerRequest.length ? Math.max(...matchesPerRequest) : 0,
        matchRate,
        matchedRequests: requestWithAtLeastOneMatch,
        denominator,
    };
}

function computeE2eMetrics(submissions, perRequestRows) {
    const submittedAtByRequestId = new Map();

    for (const submission of submissions) {
        if (!submission.requestId || !submission.commandSucceeded) {
            continue;
        }

        const existing = submittedAtByRequestId.get(submission.requestId);
        if (!existing || existing > submission.submittedAtMs) {
            submittedAtByRequestId.set(submission.requestId, submission.submittedAtMs);
        }
    }

    const e2eLatencies = [];

    for (const row of perRequestRows) {
        const submittedAtMs = submittedAtByRequestId.get(row.request_id);
        if (!submittedAtMs) {
            continue;
        }

        const firstMatchedAtMs = new Date(row.first_matched_at).getTime();
        if (Number.isNaN(firstMatchedAtMs)) {
            continue;
        }

        const e2eMs = firstMatchedAtMs - submittedAtMs;
        if (e2eMs >= 0) {
            e2eLatencies.push(e2eMs);
        }
    }

    const uniqueSuccessfulSubmitted = new Set(
        submissions
            .filter((submission) => submission.commandSucceeded && submission.requestId)
            .map((submission) => submission.requestId)
    ).size;

    return {
        completedRequests: e2eLatencies.length,
        submittedRequests: uniqueSuccessfulSubmitted,
        summary: computeSummary(e2eLatencies),
    };
}

async function runPhase(options, phaseName, command) {
    if (options.resetBetweenPhases) {
        await pool.query("TRUNCATE TABLE td_matches");
    }

    console.log(`\n=== Fase ${phaseName} ===`);
    console.log(` Comando: ${command}`);

    const startedAt = new Date();
    let commandSucceeded = true;
    let commandError = "";
    const targetRpm = phaseName === "1_rpm" ? 1 : phaseName === "10_rpm" ? 10 : 30;
    const intervalMs = Math.floor(60000 / targetRpm);
    const phaseEndMs = startedAt.getTime() + options.phaseSeconds * 1000;
    let nextRunAtMs = startedAt.getTime();
    let attempts = 0;
    let successes = 0;
    let failures = 0;
    let lastStdoutTail = [];
    let lastStderrTail = [];
    const submissions = [];

    while (Date.now() < phaseEndMs) {
        const nowMs = Date.now();

        if (nowMs < nextRunAtMs) {
            await sleep(Math.min(200, nextRunAtMs - nowMs));
            continue;
        }

        attempts += 1;
        const commandStartedAtMs = Date.now();
        const singleResult = await runSingleCommand(command, options.protocolPath);
        lastStdoutTail = singleResult.stdoutTail;
        lastStderrTail = singleResult.stderrTail;
        const requestId = extractRequestId(`${singleResult.stdoutText}\n${singleResult.stderrText}`);
        const query = extractQuery(`${singleResult.stdoutText}\n${singleResult.stderrText}`);
        const commandOk = !singleResult.startupError && singleResult.code === 0;

        submissions.push({
            submittedAtMs: commandStartedAtMs,
            requestId,
            query,
            commandSucceeded: commandOk,
        });

        if (commandOk) {
            successes += 1;
        } else {
            failures += 1;
            commandSucceeded = false;
            commandError = singleResult.startupError || `process exited with code ${singleResult.code}`;
        }

        nextRunAtMs += intervalMs;
    }

    if (lastStdoutTail.length) {
        console.log(` Output: ${lastStdoutTail.join(" | ")}`);
    }

    if (lastStderrTail.length) {
        console.log(` stderr: ${lastStderrTail.join(" | ")}`);
    }

    if (!commandSucceeded) {
        console.error(`:-() Errore comando fase ${phaseName}: ${commandError}`);
    }

    const endedAt = new Date();
    const durationSeconds = (endedAt.getTime() - startedAt.getTime()) / 1000;

    const { requestCount, tdMatchCount, perRequestRows } = await collectDbStats(startedAt, endedAt);
    const sampledRequestIds = perRequestRows
        .slice()
        .sort((a, b) => new Date(b.first_matched_at).getTime() - new Date(a.first_matched_at).getTime())
        .map((row) => row.request_id);

    const apiMetrics = await sampleApiLatency(
        options.apiBaseUrl,
        sampledRequestIds,
        options.sampleSize
    );

    const matchesMetrics = computeMatchesPerRequestMetrics(perRequestRows, successes);
    const e2eMetrics = computeE2eMetrics(submissions, perRequestRows);
    const e2eThroughputRpm = durationSeconds > 0
        ? Number(((e2eMetrics.completedRequests / durationSeconds) * 60).toFixed(2))
        : 0;

    const requestsPerMinuteObserved = durationSeconds > 0
        ? Number(((requestCount / durationSeconds) * 60).toFixed(2))
        : 0;

    const queryDistribution = computeQueryDistribution(submissions);
    const result = {
        phase: phaseName,
        command,
        commandSucceeded,
        commandError,
        targetRpm,
        attempts,
        successfulSubmissions: successes,
        failedSubmissions: failures,
        startedAt: toIso(startedAt),
        endedAt: toIso(endedAt),
        durationSeconds: Number(durationSeconds.toFixed(2)),
        requestCount,
        tdMatchCount,
        requestsPerMinuteObserved,
        e2eThroughputRpm,
        api: apiMetrics,
        e2e: {
            completedRequests: e2eMetrics.completedRequests,
            submittedRequests: e2eMetrics.submittedRequests,
            ...e2eMetrics.summary,
        },
        matches: matchesMetrics,
        queryDistribution,
    };

    console.log(` Request processate: ${requestCount}`);
    console.log(` TD match salvate: ${tdMatchCount}`);
    console.log(` Invii comando: ${attempts} (ok: ${successes}, fail: ${failures})`);
    console.log(` Throughput osservato: ${requestsPerMinuteObserved} req/min`);
    console.log(` Throughput E2E: ${e2eThroughputRpm} req/min (complete: ${e2eMetrics.completedRequests})`);
    console.log(` API avg/max: ${apiMetrics.overall.avgMs}ms / ${apiMetrics.overall.maxMs}ms`);
    console.log(` Cache hit-rate: ${apiMetrics.cacheHitRate}% (cache: ${apiMetrics.cacheHitCount}, db: ${apiMetrics.dbFallbackCount})`);
    console.log(` API cache avg/max: ${apiMetrics.cache.avgMs}ms / ${apiMetrics.cache.maxMs}ms`);
    console.log(` API db-fallback avg/max: ${apiMetrics.dbFallback.avgMs}ms / ${apiMetrics.dbFallback.maxMs}ms`);
    console.log(` E2E avg/max: ${e2eMetrics.summary.avgMs}ms / ${e2eMetrics.summary.maxMs}ms`);
    console.log(` Matches avg/min/max: ${matchesMetrics.avg} / ${matchesMetrics.min} / ${matchesMetrics.max} (match-rate: ${matchesMetrics.matchRate}%)`);

    return result;
}

function toCsv(rows) {
    const header = [
        "phase",
        "targetRpm",
        "commandSucceeded",
        "attempts",
        "successfulSubmissions",
        "failedSubmissions",
        "durationSeconds",
        "requestCount",
        "tdMatchCount",
        "requestsPerMinuteObserved",
        "e2eThroughputRpm",
        "apiSampledRequests",
        "apiSuccessCount",
        "apiErrorCount",
        "apiCacheHitCount",
        "apiDbFallbackCount",
        "apiCacheHitRate",
        "apiOverallAvgMs",
        "apiOverallMaxMs",
        "apiCacheAvgMs",
        "apiCacheMaxMs",
        "apiDbFallbackAvgMs",
        "apiDbFallbackMaxMs",
        "e2eCompletedRequests",
        "e2eSubmittedRequests",
        "e2eAvgMs",
        "e2eMaxMs",
        "matchesAvg",
        "matchesMin",
        "matchesMax",
        "matchRate",
        "commandError",
    ];

    const lines = [header.join(",")];

    for (const row of rows) {
        const values = [
            row.phase,
            row.targetRpm,
            row.commandSucceeded,
            row.attempts,
            row.successfulSubmissions,
            row.failedSubmissions,
            row.durationSeconds,
            row.requestCount,
            row.tdMatchCount,
            row.requestsPerMinuteObserved,
            row.e2eThroughputRpm,
            row.api.sampledRequests,
            row.api.successCount,
            row.api.errorCount,
            row.api.cacheHitCount,
            row.api.dbFallbackCount,
            row.api.cacheHitRate,
            row.api.overall.avgMs,
            row.api.overall.maxMs,
            row.api.cache.avgMs,
            row.api.cache.maxMs,
            row.api.dbFallback.avgMs,
            row.api.dbFallback.maxMs,
            row.e2e.completedRequests,
            row.e2e.submittedRequests,
            row.e2e.avgMs,
            row.e2e.maxMs,
            row.matches.avg,
            row.matches.min,
            row.matches.max,
            row.matches.matchRate,
            JSON.stringify(row.commandError || ""),
        ];

        lines.push(values.join(","));
    }

    return lines.join("\n");
}

function toHistoryCsvRows(rows, runId, generatedAtIso) {
    const header = [
        "runId",
        "generatedAt",
        "phase",
        "targetRpm",
        "commandSucceeded",
        "attempts",
        "successfulSubmissions",
        "failedSubmissions",
        "durationSeconds",
        "requestCount",
        "tdMatchCount",
        "requestsPerMinuteObserved",
        "e2eThroughputRpm",
        "apiSampledRequests",
        "apiSuccessCount",
        "apiErrorCount",
        "apiCacheHitCount",
        "apiDbFallbackCount",
        "apiCacheHitRate",
        "apiOverallAvgMs",
        "apiOverallMaxMs",
        "apiCacheAvgMs",
        "apiCacheMaxMs",
        "apiDbFallbackAvgMs",
        "apiDbFallbackMaxMs",
        "e2eCompletedRequests",
        "e2eSubmittedRequests",
        "e2eAvgMs",
        "e2eMaxMs",
        "matchesAvg",
        "matchesMin",
        "matchesMax",
        "matchRate",
        "commandError",
    ];

    const lines = [header.join(",")];

    for (const row of rows) {
        const values = [
            runId,
            generatedAtIso,
            row.phase,
            row.targetRpm,
            row.commandSucceeded,
            row.attempts,
            row.successfulSubmissions,
            row.failedSubmissions,
            row.durationSeconds,
            row.requestCount,
            row.tdMatchCount,
            row.requestsPerMinuteObserved,
            row.e2eThroughputRpm,
            row.api.sampledRequests,
            row.api.successCount,
            row.api.errorCount,
            row.api.cacheHitCount,
            row.api.dbFallbackCount,
            row.api.cacheHitRate,
            row.api.overall.avgMs,
            row.api.overall.maxMs,
            row.api.cache.avgMs,
            row.api.cache.maxMs,
            row.api.dbFallback.avgMs,
            row.api.dbFallback.maxMs,
            row.e2e.completedRequests,
            row.e2e.submittedRequests,
            row.e2e.avgMs,
            row.e2e.maxMs,
            row.matches.avg,
            row.matches.min,
            row.matches.max,
            row.matches.matchRate,
            JSON.stringify(row.commandError || ""),
        ];

        lines.push(values.join(","));
    }

    return lines.join("\n");
}

async function runBenchmark() {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
        printHelp();
        return;
    }

    validateOptions(options);

    const phases = [
        { name: "1_rpm", command: options.command1 },
        { name: "10_rpm", command: options.command10 },
        { name: "30_rpm", command: options.command30 },
    ];

    const selectedPhases = options.onlyPhase
        ? phases.filter((phase) => phase.name === options.onlyPhase)
        : phases;

    const results = [];
    console.log("\n Avvio benchmark indexer");

    try {
        for (const phase of selectedPhases) {
            const phaseResult = await runPhase(options, phase.name, phase.command);
            results.push(phaseResult);
        }

        const generatedAt = new Date();
        const report = {
            generatedAt: toIso(generatedAt),
            settings: {
                protocolPath: options.protocolPath,
                apiBaseUrl: options.apiBaseUrl,
                sampleSize: options.sampleSize,
                phaseSeconds: options.phaseSeconds,
                onlyPhase: options.onlyPhase || "all",
                resetBetweenPhases: options.resetBetweenPhases,
            },
            phases: results,
        };

        const outputDirAbsolute = path.resolve(options.outputDir);
        await fs.mkdir(outputDirAbsolute, { recursive: true });

        const stamp = generatedAt.toISOString().replace(/[:.]/g, "-");
        const runId = stamp;
        const jsonPath = path.join(outputDirAbsolute, `benchmark-${stamp}.json`);
        const csvPath = path.join(outputDirAbsolute, `benchmark-${stamp}.csv`);
        const historyCsvPath = path.join(outputDirAbsolute, "benchmark-history.csv");

        await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
        await fs.writeFile(csvPath, `${toCsv(results)}\n`, "utf-8");

        const historyBlock = `${toHistoryCsvRows(results, runId, toIso(generatedAt))}\n`;
        const historyExists = await fs
            .access(historyCsvPath)
            .then(() => true)
            .catch(() => false);

        if (historyExists) {
            const bodyOnly = historyBlock.split("\n").slice(1).join("\n").trim();
            if (bodyOnly) {
                await fs.appendFile(historyCsvPath, `${bodyOnly}\n`, "utf-8");
            }
        } else {
            await fs.writeFile(historyCsvPath, historyBlock, "utf-8");
        }

        console.log("\n Benchmark completato");
        console.log(` Report JSON: ${jsonPath}`);
        console.log(` Report CSV: ${csvPath}\n`);
        console.log(` Report storico CSV: ${historyCsvPath}\n`);
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    runBenchmark().catch((error) => {
        console.error(`:-() Errore benchmark: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    runBenchmark,
};
