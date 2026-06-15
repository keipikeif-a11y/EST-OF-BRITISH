const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoicGF2YW4ta3VtYXIxMyIsImEiOiJjbXFicGFkeHcwanlvMnNxeWV4Z2EzNjVpIn0.Lek-itBM7CFxIe6K7Btm8g";
const DATA_FILE = "EST_OF_BRITISH_ArcGIS_Ready.csv?v=4";

const state = {
  events: [],
  currentYear: 1849,
  mode: "cumulative",
  playing: false,
  playTimer: null,
};

const elements = {
  selectedYear: document.getElementById("selected-year"),
  yearRange: document.getElementById("year-range"),
  yearSlider: document.getElementById("year-slider"),
  visibleCount: document.getElementById("visible-count"),
  eventList: document.getElementById("event-list"),
  playToggle: document.getElementById("play-toggle"),
  stepBack: document.getElementById("step-back"),
  stepForward: document.getElementById("step-forward"),
  setupWarning: document.getElementById("setup-warning"),
  appMessage: document.getElementById("app-message"),
  modeButtons: document.querySelectorAll("[data-mode]"),
};

if (!MAPBOX_ACCESS_TOKEN || MAPBOX_ACCESS_TOKEN.includes("PASTE_YOUR_MAPBOX_ACCESS_TOKEN_HERE")) {
  elements.setupWarning.hidden = false;
} else {
  startMap();
}

function startMap() {
  mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v12",
    center: [78.9629, 22.5937],
    zoom: 4,
    projection: "mercator",
  });

  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

  map.on("load", async () => {
    try {
      state.events = await loadEvents();

      if (!state.events.length) {
        showMessage("No usable rows were found in the CSV.");
        return;
      }

      setupYearSlider();
      addTimelineLayers(map);
      attachEvents(map);
      updateMap(map);
      fitMapToEvents(map);
    } catch (error) {
      console.error(error);
      showMessage(
        "The CSV could not load. Open this folder with a local server, for example VS Code Live Server."
      );
    }
  });
}

async function loadEvents() {
  const response = await fetch(DATA_FILE);

  if (!response.ok) {
    throw new Error(`Could not load ${DATA_FILE}`);
  }

  const csvText = await response.text();
  const rows = parseCsv(csvText);

  return rows
    .map((row, index) => {
      const yearRange = parseYearRange(row.Year);
      const latitude = parseCoordinate(row.Latitude);
      const longitude = parseCoordinate(row.Longitude);

      if (!yearRange || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        console.warn("Skipped row with missing map data", index + 2, row);
        return null;
      }

      return {
        id: index + 1,
        yearLabel: cleanText(row.Year),
        startYear: yearRange.start,
        endYear: yearRange.end,
        title: cleanText(row.War_Name) || "Untitled event",
        category: cleanText(row.Category) || "Historical Event",
        treaty: cleanText(row.Treaty_Event),
        people: cleanText(row.People_Involved),
        description: cleanText(row.Description),
        coordinates: [longitude, latitude],
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startYear - b.startYear || a.endYear - b.endYear);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row);
  }

  const headers = rows.shift().map((header) => header.trim());

  return rows.map((cells) =>
    headers.reduce((record, header, index) => {
      record[header] = cells[index] || "";
      return record;
    }, {})
  );
}

function parseYearRange(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{3,4})(?:\s*-\s*(\d{2,4}))?/);

  if (!match) {
    return null;
  }

  const start = Number(match[1]);
  let end = match[2] ? Number(match[2]) : start;

  if (match[2] && match[2].length === 2) {
    const century = Math.floor(start / 100) * 100;
    end = century + end;

    if (end < start) {
      end += 100;
    }
  }

  return { start, end };
}

function parseCoordinate(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return NaN;
  }

  const decimal = Number(raw);
  if (Number.isFinite(decimal)) {
    return decimal;
  }

  const coordinateParts = raw.replace(/[^\d.+\- degreesº°¡'"]/gi, "").split(/[º°¡]/);
  const degrees = Number(coordinateParts[0]);
  const minutes = Number((coordinateParts[1] || "").replace(/[^\d.+\-]/g, "")) || 0;

  if (!Number.isFinite(degrees)) {
    return NaN;
  }

  const sign = degrees < 0 ? -1 : 1;
  return sign * (Math.abs(degrees) + minutes / 60);
}

function cleanText(value) {
  return String(value || "")
    .replace(/Ð/g, "-")
    .replace(/Ñ/g, "-")
    .replace(/Ê/g, " ")
    .replace(/Õ/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function setupYearSlider() {
  const minYear = Math.min(...state.events.map((event) => event.startYear));
  const maxYear = Math.max(...state.events.map((event) => event.endYear));

  state.currentYear = maxYear;
  elements.yearSlider.min = minYear;
  elements.yearSlider.max = maxYear;
  elements.yearSlider.value = maxYear;
  elements.yearRange.textContent = `${minYear} to ${maxYear}`;
}

function addTimelineLayers(map) {
  map.addSource("timeline-events", {
    type: "geojson",
    data: createGeoJson(state.events),
  });

  map.addLayer({
    id: "event-point-halo",
    type: "circle",
    source: "timeline-events",
    paint: {
      "circle-radius": 12,
      "circle-color": "#ffffff",
      "circle-opacity": 0.78,
      "circle-blur": 0.15,
    },
  });

  map.addLayer({
    id: "event-points",
    type: "circle",
    source: "timeline-events",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 5.5, 7, 10],
      "circle-color": [
        "interpolate",
        ["linear"],
        ["get", "startYear"],
        1746,
        "#a05022",
        1800,
        "#246455",
        1850,
        "#303f9f",
      ],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });

  map.addLayer({
    id: "event-labels",
    type: "symbol",
    source: "timeline-events",
    layout: {
      "text-field": ["get", "yearLabel"],
      "text-size": 11,
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
      "text-offset": [0, 1.35],
      "text-anchor": "top",
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#17211c",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.4,
    },
  });
}

function attachEvents(map) {
  elements.yearSlider.addEventListener("input", () => {
    state.currentYear = Number(elements.yearSlider.value);
    updateMap(map);
  });

  elements.stepBack.addEventListener("click", () => {
    stopPlaying();
    stepYear(map, -1);
  });

  elements.stepForward.addEventListener("click", () => {
    stopPlaying();
    stepYear(map, 1);
  });

  elements.playToggle.addEventListener("click", () => {
    state.playing ? stopPlaying() : startPlaying(map);
  });

  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      elements.modeButtons.forEach((modeButton) => {
        modeButton.classList.toggle("active", modeButton === button);
      });
      updateMap(map);
    });
  });

  map.on("click", "event-points", (event) => {
    const feature = event.features[0];
    const coordinates = feature.geometry.coordinates.slice();

    new mapboxgl.Popup({ offset: 16 })
      .setLngLat(coordinates)
      .setHTML(createPopupHtml(feature.properties))
      .addTo(map);
  });

  map.on("mouseenter", "event-points", () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "event-points", () => {
    map.getCanvas().style.cursor = "";
  });
}

