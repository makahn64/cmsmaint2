app.controller("rootController", function ($scope, $log, drupal, userDefaults) {

    $log.info("Loading root controller");

    drupal.setDrupalUrl(userDefaults.getStringForKey('sourceCMS', "https://visacms.heliosinteractive.com/drupal"));

    drupal.getUserStatus().then(function () {
        $scope.globalUser = drupal.getUser();
    });


});
