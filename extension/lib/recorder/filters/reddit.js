KellyRecorderFilterReddit = new Object();
KellyRecorderFilterReddit.manifest = {host : 'reddit.com', detectionLvl : ['imageOriginal', 'imagePreview', 'imageByDocument']};

KellyRecorderFilterReddit.addItemByDriver = function(handler, data) {
    
    if (handler.url.indexOf('reddit.com') == -1) return;
    
    // Skip if already processed as image
    if (data.el.getAttribute('data-click-id') == 'image') return handler.addDriverAction.SKIP;
    
    // Handle post containers
    if (data.el.getAttribute('data-testid') && data.el.getAttribute('data-testid') == 'post-container') {
        
        var preview = false;
        
        // Handle different Reddit page types
        if (handler.url.indexOf('/user/') != -1 || handler.url.indexOf('/search/?q=') != -1) {
            preview = data.el.querySelector('[data-click-id="image"]');
            if (preview) {
                handler.addSrcFromStyle(preview, data.item, 'reddit_post');
            }
        }
        
        // Look for media content
        if (!preview) {
            // Try multiple selectors for media content
            var mediaSelectors = [
                '[data-click-id="media"] img',
                '[data-testid="post-image"] img',
                '[data-testid="post-media"] img',
                '.media-preview img',
                '.post-media img',
                'img[src*="redd.it"]',
                'img[src*="imgur.com"]'
            ];
            
            for (var i = 0; i < mediaSelectors.length; i++) {
                preview = data.el.querySelector(mediaSelectors[i]);
                if (preview) {
                    handler.addSingleSrc(data.item, preview.src, 'addSrcFromAttributes-src', preview, 'reddit_post');
                    break;
                }
            }
        }
        
        // Look for gallery images
        if (!preview) {
            var galleryImages = data.el.querySelectorAll('[data-testid="gallery-image"], .gallery-image img, [data-testid="post-image"] img');
            if (galleryImages.length > 0) {
                galleryImages.forEach(function(img) {
                    if (img.src && img.src.indexOf('redd.it') !== -1) {
                        handler.addSingleSrc(data.item, img.src, 'addSrcFromAttributes-src', img, 'reddit_gallery');
                    }
                });
            }
        }
        
        // Look for video thumbnails
        if (!preview) {
            var videoThumb = data.el.querySelector('video[poster], [data-testid="video-thumbnail"] img');
            if (videoThumb) {
                var posterSrc = videoThumb.poster || videoThumb.src;
                if (posterSrc) {
                    handler.addSingleSrc(data.item, posterSrc, 'addSrcFromAttributes-poster', videoThumb, 'reddit_video');
                }
            }
        }
        
        // Add related document link
        var link = data.el.querySelector('a[data-click-id="body"]');
        if (link) {
            data.item.relatedDoc = link.href;
        } else {
            data.item.relatedSrc = [];
        }
        
        return data.item.relatedSrc.length > 0 ? handler.addDriverAction.ADD : handler.addDriverAction.SKIP;
    }
    
    // Handle standalone images and media
    if (data.el.tagName === 'IMG' && (data.el.src.indexOf('redd.it') !== -1 || data.el.src.indexOf('imgur.com') !== -1)) {
        handler.addSingleSrc(data.item, data.el.src, 'addSrcFromAttributes-src', data.el, 'reddit_standalone');
        return handler.addDriverAction.ADD;
    }
    
    return handler.addDriverAction.SKIP;
}

