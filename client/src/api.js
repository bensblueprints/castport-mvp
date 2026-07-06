async function req(method, url, body) {
  const opts = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(url, opts);
  if (r.status === 401) throw Object.assign(new Error('Unauthorized'), { unauthorized: true });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

async function upload(url, file, onProgress) {
  // XHR (not fetch) so we can report upload progress for large audio files.
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let j = {};
      try {
        j = JSON.parse(xhr.responseText || '{}');
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(j);
      else reject(new Error(j.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(fd);
  });
}

export const api = {
  me: () => req('GET', '/api/me'),
  login: (password) => req('POST', '/api/login', { password }),
  logout: () => req('POST', '/api/logout'),
  meta: () => req('GET', '/api/meta'),

  shows: () => req('GET', '/api/shows'),
  show: (id) => req('GET', `/api/shows/${id}`),
  createShow: (s) => req('POST', '/api/shows', s),
  updateShow: (id, s) => req('PUT', `/api/shows/${id}`, s),
  deleteShow: (id) => req('DELETE', `/api/shows/${id}`),
  uploadShowArtwork: (id, file, onProgress) => upload(`/api/shows/${id}/artwork`, file, onProgress),

  episodes: (showId) => req('GET', `/api/shows/${showId}/episodes`),
  episode: (id) => req('GET', `/api/episodes/${id}`),
  createEpisode: (showId, e) => req('POST', `/api/shows/${showId}/episodes`, e),
  updateEpisode: (id, e) => req('PUT', `/api/episodes/${id}`, e),
  deleteEpisode: (id) => req('DELETE', `/api/episodes/${id}`),
  uploadEpisodeAudio: (id, file, onProgress) => upload(`/api/episodes/${id}/audio`, file, onProgress),
  uploadEpisodeArtwork: (id, file, onProgress) => upload(`/api/episodes/${id}/artwork`, file, onProgress),
  saveChapters: (id, chapters) => req('PUT', `/api/episodes/${id}/chapters`, { chapters }),

  statsShow: (id, days = 30) => req('GET', `/api/stats/show/${id}?days=${days}`),
  statsEpisode: (id, days = 30) => req('GET', `/api/stats/episode/${id}?days=${days}`)
};
