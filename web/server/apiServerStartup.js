export function formatApiStartupError(error, { port = 3001, environment = process.env.NODE_ENV } = {}) {
  if (error?.code === 'EADDRINUSE') {
    if (environment !== 'production') {
      return `QuoteSuite API could not start because port ${port} is already in use. An API or another process may already be running. Inspect the listener and verify its runtime health; QuoteSuite will not terminate it automatically.`;
    }
    return `QuoteSuite API could not bind to port ${port} because the address is already in use.`;
  }
  return `QuoteSuite API failed to start${error?.message ? `: ${error.message}` : '.'}`;
}

export function startApiServer(app, { port = 3001, logger = console, processRef = process, environment = process.env.NODE_ENV } = {}) {
  const server = app.listen(port);
  server.once('listening', () => {
    const boundPort = server.address()?.port ?? port;
    logger.log(`QuoteSuite SQLite API running on http://localhost:${boundPort}`);
  });
  server.once('error', (error) => {
    logger.error(formatApiStartupError(error, { port, environment }));
    processRef.exitCode = 1;
  });

  return server;
}
