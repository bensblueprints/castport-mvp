const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 5329;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Castport running`);
  console.log(`  Admin panel : http://localhost:${PORT}/admin`);
  console.log(`  Example feed: http://localhost:${PORT}/feed/<show-slug>.xml`);
  if (!process.env.BASE_URL) {
    console.log(`  ! BASE_URL not set — using http://localhost:${PORT} in the RSS feed.`);
    console.log(`    Set BASE_URL to your real https:// domain before submitting to Apple/Spotify.`);
  }
});
