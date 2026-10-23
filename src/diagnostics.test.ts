import test from 'node:test';
import assert from 'node:assert/strict';
import { describeFailure, requestTimeout } from './diagnostics.js';
import { createDemo } from './agent.js';

test('provider errors are distinct from actual deadline and never echo raw secrets', () => {
  assert.match(describeFailure('400 Unexpected message role. secret-example', false, 45000), /incompatible message role/);
  assert.match(describeFailure('401 secret-example', false, 45000), /authentication failed/);
  assert.match(describeFailure('opaque secret-example', true, 1000), /timed out after 1000/);
  assert.doesNotMatch(describeFailure('opaque secret-example', false, 45000), /secret-example/);
  assert.equal(requestTimeout(undefined), 45000);
  assert.equal(requestTimeout('90000'), 90000);
  assert.throws(() => requestTimeout('invalid'));
});

test('Groq Qwen uses system instructions rather than unsupported developer role', async () => {
  const previousProvider = process.env.PI_PROVIDER;
  const previousModel = process.env.PI_MODEL;
  process.env.PI_PROVIDER = 'groq';
  process.env.PI_MODEL = 'qwen/qwen3.8-27b';
  try {
    const { session } = await createDemo();
    try {
      const compat = session.model?.compat;
      assert.ok(compat && 'supportsDeveloperRole' in compat);
      assert.equal(compat.supportsDeveloperRole, false);
    }
    finally { session.dispose(); }
  } finally {
    if (previousProvider === undefined) delete process.env.PI_PROVIDER;
    else process.env.PI_PROVIDER = previousProvider;
    if (previousModel === undefined) delete process.env.PI_MODEL;
    else process.env.PI_MODEL = previousModel;
  }
});
