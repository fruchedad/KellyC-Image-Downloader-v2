KellyRecorderFilterReddit = new Object();
KellyRecorderFilterReddit.manifest = {host : 'reddit.com', detectionLvl : ['imageOriginal', 'imagePreview', 'imageByDocument']};

KellyRecorderFilterReddit.addItemByDriver = function(handler, data) {
    
    if (handler.url.indexOf('reddit.com') == -1) return;
    
    if (data.el.getAttribute('data-click-id') == 'image') return handler.addDriverAction.SKIP;
    
    if (data.el.getAttribute('data-testid') && data.el.getAttribute('data-testid') == 'post-container') {
        
        // bookmarks, upvoted, downvoted etc.
        
        var preview = false;
        if (handler.url.indexOf('/user/') != -1 || handler.url.indexOf('/search/?q=') != -1) {
        
                preview = data.el.querySelector('[data-click-id="image"]');
            if (preview) {
                handler.addSrcFromStyle(preview, data.item, 'reddit_post');
            }
        }
        
        if (!preview) {
                // New Reddit (shreddit) often renders media differently; try multiple selectors
                preview = data.el.querySelector('[data-click-id="media"] img, shreddit-image img, img[src*="preview.redd.it"], img[src*="i.redd.it"]');
            if (preview) {
                handler.addSingleSrc(data.item, preview.src, 'addSrcFromAttributes-src', preview, 'reddit_post');
            }
        }
        
        // console.log(data.item);
        // console.log(handler.lastError);
        // console.log(preview);
        
        // Fallbacks for post link element across Reddit variants
        var link = data.el.querySelector('a[data-click-id="body"], a[data-testid="post-content"], a[data-test-id="post-content"], a[href*="/comments/"]');
        if (link) {
            data.item.relatedDoc = link.href;
        } else {
            data.item.relatedSrc = [];
        }
        
        return data.item.relatedSrc.length > 0 ? handler.addDriverAction.ADD : handler.addDriverAction.SKIP;
    }
}

// Prepare a dedicated JSON request to reliably fetch full media for a Reddit post
KellyRecorderFilterReddit.onBeforeParseImagesDocByDriver = function(handler, data) {
    if (handler.url.indexOf('reddit.com') == -1) return;
    if (data.thread.redditRequest) return; // avoid loops

    try {
        var url = data.thread.job && data.thread.job.url ? data.thread.job.url : handler.url;
        if (!url) return;

        // Only for individual posts (comments/galleries)
        if (url.indexOf('/comments/') != -1 || url.indexOf('/gallery/') != -1) {
            // Normalize to JSON endpoint
            var jsonUrl = url;
            // Strip query/hash
            jsonUrl = jsonUrl.split('#')[0].split('?')[0];
            if (jsonUrl[jsonUrl.length-1] != '/') jsonUrl += '/';
            jsonUrl += '.json';

            data.thread.redditRequest = 'jsonRequest';
            return {requestUrl : jsonUrl, cfg : {method : 'GET', responseType : 'json'}};
        }
    } catch (e) {
        // silent
    }
}

KellyRecorderFilterReddit._normalizeRedditUrl = function(url) {
    if (!url || typeof url != 'string') return url;
    // Decode HTML entities commonly present in Reddit JSON
    url = url.replace(/&amp;/g, '&');
    // Prefer i.redd.it over preview.redd.it
    url = url.replace('preview.redd.it', 'i.redd.it');
    return url;
}

KellyRecorderFilterReddit._pushImage = function(handler, url) {
    if (!url) return;
    url = KellyRecorderFilterReddit._normalizeRedditUrl(url);
    handler.imagesPool.push({
        relatedSrc : [ url ],
        relatedGroups : [['reddit_orig']]
    });
}

