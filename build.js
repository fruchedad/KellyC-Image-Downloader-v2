#!/usr/bin/env node

// Build script for KellyC Image Downloader Enhanced
// Creates optimized builds for Chrome and Firefox/Waterfox

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const BUILD_DIR = '_build';
const EXTENSION_DIR = 'extension';
const CHROME_BUILD = path.join(BUILD_DIR, 'chrome');
const FIREFOX_BUILD = path.join(BUILD_DIR, 'firefox');

// Files to exclude from build
const EXCLUDE_FILES = [
  'manifest.v2.all.json',
  'manifest.v3.all.json',
  '.DS_Store',
  'Thumbs.db'
];

// Build configuration
const config = {
  chrome: {
    manifest: 'manifest.v3.all.json',
    outputName: 'kellyc-image-downloader-chrome.zip'
  },
  firefox: {
    manifest: 'manifest.v2.all.json',
    outputName: 'kellyc-image-downloader-firefox.xpi'
  }
};

async function clean() {
  console.log('🧹 Cleaning build directory...');
  try {
    await fs.rm(BUILD_DIR, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist
  }
  await fs.mkdir(BUILD_DIR, { recursive: true });
}

async function copyFiles(source, destination, excludeList = []) {
  await fs.mkdir(destination, { recursive: true });
  
  const entries = await fs.readdir(source, { withFileTypes: true });
  
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    
    if (excludeList.includes(entry.name)) {
      continue;
    }
    
    if (entry.isDirectory()) {
      await copyFiles(sourcePath, destPath, excludeList);
    } else {
      await fs.copyFile(sourcePath, destPath);
    }
  }
}

async function buildChrome() {
  console.log('🔧 Building Chrome extension...');
  
  // Copy extension files
  await copyFiles(EXTENSION_DIR, CHROME_BUILD, EXCLUDE_FILES);
  
  // Copy and rename manifest
  const manifestSource = path.join(EXTENSION_DIR, config.chrome.manifest);
  const manifestDest = path.join(CHROME_BUILD, 'manifest.json');
  await fs.copyFile(manifestSource, manifestDest);
  
  // Create ZIP
  const outputPath = path.join(BUILD_DIR, config.chrome.outputName);
  execSync(`cd "${CHROME_BUILD}" && zip -r "../${config.chrome.outputName}" .`, { stdio: 'inherit' });
  
  console.log(`✅ Chrome build complete: ${outputPath}`);
}

async function buildFirefox() {
  console.log('🦊 Building Firefox/Waterfox extension...');
  
  // Copy extension files
  await copyFiles(EXTENSION_DIR, FIREFOX_BUILD, EXCLUDE_FILES);
  
  // Check if manifest v2 exists, if not, convert v3 to v2
  const v2ManifestPath = path.join(EXTENSION_DIR, config.firefox.manifest);
  let manifestContent;
  
  try {
    await fs.access(v2ManifestPath);
    // Copy existing v2 manifest
    const manifestDest = path.join(FIREFOX_BUILD, 'manifest.json');
    await fs.copyFile(v2ManifestPath, manifestDest);
  } catch (error) {
    // Convert v3 to v2
    console.log('📝 Converting manifest v3 to v2...');
    manifestContent = await convertManifestV3toV2();
    const manifestDest = path.join(FIREFOX_BUILD, 'manifest.json');
    await fs.writeFile(manifestDest, JSON.stringify(manifestContent, null, 2));
  }
  
  // Update background.js for Firefox compatibility
  await updateBackgroundForFirefox();
  
  // Create XPI (same as ZIP)
  const outputPath = path.join(BUILD_DIR, config.firefox.outputName);
  execSync(`cd "${FIREFOX_BUILD}" && zip -r "../${config.firefox.outputName}" .`, { stdio: 'inherit' });
  
  console.log(`✅ Firefox build complete: ${outputPath}`);
}

async function convertManifestV3toV2() {
  const v3Path = path.join(EXTENSION_DIR, config.chrome.manifest);
  const v3Content = JSON.parse(await fs.readFile(v3Path, 'utf8'));
  
  // Convert to v2 format
  const v2Content = {
    ...v3Content,
    manifest_version: 2,
    background: {
      scripts: ['background.js'],
      persistent: false
    },
    browser_action: v3Content.action,
    permissions: [
      ...v3Content.permissions.filter(p => p !== 'declarativeNetRequest' && p !== 'declarativeNetRequestWithHostAccess'),
      ...v3Content.host_permissions || []
    ],
    web_accessible_resources: v3Content.web_accessible_resources[0].resources
  };
  
  // Remove v3-specific fields
  delete v2Content.action;
  delete v2Content.host_permissions;
  delete v2Content.declarative_net_request;
  delete v2Content.content_security_policy;
  
  return v2Content;
}

async function updateBackgroundForFirefox() {
  const bgPath = path.join(FIREFOX_BUILD, 'background.js');
  let content = await fs.readFile(bgPath, 'utf8');
  
  // Remove ES6 module syntax for Firefox
  content = content.replace(/^import\s+.*$/gm, '');
  content = content.replace(/^export\s+.*$/gm, '');
  
  // Add polyfill for chrome API if needed
  const polyfill = `
// Firefox compatibility
if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
  globalThis.chrome = browser;
}

// Load background init
if (typeof KellyEDispetcher !== 'undefined') {
  KellyEDispetcher.init();
}
`;
  
  content = polyfill + '\n' + content;
  
  await fs.writeFile(bgPath, content);
}

async function createPackageJson() {
  const packageJson = {
    name: "kellyc-image-downloader-enhanced",
    version: "1.3.0",
    description: "Enhanced image downloader extension for Chrome and Firefox/Waterfox",
    scripts: {
      build: "node build.js",
      "build:chrome": "node build.js chrome",
      "build:firefox": "node build.js firefox",
      clean: "node build.js clean",
      test: "echo \"No tests yet\"",
      lint: "eslint extension/**/*.js"
    },
    keywords: ["browser-extension", "image-downloader", "chrome", "firefox", "waterfox"],
    author: "nradiowave",
    license: "GPL-3.0",
    devDependencies: {
      "eslint": "^8.0.0"
    }
  };
  
  await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));
  console.log('📦 Created package.json');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    if (command === 'clean') {
      await clean();
    } else if (command === 'chrome') {
      await clean();
      await buildChrome();
    } else if (command === 'firefox') {
      await clean();
      await buildFirefox();
    } else {
      // Build both by default
      await clean();
      await buildChrome();
      await buildFirefox();
      await createPackageJson();
      
      console.log('\n🎉 Build complete!');
      console.log('\n📋 Next steps:');
      console.log('1. Chrome: Load unpacked extension from _build/chrome/');
      console.log('2. Firefox: Install _build/kellyc-image-downloader-firefox.xpi');
      console.log('3. Or upload the ZIP/XPI files to respective extension stores');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run the build
main(); 