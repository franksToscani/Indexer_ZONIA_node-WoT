const pool = require("../../infrastructure/db");

async function insertTd(td, client = pool) {
    const { rows } = await client.query(
        "INSERT INTO td_store (td) VALUES ($1) RETURNING id",
        [td],
    );

    return rows[0].id;
}

async function findTdIdsByTypes(types, client = pool) {
    if (!Array.isArray(types) || types.length === 0) {
        return [];
    }

    const { rows } = await client.query(
        `SELECT id
        FROM td_store
        WHERE (jsonb_typeof(td->'@type') = 'string' AND td->>'@type' = ANY($1::text[]))
        OR (jsonb_typeof(td->'@type') = 'array' AND td->'@type' ?| $1::text[])`,
        [types],
    );

    return rows.map((row) => row.id);
}

module.exports = {
    insertTd,
    findTdIdsByTypes,
};