KellyRecorderFilterReddit.parseImagesDocByDriver = function(handler, data) {    
     
    if (handler.url.indexOf('reddit.com') == -1) return;
    
    // Try multiple Reddit data sources
    var redditData = null;
    
    // Method 1: Try modern Reddit data structure
    var modernDataRegExp = /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/g;
    var modernData = modernDataRegExp.exec(data.thread.response);
    
    if (modernData) {
        try {
            redditData = JSON.parse(modernData[1]);
        } catch (e) {
            console.log('Failed to parse modern Reddit data:', e);
        }
    }
    
    // Method 2: Try legacy Reddit data structure
    if (!redditData) {
        var legacyDataRegExp = /window\.___r\s*=\s*\{([\s\S]*)\}\}\;\<\/script/g;
        var legacyData = legacyDataRegExp.exec(data.thread.response);
        
        if (legacyData) {
            try {
                redditData = JSON.parse('{' + legacyData[1] + '}}');
            } catch (e) {
                console.log('Failed to parse legacy Reddit data:', e);
            }
        }
    }
    
    // Method 3: Try Reddit API response data
    if (!redditData) {
        var apiDataRegExp = /"posts":\s*\{([\s\S]*?)\}/g;
        var apiData = apiDataRegExp.exec(data.thread.response);
        
        if (apiData) {
            try {
                redditData = { posts: { models: {} } };
                // Extract post data manually
                var postMatches = data.thread.response.match(/"id":"([^"]+)","media":\{([^}]+)\}/g);
                if (postMatches) {
                    postMatches.forEach(function(match) {
                        var idMatch = match.match(/"id":"([^"]+)"/);
                        var mediaMatch = match.match(/"content":"([^"]+)"/);
                        if (idMatch && mediaMatch) {
                            redditData.posts.models[idMatch[1]] = {
                                media: { content: mediaMatch[1] }
                            };
                        }
                    });
                }
            } catch (e) {
                console.log('Failed to parse API Reddit data:', e);
            }
        }
    }
    
    // Process extracted data
    if (redditData && redditData.posts && redditData.posts.models) {
        
        for (var postId in redditData.posts.models) {
            
            var model = redditData.posts.models[postId];
            
            // Handle media metadata (high quality images)
            if (model.media && model.media.mediaMetadata) {
                for (var mediaId in model.media.mediaMetadata) {
                    
                    if (model.media.mediaMetadata[mediaId].s && model.media.mediaMetadata[mediaId].s.u) {
                        
                        handler.imagesPool.push({
                            relatedSrc : [ model.media.mediaMetadata[mediaId].s.u ], 
                            relatedGroups : [['reddit_orig']] 
                        });
                    }
                    
                }
                
            } else if (model.media && model.media.content) {
                // Handle direct media content
                handler.imagesPool.push({
                    relatedSrc : [ model.media.content ], 
                    relatedGroups : [['reddit_orig']] 
                });
            }
            
            // Handle gallery images
            if (model.media && model.media.mediaMetadata) {
                var galleryUrls = [];
                for (var mediaId in model.media.mediaMetadata) {
                    if (model.media.mediaMetadata[mediaId].s && model.media.mediaMetadata[mediaId].s.u) {
                        galleryUrls.push(model.media.mediaMetadata[mediaId].s.u);
                    }
                }
                if (galleryUrls.length > 1) {
                    handler.imagesPool.push({
                        relatedSrc : galleryUrls,
                        relatedGroups : [['reddit_gallery']] 
                    });
                }
            }
            
            // Only process first post for performance
            break;
        }
    }
    
    // Fallback: Extract images from HTML directly
    if (handler.imagesPool.length === 0) {
        var imgMatches = data.thread.response.match(/https?:\/\/(?:i\.redd\.it|preview\.redd\.it|i\.imgur\.com)\/[^"'\s]+/g);
        if (imgMatches) {
            var uniqueUrls = [...new Set(imgMatches)];
            uniqueUrls.forEach(function(url) {
                if (url.indexOf('award_images') === -1) { // Skip award images
                    handler.imagesPool.push({
                        relatedSrc : [ url ],
                        relatedGroups : [['reddit_fallback']] 
                    });
                }
            });
        }
    }
    
    return true;
}
     
KellyRecorderFilterReddit.onStartRecord = function(handler, data) {
     if (handler.url.indexOf('reddit.com') == -1) return;
     
     handler.additionCats = {
        reddit_post : {name : 'Post (Preview)', color : '#b7dd99', selected : 90},
        reddit_orig : {name : 'Post media', color : '#b7dd99', selected : 91},
        reddit_gallery : {name : 'Gallery images', color : '#ff6b6b', selected : 92},
        reddit_video : {name : 'Video thumbnails', color : '#4ecdc4', selected : 93},
        reddit_standalone : {name : 'Standalone images', color : '#45b7d1', selected : 94},
        reddit_fallback : {name : 'Fallback images', color : '#96ceb4', selected : 95},
        reddit_imgur : {name : 'Imgur images', color : '#ffa726', selected : 96}
     };
     
     // Set up modern Reddit UI detection
     setupModernRedditDetection(handler);
     
     // Set up new Reddit interface detection
     KellyRecorderFilterReddit.handleNewRedditInterface(handler);
}

// Modern Reddit UI detection and enhancement
function setupModernRedditDetection(handler) {
    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initModernRedditDetection(handler);
        });
    } else {
        initModernRedditDetection(handler);
    }
}

