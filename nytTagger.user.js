// ==UserScript==
// @name        NYTimes Flickr Machine Tagger
// @description Add New York Times nyt:data machine tags to Flickr photos from nytimes.com
// @include     https://*.nytimes.com/*
// @include     http://*.nytimes.com/*
// @require     http://ajax.googleapis.com/ajax/libs/jquery/1.3.2/jquery.min.js
// @require     http://files.cjmart.in/md5-min.js
// @author      Chris Martin (@cjmartin), Jake Porway
// ==/UserScript==

// Built by Chris Martin (http://about.me/cjmartin) and Jake Porway (http://jakeporway.com/)
// at the New York Times Open Hack Day 2010.

// A future release will have a server side proxy to handle Flickr authentication
// and API calls. Custom scripts will be generated to talk to the proxy without all
// of these credentials. 

var flickrKey = 'A FLICKR API KEY';
var flickrSecret = 'A FLICKR API SECRET';
var flickrToken = 'A FLICKR USER TOKEN';

var nytKey = 'A NYT API KEY';

if ($('#article').length) {	
	var tagBarHeight = window.innerHeight - 60;
	
	$('body').append('<div id="tagger" style="position:fixed; top:14px; right:-281px;"></div>');
	$('#tagger').append('<div id="tagger_toggle" style="cursor:pointer; background:#F0F4F5; border-left:1px solid #999999; border-top:1px solid #999999; border-bottom:1px solid #999999; padding:10px; float:left; position:relative; right:-1px;"></div>')
	$('#tagger_toggle').append('<img src="http://www.jakeporway.com/images/NYTFlickr.png" alt="Tags" style="width:40px; height:40px;" />');
	$('#tagger').append('<div id="tagger_content" style="background:#F0F4F5; border-left:1px solid #999999; border-top:1px solid #999999; border-bottom:1px solid #999999; float:right; padding:10px 0; width:280px; min-height:40px; max-height:' + tagBarHeight + 'px; overflow:auto;"></div>');
	$('#tagger_content').append('<div id="tagger_tags" style="padding:0 10px;"></div>');
	$('#tagger_content').append('<div id="tagger_pics" style="padding:10px 0 10px 10px;"></div>');
	
	// only calls getTags() if we haven't displayed any tags yet.  
	if ($('#tagger_Places').length + $('#tagger_Organizations').length + $('#tagger_People').length + $('#tagger_Tags').length == 0) {
		getTags();	
	}
	
	$('#tagger_toggle').click(toggleTagger());
}

function toggleTagger() {
	return function() {
		$('#tagger').animate({
			'right': parseInt($('#tagger').css('right')) == 0 ?
				-302 :
				0
		}, 'slow');
	}
}

function getTags() {	
	var url = window.location.href;
	url = url.split('?', 1);  // Get rid of anything after the ? in the original URL
	var newswire_api_call = 'http://api.nytimes.com/svc/news/v3/content.json?url=' + url + '&api-key=' + nytKey;	
	
	GM_xmlhttpRequest({
	   method: 'GET',
	   url: newswire_api_call,
	   onload: function(responseDetails) {
			var data = JSON.parse(responseDetails.responseText);
			data = data['results'][0]; // root node
			
			var people = data['per_facet'];
			var places = data['geo_facet'];
			var tags = data['des_facet'];
			var orgs = data['org_facet'];
			
			// Strip the '|'s that separate companies from their stock symbol,
			// e.g. Google Inc|GOOG|NASDAQ --> Google Inc
			for (var i = 0; i < orgs.length; i++) {
				orgs[i] = orgs[i].split('|', 1)[0];
			}
			
			if (tags.length) {
				for (var tag in tags) {
					grabNYTID(tags[tag], 'des', 'Tags', 'tag');
				}
			}
			
			if (people.length) {
				for (var tag in people) {
					grabNYTID(people[tag], 'per', 'People', 'person');
					
				}
			}
			
			if (places.length) {
				for (var tag in places) {
					grabNYTID(places[tag], 'geo', 'Places', 'place');
				}
			}
			
			if (orgs.length) {
				for (var tag in orgs) {
					grabNYTID(orgs[tag], 'org', 'Orginizations', 'org');
				}
			}
	   }
	});
}

// Takes a NYTimes Tag (see Tag API) and its type ('org', 'des', 'per', 'geo')
// and returns its Linked Data ID.  Also needs human_type:
// ('org' = 'places', 'des' = 'tags', 'per'= 'People', 'org' = 'orgs') (could hardcode this, but meh)

