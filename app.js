import Chart from 'chart.js/auto';

// ==========================================================================
// APPLICATION STATE
// ==========================================================================
const state = {
  unit: localStorage.getItem('skyflow_unit') || 'C', // 'C' or 'F'
  currentCoords: null,
  currentCityName: '',
  weatherData: null,
  aqiData: null,
  savedLocations: [], // Loaded from backend DB on init
  chartInstance: null,
  debounceTimeout: null
};

// WMO Weather Interpretation Codes (WW) mapping
const weatherCodes = {
  0: { label: 'Clear Sky', class: 'clear-day', icon: 'clear-day' },
  1: { label: 'Mainly Clear', class: 'clear-day', icon: 'clear-day' },
  2: { label: 'Partly Cloudy', class: 'cloudy-day', icon: 'cloudy-day' },
  3: { label: 'Overcast', class: 'foggy', icon: 'overcast' },
  45: { label: 'Fog', class: 'foggy', icon: 'fog' },
  48: { label: 'Depositing Rime Fog', class: 'foggy', icon: 'fog' },
  51: { label: 'Light Drizzle', class: 'rainy', icon: 'drizzle' },
  53: { label: 'Moderate Drizzle', class: 'rainy', icon: 'drizzle' },
  55: { label: 'Dense Drizzle', class: 'rainy', icon: 'drizzle' },
  56: { label: 'Light Freezing Drizzle', class: 'rainy', icon: 'drizzle' },
  57: { label: 'Dense Freezing Drizzle', class: 'rainy', icon: 'drizzle' },
  61: { label: 'Slight Rain', class: 'rainy', icon: 'rain' },
  63: { label: 'Moderate Rain', class: 'rainy', icon: 'rain' },
  65: { label: 'Heavy Rain', class: 'rainy', icon: 'rain-heavy' },
  66: { label: 'Light Freezing Rain', class: 'rainy', icon: 'rain' },
  67: { label: 'Heavy Freezing Rain', class: 'rainy', icon: 'rain-heavy' },
  71: { label: 'Slight Snowfall', class: 'snowy', icon: 'snow' },
  73: { label: 'Moderate Snowfall', class: 'snowy', icon: 'snow' },
  75: { label: 'Heavy Snowfall', class: 'snowy', icon: 'snow-heavy' },
  77: { label: 'Snow Grains', class: 'snowy', icon: 'snow' },
  80: { label: 'Slight Rain Showers', class: 'rainy', icon: 'rain' },
  81: { label: 'Moderate Rain Showers', class: 'rainy', icon: 'rain' },
  82: { label: 'Violent Rain Showers', class: 'rainy', icon: 'rain-heavy' },
  85: { label: 'Slight Snow Showers', class: 'snowy', icon: 'snow' },
  86: { label: 'Heavy Snow Showers', class: 'snowy', icon: 'snow-heavy' },
  95: { label: 'Thunderstorm', class: 'stormy', icon: 'thunderstorm' },
  96: { label: 'Thunderstorm with Hail', class: 'stormy', icon: 'thunderstorm' },
  99: { label: 'Thunderstorm with Heavy Hail', class: 'stormy', icon: 'thunderstorm' }
};

// ==========================================================================
// DOM SELECTORS
// ==========================================================================
const els = {
  searchInput: document.getElementById('search-input'),
  autocompleteDropdown: document.getElementById('autocomplete-dropdown'),
  locateBtn: document.getElementById('locate-btn'),
  statusLocateBtn: document.getElementById('status-locate-btn'),
  unitC: document.getElementById('unit-c'),
  unitF: document.getElementById('unit-f'),
  dashboard: document.getElementById('weather-dashboard'),
  statusPanel: document.getElementById('status-panel'),
  statusTitle: document.getElementById('status-title'),
  statusDesc: document.getElementById('status-desc'),
  statusIcon: document.getElementById('status-icon'),
  currentDate: document.getElementById('current-date'),
  
  // Hero section
  locationName: document.getElementById('location-name'),
  saveLocationBtn: document.getElementById('save-location-btn'),
  heroTemp: document.getElementById('hero-temp'),
  heroCondition: document.getElementById('hero-condition'),
  heroHigh: document.getElementById('hero-high'),
  heroLow: document.getElementById('hero-low'),
  heroFeelsLike: document.getElementById('hero-feels-like'),
  heroIconContainer: document.getElementById('hero-icon-container'),
  
  // Metrics
  aqiValue: document.getElementById('aqi-value'),
  aqiStatus: document.getElementById('aqi-status'),
  aqiProgressBar: document.getElementById('aqi-progress-bar'),
  aqiPollutants: document.getElementById('aqi-pollutants'),
  
  windSpeed: document.getElementById('wind-speed'),
  windDirectionText: document.getElementById('wind-direction-text'),
  windGusts: document.getElementById('wind-gusts'),
  compassArrow: document.getElementById('compass-arrow'),
  
  uvValue: document.getElementById('uv-value'),
  uvLevel: document.getElementById('uv-level'),
  uvIndicator: document.getElementById('uv-indicator'),
  uvRecommendation: document.getElementById('uv-recommendation'),
  
  sunriseTime: document.getElementById('sunrise-time'),
  sunsetTime: document.getElementById('sunset-time'),
  sunProgressPath: document.getElementById('sun-progress-path'),
  sunMarker: document.getElementById('sun-marker'),
  
  humidityValue: document.getElementById('humidity-value'),
  humidityFill: document.getElementById('humidity-fill'),
  dewPoint: document.getElementById('dew-point'),
  
  pressureValue: document.getElementById('pressure-value'),
  pressureStatus: document.getElementById('pressure-status'),
  visibilityValue: document.getElementById('visibility-value'),
  visibilityStatus: document.getElementById('visibility-status'),
  
  // Forecast
  forecast7dayList: document.getElementById('forecast-7day-list'),
  tabChart: document.getElementById('tab-chart'),
  tabCards: document.getElementById('tab-cards'),
  hourlyChartView: document.getElementById('hourly-chart-view'),
  hourlyCardsView: document.getElementById('hourly-cards-view'),
  
  // Sidebar
  sidebar: document.getElementById('sidebar'),
  sidebarOpenBtn: document.getElementById('sidebar-open-btn'),
  sidebarCloseBtn: document.getElementById('sidebar-close-btn'),
  savedLocationsList: document.getElementById('saved-locations-list'),
  
  // Weather overlays
  effectOverlay: document.getElementById('weather-effect-overlay'),
  sidebarOverlay: document.getElementById('sidebar-overlay'),
  
  // Saved location UI additions
  sidebarSearchInput: document.getElementById('sidebar-search-input'),
  sidebarAutocomplete: document.getElementById('sidebar-autocomplete'),
  savedCountBadge: document.getElementById('saved-count-badge'),
  toastContainer: document.getElementById('toast-container')
};

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initDateTime();
  initEventListeners();
  
  // Fetch locations from backend database on startup
  await fetchSavedLocations();
  
  // Load last viewed location or locate user on startup
  const lastLocation = localStorage.getItem('skyflow_last_location');
  if (lastLocation) {
    const loc = JSON.parse(lastLocation);
    fetchWeatherForLocation(loc.lat, loc.lon, loc.name);
  } else {
    tryGeolocation(true); // silent = true
  }
});

