var app = angular.module('nwApp', ['ngRoute', 'ui.bootstrap',
    'ngDrupal', 'cmsModel.service', 'superagent.service',
    'userdefaults.service', 'fileDialogService', 'chart.js',
    'migrate.service']);

app.run(function ($log) {
    $log.info("App RUNning");
});

app.config(function($httpProvider) {
    //Enable cross domain calls
    $httpProvider.defaults.useXDomain = true;

    // Allows us to add a header "__XHR__" to $http requests with a function
    // value that will receive the XMLHttpRequest object as its argument.
    XMLHttpRequest.prototype.setRequestHeader = (function(req) {
        return function(header, value) {
            if ((header == "__XHR__") && angular.isFunction(value))
                value(this);
            else
                req.apply(this, arguments);
        };
    })(XMLHttpRequest.prototype.setRequestHeader);
});