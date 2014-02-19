(function (gl, jq) {
	var Spot = function (type, size, opacity, centerX, centerY) {
		this.type = type;
		this.size = size;
		this.opacity = opacity;
		this.x = centerX;
		this.y = centerY;
		this.angle = Math.random()*360;
	};
	gl.Spot = Spot;
	jq.extend(Spot.prototype, {
		element: null,
		render: function () {
			this.element = this.element || $('<img>').addClass('spot');
			this.element.css({
				position: 'absolute',
				transform: 'scale(' + this.size + ') rotate(' + this.angle + 'deg)',
				opacity: this.opacity,
				top: this.y - 64,
				left: this.x - 64
			});
			this.element.attr('src', 'res/spot-' + this.type + '.png');
			this.element.data('controller', this);
			return this;
		},
		appendTo: function (host) {
			this.render();
			this.element.hide();
			$(host).append(this.element);
			this.element.fadeIn(5000);
			return this;
		},
		remove: function () {
			this.element.remove();
			return this;
		}
	});

	var Game = function (viewport) {
		this.viewport = $(viewport);
	};
	gl.Game = Game;
	function randInt(l, h) {
		return Math.floor(Math.random() * (h-l) + l);
	}
	function randFloat(l, h) {
		return Math.random() * (h - l) + l;
	}
	function sqRandFloat(l, h) {
		return Math.random() * Math.random() * (h - l) + l;
	}
	
	jq.extend(Game.prototype, {
		spotCount: 10,
		minimumSize: 0.1,
		maximumSize: 0.4,
		minimumOpacity: 0.125,
		maximumOpacity: 0.625,
		gameTime: 60,
		spotPopulator: function () {
			if (this.spots.length < this.spotCount) {
				this.spots.push((new Spot(
					randInt(0, 3), 
					sqRandFloat(this.minimumSize, this.maximumSize), 
					randFloat(this.minimumOpacity, this.maximumOpacity), 
					randInt(this.viewport.width() * 0.125, this.viewport.width() * 0.875), 
					randInt(this.viewport.height() * 0.125, this.viewport.height() * 0.875)
				)).appendTo(this.viewport));
			}
			var rem = this.remaining();
			$('.timer').html(rem);
			$('.score').html(this.score);
			if (rem === 0) {
				this.stop();
			}
		},
		remaining: function () {
			return Math.max(0, Math.floor((this.gameStart + (this.gameTime * 1000) - new Date())/1000));
		},
		start: function () {
			var self = this;
			this.gameStart = +new Date();
			this.spots = [];
			this.lastClick = +new Date();
			this.runtime = setInterval(function () {
				self.spotPopulator();
			}, 250);
			this.viewport.on('click', 'img.spot', function (e) {
				return self.spotClicked($(e.target).data('controller'));
			});
			this.viewport.on('dblclick selectionstart click', function () {
				return false;
			});
		},
		stop: function () {
			gl.clearTimeout(this.runtime);
			this.viewport.trigger('gameOver');
		},
		removeSpot: function (spot) {
			var pos = this.spots.indexOf(spot);
			spot.remove();
			this.spots.splice(pos, pos);
			return this;
		},
		spotClicked: function (spot) {
			this.removeSpot(spot);
			var score = this.calculateScore(spot, this.lastClick);
			this.score += score;
			this.announceScore(spot.x, spot.y, score);
			this.lastClick = +new Date();
			return false;
		},
		announceScore: function (x, y, score) {
			$('<div>').html(score).addClass('score-tip').css({
				position: 'absolute',
				top: y,
				left: x
			}).appendTo(this.viewport).animate(
				{
					top: y-20,
					opacity: 0
				}, {
					done: function () {
					$(this).remove();
					}
				}
			);
		},
		score: 0,
		calculateScore: function (spot, lastClick) {
			var score = 1000;
			score -= Math.min(250, (+new Date() - lastClick) / 4);
			score -= spot.size * 400;
			score -= spot.opacity * 400;
			score -= spot.type * 50;
			return Math.floor(score * 15 / 1000);
		}
	});
	$(function () {
		(new Game(gl.document.body)).start()
	});
	var Eyegame = function (windowContext) {
		this.context = windowContext;
		this.init();
	};
	gl.Eyegame = Eyegame;
	
	jq.extend(Eyegame.prototype, {
		init: function () {
			var self = this;
			$(this.context.window).on('ready resize', function () {
				self.sizeCheck();
			});
		},
		sizeCheck: function () {
			var window = $(this.context),
				screen = this.context.screen,
				fullScreen = screen.width === window.width() && screen.height === window.height();
			$('.instructions').css({ display: fullScreen ? 'none' : 'block' });
		}
	});
	/* The game
		The player will be presented with a set of indistinct splotches in the gray field of various sizes, shapes, and clarity.  The user will identify these splotches by clicking on them, and will be awarded points.
		
		Scoring:
			Scoring will be influenced by the following factors:
				time between clicks (inverse)
				opacity of splotch (inverse)
				size of splotch (inverse)
				type of splotch (depends)
	*/
	new Eyegame(gl.window);
}(this, this.jQuery));