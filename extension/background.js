// Enhanced Background Service Worker for KellyC Image Downloader
// Compatible with Chrome MV3 and Firefox/Waterfox

// Import modules
import './env/init/background.js';

// Constants
const EXTENSION_NAME = 'KellyC Image Downloader Enhanced';
const DEFAULT_DOWNLOAD_PATH = 'KellyC-Downloads';
const MAX_CONCURRENT_DOWNLOADS = 5;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

// State management
const state = {
  downloads: new Map(),
  activeDownloads: 0,
  downloadQueue: [],
  settings: {},
  tabStates: new Map()
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`${EXTENSION_NAME} installed:`, details.reason);
  
  // Set default settings
  const defaultSettings = {
    downloadPath: DEFAULT_DOWNLOAD_PATH,
    maxConcurrentDownloads: MAX_CONCURRENT_DOWNLOADS,
    autoRetry: true,
    notifications: true,
    contextMenu: true,
    keyboardShortcuts: true,
    enhancedMode: true,
    imageFilters: {
      minWidth: 100,
      minHeight: 100,
      excludeDataUrls: false,
      excludeSvg: false
    }
  };
  
  // Load existing settings or set defaults
  const savedSettings = await chrome.storage.sync.get('settings');
  state.settings = { ...defaultSettings, ...savedSettings.settings };
  await chrome.storage.sync.set({ settings: state.settings });
  
  // Create context menus
  if (state.settings.contextMenu) {
    createContextMenus();
  }
  
  // Set up alarm for periodic tasks
  chrome.alarms.create('cleanup', { periodInMinutes: 60 });
});

// Context menu creation
function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'download-image',
      title: 'Download Image with KellyC',
      contexts: ['image']
    });
    
    chrome.contextMenus.create({
      id: 'download-all-images',
      title: 'Download All Images on Page',
      contexts: ['page', 'frame']
    });
    
    chrome.contextMenus.create({
      id: 'download-selected-images',
      title: 'Download Selected Images',
      contexts: ['selection']
    });
  });
}

// Context menu handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case 'download-image':
      downloadImage(info.srcUrl, tab);
      break;
    case 'download-all-images':
      chrome.tabs.sendMessage(tab.id, { action: 'downloadAllImages' });
      break;
    case 'download-selected-images':
      chrome.tabs.sendMessage(tab.id, { action: 'downloadSelectedImages' });
      break;
  }
});

// Enhanced download function with retry logic
async function downloadImage(url, tab, options = {}) {
  const downloadId = crypto.randomUUID();
  const filename = options.filename || generateFilename(url, tab);
  
  state.downloads.set(downloadId, {
    url,
    filename,
    tabId: tab?.id,
    attempts: 0,
    status: 'pending'
  });
  
  // Queue download if too many active
  if (state.activeDownloads >= state.settings.maxConcurrentDownloads) {
    state.downloadQueue.push(downloadId);
    return downloadId;
  }
  
  return performDownload(downloadId);
}

// Perform actual download
async function performDownload(downloadId) {
  const download = state.downloads.get(downloadId);
  if (!download) return;
  
  state.activeDownloads++;
  download.status = 'downloading';
  
  try {
    const downloadOptions = {
      url: download.url,
      filename: `${state.settings.downloadPath}/${download.filename}`,
      saveAs: false,
      conflictAction: 'uniquify'
    };
    
    const chromeDownloadId = await chrome.downloads.download(downloadOptions);
    download.chromeDownloadId = chromeDownloadId;
    
    // Monitor download progress
    chrome.downloads.onChanged.addListener(function downloadListener(delta) {
      if (delta.id !== chromeDownloadId) return;
      
      if (delta.state?.current === 'complete') {
        handleDownloadComplete(downloadId);
        chrome.downloads.onChanged.removeListener(downloadListener);
      } else if (delta.state?.current === 'interrupted') {
        handleDownloadError(downloadId, delta.error?.current);
        chrome.downloads.onChanged.removeListener(downloadListener);
      }
    });
    
  } catch (error) {
    handleDownloadError(downloadId, error.message);
  }
}

// Handle successful download
function handleDownloadComplete(downloadId) {
  const download = state.downloads.get(downloadId);
  if (!download) return;
  
  download.status = 'complete';
  state.activeDownloads--;
  
  // Notify user if enabled
  if (state.settings.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'env/img/icon128x128.png',
      title: 'Download Complete',
      message: `Downloaded: ${download.filename}`
    });
  }
  
  // Process queue
  processDownloadQueue();
  
  // Clean up after delay
  setTimeout(() => state.downloads.delete(downloadId), 300000); // 5 minutes
}

// Handle download errors with retry
async function handleDownloadError(downloadId, error) {
  const download = state.downloads.get(downloadId);
  if (!download) return;
  
  download.attempts++;
  state.activeDownloads--;
  
  if (download.attempts < RETRY_ATTEMPTS && state.settings.autoRetry) {
    download.status = 'retrying';
    console.log(`Retrying download (${download.attempts}/${RETRY_ATTEMPTS}):`, download.url);
    
    setTimeout(() => {
      state.activeDownloads--;
      performDownload(downloadId);
    }, RETRY_DELAY * download.attempts);
  } else {
    download.status = 'failed';
    download.error = error;
    
    if (state.settings.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'env/img/icon128x128.png',
        title: 'Download Failed',
        message: `Failed to download: ${download.filename}\nError: ${error}`
      });
    }
    
    processDownloadQueue();
  }
}

