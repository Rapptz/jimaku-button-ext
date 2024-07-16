const anilistRegex = /^https:\/\/anilist\.co\/anime\/(\d+)\//m;
const anilistUserRegex = /^https:\/\/anilist.co\/user\/(.+)\//m;
const tmdbRegex = /^https:\/\/(?:www\.)?themoviedb\.org\/(tv|movie)\/(\d+)(?:-[a-zA-Z0-9\-]+)?(?:\/.*)?/m;
const COOLDOWN_DELAY = 10 * 60 * 1000;
let apiKey = null;
const shortTermCache = new Map();

const getAnilistId = (url) => {
  const m = url.match(anilistRegex);
  return m == null || m.length !== 2 ? null : parseInt(m[1], 10);
}

const getAnilistUsername = (url) => {
  const m = url.match(anilistUserRegex);
  return m == null || m.length !== 2 ? null : m[1];
}

const getTmdbId = (url) => {
  const m = url.match(tmdbRegex);
  return m == null || m.length !== 3 ? null : { type: m[1], id: parseInt(m[2], 10) };
}

async function clearCredentials() {
  apiKey = null;
  await browser.storage.local.remove('apiKey');
}

async function removeCacheCooldown(cacheKey) {
  let cache = await browser.storage.local.get(cacheKey);
  if(cache.hasOwnProperty(cacheKey)) {
    let info = cache[cacheKey];
    if(info.cooldown) {
      await browser.storage.local.remove(cacheKey);
    }
  }
}

async function setCacheCooldown(cacheKey) {
  await browser.storage.local.set({
    [cacheKey]: {
      cooldown: true,
    }
  });
  setTimeout(() => removeCacheCooldown(cacheKey), COOLDOWN_DELAY);
}

async function searchService(queryName, cacheKey) {
  console.log(cacheKey);
  let cache = await browser.storage.local.get(cacheKey);
  if(cache.hasOwnProperty(cacheKey)) {
    let info = cache[cacheKey];
    if(info.cooldown) {
      return null;
    }
    return `https://jimaku.cc/entry/${info.id}`;
  }

  let response = await fetch(`https://jimaku.cc/api/entries/search?${queryName}=${cacheKey}`, {
    headers: {
      'authorization': apiKey,
      'user-agent': 'Rapptz/jimaku-button-ext',
    }
  });
  if(response.status !== 200) {
    if(response.status === 401) {
      await clearCredentials();
    }
    setCacheCooldown(cacheKey);
    return null;
  }
  let data = await response.json();
  if(data.length === 0) {
    setCacheCooldown(cacheKey);
    return null;
  }
  let entryId = data[0].id;
  await browser.storage.local.set({
    [cacheKey]: {
      id: entryId
    }
  });
  return `https://jimaku.cc/entry/${entryId}`;
}

async function handleTabAction(tab) {
  if(apiKey === null) {
    await browser.pageAction.show(tab.id);
    return;
  }

  let anilistId = getAnilistId(tab.url);
  if(anilistId !== null) {
    let url = await searchService('anilist_id', anilistId.toString());
    if(url !== null) {
      shortTermCache.set(tab.id, url);
      await browser.pageAction.show(tab.id);
      return;
    }
  } else {
    let anilistUsername = getAnilistUsername(tab.url);
    if(anilistUsername !== null) {
      let url = `https://jimaku.cc/anilist/${anilistUsername}`;
      shortTermCache.set(tab.id, url);
      await browser.pageAction.show(tab.id);
      return;
    }
    let tmdbId = getTmdbId(tab.url);
    if(tmdbId !== null) {
      let cacheKey = `${tmdbId.type}:${tmdbId.id}`;
      let url = await searchService('tmdb_id', cacheKey);
      if(url !== null) {
        shortTermCache.set(tab.id, url);
        await browser.pageAction.show(tab.id);
        return;
      }
    }
  }

  await browser.pageAction.hide(tab.id);
}

async function main() {
  let activeTab = await browser.tabs.query({active: true, currentWindow: true});
  if(activeTab?.length > 0) {
    await handleTabAction(activeTab[0]);
  }
  let storedApiKey = await browser.storage.local.get('apiKey');
  apiKey = storedApiKey?.apiKey ?? null;

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if(!changeInfo.url) {
      return;
    }
    let getTab = await browser.tabs.query({active: true, currentWindow: true});
    let activeTab = getTab[0];
    if(tabId === activeTab.id) {
      await handleTabAction(activeTab);
    }
  });

  browser.pageAction.onClicked.addListener((tab) => {
    if(apiKey === null) {
      browser.runtime.openOptionsPage();
    } else {
      let url = shortTermCache.get(tab.id);
      if(url !== null) {
        browser.tabs.create({url});
      }
    }
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if(area !== "local") {
      return;
    }
    let changedApiKey = changes['apiKey'];
    if(changedApiKey != null) {
      apiKey = changedApiKey?.newValue ?? null;
    }
  })
}

main();
