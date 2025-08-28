/**
 * KellyC Enhanced Image Detector
 * Advanced image detection with lazy-loading support and mutation observation
 */

var KellyEnhancedImageDetector = (function() {
    'use strict';
    
    const detector = {
        images: new Map(),
        observers: new Map(),
        config: {
            minWidth: 100,
            minHeight: 100,
            includeBackground: true,
            includeSVG: true,
            includeCanvas: true,
            includeVideo: true,
            detectLazyLoad: true,
            detectDynamicLoad: true
        },
        
        init: function(customConfig) {
            this.config = Object.assign({}, this.config, customConfig || {});
            this.startDetection();
            return this;
        },
        
        startDetection: function() {
            // Initial scan
            this.scanDocument();
            
            // Set up mutation observer for dynamic content
            if (this.config.detectDynamicLoad) {
                this.setupMutationObserver();
            }
            
            // Set up intersection observer for lazy-loaded images
            if (this.config.detectLazyLoad) {
                this.setupIntersectionObserver();
            }
            
            // Listen for custom events
            this.setupEventListeners();
        },
        
        scanDocument: function() {
            // Standard img tags
            this.scanImages();
            
            // Background images
            if (this.config.includeBackground) {
                this.scanBackgroundImages();
            }
            
            // SVG images
            if (this.config.includeSVG) {
                this.scanSVGImages();
            }
            
            // Canvas elements
            if (this.config.includeCanvas) {
                this.scanCanvasElements();
            }
            
            // Video thumbnails
            if (this.config.includeVideo) {
                this.scanVideoElements();
            }
            
            // Picture elements
            this.scanPictureElements();
            
            // Lazy-load attributes
            this.scanLazyLoadAttributes();
        },
        
        scanImages: function() {
            const images = document.querySelectorAll('img');
            images.forEach(img => this.processImage(img));
        },
        
        scanBackgroundImages: function() {
            const elements = document.querySelectorAll('*');
            elements.forEach(el => {
                const style = window.getComputedStyle(el);
                const bgImage = style.backgroundImage;
                
                if (bgImage && bgImage !== 'none') {
                    const urls = this.extractUrlsFromStyle(bgImage);
                    urls.forEach(url => {
                        if (this.isValidImageUrl(url)) {
                            this.addImage(url, 'background', el);
                        }
                    });
                }
            });
        },
        
        scanSVGImages: function() {
            // Inline SVGs
            const svgs = document.querySelectorAll('svg');
            svgs.forEach(svg => {
                const url = this.svgToDataUrl(svg);
                if (url) {
                    this.addImage(url, 'svg-inline', svg);
                }
            });
            
            // SVG in img tags
            const svgImgs = document.querySelectorAll('img[src$=".svg"], img[src*=".svg?"]');
            svgImgs.forEach(img => this.processImage(img));
        },
        
        scanCanvasElements: function() {
            const canvases = document.querySelectorAll('canvas');
            canvases.forEach(canvas => {
                try {
                    const url = canvas.toDataURL('image/png');
                    this.addImage(url, 'canvas', canvas);
                } catch (e) {
                    // Cross-origin canvas
                    console.warn('Cannot access canvas due to cross-origin restrictions');
                }
            });
        },
        
        scanVideoElements: function() {
            const videos = document.querySelectorAll('video');
            videos.forEach(video => {
                if (video.poster) {
                    this.addImage(video.poster, 'video-poster', video);
                }
                
                // Try to capture current frame
                if (video.readyState >= 2) {
                    this.captureVideoFrame(video);
                }
            });
        },
        
        scanPictureElements: function() {
            const pictures = document.querySelectorAll('picture');
            pictures.forEach(picture => {
                const sources = picture.querySelectorAll('source');
                sources.forEach(source => {
                    if (source.srcset) {
                        const urls = this.parseSrcset(source.srcset);
                        urls.forEach(urlData => {
                            this.addImage(urlData.url, 'picture-source', source);
                        });
                    }
                });
            });
        },
        
        scanLazyLoadAttributes: function() {
            const lazyAttrs = [
                'data-src', 'data-lazy', 'data-original', 'data-lazy-src',
                'data-srcset', 'data-lazy-srcset', 'data-bg', 'data-background'
            ];
            
            lazyAttrs.forEach(attr => {
                const elements = document.querySelectorAll(`[${attr}]`);
                elements.forEach(el => {
                    const value = el.getAttribute(attr);
                    if (value) {
                        if (attr.includes('srcset')) {
                            const urls = this.parseSrcset(value);
                            urls.forEach(urlData => {
                                this.addImage(urlData.url, 'lazy-srcset', el);
                            });
                        } else if (this.isValidImageUrl(value)) {
                            this.addImage(value, 'lazy-load', el);
                        }
                    }
                });
            });
        },
        
        processImage: function(img) {
            // Current src
            if (img.src && this.isValidImageUrl(img.src)) {
                this.addImage(img.src, 'img-src', img);
            }
            
            // Srcset
            if (img.srcset) {
                const urls = this.parseSrcset(img.srcset);
                urls.forEach(urlData => {
                    this.addImage(urlData.url, 'img-srcset', img);
                });
            }
            
            // Check for lazy-load attributes
            const lazyAttrs = ['data-src', 'data-lazy', 'data-original'];
            lazyAttrs.forEach(attr => {
                const value = img.getAttribute(attr);
                if (value && this.isValidImageUrl(value)) {
                    this.addImage(value, 'img-lazy', img);
                }
            });
        },
        
        setupMutationObserver: function() {
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1) { // Element node
                                this.scanElement(node);
                            }
                        });
                    } else if (mutation.type === 'attributes') {
                        if (mutation.target.tagName === 'IMG') {
                            this.processImage(mutation.target);
                        }
                    }
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src', 'srcset', 'data-src', 'style']
            });
            
            this.observers.set('mutation', observer);
        },
        
        setupIntersectionObserver: function() {
            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        // Re-scan the image when it becomes visible
                        this.processImage(img);
                    }
                });
            });
            
            // Observe all images
            document.querySelectorAll('img').forEach(img => {
                observer.observe(img);
            });
            
            this.observers.set('intersection', observer);
        },
        
        setupEventListeners: function() {
            // Listen for lazy-load library events
            const lazyLoadEvents = ['lazyloaded', 'load', 'unveiled'];
            lazyLoadEvents.forEach(eventName => {
                document.addEventListener(eventName, (e) => {
                    if (e.target.tagName === 'IMG') {
                        this.processImage(e.target);
                    }
                }, true);
            });
            
            // Listen for custom image load events
            document.addEventListener('kelly-image-detected', (e) => {
                if (e.detail && e.detail.url) {
                    this.addImage(e.detail.url, 'custom-event', e.target);
                }
            });
            
            // Reddit-specific event listeners
            if (window.location.hostname.includes('reddit.com')) {
                this.setupRedditSpecificListeners();
            }
        },
        
        setupRedditSpecificListeners: function() {
            // Listen for Reddit's dynamic content loading
            const redditObserver = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.addedNodes) {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1) { // Element node
                                // Check for Reddit gallery items
                                const galleryItems = node.querySelectorAll ? 
                                    node.querySelectorAll('[data-testid="gallery-item"], .gallery-item, ._3Oa0THmZ3f5iZXAsTrDTYz') : [];
                                galleryItems.forEach(item => this.scanElement(item));
                                
                                // Check for Reddit post content
                                const postContent = node.querySelectorAll ? 
                                    node.querySelectorAll('[data-testid="post-content"], .Post-body, .RichTextJSON-root') : [];
                                postContent.forEach(content => this.scanElement(content));
                                
                                // Check for video elements
                                const videos = node.querySelectorAll ? 
                                    node.querySelectorAll('video, [data-click-id="media"]') : [];
                                videos.forEach(video => this.processVideoElement(video));
                            }
                        });
                    }
                });
            });
            
            redditObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            this.observers.set('reddit-specific', redditObserver);
        },
        
        processVideoElement: function(video) {
            if (!this.config.includeVideo) return;
            
            let videoUrl = null;
            
            if (video.tagName === 'VIDEO') {
                videoUrl = video.src || (video.querySelector('source') && video.querySelector('source').src);
            } else {
                // Check for data attributes that might contain video URLs
                const dataAttrs = ['data-url', 'data-src', 'data-video-url', 'data-fallback-url'];
                for (const attr of dataAttrs) {
                    if (video.hasAttribute(attr)) {
                        videoUrl = video.getAttribute(attr);
                        break;
                    }
                }
            }
            
            if (videoUrl && this.isValidVideoUrl(videoUrl)) {
                this.addImage(videoUrl, 'video', video);
            }
        },
        
        isValidVideoUrl: function(url) {
            if (!url) return false;
            
            const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.gif'];
            const videoDomains = ['v.redd.it', 'redgifs.com', 'gfycat.com'];
            
            const lowerUrl = url.toLowerCase();
            
            return videoExts.some(ext => lowerUrl.includes(ext)) ||
                   videoDomains.some(domain => lowerUrl.includes(domain));
        },
        
        scanElement: function(element) {
            // Scan the element and its children
            if (element.tagName === 'IMG') {
                this.processImage(element);
            }
            
            // Scan children
            const images = element.querySelectorAll('img');
            images.forEach(img => this.processImage(img));
            
            // Check for background images
            if (this.config.includeBackground) {
                const style = window.getComputedStyle(element);
                const bgImage = style.backgroundImage;
                if (bgImage && bgImage !== 'none') {
                    const urls = this.extractUrlsFromStyle(bgImage);
                    urls.forEach(url => {
                        if (this.isValidImageUrl(url)) {
                            this.addImage(url, 'background', element);
                        }
                    });
                }
            }
        },
        
        addImage: function(url, type, element) {
            // Normalize URL
            url = this.normalizeUrl(url);
            
            if (!url || this.images.has(url)) {
                return;
            }
            
            // Check size requirements
            if (type === 'img-src' || type === 'img-srcset') {
                const width = element.naturalWidth || element.width;
                const height = element.naturalHeight || element.height;
                
                if (width && height && (width < this.config.minWidth || height < this.config.minHeight)) {
                    return;
                }
            }
            
            const imageData = {
                url: url,
                type: type,
                element: element,
                timestamp: Date.now(),
                metadata: this.extractMetadata(element)
            };
            
            this.images.set(url, imageData);
            
            // Dispatch event
            document.dispatchEvent(new CustomEvent('kelly-image-found', {
                detail: imageData
            }));
        },
        
        extractMetadata: function(element) {
            const metadata = {};
            
            if (element.tagName === 'IMG') {
                metadata.alt = element.alt;
                metadata.title = element.title;
                metadata.width = element.naturalWidth || element.width;
                metadata.height = element.naturalHeight || element.height;
            }
            
            // Try to get filename from URL
            try {
                const url = new URL(element.src || element.getAttribute('data-src') || '');
                const pathname = url.pathname;
                metadata.filename = pathname.substring(pathname.lastIndexOf('/') + 1);
            } catch (e) {}
            
            return metadata;
        },
        
        extractUrlsFromStyle: function(styleValue) {
            const urls = [];
            const regex = /url\(['"]?([^'"()]+)['"]?\)/g;
            let match;
            
            while ((match = regex.exec(styleValue)) !== null) {
                urls.push(match[1]);
            }
            
            return urls;
        },
        
        parseSrcset: function(srcset) {
            const sources = srcset.split(',').map(s => s.trim());
            return sources.map(source => {
                const parts = source.split(/\s+/);
                return {
                    url: parts[0],
                    descriptor: parts[1] || '1x'
                };
            });
        },
        
        normalizeUrl: function(url) {
            if (!url) return null;
            
            // Handle data URLs
            if (url.startsWith('data:')) {
                return url;
            }
            
            // Handle protocol-relative URLs
            if (url.startsWith('//')) {
                url = window.location.protocol + url;
            }
            
            // Handle relative URLs
            if (!url.startsWith('http')) {
                try {
                    url = new URL(url, window.location.href).href;
                } catch (e) {
                    return null;
                }
            }
            
            return url;
        },
        
        isValidImageUrl: function(url) {
            if (!url) return false;
            
            // Check for data URLs
            if (url.startsWith('data:image/')) {
                return !this.config.excludeDataUrls;
            }
            
            // Check for common image extensions
            const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)(\?.*)?$/i;
            if (imageExtensions.test(url)) {
                return true;
            }
            
            // Check for image URLs without extensions (common in CDNs)
            const imageCDNPatterns = [
                /\/(images?|img|media|static|assets)\//i,
                /\.(cloudinary|imgix|fastly|akamai|cloudfront)\./i,
                /\/image\//i
            ];
            
            return imageCDNPatterns.some(pattern => pattern.test(url));
        },
        
        svgToDataUrl: function(svg) {
            try {
                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(svg);
                const base64 = btoa(unescape(encodeURIComponent(svgString)));
                return `data:image/svg+xml;base64,${base64}`;
            } catch (e) {
                return null;
            }
        },
        
        captureVideoFrame: function(video) {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);
                const url = canvas.toDataURL('image/jpeg');
                this.addImage(url, 'video-frame', video);
            } catch (e) {
                console.warn('Cannot capture video frame:', e);
            }
        },
        
        getImages: function() {
            return Array.from(this.images.values());
        },
        
        getImagesByType: function(type) {
            return this.getImages().filter(img => img.type === type);
        },
        
        clear: function() {
            this.images.clear();
        },
        
        destroy: function() {
            // Clean up observers
            this.observers.forEach(observer => observer.disconnect());
            this.observers.clear();
            
            // Clear images
            this.images.clear();
        }
    };
    
    return detector;
})();

// Auto-initialize if in content script context
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    KellyEnhancedImageDetector.init();
} 