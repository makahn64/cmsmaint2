/**
 * Created by mkahn on 9/30/15.
 */

app.controller("authController", function ($scope, $log, drupal, superagent, userDefaults) {

    $log.info("Loading authController");

    $scope.ui = { showLoginBox: false, showUserInfo: false, showMessage: true, message: "Checking authorization status...", loginMsg: "" };
    $scope.cms = { url: undefined, username: undefined, pwd: undefined };

    $scope.cms.url = userDefaults.getStringForKey('sourceCMS', 'https://visacms.heliosinteractive.com/drupal');
    drupal.setDrupalUrl($scope.cms.url);


    $scope.authorize = function(){
        $scope.ui.loginMsg = '';
        drupal.setDrupalUrl($scope.cms.url);
        userDefaults.setStringForKey('sourceCMS', $scope.cms.url);
        drupal.login($scope.cms.username, $scope.cms.pwd);
    }


    $scope.deauthorize = function(){
        $log.info("Logout requested");
        drupal.logout();
    }

    drupal.getUserStatus()
        .catch( function(err){
            $log.error("Bad shit getting user status: "+err);
            showLogin();
        });

    function showLogin(){
        $scope.ui.showLoginBox = true;
        $scope.ui.showMessage = false;
    }

    $scope.$on('authOK', function() {
        $scope.user = drupal.getUser().user;
        $scope.ui.message = "Logged in as: " + $scope.user.name;
        $scope.ui.showMessage = true;
        $scope.ui.showLoginBox = false;
        $scope.ui.loginMsg = "";
    });

    $scope.$on('badUser', function() {
        $scope.ui.loginMsg = "Error logging in. Unrecognized username or password.";
        $scope.ui.showLoginBox = true;
        $scope.ui.showMessage = false;
    });

    $scope.$on('userLogOut', showLogin);

});