// ==========================================================================
// DATE & TIME
// ==========================================================================
function initDateTime() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const today = new Date();
  els.currentDate.textContent = today.toLocaleDateString('en-US', options);
}

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================
function initEventListeners() {
  // Search with debounce
  els.searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(state.debounceTimeout);
    
    if (query.length < 2) {
      els.autocompleteDropdown.hidden = true;
      return;
    }
    
    state.debounceTimeout = setTimeout(() => {
      handleSearchAutocomplete(query);
    }, 300);
  });
  
  // Hide dropdown on blur
  document.addEventListener('click', (e) => {
    if (!els.searchInput.contains(e.target) && !els.autocompleteDropdown.contains(e.target)) {
      els.autocompleteDropdown.hidden = true;
    }
    if (els.sidebarSearchInput && els.sidebarAutocomplete && !els.sidebarSearchInput.contains(e.target) && !els.sidebarAutocomplete.contains(e.target)) {
      els.sidebarAutocomplete.hidden = true;
    }
  });

  // Sidebar Search with debounce
  if (els.sidebarSearchInput) {
    els.sidebarSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      clearTimeout(state.debounceTimeout);
      
      if (query.length < 2) {
        if (els.sidebarAutocomplete) els.sidebarAutocomplete.hidden = true;
        return;
      }
      
      state.debounceTimeout = setTimeout(() => {
        handleSidebarSearchAutocomplete(query);
      }, 300);
    });
  }
  
  // Geolocation Buttons
  els.locateBtn.addEventListener('click', () => tryGeolocation(false));
  els.statusLocateBtn.addEventListener('click', () => tryGeolocation(false));
  
  // Save Location Toggle
  els.saveLocationBtn.addEventListener('click', toggleSaveCurrentLocation);
  
  // Unit Toggles
  els.unitC.addEventListener('click', () => setTemperatureUnit('C'));
  els.unitF.addEventListener('click', () => setTemperatureUnit('F'));
  
  // Sidebar Toggle
  els.sidebarOpenBtn.addEventListener('click', () => {
    els.sidebar.classList.add('open');
    els.sidebarOverlay.classList.add('active');
  });
  els.sidebarCloseBtn.addEventListener('click', () => {
    els.sidebar.classList.remove('open');
    els.sidebarOverlay.classList.remove('active');
  });
  els.sidebarOverlay.addEventListener('click', () => {
    els.sidebar.classList.remove('open');
    els.sidebarOverlay.classList.remove('active');
  });
  
  // Hourly Forecast Tabs
  els.tabChart.addEventListener('click', () => toggleHourlyView('chart'));
  els.tabCards.addEventListener('click', () => toggleHourlyView('list'));
}

