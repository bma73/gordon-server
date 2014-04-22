'use strict';

module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        yuidoc: {

            server: {
                'name': 'Gordon Server',
                'version': '<%= pkg.version %>',
                options: {
                    paths: 'lib/',
                    themedir: 'build/theme/',
                    outdir: 'docs/'
                }
            }
        }
    });
    grunt.loadNpmTasks('grunt-contrib-yuidoc');
    grunt.registerTask('default', ['yuidoc']);
};
