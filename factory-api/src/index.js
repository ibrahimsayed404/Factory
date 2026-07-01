require('dotenv').config();
const app = require('./app');
const { startAutoPayrollScheduler } = require('./services/autoPayrollScheduler');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Factory API running on http://localhost:${PORT}`);
  startAutoPayrollScheduler();
});
