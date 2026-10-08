const buildLogEntry = (event, meta = {}) => ({
  event,
  timestamp: new Date().toISOString(),
  ...meta,
});

const info = (event, meta = {}) => {
  console.log(JSON.stringify(buildLogEntry(event, meta)));
};

const error = (event, meta = {}) => {
  console.error(JSON.stringify(buildLogEntry(event, meta)));
};

module.exports = { info, error };
