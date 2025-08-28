KellyRecorderFilterReddit = new Object();
KellyRecorderFilterReddit.manifest = {host : 'reddit.com', detectionLvl : ['imageOriginal', 'imagePreview', 'imageByDocument']};

KellyRecorderFilterReddit.addItemByDriver = function(handler, data) {
    
    if (handler.url.indexOf('reddit.com') == -1) return;
    
    if (data.el.getAttribute('data-click-id') == 'image') return handler.addDriverAction.SKIP;
    
    // Support both old and new Reddit post container selectors
    var isPostContainer = data.el.getAttribute('data-testid') == 'post-container' ||
                         data.el.classList.contains('Post') ||
                         data.el.getAttribute('data-testid') == 'post' ||
                         data.el.classList.contains('_1poyrkZ7g36PawDueRza-J');
    
    if (isPostContainer) {
        
        // Enhanced image detection for multiple Reddit UI versions
        var preview = false;
        var images = [];
        
        // Try multiple selectors for different Reddit versions
        var selectors = [
            '[data-click-id="image"]',
            '[data-click-id="media"] img',
            'img[src*="preview.redd.it"]',
            'img[src*="i.redd.it"]',
            'img[src*="i.imgur.com"]',
            '.ImageBox-image img',
            '._2_tDEnGMLxpM6uOa2kaDB3 img',
            '._3Oa0THmZ3f5iZXAsTrDTYz img',
            '.media-element img',
            '.gallery-item img',
            '[data-testid="post-content"] img',
            'figure img',
            '.RichTextJSON-root img'
        ];
        
        // Search for images using multiple selectors
        for (var i = 0; i < selectors.length; i++) {
            var foundImages = data.el.querySelectorAll(selectors[i]);
            for (var j = 0; j < foundImages.length; j++) {
                if (foundImages[j].src && images.indexOf(foundImages[j]) === -1) {
                    images.push(foundImages[j]);
                }
            }
        }
        
        // Also check for background images in Reddit posts
        var bgElements = data.el.querySelectorAll('[style*="background-image"]');
        for (var k = 0; k < bgElements.length; k++) {
            var bgStyle = bgElements[k].style.backgroundImage;
            if (bgStyle && bgStyle.includes('url(')) {
                handler.addSrcFromStyle(bgElements[k], data.item, 'reddit_post');
            }
        }
        
        // Process found images
        if (images.length > 0) {
            for (var m = 0; m < images.length; m++) {
                var img = images[m];
                if (img.src) {
                    handler.addSingleSrc(data.item, img.src, 'addSrcFromAttributes-src', img, 'reddit_post');
                }
                // Also check data-src for lazy-loaded images
                if (img.getAttribute('data-src')) {
                    handler.addSingleSrc(data.item, img.getAttribute('data-src'), 'addSrcFromAttributes-data-src', img, 'reddit_post');
                }
            }
            preview = images[0];
        }
        
        // Look for post link for document parsing
        var linkSelectors = [
            'a[data-click-id="body"]',
            'a[data-click-id="timestamp"]',
            'a[href*="/comments/"]',
            '.Post-body a',
            '[data-testid="post-content"] a'
        ];
        
        var link = null;
        for (var n = 0; n < linkSelectors.length; n++) {
            link = data.el.querySelector(linkSelectors[n]);
            if (link && link.href && link.href.includes('/comments/')) {
                break;
            }
        }
        
        if (link && link.href) {
            data.item.relatedDoc = link.href;
        } else {
            // Try to construct URL from post data
            var titleLink = data.el.querySelector('h3 a, [data-testid="post-title"] a, .Post-title a');
            if (titleLink && titleLink.href) {
                data.item.relatedDoc = titleLink.href;
            }
        }
        
        return data.item.relatedSrc.length > 0 || data.item.relatedDoc ? handler.addDriverAction.ADD : handler.addDriverAction.SKIP;
    }
}

