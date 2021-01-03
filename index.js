'use strict';

var request;
var defaults = {};

module.exports.create = function(config) {
	return {
		init: function(opts) {
			request = opts.request;
			return null;
		},
		zones: function(data) {
			//console.info('List Zones', data);
			throw Error('listing zones not implemented');
		},
		set: function(data) {
			// console.info('Add TXT', data);
			throw Error('setting TXT not implemented');
		},
		remove: function(data) {
			// console.info('Remove TXT', data);
			throw Error('removing TXT not implemented');
		},
		get: function(data) {
			// console.info('List TXT', data);
			throw Error('listing TXTs not implemented');
		}
	};
};