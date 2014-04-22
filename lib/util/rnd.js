exports.float = function (min, max) {
    return Math.random() * (max - min) + min;
}

exports.boolean = function (chance) {
    chance = chance || 0.5;
    return Math.random() < chance;
}

exports.sign = function (chance) {
    chance = chance || 0.5;
    return Math.random() < chance ? 1 : -1;
}

exports.bit = function (chance) {
    chance = chance || 0.5;
    return Math.random() < chance ? 1 : 0;
}

exports.integer = function (min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}



