(function(ext) {
  var potentialDevices = [];
  var watchdog = null;
  var poller = null;
  var lastReadTime = 0;
  var connected = false;
  var command = null;
  var parsingCmd = false;
  var bytesRead = 0;
  var waitForData = 0;
  var storedInputData = new Uint8Array(4096);

  var device = null;

  function tryNextDevice() {
 		console.log("v 5");

    device = potentialDevices.shift();
    if (!device) return;
    console.log("Device: "+device.id);
    device.open({stopBits: 0, bitRate: 9600, ctsFlowControl: 0}, function() {
      device.set_receive_handler(function(data) {
        console.log("RECEBIDO");

        //processInput(new Uint8Array(data));
      });
    });

    poller = setInterval(function() {
      pingDevice();
    }, 1000);

    watchdog = setTimeout(function() {
      clearTimeout(poller);
      poller = null;
      device.set_receive_handler(null);
      device.close();
      device = null;
      tryNextDevice();
    }, 5000);
  }

  function pingDevice() {
    console.log("pinging");
 		 	var sendMa = new Uint8Array(5);
			sendMa[0] = 77; //M
		 	sendMa[1] = 97; //a
      sendMa[2] = 49; //1
      sendMa[3] = 48; //0
			sendMa[4] = 13; //\r
      
			device.send(sendMa.buffer);
  }

  ext.whenIMUEvent = function(imuEvent) {
    return imuEventData[IMU_EVENT_SHAKE];
  };

  ext._getStatus = function() {
    if (connected) return {status: 2, msg: 'Arduino connected'};
    else return {status: 1, msg: 'Arduino disconnected'};
  };

  ext._deviceConnected = function(dev) {
    potentialDevices.push(dev);
    if (!device) tryNextDevice();
  };

  ext._deviceRemoved = function(dev) {
    console.log('device removed');
    pinModes = new Uint8Array(12);
    if (device != dev) return;
    device = null;
  };

  ext._shutdown = function() {
    // TODO: Bring all pins down
    if (device) device.close();
    device = null;
  };

  var blocks = [
    [' ', 'set pin %d.digitalOutputs %m.outputs', 'digitalWrite', 13, 'on'],
    [' ', 'set pin %d.analogOutputs to %n%', 'analogWrite', 9, 100],
    ['h', 'when pin %d.digitalInputs is %m.outputs', 'whenDigitalRead', 9, 'on'],
    ['b', 'pin %d.digitalInputs on?', 'digitalRead', 9],
    ['-'],
    ['h', 'when analog pin %d.analogInputs %m.ops %n%', 'whenAnalogRead', 'A0', '>', 50],
    ['r', 'read analog pin %d.analogInputs', 'analogRead', 'A0'],
    ['-'],
    ['h', 'when shaken', 'whenIMUEvent'],
    ['r', 'tilt angle %m.tiltDir', 'getTilt', 'up'],
    ['-'],
    [' ', 'turn servo %d.digitalOutputs %m.dir', 'rotateServo', 3, 'left'],
    [' ', 'turn servo %d.digitalOutputs %m.outputs', 'setServo', 3, 'on'],
    [' ', 'set servo %d.digitalOuputs speed to %n', 'setServoSpeed', 3, 100]
  ];

  var descriptor = {
    blocks: blocks,
    menus: menus,
		url: 'http://PeteEducacao.github.io/ScratchForAlphaMaker'
	};
	
	// Descricao do hardware
	
	ScratchExtensions.register('ALPHA Maker', descriptor, ext,{type: 'serial'});
})({});
