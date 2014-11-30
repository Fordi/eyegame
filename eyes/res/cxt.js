if (!window.JSZip) {
	$('<scr' + 'ipt>').attr('src', 'https://stuk.github.io/jszip/dist/jszip.js').appendTo(document.body);
	$('<scr' + 'ipt>').attr('src', 'https://stuk.github.io/jszip/vendor/FileSaver.js').appendTo(document.body);
}
Array.prototype.replace = function (idx, amt, objects) {
	var args,
		len = objects ? objects.length : 0;
	if (!objects || objects.length === 0) {
		this.splice(idx, amt);
	} else {
		args = [idx, amt].concat(objects);
		this.splice.apply(this, args);
	}
	return this;
};
Array.prototype.removeObject = function (obj) {
	var loc = this.length || 0,
		curObject;
	while (loc > 0) {
		loc -= 1;
		curObject = this[loc];
		if (curObject === obj) {
			this.removeAt(loc);
		}
	}
	return this;
};
Array.prototype.removeAt = function (start, len) {
	if ('number' === typeof start) {
		if ((start < 0) || (start >= this.length)) {
			throw new Error("Out of range");
		}
		if (len === undefined) { len = 1; }
		this.replace(start, len, []);
	}
	return this;
};
var cxt = (function () {
	"use strict";
	var cxt = {};
	$('.continue-modal .button-cancel:visible').click();
	cxt.config = JSON.parse(localStorage.getItem('cxtConfig') || 'null') ||	{
		maxWidth: Infinity,
		maxHeight: 1440,
		fileType: 'jpg',
		quality: 0.85
	};
	cxt.setConfig = function (name, value) {
		if (cxt.config[name] !== value) {
			cxt.config[name] = value;
			localStorage.setItem('cxtConfig', JSON.stringify(cxt.config));
		}
	};

	cxt.mime = {
		png: 'image/png',
		jpg: 'image/jpeg'
	};
	cxt.fileSystem = null;
	cxt.thumbs = [].slice.apply($('.thumbnails-list figure'));
	cxt.getPages = function () {
		return cxt.thumbs.map(function (thumb) { return $(thumb).find('figcaption').text(); });
	};
	$('#browse-btn').click();
	cxt.getFilename = function (pageNumber) {
		return cxt.title.replace(/[^A-Za-z0-9_ \.]/g, '_') + ' - ' + pageNumber + '.' + cxt.config.fileType;
	};
	cxt.title = document.title.replace(' - comiXology', '');
	cxt.toDataURL = (function () {
		var ifr = $('<iframe>').appendTo(document.body),
			tdu = $('<canvas>', ifr[0].contentDocument)[0].toDataURL;
		ifr.remove();
		return tdu;
	}());
	cxt.setPage = function (pageNumber) {
		var def = new $.Deferred(),
			doResolve = function () {
				if ($('#reader .loading').is(':visible')) {
					setTimeout(doResolve, 0.125);
					return;
				}
				def.resolve();
			},
			options = {
				queue: true,
				done: doResolve,
				fail: doResolve
			};
		if (!cxt.thumbs[pageNumber - 1]) {
			def.reject(new Error("Page " + pageNumber + " does not exist; range is 1 to " + cxt.thumbs.length));
			return def.promise();
		}
		$(cxt.thumbs[pageNumber - 1]).click();
		setTimeout(function () {
			$('div.view').eq(1).animate({ opacity: 1 }, options);
			$('div.view').eq(0).animate({ opacity: 1 }, options);
		}, 10);
		return def.promise();
	};
	cxt.getFS = function () {
		var def = new $.Deferred(),
			err = function (error) {
				def.reject(error);
			};
		if (cxt.fileSystem !== null) {
			def.resolve(cxt.fileSystem);
			return def.promise();
		}
		window.webkitStorageInfo.requestQuota(window.PERSISTENT, 1024 * 1024 * 1024 * 2, function (grantedBytes) {
			window.webkitRequestFileSystem(window.PERSISTENT, grantedBytes, function (fs) {
				cxt.fileSystem = fs;
				def.resolve(fs);
			}, err);
		}, err);
		return def.promise();
	};
	cxt.files = {};
	cxt.getFile = function (name, create) {
		var def = new $.Deferred();
		cxt.getFS().done(function (fs) {
			fs.root.getFile(name, { create: create }, function (entry) {
				cxt.files[name] = entry;
				def.resolve(entry);
			}, function (error) {
				def.reject(error);
			});
		}).fail(function (error) {
			def.reject(error);
		});
		return def.promise();
	};
	cxt.getUndownloaded = function () {
		var def = new $.Deferred(),
			pages = cxt.getPages(),
			ttl = 0,
			len = pages.length,
			defs = pages.map(function (page, index) {
				var localDef = new $.Deferred(),
					fileName = cxt.getFilename(page);
				cxt.getFile(fileName, false).done(function (fileEntry) {
					pages.removeObject(page);
				}).always(function () {
					localDef.resolve();
					ttl += 1;
					def.notify(ttl, pages.length);
				});
				return localDef;
			});
		$.when.apply($, defs).done(function () {
			def.resolve(pages);
		});
		cxt.progressMeter(def);
		return def.promise();
	};
	cxt.toBlob = function toBlob(dataURI) {
		var byteString,
			arrayBuffer,
			intArray,
			i,
			mimeString,
			bb,
			data = dataURI.split(',');
		if (data[0].indexOf('base64') >= 0) {
			// Convert base64 to raw binary data held in a string:
			byteString = window.atob(data[1]);
		} else {
			// Convert base64/URLEncoded data component to raw binary data:
			byteString = decodeURIComponent(data.slice(1).join(','));
		}
		// Write the bytes of the string to an ArrayBuffer:
		arrayBuffer = new window.ArrayBuffer(byteString.length);
		intArray = new window.Uint8Array(arrayBuffer);
		for (i = 0; i < byteString.length; i += 1) {
			intArray[i] = byteString.charCodeAt(i);
		}
		// Separate out the mime component:
		mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
		// Write the ArrayBuffer (or ArrayBufferView) to a blob:
		return new window.Blob(
			[intArray],
			{type: mimeString}
		);
	};
	cxt.getImage = function (pageNumber) {
		var def = cxt.progressMeter(new $.Deferred(), "Fetching image " + pageNumber),
			fileName = cxt.getFilename(pageNumber);
		$(cxt.thumbs[pageNumber - 1]).click();
		cxt.setPage(pageNumber).done(function () {
			var fc, dw, dh, format,
				canv = $('canvas.no-select'),
				w = canv[0].attributes.width.value,
				h = canv[0].attributes.height.value,
				ttl = canv.length + 1,
				prog = 1;
			def.notify(prog, ttl);
			dw = w;
			dh = h;
			if (dw > (cxt.config.maxWidth || Infinity)) {
				dw = cxt.config.maxWidth;
				dh = Math.round(dw * h / w);
			}
			if (dh > (cxt.config.maxHeight || Infinity)) {
				dh = cxt.config.maxHeight;
				dw = Math.round(dh * w / h);
			}
			format = cxt.mime[cxt.config.fileType] || 'image/png';
			fc = $('<canvas>')
					.attr('width', dw)
					.attr('height', dh)[0];

			$('canvas.no-select').each(function () {
				fc.getContext('2d').drawImage(this, 0, 0, w, h, 0, 0, dw, dh);
				def.notify(prog, ttl);
				prog += 1;
			});
			cxt.store(fileName, cxt.toDataURL.call(fc, format, cxt.config.quality)).done(function (fileEntry) {
				setTimeout(function () {
					var img = $('<div>').append(
							$('<img>')
								.attr({ src: fileEntry.toURL() })
								.css({ width: 120, display: 'block' }),
							$('<div>')
								.css({ font: '7pt cursive, sans-serif', color: '#EEE' })
								.text("Saved " + cxt.title + ", Page " + pageNumber)
						)
							.css({
								position: 'absolute',
								top: 0,
								right: 0,
								zIndex: 1000,
								boxShadow: '-5px 5px 10px -5px black',
								width: 120,
								opacity: 0,
								backgroundColor: '#333'

							})
							.appendTo(document.body);
					img.find('img').on('load', function () {
						def.resolve(fileName, fileEntry.toURL(), fileEntry);
						img.animate({ opacity: 1 }, { duration: 250, complete: function () {
							setTimeout(function () {
								img.fadeOut('slow', function () {
									img.remove();
								});
							}, 1500);
						}});
					});
				}, 125);
			}).fail(function (error) {
				def.reject(error);
			});
		});
		return def.promise();
	};
	cxt.removeFile = function (fileName) {
		var def = new $.Deferred();
		cxt.getFile(fileName, false).done(function (fileEntry) {
			fileEntry.remove(function () {
				def.resolve();
			}, function () {
				def.reject();
			});
		}).fail(function () {
			def.resolve();
		});
		return def.promise();
	};
	cxt.clearFiles = function () {
		var def = cxt.progressMeter(new $.Deferred(), "Clearing files");
		cxt.getFS().done(function (fs) {
			fs.root.createReader().readEntries(function (entries) {
				$.when.apply($, [].map.call(entries, function (entry, index) {
					var eDef = new $.Deferred(),
						resolve = function () { eDef.resolve(); def.notify(index, entries.length); },
						reject = function (e) { eDef.reject(e); def.notify(index, entries.length); };
					if (entry.isDirectory) {
						entry.removeRecursively(resolve, resolve);
					} else {
						entry.remove(resolve, resolve);
					}
				})).done(function () {
					def.resolve();
				}).fail(function (e) {
					def.reject(e);
				});
			}, function (e) {
				def.reject(e);
			});
		});
		return def.promise();
	};
	cxt.store = function (fileName, data) {
		var def = new $.Deferred();
		cxt.getFS().done(function (fs) {
			cxt.removeFile(fileName)
				.always(function () {
					cxt.getFile(fileName, true).done(function (fileEntry) {
						fileEntry.createWriter(function (writer) {
							writer.write(cxt.toBlob(data));
							def.resolve(fileEntry);
						}, function (error) {
							def.reject(error);
						});
					}).fail(function (error) {
						def.reject(error);
					});
				});
		}).fail(function (error) {
			def.reject(error);
		});
		return def.promise();
	};
	cxt.downloadRemaining = function () {
		var def = new $.Deferred(),
			err = [];
		cxt.getUndownloaded().always(function (undownloaded) {
			function downloadOne() {
				if (undownloaded.length) {
					cxt.getImage(undownloaded[0]).done(function () {
						undownloaded.shift();
						downloadOne();
					}).fail(function () {
						err.push(undownloaded.shift());
						downloadOne();
					});
				} else {
					if (err.length) {
						def.reject(new Error("Some pages failed to download"), err);
					} else {
						def.resolve();
					}
				}
			}
			downloadOne();
		});
		return def.promise();
	};
	cxt.downloadPages = function (pageList) {
		var def = cxt.progressMeter(new $.Deferred(), "Downloading pages"),
			files = [],
			err = [];
		function downloadOne() {
			if (pageList.length) {
				var fn = cxt.getFilename(pageList[0]);
				cxt.getFile(fn, false).done(function (fileEntry) {
					files.push({ fileName: fn, fileUrl: fileEntry.toURL(), entry: fileEntry });
					pageList.shift();
					downloadOne();
				}).fail(function () {
					cxt.getImage(pageList[0]).done(function (fileName, fileUrl, fileEntry) {
						pageList.shift();
						files.push({ fileName: fileName, fileUrl: fileUrl, entry: fileEntry });
						downloadOne();
					}).fail(function () {
						err.push(pageList.shift());
						downloadOne();
					});
				});
			} else {
				if (err.length) {
					def.reject(new Error("Some pages failed to download"), err);
				} else {
					def.resolve(files);
				}
			}
		}
		setTimeout(downloadOne, 125);
		return def.promise();
	};
	cxt.downloadCBZ = function (pages) {
		var zip = new window.JSZip(),
			def = new $.Deferred(),
			createZip = function (pages) {
				var p = pages.slice(),
					added = 0,
					ttl = p.length;
				cxt.progressMeter(def, "Creating CBZ file");
				function addOne() {
					if (def.state() !== 'pending') {
						return;
					}
					if (p.length > 0) {
						cxt.readFile(p[0].fileName).done(function (data) {
							zip.file(p[0].fileName, data, { binary: true, base64: false });
							p.shift();
							added += 1;
							def.notify(added, ttl);
							setTimeout(addOne, 10);
						}).fail(function (error) {
							def.reject(error);
						});
					} else {
						var content = zip.generate({ type: 'blob' });
						window.saveAs(content, cxt.title.replace(/[^A-Za-z0-9_ \.]/g, '_') + '.cbz');
						def.resolve();
					}
				}
				addOne();
			};
		cxt.downloadPages(pages || cxt.getPages()).done(createZip);
		return def;
	};
	cxt.readFile = function (fileName) {
		var def = new $.Deferred();
		cxt.getFile(fileName).done(function (fileEntry) {
			fileEntry.file(function (file) {
				var reader = new window.FileReader();
				reader.onloadend = function (e) {
					def.resolve(e.target.result);
				};
				reader.onerror = function (e) {
					def.reject(e);
				};
				reader.readAsBinaryString(file);
			}, function (e) {
				def.reject(e);
			});
		}).fail(function (e) {
			def.reject(e);
		});
		return def;
	};
	cxt.createRules = function (css) {
		function rulesToText(css) {
			return Object.keys(css).map(function (selector) {
				var rules = css[selector];
				if (selector[0] === '@') {
					return selector + ' {' + rulesToText(rules).replace(/^|\n/g, '\n\t') + '\n}';
				}
				return selector + ' {\n\t' + Object.keys(rules).map(function (ruleName) {
					var value = rules[ruleName],
						dashed = ruleName.replace(/[A-Z]/g, function (m) {
							return '-' + m.toLowerCase();
						});
					return dashed + ': ' + value;
				}).join(';\n\t') + ';\n}';
			}).join('\n');
		}
		return rulesToText(css);
	};
	cxt.applyRules = function (rules) {
		$('<style>').text(cxt.createRules(rules)).appendTo(document.body);
	};
	cxt.applyRules({
		"@WebkitKeyframes templateLoading": {
			"from": {
				backgroundPosition: "0 0"
			},
			"to": {
				backgroundPosition: "-14px 0"
			}
		},
		".cxtProgressMeter.unknown": {
			backgroundImage: "linear-gradient(" + [
				"-45deg",
				"#f7f7f7",
				"#f7f7f7 5px",
				"#d6d6d6 5px",
				"#d6d6d6 10px",
				"#f7f7f7 10px",
				"#f7f7f7 15px",
				"#d6d6d6 15px",
				"#d6d6d6 20px"
			].join(', ') + ")",
			backgroundSize: "14px 14px"
		},
		".cxtProgressMeter": {
			position: 'absolute',
			zIndex: 1000,
			top: ($(document).height() / 2 - 24) + "px",
			left: ($(document).width() / 4) + "px",
			height: "16px",
			margin: "4px 0px",
			width: ($(document).width() / 2) + "px",
			backgroundColor: '#e6e6e6',
			boxShadow: 'black 0px 5px 40px -14px inset',
			opacity: 0.75,
			borderRadius: "8px"
		},
		".cxtProgressMeter div.bar": {
			width: 0,
			height: '100%',
			backgroundColor: 'green',
			borderRadius: "8px"
		},
		".cxtProgressMeter div.message": {
			width: "100%",
			textAlign: "center",
			color: "black",
			textShadow: "0px 0px 6px white",
			font: "10px \"Arial\", sans-serif",
			lineHeight: '16px',
			position: 'absolute',
			top: 0,
			left: 0
		},
		".cxtProgressMeter.error div": {
			backgroundColor: 'red'
		}
	});
	cxt.progressMeter = function (def, message) {
		function positionMeters() {
			var meters = $('.cxtProgressMeter'),
				ttlHeight = [].reduce.call(meters, function (prev, cur) { return prev + $(cur).outerHeight(true); }, 0),
				newTop = $(document).height() / 2 - ttlHeight / 2;
			meters.each(function () {
				$(this).css({ top: newTop });
				newTop += $(this).outerHeight(true);
			});
		}
		var bar = $('<div>').addClass('bar'),
			msg = $('<div>').addClass('message').html(message),
			meter = $('<div>').addClass('cxtProgressMeter unknown').append(bar, msg).appendTo(document.body);
		positionMeters();
		def.progress(function (pct, ttl) {
			var pro = -1;
			if (!isNaN(pct)) {
				if (!isNaN(ttl)) {
					pro = pct / ttl;
				} else if (pct > 0 && pct <= 1) {
					pro = pct;
				} else if (pct > 0 && pct <= 100) {
					pro = pct / 100;
				}
			}
			if (pro > 0) {
				meter.removeClass('unknown');
				bar.width((pro * 100) + '%');
			}
		});
		def.done(function () {
			bar.addClass('complete');
		}).fail(function () {
			bar.addClass('error');
		}).always(function () {
			bar.width('100%');
			setTimeout(function () {
				meter.fadeOut('slow', function () {
					meter.remove();
					positionMeters();
				});
			}, 1000);
		});
		return def;
	};
	cxt.ui = function () {
		var dlg = $('<aside>')
			.addClass('modal vertical-center horizontal-center')
			.css({
				display: 'block',
				overflow: 'hidden'
			})
			.append(
				$('<header>').addClass('modal-header').append(
					$('<h2>').addClass('center-text').text('Setup CBZ Download')
				),
				$('<section>').addClass('modal-content').append(
					$('<div>').append(
						$('<label>').attr('for', 'cxtConfigMaxHeight').append(
							$('<div>').text("Size").css({ width: '50%', display: 'inline-block' }),
							$('<input>')
								.css({ width: "4em" })
								.attr('id', 'cxtConfigMaxHeight')
								.val(cxt.config.maxHeight)
								.on('change', function (e) {
									var v = Math.floor(parseFloat($(e.target).val()));
									if (isNaN(v)) { return; }
									cxt.setConfig('maxHeight', v);
								}),
							"px"
						)
					),
					$('<div>').append(
						$('<label>').attr('for', 'cxtConfigFileType').append(
							$('<div>').text("Type").css({ width: '50%', display: 'inline-block' }),
							$('<select>').attr('id', 'cxtConfigFileType')
								.append(
									$('<option>').text('jpg'),
									$('<option>').text('png')
								)
								.val(cxt.config.fileType)
								.on('change', function (e) {
									cxt.setConfig('fileType', $(e.target).val());
								})
						)
					),
					$('<div>').append(
						$('<label>').attr('for', 'cxtConfigQuality').append(
							$('<div>').text("Quality").css({ width: '50%', display: 'inline-block' }),
							$('<input>').attr('id', 'cxtConfigQuality')
								.css({ width: '2em' })
								.val(cxt.config.quality * 100)
								.on('change', function (e) {
									var v = Math.floor(parseFloat($(e.target).val()));
									if (isNaN(v)) { return; }
									if (v > 100 || v <= 0) { return; }
									cxt.setConfig('quality', v / 100);
								}),
							"%"
						)
					)
				),
				$('<section>').addClass('modal-actions right-text').append(
					$('<button>').addClass('button-cancel').text('Cancel')
						.on('click', function () {
							dlg.remove();
						}),
					$('<button>').addClass('button-action').text('Download')
						.on('click', function () {
							dlg.fadeOut('slow', function () {
								dlg.remove();
								cxt.clearFiles()
									.done(function () {
										cxt.downloadCBZ().done(function () {
											cxt.clearFiles();
										});
									});
							});

						})
				)
			)
			.appendTo(document.body);
	};
	function start() {
		if ($('.continue-modal .button-cancel:visible').length) {
			setTimeout(start, 500);
			return;
		}
		cxt.ui();
	}
	start();
	return cxt;
}());

