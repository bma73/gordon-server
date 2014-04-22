var winston = require('winston');
var config = require('../config');

var logger = new winston.Logger({
    transports: [
        new (winston.transports.Console)({ level: config.logger.level }),
        new (winston.transports.DailyRotateFile)({ filename: __dirname + "/../logs/" + config.logger.filename, datePattern: '.dd-MM-yyyy', level: config.logger.level })
    ]
});

module.exports = logger;