// functions/middleware/corsMiddleware.js


const cors = require('cors')({ origin: 'http://localhost:4321' });
module.exports = cors;
