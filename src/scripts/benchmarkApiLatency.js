const fs = require("fs/promises");
const path = require("path");
const axios = require("axios");
const pool = require("../infrastructure/db");

function parseArgs(args) {
    const parsed = {
        apiBaseUrl: process.env.API_BASE_URL || "http://localhost:3000",
        requestId: "",
        oracles: 10,
        rounds: 1,
        roundDelayMs: 0,
        timeoutMs: 15000,
        outputDir: "reports",
    };
    const positional = [];

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];

        if (arg === "--help" || arg === "-h") {
            parsed.help = true;
            continue;
        }

        if ((arg === "--api-base-url" || arg === "-u") && args[index + 1]) {
            parsed.apiBaseUrl = args[index + 1];
            index += 1;
            continue;
        }

        if ((arg === "--request-id" || arg === "-r") && args[index + 1]) {
            parsed.requestId = args[index + 1];
            index += 1;
            continue;
        }

        if ((arg === "--oracles" || arg === "-o") && args[index + 1]) {
            parsed.oracles = Number(args[index + 1]);
            index += 1;
            continue;
        }

        if ((arg === "--rounds") && args[index + 1]) {
            parsed.rounds = Number(args[index + 1]);
            index += 1;
            continue;
        }

        if ((arg === "--round-delay-ms") && args[index + 1]) {
            parsed.roundDelayMs = Number(args[index + 1]);
            index += 1;
            continue;
        }

        if ((arg === "--timeout-ms") && args[index + 1]) {
            parsed.timeoutMs = Number(args[index + 1]);
            index += 1;
            continue;
        }

        if ((arg === "--output-dir") && args[index + 1]) {
            parsed.outputDir = args[index + 1];
            index += 1;
            continue;
        }

        if (!arg.startsWith("-")) {
            positional.push(arg);
        }
    }

    if (!parsed.requestId && positional[0]) {
        parsed.requestId = String(positional[0]);
    }

    if (Number.isNaN(parsed.oracles) && positional[1]) {
        parsed.oracles = Number(positional[1]);
    }

    if (Number.isNaN(parsed.rounds) && positional[2]) {
        parsed.rounds = Number(positional[2]);
    }

    return parsed;
}

function printHelp() {
    console.log("\nUso:");
    console.log("  node src/scripts/benchmarkApiLatency.js [opzioni]\n");
    console.log("Opzioni:");
    console.log("  --api-base-url, -u     URL base API indexer (default: http://localhost:3000)");
    console.log("  --request-id, -r       RequestId specifico da interrogare (default: ultimo da DB)");
    console.log("  --oracles, -o          Numero di oracoli finti concorrenti per round (default: 10)");
    console.log("  --rounds               Numero di round da eseguire (default: 1)");
    console.log("  --round-delay-ms       Pausa tra i round in ms (default: 0)");
    console.log("  --timeout-ms           Timeout singola GET in ms (default: 15000)");
    console.log("  --output-dir           Directory report (default: reports)");
    console.log("  --help, -h             Mostra aiuto\n");
}

