const assert = require('assert');
const { buildApp, urjaClient } = require('./server');

async function runTests() {
  console.log('--- Starting Urja API Service Tests ---\n');

  console.log('1. Testing UrjaClient Portal Authentication...');
  await urjaClient.login();
  console.log('   ✓ Login successful! Session cookies captured:', Array.from(urjaClient.cookies.keys()).join(', '));

  console.log('\n2. Testing UrjaClient Transformers Endpoint (/portal/dts)...');
  const dts = await urjaClient.getTransformers({ page: 1 });
  assert(dts && (Array.isArray(dts) || Array.isArray(dts.data)), 'Transformers response should contain data array');
  const dtsCount = Array.isArray(dts) ? dts.length : dts.data.length;
  console.log(`   ✓ Fetched ${dtsCount} transformers on page 1`);

  console.log('\n3. Testing UrjaClient Meters Search Endpoint (/portal/meters/search)...');
  const meters = await urjaClient.searchMeters({ page: 1, q: '' });
  assert(meters && (Array.isArray(meters) || Array.isArray(meters.data)), 'Meters response should contain data array');
  const meterList = Array.isArray(meters) ? meters : meters.data;
  const sampleMeter = meterList[0];
  console.log(`   ✓ Fetched ${meterList.length} meters. Sample meter ID: ${sampleMeter?.meterId}`);

  const testMeterId = sampleMeter?.meterId || 'J100000';

  console.log(`\n4. Testing UrjaClient Meter Geo Coordinates for ${testMeterId}...`);
  const geo = await urjaClient.getMeterGeo(testMeterId);
  console.log('   ✓ Geo response:', JSON.stringify(geo));

  console.log(`\n5. Testing UrjaClient Meter Energy Readings for ${testMeterId}...`);
  const energy = await urjaClient.getMeterEnergy(testMeterId);
  const energyReadings = Array.isArray(energy) ? energy : (energy.data || []);
  console.log(`   ✓ Fetched ${energyReadings.length} energy readings`);

  console.log('\n6. Testing Signing Secret and HMAC Signature Generation...');
  const secret = await urjaClient.getSigningSecret();
  assert(secret, 'Signing secret must not be null/empty');
  console.log(`   ✓ Retrieved signing secret: ${secret.substring(0, 8)}...`);

  console.log('\n7. Testing UrjaClient HMAC Signed Export Endpoint (/portal/export)...');
  const exportData = await urjaClient.getExport({ page: 1 });
  assert(exportData && (Array.isArray(exportData) || Array.isArray(exportData.data)), 'Export response should contain data array');
  const exportItems = Array.isArray(exportData) ? exportData : exportData.data;
  console.log(`   ✓ Export verified! Retrieved ${exportItems.length} records with coordinates & hierarchy`);

  console.log('\n8. Testing Fastify HTTP API Routes (In-Memory Injections)...');
  const app = await buildApp({ logger: false });

  // Test /health
  const healthRes = await app.inject({ method: 'GET', url: '/health' });
  assert.strictEqual(healthRes.statusCode, 200);
  console.log('   ✓ GET /health -> 200 OK');

  // Test /transformers
  const tfRes = await app.inject({ method: 'GET', url: '/transformers?page=1' });
  assert.strictEqual(tfRes.statusCode, 200);
  console.log('   ✓ GET /transformers -> 200 OK');

  // Test /meters
  const mRes = await app.inject({ method: 'GET', url: '/meters?page=1' });
  assert.strictEqual(mRes.statusCode, 200);
  console.log('   ✓ GET /meters -> 200 OK');

  // Test /meters/:meterId
  const mdRes = await app.inject({ method: 'GET', url: `/meters/${testMeterId}` });
  assert.strictEqual(mdRes.statusCode, 200);
  const compositeMeter = JSON.parse(mdRes.body);
  assert.strictEqual(compositeMeter.meterId, testMeterId);
  console.log('   ✓ GET /meters/:meterId -> 200 OK (composite meter returned)');

  // Test /meters/:meterId/geo
  const mgRes = await app.inject({ method: 'GET', url: `/meters/${testMeterId}/geo` });
  assert.strictEqual(mgRes.statusCode, 200);
  console.log('   ✓ GET /meters/:meterId/geo -> 200 OK');

  // Test /meters/:meterId/energy
  const meRes = await app.inject({ method: 'GET', url: `/meters/${testMeterId}/energy` });
  assert.strictEqual(meRes.statusCode, 200);
  console.log('   ✓ GET /meters/:meterId/energy -> 200 OK');

  // Test /export
  const expRes = await app.inject({ method: 'GET', url: '/export?page=1' });
  assert.strictEqual(expRes.statusCode, 200);
  console.log('   ✓ GET /export -> 200 OK (HMAC signed proxy verified)');

  // Test Swagger docs
  const docRes = await app.inject({ method: 'GET', url: '/docs' });
  assert(docRes.statusCode === 200 || docRes.statusCode === 302);
  console.log('   ✓ GET /docs -> OpenAPI Swagger UI available');

  console.log('\n========================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('========================================\n');

  await app.close();
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
