/**
 * Created by mkahn on 9/30/15.
 */

app.controller("analyzeController", function ($scope, $log, drupal) {

    $log.info("Loading analyzeController");

    $scope.ready = false;
    $scope.ui = { statusMain: "", running: false };
    var _nodes;

    drupal.getUserStatus()
        .then(function () {
            $scope.globalUser = drupal.getUser();
            $scope.ready = true;
        }, function(err) {
            $log.error("Unable to get user status." + err);
            $scope.ready = true;
        });


    $scope.begin = function() {

        $scope.ui.running = true;
        $scope.ui.statusMain = "Fetching all nodes...";

        drupal.fetchNodes()
            .then( function(data){
                $scope.ui.statusMain = data.data.length + " nodes fetched.";

                _nodes = data.data;
                var types = [];
                var counts = {};

                $scope.donutlabels = [];
                $scope.donutdata = [];

                _nodes.forEach( function(node){

                    if ( _.includes(types, node.type) ){
                        counts[node.type]++;
                    } else {
                        types.push(node.type);
                        counts[node.type]=1;
                    }

                });

                for (var key in counts){
                    $scope.donutlabels.push(key);
                    $scope.donutdata.push(counts[key]);
                }

                $scope.counts = counts;

            })

    }

});