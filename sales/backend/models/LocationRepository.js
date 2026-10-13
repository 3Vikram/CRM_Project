const { randomUUID } = require('crypto');
const { db } = require('../utils/salesDatabase');

const sampleCountries = [
  { name: 'India', code: 'IND', isoCode: 'IN' },
  { name: 'United States', code: 'USA', isoCode: 'US' },
  { name: 'Australia', code: 'AUS', isoCode: 'AU' },
  { name: 'Canada', code: 'CAN', isoCode: 'CA' },
  { name: 'Germany', code: 'DEU', isoCode: 'DE' },
  { name: 'Japan', code: 'JPN', isoCode: 'JP' },
  { name: 'France', code: 'FRA', isoCode: 'FR' },
  { name: 'Singapore', code: 'SGP', isoCode: 'SG' },
];

const sampleStates = [
  { name: 'Karnataka', code: 'KA', countryCode: 'IN', countryName: 'India' },
  { name: 'Kerala', code: 'KL', countryCode: 'IN', countryName: 'India' },
  { name: 'Tamil Nadu', code: 'TN', countryCode: 'IN', countryName: 'India' },
  { name: 'Andhra Pradesh', code: 'AP', countryCode: 'IN', countryName: 'India' },
  { name: 'Telangana', code: 'TS', countryCode: 'IN', countryName: 'India' },
  { name: 'Maharashtra', code: 'MH', countryCode: 'IN', countryName: 'India' },
  { name: 'California', code: 'CA', countryCode: 'US', countryName: 'United States' },
  { name: 'Texas', code: 'TX', countryCode: 'US', countryName: 'United States' },
  { name: 'New York', code: 'NY', countryCode: 'US', countryName: 'United States' },
];

