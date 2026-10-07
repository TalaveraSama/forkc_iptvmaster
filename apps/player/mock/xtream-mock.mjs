/**
 * Development mock of the Xtream-compatible API published by IPTVMaster
 * output profiles. It answers the same player_api.php actions and playback
 * redirect paths with a small deterministic catalogue, and redirects every
 * stream to a short public-domain MP4 so the whole player flow (browse →
 * detail → preroll ad → playback → continue watching) is testable without a
 * real provider.
 *
 * Usage:
 *   npm run mock -w @iptvmaster/player     # listens on :8080
 *   npm run dev -w @iptvmaster/player      # vite proxies the API paths to it
 *   open http://127.0.0.1:5174/player/ and use the demo token button.
 */

import { createServer } from 'node:http';

const PORT = Number(process.env['MOCK_PORT'] ?? 8080);
const HOST = process.env['MOCK_HOST'] ?? '0.0.0.0';
const USERNAME = 'iptvmaster';
const TOKEN = 'demotoken1234567890';

const SAMPLE_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
];

const poster = (seed, width, height) =>
  `https://picsum.photos/seed/${seed}/${width}/${height}`;

const MOVIE_CATEGORIES = [
  { category_id: '1', category_name: 'Acción', parent_id: 0 },
  { category_id: '2', category_name: 'Comedia', parent_id: 0 },
  { category_id: '3', category_name: 'Ciencia ficción', parent_id: 0 },
];

const MOVIE_NAMES = {
  1: [
    'Misión Rescate',
    'El Último Horizonte',
    'Código Rojo',
    'Furia Nocturna',
    'Impacto Inminente',
    'La Ruta del Halcón',
  ],
  2: [
    'Vecinos al Límite',
    'Boda por Error',
    'Tres en Apuros',
    'Verano de Locura',
    'El Socio Impostor',
    'Reunión Caótica',
  ],
  3: [
    'Estación Orbital 9',
    'Los Hijos de Andrómeda',
    'Singularidad',
    'Marte Azul',
    'El Quinto Elemento Perdido',
    'Crononautas',
  ],
};

const MOVIE_PLOTS = [
  'Un equipo improbable se reúne para una misión que nadie más aceptaría, con el reloj en contra y todo en juego.',
  'Una historia de segundas oportunidades donde cada decisión abre un camino distinto.',
  'Cuando la ciudad duerme, los secretos salen a la luz y alguien debe enfrentarlos.',
];

const SERIES_CATEGORIES = [
  { category_id: '11', category_name: 'Drama', parent_id: 0 },
  { category_id: '12', category_name: 'Animación', parent_id: 0 },
  { category_id: '13', category_name: 'Misterio', parent_id: 0 },
];

const SERIES_NAMES = {
  11: ['Costa Norte', 'La Casa de los Vientos'],
  12: ['Pequeños Titanes', 'El Bosque Animado'],
  13: ['Expediente Medianoche', 'La Última Pista'],
};

const LIVE_CATEGORIES = [
  { category_id: '21', category_name: 'Nacionales', parent_id: 0 },
  { category_id: '22', category_name: 'Deportes', parent_id: 0 },
];

const LIVE_NAMES = {
  21: [
    'Canal Uno HD',
    'TV Central',
    'Noticias 24',
    'Cultura Abierta',
    'Música Viva',
  ],
  22: [
    'Deportes Total',
    'Fútbol Premium',
    'Arena extrema',
    'Clásicos del Deporte',
    'Marcador HD',
  ],
};

function buildMovies() {
  const streams = [];
  let id = 1001;
  for (const category of MOVIE_CATEGORIES) {
    for (const name of MOVIE_NAMES[category.category_id]) {
      streams.push({
        num: id,
        name,
        stream_type: 'movie',
        stream_id: id,
        stream_icon: poster(`movie-${id}`, 300, 450),
        added: String(1_750_000_000 + id),
        category_id: category.category_id,
        category_ids: [category.category_id],
        container_extension: 'mp4',
        rating: (5 + ((id * 7) % 45) / 10).toFixed(1),
        rating_5based: Number((3 + ((id * 7) % 20) / 10).toFixed(1)),
        direct_source: '',
      });
      id += 1;
    }
  }
  return streams;
}

