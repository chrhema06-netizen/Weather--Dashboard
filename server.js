import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'data', 'db.json');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// In-memory caches for Weather and AQI data
const weatherCache = new Map();
const aqiCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache validation

// Helper: Ensure data directory exists
async function ensureDbExists() {
  try {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    try {
      await fs.access(DB_PATH);
    } catch {
      await fs.writeFile(DB_PATH, JSON.stringify([]));
    }
  } catch (err) {
    console.error('Error creating database folder:', err);
  }
}
ensureDbExists();

// Helper: Check location coordinates equivalence (2 decimal places)
function isSameLocation(lat1, lon1, lat2, lon2) {
  return Math.abs(parseFloat(lat1) - parseFloat(lat2)) < 0.05 && 
         Math.abs(parseFloat(lon1) - parseFloat(lon2)) < 0.05;
}

// ==========================================================================
// API ROUTES
// ==========================================================================

// 1. Weather API Proxy with Caching
app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Latitude and Longitude coordinates are required' });
  }

  const cacheKey = `${parseFloat(lat).toFixed(2)},${parseFloat(lon).toFixed(2)}`;
  const cached = weatherCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`[Cache Hit] Serving weather for coords ${cacheKey}`);
    return res.json(cached.data);
  }

  try {
    console.log(`[Cache Miss] Fetching weather from Open-Meteo for ${cacheKey}...`);
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,visibility&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,uv_index,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_probability_max&timezone=auto`;
    
    const response = await fetch(weatherUrl);
    if (!response.ok) throw new Error(`Open-Meteo Weather service error: ${response.status}`);
    
    const data = await response.json();
    
    // Save to Cache
    weatherCache.set(cacheKey, {
      timestamp: Date.now(),
      data: data
    });
    
    res.json(data);
  } catch (error) {
    console.error('Weather Proxy Error:', error);
    res.status(502).json({ error: 'Failed to retrieve weather forecast data' });
  }
});

// 2. AQI API Proxy with Caching
app.get('/api/aqi', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Latitude and Longitude coordinates are required' });
  }

  const cacheKey = `${parseFloat(lat).toFixed(2)},${parseFloat(lon).toFixed(2)}`;
  const cached = aqiCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`[Cache Hit] Serving AQI for coords ${cacheKey}`);
    return res.json(cached.data);
  }

  try {
    console.log(`[Cache Miss] Fetching AQI from Open-Meteo for ${cacheKey}...`);
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,us_aqi`;
    
    const response = await fetch(aqiUrl);
    if (!response.ok) throw new Error(`Open-Meteo AQI service error: ${response.status}`);
    
    const data = await response.json();
    
    // Save to Cache
    aqiCache.set(cacheKey, {
      timestamp: Date.now(),
      data: data
    });
    
    res.json(data);
  } catch (error) {
    console.error('AQI Proxy Error:', error);
    res.status(502).json({ error: 'Failed to retrieve air quality data' });
  }
});

// 3. Search Autocomplete Proxy
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Search query parameter is required' });
  }

  try {
    const searchUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
    const response = await fetch(searchUrl);
    if (!response.ok) throw new Error(`Open-Meteo Geocode service error: ${response.status}`);
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Search Proxy Error:', error);
    res.status(502).json({ error: 'Failed to search for locations' });
  }
});


// In-memory fallback database if filesystem is read-only
let memoryDb = [];

// 4. Saved Locations Database Routes
app.get('/api/locations', async (req, res) => {
  try {
    const data = await fs.readFile(DB_PATH, 'utf8');
    const locations = JSON.parse(data);
    res.json(locations);
  } catch (error) {
    console.warn('[DB Warning] Read DB failed, serving from memory:', error.message);
    res.json(memoryDb);
  }
});

app.post('/api/locations', async (req, res) => {
  const { name, lat, lon, temp, code } = req.body;
  if (!name || lat === undefined || lon === undefined) {
    return res.status(400).json({ error: 'Missing location params: name, lat, lon are required' });
  }

  try {
    let locations = [];
    try {
      const data = await fs.readFile(DB_PATH, 'utf8');
      locations = JSON.parse(data);
    } catch {
      locations = [...memoryDb];
    }
    
    const exists = locations.some(loc => isSameLocation(loc.lat, loc.lon, lat, lon));
    if (!exists) {
      locations.push({ name, lat, lon, temp, code });
      try {
        await fs.writeFile(DB_PATH, JSON.stringify(locations, null, 2));
        console.log(`[DB Write] Saved location: ${name}`);
      } catch (writeErr) {
        console.warn('[DB Warning] Write DB failed, saving in memory:', writeErr.message);
      }
      memoryDb = locations; // Sync in memory
    }
    
    res.json(locations);
  } catch (error) {
    console.error('Write DB error:', error);
    res.status(500).json({ error: 'Failed to save location' });
  }
});

app.delete('/api/locations', async (req, res) => {
  const { lat, lon } = req.query;
  if (lat === undefined || lon === undefined) {
    return res.status(400).json({ error: 'Missing coordinates: lat, lon are required to delete' });
  }

  try {
    let locations = [];
    try {
      const data = await fs.readFile(DB_PATH, 'utf8');
      locations = JSON.parse(data);
    } catch {
      locations = [...memoryDb];
    }
    
    const initialLength = locations.length;
    locations = locations.filter(loc => !isSameLocation(loc.lat, loc.lon, lat, lon));
    
    if (locations.length < initialLength) {
      try {
        await fs.writeFile(DB_PATH, JSON.stringify(locations, null, 2));
        console.log(`[DB Write] Removed location at coords: ${lat}, ${lon}`);
      } catch (writeErr) {
        console.warn('[DB Warning] Write DB failed, removing from memory:', writeErr.message);
      }
      memoryDb = locations; // Sync in memory
    }
    
    res.json(locations);
  } catch (error) {
    console.error('Delete DB error:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

// Serve static assets in production built by Vite
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback all request paths to index.html for SPA router
app.get('*', (req, res, next) => {
  // Check if request is an API call
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      // If index.html is missing (e.g., during development), just return 404
      res.status(404).send('Not Found');
    }
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` SkyFlow Backend active on port ${PORT}`);
    console.log(` Server mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`=========================================`);
  });
}

export default app;