KellyRecorderFilterReddit.parseImagesDocByDriver = function(handler, data) {    
     
    if (handler.url.indexOf('reddit.com') == -1) return;
    
    // Try multiple parsing strategies for different Reddit versions
    var foundImages = false;
    
    // Strategy 1: Modern Reddit JSON (window.__INITIAL_STATE__ or similar)
    try {
        var initialStateRegExp = /window\.__INITIAL_STATE__[\s]*=[\s]*([\s\S]*?)\;\s*\<\/script/g;
        var initialStateData = initialStateRegExp.exec(data.thread.response);
        
        if (initialStateData) {
            var state = JSON.parse(initialStateData[1]);
            foundImages = handler.parseRedditInitialState(state) || foundImages;
        }
    } catch (e) {
        console.log('Failed to parse __INITIAL_STATE__:', e);
    }
    
    // Strategy 2: Legacy Reddit data (window.___r)
    try {
        var pageDataRegExp = /window\.___r[\s]*=[\s]*\{([\s\S]*?)\}\}\;\s*\<\/script/g;
        var pageData = pageDataRegExp.exec(data.thread.response);
        
        if (pageData) {
            var redditData = JSON.parse('{' + pageData[1] + '}}');
            foundImages = handler.parseLegacyRedditData(redditData) || foundImages;
        }
    } catch (e) {
        console.log('Failed to parse legacy Reddit data:', e);
    }
    
    // Strategy 3: New Reddit GraphQL data
    try {
        var graphqlRegExp = /"data"\s*:\s*\{[\s\S]*?"children"[\s\S]*?\}/g;
        var graphqlMatches = data.thread.response.match(graphqlRegExp);
        
        if (graphqlMatches) {
            for (var i = 0; i < graphqlMatches.length; i++) {
                try {
                    var graphqlData = JSON.parse('{' + graphqlMatches[i] + '}');
                    foundImages = handler.parseGraphQLData(graphqlData) || foundImages;
                } catch (parseError) {
                    // Continue with next match
                }
            }
        }
    } catch (e) {
        console.log('Failed to parse GraphQL data:', e);
    }
    
    // Strategy 4: Direct HTML parsing for gallery posts and media
    try {
        foundImages = handler.parseHtmlContent(data.thread.response) || foundImages;
    } catch (e) {
        console.log('Failed to parse HTML content:', e);
    }
    
    return true;
};

// Helper function to parse modern Reddit initial state
KellyRecorderFilterReddit.parseRedditInitialState = function(state) {
    var foundImages = false;
    
    if (state && state.posts && state.posts.models) {
        for (var postId in state.posts.models) {
            var model = state.posts.models[postId];
            foundImages = this.parsePostModel(model) || foundImages;
        }
    }
    
    return foundImages;
};

// Helper function to parse legacy Reddit data
KellyRecorderFilterReddit.parseLegacyRedditData = function(redditData) {
    var foundImages = false;
    
    if (redditData && redditData.posts && redditData.posts.models) {
        for (var postId in redditData.posts.models) {
            var model = redditData.posts.models[postId];
            foundImages = this.parsePostModel(model) || foundImages;
            break; // Legacy behavior - only process first post
        }
    }
    
    return foundImages;
};

// Helper function to parse GraphQL data
KellyRecorderFilterReddit.parseGraphQLData = function(data) {
    var foundImages = false;
    
    if (data && data.data && data.data.children) {
        for (var i = 0; i < data.data.children.length; i++) {
            var child = data.data.children[i];
            if (child.data) {
                foundImages = this.parsePostModel(child.data) || foundImages;
            }
        }
    }
    
    return foundImages;
};

// Helper function to parse individual post models
KellyRecorderFilterReddit.parsePostModel = function(model) {
    var foundImages = false;
    
    if (!model || !model.media) return false;
    
    // Handle gallery posts with mediaMetadata
    if (model.media.mediaMetadata) {
        for (var mediaId in model.media.mediaMetadata) {
            var mediaItem = model.media.mediaMetadata[mediaId];
            
            if (mediaItem.s && mediaItem.s.u) {
                // Decode HTML entities in URL
                var imageUrl = mediaItem.s.u.replace(/&amp;/g, '&');
                this.addImageToPool(imageUrl, 'reddit_orig');
                foundImages = true;
            }
            
            // Also check for higher resolution versions
            if (mediaItem.p && mediaItem.p.length > 0) {
                var highestRes = mediaItem.p[mediaItem.p.length - 1];
                if (highestRes.u) {
                    var highResUrl = highestRes.u.replace(/&amp;/g, '&');
                    this.addImageToPool(highResUrl, 'reddit_orig');
                    foundImages = true;
                }
            }
        }
    }
    
    // Handle single media content
    if (model.media.content) {
        var contentUrl = model.media.content.replace(/&amp;/g, '&');
        this.addImageToPool(contentUrl, 'reddit_orig');
        foundImages = true;
    }
    
    // Handle video thumbnails and posters
    if (model.media.reddit_video) {
        if (model.media.reddit_video.fallback_url) {
            this.addImageToPool(model.media.reddit_video.fallback_url, 'reddit_video');
            foundImages = true;
        }
        if (model.media.reddit_video.dash_url) {
            this.addImageToPool(model.media.reddit_video.dash_url, 'reddit_video');
            foundImages = true;
        }
    }
    
    // Handle preview images
    if (model.preview && model.preview.images) {
        for (var i = 0; i < model.preview.images.length; i++) {
            var preview = model.preview.images[i];
            if (preview.source && preview.source.url) {
                var previewUrl = preview.source.url.replace(/&amp;/g, '&');
                this.addImageToPool(previewUrl, 'reddit_preview');
                foundImages = true;
            }
        }
    }
    
    // Handle external URL content (imgur, etc.)
    if (model.url) {
        var url = model.url;
        if (this.isImageUrl(url)) {
            this.addImageToPool(url, 'reddit_external');
            foundImages = true;
        }
    }
    
    return foundImages;
};