// ==========================================================================
// GEOLOCATION
// ==========================================================================
function tryGeolocation(silent = false) {
  if (!navigator.geolocation) {
    if (!silent) alert('Geolocation is not supported by your browser.');
    return;
  }
  
  if (silent) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        reverseGeocode(latitude, longitude);
      },
      null,
      { timeout: 5000 }
    );
    return;
  }
  
  showLoadingStatus('Locating you...', 'Requesting GPS coordinates to retrieve local weather forecasts.');
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      reverseGeocode(latitude, longitude);
    },
    (error) => {
      console.warn('Geolocation error:', error);
      showErrorStatus('Location Access Denied', 'We couldn\'t fetch your location. Please check your browser permissions or search for a city manually.');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

async function reverseGeocode(lat, lon) {
  try {
    // Reverse geocode via free Nominatim OSM
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`);
    if (!response.ok) throw new Error('Geocoding service error');
    
    const data = await response.json();
    const city = data.address.city || data.address.town || data.address.village || data.address.suburb || 'Current Location';
    const country = data.address.country ? `, ${data.address.country}` : '';
    
    fetchWeatherForLocation(lat, lon, `${city}${country}`);
  } catch (err) {
    console.error('Reverse geocode failed:', err);
    fetchWeatherForLocation(lat, lon, 'Current Location');
  }
}

// ==========================================================================
// BACKEND SEARCH & AUTOCOMPLETE
// ==========================================================================
async function handleSearchAutocomplete(query) {
  try {
    // Fetch via backend search endpoint
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search failed');
    
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      els.autocompleteDropdown.innerHTML = '<div class="suggestion-item"><span class="suggestion-name">No locations found</span></div>';
      els.autocompleteDropdown.hidden = false;
      return;
    }
    
    renderAutocompleteSuggestions(data.results);
  } catch (err) {
    console.error('Autocomplete backend error:', err);
  }
}

function renderAutocompleteSuggestions(results) {
  els.autocompleteDropdown.innerHTML = '';
  results.forEach(loc => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    
    const adminStr = loc.admin1 ? `${loc.admin1}, ` : '';
    const isSaved = state.savedLocations.some(sLoc => isSameLocation(sLoc.lat, sLoc.lon, loc.latitude, loc.longitude));
    
    item.innerHTML = `
      <div class="suggestion-main">
        <span class="suggestion-name">${loc.name}</span>
        <span class="suggestion-admin">${adminStr}${loc.country}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="suggestion-country">${loc.country_code ? loc.country_code.toUpperCase() : ''}</span>
        <button class="suggestion-quick-save ${isSaved ? 'saved' : ''}" title="${isSaved ? 'Remove from Saved' : 'Quick Save'}">
          <svg viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
      </div>
    `;
    
    item.addEventListener('click', () => {
      els.searchInput.value = '';
      els.autocompleteDropdown.hidden = true;
      fetchWeatherForLocation(loc.latitude, loc.longitude, `${loc.name}, ${loc.country}`);
    });
    
    const saveBtn = item.querySelector('.suggestion-quick-save');
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      quickSaveLocation(e, loc, 'suggestion-quick-save', 'saved');
    });
    
    els.autocompleteDropdown.appendChild(item);
  });
  
  els.autocompleteDropdown.hidden = false;
}

// ==========================================================================
// BACKEND WEATHER FETCH PIPELINE
// ==========================================================================
async function fetchWeatherForLocation(lat, lon, displayName) {
  showLoadingStatus(`Loading weather for ${displayName}...`, 'Querying backend server with cached weather payloads.');
  
  state.currentCoords = { lat, lon };
  state.currentCityName = displayName;
  
  localStorage.setItem('skyflow_last_location', JSON.stringify({ lat, lon, name: displayName }));
  
  try {
    // Query local backend proxy endpoints
    const [weatherRes, aqiRes] = await Promise.all([
      fetch(`/api/weather?lat=${lat}&lon=${lon}`),
      fetch(`/api/aqi?lat=${lat}&lon=${lon}`)
    ]);
    
    if (!weatherRes.ok || !aqiRes.ok) throw new Error('Failed to retrieve forecast data from backend.');
    
    state.weatherData = await weatherRes.json();
    state.aqiData = await aqiRes.json();
    
    renderDashboard();
    
  } catch (err) {
    console.error('Weather backend fetch error:', err);
    showErrorStatus('Unable to Fetch Weather', 'Failed to retrieve weather from backend. Ensure server is active and try again.');
  }
}

// ==========================================================================
// DASHBOARD RENDERING PIPELINE
// ==========================================================================
function renderDashboard() {
  if (!state.weatherData) return;
  
  els.statusPanel.style.display = 'none';
  els.dashboard.style.display = 'grid';
  
  const current = state.weatherData.current;
  const hourly = state.weatherData.hourly;
  const daily = state.weatherData.daily;
  const isDay = current.is_day === 1;
  const code = current.weather_code;
  
  applyThemeAndOverlays(code, isDay);
  
  els.locationName.textContent = state.currentCityName;
  const isSaved = state.savedLocations.some(loc => isSameLocation(loc.lat, loc.lon, state.currentCoords.lat, state.currentCoords.lon));
  if (isSaved) {
    els.saveLocationBtn.classList.add('saved');
  } else {
    els.saveLocationBtn.classList.remove('saved');
  }
  
  els.heroTemp.textContent = formatTemp(current.temperature_2m);
  
  const weatherMeta = getWeatherMeta(code, isDay);
  els.heroCondition.textContent = weatherMeta.label;
  
  els.heroHigh.textContent = formatTemp(daily.temperature_2m_max[0]);
  els.heroLow.textContent = formatTemp(daily.temperature_2m_min[0]);
  els.heroFeelsLike.textContent = formatTemp(current.apparent_temperature);
  
  els.heroIconContainer.innerHTML = generateWeatherIconSVG(weatherMeta.icon, true);
  
  renderAQICard();
  renderWindCard(current);
  renderUVCard(current, daily);
  renderSunCycleCard(daily);
  renderHumidityCard(current, hourly);
  renderPressureVisibilityCard(current);
  render7DayForecast();
  renderHourlyForecast();
}

// ==========================================================================
// METRICS CARD RENDERERS
// ==========================================================================
function renderAQICard() {
  if (!state.aqiData) return;
  const aqi = state.aqiData.current.us_aqi;
  const pollutants = state.aqiData.current;
  
  els.aqiValue.textContent = aqi;
  
  let label = 'Good';
  let color = 'var(--color-good)';
  let progressWidth = Math.min((aqi / 300) * 100, 100);
  
  if (aqi > 300) {
    label = 'Hazardous';
    color = 'var(--color-hazardous)';
  } else if (aqi > 200) {
    label = 'Very Unhealthy';
    color = 'var(--color-very-unhealthy)';
  } else if (aqi > 150) {
    label = 'Unhealthy';
    color = 'var(--color-unhealthy)';
  } else if (aqi > 100) {
    label = 'Unhealthy for Sensitive';
    color = 'var(--color-unhealthy-sensitive)';
  } else if (aqi > 50) {
    label = 'Moderate';
    color = 'var(--color-moderate)';
  }
  
  els.aqiStatus.textContent = label;
  els.aqiStatus.style.backgroundColor = color;
  els.aqiProgressBar.style.width = `${progressWidth}%`;
  els.aqiProgressBar.style.backgroundColor = color;
  
  els.aqiPollutants.innerHTML = `
    <div class="pollutant">
      <span class="name">PM2.5</span>
      <span class="val">${pollutants.pm2_5.toFixed(1)}</span>
    </div>
    <div class="pollutant">
      <span class="name">PM10</span>
      <span class="val">${pollutants.pm10.toFixed(1)}</span>
    </div>
    <div class="pollutant">
      <span class="name">NO₂</span>
      <span class="val">${pollutants.nitrogen_dioxide.toFixed(1)}</span>
    </div>
    <div class="pollutant">
      <span class="name">O₃</span>
      <span class="val">${pollutants.ozone.toFixed(1)}</span>
    </div>
  `;
}

function renderWindCard(current) {
  const speed = current.wind_speed_10m;
  const direction = current.wind_direction_10m;
  const gusts = current.wind_gusts_10m;
  
  els.windSpeed.textContent = `${speed.toFixed(1)} km/h`;
  els.windDirectionText.textContent = `Direction: ${getWindDirectionName(direction)} (${direction}°)`;
  els.windGusts.textContent = gusts ? `Gusts: ${gusts.toFixed(1)} km/h` : 'Gusts: None';
  els.compassArrow.style.transform = `translate(-50%, -50%) rotate(${direction}deg)`;
}

function renderUVCard(current, daily) {
  const now = new Date();
  const currentHourString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:00`;
  const timeIndex = state.weatherData.hourly.time.indexOf(currentHourString);
  
  const uvVal = timeIndex !== -1 ? state.weatherData.hourly.uv_index[timeIndex] : daily.uv_index_max[0];
  
  els.uvValue.textContent = uvVal.toFixed(1);
  
  let label = 'Low';
  let percentage = Math.min((uvVal / 11) * 100, 100);
  let rec = 'No protection needed. You can safely stay outside.';
  
  if (uvVal >= 11) {
    label = 'Extreme';
    rec = 'Take full precautions. Avoid sun between 10am and 4pm. SPF 30+, shirt, sunscreen, hat.';
  } else if (uvVal >= 8) {
    label = 'Very High';
    rec = 'Minimize sun exposure. Wear sunglasses, SPF 30+, wide-brimmed hat, and protective clothing.';
  } else if (uvVal >= 6) {
    label = 'High';
    rec = 'Reduce time in the sun. Sunscreen, shirt, sunglasses, and hat are essential.';
  } else if (uvVal >= 3) {
    label = 'Moderate';
    rec = 'Apply sunscreen if you stay outdoors. Seek shade during midday.';
  }
  
  els.uvLevel.textContent = label;
  els.uvIndicator.style.left = `${percentage}%`;
  els.uvRecommendation.textContent = rec;
}

function renderSunCycleCard(daily) {
  const sunriseStr = daily.sunrise[0];
  const sunsetStr = daily.sunset[0];
  
  const sunrise = new Date(sunriseStr);
  const sunset = new Date(sunsetStr);
  
  els.sunriseTime.textContent = formatClockTime(sunrise);
  els.sunsetTime.textContent = formatClockTime(sunset);
  
  const now = new Date();
  
  if (now >= sunrise && now <= sunset) {
    const totalDayTime = sunset - sunrise;
    const elapsed = now - sunrise;
    const progress = elapsed / totalDayTime;
    
    const startX = 5;
    const startY = 48;
    const rx = 45;
    const ry = 42;
    
    const theta = Math.PI - (progress * Math.PI);
    const currentX = 50 + rx * Math.cos(theta);
    const currentY = 48 - ry * Math.sin(theta);
    
    els.sunProgressPath.setAttribute('d', `M ${startX} ${startY} A ${rx} ${ry} 0 0 1 ${currentX} ${currentY}`);
    els.sunMarker.setAttribute('cx', currentX);
    els.sunMarker.setAttribute('cy', currentY);
    els.sunMarker.style.display = 'block';
  } else {
    els.sunProgressPath.setAttribute('d', `M 5 48 A 45 42 0 0 1 5 48`);
    els.sunMarker.style.display = 'none';
  }
}

function renderHumidityCard(current, hourly) {
  const humidity = current.relative_humidity_2m;
  els.humidityValue.textContent = `${humidity}%`;
  els.humidityFill.style.height = `${humidity}%`;
  
  const t = current.temperature_2m;
  const rh = humidity;
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * t) / (b + t)) + Math.log(rh / 100.0);
  const dp = (b * alpha) / (a - alpha);
  
  els.dewPoint.textContent = `Dew point is ${formatTemp(dp)}`;
}