function buildSeries() {
  const shows = [];
  let id = 2001;
  for (const category of SERIES_CATEGORIES) {
    for (const name of SERIES_NAMES[category.category_id]) {
      shows.push({
        num: id,
        name,
        series_id: id,
        cover: poster(`serie-${id}`, 300, 450),
        plot: MOVIE_PLOTS[id % MOVIE_PLOTS.length],
        cast: 'Ana Torres, Luis Márquez, Carla Peña',
        director: 'Dirección de demuestra',
        genre: category.category_name,
        releaseDate: String(2019 + (id % 6)),
        release_date: String(2019 + (id % 6)),
        last_modified: String(1_750_000_000 + id),
        rating: (6 + ((id * 3) % 35) / 10).toFixed(1),
        rating_5based: Number((3.4 + ((id * 3) % 15) / 10).toFixed(1)),
        backdrop_path: [poster(`serie-${id}-bd`, 1280, 720)],
        youtube_trailer: '',
        tmdb: '0',
        episode_run_time: '42',
        category_id: category.category_id,
        category_ids: [category.category_id],
      });
      id += 1;
    }
  }
  return shows;
}

function buildLive() {
  const streams = [];
  let id = 3001;
  for (const category of LIVE_CATEGORIES) {
    for (const name of LIVE_NAMES[category.category_id]) {
      streams.push({
        num: id,
        name,
        stream_type: 'live',
        stream_id: id,
        stream_icon: poster(`canal-${id}`, 320, 180),
        added: String(1_750_000_000 + id),
        category_id: category.category_id,
        category_ids: [category.category_id],
        epg_channel_id: '',
        direct_source: '',
      });
      id += 1;
    }
  }
  return streams;
}

const MOVIES = buildMovies();
const SERIES = buildSeries();
const LIVE = buildLive();

function seriesDetail(seriesId) {
  const show = SERIES.find((candidate) => candidate.series_id === seriesId);
  if (!show) return null;
  const episodes = {};
  for (const season of [1, 2]) {
    episodes[String(season)] = Array.from({ length: 4 }, (_, index) => {
      const episodeNum = index + 1;
      const episodeId = seriesId * 100 + season * 10 + episodeNum;
      return {
        id: String(episodeId),
        episode_num: episodeNum,
        title: `Episodio ${episodeNum}`,
        container_extension: 'mp4',
        info: {
          tmdb_id: 0,
          releasedate: `${show.releaseDate}-0${season}-1${episodeNum}`,
          plot: `Temporada ${season}: la historia continúa en el episodio ${episodeNum}.`,
          duration_secs: 2520,
          duration: '42 min',
          movie_image: poster(`ep-${episodeId}`, 320, 180),
          video: {},
          audio: {},
          bitrate: 0,
          rating: Number(show.rating_5based),
          season,
        },
        custom_sid: null,
        added: show.last_modified,
        season,
        direct_source: '',
      };
    });
  }
  return {
    seasons: [1, 2].map((season) => ({
      season_number: season,
      episode_count: 4,
      name: `Temporada ${season}`,
    })),
    info: {
      name: show.name,
      cover: show.cover,
      plot: show.plot,
      cast: show.cast,
      director: show.director,
      genre: show.genre,
      releaseDate: show.releaseDate,
      rating: show.rating,
      rating_5based: show.rating_5based,
      backdrop_path: show.backdrop_path,
      youtube_trailer: '',
      episode_run_time: show.episode_run_time,
      category_id: show.category_id,
    },
    episodes,
  };
}

function vodInfo(vodId) {
  const movie = MOVIES.find((candidate) => candidate.stream_id === vodId);
  if (!movie) return null;
  return {
    info: {
      tmdb_id: '',
      name: movie.name,
      o_name: movie.name,
      cover_big: poster(`movie-${movie.stream_id}-bd`, 1280, 720),
      movie_image: movie.stream_icon,
      releasedate: String(2015 + (movie.stream_id % 10)),
      youtube_trailer: '',
      director: 'Dirección de demuestra',
      actors: 'Ana Torres, Luis Márquez',
      cast: 'Ana Torres, Luis Márquez',
      plot: MOVIE_PLOTS[movie.stream_id % MOVIE_PLOTS.length],
      genre:
        MOVIE_CATEGORIES.find(
          (category) => category.category_id === movie.category_id,
        )?.category_name ?? '',
      country: '',
      backdrop_path: [poster(`movie-${movie.stream_id}-bd`, 1280, 720)],
      duration_secs: 5400,
      duration: '01:30:00',
      rating: movie.rating,
    },
    movie_data: {
      stream_id: movie.stream_id,
      name: movie.name,
      added: movie.added,
      category_id: movie.category_id,
      category_ids: movie.category_ids,
      container_extension: 'mp4',
      custom_sid: null,
      direct_source: '',
    },
  };
}