function initModernRedditDetection(handler) {
    // Set up mutation observer for dynamic content
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        scanForRedditImages(node, handler);
                    }
                });
            }
        });
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Initial scan
    scanForRedditImages(document.body, handler);
}

function scanForRedditImages(element, handler) {
    // Look for modern Reddit post containers
    const postContainers = element.querySelectorAll ? 
        element.querySelectorAll('[data-testid="post-container"], [data-testid="post"], .Post') : 
        [];
    
    postContainers.forEach(function(container) {
        scanPostContainer(container, handler);
    });
    
    // Look for standalone images
    const images = element.querySelectorAll ? 
        element.querySelectorAll('img[src*="redd.it"], img[src*="imgur.com"], img[src*="redditmedia.com"]') : 
        [];
    
    images.forEach(function(img) {
        if (img.src && !img.dataset.kellycProcessed) {
            img.dataset.kellycProcessed = 'true';
            processRedditImage(img, handler);
        }
    });
}

function scanPostContainer(container, handler) {
    if (container.dataset.kellycProcessed) return;
    container.dataset.kellycProcessed = 'true';
    
    // Look for media content
    const mediaElements = container.querySelectorAll('[data-testid="post-image"], [data-testid="post-media"], .media-preview, .Post__media');
    
    mediaElements.forEach(function(media) {
        const images = media.querySelectorAll('img');
        images.forEach(function(img) {
            if (img.src && !img.dataset.kellycProcessed) {
                img.dataset.kellycProcessed = 'true';
                processRedditImage(img, handler);
            }
        });
        
        // Handle video elements
        const videos = media.querySelectorAll('video');
        videos.forEach(function(video) {
            if (video.poster && !video.dataset.kellycProcessed) {
                video.dataset.kellycProcessed = 'true';
                processRedditVideo(video, handler);
            }
        });
    });
    
    // Look for gallery indicators
    const galleryIndicators = container.querySelectorAll('[data-testid="gallery-indicator"], .gallery-indicator');
    if (galleryIndicators.length > 0) {
        // This is a gallery post, try to extract all images
        extractGalleryImages(container, handler);
    }
}

function processRedditImage(img, handler) {
    const url = img.src;
    if (!url || url.includes('award_images')) return;
    
    // Create a mock data item for the handler
    const mockData = {
        item: {
            relatedSrc: [],
            relatedGroups: []
        }
    };
    
    // Determine image category
    let category = 'reddit_post';
    if (url.includes('gallery') || url.includes('g.redditmedia.com')) {
        category = 'reddit_gallery';
    } else if (url.includes('i.redd.it')) {
        category = 'reddit_orig';
    }
    
    // Add to handler
    handler.addSingleSrc(mockData.item, url, 'addSrcFromAttributes-src', img, category);
}

function processRedditVideo(video, handler) {
    const posterUrl = video.poster;
    if (!posterUrl) return;
    
    const mockData = {
        item: {
            relatedSrc: [],
            relatedGroups: []
        }
    };
    
    handler.addSingleSrc(mockData.item, posterUrl, 'addSrcFromAttributes-poster', video, 'reddit_video');
}