function stepYear(map, amount) {
  const minYear = Number(elements.yearSlider.min);
  const maxYear = Number(elements.yearSlider.max);
  const nextYear = Math.min(maxYear, Math.max(minYear, state.currentYear + amount));

  state.currentYear = nextYear;
  elements.yearSlider.value = nextYear;
  updateMap(map);
}

function startPlaying(map) {
  state.playing = true;
  elements.playToggle.innerHTML = "&#10074;&#10074;";
  elements.playToggle.title = "Pause";

  state.playTimer = window.setInterval(() => {
    const maxYear = Number(elements.yearSlider.max);

    if (state.currentYear >= maxYear) {
      state.currentYear = Number(elements.yearSlider.min);
    } else {
      state.currentYear += 1;
    }

    elements.yearSlider.value = state.currentYear;
    updateMap(map);
  }, 650);
}

function stopPlaying() {
  state.playing = false;
  window.clearInterval(state.playTimer);
  elements.playToggle.innerHTML = "&#9654;";
  elements.playToggle.title = "Play";
}

function updateMap(map) {
  const filter =
    state.mode === "active"
      ? [
          "all",
          ["<=", ["get", "startYear"], state.currentYear],
          [">=", ["get", "endYear"], state.currentYear],
        ]
      : ["<=", ["get", "startYear"], state.currentYear];

  ["event-point-halo", "event-points", "event-labels"].forEach((layerId) => {
    map.setFilter(layerId, filter);
  });

  const visibleEvents = getVisibleEvents();
  elements.selectedYear.textContent = state.currentYear;
  elements.visibleCount.textContent = visibleEvents.length;
  renderEventList(map, visibleEvents);
}

function getVisibleEvents() {
  return state.events.filter((event) => {
    if (state.mode === "active") {
      return event.startYear <= state.currentYear && event.endYear >= state.currentYear;
    }

    return event.startYear <= state.currentYear;
  });
}

function renderEventList(map, events) {
  elements.eventList.innerHTML = "";

  [...events].reverse().forEach((event) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "event-item";
    item.innerHTML = `
      <span class="event-year">${escapeHtml(event.yearLabel)}</span>
      <span class="event-title">${escapeHtml(event.title)}</span>
      <span class="event-place">${escapeHtml(event.category)}${event.treaty ? ` - ${escapeHtml(event.treaty)}` : ""}</span>
    `;

    item.addEventListener("click", () => {
      map.flyTo({ center: event.coordinates, zoom: 6, essential: true });

      new mapboxgl.Popup({ offset: 16 })
        .setLngLat(event.coordinates)
        .setHTML(createPopupHtml(event))
        .addTo(map);
    });

    elements.eventList.appendChild(item);
  });
}

function fitMapToEvents(map) {
  const bounds = new mapboxgl.LngLatBounds();
  state.events.forEach((event) => bounds.extend(event.coordinates));

  map.fitBounds(bounds, {
    padding: window.innerWidth <= 760 ? 72 : { top: 72, right: 72, bottom: 160, left: 430 },
    maxZoom: 5.8,
    duration: 0,
  });
}

function createGeoJson(events) {
  return {
    type: "FeatureCollection",
    features: events.map((event) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: event.coordinates,
      },
      properties: {
        id: event.id,
        yearLabel: event.yearLabel,
        startYear: event.startYear,
        endYear: event.endYear,
        title: event.title,
        category: event.category,
        treaty: event.treaty,
        people: event.people,
        description: event.description,
      },
    })),
  };
}

function createPopupHtml(properties) {
  return `
    <article class="popup-content">
      <p class="popup-year">${escapeHtml(properties.yearLabel)}</p>
      <h3>${escapeHtml(properties.title)}</h3>
      ${properties.category ? `<p class="popup-meta"><strong>Category:</strong> ${escapeHtml(properties.category)}</p>` : ""}
      ${properties.treaty ? `<p class="popup-meta"><strong>Treaty/Event:</strong> ${escapeHtml(properties.treaty)}</p>` : ""}
      ${properties.people ? `<p class="popup-meta"><strong>People:</strong> ${escapeHtml(properties.people)}</p>` : ""}
      ${properties.description ? `<p class="popup-description">${escapeHtml(properties.description)}</p>` : ""}
    </article>
  `;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return replacements[character];
  });
}

function showMessage(message) {
  elements.appMessage.textContent = message;
  elements.appMessage.hidden = false;
}
