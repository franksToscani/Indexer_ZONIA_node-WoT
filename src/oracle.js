const axios = require("axios");
const config = require("./config");

// Simuliamo una lista di requestId da testare
const requestIds = ["req-001", "req-002", "req-003", "req-004", "req-005"];

async function fetchMatches(requestId) {
    try {
        const url = `http://localhost:${config.http.port}/response/${requestId}`;
        const res = await axios.get(url);
        console.log(`Risultati per ${requestId}:`);
        console.dir(res.data, { depth: null });
        console.log("\n");
    } catch (err) {
        if (err.response && err.response.status === 404) {
            console.log(`Nessun match per ${requestId}`);
        } else {
            console.error(`Errore per ${requestId}:`, err.message);
        }
    }
}

async function runOracle() {
    for (const id of requestIds) {
        await fetchMatches(id);
    }
}

if (require.main === module) {
    runOracle();
}

module.exports = {
    runOracle,
};