KellyRecorderFilterReddit._extractFromPostData = function(handler, postData) {
    if (!postData) return;

    // Galleries via media_metadata + gallery_data
    if (postData.media_metadata) {
        for (var mediaId in postData.media_metadata) {
            var m = postData.media_metadata[mediaId];
            if (!m) continue;
            var src = false;
            if (m.s) {
                // Prefer static image; fallback to gif if available
                if (m.s.u) src = m.s.u;
                else if (m.s.gif) src = m.s.gif;
            }
            if (src) KellyRecorderFilterReddit._pushImage(handler, src);
        }
        return;
    }

    // Single image previews
    if (postData.preview && postData.preview.images && postData.preview.images.length > 0) {
        var img0 = postData.preview.images[0];
        if (img0.source && img0.source.url) {
            KellyRecorderFilterReddit._pushImage(handler, img0.source.url);
        }
    }

    // Direct URL to image host
    var direct = postData.url_overridden_by_dest || postData.url;
    if (direct && (direct.indexOf('i.redd.it') != -1 || direct.indexOf('preview.redd.it') != -1 || direct.match(/\.(jpg|jpeg|png|gif)(\?|$)/i))) {
        KellyRecorderFilterReddit._pushImage(handler, direct);
    }

    // Crossposts can contain the actual media
    if (postData.crosspost_parent_list && postData.crosspost_parent_list.length > 0) {
        KellyRecorderFilterReddit._extractFromPostData(handler, postData.crosspost_parent_list[0]);
    }
}

KellyRecorderFilterReddit.parseImagesDocByDriver = function(handler, data) {    
     
    if (handler.url.indexOf('reddit.com') == -1) return;
    
    // Prefer JSON response when available
    if (data.thread.redditRequest == 'jsonRequest') {
        try {
            var json = data.thread.response;
            if (!json) return true; // no-op
            // Ensure object
            if (typeof json == 'string') json = JSON.parse(json);
            // Reddit post JSON is an array: [postListing, commentsListing]
            if (Array.isArray(json) && json.length > 0 && json[0] && json[0].data && json[0].data.children && json[0].data.children.length > 0) {
                var postData = json[0].data.children[0].data;
                KellyRecorderFilterReddit._extractFromPostData(handler, postData);
            }
        } catch (e) {
            console.log(e);
        }
        return true;
    }
        
    // HTML fallback (legacy) - attempt to parse window.___r or window.__r hydration
    var pageDataRegExp = /window\.___?r[\s]*=[\s]*\{([\s\S]*?)\}\s*;\<\/script/g
    var pageData = pageDataRegExp.exec(data.thread.response);

    if (pageData) {
        
        try {
            // Try both double and single closing brace variants
            var redditData = false;
            try { redditData = JSON.parse('{' + pageData[1] + '}'); } catch (e1) { redditData = JSON.parse('{' + pageData[1] + '}}'); }
            
            for (var postId in redditData.posts.models) {
                
                var model = redditData.posts.models[postId];
                
                if (model.media.mediaMetadata ) {
                    for (var mediaId in model.media.mediaMetadata) {
                        
                        if (model.media.mediaMetadata[mediaId].s) {
                            
                            handler.imagesPool.push({
                                relatedSrc : [ KellyRecorderFilterReddit._normalizeRedditUrl(model.media.mediaMetadata[mediaId].s.u) ], 
                                relatedGroups : [['reddit_orig']] 
                            });
                        }
                        
                    }
                    
                } else if (redditData.posts.models[postId].media && redditData.posts.models[postId].media.content) {
                    handler.imagesPool.push({
                        relatedSrc : [ KellyRecorderFilterReddit._normalizeRedditUrl(redditData.posts.models[postId].media.content) ], 
                        relatedGroups : [['reddit_orig']] 
                    });
                }
                
                break;
            }
        
        } catch (e) {
            console.log(e);
        }
    }
    
    return true;
}
     
KellyRecorderFilterReddit.onStartRecord = function(handler, data) {
     if (handler.url.indexOf('reddit.com') == -1) return;
     
     handler.additionCats = {
        reddit_post : {name : 'Post (Preview)', color : '#b7dd99', selected : 90},
        reddit_orig : {name : 'Post media', color : '#b7dd99', selected : 91},
     };
}

KellyPageWatchdog.validators.push({
    url : 'reddit.com', 
    host : 'reddit.com', 
    patterns : [
        ['preview.redd.it/award_images', 'imageTrash'],
        ['preview.redd.it', 'imagePreview'], 
        ['i.imgur.com', 'imagePreview'], 
        ['i.redd.it', 'imagePreview'], 
    ]
});


KellyPageWatchdog.filters.push(KellyRecorderFilterReddit);