
var Monitor = require('../lib/monitor');


// monitor should emit up
var ping = new Monitor({website: 'http://www.rflab.co.za', timeout: 0.2});

ping.on('up', function (obj) {
    console.log(obj.website + ' is up');
    ping.stop();
});


// website does now exist, monitor should emit down
var ping2 = new Monitor({website: 'http://www.rflabb.co.za', timeout: 0.2});

ping2.on('down', function (obj) {
    console.log(obj.website + ' is down');
    ping2.stop();
});