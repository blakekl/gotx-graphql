import assert from 'node:assert/strict';
import { it } from 'node:test';
import { startTestContext, remainingContainer } from './synthetic-postgres.mjs';

void it('serves generic HTTP health and recovers after bounded saturation', async () => {
  const context = await startTestContext();
  try {
    const live = await context.app.inject({
      method: 'GET',
      url: '/health/live',
    });
    assert.equal(live.statusCode, 200);
    assert.deepEqual(live.json(), { status: 'ok' });
    const ready = await context.app.inject({
      method: 'GET',
      url: '/health/ready',
    });
    assert.equal(ready.statusCode, 200);
    assert.deepEqual(ready.json(), { status: 'ok' });
    const held = await context.applicationPool.connect();
    try {
      const started = Date.now();
      const response = await context.app.inject({
        method: 'GET',
        url: '/health/ready',
      });
      assert.equal(response.statusCode, 503);
      assert.ok(Date.now() - started < 1500, 'acquisition is bounded');
      assert.deepEqual(response.json(), { status: 'unavailable' });
      assert.equal(
        (await context.app.inject({ method: 'GET', url: '/health/live' }))
          .statusCode,
        200,
      );
    } finally {
      held.release();
    }
    assert.equal(
      (await context.app.inject({ method: 'GET', url: '/health/ready' }))
        .statusCode,
      200,
    );
  } finally {
    await context.close();
    assert.equal(remainingContainer(context.containerId), '');
  }
});