// Helper function to parse HTML content directly
KellyRecorderFilterReddit.parseHtmlContent = function(html) {
    var foundImages = false;
    
    // Create a temporary div to parse HTML
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Look for image URLs in various attributes
    var imgElements = tempDiv.querySelectorAll('img[src*="redd.it"], img[src*="imgur"]');
    for (var i = 0; i < imgElements.length; i++) {
        this.addImageToPool(imgElements[i].src, 'reddit_html');
        foundImages = true;
    }
    
    // Look for URLs in data attributes
    var dataElements = tempDiv.querySelectorAll('[data-url*="redd.it"], [data-url*="imgur"]');
    for (var j = 0; j < dataElements.length; j++) {
        var dataUrl = dataElements[j].getAttribute('data-url');
        if (this.isImageUrl(dataUrl)) {
            this.addImageToPool(dataUrl, 'reddit_data');
            foundImages = true;
        }
    }
    
    return foundImages;
};

// Helper function to add images to the pool
KellyRecorderFilterReddit.addImageToPool = function(url, group) {
    if (!url || !this.isImageUrl(url)) return;
    
    // Convert preview URLs to high-res versions
    var enhancedUrl = this.enhanceImageUrl(url);
    
    // Get current handler - try multiple ways for compatibility
    var handler = null;
    if (typeof KellyPageWatchdog !== 'undefined' && KellyPageWatchdog.getCurrentHandler) {
        handler = KellyPageWatchdog.getCurrentHandler();
    } else if (window.kellyCurrentHandler) {
        handler = window.kellyCurrentHandler;
    }
    
    if (handler && handler.imagesPool) {
        handler.imagesPool.push({
            relatedSrc: [enhancedUrl],
            relatedGroups: [[group]]
        });
    }
};

// Helper function to check if URL is an image or video
KellyRecorderFilterReddit.isImageUrl = function(url) {
    if (!url) return false;
    
    var mediaExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.mp4', '.webm', '.mov', '.avi'];
    var lowerUrl = url.toLowerCase();
    
    // Check for file extensions
    var hasMediaExt = mediaExts.some(function(ext) {
        return lowerUrl.includes(ext);
    });
    
    // Check for known media domains
    var hasMediaDomain = lowerUrl.includes('redd.it') || 
                        lowerUrl.includes('imgur.com') ||
                        lowerUrl.includes('redgifs.com') ||
                        lowerUrl.includes('gfycat.com') ||
                        lowerUrl.includes('v.redd.it');
    
    // Check for Reddit video patterns
    var hasVideoPattern = lowerUrl.includes('/video/') ||
                         lowerUrl.includes('reddit.com/video') ||
                         lowerUrl.includes('dash_url') ||
                         lowerUrl.includes('fallback_url');
    
    return hasMediaExt || hasMediaDomain || hasVideoPattern;
};

