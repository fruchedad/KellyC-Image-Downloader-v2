# KellyC Image Downloader Enhanced v1.3.0

An enhanced fork of KellyC Image Downloader with improved compatibility for Chrome and Firefox/Waterfox browsers, featuring advanced image detection, batch downloading, and site-specific optimizations.

## 🚀 New Features in Enhanced Version

### Core Enhancements
- **Multi-browser Support**: Full compatibility with Chrome (MV3) and Firefox/Waterfox (MV2)
- **Enhanced Background Service Worker**: Modern ES6 modules with fallback support
- **Improved Download Manager**: Queue system with concurrent download limits
- **Automatic Retry Logic**: Failed downloads retry up to 3 times
- **Smart Filename Generation**: Context-aware naming with site prefixes
- **Keyboard Shortcuts**: Quick access to main features (Ctrl+Shift+K/D/G)

### Advanced Features
- **High-Resolution Detection**: Automatically finds and downloads highest quality versions
- **Site-Specific Enhancements**: 
  - Twitter/X: Gets original quality images
  - Instagram: Bypasses compression
  - Reddit: Direct image links
  - And more...
- **CORS Bypass**: Built-in rules for cross-origin image access
- **Batch Operations**: Download all images or selected images
- **Context Menu Integration**: Right-click options for quick downloads
- **Notification System**: Download progress and completion alerts
- **Offline Support**: Works with local HTML files

### Security & Performance
- **Content Security Policy**: Enhanced security headers
- **Resource Optimization**: Lazy loading and efficient memory usage
- **Error Handling**: Comprehensive error recovery
- **Storage Management**: Automatic cleanup of old data

## 📦 Installation