function extractGalleryImages(container, handler) {
    // Try to find gallery data in the container
    const galleryData = container.querySelector('[data-testid="gallery-data"], .gallery-data');
    if (galleryData) {
        try {
            const data = JSON.parse(galleryData.textContent || galleryData.dataset.galleryData || '{}');
            if (data.images) {
                data.images.forEach(function(image) {
                    if (image.url && !image.url.includes('award_images')) {
                        const mockData = {
                            item: {
                                relatedSrc: [],
                                relatedGroups: []
                            }
                        };
                        handler.addSingleSrc(mockData.item, image.url, 'addSrcFromAttributes-src', container, 'reddit_gallery');
                    }
                });
            }
        } catch (e) {
            console.log('Failed to parse gallery data:', e);
        }
    }
}

KellyRecorderFilterReddit.handleNewRedditInterface = function(handler) {
    // Check if we're on the new Reddit interface
    if (window.location.hostname === 'www.reddit.com' || window.location.hostname === 'new.reddit.com') {
        setupNewRedditDetection(handler);
    }
};

function setupNewRedditDetection(handler) {
    // Wait for Reddit's React app to load
    const checkForRedditApp = setInterval(function() {
        const redditApp = document.querySelector('#root, [data-testid="reddit-app"]');
        if (redditApp) {
            clearInterval(checkForRedditApp);
            initNewRedditDetection(redditApp, handler);
        }
    }, 100);
    
    // Fallback: start detection after a delay
    setTimeout(function() {
        if (document.querySelector('#root')) {
            initNewRedditDetection(document.querySelector('#root'), handler);
        }
    }, 2000);
}

function initNewRedditDetection(rootElement, handler) {
    // Set up intersection observer for infinite scroll
    const postObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                scanNewRedditPost(entry.target, handler);
            }
        });
    }, { threshold: 0.1 });
    
    // Set up mutation observer for dynamic content
    const mutationObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        scanNewRedditContent(node, handler, postObserver);
                    }
                });
            }
        });
    });
    
    // Start observing
    mutationObserver.observe(rootElement, {
        childList: true,
        subtree: true
    });
    
    // Initial scan
    scanNewRedditContent(rootElement, handler, postObserver);
}

function scanNewRedditContent(element, handler, postObserver) {
    // Look for new Reddit post containers
    const postSelectors = [
        '[data-testid="post-container"]',
        '[data-testid="post"]',
        '[data-testid="post-content"]',
        '.Post',
        '[data-testid="subreddit-post"]'
    ];
    
    postSelectors.forEach(function(selector) {
        const posts = element.querySelectorAll(selector);
        posts.forEach(function(post) {
            if (!post.dataset.kellycProcessed) {
                post.dataset.kellycProcessed = 'true';
                scanNewRedditPost(post, handler);
                postObserver.observe(post);
            }
        });
    });
    
    // Look for standalone media
    const mediaSelectors = [
        '[data-testid="post-image"]',
        '[data-testid="post-media"]',
        '[data-testid="gallery-image"]',
        '.Post__media',
        '.media-preview'
    ];
    
    mediaSelectors.forEach(function(selector) {
        const mediaElements = element.querySelectorAll(selector);
        mediaElements.forEach(function(media) {
            if (!media.dataset.kellycProcessed) {
                media.dataset.kellycProcessed = 'true';
                processNewRedditMedia(media, handler);
            }
        });
    });
}

function scanNewRedditPost(post, handler) {
    // Look for media content in the post
    const mediaElements = post.querySelectorAll('[data-testid="post-image"], [data-testid="post-media"], .Post__media');
    
    mediaElements.forEach(function(media) {
        processNewRedditMedia(media, handler);
    });
    
    // Look for gallery indicators
    const galleryIndicator = post.querySelector('[data-testid="gallery-indicator"], .gallery-indicator');
    if (galleryIndicator) {
        extractNewRedditGallery(post, handler);
    }
    
    // Look for video content
    const videoElement = post.querySelector('video, [data-testid="video-player"]');
    if (videoElement) {
        processNewRedditVideo(videoElement, handler);
    }
}

