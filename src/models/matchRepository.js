const pool = require("../infrastructure/db");

async function findTdMatchesByRequestId(requestId, client = pool) {
    const { rows } = await client.query(
        `SELECT t.id, t.td
         FROM td_matches m
         JOIN td_store t ON m.td_id = t.id
         WHERE m.request_id = $1`,
        [requestId],
    );

    return rows;
}

async function findTdIdsByRequestId(requestId, client = pool) {
    const { rows } = await client.query(
        "SELECT td_id FROM td_matches WHERE request_id = $1",
        [requestId],
    );

    return rows.map((row) => row.td_id);
}

async function insertMatch(requestId, tdId, client = pool) {
    await client.query(
        "INSERT INTO td_matches (request_id, td_id) VALUES ($1, $2)",
        [requestId, tdId],
    );
}

module.exports = {
    findTdMatchesByRequestId,
    findTdIdsByRequestId,
    insertMatch,
};