const sampleCities = [
  { name: 'Bangalore', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
  { name: 'Bangalore Rural', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
  { name: 'Bangalore Urban', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
  { name: 'Tumkur', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
  { name: 'Mysore', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
  { name: 'Hubli', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
  { name: 'Belgaum', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
  { name: 'Mangalore', stateCode: 'KA', stateName: 'Karnataka', countryCode: 'IN', countryName: 'India' },
  { name: 'Los Angeles', stateCode: 'CA', stateName: 'California', countryCode: 'US', countryName: 'United States' },
  { name: 'San Francisco', stateCode: 'CA', stateName: 'California', countryCode: 'US', countryName: 'United States' },
  { name: 'Austin', stateCode: 'TX', stateName: 'Texas', countryCode: 'US', countryName: 'United States' },
  { name: 'New York City', stateCode: 'NY', stateName: 'New York', countryCode: 'US', countryName: 'United States' },
];

const sampleAreas = [
  { name: 'Ittmadu', cityName: 'Bangalore', stateName: 'Karnataka', countryName: 'India', pincode: '560001' },
  { name: 'Indiranagar', cityName: 'Bangalore', stateName: 'Karnataka', countryName: 'India', pincode: '560038' },
  { name: 'Koramangala', cityName: 'Bangalore', stateName: 'Karnataka', countryName: 'India', pincode: '560034' },
  { name: 'Whitefield', cityName: 'Bangalore', stateName: 'Karnataka', countryName: 'India', pincode: '560066' },
  { name: 'Bangalore Rural Hub', cityName: 'Bangalore Rural', stateName: 'Karnataka', countryName: 'India', pincode: '562106' },
  { name: 'Bangalore Urban Hub', cityName: 'Bangalore Urban', stateName: 'Karnataka', countryName: 'India', pincode: '560001' },
  { name: 'Tumkur Main', cityName: 'Tumkur', stateName: 'Karnataka', countryName: 'India', pincode: '572101' },
  { name: 'Mysore Palace Road', cityName: 'Mysore', stateName: 'Karnataka', countryName: 'India', pincode: '570001' },
  { name: 'Downtown', cityName: 'Los Angeles', stateName: 'California', countryName: 'United States', pincode: '90001' },
  { name: 'Mission District', cityName: 'San Francisco', stateName: 'California', countryName: 'United States', pincode: '94105' },
  { name: 'South Congress', cityName: 'Austin', stateName: 'Texas', countryName: 'United States', pincode: '78704' },
  { name: 'Midtown', cityName: 'New York City', stateName: 'New York', countryName: 'United States', pincode: '10001' },
];

const insertCountry = db.prepare(`
  INSERT INTO countries (id, name, code, iso_code)
  VALUES (?, ?, ?, ?)
`);
const insertState = db.prepare(`
  INSERT INTO states (id, country_id, name, code, country_code, country_name)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const insertCity = db.prepare(`
  INSERT INTO cities (id, state_id, name, state_code, state_name, country_code, country_name)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertArea = db.prepare(`
  INSERT INTO areas (id, city_id, name, city_name, state_name, country_name, pincode)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertPincode = db.prepare(`
  INSERT INTO pincodes (id, area_id, city_id, code, pincode, area_name, city_name, state_name, country_name)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const findCountryId = db.prepare(`
  SELECT id FROM countries
  WHERE iso_code = ? COLLATE NOCASE OR code = ? COLLATE NOCASE
  ORDER BY CASE WHEN iso_code = ? COLLATE NOCASE THEN 0 ELSE 1 END
  LIMIT 1
`);
const findStateId = db.prepare(`
  SELECT id FROM states
  WHERE code = ? COLLATE NOCASE
    AND country_code = ? COLLATE NOCASE
  LIMIT 1
`);
const findCity = db.prepare(`
  SELECT id FROM cities
  WHERE name = ? COLLATE NOCASE
    AND state_name = ? COLLATE NOCASE
    AND country_name = ? COLLATE NOCASE
  LIMIT 1
`);

const seedLocations = db.transaction(() => {
  if (db.prepare('SELECT COUNT(*) AS count FROM countries').get().count === 0) {
    sampleCountries.forEach((country) => {
      insertCountry.run(randomUUID(), country.name, country.code, country.isoCode);
    });
  }

  if (db.prepare('SELECT COUNT(*) AS count FROM states').get().count === 0) {
    sampleStates.forEach((state) => {
      const country = findCountryId.get(state.countryCode, state.countryCode, state.countryCode);
      if (!country) throw new Error(`Cannot seed state "${state.name}" because its country is missing.`);
      insertState.run(randomUUID(), country.id, state.name, state.code, state.countryCode, state.countryName);
    });
  }

  if (db.prepare('SELECT COUNT(*) AS count FROM cities').get().count === 0) {
    sampleCities.forEach((city) => {
      const state = findStateId.get(city.stateCode, city.countryCode);
      if (!state) throw new Error(`Cannot seed city "${city.name}" because its state is missing.`);
      insertCity.run(
        randomUUID(),
        state.id,
        city.name,
        city.stateCode,
        city.stateName,
        city.countryCode,
        city.countryName,
      );
    });
  }

  if (db.prepare('SELECT COUNT(*) AS count FROM areas').get().count === 0) {
    sampleAreas.forEach((area) => {
      const city = findCity.get(area.cityName, area.stateName, area.countryName);
      if (!city) throw new Error(`Cannot seed area "${area.name}" because its city is missing.`);
      insertArea.run(
        randomUUID(),
        city.id,
        area.name,
        area.cityName,
        area.stateName,
        area.countryName,
        area.pincode,
      );
    });
  }

  if (db.prepare('SELECT COUNT(*) AS count FROM pincodes').get().count === 0) {
    const areas = db.prepare(`
      SELECT a.id AS area_id, a.city_id, a.name AS area_name, a.pincode AS code,
             a.city_name, a.state_name, a.country_name
      FROM areas a
      WHERE a.pincode <> ''
      ORDER BY a.name COLLATE NOCASE
    `).all();
    areas.forEach((area) => {
      insertPincode.run(
        randomUUID(),
        area.area_id,
        area.city_id,
        area.code,
        area.code,
        area.area_name,
        area.city_name,
        area.state_name,
        area.country_name,
      );
    });
  }
});

const searchTerm = (value) => String(value || '').trim();

const findCountries = () => db.prepare(`
  SELECT name, code, iso_code AS isoCode
  FROM countries
  ORDER BY name COLLATE NOCASE
`).all();

const findStatesByCountry = (country) => db.prepare(`
  SELECT s.name, s.code, COALESCE(NULLIF(s.country_name, ''), c.name) AS countryName
  FROM states s
  LEFT JOIN countries c ON c.id = s.country_id
  WHERE instr(lower(COALESCE(NULLIF(s.country_name, ''), c.name, '')), lower(?)) > 0
  ORDER BY s.name COLLATE NOCASE
`).all(searchTerm(country));

const findCitiesByState = (state) => db.prepare(`
  SELECT ci.name, COALESCE(NULLIF(ci.state_name, ''), s.name) AS stateName
  FROM cities ci
  LEFT JOIN states s ON s.id = ci.state_id
  WHERE instr(lower(COALESCE(NULLIF(ci.state_name, ''), s.name, '')), lower(?)) > 0
  ORDER BY ci.name COLLATE NOCASE
`).all(searchTerm(state));

const findAreasByCity = (city) => db.prepare(`
  SELECT a.name, COALESCE(NULLIF(a.city_name, ''), ci.name) AS cityName
  FROM areas a
  LEFT JOIN cities ci ON ci.id = a.city_id
  WHERE instr(lower(COALESCE(NULLIF(a.city_name, ''), ci.name, '')), lower(?)) > 0
  ORDER BY a.name COLLATE NOCASE
`).all(searchTerm(city));

const findPincodesByArea = (area) => db.prepare(`
  SELECT COALESCE(NULLIF(p.code, ''), p.pincode) AS code,
         COALESCE(NULLIF(p.area_name, ''), a.name) AS areaName
  FROM pincodes p
  LEFT JOIN areas a ON a.id = p.area_id
  WHERE instr(lower(COALESCE(NULLIF(p.area_name, ''), a.name, '')), lower(?)) > 0
  ORDER BY code
`).all(searchTerm(area));

module.exports = {
  seedLocations: () => seedLocations.immediate(),
  Country: { findAll: findCountries },
  State: { findByCountry: findStatesByCountry },
  City: { findByState: findCitiesByState },
  Area: { findByCity: findAreasByCity },
  Pincode: { findByArea: findPincodesByArea },
};
