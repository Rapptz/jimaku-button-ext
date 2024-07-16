const apiKey = document.getElementById('api-key');
async function saveOptions(e) {
  e.preventDefault();
  const testRequest = await fetch('https://jimaku.cc/api/entries/729', {
    headers: {
      'authorization': apiKey.value,
      'user-agent': 'Rapptz/jimaku-button-ext',
    }
  });
  console.log(testRequest.status, apiKey.value);
  if(testRequest.status === 401) {
    apiKey.setCustomValidity('Improper API key.');
    return;
  }
  await browser.storage.local.set({
    apiKey: apiKey.value
  });
}

async function restoreOptions() {
  let res = await browser.storage.local.get('apiKey');
  apiKey.value = res?.apiKey ?? '';
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.querySelector('form').addEventListener('submit', saveOptions);
