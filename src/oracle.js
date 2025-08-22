const axios = require("axios");

// Simuliamo una lista di requestId da testare
const requestIds = ["req-001", "req-002", "req-003", "req-004"];

async function fetchMatches(requestId) {
    try {
        const res = await axios.get(`http://localhost:3000/response/${requestId}`);// Assumendo che il server sia in esecuzione sulla porta 3000
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

runOracle();
