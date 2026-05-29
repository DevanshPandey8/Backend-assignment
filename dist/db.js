"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
exports.transaction = transaction;
exports.closeDatabase = closeDatabase;
exports.waitForDatabase = waitForDatabase;
const pg_1 = require("pg");
const config_1 = require("./config");
exports.pool = new pg_1.Pool({
    connectionString: config_1.config.databaseUrl
});
async function query(text, values) {
    const result = await exports.pool.query(text, values);
    return result.rows;
}
async function transaction(runner) {
    const client = await exports.pool.connect();
    try {
        await client.query('BEGIN');
        const result = await runner(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function closeDatabase() {
    await exports.pool.end();
}
async function waitForDatabase(maxAttempts = 30, delayMilliseconds = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await exports.pool.query('SELECT 1');
            return;
        }
        catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, delayMilliseconds));
        }
    }
    throw lastError instanceof Error ? lastError : new Error('Database did not become ready in time');
}
//# sourceMappingURL=db.js.map