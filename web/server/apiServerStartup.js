export function startApiServer(app, { port = 3001, logger = console, processRef = process } = {}) {
  const server = app.listen(port, (error) => {
    if (error) {
      logger.error('QuoteSuite API failed to start:', error);
      processRef.exitCode = 1;
      return;
    }

    const boundPort = server.address()?.port ?? port;
    logger.log(`QuoteSuite SQLite API running on http://localhost:${boundPort}`);
  });

  return server;
}
