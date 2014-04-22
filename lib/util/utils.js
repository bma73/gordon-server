function toJSON(object) {
    var json = JSON.stringify(object, function (key, value) {

        if (object._stringifyIncludes != null){
            if (object._stringifyIncludes.indexOf(key) == -1) return undefined;
        }
        return value;
    });
    return json;
}

exports.toJSON = toJSON;
