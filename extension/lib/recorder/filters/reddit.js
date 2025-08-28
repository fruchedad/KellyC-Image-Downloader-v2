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
                preview = data.el.querySelector('[data-click-id="media"] img');
            if (preview) {
                handler.addSingleSrc(data.item, preview.src, 'addSrcFromAttributes-src', preview, 'reddit_post');
            }
        }
        
        // console.log(data.item);
        // console.log(handler.lastError);
        // console.log(preview);
        
        var link = data.el.querySelector('a[data-click-id="body"]');
        if (link) {
            data.item.relatedDoc = link.href;
        } else {
            data.item.relatedSrc = [];
        }
        
        return data.item.relatedSrc.length > 0 ? handler.addDriverAction.ADD : handler.addDriverAction.SKIP;
    }
}

KellyRecorderFilterReddit.parseImagesDocByDriver = function(handler, data) {    
     
    if (handler.url.indexOf('reddit.com') == -1) return;
		
	// helpers
	var decodeHtmlEntities = function(str) {
		if (!str || typeof str.replace != 'function') return str;
		return str.replace(/&amp;/g, '&');
	}

	var addUrl = function(url) {
		if (!url) return;
		url = decodeHtmlEntities(url);
		handler.imagesPool.push({
			relatedSrc : [ url ],
			relatedGroups : [['reddit_orig']]
		});
	}

	// Try to extract window.___r JSON first
	var pageDataMatch = data.thread.response.match(/<script[^>]*>\s*window\.___r\s*=\s*({[\s\S]*?});\s*<\/script>/);

	if (pageDataMatch && pageDataMatch[1]) {
		try {
			var redditData = JSON.parse(pageDataMatch[1]);
			if (redditData && redditData.posts && redditData.posts.models) {
				for (var postId in redditData.posts.models) {
					var model = redditData.posts.models[postId];
					if (!model) continue;

					// Galleries / multiple media
					if (model.media && model.media.mediaMetadata) {
						for (var mediaId in model.media.mediaMetadata) {
							var media = model.media.mediaMetadata[mediaId];
							if (media && media.s && media.s.u) {
								addUrl(media.s.u);
							} else if (media && media.p && media.p.length) {
								// fallback to the largest preview if source missing
								addUrl(media.p[media.p.length - 1].u);
							}
						}
					}

					// Single media content
					else if (model.media && model.media.content) {
						addUrl(model.media.content);
					}

					// Fallback: preview images block
					else if (model.preview && model.preview.images && model.preview.images.length) {
						var images = model.preview.images;
						for (var i = 0; i < images.length; i++) {
							if (images[i].source && images[i].source.url) addUrl(images[i].source.url);
							if (images[i].resolutions && images[i].resolutions.length) {
								addUrl(images[i].resolutions[images[i].resolutions.length - 1].url);
							}
						}
					}
				}
			}
		} catch (e) {
			console.log(e);
		}
	} else {
		// Fallback to __NEXT_DATA__ (new Reddit)
		try {
			var nextDataMatch = data.thread.response.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
			if (nextDataMatch && nextDataMatch[1]) {
				var nextData = JSON.parse(nextDataMatch[1]);
				// Best-effort traversal for posts media
				var posts = [];
				try {
					if (nextData.props && nextData.props.pageProps && nextData.props.pageProps.post) posts.push(nextData.props.pageProps.post);
					if (nextData.props && nextData.props.pageProps && nextData.props.pageProps.posts) posts = posts.concat(nextData.props.pageProps.posts);
				} catch (e) {}

				for (var p = 0; p < posts.length; p++) {
					var pm = posts[p];
					if (!pm) continue;
					if (pm.media && pm.media.mediaMetadata) {
						for (var mm in pm.media.mediaMetadata) {
							var m = pm.media.mediaMetadata[mm];
							if (m && m.s && m.s.u) addUrl(m.s.u);
						}
					} else if (pm.url) {
						addUrl(pm.url);
					}
				}
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