const pool = require("../../infrastructure/db");

async function insertMatches(requestId, tds, client = pool) {
    if (!requestId || typeof requestId !== "string") {
        throw new Error("requestId deve essere una stringa valida");
    }

    if (!Array.isArray(tds) || tds.length === 0) {
        return 0;
    }

    const tdIds = tds.map((td) => String(td.id));

    const { rowCount } = await client.query(
        `INSERT INTO td_matches (request_id, td_id, matched_at)
         SELECT $1, unnest($2::uuid[]), NOW()
         ON CONFLICT (request_id, td_id) DO NOTHING`
        ,
        [requestId, tdIds]
    );

    return rowCount || 0;
}

async function findTdsByRequestId(requestId, client = pool) {
    if (!requestId || typeof requestId !== "string") {
        throw new Error("requestId deve essere una stringa valida");
    }

    const { rows } = await client.query(
        `SELECT s.id, s.td
         FROM td_matches m
         JOIN td_store s ON s.id = m.td_id
         WHERE m.request_id = $1
         ORDER BY m.matched_at ASC`,
        [requestId]
    );

    return rows;
}

module.exports = {
    insertMatches,
    findTdsByRequestId,
};