function processNewRedditMedia(media, handler) {
    // Look for images
    const images = media.querySelectorAll('img');
    images.forEach(function(img) {
        if (img.src && !img.dataset.kellycProcessed) {
            img.dataset.kellycProcessed = 'true';
            processNewRedditImage(img, handler);
        }
    });
    
    // Look for background images
    const style = window.getComputedStyle(media);
    const bgImage = style.backgroundImage;
    if (bgImage && bgImage !== 'none') {
        const url = bgImage.replace(/url\(['"]?(.*?)['"]?\)/g, '$1');
        if (url && url.includes('redd.it')) {
            processNewRedditImage({ src: url, dataset: {} }, handler);
        }
    }
}

function processNewRedditImage(img, handler) {
    const url = img.src;
    if (!url || url.includes('award_images') || url.includes('emoji')) return;
    
    // Determine image category
    let category = 'reddit_post';
    if (url.includes('gallery') || url.includes('g.redditmedia.com')) {
        category = 'reddit_gallery';
    } else if (url.includes('i.redd.it')) {
        category = 'reddit_orig';
    } else if (url.includes('i.imgur.com')) {
        category = 'reddit_imgur';
    }
    
    // Create mock data for handler
    const mockData = {
        item: {
            relatedSrc: [],
            relatedGroups: []
        }
    };
    
    handler.addSingleSrc(mockData.item, url, 'addSrcFromAttributes-src', img, category);
}

function processNewRedditVideo(video, handler) {
    const posterUrl = video.poster || video.dataset.poster;
    if (!posterUrl) return;
    
    const mockData = {
        item: {
            relatedSrc: [],
            relatedGroups: []
        }
    };
    
    handler.addSingleSrc(mockData.item, posterUrl, 'addSrcFromAttributes-poster', video, 'reddit_video');
}

function extractNewRedditGallery(post, handler) {
    // Try to find gallery data
    const galleryData = post.querySelector('[data-testid="gallery-data"], .gallery-data, [data-gallery-data]');
    if (galleryData) {
        try {
            let data;
            if (galleryData.dataset.galleryData) {
                data = JSON.parse(galleryData.dataset.galleryData);
            } else if (galleryData.textContent) {
                data = JSON.parse(galleryData.textContent);
            }
            
            if (data && data.images) {
                data.images.forEach(function(image) {
                    if (image.url && !image.url.includes('award_images')) {
                        const mockData = {
                            item: {
                                relatedSrc: [],
                                relatedGroups: []
                            }
                        };
                        handler.addSingleSrc(mockData.item, image.url, 'addSrcFromAttributes-src', post, 'reddit_gallery');
                    }
                });
            }
        } catch (e) {
            console.log('Failed to parse new Reddit gallery data:', e);
        }
    }
    
    // Fallback: look for gallery images directly
    const galleryImages = post.querySelectorAll('[data-testid="gallery-image"], .gallery-image img');
    galleryImages.forEach(function(img) {
        if (img.src && !img.dataset.kellycProcessed) {
            img.dataset.kellycProcessed = 'true';
            processNewRedditImage(img, handler);
        }
    });
}

KellyPageWatchdog.validators.push({
    url : 'reddit.com', 
    host : 'reddit.com', 
    patterns : [
        ['preview.redd.it/award_images', 'imageTrash'],
        ['preview.redd.it', 'imagePreview'], 
        ['i.imgur.com', 'imagePreview'], 
        ['i.redd.it', 'imagePreview'],
        ['v.redd.it', 'imagePreview'],
        ['g.redditmedia.com', 'imagePreview']
    ]
});

KellyPageWatchdog.filters.push(KellyRecorderFilterReddit);