function validateOptions(options) {
    if (!Number.isInteger(options.oracles) || options.oracles <= 0) {
        throw new Error("oracles non valido: deve essere intero > 0");
    }

    if (!Number.isInteger(options.rounds) || options.rounds <= 0) {
        throw new Error("rounds non valido: deve essere intero > 0");
    }

    if (!Number.isInteger(options.roundDelayMs) || options.roundDelayMs < 0) {
        throw new Error("round-delay-ms non valido: deve essere intero >= 0");
    }

    if (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0) {
        throw new Error("timeout-ms non valido: deve essere intero > 0");
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeSummary(values) {
    if (!values.length) {
        return {
            count: 0,
            avgMs: 0,
            minMs: 0,
            maxMs: 0,
        };
    }

    const sum = values.reduce((accumulator, value) => accumulator + value, 0);

    return {
        count: values.length,
        avgMs: Number((sum / values.length).toFixed(2)),
        minMs: Number(Math.min(...values).toFixed(2)),
        maxMs: Number(Math.max(...values).toFixed(2)),
    };
}

async function resolveRequestId(explicitRequestId) {
    if (explicitRequestId) {
        return explicitRequestId;
    }

    const query = `
        SELECT request_id
        FROM td_matches
        ORDER BY matched_at DESC
        LIMIT 1
    `;

    const result = await pool.query(query);
    const latestRequestId = result.rows[0]?.request_id || "";

    if (!latestRequestId) {
        throw new Error("Nessun request_id disponibile in td_matches. Esegui prima una simulazione che produca match.");
    }

    return latestRequestId;
}

async function runOracleRequest(apiBaseUrl, requestId, timeoutMs, oracleId, round) {
    const startedAt = Date.now();

    try {
        const response = await axios.get(`${apiBaseUrl}/data/${requestId}`, {
            timeout: timeoutMs,
        });

        const latencyMs = Date.now() - startedAt;
        const source = String(response.headers?.["x-data-source"] || response.data?.source || "unknown").toLowerCase();

        return {
            round,
            oracleId,
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            latencyMs,
            source,
            error: "",
        };
    } catch (error) {
        const latencyMs = Date.now() - startedAt;

        return {
            round,
            oracleId,
            ok: false,
            status: 0,
            latencyMs,
            source: "error",
            error: error.message || "request_failed",
        };
    }
}

function toCsvRows(rows) {
    const header = [
        "round",
        "oracleId",
        "ok",
        "status",
        "latencyMs",
        "source",
        "error",
    ];

    const lines = [header.join(",")];

    for (const row of rows) {
        const values = [
            row.round,
            row.oracleId,
            row.ok,
            row.status,
            row.latencyMs,
            row.source,
            JSON.stringify(row.error || ""),
        ];

        lines.push(values.join(","));
    }

    return lines.join("\n");
}

function summarizeRows(rows) {
    const successfulRows = rows.filter((row) => row.ok);
    const latencyAll = successfulRows.map((row) => row.latencyMs);
    const cacheLatencies = successfulRows
        .filter((row) => row.source === "cache")
        .map((row) => row.latencyMs);
    const dbLatencies = successfulRows
        .filter((row) => row.source === "db")
        .map((row) => row.latencyMs);

    const successCount = successfulRows.length;
    const totalCount = rows.length;
    const errorCount = totalCount - successCount;
    const errorRate = totalCount > 0 ? Number(((errorCount / totalCount) * 100).toFixed(2)) : 0;

    const cacheHits = successfulRows.filter((row) => row.source === "cache").length;
    const dbFallbackCount = successfulRows.filter((row) => row.source === "db").length;
    const classifiedReads = cacheHits + dbFallbackCount;
    const cacheHitRate = classifiedReads > 0 ? Number(((cacheHits / classifiedReads) * 100).toFixed(2)) : 0;

    return {
        totalCalls: totalCount,
        successCount,
        errorCount,
        errorRate,
        cacheHits,
        dbFallbackCount,
        cacheHitRate,
        apiOverall: computeSummary(latencyAll),
        apiCache: computeSummary(cacheLatencies),
        apiDbFallback: computeSummary(dbLatencies),
    };
}

async function benchmarkApiLatency() {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
        printHelp();
        return;
    }

    validateOptions(options);

    const requestId = await resolveRequestId(options.requestId);

    console.log("\n Avvio benchmark API latency");
    console.log(` RequestId: ${requestId}`);
    console.log(` Oracoli concorrenti: ${options.oracles}`);
    console.log(` Round: ${options.rounds}\n`);

    const startedAt = new Date();
    const allRows = [];

    for (let round = 1; round <= options.rounds; round += 1) {
        console.log(`=== Round ${round}/${options.rounds} ===`);

        const tasks = [];
        for (let oracleIndex = 1; oracleIndex <= options.oracles; oracleIndex += 1) {
            tasks.push(
                runOracleRequest(
                    options.apiBaseUrl,
                    requestId,
                    options.timeoutMs,
                    oracleIndex,
                    round
                )
            );
        }

        const roundRows = await Promise.all(tasks);
        allRows.push(...roundRows);

        const roundSummary = summarizeRows(roundRows);
        console.log(` success/error: ${roundSummary.successCount}/${roundSummary.errorCount}`);
        console.log(` API avg/max: ${roundSummary.apiOverall.avgMs}ms / ${roundSummary.apiOverall.maxMs}ms`);
        console.log(` cache hit-rate: ${roundSummary.cacheHitRate}% (cache: ${roundSummary.cacheHits}, db: ${roundSummary.dbFallbackCount})\n`);

        if (round < options.rounds && options.roundDelayMs > 0) {
            await sleep(options.roundDelayMs);
        }
    }

    const endedAt = new Date();
    const durationSeconds = Number(((endedAt.getTime() - startedAt.getTime()) / 1000).toFixed(2));
    const summary = summarizeRows(allRows);
    const throughputPerMin = durationSeconds > 0
        ? Number(((summary.successCount / durationSeconds) * 60).toFixed(2))
        : 0;

    const report = {
        generatedAt: new Date().toISOString(),
        settings: {
            apiBaseUrl: options.apiBaseUrl,
            requestId,
            oracles: options.oracles,
            rounds: options.rounds,
            roundDelayMs: options.roundDelayMs,
            timeoutMs: options.timeoutMs,
        },
        durationSeconds,
        throughputPerMin,
        summary,
        rows: allRows,
    };

    const outputDirAbsolute = path.resolve(options.outputDir);
    await fs.mkdir(outputDirAbsolute, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonPath = path.join(outputDirAbsolute, `api-latency-${stamp}.json`);
    const csvPath = path.join(outputDirAbsolute, `api-latency-${stamp}.csv`);

    await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
    await fs.writeFile(csvPath, `${toCsvRows(allRows)}\n`, "utf-8");

    console.log(" Benchmark API completato");
    console.log(` Durata: ${durationSeconds}s`);
    console.log(` Throughput: ${throughputPerMin} req/min`);
    console.log(` Success/error: ${summary.successCount}/${summary.errorCount}`);
    console.log(` API overall avg/max: ${summary.apiOverall.avgMs}ms / ${summary.apiOverall.maxMs}ms`);
    console.log(` API cache avg/max: ${summary.apiCache.avgMs}ms / ${summary.apiCache.maxMs}ms`);
    console.log(` API db-fallback avg/max: ${summary.apiDbFallback.avgMs}ms / ${summary.apiDbFallback.maxMs}ms`);
    console.log(` Cache hit-rate: ${summary.cacheHitRate}%`);
    console.log(` Report JSON: ${jsonPath}`);
    console.log(` Report CSV: ${csvPath}\n`);
}

if (require.main === module) {
    benchmarkApiLatency()
        .catch((error) => {
            console.error(`:-() Errore benchmark API latency: ${error.message}`);
            process.exit(1);
        })
        .finally(async () => {
            await pool.end();
        });
}

module.exports = { benchmarkApiLatency };