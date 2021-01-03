'use strict';
var AWS = require('aws-sdk')
var request;
var defaults = {};

const getZones = async (route53) => {
	try {
	  let data = await route53.listHostedZonesByName().promise();
	  let zoneData = data.HostedZones.map(zone => {
		// drop '.' at the end of each zone
		zone.Name = zone.Name.substr(0, zone.Name.length - 1);
		return zone;
	  });
  
	  if (data.IsTruncated) {
		throw "Too many records to deal with. Some are truncated. ";
	  }
  
	  return zoneData;
	} catch (e) {
	  throw e;
	}
  };

module.exports.create = function(config) {
	const route53 = new AWS.Route53({
		accessKeyId: config.AWS_ACCESS_KEY_ID,
		secretAccessKey: config.AWS_SECRET_ACCESS_KEY
	  });

	return {
		init: function(opts) {
			request = opts.request;
			return null;
		},
		zones: async function(data) {
			try {
				// let zones = await getZones(route53);
				// return zones.map(zone => zone.Name);
			  } catch (e) {
				console.error("Error listing zones:", e);
				return null;
			  }
		},
		set: async function(data) {
			const ch = data.challenge;
			const txt = ch.dnsAuthorization;
			const recordName = `${ch.dnsHost}`;

			if (config.debug) {
			console.log(`Setting ${ch} to ${txt}`);
			}

			try {
			let zoneData = await getZones(route53);
			let zone = zoneData.filter(zone => zone.Name === ch.hostname)[0];
			if (!zone) {
				console.error("Zone could not be found");
				return null;
			}
			
			let recordSetResults = await route53
			.listResourceRecordSets({
				HostedZoneId: zone.Id
			})
			.promise();
			console.log("NaRecord Setme: ", recordSetResults)

			if (config.debug) {
				console.log(
				`No existing records for ${recordName} in \n\t in:`,
				recordSetResults.ResourceRecordSets.map(rrs => {
					return {
					name: rrs.Name,
					value: rrs.ResourceRecords.map(rrs => rrs.Value).join(",")
					};
				})
				);
			}

			// check if record name already exists
			let existingRecord = recordSetResults.ResourceRecordSets.map(rrs => {
				rrs.Name = rrs.Name.slice(0, -1);
				return rrs;
			}) // Remove last dot (.) from resource record set names
				.filter(rrs => rrs.Name === recordName); // Only matching record(s)

			const newRecord = { Value: `"${txt}"` };
			let resourceRecords = [];

			if (existingRecord.length) {
				// record exists which means we need to append the new record and not set it from scratch (otherwise it replaces existing records)
				if (config.debug) {
				console.log("Record exists for:", recordName, ": ", existingRecord);
				}
				resourceRecords = [...existingRecord[0].ResourceRecords, newRecord];

				if (config.debug) {
				console.log(
					"\t setting it to:",
					resourceRecords.map(rrs => rrs.Value).join(",")
				);
				}
			} else {
				if (config.debug) {
				console.log(`Record does not exist ${recordName}`);
				}

				resourceRecords = [newRecord];
			}

			let setResults = await route53
				.changeResourceRecordSets({
				HostedZoneId: zone.Id,
				ChangeBatch: {
					Changes: [
					{
						Action: "UPSERT",
						ResourceRecordSet: {
						Name: recordName,
						Type: "TXT",
						TTL: 300,
						ResourceRecords: resourceRecords
						}
					}
					]
				}
				})
				.promise();

			if (config.debug) {
				console.log(`Successfully set ${recordName} to "${txt}"`);
			}

			if (config.ensureSync) {
				let status = setResults.ChangeInfo.Status;
				while (status === "PENDING") {
				const timeout = 5000;

				if (config.debug) {
					console.log(
					`\t but ... change is still pending. Will check again in ${timeout /
						1000} seconds.`
					);
				}
				await sleep(timeout);
				let change = await getChange(route53, setResults.ChangeInfo.Id);
				status = change.ChangeInfo.Status;
				}
			}

			return true;
			} catch (e) {
			console.log("Error upserting txt record:", e);
			return null;
			}
		},
		remove: function(data) {
			// console.info('Remove TXT', data);
			// throw Error('removing TXT not implemented');
		},
		get: function(data) {
			// console.info('List TXT', data);
			// throw Error('listing TXTs not implemented');
		}
	};
};