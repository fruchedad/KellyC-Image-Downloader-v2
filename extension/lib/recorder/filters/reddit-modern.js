/**
 * KellyC Reddit Modern Interface Handler
 * Enhanced image detection for Reddit's new React-based interface
 */

var KellyRedditModernHandler = (function() {
    'use strict';
    
    const handler = {
        isActive: false,
        observer: null,
        processedElements: new Set(),
        imageCache: new Map(),
        
        init: function() {
            if (this.isActive) return;
            this.isActive = true;
            
            // Wait for Reddit to load
            this.waitForReddit();
        },
        
        waitForReddit: function() {
            // Check if we're on Reddit
            if (!window.location.hostname.includes('reddit.com')) return;
            
            // Wait for Reddit's React app to load
            const checkInterval = setInterval(() => {
                const redditApp = document.querySelector('#root, [data-testid="reddit-app"]');
                if (redditApp) {
                    clearInterval(checkInterval);
                    this.startDetection(redditApp);
                }
            }, 100);
            
            // Fallback: start after delay
            setTimeout(() => {
                if (document.querySelector('#root')) {
                    this.startDetection(document.querySelector('#root'));
                }
            }, 3000);
        },
        
        startDetection: function(rootElement) {
            console.log('KellyC: Starting Reddit modern interface detection');
            
            // Set up intersection observer for infinite scroll
            this.setupIntersectionObserver();
            
            // Set up mutation observer for dynamic content
            this.setupMutationObserver(rootElement);
            
            // Initial scan
            this.scanForImages(rootElement);
        },
        
        setupIntersectionObserver: function() {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.scanForImages(entry.target);
                    }
                });
            }, { threshold: 0.1 });
        },
        
        setupMutationObserver: function(rootElement) {
            const mutationObserver = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                this.scanForImages(node);
                            }
                        });
                    }
                });
            });
            
            mutationObserver.observe(rootElement, {
                childList: true,
                subtree: true
            });
        },
        
        scanForImages: function(element) {
            if (!element || this.processedElements.has(element)) return;
            this.processedElements.add(element);
            
            // Look for post containers
            this.findPostContainers(element);
            
            // Look for standalone media
            this.findStandaloneMedia(element);
            
            // Look for gallery content
            this.findGalleryContent(element);
            
            // Look for video content
            this.findVideoContent(element);
        },
        
        findPostContainers: function(element) {
            const selectors = [
                '[data-testid="post-container"]',
                '[data-testid="post"]',
                '[data-testid="post-content"]',
                '.Post',
                '[data-testid="subreddit-post"]',
                '[data-testid="comment"]'
            ];
            
            selectors.forEach(selector => {
                const containers = element.querySelectorAll(selector);
                containers.forEach(container => {
                    this.processPostContainer(container);
                    // Observe for intersection
                    if (this.observer) {
                        this.observer.observe(container);
                    }
                });
            });
        },
        
        processPostContainer: function(container) {
            if (this.processedElements.has(container)) return;
            this.processedElements.add(container);
            
            // Look for media content
            this.findMediaInContainer(container);
            
            // Look for gallery indicators
            this.findGalleryInContainer(container);
            
            // Look for video content
            this.findVideoInContainer(container);
        },
        
        findMediaInContainer: function(container) {
            const mediaSelectors = [
                '[data-testid="post-image"]',
                '[data-testid="post-media"]',
                '[data-testid="gallery-image"]',
                '.Post__media',
                '.media-preview',
                '[data-testid="media-preview"]'
            ];
            
            mediaSelectors.forEach(selector => {
                const mediaElements = container.querySelectorAll(selector);
                mediaElements.forEach(media => {
                    this.processMediaElement(media);
                });
            });
        },
        
        processMediaElement: function(media) {
            if (this.processedElements.has(media)) return;
            this.processedElements.add(media);
            
            // Look for images
            const images = media.querySelectorAll('img');
            images.forEach(img => {
                this.processImage(img);
            });
            
            // Look for background images
            this.processBackgroundImage(media);
            
            // Look for data attributes
            this.processDataAttributes(media);
        },
        
        processImage: function(img) {
            if (!img.src || this.processedElements.has(img)) return;
            this.processedElements.add(img);
            
            const url = img.src;
            if (!this.isValidRedditImage(url)) return;
            
            // Cache the image
            this.imageCache.set(url, {
                element: img,
                timestamp: Date.now(),
                category: this.categorizeImage(url)
            });
            
            // Trigger image detection event
            this.triggerImageDetection(url, img);
        },
        
        processBackgroundImage: function(element) {
            const style = window.getComputedStyle(element);
            const bgImage = style.backgroundImage;
            
            if (bgImage && bgImage !== 'none') {
                const url = bgImage.replace(/url\(['"]?(.*?)['"]?\)/g, '$1');
                if (this.isValidRedditImage(url)) {
                    this.imageCache.set(url, {
                        element: element,
                        timestamp: Date.now(),
                        category: this.categorizeImage(url),
                        type: 'background'
                    });
                    
                    this.triggerImageDetection(url, element);
                }
            }
        },
        
        processDataAttributes: function(element) {
            // Look for data attributes that might contain image URLs
            const dataAttrs = ['data-image', 'data-src', 'data-poster', 'data-thumbnail'];
            
            dataAttrs.forEach(attr => {
                const value = element.dataset[attr];
                if (value && this.isValidRedditImage(value)) {
                    this.imageCache.set(value, {
                        element: element,
                        timestamp: Date.now(),
                        category: this.categorizeImage(value),
                        type: 'data-attribute'
                    });
                    
                    this.triggerImageDetection(value, element);
                }
            });
        },
        
        findStandaloneMedia: function(element) {
            const imageSelectors = [
                'img[src*="redd.it"]',
                'img[src*="imgur.com"]',
                'img[src*="redditmedia.com"]',
                'img[src*="reddit.com"]'
            ];
            
            imageSelectors.forEach(selector => {
                const images = element.querySelectorAll(selector);
                images.forEach(img => {
                    this.processImage(img);
                });
            });
        },
        
        findGalleryContent: function(element) {
            const gallerySelectors = [
                '[data-testid="gallery-indicator"]',
                '.gallery-indicator',
                '[data-testid="gallery-data"]',
                '.gallery-data'
            ];
            
            gallerySelectors.forEach(selector => {
                const galleries = element.querySelectorAll(selector);
                galleries.forEach(gallery => {
                    this.processGallery(gallery);
                });
            });
        },
        
        processGallery: function(gallery) {
            if (this.processedElements.has(gallery)) return;
            this.processedElements.add(gallery);
            
            // Try to extract gallery data
            this.extractGalleryData(gallery);
            
            // Look for gallery images
            const galleryImages = gallery.querySelectorAll('[data-testid="gallery-image"], .gallery-image img');
            galleryImages.forEach(img => {
                this.processImage(img);
            });
        },
        
        extractGalleryData: function(gallery) {
            try {
                let data;
                
                // Try different data sources
                if (gallery.dataset.galleryData) {
                    data = JSON.parse(gallery.dataset.galleryData);
                } else if (gallery.textContent) {
                    data = JSON.parse(gallery.textContent);
                } else if (gallery.dataset.gallery) {
                    data = JSON.parse(gallery.dataset.gallery);
                }
                
                if (data && data.images) {
                    data.images.forEach(image => {
                        if (image.url && this.isValidRedditImage(image.url)) {
                            this.imageCache.set(image.url, {
                                element: gallery,
                                timestamp: Date.now(),
                                category: 'reddit_gallery',
                                type: 'gallery-data'
                            });
                            
                            this.triggerImageDetection(image.url, gallery);
                        }
                    });
                }
            } catch (e) {
                console.log('KellyC: Failed to parse gallery data:', e);
            }
        },
        
        findVideoContent: function(element) {
            const videoSelectors = [
                'video',
                '[data-testid="video-player"]',
                '[data-testid="video-thumbnail"]'
            ];
            
            videoSelectors.forEach(selector => {
                const videos = element.querySelectorAll(selector);
                videos.forEach(video => {
                    this.processVideo(video);
                });
            });
        },
        
        processVideo: function(video) {
            if (this.processedElements.has(video)) return;
            this.processedElements.add(video);
            
            // Look for poster image
            if (video.poster) {
                this.processImage({ src: video.poster, dataset: {} });
            }
            
            // Look for data attributes
            this.processDataAttributes(video);
        },
        
        isValidRedditImage: function(url) {
            if (!url) return false;
            
            // Skip invalid URLs
            if (url.includes('award_images') || 
                url.includes('emoji') || 
                url.includes('avatar') ||
                url.includes('icon') ||
                url.startsWith('data:')) {
                return false;
            }
            
            // Check if it's a Reddit-related image
            return url.includes('redd.it') || 
                   url.includes('imgur.com') || 
                   url.includes('redditmedia.com') ||
                   url.includes('reddit.com');
        },
        
        categorizeImage: function(url) {
            if (url.includes('gallery') || url.includes('g.redditmedia.com')) {
                return 'reddit_gallery';
            } else if (url.includes('i.redd.it')) {
                return 'reddit_orig';
            } else if (url.includes('i.imgur.com')) {
                return 'reddit_imgur';
            } else if (url.includes('v.redd.it')) {
                return 'reddit_video';
            } else if (url.includes('preview.redd.it')) {
                return 'reddit_preview';
            }
            
            return 'reddit_post';
        },
        
        triggerImageDetection: function(url, element) {
            // Create a custom event to notify the main extension
            const event = new CustomEvent('kellyc-reddit-image-detected', {
                detail: {
                    url: url,
                    element: element,
                    category: this.imageCache.get(url)?.category || 'reddit_post',
                    timestamp: Date.now()
                }
            });
            
            document.dispatchEvent(event);
        },
        
        getDetectedImages: function() {
            return Array.from(this.imageCache.entries()).map(([url, data]) => ({
                url: url,
                category: data.category,
                timestamp: data.timestamp,
                type: data.type
            }));
        },
        
        clearCache: function() {
            this.imageCache.clear();
            this.processedElements.clear();
        },
        
        destroy: function() {
            this.isActive = false;
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            this.clearCache();
        }
    };
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => handler.init());
    } else {
        handler.init();
    }
    
    return handler;
})();

// Export for global access
if (typeof window !== 'undefined') {
    window.KellyRedditModernHandler = KellyRedditModernHandler;
}