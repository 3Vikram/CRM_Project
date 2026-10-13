process.env.JWT_SECRET = 'location-api-test-only-secret';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('node:path');
const test = require('node:test');
const locationRoutes = require('../routes/locationRoutes');
const { authMiddleware } = require('../middleware/authMiddleware');
const { db, dbPath } = require('../utils/salesDatabase');

test('Location API uses relational Sales SQLite data with stable lookup responses', async (t) => {
  const expectedDbPath = process.env.SALES_DB_PATH
    ? path.resolve(process.env.SALES_DB_PATH)
    : path.resolve(__dirname, '..', '..', '..', 'database', 'sales.db');
  assert.equal(dbPath, expectedDbPath);

  db.exec('SAVEPOINT location_api_test');
  const app = express();
  app.use('/api/locations', authMiddleware, locationRoutes);
  const server = app.listen(0);
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    db.exec('ROLLBACK TO location_api_test');
    db.exec('RELEASE location_api_test');
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}/api/locations`;
  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET);
  const request = (route, authToken = token) => fetch(`${baseUrl}${route}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
  const originalCountriesCount = db.prepare('SELECT COUNT(*) AS count FROM countries').get().count;

  assert.equal((await request('/countries', '')).status, 401);
  const countriesResponse = await request('/countries');
  assert.equal(countriesResponse.status, 200);
  const countries = await countriesResponse.json();
  assert.equal(countries.success, true);
  assert.ok(Array.isArray(countries.data));
  assert.ok(countries.data.every(({ name, code, isoCode }) => name && code && isoCode));

  const repeatedCountries = await (await request('/countries')).json();
  assert.deepEqual(repeatedCountries.data, countries.data);
  if (originalCountriesCount === 0) {
    assert.equal(countries.data.length, 8);
    assert.ok(countries.data.some((country) => country.name === 'India'));
  }

  const suffix = randomUUID().replaceAll('-', '');
  const ids = {
    country: `location-country-${suffix}`,
    state: `location-state-${suffix}`,
    city: `location-city-${suffix}`,
    area: `location-area-${suffix}`,
    pincode: `location-pincode-${suffix}`,
  };
  const countryName = `Location Test ${suffix}`;
  const stateName = `State Test ${suffix}`;
  const cityName = `City Test ${suffix}`;
  const areaName = `Area Test ${suffix}`;
  db.transaction(() => {
    db.prepare(`
      INSERT INTO countries (id, name, code, iso_code)
      VALUES (?, ?, ?, ?)
    `).run(ids.country, countryName, `LT${suffix.slice(0, 4)}`, `L${suffix.slice(0, 1)}`);
    db.prepare(`
      INSERT INTO states (id, country_id, name, code, country_code, country_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(ids.state, ids.country, stateName, `ST${suffix.slice(0, 3)}`, `L${suffix.slice(0, 1)}`, countryName);
    db.prepare(`
      INSERT INTO cities (id, state_id, name, state_code, state_name, country_code, country_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(ids.city, ids.state, cityName, `ST${suffix.slice(0, 3)}`, stateName, `L${suffix.slice(0, 1)}`, countryName);
    db.prepare(`
      INSERT INTO areas (id, city_id, name, city_name, state_name, country_name, pincode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(ids.area, ids.city, areaName, cityName, stateName, countryName, '12345');
    db.prepare(`
      INSERT INTO pincodes (id, area_id, city_id, code, pincode, area_name, city_name, state_name, country_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ids.pincode, ids.area, ids.city, '12345', '12345', areaName, cityName, stateName, countryName);
  }).immediate();

  const states = await (await request(`/states/${encodeURIComponent(countryName.replaceAll(' ', '-'))}`)).json();
  assert.equal(states.success, true);
  assert.deepEqual(states.data, [{ name: stateName, code: `ST${suffix.slice(0, 3)}`, countryName }]);

  const cities = await (await request(`/cities/${encodeURIComponent(stateName.replaceAll(' ', '-'))}`)).json();
  assert.equal(cities.success, true);
  assert.deepEqual(cities.data, [{ name: cityName, stateName }]);

  const areas = await (await request(`/areas/${encodeURIComponent(cityName.replaceAll(' ', '-'))}`)).json();
  assert.equal(areas.success, true);
  assert.deepEqual(areas.data, [{ name: areaName, cityName }]);

  const pincodes = await (await request(`/pincodes/${encodeURIComponent(areaName.replaceAll(' ', '-'))}`)).json();
  assert.equal(pincodes.success, true);
  assert.deepEqual(pincodes.data, [{ code: '12345', areaName }]);
});
