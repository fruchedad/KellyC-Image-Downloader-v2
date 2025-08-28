KellyRecorderFilterReddit = new Object();
KellyRecorderFilterReddit.manifest = {host : 'reddit.com', detectionLvl : ['imageOriginal', 'imagePreview', 'imageByDocument']};

// Helper function to decode Reddit URLs and convert to high resolution
KellyRecorderFilterReddit.decodeRedditUrl = function(url) {
    if (!url) return url;
    
    // Decode HTML entities
    url = url.replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#039;/g, "'");
    
    // Convert preview URLs to full resolution
    if (url.indexOf('preview.redd.it') !== -1) {
        // Extract the image ID and extension
        var match = url.match(/preview\.redd\.it\/([a-zA-Z0-9]+\.[a-zA-Z]+)/);
        if (match && match[1]) {
            return 'https://i.redd.it/' + match[1];
        }
    }
    
    // Remove resolution limits from external preview
    if (url.indexOf('external-preview.redd.it') !== -1) {
        url = url.replace(/\?width=\d+&.*$/, '');
    }
    
    return url;
};

KellyRecorderFilterReddit.addItemByDriver = function(handler, data) {
    
    if (handler.url.indexOf('reddit.com') == -1) return;
    
    if (data.el.getAttribute('data-click-id') == 'image') return handler.addDriverAction.SKIP;
    
    // Handle Reddit posts - support both old and new Reddit layouts
    var isPostContainer = data.el.getAttribute('data-testid') && data.el.getAttribute('data-testid') == 'post-container';
    var isShredditPost = data.el.tagName === 'SHREDDIT-POST' || data.el.classList.contains('Post');
    
    if (isPostContainer || isShredditPost) {
        
        // bookmarks, upvoted, downvoted etc.
        
        var foundImages = false;
        
        // Try multiple selectors for images in different Reddit layouts
        var imageSelectors = [
            '[data-click-id="image"]',
            '[data-click-id="media"] img',
            'img[alt][src*="preview.redd.it"]',
            'img[alt][src*="i.redd.it"]',
            'img[alt][src*="external-preview.redd.it"]',
            '.media-element img',
            'figure img',
            // Gallery images
            'ul[data-scroller-first] img',
            '[data-faceplate-tracking-context*="gallery"] img'
        ];
        
        for (var i = 0; i < imageSelectors.length; i++) {
            var images = data.el.querySelectorAll(imageSelectors[i]);
            if (images && images.length > 0) {
                for (var j = 0; j < images.length; j++) {
                    var img = images[j];
                    if (img.src && img.src.indexOf('http') === 0) {
                        // Try to get higher resolution version
                        var highResSrc = KellyRecorderFilterReddit.decodeRedditUrl(img.src);
                        
                        // Add the high resolution version
                        handler.addSingleSrc(data.item, highResSrc, 'addSrcFromAttributes-src', img, 'reddit_post');
                        
                        // If it's a preview URL, also add the original
                        if (img.src !== highResSrc) {
                            handler.addSingleSrc(data.item, img.src, 'addSrcFromAttributes-src', img, 'reddit_preview');
                        }
                        foundImages = true;
                    } else if (img.style.backgroundImage) {
                        // Some images might be set as background
                        handler.addSrcFromStyle(img, data.item, 'reddit_post');
                        foundImages = true;
                    }
                }
            }
        }
        
        // Check for video content
        var videoElements = data.el.querySelectorAll('video source, video[src]');
        for (var k = 0; k < videoElements.length; k++) {
            var video = videoElements[k];
            var videoSrc = video.src || video.getAttribute('src');
            if (videoSrc) {
                handler.addSingleSrc(data.item, videoSrc, 'addSrcFromAttributes-src', video, 'reddit_video');
                foundImages = true;
            }
        }
        
        // Get the post link for related document parsing
        var linkSelectors = ['a[data-click-id="body"]', 'a[href*="/comments/"]', 'a[slot="full-post-link"]'];
        var link = null;
        for (var l = 0; l < linkSelectors.length; l++) {
            link = data.el.querySelector(linkSelectors[l]);
            if (link) break;
        }
        
        if (link) {
            data.item.relatedDoc = link.href;
        } else if (!foundImages) {
            // If no images found and no link, skip this item
            data.item.relatedSrc = [];
        }
        
        return data.item.relatedSrc.length > 0 ? handler.addDriverAction.ADD : handler.addDriverAction.SKIP;
    }
}

