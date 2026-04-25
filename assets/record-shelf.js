document.addEventListener("DOMContentLoaded", async () => {
  const keybindingsAction = document.querySelector("#keybindings-action");
  const keybindingsButton = document.querySelector("#toggle-keybindings");
  const keybindingsHelp = document.querySelector("#keybindings-help");
  const searchPanel = document.querySelector("#search-panel");
  const searchShell = document.querySelector("#record-search-shell");
  const searchText = document.querySelector("#record-search-text");
  const searchInput = document.querySelector("#record-search-input");
  const searchStatus = document.querySelector("#record-search-status");
  const randomButton = document.querySelector("#pull-record");
  const openAllButton = document.querySelector("#open-all-records");
  const closeAllButton = document.querySelector("#close-all-records");
  const shelfEl = document.querySelector(".record-shelf");
  const prefixTimeoutMs = 900;
  const vimModeSequence = "vim";
  const vimModeSequenceTimeoutMs = 1200;

  let records = [];
  let lastPulledRecord = null;
  let activeArtistFilter = "";
  let vimModeActive = false;
  let searchDiscovered = false;
  let keybindingsDiscovered = false;
  let keybindingsVisible = false;
  let activeSearchQuery = "";
  let searchMatches = [];
  let activeRecord = null;
  let pendingPrefix = "";
  let pendingPrefixTimeoutId = null;
  let pendingModeSequence = "";
  let pendingModeSequenceTimeoutId = null;

  const dataFile = shelfEl?.dataset.dataFile || "albums";
  const detailMode = shelfEl?.dataset.detailMode || "track";
  const emptyMessage = shelfEl?.dataset.emptyMessage || "No records on the shelf yet.";

  function formatShelfDate(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (isNaN(d)) return isoString;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = d.getUTCDate();
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${day} ${month} ${year}, ${hh}:${mm}`;
  }

  function renderYearChart(albums) {
    const panel = document.getElementById("year-chart-panel");
    const chartEl = document.getElementById("year-chart");
    if (!panel || !chartEl) return;

    const yearCounts = {};
    for (const album of albums) {
      const year = (album.added_at || "").slice(0, 4);
      if (year && /^\d{4}$/.test(year)) {
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      }
    }

    const years = Object.keys(yearCounts).sort();
    if (years.length === 0) return;

    const maxCount = Math.max(...Object.values(yearCounts));
    const fragment = document.createDocumentFragment();

    years.forEach((year, i) => {
      const count = yearCounts[year];
      const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

      const col = document.createElement("div");
      col.className = "year-bar-col";
      col.title = `${year}: ${count} album${count !== 1 ? "s" : ""}`;

      const countLabel = document.createElement("span");
      countLabel.className = "year-bar-count";
      countLabel.textContent = count;

      const barWrap = document.createElement("div");
      barWrap.className = "year-bar-wrap";

      const bar = document.createElement("div");
      bar.className = "year-bar";
      bar.style.height = `${pct}%`;
      bar.style.animationDelay = `${i * 40}ms`;

      const yearLabel = document.createElement("span");
      yearLabel.className = "year-bar-label";
      yearLabel.textContent = `'${year.slice(2)}`;

      bar.appendChild(countLabel);
      barWrap.appendChild(bar);
      col.appendChild(barWrap);
      col.appendChild(yearLabel);
      fragment.appendChild(col);
    });

    chartEl.appendChild(fragment);
  }

  function fillStats(albums, meta) {
    const lastUpdated = (meta && meta.generated_at) || "";
    const el = (id) => document.getElementById(id);

    if (el("stat-records")) el("stat-records").textContent = albums.length;

    const allArtists = new Set(albums.flatMap((a) => a.artist_names || []));
    if (el("stat-artists")) el("stat-artists").textContent = allArtists.size;

    let oldest = null;
    let latest = null;
    let oldestKey = "9999";
    let latestKey = "0000";
    for (const album of albums) {
      const rd = album.release_date || "";
      if (!rd || !/^\d{4}/.test(rd)) continue;
      const year = rd.slice(0, 4);
      let key = `${year}-01-01`;
      if (rd.length >= 7) key = `${rd.slice(0, 7)}-01`;
      if (rd.length >= 10) key = rd.slice(0, 10);
      if (key < oldestKey) {
        oldest = { album, year };
        oldestKey = key;
      }
      if (key > latestKey) {
        latest = { album, year };
        latestKey = key;
      }
    }
    if (oldest && el("stat-oldest")) {
      el("stat-oldest").textContent = `${oldest.album.album_name} (${oldest.year})`;
      if (el("stat-oldest-row")) el("stat-oldest-row").hidden = false;
    }
    if (latest && el("stat-latest")) {
      el("stat-latest").textContent = `${latest.album.album_name} (${latest.year})`;
      if (el("stat-latest-row")) el("stat-latest-row").hidden = false;
    }

    const artistCount = {};
    for (const album of albums) {
      for (const a of album.artist_names || []) {
        if ((a || "").trim().toLowerCase() === "various artists") continue;
        artistCount[a] = (artistCount[a] || 0) + 1;
      }
    }
    const artistEntries = Object.entries(artistCount).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const topCount = artistEntries[0]?.[1] || 0;
    const topArtists = artistEntries.filter((entry) => entry[1] === topCount).map((entry) => entry[0]);
    if (topArtists.length && el("stat-top-artist")) {
      el("stat-top-artist").textContent = `${topArtists.join(" / ")} (${topCount})`;
      if (el("stat-top-artist-row")) el("stat-top-artist-row").hidden = false;
    }

    const mostListened = meta && meta.most_listened_record;
    if (mostListened && mostListened.album_name && mostListened.listen_count && el("stat-most-listened")) {
      el("stat-most-listened").textContent = `${mostListened.album_name} (${mostListened.listen_count})`;
      if (el("stat-most-listened-row")) el("stat-most-listened-row").hidden = false;
    }

    if (el("stat-last-updated")) {
      el("stat-last-updated").textContent = lastUpdated
        ? `${formatShelfDate(lastUpdated)} UTC`
        : "unknown";
    }
  }

  function buildRecord(album, index) {
    const id = `record-${index}`;
    const artists = album.artist_names || [];
    const artistStr = artists.join(", ");
    const year = album.release_date ? album.release_date.slice(0, 4) : "";

    const li = document.createElement("li");
    li.className = "record";
    li.dataset.artists = artists.map((a) => a.toLowerCase()).join("|");
    li.dataset.displayArtists = artistStr;
    li.dataset.title = album.album_name || "";
    li.dataset.searchText = `${album.album_name || ""} ${artists.join(" ")}`.toLowerCase();
    li.dataset.albumUrl = album.album_url || "";

    const spine = document.createElement("div");
    spine.className = "record-spine";

    const yearSpan = document.createElement("span");
    yearSpan.className = "record-year";
    yearSpan.textContent = year;
    spine.appendChild(yearSpan);

    const btn = document.createElement("button");
    btn.className = "record-title record-toggle";
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", id);
    btn.textContent = album.album_name || "";
    spine.appendChild(btn);

    const artistSpan = document.createElement("span");
    artistSpan.className = "record-artist";
    artistSpan.textContent = artistStr;
    spine.appendChild(artistSpan);

    const sleeve = document.createElement("div");
    sleeve.className = "record-sleeve";
    sleeve.id = id;
    sleeve.hidden = true;

    if (album.cover_url) {
      const fallbackUrl = album.cover_fallback_url || "";
      const resolvedFallbackUrl = fallbackUrl
        ? new URL(fallbackUrl, window.location.origin).href
        : "";
      const img = document.createElement("img");
      img.className = "record-cover";
      img.src = album.cover_url;
      img.alt = `Cover of ${album.album_name || ""}`;
      img.loading = "lazy";
      img.decoding = "async";
      img.onerror = function () {
        if (resolvedFallbackUrl && this.src !== resolvedFallbackUrl) {
          this.src = fallbackUrl;
          return;
        }
        const div = document.createElement("div");
        div.className = "record-cover record-cover-missing";
        div.textContent = "😵";
        this.replaceWith(div);
      };
      sleeve.appendChild(img);
    }

    const details = document.createElement("div");
    details.className = "record-details";

    const albumP = document.createElement("p");
    albumP.className = "record-album";
    const header = document.createElement("span");
    header.className = "record-album-header";
    const strong = document.createElement("strong");
    if (album.album_url) {
      const a = document.createElement("a");
      a.href = album.album_url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = album.album_name || "";
      strong.appendChild(a);
    } else {
      strong.textContent = album.album_name || "";
    }
    header.appendChild(strong);
    const typeTag = document.createElement("span");
    typeTag.className = "record-format-tag";
    typeTag.textContent = album.album_type === "single" ? "[ep]" : "[album]";
    header.appendChild(typeTag);
    albumP.appendChild(header);
    const artistLine = document.createElement("span");
    artistLine.className = "record-album-artist";
    artistLine.textContent = artistStr;
    albumP.appendChild(artistLine);
    details.appendChild(albumP);

    const trackP = document.createElement("p");
    trackP.className = "track-p";

    if (detailMode === "first-listen") {
      const label = document.createElement("span");
      label.className = "track-label";
      label.textContent = "First listened:";
      const value = document.createElement("span");
      value.className = "track-value";
      const dateStr = album.first_full_listen_at || "";
      value.textContent = dateStr ? `${formatShelfDate(dateStr)} UTC` : "";
      trackP.appendChild(label);
      trackP.appendChild(document.createTextNode(" "));
      trackP.appendChild(value);
    } else {
      const label = document.createElement("span");
      label.className = "track-label";
      label.textContent = "One track to listen to:";
      trackP.appendChild(label);
      trackP.appendChild(document.createTextNode(" "));
      if (album.track_url) {
        const a = document.createElement("a");
        a.href = album.track_url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = album.track_name || "";
        trackP.appendChild(a);
      } else if (album.track_name) {
        trackP.appendChild(document.createTextNode(album.track_name));
      }
    }

    details.appendChild(trackP);
    sleeve.appendChild(details);
    li.appendChild(spine);
    li.appendChild(sleeve);

    return li;
  }

  try {
    const [albumsRes, metaRes] = await Promise.all([
      fetch(`/data/${dataFile}.json`),
      fetch(`/data/${dataFile}_meta.json`).catch(() => null),
    ]);

    if (!albumsRes.ok) throw new Error(`HTTP ${albumsRes.status}`);
    const albums = await albumsRes.json();
    const meta = metaRes && metaRes.ok ? await metaRes.json().catch(() => ({})) : {};

    albums.sort((a, b) => (b.added_at || "").localeCompare(a.added_at || ""));

    fillStats(albums, meta);
    renderYearChart(albums);

    if (shelfEl) {
      if (albums.length === 0) {
        shelfEl.innerHTML = `<li>${emptyMessage}</li>`;
      } else {
        const fragment = document.createDocumentFragment();
        albums.forEach((album, i) => fragment.appendChild(buildRecord(album, i)));
        shelfEl.replaceChildren(fragment);
      }
    }
  } catch (err) {
    if (shelfEl) shelfEl.innerHTML = "<li>Failed to load albums.</li>";
    console.error("Failed to load album data:", err);
  }

  records = Array.from(document.querySelectorAll(".record"));

  function setOpen(record, open) {
    const button = record.querySelector(".record-toggle");
    const sleeve = record.querySelector(".record-sleeve");

    if (!button || !sleeve) return;

    button.setAttribute("aria-expanded", String(open));
    sleeve.hidden = !open;
    record.classList.toggle("is-open", open);
  }

  function getVisibleRecords() {
    return records.filter((record) => !record.classList.contains("is-filtered-out"));
  }

  function clearPendingPrefix() {
    pendingPrefix = "";

    if (pendingPrefixTimeoutId) {
      window.clearTimeout(pendingPrefixTimeoutId);
      pendingPrefixTimeoutId = null;
    }
  }

  function setPendingPrefix(prefix) {
    clearPendingPrefix();
    pendingPrefix = prefix;
    pendingPrefixTimeoutId = window.setTimeout(clearPendingPrefix, prefixTimeoutMs);
  }

  function clearPendingModeSequence() {
    pendingModeSequence = "";

    if (pendingModeSequenceTimeoutId) {
      window.clearTimeout(pendingModeSequenceTimeoutId);
      pendingModeSequenceTimeoutId = null;
    }
  }

  function setPendingModeSequence(sequence) {
    clearPendingModeSequence();
    pendingModeSequence = sequence;
    pendingModeSequenceTimeoutId = window.setTimeout(
      clearPendingModeSequence,
      vimModeSequenceTimeoutMs
    );
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) return false;

    return Boolean(
      target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']")
    );
  }

  function setActiveRecord(record, options = {}) {
    if (activeRecord === record) return;

    if (activeRecord) {
      activeRecord.classList.remove("is-active-record");
    }

    activeRecord = record;

    if (!activeRecord || !vimModeActive) return;

    activeRecord.classList.add("is-active-record");

    if (options.scroll !== false) {
      activeRecord.scrollIntoView({
        behavior: options.behavior || "smooth",
        block: options.block || "nearest",
      });
    }

    updateSearchStatus();
  }

  function syncActiveRecord(forceSelection = false) {
    const visibleRecords = getVisibleRecords();

    if (visibleRecords.length === 0) {
      setActiveRecord(null, { scroll: false });
      return;
    }

    if (!vimModeActive && !forceSelection) {
      setActiveRecord(null, { scroll: false });
      return;
    }

    if (!activeRecord || !visibleRecords.includes(activeRecord)) {
      setActiveRecord(visibleRecords[0], { scroll: false });
    }
  }

  function setKeybindingsVisible(visible) {
    keybindingsVisible = visible;

    if (keybindingsHelp) {
      keybindingsHelp.hidden = !keybindingsVisible;
      keybindingsHelp.classList.toggle("is-visible", keybindingsVisible);
      keybindingsHelp.setAttribute("aria-hidden", String(!keybindingsVisible));
    }

    if (keybindingsButton) {
      keybindingsButton.setAttribute("aria-expanded", String(keybindingsVisible));
      keybindingsButton.classList.toggle("is-active", keybindingsVisible);
    }
  }

  function setKeybindingsDiscovered(discovered) {
    keybindingsDiscovered = discovered;

    if (keybindingsAction) {
      keybindingsAction.hidden = !keybindingsDiscovered;
      keybindingsAction.classList.toggle("is-visible", keybindingsDiscovered);
      keybindingsAction.setAttribute("aria-hidden", String(!keybindingsDiscovered));
    }
  }

  function setSearchDiscovered(discovered) {
    searchDiscovered = discovered;

    if (searchPanel) {
      searchPanel.hidden = !searchDiscovered;
      searchPanel.classList.toggle("is-visible", searchDiscovered);
      searchPanel.setAttribute("aria-hidden", String(!searchDiscovered));
    }
  }

  function syncSearchShell() {
    if (!searchShell) return;

    const isEmpty = activeSearchQuery.length === 0;
    const isFocused = searchInput === document.activeElement;
    searchShell.classList.toggle("is-empty", isEmpty);

    if (searchText) {
      searchText.textContent = isEmpty
        ? (isFocused ? "" : "type to search albums or artists")
        : activeSearchQuery;
    }
  }

  function updateSearchStatus() {
    if (!searchStatus) return;

    if (!activeSearchQuery) {
      searchStatus.textContent = "";
      return;
    }

    if (searchMatches.length === 0) {
      searchStatus.textContent = "0 matches";
      return;
    }

    const activeIndex = activeRecord ? searchMatches.indexOf(activeRecord) : -1;
    const matchPosition = activeIndex >= 0 ? activeIndex + 1 : 1;
    searchStatus.textContent = `${searchMatches.length} matches (${matchPosition}/${searchMatches.length})`;
  }

  function updateSearchMatches() {
    const query = activeSearchQuery.toLowerCase();
    const visibleRecords = getVisibleRecords();

    searchMatches = query.trim()
      ? visibleRecords.filter((record) => (record.dataset.searchText || "").includes(query))
      : [];

    records.forEach((record) => {
      record.classList.toggle("is-search-match", searchMatches.includes(record));
    });

    if (vimModeActive && searchMatches.length > 0 && !searchMatches.includes(activeRecord)) {
      setActiveRecord(searchMatches[0], { scroll: false });
    }

    updateSearchStatus();
  }

  function setSearchQuery(query) {
    activeSearchQuery = query;

    if (searchInput && searchInput.value !== activeSearchQuery) {
      searchInput.value = activeSearchQuery;
    }

    syncSearchShell();
    updateSearchMatches();
  }

  function focusSearchInput() {
    if (!searchDiscovered || !searchInput) return;

    searchInput.focus();
    searchInput.select();
  }

  function enterVimMode() {
    if (vimModeActive) return;

    vimModeActive = true;
    setSearchDiscovered(true);
    setKeybindingsDiscovered(true);
    clearPendingModeSequence();
    syncActiveRecord(true);
  }

  function exitVimMode() {
    vimModeActive = false;
    clearPendingPrefix();
    clearPendingModeSequence();
    setSearchQuery("");
    setSearchDiscovered(false);
    setKeybindingsVisible(false);
    setKeybindingsDiscovered(false);
    setActiveRecord(null, { scroll: false });
  }

  function maybeHandleVimModeSequence(key) {
    if (key.length !== 1) {
      clearPendingModeSequence();
      return false;
    }

    const nextKey = key.toLowerCase();
    const nextSequence = pendingModeSequence + nextKey;

    if (vimModeSequence.startsWith(nextSequence)) {
      if (nextSequence === vimModeSequence) {
        enterVimMode();
        return true;
      }

      setPendingModeSequence(nextSequence);
      return true;
    }

    if (nextKey === vimModeSequence[0]) {
      setPendingModeSequence(nextKey);
      return true;
    }

    clearPendingModeSequence();
    return false;
  }

  function getRandomRecord(recordPool) {
    if (recordPool.length === 0) return null;
    if (recordPool.length === 1) {
      lastPulledRecord = recordPool[0];
      return recordPool[0];
    }

    let record = lastPulledRecord;

    while (record === lastPulledRecord) {
      record = recordPool[Math.floor(Math.random() * recordPool.length)];
    }

    lastPulledRecord = record;
    return record;
  }

  records.forEach((record) => {
    const button = record.querySelector(".record-toggle");

    if (!button) return;

    button.addEventListener("click", () => {
      if (vimModeActive) {
        setActiveRecord(record, { scroll: false });
      }
      const isOpen = button.getAttribute("aria-expanded") === "true";
      setOpen(record, !isOpen);
    });

    button.addEventListener("focus", () => {
      if (vimModeActive) {
        setActiveRecord(record, { scroll: false });
      }
    });
  });

  function setAllRecords(open) {
    getVisibleRecords().forEach((record) => setOpen(record, open));
  }

  function setArtistFilter(artistName) {
    activeArtistFilter = artistName.toLowerCase();
    let firstVisibleRecord = null;

    records.forEach((record) => {
      const artists = (record.dataset.artists || "").split("|");
      const matches = !activeArtistFilter || artists.includes(activeArtistFilter);

      if (!matches) {
        setOpen(record, false);
      }

      record.classList.toggle("is-filtered-out", !matches);

      if (matches && !firstVisibleRecord) {
        firstVisibleRecord = record;
      }
    });

    lastPulledRecord = null;

    if (firstVisibleRecord && activeArtistFilter) {
      firstVisibleRecord.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }

    updateSearchMatches();
    syncActiveRecord(vimModeActive);
  }

  function moveToSearchMatch(step) {
    if (searchMatches.length === 0) return;

    const currentIndex = activeRecord ? searchMatches.indexOf(activeRecord) : -1;
    let nextIndex;

    if (currentIndex === -1) {
      nextIndex = step >= 0 ? 0 : searchMatches.length - 1;
    } else {
      nextIndex = (currentIndex + step + searchMatches.length) % searchMatches.length;
    }

    const record = searchMatches[nextIndex];
    setActiveRecord(record, { block: "center" });
    updateSearchStatus();
  }

  async function copyCurrentRecord() {
    if (!activeRecord) return;

    const title = activeRecord.dataset.title || "";
    const artists = activeRecord.dataset.displayArtists || "";
    const text = artists ? `${title} — ${artists}` : title;

    if (!text) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // Ignore clipboard failures.
    }
  }

  function openCurrentRecordLink() {
    if (!activeRecord) return;

    const albumUrl = activeRecord.dataset.albumUrl;
    if (!albumUrl) return;

    window.open(albumUrl, "_blank", "noopener,noreferrer");
  }

  function searchCurrentArtist() {
    if (!activeRecord) return;

    const artist = (activeRecord.dataset.displayArtists || "").split(",")[0]?.trim();
    if (!artist) return;

    setSearchQuery(artist);
    updateSearchStatus();
  }

  const showChartButton = document.querySelector("#show-chart");
  if (showChartButton) {
    const chartPanel = document.getElementById("year-chart-panel");
    showChartButton.addEventListener("click", () => {
      if (!chartPanel) return;
      const isShown = !chartPanel.hidden;
      chartPanel.hidden = isShown;
      chartPanel.setAttribute("aria-hidden", String(isShown));
      showChartButton.textContent = isShown ? "[show chart]" : "[hide chart]";
      showChartButton.setAttribute("aria-expanded", String(!isShown));
      showChartButton.classList.toggle("is-active", !isShown);
    });
  }

  if (randomButton && records.length > 0) {
    randomButton.addEventListener("click", () => {
      const record = getRandomRecord(getVisibleRecords());

      if (!record) return;

      setAllRecords(false);
      setOpen(record, true);
      if (vimModeActive) {
        setActiveRecord(record, { scroll: false });
      }

      randomButton.classList.remove("is-picking");
      void randomButton.offsetWidth;
      randomButton.classList.add("is-picking");

      record.classList.remove("just-pulled");
      void record.offsetWidth;
      record.classList.add("just-pulled");

      record.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

  if (keybindingsButton) {
    keybindingsButton.addEventListener("click", () => {
      setKeybindingsVisible(!keybindingsVisible);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      setSearchQuery(event.target.value);
    });

    searchInput.addEventListener("focus", () => {
      searchShell?.classList.add("is-focused");
      syncSearchShell();
    });

    searchInput.addEventListener("blur", () => {
      searchShell?.classList.remove("is-focused");
      syncSearchShell();
    });

    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        if (searchMatches.length === 0) return;

        event.preventDefault();
        setActiveRecord(searchMatches[0], { behavior: "smooth", block: "center" });
        searchMatches[0].scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        searchInput.blur();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        searchInput.blur();
      }
    });
  }

  if (openAllButton && records.length > 0) {
    openAllButton.addEventListener("click", () => {
      setAllRecords(true);
      syncActiveRecord(vimModeActive);
    });
  }

  if (closeAllButton && records.length > 0) {
    closeAllButton.addEventListener("click", () => {
      setAllRecords(false);
      syncActiveRecord(vimModeActive);
    });
  }

  function moveActiveRecord(step) {
    const visibleRecords = getVisibleRecords();

    if (visibleRecords.length === 0) return;

    if (!activeRecord || !visibleRecords.includes(activeRecord)) {
      setActiveRecord(visibleRecords[0]);
      return;
    }

    const currentIndex = visibleRecords.indexOf(activeRecord);
    const nextIndex = Math.max(0, Math.min(visibleRecords.length - 1, currentIndex + step));
    setActiveRecord(visibleRecords[nextIndex]);
  }

  function jumpToRecord(position) {
    const visibleRecords = getVisibleRecords();

    if (visibleRecords.length === 0) return;

    if (position === "first") {
      setActiveRecord(visibleRecords[0]);
      return;
    }

    setActiveRecord(visibleRecords[visibleRecords.length - 1]);
  }

  function toggleActiveRecord(forceOpen) {
    const visibleRecords = getVisibleRecords();

    if (visibleRecords.length === 0) return;

    syncActiveRecord();

    if (!activeRecord) return;

    const button = activeRecord.querySelector(".record-toggle");
    if (!button) return;

    const isOpen = button.getAttribute("aria-expanded") === "true";
    const nextOpen = typeof forceOpen === "boolean" ? forceOpen : !isOpen;
    setOpen(activeRecord, nextOpen);
    setActiveRecord(activeRecord, { scroll: false });
  }

  document.addEventListener("keydown", (event) => {
    if (isEditableTarget(event.target)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === "Escape") {
      clearPendingModeSequence();

      if (vimModeActive) {
        event.preventDefault();
        exitVimMode();
      }

      return;
    }

    if (!vimModeActive) {
      if (maybeHandleVimModeSequence(event.key)) {
        event.preventDefault();
      }

      return;
    }

    if (pendingPrefix === "g") {
      if (event.key === "g") {
        event.preventDefault();
        jumpToRecord("first");
        clearPendingPrefix();
        return;
      }

      clearPendingPrefix();
    } else if (pendingPrefix === "z") {
      if (event.key === "a") {
        event.preventDefault();
        toggleActiveRecord();
        clearPendingPrefix();
        return;
      }

      if (event.key === "o") {
        event.preventDefault();
        toggleActiveRecord(true);
        clearPendingPrefix();
        return;
      }

      if (event.key === "c") {
        event.preventDefault();
        toggleActiveRecord(false);
        clearPendingPrefix();
        return;
      }

      clearPendingPrefix();
    } else if (pendingPrefix === "y") {
      if (event.key === "y") {
        event.preventDefault();
        void copyCurrentRecord();
        clearPendingPrefix();
        return;
      }

      clearPendingPrefix();
    }

    if (event.key === "j") {
      event.preventDefault();
      moveActiveRecord(1);
      return;
    }

    if (event.key === "k") {
      event.preventDefault();
      moveActiveRecord(-1);
      return;
    }

    if (event.key === "g") {
      event.preventDefault();
      setPendingPrefix("g");
      return;
    }

    if (event.key === "G") {
      event.preventDefault();
      jumpToRecord("last");
      return;
    }

    if (event.key === "h") {
      event.preventDefault();
      setKeybindingsVisible(!keybindingsVisible);
      return;
    }

    if (event.key === "z") {
      event.preventDefault();
      setPendingPrefix("z");
      return;
    }

    if (event.key === "/") {
      event.preventDefault();
      focusSearchInput();
      return;
    }

    if (event.key === "n") {
      event.preventDefault();
      moveToSearchMatch(1);
      return;
    }

    if (event.key === "N") {
      event.preventDefault();
      moveToSearchMatch(-1);
      return;
    }

    if (event.key === "*") {
      event.preventDefault();
      searchCurrentArtist();
      return;
    }

    if (event.key === "o") {
      event.preventDefault();
      openCurrentRecordLink();
      return;
    }

    if (event.key === "y") {
      event.preventDefault();
      setPendingPrefix("y");
    }
  });

  setKeybindingsVisible(false);
  setKeybindingsDiscovered(false);
  setSearchDiscovered(false);
  syncSearchShell();
});