function renderPressureVisibilityCard(current) {
  const pressure = current.pressure_msl;
  const vis = current.visibility / 1000;
  
  els.pressureValue.textContent = `${pressure.toFixed(0)} hPa`;
  els.visibilityValue.textContent = `${vis.toFixed(1)} km`;
  
  if (pressure > 1022) {
    els.pressureStatus.textContent = 'High pressure (Stable)';
  } else if (pressure < 1009) {
    els.pressureStatus.textContent = 'Low pressure (Stormy)';
  } else {
    els.pressureStatus.textContent = 'Normal pressure';
  }
  
  if (vis >= 10) {
    els.visibilityStatus.textContent = 'Perfectly clear sky';
  } else if (vis >= 5) {
    els.visibilityStatus.textContent = 'Good visibility';
  } else if (vis >= 2) {
    els.visibilityStatus.textContent = 'Haze or light mist';
  } else {
    els.visibilityStatus.textContent = 'Dense fog / warning';
  }
}

// ==========================================================================
// 7-DAY FORECAST RENDERER
// ==========================================================================
function render7DayForecast() {
  const daily = state.weatherData.daily;
  els.forecast7dayList.innerHTML = '';
  
  const weekMin = Math.min(...daily.temperature_2m_min);
  const weekMax = Math.max(...daily.temperature_2m_max);
  const totalWeekRange = weekMax - weekMin;
  
  for (let i = 0; i < 7; i++) {
    const time = new Date(daily.time[i]);
    const maxTemp = daily.temperature_2m_max[i];
    const minTemp = daily.temperature_2m_min[i];
    const code = daily.weather_code[i];
    const precipProb = daily.precipitation_probability_max[i];
    
    let dayLabel = time.toLocaleDateString('en-US', { weekday: 'short' });
    if (i === 0) dayLabel = 'Today';
    
    const row = document.createElement('div');
    row.className = 'forecast-row';
    
    const leftPercent = ((minTemp - weekMin) / totalWeekRange) * 100;
    const rightPercent = ((maxTemp - weekMin) / totalWeekRange) * 100;
    const widthPercent = rightPercent - leftPercent;
    
    let bandClass = 'temp-band-cool';
    if (maxTemp > 30) bandClass = 'temp-band-hot';
    else if (maxTemp > 20) bandClass = 'temp-band-warm';
    else if (maxTemp < 10) bandClass = 'temp-band-cold';
    
    const iconMeta = getWeatherMeta(code, true);
    
    row.innerHTML = `
      <span class="forecast-day">${dayLabel}</span>
      <div class="forecast-row-icon" title="${iconMeta.label}">
        ${generateWeatherIconSVG(iconMeta.icon, false)}
      </div>
      <span class="forecast-pop" ${precipProb > 0 ? '' : 'style="opacity: 0;"'}>💧${precipProb}%</span>
      <div class="forecast-temp-bar-container">
        <div class="forecast-temp-bar-fill ${bandClass}" style="left: ${leftPercent}%; width: ${widthPercent}%;"></div>
      </div>
      <div class="forecast-temps">
        <span class="forecast-temp-min">${formatTempRaw(minTemp)}°</span>
        <span class="forecast-temp-max">${formatTempRaw(maxTemp)}°</span>
      </div>
    `;
    
    els.forecast7dayList.appendChild(row);
  }
}