KellyRecorderFilterReddit.parseImagesDocByDriver = function(handler, data) {    
     
    if (handler.url.indexOf('reddit.com') == -1) return;
        
    var pageDataRegExp = /window\.___r[\s]*=[\s]*\{([\s\S]*)\}\}\;\<\/script/g
    var pageData = pageDataRegExp.exec(data.thread.response);

    if (pageData) {
        
        try {
            var redditData = JSON.parse('{' + pageData[1] + '}}');
            
            // Process all posts, not just the first one
            for (var postId in redditData.posts.models) {
                
                var model = redditData.posts.models[postId];
                
                // Handle gallery posts with multiple images
                if (model.media && model.media.mediaMetadata) {
                    for (var mediaId in model.media.mediaMetadata) {
                        
                        var media = model.media.mediaMetadata[mediaId];
                        var imageSrcs = [];
                        
                        // Try to get the highest quality version available
                        if (media.s && media.s.u) {
                            // Decode and get high resolution URL
                            var fullUrl = KellyRecorderFilterReddit.decodeRedditUrl(media.s.u);
                            imageSrcs.push(fullUrl);
                            
                            // Also add the original URL if different
                            if (fullUrl !== media.s.u) {
                                imageSrcs.push(media.s.u.replace(/&amp;/g, '&'));
                            }
                        }
                        
                        // Also check for direct image URL in media object
                        if (media.s && media.s.gif) {
                            imageSrcs.push(media.s.gif.replace(/&amp;/g, '&'));
                        }
                        
                        // Check for MP4 video variants
                        if (media.s && media.s.mp4) {
                            imageSrcs.push(media.s.mp4.replace(/&amp;/g, '&'));
                        }
                        
                        // Check for original/source image
                        if (media.id && media.m) {
                            // m contains mime type, can construct original URL
                            var ext = media.m.split('/')[1];
                            if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].indexOf(ext.toLowerCase()) !== -1) {
                                var originalUrl = 'https://i.redd.it/' + media.id + '.' + ext;
                                if (imageSrcs.indexOf(originalUrl) === -1) {
                                    imageSrcs.unshift(originalUrl); // Add as first (highest quality)
                                }
                            }
                        }
                        
                        if (imageSrcs.length > 0) {
                            handler.imagesPool.push({
                                relatedSrc : imageSrcs, 
                                relatedGroups : [['reddit_gallery']] 
                            });
                        }
                    }
                    
                } else if (model.media && model.media.content) {
                    // Handle single image/video posts
                    var contentUrl = KellyRecorderFilterReddit.decodeRedditUrl(model.media.content);
                    handler.imagesPool.push({
                        relatedSrc : [ contentUrl ], 
                        relatedGroups : [['reddit_orig']] 
                    });
                } else if (model.media && model.media.type === 'video') {
                    // Handle Reddit hosted videos
                    var videoSrcs = [];
                    
                    if (model.media.dashUrl) {
                        videoSrcs.push(model.media.dashUrl);
                    }
                    
                    if (model.media.hlsUrl) {
                        videoSrcs.push(model.media.hlsUrl);
                    }
                    
                    // Try to construct direct video URL
                    if (model.media.id) {
                        // Reddit videos are usually at v.redd.it/[id]/DASH_[quality].mp4
                        var qualities = ['1080', '720', '480', '360', '240'];
                        for (var q = 0; q < qualities.length; q++) {
                            videoSrcs.push('https://v.redd.it/' + model.media.id + '/DASH_' + qualities[q] + '.mp4');
                        }
                    }
                    
                    if (videoSrcs.length > 0) {
                        handler.imagesPool.push({
                            relatedSrc : videoSrcs, 
                            relatedGroups : [['reddit_video']] 
                        });
                    }
                } else if (model.source && model.source.url) {
                    // Handle external links (imgur, gfycat, etc.)
                    var sourceUrl = model.source.url;
                    if (sourceUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                        handler.imagesPool.push({
                            relatedSrc : [ sourceUrl ], 
                            relatedGroups : [['reddit_external']] 
                        });
                    }
                }
                
                // Continue processing all posts - removed break statement
            }
        
        } catch (e) {
            console.log('[Reddit Filter] Error parsing Reddit data:', e);
        }
    }
    
    return true;
}
     
KellyRecorderFilterReddit.onStartRecord = function(handler, data) {
     if (handler.url.indexOf('reddit.com') == -1) return;
     
     handler.additionCats = {
        reddit_post : {name : 'Post (Preview)', color : '#b7dd99', selected : 90},
        reddit_orig : {name : 'Post media', color : '#b7dd99', selected : 91},
        reddit_gallery : {name : 'Gallery images', color : '#99ccdd', selected : 92},
        reddit_video : {name : 'Reddit videos', color : '#dd9999', selected : 93},
        reddit_external : {name : 'External images', color : '#ddcc99', selected : 94},
        reddit_preview : {name : 'Preview images', color : '#cccccc', selected : 50},
     };
}

KellyPageWatchdog.validators.push({
    url : 'reddit.com', 
    host : 'reddit.com', 
    patterns : [
        ['preview.redd.it/award_images', 'imageTrash'],
        ['styles.redditmedia.com/t5_', 'imageTrash'], // Subreddit styles
        ['www.redditstatic.com/avatars', 'imageTrash'], // Avatar images
        ['preview.redd.it', 'imagePreview'], 
        ['external-preview.redd.it', 'imagePreview'],
        ['i.redd.it', 'imageOriginal'], // Changed to original since these are full res
        ['v.redd.it', 'video'], // Reddit hosted videos
        ['i.imgur.com', 'imagePreview'], 
        ['imgur.com', 'imageByDocument'], // Imgur galleries
        ['gfycat.com', 'imageByDocument'], // Gfycat GIFs
        ['redgifs.com', 'imageByDocument'], // RedGIFs
    ]
});


KellyPageWatchdog.filters.push(KellyRecorderFilterReddit);