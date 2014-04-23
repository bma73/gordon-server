var winston = require('winston');
var config = require('../config');
var fs = require('fs');

var dir = __dirname + '/../logs/';

if(!fs.existsSync(dir)){
    fs.mkdirSync(dir, function(err){
        if(err){
            console.log(err);
            return;
        }
    });
}

var logger = new winston.Logger({
    transports: [
        new (winston.transports.Console)({ level: config.logger.level }),
        new (winston.transports.DailyRotateFile)({ filename: dir + config.logger.filename, datePattern: '.dd-MM-yyyy', level: config.logger.level })
    ]
});

module.exports = logger;