// ==========================================================================
// HOURLY FORECAST
// ==========================================================================
function renderHourlyForecast() {
  const hourly = state.weatherData.hourly;
  
  const now = new Date();
  const currentHourStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:00`;
  let startIndex = hourly.time.indexOf(currentHourStr);
  if (startIndex === -1) startIndex = 0;
  
  const subsetHours = hourly.time.slice(startIndex, startIndex + 24);
  const subsetTemps = hourly.temperature_2m.slice(startIndex, startIndex + 24);
  const subsetCodes = hourly.weather_code.slice(startIndex, startIndex + 24);
  const subsetPop = hourly.precipitation_probability.slice(startIndex, startIndex + 24);
  
  const labels = subsetHours.map((h, idx) => {
    if (idx === 0) return 'Now';
    const dateObj = new Date(h);
    const hour = dateObj.getHours();
    return hour === 0 ? '12 AM' : hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`;
  });
  
  els.hourlyCardsView.innerHTML = '';
  for (let i = 0; i < 24; i++) {
    const card = document.createElement('div');
    card.className = 'hourly-card';
    
    const iconMeta = getWeatherMeta(subsetCodes[i], true);
    
    card.innerHTML = `
      <span class="hourly-time">${labels[i]}</span>
      <div class="hourly-icon" title="${iconMeta.label}">
        ${generateWeatherIconSVG(iconMeta.icon, false)}
      </div>
      <span class="hourly-temp">${formatTemp(subsetTemps[i])}</span>
      <span class="hourly-pop" ${subsetPop[i] > 0 ? '' : 'style="opacity: 0;"'}>💧${subsetPop[i]}%</span>
    `;
    els.hourlyCardsView.appendChild(card);
  }
  
  if (state.chartInstance) {
    state.chartInstance.destroy();
  }
  
  const ctx = document.getElementById('hourlyChart').getContext('2d');
  const gradientFill = ctx.createLinearGradient(0, 0, 0, 180);
  gradientFill.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
  gradientFill.addColorStop(1, 'rgba(255, 255, 255, 0.01)');
  
  const chartData = subsetTemps.map(t => formatTempRaw(t));
  
  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: chartData,
        borderColor: '#ffffff',
        borderWidth: 2.5,
        backgroundColor: gradientFill,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#ffffff',
        pointHoverBackgroundColor: 'var(--accent-color)',
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 18,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(18, 25, 38, 0.85)',
          titleFont: { family: 'Inter', size: 12, weight: '600' },
          bodyFont: { family: 'Outfit', size: 14, weight: '700' },
          padding: 12,
          cornerRadius: 12,
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return `${context.parsed.y}°${state.unit}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: 'rgba(255, 255, 255, 0.65)',
            font: { family: 'Inter', size: 11 },
            maxTicksLimit: 8
          },
          border: { display: false }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.06)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.65)',
            font: { family: 'Outfit', size: 11 },
            callback: function(value) {
              return value + '°';
            }
          },
          border: { display: false }
        }
      }
    }
  });
}

function toggleHourlyView(type) {
  if (type === 'chart') {
    els.tabChart.classList.add('active');
    els.tabCards.classList.remove('active');
    els.hourlyChartView.hidden = false;
    els.hourlyCardsView.hidden = true;
  } else {
    els.tabChart.classList.remove('active');
    els.tabCards.classList.add('active');
    els.hourlyChartView.hidden = true;
    els.hourlyCardsView.hidden = false;
  }
}

// ==========================================================================
// BACKEND SAVED LOCATIONS PIPELINE (DATABASE ASYNC SYNCING)
// ==========================================================================
async function fetchSavedLocations() {
  try {
    const res = await fetch('/api/locations');
    if (res.ok) {
      state.savedLocations = await res.json();
      localStorage.setItem('skyflow_saved_locations', JSON.stringify(state.savedLocations));
      renderSavedLocations();
    } else {
      throw new Error('Server returned non-ok status');
    }
  } catch (err) {
    console.warn('Error fetching saved locations from backend database, loading from localStorage fallback:', err);
    const stored = localStorage.getItem('skyflow_saved_locations');
    if (stored) {
      state.savedLocations = JSON.parse(stored);
      renderSavedLocations();
    }
  }
}

async function toggleSaveCurrentLocation() {
  if (!state.currentCoords || !state.currentCityName) return;
  
  const isSaved = state.savedLocations.some(loc => isSameLocation(loc.lat, loc.lon, state.currentCoords.lat, state.currentCoords.lon));
  
  try {
    let res;
    if (isSaved) {
      // DELETE
      try {
        res = await fetch(`/api/locations?lat=${state.currentCoords.lat}&lon=${state.currentCoords.lon}`, {
          method: 'DELETE'
        });
      } catch (err) {
        console.warn('Backend delete failed, falling back to local storage', err);
      }
      
      if (res && res.ok) {
        state.savedLocations = await res.json();
      } else {
        // Fallback
        state.savedLocations = state.savedLocations.filter(loc => !isSameLocation(loc.lat, loc.lon, state.currentCoords.lat, state.currentCoords.lon));
      }
      
      els.saveLocationBtn.classList.remove('saved');
      showToast('Location Removed', `${state.currentCityName} was removed from saved locations.`, 'info');
    } else {
      // POST
      try {
        res = await fetch('/api/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: state.currentCityName,
            lat: state.currentCoords.lat,
            lon: state.currentCoords.lon,
            temp: state.weatherData.current.temperature_2m,
            code: state.weatherData.current.weather_code
          })
        });
      } catch (err) {
        console.warn('Backend save failed, falling back to local storage', err);
      }
      
      if (res && res.ok) {
        state.savedLocations = await res.json();
      } else {
        // Fallback
        const exists = state.savedLocations.some(loc => isSameLocation(loc.lat, loc.lon, state.currentCoords.lat, state.currentCoords.lon));
        if (!exists) {
          state.savedLocations.push({
            name: state.currentCityName,
            lat: state.currentCoords.lat,
            lon: state.currentCoords.lon,
            temp: state.weatherData.current.temperature_2m,
            code: state.weatherData.current.weather_code
          });
        }
      }
      
      els.saveLocationBtn.classList.add('saved');
      showToast('Location Saved', `${state.currentCityName} was added to saved locations.`, 'success');
    }
    
    localStorage.setItem('skyflow_saved_locations', JSON.stringify(state.savedLocations));
    renderSavedLocations();
  } catch (err) {
    console.error('Failed to sync location save changes:', err);
    showToast('Operation Failed', 'Could not update saved locations.', 'error');
  }
}

async function deleteSavedLocation(e, lat, lon) {
  if (e && e.stopPropagation) e.stopPropagation(); // prevent opening location weather details
  
  const targetLoc = state.savedLocations.find(loc => isSameLocation(loc.lat, loc.lon, lat, lon));
  const locName = targetLoc ? targetLoc.name : 'Location';
  
  try {
    let res;
    try {
      res = await fetch(`/api/locations?lat=${lat}&lon=${lon}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('Backend delete failed, falling back to local storage', err);
    }
    
    if (res && res.ok) {
      state.savedLocations = await res.json();
    } else {
      // Fallback
      state.savedLocations = state.savedLocations.filter(loc => !isSameLocation(loc.lat, loc.lon, lat, lon));
    }
    
    localStorage.setItem('skyflow_saved_locations', JSON.stringify(state.savedLocations));
    renderSavedLocations();
    
    // Update heart icon if deleting current location
    if (state.currentCoords && isSameLocation(state.currentCoords.lat, state.currentCoords.lon, lat, lon)) {
      els.saveLocationBtn.classList.remove('saved');
    }
    
    showToast('Location Removed', `${locName} was removed from saved locations.`, 'info');
  } catch (err) {
    console.error('Failed to delete saved location:', err);
    showToast('Delete Failed', `Could not delete ${locName}.`, 'error');
  }
}

async function renderSavedLocations() {
  els.savedLocationsList.innerHTML = '';
  
  // Update count badge
  if (els.savedCountBadge) {
    els.savedCountBadge.textContent = state.savedLocations.length;
    els.savedCountBadge.style.display = state.savedLocations.length > 0 ? 'inline-flex' : 'none';
  }
  
  if (state.savedLocations.length === 0) {
    els.savedLocationsList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 48px; height: 48px; margin-bottom: 15px; opacity: 0.4;">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
        <p>No saved locations yet.</p>
        <p style="font-size: 0.75rem; margin-top: 5px; opacity: 0.6;">Search for cities and tap the heart icon to save them for quick access here.</p>
      </div>
    `;
    return;
  }
  
  state.savedLocations.forEach(async (loc) => {
    const item = document.createElement('div');
    item.className = 'saved-location-item';
    
    const iconMeta = getWeatherMeta(loc.code, true);
    const commaIndex = loc.name.indexOf(',');
    const cityName = commaIndex !== -1 ? loc.name.substring(0, commaIndex) : loc.name;
    const countryName = commaIndex !== -1 ? loc.name.substring(commaIndex + 1).trim() : '';
    
    item.innerHTML = `
      <div class="saved-location-info">
        <span class="saved-location-name">${cityName}</span>
        <span class="saved-location-desc">${countryName || iconMeta.label}</span>
      </div>
      <div class="saved-location-weather">
        <span class="saved-location-temp">${formatTemp(loc.temp)}</span>
        <div class="saved-location-icon" title="${iconMeta.label}">
          ${generateWeatherIconSVG(iconMeta.icon, false)}
        </div>
        <button class="delete-saved-btn" title="Remove Location">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
    
    item.addEventListener('click', () => {
      els.sidebar.classList.remove('open');
      els.sidebarOverlay.classList.remove('active');
      fetchWeatherForLocation(loc.lat, loc.lon, loc.name);
    });
    
    const delBtn = item.querySelector('.delete-saved-btn');
    delBtn.addEventListener('click', (e) => deleteSavedLocation(e, loc.lat, loc.lon));
    
    els.savedLocationsList.appendChild(item);
    
    // Asynchronously refresh the cached saved location temperatures
    try {
      const res = await fetch(`/api/weather?lat=${loc.lat}&lon=${loc.lon}`);
      if (res.ok) {
        const freshData = await res.json();
        const freshTemp = freshData.current.temperature_2m;
        const freshCode = freshData.current.weather_code;
        
        // Update database with fresh measurements silently
        if (freshTemp !== loc.temp || freshCode !== loc.code) {
          loc.temp = freshTemp;
          loc.code = freshCode;
          
          try {
            await fetch('/api/locations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(loc)
            });
          } catch (e) {
            // Silently swallow backend failures
          }
          localStorage.setItem('skyflow_saved_locations', JSON.stringify(state.savedLocations));
        }
        
        // Refresh local UI cards
        const tempEl = item.querySelector('.saved-location-temp');
        const iconEl = item.querySelector('.saved-location-icon');
        const descEl = item.querySelector('.saved-location-desc');
        
        const freshIconMeta = getWeatherMeta(loc.code, true);
        tempEl.textContent = formatTemp(loc.temp);
        iconEl.innerHTML = generateWeatherIconSVG(freshIconMeta.icon, false);
        if (!countryName) descEl.textContent = freshIconMeta.label;
      }
    } catch (e) {
      console.warn('Silent refresh failed for saved item:', loc.name);
    }
  });
}