### Quick Install
1. Download the latest release from the [Releases](https://github.com/yourusername/KellyC-Image-Downloader-v2/releases) page
2. For Chrome: Load `kellyc-image-downloader-chrome.zip`
3. For Firefox/Waterfox: Install `kellyc-image-downloader-firefox.xpi`

### Build from Source

#### Prerequisites
- Node.js 14+ installed
- npm or yarn package manager

#### Build Steps
```bash
# Clone the repository
git clone https://github.com/yourusername/KellyC-Image-Downloader-v2.git
cd KellyC-Image-Downloader-v2

# Install dependencies (first time only)
npm install

# Build for all browsers
node build.js

# Or build for specific browser
node build.js chrome    # Chrome only
node build.js firefox   # Firefox/Waterfox only
```

Built extensions will be in the `_build/` directory:
- Chrome: `_build/kellyc-image-downloader-chrome.zip`
- Firefox: `_build/kellyc-image-downloader-firefox.xpi`

### Development Installation

#### Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `_build/chrome/` directory

#### Firefox/Waterfox
1. Open `about:debugging`
2. Click "This Firefox" (or "This Waterfox")
3. Click "Load Temporary Add-on"
4. Select the `_build/kellyc-image-downloader-firefox.xpi` file

## 🎮 Usage

### Keyboard Shortcuts
- **Ctrl+Shift+K** (Cmd+Shift+K on Mac): Open extension popup
- **Ctrl+Shift+D** (Cmd+Shift+D on Mac): Download all images on page
- **Ctrl+Shift+G** (Cmd+Shift+G on Mac): Toggle image grabber

### Context Menu
- Right-click on any image → "Download Image with KellyC"
- Right-click on page → "Download All Images on Page"
- Select text with images → "Download Selected Images"

### Features
1. **Smart Detection**: Automatically finds all images including those loaded dynamically
2. **Filter Options**: Set minimum dimensions, exclude certain types
3. **Batch Download**: Download multiple images with smart naming
4. **Site Profiles**: Optimized for 30+ popular websites
5. **Download Manager**: Track progress, retry failed downloads

## 🛠️ Configuration

Access settings through the extension popup or options page:

- **Download Path**: Set custom folder for downloads
- **Concurrent Downloads**: Adjust simultaneous download limit (1-10)
- **Auto Retry**: Enable/disable automatic retry for failed downloads
- **Notifications**: Toggle download notifications
- **Image Filters**: Set minimum width/height, exclude data URLs or SVGs
- **Enhanced Mode**: Enable site-specific optimizations

## 🌐 Supported Sites

Enhanced support for:
- Social Media: Twitter/X, Instagram, Facebook, VK, BlueSky
- Art Platforms: DeviantArt, ArtStation, Pixiv
- Forums: Reddit, 9GAG, Pikabu
- Image Hosts: Flickr, Discord
- Search Engines: Yandex Images
- Adult Content: e-hentai, Kemono Party
- And many more...

## 🔧 Troubleshooting

### Common Issues

1. **Images not downloading**: Check if the site requires login or has anti-scraping measures
2. **CORS errors**: The extension includes CORS bypass rules, but some sites may still block
3. **Filename issues**: Special characters are automatically sanitized
4. **Memory usage**: For pages with many images, use batch download with limits

### Debug Mode
Open the browser console and look for KellyC logs to troubleshoot issues.

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## 🙏 Credits

- Original KellyC Image Downloader by [nradiowave](https://github.com/NC22/KellyC-Image-Downloader)
- Enhanced version improvements by contributors

## 📝 Changelog

### v1.3.0 (Enhanced)
- Added multi-browser support (Chrome MV3 + Firefox MV2)
- Implemented advanced download queue system
- Added keyboard shortcuts and context menus
- Enhanced site-specific image detection
- Improved error handling and retry logic
- Added notification system
- Optimized performance and memory usage
- Added build system for easy deployment

### v1.2.9.5 (Original)
- Base functionality from original KellyC Image Downloader

---

**Note**: This is an enhanced fork. For the original extension, visit the [original repository](https://github.com/NC22/KellyC-Image-Downloader).

<h1><img src="https://catface.ru/userfiles/media/udata_1544561629_uixtxchu.png" width="32"> KellyC Image Downloader</h1>

<p>Due to low interest in the project, the project has been removed from all extension stores and left for personal use as an open source project. The project remains free and open source, any forks \ modifications are welcome</p>
<p>Из за низкого интереса к проекту, проект убран со всех магазинов расширений и оставлен для личного использования в качестве открытого проекта. Проект остается бесплатным и открытым, любые изменения под себя приветствуются</p>

<!--
![GitHub](https://img.shields.io/github/license/nc22/KellyCImageDownloader) ![Chrome Web Store](https://img.shields.io/chrome-web-store/users/mbhkdmjolnhcppnkldbdfaomeabjiofm?label=chrome%20users%3A) ![Chrome Web Store](https://img.shields.io/chrome-web-store/rating/mbhkdmjolnhcppnkldbdfaomeabjiofm) ![Mozilla Add-on](https://img.shields.io/amo/users/kellyc-favorites?label=firefox%20users%3A) ![Mozilla Add-on](https://img.shields.io/amo/rating/kellyc-favorites)
-->

<p></p>
<!--h2>Install</h2>
<p><b>Install</b> for <a href="https://chrome.google.com/webstore/detail/kellyc-favorites/mbhkdmjolnhcppnkldbdfaomeabjiofm?hl=en">Chrome</a>, <a href="https://addons.mozilla.org/ru/firefox/addon/kellyc-favorites/">FireFox</a>, <a href="https://microsoftedge.microsoft.com/addons/detail/kellyc-image-downloader/dgjfegjceojpbngijkaekoihllhhdocn">Edge</a>, <a href="https://kellydownloader.com/ru/install-opera/">Opera</a></p>
<p></p-->
<h2>Manual install</h2>
<p><a href="https://github.com/NC22/KellyC-Image-Downloader/wiki/Install-extension-manually">How to install manualy from source code or from releases</a></p>
<p></p>
<p></p>
<h2>EN | Description</h2>
<p>A browser extension for batch downloading artworks and images from sites. It allows you to download all images on the page filtering by size or other settings.</p>
<p>Some of the sites (priority to Pixiv, Pinterest, Twitter, Joyreactor) support extended features for collect "Original" version of images from preview automatically without use filters by size manually.</p>
<p>"Load related document" - feature allows you to download additional images from related documents of preview, if original image is not actually placed on current page. (may be helpful in some cases, check if site is supported)</p>


<p></p>
<h2>RU | Описание</h2>
<p>Расширение для пакетного скачивания картинок \ творчества с любых сайтов. Поддерживаются фильтры по пропорциям, строке url, загрузка дочерних документов.</p>
<p></p>
<p>Некоторые сайты поддерживают дополнительный функционал, позволяющий быстро захватить оригиналы изображений без дополнительной фильтрации в ручную.</p>
<p>Функция "Загрузка дочерних документов" используется если на основной странице доступно только изображение с низким разрешением и ссылка ведет на страницу с оригиналом. (функционал поумолчанию может не всегда сработать, см. страницу поддержки сайтов)</p>
<p></p>
<p></p>

<p></p>
<h2>License</h2>
<br>
<a href="http://www.gnu.org/licenses/gpl.html">GNU General Public License v3</a>
<br>
<br>