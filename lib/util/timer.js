function Timer(intervalMillis, autoStart) {
    autoStart = autoStart || true;
    this.tickAmount = intervalMillis || 33.33333;
    this.time = 0;
    this._callbacks = [];
    this._lastTime = this._startTime = Date.now();
    if (autoStart) this.start();
}

Timer.prototype.stop = function(){
    clearTimeout(this.timeout);
};

Timer.prototype.start = function(intervalMillis){
    this.tickAmount = intervalMillis || this.tickAmount;
    this.timeout = setTimeout(this.loop.bind(this), this.tickAmount);
};

Timer.prototype.loop = function () {
    var now = Date.now();
    var delta = (now - this._lastTime) / this.tickAmount;
    this.time += this.tickAmount;
    var callbacks = this._callbacks;
    var l = callbacks.length;
    for (var i = 0; i < l; ++i) {
        var o = callbacks[i];
        if (!o.loop) continue;
        o.loop.apply(o, [delta, this.time]);
    }
    this._lastTime = now;
    var diff = (now - this._startTime) - this.time;
    this.timeout = setTimeout(this.loop.bind(this), (this.tickAmount - diff));
};

Timer.prototype.addObject = function (object) {
    this._callbacks.push(object);
};

Timer.prototype.removeObject = function (object) {
    var index = this._callbacks.indexOf(object);
    if (index == -1) return;
    this._callbacks.splice(index, 1);
};

Timer.prototype.dispose = function () {

    this._callbacks = null;
};

module.exports = Timer;