// ==========================================================================
// TEMPERATURE UNIT UTILITIES
// ==========================================================================
function setTemperatureUnit(unit) {
  if (state.unit === unit) return;
  state.unit = unit;
  localStorage.setItem('skyflow_unit', unit);
  
  if (unit === 'C') {
    els.unitC.classList.add('active');
    els.unitF.classList.remove('active');
  } else {
    els.unitC.classList.remove('active');
    els.unitF.classList.add('active');
  }
  
  renderDashboard();
}

function formatTemp(celsius) {
  return `${formatTempRaw(celsius)}°`;
}

function formatTempRaw(celsius) {
  if (state.unit === 'F') {
    return Math.round((celsius * 9) / 5 + 32);
  }
  return Math.round(celsius);
}

// ==========================================================================
// THEME AND WEATHER EFFECTS ENGINE
// ==========================================================================
function applyThemeAndOverlays(code, isDay) {
  const meta = getWeatherMeta(code, isDay);
  
  document.body.className = '';
  document.body.classList.add(`theme-${meta.class}`);
  
  els.effectOverlay.innerHTML = '';
  
  if (meta.class === 'rainy' || meta.class === 'stormy') {
    createRainParticles();
  } else if (meta.class === 'snowy') {
    createSnowParticles();
  } else if (meta.class === 'stormy') {
    createRainParticles();
    createLightningFlashes();
  } else if (meta.class === 'clear-day') {
    const sunRays = document.createElement('div');
    sunRays.className = 'sun-rays';
    els.effectOverlay.appendChild(sunRays);
  }
}

function createRainParticles() {
  const overlay = els.effectOverlay;
  const count = 30;
  
  for (let i = 0; i < count; i++) {
    const drop = document.createElement('div');
    drop.className = 'rain-drop';
    drop.style.left = `${Math.random() * 100}vw`;
    drop.style.top = `${Math.random() * -10}vh`;
    drop.style.animationDelay = `${Math.random() * 1.5}s`;
    drop.style.animationDuration = `${0.6 + Math.random() * 0.5}s`;
    overlay.appendChild(drop);
  }
}

function createSnowParticles() {
  const overlay = els.effectOverlay;
  const count = 40;
  
  for (let i = 0; i < count; i++) {
    const flake = document.createElement('div');
    flake.className = 'snow-flake';
    const size = 2 + Math.random() * 5;
    flake.style.width = `${size}px`;
    flake.style.height = `${size}px`;
    flake.style.left = `${Math.random() * 100}vw`;
    flake.style.top = `${Math.random() * -5}vh`;
    flake.style.opacity = `${0.4 + Math.random() * 0.6}`;
    
    flake.style.animation = `rain ${2.5 + Math.random() * 2}s linear infinite`;
    flake.style.animationDelay = `${Math.random() * 3}s`;
    overlay.appendChild(flake);
  }
}

function createLightningFlashes() {
  const overlay = els.effectOverlay;
  const flash = document.createElement('div');
  flash.className = 'lightning-flash';
  overlay.appendChild(flash);
}

// ==========================================================================
// HELPERS
// ==========================================================================
function isSameLocation(lat1, lon1, lat2, lon2) {
  return Math.abs(parseFloat(lat1) - parseFloat(lat2)) < 0.05 && 
         Math.abs(parseFloat(lon1) - parseFloat(lon2)) < 0.05;
}

function getWeatherMeta(code, isDay) {
  const meta = weatherCodes[code];
  if (!meta) return { label: 'Unknown', class: 'clear-day', icon: 'clear-day' };
  
  let themeClass = meta.class;
  let iconName = meta.icon;
  
  if (themeClass === 'clear-day' && !isDay) {
    themeClass = 'clear-night';
    iconName = 'clear-night';
  } else if (themeClass === 'cloudy-day' && !isDay) {
    themeClass = 'cloudy-night';
    iconName = 'cloudy-night';
  }
  
  return {
    label: meta.label,
    class: themeClass,
    icon: iconName
  };
}

function getWindDirectionName(degree) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degree / 22.5) % 16;
  return directions[index];
}

function formatClockTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ==========================================================================
// STATUS PANEL
// ==========================================================================
function showLoadingStatus(title, desc) {
  els.dashboard.style.display = 'none';
  els.statusPanel.style.display = 'flex';
  els.statusTitle.textContent = title;
  els.statusDesc.textContent = desc;
  
  els.statusIcon.className = 'status-icon-wrapper loading';
  els.statusIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 42px; height: 42px;">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M12 6v6l4 2"></path>
    </svg>
  `;
}

function showErrorStatus(title, desc) {
  els.dashboard.style.display = 'none';
  els.statusPanel.style.display = 'flex';
  els.statusTitle.textContent = title;
  els.statusDesc.textContent = desc;
  
  els.statusIcon.className = 'status-icon-wrapper error';
  els.statusIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 42px; height: 42px;">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  `;
}

