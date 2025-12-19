const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const config = {
    http: {
        port: Number.parseInt(process.env.PORT ?? "3000", 10),
    },
    db: {
        connectionString: process.env.DATABASE_URL,
    },
    paths: {
        requests: process.env.REQUESTS_FILE
            ? path.resolve(process.env.REQUESTS_FILE)
            : path.join(__dirname, "..", "..", "..", "requests.json"),
        tdList: process.env.TD_LIST_FILE
            ? path.resolve(process.env.TD_LIST_FILE)
            : path.join(__dirname, "..", "..", "..", "tds", "td_list.json"),
    },
};

module.exports = config;
