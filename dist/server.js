"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const db_1 = require("./db");
async function start() {
    await (0, db_1.waitForDatabase)();
    const server = app_1.app.listen(config_1.config.port, () => {
        console.log(`Server listening on port ${config_1.config.port}`);
    });
    const shutdown = () => {
        server.close(async () => {
            await (0, db_1.closeDatabase)();
            process.exit(0);
        });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
void start();
//# sourceMappingURL=server.js.map