// ==========================================================================
// DYNAMIC SVG WEATHER ICONS
// ==========================================================================
function generateWeatherIconSVG(iconName, isLarge = false) {
  const styleClass = isLarge ? 'svg-float' : '';
  
  switch (iconName) {
    case 'clear-day':
      return `
        <svg class="${styleClass}" viewBox="0 0 100 100" fill="none">
          <circle class="svg-pulse" cx="50" cy="50" r="22" fill="#FFD54F" filter="drop-shadow(0 0 10px rgba(255, 213, 79, 0.8))"/>
          <g class="svg-spin-slow" stroke="#FFD54F" stroke-width="6" stroke-linecap="round">
            <line x1="50" y1="12" x2="50" y2="22" />
            <line x1="50" y1="78" x2="50" y2="88" />
            <line x1="12" y1="50" x2="22" y2="50" />
            <line x1="78" y1="50" x2="88" y2="50" />
            <line x1="23" y1="23" x2="31" y2="31" />
            <line x1="69" y1="69" x2="77" y2="77" />
            <line x1="23" y1="77" x2="31" y2="69" />
            <line x1="69" y1="31" x2="77" y2="23" />
          </g>
        </svg>
      `;
      
    case 'clear-night':
      return `
        <svg class="${styleClass}" viewBox="0 0 100 100" fill="none">
          <path class="svg-pulse" d="M48 20 A30 30 0 1 0 80 52 A22 22 0 1 1 48 20 Z" fill="#9575CD" filter="drop-shadow(0 0 12px rgba(142, 45, 226, 0.6))"/>
          <circle class="svg-pulse" cx="24" cy="28" r="1.5" fill="#FFF" style="animation-delay: 0.5s"/>
          <circle class="svg-pulse" cx="76" cy="20" r="2" fill="#FFF" style="animation-delay: 1.2s"/>
          <circle class="svg-pulse" cx="64" cy="80" r="1.5" fill="#FFF" style="animation-delay: 0.8s"/>
        </svg>
      `;
      
    case 'cloudy-day':
      return `
        <svg class="${styleClass}" viewBox="0 0 100 100" fill="none">
          <circle class="svg-spin-slow" cx="60" cy="38" r="15" fill="#FFB300"/>
          <path d="M30 66 H66 A18 18 0 0 0 66 30 A18 18 0 0 0 53 36 A22 22 0 0 0 30 66 Z" fill="rgba(255, 255, 255, 0.7)" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.15))"/>
        </svg>
      `;
      
    case 'cloudy-night':
      return `
        <svg class="${styleClass}" viewBox="0 0 100 100" fill="none">
          <path d="M56 26 A20 20 0 1 0 78 48 A14 14 0 1 1 56 26 Z" fill="#7E57C2" style="opacity: 0.8"/>
          <path d="M30 66 H66 A18 18 0 0 0 66 30 A18 18 0 0 0 53 36 A22 22 0 0 0 30 66 Z" fill="rgba(255, 255, 255, 0.6)" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.2))"/>
        </svg>
      `;
      
    case 'overcast':
      return `
        <svg class="${styleClass}" viewBox="0 0 100 100" fill="none">
          <path d="M45 54 H73 A14 14 0 0 0 73 26 A14 14 0 0 0 62 31 A18 18 0 0 0 45 54 Z" fill="rgba(255, 255, 255, 0.45)" style="opacity: 0.8; transform: translate(-8px, -8px);"/>
          <path d="M30 66 H66 A18 18 0 0 0 66 30 A18 18 0 0 0 53 36 A22 22 0 0 0 30 66 Z" fill="rgba(255, 255, 255, 0.8)" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.15))"/>
        </svg>
      `;
      
    case 'fog':
      return `
        <svg class="${styleClass}" viewBox="0 0 100 100" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="5" stroke-linecap="round">
          <line class="svg-pulse" x1="25" y1="35" x2="75" y2="35" style="animation-delay: 0.2s" />
          <line class="svg-pulse" x1="18" y1="48" x2="82" y2="48" style="animation-delay: 0.6s" />
          <line class="svg-pulse" x1="28" y1="61" x2="72" y2="61" style="animation-delay: 1.0s" />
          <line class="svg-pulse" x1="38" y1="74" x2="62" y2="74" style="animation-delay: 1.4s" />
        </svg>
      `;
      
    case 'drizzle':
      return `
        <svg class="${styleClass}" viewBox="0 0 100 100" fill="none">
          <path d="M30 60 H66 A18 18 0 0 0 66 24 A18 18 0 0 0 53 30 A22 22 0 0 0 30 60 Z" fill="rgba(255, 255, 255, 0.75)"/>
          <g stroke="#90CAF9" stroke-width="4" stroke-linecap="round">
            <line x1="38" y1="72" x2="34" y2="80" class="svg-pulse" />
            <line x1="50" y1="72" x2="46" y2="80" class="svg-pulse" style="animation-delay: 0.4s" />
            <line x1="62" y1="72" x2="58" y2="80" class="svg-pulse" style="animation-delay: 0.8s" />
          </g>
        </svg>
      `;
      
    case 'rain':
      return `
        <svg class="${styleClass}" viewBox="0 0 100 100" fill="none">
          <path d="M30 58 H66 A18 18 0 0 0 66 22 A18 18 0 0 0 53 28 A22 22 0 0 0 30 58 Z" fill="rgba(255, 255, 255, 0.75)" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))"/>
          <g stroke="#42A5F5" stroke-width="4.5" stroke-linecap="round">
            <line x1="35" y1="70" x2="29" y2="82" class="svg-pulse" />
            <line x1="48" y1="70" x2="42" y2="82" class="svg-pulse" style="animation-delay: 0.3s" />
            <line x1="61" y1="70" x2="55" y2="82" class="svg-pulse" style="animation-delay: 0.6s" />
          </g>
        </svg>
      `;
      
    case 'rain-heavy':
      return `
        <svg class="${styleClass}" viewBox="0 0 100 100" fill="none">
          <path d="M45 48 H73 A14 14 0 0 0 73 20 A14 14 0 0 0 62 25 A18 18 0 0 0 45 48 Z" fill="rgba(100, 116, 139, 0.6)" style="transform: translate(-6px, -4px)"/>
          <path d="M30 58 H66 A18 18 0 0 0 66 22 A18 18 0 0 0 53 28 A22 22 0 0 0 30 58 Z" fill="rgba(255, 255, 255, 0.8)"/>
          <g stroke="#1E88E5" stroke-width="5" stroke-linecap="round">
            <line x1="34" y1="68" x2="26" y2="84" class="svg-pulse" />
            <line x1="47" y1="68" x2="39" y2="84" class="svg-pulse" style="animation-delay: 0.2s" />
            <line x1="60" y1="68" x2="52" y2="84" class="svg-pulse" style="animation-delay: 0.4s" />
          </g>
        </svg>
      `;
      
    case 'snow':
      return `
        <svg class="${styleClass}" viewBox="0 0 100 100" fill="none">
          <path d="M30 58 H66 A18 18 0 0 0 66 22 A18 18 0 0 0 53 28 A22 22 0 0 0 30 58 Z" fill="rgba(255, 255, 255, 0.8)"/>
          <g fill="#E0F7FA">
            <circle cx="34" cy="72" r="3.5" class="svg-pulse" />
            <circle cx="50" cy="74" r="3" class="svg-pulse" style="animation-delay: 0.5s" />
            <circle cx="62" cy="71" r="3.5" class="svg-pulse" style="animation-delay: 1s" />
          </g>
        </svg>
      `;
      
    case 'snow-heavy':
      return `
        <svg class="${styleClass}" viewBox="0 0 100 100" fill="none">
          <path d="M45 48 H73 A14 14 0 0 0 73 20 A14 14 0 0 0 62 25 A18 18 0 0 0 45 48 Z" fill="rgba(200, 220, 240, 0.5)" style="transform: translate(-6px, -4px)"/>
          <path d="M30 58 H66 A18 18 0 0 0 66 22 A18 18 0 0 0 53 28 A22 22 0 0 0 30 58 Z" fill="rgba(255, 255, 255, 0.85)"/>
          <g fill="#ffffff">
            <circle cx="33" cy="70" r="4" class="svg-pulse" />
            <circle cx="49" cy="76" r="4.5" class="svg-pulse" style="animation-delay: 0.3s" />
            <circle cx="63" cy="71" r="4" class="svg-pulse" style="animation-delay: 0.6s" />
            <circle cx="41" cy="85" r="3.5" class="svg-pulse" style="animation-delay: 0.9s" />
            <circle cx="56" cy="86" r="3.5" class="svg-pulse" style="animation-delay: 1.2s" />
          </g>
        </svg>
      `;
      
    case 'thunderstorm':
      return `
        <svg class="${styleClass}" viewBox="0 0 100 100" fill="none">
          <path d="M42 46 H70 A14 14 0 0 0 70 18 A14 14 0 0 0 59 23 A18 18 0 0 0 42 46 Z" fill="rgba(100, 116, 139, 0.5)" style="transform: translate(-4px, -4px)"/>
          <path d="M28 56 H64 A18 18 0 0 0 64 20 A18 18 0 0 0 51 26 A22 22 0 0 0 28 56 Z" fill="rgba(120, 130, 150, 0.85)"/>
          <polygon class="svg-pulse" points="47 54, 34 72, 44 72, 38 92, 58 68, 48 68" fill="#FFD54F" filter="drop-shadow(0 0 8px rgba(255, 213, 79, 0.9))"/>
        </svg>
      `;
      
    default:
      return `
        <svg class="${styleClass}" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="20" fill="#FFB300"/>
          <path d="M30 66 H66 A18 18 0 0 0 66 30 A18 18 0 0 0 53 36 A22 22 0 0 0 30 66 Z" fill="rgba(255, 255, 255, 0.7)"/>
        </svg>
      `;
  }
}

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================
function showToast(title, message, type = 'info') {
  if (!els.toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#00e676" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#ff3d00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  } else {
    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }
  
  toast.innerHTML = `
    <div class="toast-icon ${type}">
      ${iconSvg}
    </div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" title="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  });
  
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
  
  els.toastContainer.appendChild(toast);
}

// ==========================================================================
// SIDEBAR SEARCH & AUTOCOMPLETE
// ==========================================================================
async function handleSidebarSearchAutocomplete(query) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Sidebar search failed');
    
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      els.sidebarAutocomplete.innerHTML = '<div class="sidebar-suggestion-item"><span class="sidebar-suggestion-name">No locations found</span></div>';
      els.sidebarAutocomplete.hidden = false;
      return;
    }
    
    renderSidebarAutocompleteSuggestions(data.results);
  } catch (err) {
    console.error('Sidebar autocomplete error:', err);
  }
}

function renderSidebarAutocompleteSuggestions(results) {
  els.sidebarAutocomplete.innerHTML = '';
  results.forEach(loc => {
    const item = document.createElement('div');
    item.className = 'sidebar-suggestion-item';
    
    const adminStr = loc.admin1 ? `${loc.admin1}, ` : '';
    const isSaved = state.savedLocations.some(sLoc => isSameLocation(sLoc.lat, sLoc.lon, loc.latitude, loc.longitude));
    
    item.innerHTML = `
      <div class="sidebar-suggestion-info">
        <span class="sidebar-suggestion-name">${loc.name}</span>
        <span class="sidebar-suggestion-sub">${adminStr}${loc.country}</span>
      </div>
      <button class="quick-save-btn ${isSaved ? 'already-saved' : ''}" title="${isSaved ? 'Remove' : 'Quick Save'}">
        <svg viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      </button>
    `;
    
    item.addEventListener('click', () => {
      els.sidebarSearchInput.value = '';
      els.sidebarAutocomplete.hidden = true;
      els.sidebar.classList.remove('open');
      els.sidebarOverlay.classList.remove('active');
      fetchWeatherForLocation(loc.latitude, loc.longitude, `${loc.name}, ${loc.country}`);
    });
    
    const saveBtn = item.querySelector('.quick-save-btn');
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      quickSaveLocation(e, loc, 'quick-save-btn', 'already-saved');
    });
    
    els.sidebarAutocomplete.appendChild(item);
  });
  
  els.sidebarAutocomplete.hidden = false;
}

// ==========================================================================
// QUICK-SAVE HANDLER
// ==========================================================================
async function quickSaveLocation(e, loc, btnClass, activeClass) {
  const btn = e.currentTarget;
  const isCurrentlySaved = btn.classList.contains(activeClass);
  const lat = loc.latitude || loc.lat;
  const lon = loc.longitude || loc.lon;
  const name = loc.name + (loc.country ? `, ${loc.country}` : '');

  if (isCurrentlySaved) {
    btn.classList.remove(activeClass);
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', 'none');
    
    const index = state.savedLocations.findIndex(sLoc => isSameLocation(sLoc.lat, sLoc.lon, lat, lon));
    if (index !== -1) {
      const mockEvent = { stopPropagation: () => {} };
      await deleteSavedLocation(mockEvent, lat, lon);
    }
  } else {
    showToast('Saving Location', `Fetching current weather for ${loc.name}...`, 'info');
    
    try {
      const weatherUrl = `/api/weather?lat=${lat}&lon=${lon}`;
      const response = await fetch(weatherUrl);
      if (!response.ok) throw new Error('Failed to fetch weather data');
      const weatherData = await response.json();
      
      const tempVal = weatherData.current.temperature_2m;
      const weatherCode = weatherData.current.weather_code;
      
      let res;
      try {
        res = await fetch('/api/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name,
            lat: lat,
            lon: lon,
            temp: tempVal,
            code: weatherCode
          })
        });
      } catch (err) {
        console.warn('Backend save failed in quickSave, using localStorage fallback', err);
      }
      
      if (res && res.ok) {
        state.savedLocations = await res.json();
      } else {
        const exists = state.savedLocations.some(sLoc => isSameLocation(sLoc.lat, sLoc.lon, lat, lon));
        if (!exists) {
          state.savedLocations.push({ name, lat, lon, temp: tempVal, code: weatherCode });
        }
      }
      
      localStorage.setItem('skyflow_saved_locations', JSON.stringify(state.savedLocations));
      renderSavedLocations();
      
      btn.classList.add(activeClass);
      const svg = btn.querySelector('svg');
      if (svg) svg.setAttribute('fill', 'currentColor');
      
      if (state.currentCoords && isSameLocation(state.currentCoords.lat, state.currentCoords.lon, lat, lon)) {
        els.saveLocationBtn.classList.add('saved');
      }
      
      showToast('Location Saved', `${loc.name} has been added to your list.`, 'success');
    } catch (err) {
      console.error('Quick save error:', err);
      showToast('Save Failed', `Could not save location ${loc.name}.`, 'error');
    }
  }
}
