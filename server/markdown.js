// marked v18 is ESM-only. Node 24 can require() ESM, but Electron 33's Node 20
// cannot — so load it via dynamic import() and cache the instance. Works in both.
let markedPromise = null;

function loadMarked() {
  if (!markedPromise) markedPromise = import('marked').then((m) => m.marked);
  return markedPromise;
}

async function renderMarkdown(md) {
  const marked = await loadMarked();
  return marked.parse(md || '');
}

module.exports = { renderMarkdown };
