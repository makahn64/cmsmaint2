app.config(function ($routeProvider) {
    $routeProvider

        .when('/analyze', {
            templateUrl: 'app/components/analyze/analyze.partial.html',
            controller: 'analyzeController'
        })

        .when('/auth', {
            templateUrl: 'app/components/auth/auth.partial.html',
            controller: 'authController'
        })

        .when('/snapshot', {
            templateUrl: 'app/components/snapshot/snapshot.partial.html',
            controller: 'snapshotController'
        })

        .when('/help', {
            templateUrl: 'app/components/help/help.partial.html',
            controller: 'helpController'
        })

        .when('/migrate-ex', {
            templateUrl: 'app/components/migrate/migrateexample.partial.html',
            controller: 'migrateController'
        })

        .otherwise('/auth');

});
