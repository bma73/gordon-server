function Dictionary(initData) {
    this._values = {};
    this.length = 0;
    if (initData) {
        for (var key in initData) {
            this._values[key] = initData[key];
        }
    }
}

var p = Dictionary.prototype;

p.put = function (key, value) {
    if (!this._values[key]) this.length++;
    this._values[key] = value;
    return value;
};

p.get = function (key) {
    return this._values[key];
};

p.remove = function (key, disposeValue) {
    if (this._values[key] != null) this.length--;
    var value = this._values[key];
    if (disposeValue) {
        if ('dispose' in value) value.dispose();
    }
    this._values[key] = null;
    delete this._values[key];
    return value;
};

p.dispose = function (disposeValues) {
    for (var i in this._values) {
        this.remove(i, disposeValues);
    }
    this.length = 0;
};

p.hasKey = function (key) {
    return this._values[key] != null;
};

p.keysToArray = function () {
    var ret = [];
    for (var key in this._values) {
        ret.push(key);
    }
    return ret;
};

p.valuesToArray = function () {
    var ret = [];
    for (var key in this._values) {
        ret.push(this._values[key]);
    }
    return ret;
};

p.clone = function () {
    var d = new gordon.Dictionary();
    for (var i in this._values) {
        d.put(i, this._values[i]);
    }
    return d;
};

module.exports = Dictionary;