function authResponse(authenticated, password = '') {
  return {
    user_info: {
      username: authenticated ? USERNAME : '',
      password: authenticated ? password : '',
      message: '',
      auth: authenticated ? 1 : 0,
      status: authenticated ? 'Active' : 'Disabled',
      exp_date: '0',
      is_trial: '0',
      active_cons: '0',
      created_at: '0',
      max_connections: '1',
      allowed_output_formats: ['m3u8', 'ts'],
    },
  };
}

function sampleVideoFor(id) {
  const numeric = Number(String(id).replace(/\D/g, '')) || 0;
  return SAMPLE_VIDEOS[numeric % SAMPLE_VIDEOS.length];
}

function byCategory(items, categoryId) {
  return categoryId
    ? items.filter((item) => item.category_id === categoryId)
    : items;
}

function sendJson(response, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  response.end(body);
}

function sendNotFound(response) {
  response.writeHead(404, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  });
  response.end(JSON.stringify({ error: 'Not found' }));
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://mock.local');
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': '*',
    });
    response.end();
    return;
  }

  if (path === '/health') {
    sendJson(response, { status: 'ok', mock: true });
    return;
  }

  if (path === '/player_api.php') {
    const username = url.searchParams.get('username') ?? '';
    const password = url.searchParams.get('password') ?? '';
    if (username !== USERNAME || password !== TOKEN) {
      sendJson(response, authResponse(false));
      return;
    }
    const action = url.searchParams.get('action');
    if (!action) {
      sendJson(response, {
        ...authResponse(true, password),
        server_info: {
          url: 'mock.local',
          port: '80',
          https_port: '443',
          server_protocol: 'http',
          timezone: 'UTC',
          timestamp_now: Math.floor(Date.now() / 1000),
          process: true,
        },
      });
      return;
    }
    const categoryId = url.searchParams.get('category_id') ?? '';
    switch (action) {
      case 'get_live_categories':
        sendJson(response, LIVE_CATEGORIES);
        return;
      case 'get_live_streams':
        sendJson(response, byCategory(LIVE, categoryId));
        return;
      case 'get_vod_categories':
        sendJson(response, MOVIE_CATEGORIES);
        return;
      case 'get_vod_streams':
        sendJson(response, byCategory(MOVIES, categoryId));
        return;
      case 'get_vod_info':
        sendJson(
          response,
          vodInfo(
            Number(
              url.searchParams.get('vod_id') ??
                url.searchParams.get('stream_id') ??
                '',
            ),
          ) ?? {},
        );
        return;
      case 'get_series_categories':
        sendJson(response, SERIES_CATEGORIES);
        return;
      case 'get_series':
        sendJson(response, byCategory(SERIES, categoryId));
        return;
      case 'get_series_info':
        sendJson(
          response,
          seriesDetail(Number(url.searchParams.get('series_id') ?? '')) ?? {},
        );
        return;
      case 'get_short_epg':
        sendJson(response, { epg_listings: [] });
        return;
      default:
        sendJson(response, []);
        return;
    }
  }

  const playback = path.match(
    /^\/(live|movie|series)\/([^/]+)\/([^/]+)\/([^/]+)$/,
  );
  if (playback) {
    const [, , username, password, streamFile] = playback;
    if (username !== USERNAME || password !== TOKEN) {
      sendNotFound(response);
      return;
    }
    const target = sampleVideoFor(streamFile.split('.', 1)[0]);
    response.writeHead(302, {
      location: target,
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    });
    response.end();
    return;
  }

  sendNotFound(response);
});

server.listen(PORT, HOST, () => {
  console.log(
    `Xtream mock listening on http://${HOST}:${PORT} (token: ${TOKEN})`,
  );
});
