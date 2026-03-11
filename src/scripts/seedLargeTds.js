const pool = require("../infrastructure/db");

function parseArgs(args) {
    const parsed = {
        count: 10000,
        batchSize: 500,
        truncate: true,
    };

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];

        if (arg === "--help" || arg === "-h") {
            parsed.help = true;
            continue;
        }

        if ((arg === "--count" || arg === "-c") && args[index + 1]) {
            parsed.count = Number(args[index + 1]);
            index += 1;
            continue;
        }

        if ((arg === "--batch-size" || arg === "-b") && args[index + 1]) {
            parsed.batchSize = Number(args[index + 1]);
            index += 1;
            continue;
        }

        if (arg === "--no-truncate") {
            parsed.truncate = false;
        }
    }

    return parsed;
}

function printHelp() {
    console.log("\nUso:");
    console.log("  node src/scripts/seedLargeTds.js [--count 10000] [--batch-size 500] [--no-truncate]\n");
    console.log("Opzioni:");
    console.log("  --count, -c       Numero TD da inserire (default: 10000)");
    console.log("  --batch-size, -b  Batch insert size (default: 500)");
    console.log("  --no-truncate     Non svuotare td_store/td_matches prima del caricamento");
    console.log("  --help, -h        Mostra questo aiuto\n");
}

function validateOptions(options) {
    if (!Number.isInteger(options.count) || options.count <= 0) {
        throw new Error("count non valido: deve essere un intero > 0");
    }

    if (!Number.isInteger(options.batchSize) || options.batchSize <= 0) {
        throw new Error("batch-size non valido: deve essere un intero > 0");
    }
}

function pickType(index) {
    const weightedTypes = [
        "Sensor",
        "Sensor",
        "Sensor",
        "Sensor",
        "Actuator",
        "Actuator",
        "Gateway",
        "Meter",
        "Camera",
        "Thermostat",
    ];

    return weightedTypes[index % weightedTypes.length];
}

function buildTd(index) {
    const idNumber = index.toString().padStart(5, "0");
    const type = pickType(index);

    return {
        "@context": "https://www.w3.org/2019/wot/td/v1",
        "@type": type,
        title: `${type} Device ${idNumber}`,
        id: `urn:dev:zonia:${type.toLowerCase()}:${idNumber}`,
        description: `Synthetic ${type} generated for benchmark dataset`,
        properties: {
            status: {
                type: "string",
                enum: ["active", "inactive"],
                readOnly: true,
            },
            signal: {
                type: "number",
                unit: "percent",
                minimum: 0,
                maximum: 100,
                readOnly: true,
            },
        },
        actions:
            type === "Actuator"
                ? {
                    toggle: {
                        description: "Toggle actuator state",
                    },
                }
                : undefined,
    };
}

async function insertBatch(client, tds) {
    const placeholders = tds
        .map((_, index) => `($${index + 1}::jsonb)`)
        .join(",");

    const query = `INSERT INTO td_store (td) VALUES ${placeholders}`;
    const values = tds.map((td) => JSON.stringify(td));

    await client.query(query, values);
}

async function seedLargeTds() {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
        printHelp();
        return;
    }

    validateOptions(options);

    const client = await pool.connect();
    const typeCounters = new Map();

    try {
        console.log("\n Generazione dataset TD");
        console.log(`   count: ${options.count}`);
        console.log(`   batchSize: ${options.batchSize}`);
        console.log(`   truncate: ${options.truncate}\n`);

        await client.query("BEGIN");

        if (options.truncate) {
            await client.query("TRUNCATE TABLE td_matches, td_store RESTART IDENTITY");
            console.log(" Tabelle td_store e td_matches svuotate");
        }

        for (let start = 0; start < options.count; start += options.batchSize) {
            const endExclusive = Math.min(start + options.batchSize, options.count);
            const batch = [];

            for (let index = start; index < endExclusive; index += 1) {
                const td = buildTd(index + 1);
                batch.push(td);

                const type = td["@type"];
                const currentCount = typeCounters.get(type) || 0;
                typeCounters.set(type, currentCount + 1);
            }

            await insertBatch(client, batch);
            console.log(` Inserite TD ${start + 1}-${endExclusive}`);
        }

        await client.query("COMMIT");

        console.log("\n Seed completato");
        console.log(`   Totale TD inserite: ${options.count}`);
        for (const [type, count] of typeCounters.entries()) {
            console.log(`   - ${type}: ${count}`);
        }
        console.log("");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(`:-() Errore seed TD: ${error.message}`);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

if (require.main === module) {
    seedLargeTds().catch(() => {
        process.exit(1);
    });
}

module.exports = {
    seedLargeTds,
};