function grabNYTID(tag, type, human_type, machine_type) {
	var formatted_tag = tag.replace(',', '');
	formatted_tag = formatted_tag.replace(/ /g, '_');
	formatted_tag = formatted_tag + '_' + type;
	formatted_tag = formatted_tag.toLowerCase();
	
	GM_xmlhttpRequest({
		method: 'GET',
		url: "http://data.nytimes.com/" + formatted_tag + ".json",
		onload: function(responseDetails) {
			if (responseDetails.status == 404) {
				return;
			} else {
				if ($('#tagger_' + human_type).length == 0) {
					$('#tagger_tags').append('<h3 class="sectionHeader" style="clear:both">' + human_type + '</h3>');
					$('#tagger_tags').append('<ul id="tagger_' + human_type + '" class="headlinesOnly"></ul>');
					//$('#tagger_tags').append('<div id="tagger_' + human_type + '_pic"></div>');
				}
				
				// Hack to pull NYT id out because JSON.parse crashes...?
				// var data = JSON.parse(responseDetails.responseText);
				id = responseDetails.responseText.match(/data.nytimes.com\\\/[a-zA-Z0-9]+\.rdf/);
				id = id.toString().split('/');
				id = id[1].split('.',1);
				
				$('#tagger_' + human_type).append('<li><h5><a href="#" id="'+ id + '">' + tag + '</a></h5></li>');
				$('#' + id).click(createGetPhotosLink(tag, id, type, human_type, machine_type));
			}
		}
	});
}

function createGetPhotosLink (tag, id, type, human_type, machine_type) {
	return function(e) {
		e.preventDefault();
		$('#tagger_pics').empty();
		getPhotos(tag, id, type, human_type, machine_type);
	}
}

function getPhotos(tag, id, type, human_type, machine_type) {
	var machineTag = 'nyt:' + machine_type + '=' + id;
	
	var flickrUrlBase = 'http://api.flickr.com/services/rest/';
	var flickrSigBase = flickrSecret + 'api_key' + flickrKey + 'auth_token' + flickrToken + 'extras' + 'license,url_sq,usage' + 'format' + 'json' + 'method' + 'flickr.photos.search' + 'per_page' + '500' + 'sort' + 'relevance' + 'tag_mode' + 'bool' + 'text' + tag + ', -' + machineTag;
	var flickrSig = hex_md5(flickrSigBase);
	var flickr_url = flickrUrlBase + '?api_key=' + flickrKey + '&auth_token=' + flickrToken + '&extras=' + 'license%2Curl_sq%2Cusage' + '&format=' + 'json' + '&method=' + 'flickr.photos.search' + '&per_page=' + '500' + '&sort=' + 'relevance' + '&tag_mode=' + 'bool' + '&text=' + encodeURIComponent(tag + ', -' + machineTag) + '&api_sig=' + flickrSig;
	
	GM_xmlhttpRequest({
	   method: 'GET',
	   url: flickr_url,
	   onload: function(responseDetails) {
			var data = JSON.parse(responseDetails.responseText.substring(14,(responseDetails.responseText.length - 1)));
			var num_pics = data['photos']['total'];
			
			for (var i = 0; i < num_pics; ++i) {
				
				if (data['photos']['photo'][i]['can_addmeta'] == 0) {
					continue;
				}
				
				var img_url = data['photos']['photo'][i]['url_sq'];
				var flickrID = data['photos']['photo'][i]['id'];
		
				$('#tagger_pics').append('<div style="float: left; padding:5px 10px 5px 0; text-align:center;"><img src="' + img_url + '" id="' + flickrID + '" style="cursor:pointer;" /><br/><a href="http://flickr.com/photo.gne?id=' + flickrID + '" target="_blank">View Photo</a></div>');							
				$('#' + flickrID).click(createMachineTagLink(flickrID, machineTag, tag, id));
			}
				
		}
	});
}

// Helper function to get around the wonkiness of javascript loop closures.
// If you just set onclick = function() { machineTagPhoto(...) } all elements
// will call it with the same parameters

function createMachineTagLink(flickrID, machineTag, tag, ID) {
	return function() { machineTagPhoto(flickrID, machineTag, tag, ID); }
}

// Function to do the tagging.

function machineTagPhoto(photo, machineTag, NYTag, tagID) {
	var flickrUrlBase = 'http://api.flickr.com/services/rest/';
	var flickrSigBase = flickrSecret + 'api_key' + flickrKey + 'auth_token' + flickrToken + 'format' + 'json' + 'method' + 'flickr.photos.addTags' + 'photo_id' + photo + 'tags' + machineTag;
	var flickrSig = hex_md5(flickrSigBase);
	var flickr_url = flickrUrlBase + '?api_key=' + flickrKey + '&auth_token=' + flickrToken + '&format=' + 'json' + '&method=' + 'flickr.photos.addTags' + '&photo_id=' + encodeURIComponent(photo) + '&tags=' + encodeURIComponent(machineTag) + '&api_sig=' + flickrSig;
	
	var sanity = confirm('The photo will be tagged with the machine tag for "' + NYTag + '," which is "' + machineTag + '." If this looks correct, click OK!');
	
	if (sanity) {
		GM_xmlhttpRequest({
		   method: 'GET',
		   url: flickr_url,
		   onload: function(responseDetails) {
				var data = JSON.parse(responseDetails.responseText.substring(14,(responseDetails.responseText.length - 1)));
				if (data['stat'] == 'ok') {
					alert('Photo tagged!');
				}
			}
		});
	}
}

