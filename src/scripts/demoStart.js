const { approveStake } = require("./approveStake");
const { startListener } = require("./listener");

async function demoStart() {
    console.log(" Avvio demo ZONIA Indexer...");
    console.log("\n1) Verifica/approve stake token");
    await approveStake();

    console.log("2) Avvio listener");
    await startListener();
}

if (require.main === module) {
    demoStart().catch((error) => {
        console.error(`:-() Demo start fallita: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { demoStart };
