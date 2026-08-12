import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { startApiServer } from '../server/apiServerStartup.js';

const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
const listening = (server) => new Promise((resolve, reject) => {
  if (server.listening) return resolve();
  server.once('listening', resolve);
  server.once('error', reject);
});
const logger = () => {
  const messages = { log: [], error: [] };
  return {
    messages,
    value: {
      log: (...values) => messages.log.push(values),
      error: (...values) => messages.error.push(values),
    },
  };
};

test('successful API bind logs QuoteSuite startup success', async (t) => {
  const output = logger();
  const processRef = { exitCode: 0 };
  const server = startApiServer(express(), { port: 0, logger: output.value, processRef });
  t.after(() => close(server));
  await listening(server);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(output.messages.error.length, 0);
  assert.match(output.messages.log[0][0], /^QuoteSuite SQLite API running on http:\/\/localhost:\d+$/);
  assert.equal(processRef.exitCode, 0);
});

test('occupied port reports EADDRINUSE, suppresses success, exits non-zero and leaves listener intact', async (t) => {
  const owner = express().listen(0);
  t.after(() => close(owner));
  await listening(owner);
  const port = owner.address().port;
  const output = logger();
  const processRef = { exitCode: 0 };
  const contender = startApiServer(express(), { port, logger: output.value, processRef });
  await new Promise((resolve) => contender.once('error', resolve));

  assert.equal(output.messages.log.length, 0);
  assert.equal(output.messages.error[0][0], 'QuoteSuite API failed to start:');
  assert.equal(output.messages.error[0][1].code, 'EADDRINUSE');
  assert.equal(processRef.exitCode, 1);
  assert.equal(owner.listening, true);
  assert.equal(owner.address().port, port);
});