// Process download queue
function processDownloadQueue() {
  while (state.downloadQueue.length > 0 && state.activeDownloads < state.settings.maxConcurrentDownloads) {
    const downloadId = state.downloadQueue.shift();
    performDownload(downloadId);
  }
}

// Generate filename from URL
function generateFilename(url, tab) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    let filename = pathname.substring(pathname.lastIndexOf('/') + 1);
    
    // If no filename, generate one
    if (!filename || filename.length === 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const domain = urlObj.hostname.replace(/[^a-z0-9]/gi, '_');
      filename = `${domain}_${timestamp}.jpg`;
    }
    
    // Ensure proper extension
    if (!filename.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)$/i)) {
      filename += '.jpg';
    }
    
    // Sanitize filename
    filename = filename.replace(/[<>:"/\\|?*]/g, '_');
    
    // Add site prefix if available
    if (tab?.title) {
      const sitePrefix = tab.title.substring(0, 20).replace(/[<>:"/\\|?*]/g, '_');
      filename = `${sitePrefix}_${filename}`;
    }
    
    return filename;
  } catch (error) {
    console.error('Error generating filename:', error);
    return `image_${Date.now()}.jpg`;
  }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'downloadImages':
      handleBatchDownload(request.images, sender.tab);
      sendResponse({ success: true });
      break;
      
    case 'getSettings':
      sendResponse(state.settings);
      break;
      
    case 'updateSettings':
      state.settings = { ...state.settings, ...request.settings };
      chrome.storage.sync.set({ settings: state.settings });
      sendResponse({ success: true });
      break;
      
    case 'getDownloadStatus':
      sendResponse({
        active: state.activeDownloads,
        queued: state.downloadQueue.length,
        downloads: Array.from(state.downloads.values())
      });
      break;
      
    case 'enhanceImage':
      enhanceImageUrl(request.url, sender.tab).then(sendResponse);
      return true; // Will respond asynchronously
      
    default:
      console.warn('Unknown action:', request.action);
  }
});

// Batch download handler
async function handleBatchDownload(images, tab) {
  console.log(`Starting batch download of ${images.length} images`);
  
  for (const image of images) {
    await downloadImage(image.url, tab, { filename: image.filename });
  }
}

// Enhanced image URL processing
async function enhanceImageUrl(url, tab) {
  try {
    // Try to get higher resolution version
    const enhancedUrl = await tryEnhanceUrl(url, tab);
    
    // Validate URL
    const response = await fetch(enhancedUrl, { method: 'HEAD' });
    if (response.ok) {
      return { url: enhancedUrl, enhanced: enhancedUrl !== url };
    }
  } catch (error) {
    console.error('Error enhancing URL:', error);
  }
  
  return { url, enhanced: false };
}

// URL enhancement logic
async function tryEnhanceUrl(url, tab) {
  const domain = new URL(tab.url).hostname;
  
  // Site-specific enhancements
  if (domain.includes('twitter.com') || domain.includes('x.com')) {
    return url.replace(/\?.*$/, '').replace(/&.*$/, '') + '?format=jpg&name=orig';
  } else if (domain.includes('instagram.com')) {
    return url.replace(/\/s\d+x\d+\//, '/').replace(/\/c\d+\.\d+\.\d+\.\d+\//, '/');
  } else if (domain.includes('reddit.com')) {
    // Enhanced Reddit URL processing
    let enhancedUrl = url;
    
    // Convert preview URLs to high-res versions
    enhancedUrl = enhancedUrl.replace('preview.redd.it', 'i.redd.it');
    enhancedUrl = enhancedUrl.replace('external-preview.redd.it', 'i.redd.it');
    
    // Remove Reddit image processing parameters for original quality
    enhancedUrl = enhancedUrl.replace(/\?[^?]*?(width|height|crop|format|auto=webp|s=)=[^&]*&?/g, '');
    enhancedUrl = enhancedUrl.replace(/\?$/, '');
    
    // Handle imgur links properly (remove thumbnail indicators)
    if (enhancedUrl.includes('imgur.com')) {
      enhancedUrl = enhancedUrl.replace(/\/([a-zA-Z0-9]+)[bsthlm]\.(jpg|jpeg|png|gif|webp)$/i, '/$1.$2');
    }
    
    return enhancedUrl;
  }
  
  // Generic enhancements
  return url
    .replace(/\?.*$/, '') // Remove query parameters
    .replace(/_thumb|_small|_medium/, '_large') // Try larger size
    .replace(/\/thumb\//, '/original/'); // Common pattern
}

// Command handler
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: command });
    }
  });
});

// Alarm handler for periodic cleanup
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    // Clean up old downloads
    const cutoffTime = Date.now() - 86400000; // 24 hours
    for (const [id, download] of state.downloads) {
      if (download.timestamp < cutoffTime) {
        state.downloads.delete(id);
      }
    }
    
    // Clean up tab states
    chrome.tabs.query({}, (tabs) => {
      const activeTabIds = new Set(tabs.map(tab => tab.id));
      for (const tabId of state.tabStates.keys()) {
        if (!activeTabIds.has(tabId)) {
          state.tabStates.delete(tabId);
        }
      }
    });
  }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    downloadImage,
    generateFilename,
    enhanceImageUrl
  };
} 