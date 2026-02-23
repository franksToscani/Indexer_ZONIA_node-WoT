const { ethers } = require("ethers");
const config = require("../config");

function isValidAddress(value) {
    return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

async function getRegisteredDid() {
    const { rpcUrl, privateKey, indexerRegistryAddress } = config.blockchain;

    if (!rpcUrl || !privateKey || !indexerRegistryAddress) {
        throw new Error("Config mancante: RPC_URL, PRIVATE_KEY o INDEXER_REGISTRY_ADDRESS");
    }

    if (!isValidAddress(indexerRegistryAddress)) {
        throw new Error("INDEXER_REGISTRY_ADDRESS non valido. Inserisci un address reale (0x...)");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = await wallet.getAddress();

    const abi = [
        "event IndexerRegistered(string indexed did, address indexed indexer)"
    ];

    const registry = new ethers.Contract(indexerRegistryAddress, abi, provider);
    const filter = registry.filters.IndexerRegistered(null, walletAddress);

    const events = await registry.queryFilter(filter, 0, "latest");

    console.log(" Lookup DID registrato");
    console.log(`   Wallet: ${walletAddress}`);
    console.log(`   Registry: ${indexerRegistryAddress}`);

    if (events.length === 0) {
        console.log("\n Nessun evento IndexerRegistered trovato per questo wallet.");
        console.log("   Significa che probabilmente non sei ancora registrato on-chain.");
        return null;
    }

    const last = events[events.length - 1];
    const did = last.args.did;

    console.log("\n DID trovato:");
    console.log(`   DID: ${did}`);
    console.log(`   Block: ${last.blockNumber}`);
    console.log(`   Tx: ${last.transactionHash}`);

    return did;
}

if (require.main === module) {
    getRegisteredDid()
        .then(() => process.exit(0))
        .catch((error) => {
            const reason =
                error?.shortMessage ||
                error?.reason ||
                error?.info?.error?.message ||
                error?.message ||
                "Errore sconosciuto";
            console.error(":-() Errore lookup DID:", reason);
            process.exit(1);
        });
}

module.exports = { getRegisteredDid };
