import { app } from './app';
import { config } from './config';
import { closeDatabase, waitForDatabase } from './db';

async function start(): Promise<void> {
  await waitForDatabase();

  const server = app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
  });

  const shutdown = () => {
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void start();