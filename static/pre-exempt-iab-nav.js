window.close = function() {
	window.top.postMessage({
		type: 'close',
	}, location.origin);
};
