import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouteSnapshotSaver } from '../shared/routeSnapshotClient.js';

const draft = () => ({ direction: 'office_to_site', origin: { label: 'Base', lat: 51, lng: -1 }, destination: { label: 'Site', lat: 52, lng: -2 }, distanceKm: 100, durationMinutes: 90, integration: 'test' });
const receipt = (scenarioId, input) => ({ savedRouteSnapshotId: 'saved', routeSnapshots: [{ id: 'unrelated' }, { ...input, id: 'saved', scenarioId }] });

test('uses explicit receipt independently of ordering and preserves the draft key after uncertain response', async () => {
  const requests = []; let fail = true; let sequence = 0;
  const save = createRouteSnapshotSaver(async (id, input) => {
    requests.push(input);
    if (fail) { fail = false; throw new Error('Response lost after save'); }
    return receipt(id, input);
  }, () => `key-${++sequence}`);
  const input = draft();
  await assert.rejects(save('scenario', input), /Response lost/);
  assert.equal((await save('scenario', input)).savedRouteSnapshotId, 'saved');
  await save('scenario', input); // Profile save failed: repeat original draft, not a new route.
  assert.equal(new Set(requests.map(row => row.requestKey)).size, 1);
  await save('other-scenario', input);
  await save('scenario', draft());
  assert.equal(new Set(requests.map(row => row.requestKey)).size, 3);
  assert.equal(input.requestKey, undefined);
});

test('fails closed for absent, ambiguous, foreign or mismatched retained route', async () => {
  const mutations = [
    value => { delete value.savedRouteSnapshotId; },
    value => { value.routeSnapshots.push(value.routeSnapshots[1]); },
    value => { value.routeSnapshots[1].scenarioId = 'other'; },
    value => { value.routeSnapshots[1].direction = 'site_to_office'; },
    value => { value.routeSnapshots[1].origin = { label: 'Other base', lat: 51, lng: -1 }; },
    value => { value.routeSnapshots[1].durationMinutes = 999; },
    value => { value.routeSnapshots[1].integration = 'other'; },
  ];
  for (const mutate of mutations) {
    const save = createRouteSnapshotSaver(async (id, input) => { const value = receipt(id, input); mutate(value); return value; });
    await assert.rejects(save('scenario', draft()), /no route has been applied/);
  }
});

test('simultaneous submissions and caller-supplied identity remain stable', async () => {
  const keys = [];
  const save = createRouteSnapshotSaver(async (id, input) => { keys.push(input.requestKey); return receipt(id, input); });
  const input = { ...draft(), requestKey: 'reviewed-outward' };
  await Promise.all([save('scenario', input), save('scenario', input)]);
  assert.deepEqual(keys, ['reviewed-outward', 'reviewed-outward']);
});