// Helper function to enhance image and video URLs
KellyRecorderFilterReddit.enhanceImageUrl = function(url) {
    if (!url) return url;
    
    // Convert preview.redd.it to i.redd.it for higher quality
    url = url.replace('preview.redd.it', 'i.redd.it');
    url = url.replace('external-preview.redd.it', 'i.redd.it');
    
    // Remove size and quality parameters from Reddit URLs
    url = url.replace(/\?[^?]*?(width|height|crop|format|auto=webp|s=)=[^&]*&?/g, '');
    url = url.replace(/\?$/, '');
    
    // Convert imgur thumbnail URLs to full size (including videos)
    url = url.replace(/\/([a-zA-Z0-9]+)[bsthlm]\.(jpg|jpeg|png|gif|mp4|webm)$/i, '/$1.$2');
    
    // Handle Gfycat URLs - convert to direct video URLs
    if (url.includes('gfycat.com')) {
        var gfyId = url.match(/gfycat\.com\/([a-zA-Z0-9]+)/);
        if (gfyId) {
            url = 'https://giant.gfycat.com/' + gfyId[1] + '.mp4';
        }
    }
    
    // Handle RedGifs URLs
    if (url.includes('redgifs.com')) {
        url = url.replace('/watch/', '/');
        if (!url.includes('.mp4') && !url.includes('.webm')) {
            url += '.mp4';
        }
    }
    
    // Handle Reddit video URLs - try to get highest quality
    if (url.includes('v.redd.it')) {
        // Try to append highest quality video format if not already specified
        if (!url.includes('DASH_') && !url.includes('.mp4')) {
            url += '/DASH_1080.mp4';
        }
    }
    
    // Decode HTML entities that might be in URLs
    url = url.replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'");
    
    return url;
}
     
KellyRecorderFilterReddit.onStartRecord = function(handler, data) {
     if (handler.url.indexOf('reddit.com') == -1) return;
     
     handler.additionCats = {
        reddit_post : {name : 'Post (Preview)', color : '#b7dd99', selected : 90},
        reddit_orig : {name : 'Post Media (Original)', color : '#99dd99', selected : 91},
        reddit_video : {name : 'Video Content', color : '#99bfdd', selected : 92},
        reddit_preview : {name : 'Preview Images', color : '#dddd99', selected : 89},
        reddit_external : {name : 'External Links', color : '#dd99dd', selected : 88},
        reddit_html : {name : 'HTML Parsed', color : '#99dddd', selected : 87},
        reddit_data : {name : 'Data Attributes', color : '#ffb399', selected : 86},
     };
}

KellyPageWatchdog.validators.push({
    url : 'reddit.com', 
    host : 'reddit.com', 
    patterns : [
        // Trash patterns - low quality or unwanted content
        ['preview.redd.it/award_images', 'imageTrash'],
        ['preview.redd.it/award', 'imageTrash'],
        ['styles.redditmedia.com', 'imageTrash'],
        ['reddit.com/static', 'imageTrash'],
        ['redditstatic.com', 'imageTrash'],
        
        // High quality original images
        ['i.redd.it', 'imageOriginal'],
        ['external-preview.redd.it', 'imageOriginal'],
        
        // Preview quality images
        ['preview.redd.it', 'imagePreview'],
        
        // External hosted images (often original quality)
        ['i.imgur.com', 'imageOriginal'],
        ['imgur.com/a/', 'imageByDocument'],
        ['imgur.com/gallery/', 'imageByDocument'],
        
        // Video content
        ['v.redd.it', 'video'],
        ['reddit.com/video', 'video'],
        
        // Gallery and media
        ['reddit.com/gallery/', 'imageByDocument'],
        
        // CDN and media domains
        ['redd.it', 'imagePreview'],
        ['redgifs.com', 'video'],
        ['gfycat.com', 'video']
    ]
});


// Register additional patterns for modern Reddit
KellyPageWatchdog.validators.push({
    url : 'www.reddit.com',
    host : 'www.reddit.com',
    patterns : [
        ['preview.redd.it/award_images', 'imageTrash'],
        ['i.redd.it', 'imageOriginal'],
        ['preview.redd.it', 'imagePreview'],
        ['i.imgur.com', 'imageOriginal'],
        ['v.redd.it', 'video']
    ]
});

KellyPageWatchdog.validators.push({
    url : 'old.reddit.com',
    host : 'old.reddit.com', 
    patterns : [
        ['preview.redd.it/award_images', 'imageTrash'],
        ['i.redd.it', 'imageOriginal'],
        ['preview.redd.it', 'imagePreview'],
        ['i.imgur.com', 'imageOriginal']
    ]
});

KellyPageWatchdog.validators.push({
    url : 'new.reddit.com',
    host : 'new.reddit.com',
    patterns : [
        ['preview.redd.it/award_images', 'imageTrash'],
        ['i.redd.it', 'imageOriginal'],
        ['preview.redd.it', 'imagePreview'], 
        ['i.imgur.com', 'imageOriginal'],
        ['v.redd.it', 'video']
    ]
});

KellyPageWatchdog.filters.push(KellyRecorderFilterReddit);