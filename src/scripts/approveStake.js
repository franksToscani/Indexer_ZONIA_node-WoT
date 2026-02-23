require("dotenv").config();
const { ethers } = require("ethers");
const config = require("../config");

const erc20Abi = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function balanceOf(address owner) view returns (uint256)",
];

function normalizePrivateKey(privateKey) {
    if (!privateKey) {
        throw new Error("PRIVATE_KEY mancante nel file .env");
    }

    const trimmedKey = privateKey.trim();

    if (/^0x00[0-9a-fA-F]{64}$/.test(trimmedKey)) {
        console.warn(" PRIVATE_KEY contiene prefisso extra '00': normalizzato automaticamente.");
        return `0x${trimmedKey.slice(4)}`;
    }

    if (!/^0x[0-9a-fA-F]{64}$/.test(trimmedKey)) {
        throw new Error("PRIVATE_KEY non valida: deve essere una chiave esadecimale da 32 byte (formato 0x + 64 caratteri hex).");
    }

    return trimmedKey;
}

function parseArgs(args) {
    const parsed = {};

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];

        if (arg === "--help" || arg === "-h") {
            parsed.help = true;
            continue;
        }

        if ((arg === "--amount" || arg === "-a") && args[i + 1]) {
            parsed.amount = args[i + 1];
            i += 1;
            continue;
        }

        if ((arg === "--token" || arg === "-t") && args[i + 1]) {
            parsed.token = args[i + 1];
            i += 1;
        }
    }

    return parsed;
}

function printHelp() {
    console.log("\nUso:");
    console.log("  node src/scripts/approveStake.js [--amount <valore>] [--token <address>]\n");
    console.log("Opzioni:");
    console.log("  --amount, -a   Quantità token da approvare (default: STAKE_AMOUNT o 1000)");
    console.log("  --token, -t    Indirizzo token ZONIA (default: ZONIA_TOKEN_ADDRESS da .env)");
    console.log("  --help, -h     Mostra questo aiuto\n");
    console.log("Esempi:");
    console.log("  npm run stake:approve");
    console.log("  npm run stake:approve -- --amount 1000");
    console.log("  npm run stake:approve -- --token 0xabc... --amount 1000\n");
}

async function approveStake() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        printHelp();
        return;
    }

    const rpcUrl = config.blockchain.rpcUrl;
    const privateKey = normalizePrivateKey(config.blockchain.privateKey);
    const spender = config.blockchain.indexerRegistryAddress;
    const tokenAddress = args.token || process.env.ZONIA_TOKEN_ADDRESS;
    const amountInput = args.amount || process.env.STAKE_AMOUNT || "1000";

    if (!rpcUrl || !privateKey || !spender || !tokenAddress) {
        throw new Error(
            "Config mancante: assicurati di avere RPC_URL, PRIVATE_KEY, INDEXER_REGISTRY_ADDRESS e ZONIA_TOKEN_ADDRESS nel file .env"
        );
    }

    if (!ethers.isAddress(spender)) {
        throw new Error(`INDEXER_REGISTRY_ADDRESS non valido: ${spender}`);
    }

    if (!ethers.isAddress(tokenAddress)) {
        throw new Error(`ZONIA_TOKEN_ADDRESS non valido: ${tokenAddress}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    const tokenCode = await provider.getCode(tokenAddress);
    if (!tokenCode || tokenCode === "0x") {
        throw new Error(
            `ZONIA_TOKEN_ADDRESS non valido per questa rete: nessun contratto trovato a ${tokenAddress}. Verifica RPC_URL e indirizzo token deployato.`
        );
    }

    const token = new ethers.Contract(tokenAddress, erc20Abi, wallet);

    const [decimals, symbol] = await Promise.all([
        token.decimals().catch(() => 18),
        token.symbol().catch(() => "TOKEN"),
    ]);

    const amount = ethers.parseUnits(String(amountInput), Number(decimals));

    console.log("\n Approve stake token");
    console.log(`   Wallet: ${wallet.address}`);
    console.log(`   Token: ${tokenAddress} (${symbol})`);
    console.log(`   Spender (IndexerRegistry): ${spender}`);
    console.log(`   Importo: ${amountInput} ${symbol}`);

    let balance;
    let currentAllowance;

    try {
        [balance, currentAllowance] = await Promise.all([
            token.balanceOf(wallet.address),
            token.allowance(wallet.address, spender),
        ]);
    } catch (error) {
        const isBadData =
            error?.code === "BAD_DATA" ||
            (error?.message || "").includes("could not decode result data");

        if (isBadData) {
            throw new Error(
                `ZONIA_TOKEN_ADDRESS (${tokenAddress}) non sembra un contratto ERC20 compatibile (balanceOf/allowance non decodificabili). Verifica di non aver messo l'indirizzo di Gate/IndexerRegistry.`
            );
        }

        throw error;
    }

    console.log(`   Saldo wallet: ${ethers.formatUnits(balance, decimals)} ${symbol}`);
    console.log(
        `   Allowance attuale: ${ethers.formatUnits(currentAllowance, decimals)} ${symbol}`
    );

    if (currentAllowance >= amount) {
        console.log(" Allowance già sufficiente, nessuna transazione necessaria.\n");
        return;
    }

    if (balance < amount) {
        throw new Error(
            `Saldo insufficiente: richiesti ${amountInput} ${symbol}, disponibili ${ethers.formatUnits(balance, decimals)} ${symbol}`
        );
    }

    const tx = await token.approve(spender, amount, {
        gasLimit: config.blockchain.gasLimit,
    });

    console.log(`⛓️  TX inviata: ${tx.hash}`);
    const receipt = await tx.wait();

    const updatedAllowance = await token.allowance(wallet.address, spender);

    console.log(` Approve confermata in blocco ${receipt.blockNumber}`);
    console.log(
        `   Nuova allowance: ${ethers.formatUnits(updatedAllowance, decimals)} ${symbol}\n`
    );
}

if (require.main === module) {
    approveStake().catch((error) => {
        console.error(`:-() Errore approve stake: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { approveStake };
