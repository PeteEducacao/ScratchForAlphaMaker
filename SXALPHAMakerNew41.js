(function (ext) {
	console.log("V 11");

	var potentialDevices = [];

	var device = null;
	var rawData = null;
	var lang = 'en';

	var active = true;
	var comWatchdog = null;
	var poller = null;

  var connected = false; 

	// Variavel para controlar o envio de menssagens de debug.
	var debugLevel = 2;

	//Event block, can be used with any condition
	ext.event = function(condition){
		if(condition)
			return true;
		return false;
	}
	
		//Connect a sensor to a port
	ext.connectSensor = function(sensor, port){
		switch(port){
			case menus[lang]['ports'][0]:
				portsSelectedSensor[0] = sensor;
				break;
			case menus[lang]['ports'][1]:
				portsSelectedSensor[1] = sensor;
				break;
			case menus[lang]['ports'][2]:
				portsSelectedSensor[2] = sensor;
				break;
			case menus[lang]['ports'][3]:
				portsSelectedSensor[3] = sensor;
				break;
		}
	}
	
	//Turn on/off the actuator
	ext.setActuator = function(option, port){
		var setMessage = new Uint8Array(5);
		setMessage[0] = 77; //M
		setMessage[3] = 50; //2
		setMessage[4] = 13; //\r
		
		switch(option){
			//On
			case menus[lang]['on_off'][0]:
				setMessage[1] = 87; //W
				break;
			//Off
			case menus[lang]['on_off'][1]:
				setMessage[1] = 119; //w
				break;
		}
		
		switch(port){
			case menus[lang]['ports'][0]:
				setMessage[2] = 49; //1
				break;
			case menus[lang]['ports'][1]:
				setMessage[2] = 50; //2
				break;
			case menus[lang]['ports'][2]:
				setMessage[2] = 51; //3
				break;
			case menus[lang]['ports'][3]:
				setMessage[2] = 52; //4
				break;
		}
		
		device.send(setMessage.buffer);
	}
	
	//Read the port, automatically convert the value using the selected sensor
	ext.readPort = function(port){
		switch(port){
			case menus[lang]['ports'][0]:
				port = 0;
				break;
			case menus[lang]['ports'][1]:
				port = 1;
				break;
			case menus[lang]['ports'][2]:
				port = 2;
				break;
			case menus[lang]['ports'][3]:
				port = 3;
	 			break;
	 	}
	 	
	 	//'Contato', 'Proximidade', 'Faixa', 'Cor', 'Luz (Lux)', 'Som (dB)', 'Temperatura (°C)',
		//'Resistência (Ohm)', 'Tensão (V)', 'Distância (cm)', 'Distância Sharp (cm)'
	 	switch(portsSelectedSensor[port]){
	 		//Digital
		 	case menus[lang]['sensors'][0]:
		 	case menus[lang]['sensors'][1]:
		 	case menus[lang]['sensors'][2]:
		 		return portsValue[port];
		 	//Color
		 	case menus[lang]['sensors'][3]:
		 		return convertToColor(portsValue[port]);
		 	//Light
		 	case menus[lang]['sensors'][4]:
		 		return convertToLux(portsValue[port]);
		 	//Sound
		 	case menus[lang]['sensors'][5]:
		 		return convertToDb(portsValue[port]);
		 	//Temperature
		 	case menus[lang]['sensors'][6]:
		 		return convertToCelsius(portsValue[port]);
		 	//Resistance
		 	case menus[lang]['sensors'][7]:
		 		return convertToOhm(portsValue[port]);
		 	//Voltage
		 	case menus[lang]['sensors'][8]:
		 		return convertToVolts(portsValue[port]);
		 	//Distance
		 	case menus[lang]['sensors'][9]:
		 		return convertToCentimeters(portsValue[port]);
		 	//Distance Sharp
		 	case menus[lang]['sensors'][10]:
		 		return convertToCentimetersSharp(portsValue[port]);
		 	default:
		 		return portsValue[port];
	 	}
	}
	
	//Returns a color to use when comparing
	ext.getColor = function(color){
		return color;
	}

	//Set pin mode to analog input. Enables the analog readings report
	ext.setModeAnalog = function(pin){
		pin = Math.round(pin);
		
		if(pin > 5)
			return;
			
		var setMessage = new Uint8Array(5);
		setMessage[0] = 77; //M
		setMessage[1] = 88; //X
		setMessage[3] = 97; //a
		setMessage[4] = 13; //\r
		
		pin += 97;
		setMessage[2] = pin;
		
		device.send(setMessage.buffer);
	}
	
	//Read analog pin
	ext.analogRead = function(pin){
		pin = Math.round(pin);
		
		if(pin > 5)
			return -1;
		return pinsValues[pin];
	}
	
	//Set pin mode as input or output
	ext.setModePorts = function(pin, mode){
		pin = Math.round(pin);
		
		if(pin > 15)
			return;
		
		var setMessage = new Uint8Array(5);
		setMessage[0] = 77; //M
		setMessage[1] = 88; //X
		setMessage[4] = 13; //\r
		
		pin += 103;
		setMessage[2] = pin;
			
		switch(mode){
			//Input. Enable reading report
			case menus[lang]['pinModes'][0]:
				setMessage[3] = 100; //d
				break;
			//Output. Disable reading report
			case menus[lang]['pinModes'][1]:
				setMessage[3] = 110; //n
				break;
		}
		
		device.send(setMessage.buffer);
	}
	
	//Enable or disable pin pull-up
	ext.setPullUp = function(mode, pin){
		pin = Math.round(pin);
		
		if(pin > 15)
			return;
			
		var setMessage = new Uint8Array(6);
		setMessage[0] = 77; //M
		setMessage[1] = 89; //Y
		setMessage[2] = 121; //y
		setMessage[5] = 13; //\r
		
		//Enable
		if(mode == menus[lang]['enable_disable'][0]){
			pin = pin + 100;
		}
		else{
			pin = pin + 200;
		}
		
		setMessage[3] = convertToHex((pin & 0xF0) >> 4);
		setMessage[4] = convertToHex((pin & 0x0F));
		
		device.send(setMessage.buffer);
		printLog(setMessage);
	}
	
	//Read digital pin
	ext.digitalRead = function(pin){
		pin = Math.round(pin);
		
		if(pin > 15)
			return -1;
		return pinsValues[pin + 6];
	}
	
	//Set or reset a pin
	ext.digitalWrite = function(status, pin){
		pin = Math.round(pin);
		
		if(pin > 15)
			return;

		var setMessage = new Uint8Array(6);
		setMessage[0] = 77; //M
		setMessage[1] = 89; //Y
		setMessage[5] = 13; //\r
		
		pin += 100;
		setMessage[3] = convertToHex((pin & 0xF0) >> 4);
		setMessage[4] = convertToHex((pin & 0x0F));
		
		switch(status){
			//On
			case menus[lang]['on_off'][0]:
				setMessage[2] = 203;
				break;
			//Off
			case menus[lang]['on_off'][1]:
				setMessage[2] = 202;
				break;
		}
		
		device.send(setMessage.buffer);
	}
	
	//Control the servos angle
	ext.setServo = function(servo, angle){
		angle = Math.round(angle);
		
	 	var sendServo = new Uint8Array(7);
		sendServo[0] = 77; //M
		sendServo[2] = 13; //\r
		sendServo[6] = 13; //\r
		
		if(angle < 0)
			angle = 0;
		if(angle > 180)
			angle = 180;
		sendServo[3] = angle / 100 + 48;
		sendServo[4] = (angle % 100) / 10 + 48;
		sendServo[5] = angle % 10 + 48;
		
		if(servo == menus[lang]['servos'][0])
			sendServo[1] = 111; //o
		if(servo == menus[lang]['servos'][1])
			sendServo[1] = 112; //p
			
		device.send(sendServo.buffer);
	}
	
	//Control the motors direction and power
	ext.setMotor = function(motor, direction, power){
		power = Math.round(power);
		
	 	var sendMotor = new Uint8Array(7);
		sendMotor[0] = 77; //M
		sendMotor[2] = 13; //\r
		sendMotor[6] = 13; //\r
			
		if(power < 0)
			power = 0;
		if(power > 100)
			power = 100;
		if(direction == menus[lang]['directions'][1])
			power = power + 128;
		sendMotor[3] = power / 100 + 48;
		sendMotor[4] = (power % 100) / 10 + 48;
		sendMotor[5] = power % 10 + 48;
			
		if(motor == menus[lang]['motor'][0])
			sendMotor[1] = 101 //e
		if(motor == menus[lang]['motor'][1])
			sendMotor[1] = 100 //d
		
		device.send(sendMotor.buffer);
	}
	
	//Stop the motor
	ext.stopMotor = function(motor){
		var sendMotor = new Uint8Array(7);
		sendMotor[0] = 77; //M
		sendMotor[2] = 13; //\r
		sendMotor[3] = 48; //0
		sendMotor[4] = 48; //0
		sendMotor[5] = 48; //0
		sendMotor[6] = 13; //\r
			
		if(motor == menus[lang]['motor'][0])
			sendMotor[1] = 101 //e
		if(motor == menus[lang]['motor'][1])
			sendMotor[1] = 100 //d
		
		device.send(sendMotor.buffer); 
	}

	function tryNextDevice() {
		device = potentialDevices.shift();
		if (!device)
			return;
		console.log("Device: " + device.id);
		device.open({stopBits: 0, bitRate: 9600, ctsFlowControl: 0}, function () {
			device.set_receive_handler(function (data) {
				console.log("RECEBIDO");

				//processInput(new Uint8Array(data));
			});
		});

		poller = setInterval(function () {
			pingDevice();
		}, 1000);

		comWatchdog = setTimeout(function () {
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

	ext.whenIMUEvent = function (imuEvent) {
		return imuEventData[IMU_EVENT_SHAKE];
	};

	ext._getStatus = function () {
		if (connected)
			return {status: 2, msg: 'Arduino connected'};
		else
			return {status: 1, msg: 'Arduino disconnected'};
	};

	ext._deviceConnected = function (dev) {
		potentialDevices.push(dev);
		if (!device)
			tryNextDevice();
	};

	ext._deviceRemoved = function (dev) {
		console.log('device removed');
		pinModes = new Uint8Array(12);
		if (device != dev)
			return;
		device = null;
	};

	ext._shutdown = function () {
		// TODO: Bring all pins down
		if (device)
			device.close();
		device = null;
	};

//Definicao do onjunto de Blocos
	var menus = {
		en: {
			ports: ['S1', 'S2', 'S3', 'S4'],
			sensors: ['Touch', 'Infrared', 'Line', 'Color', 'Light (Lux)', 'Sound (dB)', 'Temperature (°C)',
				'Electrical Resistance (Ohm)', 'Electrical Voltage (V)', 'Ultrasonic (cm)'],
			colors: ['Blue', 'Red', 'Yellow', 'Green', 'White', 'Black', 'Undefined'],
			enable_disable: ['Enable', 'Disable'],
			on_off: ['Turn on', 'Turn off'],
			pinModes: ['imput', 'output'],
			servos: ['SV1', 'SV2'],
			motor: ['ME', 'MD'],
			directions: ['Forward', 'Backward'],
			notes: ['C', 'D flat', 'D', 'E flat', 'E', 'F', 'G flat', 'G', 'A flat', 'A', 'B flat', 'B'],
			corFaixa: ['light', 'dark'],
			comportamentoLuz: ['Follow', 'Escape from']

		},
		es: {
			ports: ['S1', 'S2', 'S3', 'S4'],
			sensors: ['Contacto', 'Infrarrojo', 'línea', 'Color', 'Luz (Lux)', 'Sonido (dB)', 'Temperatura (°C)',
				'Resistencia eléctrica (Ohm)', 'Voltaje(V)', 'Ultrasonido (cm)'],
			colors: ['Azul', 'Rojo', 'Amarillo', 'Verde', 'Blanco', 'Negro', 'Indefinido'],
			enable_disable: ['Permitir', 'Inhabilitar'],
			on_off: ['Encender', 'Apagar'],
			pinModes: ['entrada', 'salida'],
			servos: ['SV1', 'SV2'],
			motor: ['ME', 'MD'],
			directions: ['avanza', 'retrocede'],
			notes: ['Do', 'Re bemol', 'Re', 'Mi bemol', 'Mi', 'Fa', 'Sol bemol', 'Sol', 'La bemol', 'La', 'Si bemol', 'Si'],
			corFaixa: ['clara', 'oscura'],
			comportamentoLuz: ['Sigue', 'Escapa de']
		},
		pt: {
			ports: ['S1', 'S2', 'S3', 'S4'],
			sensors: ['Contato', 'Proximidade', 'Faixa', 'Cor', 'Luz (Lux)', 'Som (dB)', 'Temperatura (°C)',
				'Resistência elétrica (Ohm)', 'Tensão elétrica(V)', 'Distância (cm)'],
			colors: ['Azul', 'Vermelha', 'Amarela', 'Verde', 'Branca', 'Preta', 'Indefinida'],
			enable_disable: ['Habilite', 'Desabilite'],
			on_off: ['Ligar', 'Desligar'],
			pinModes: ['entrada', 'saída'],
			servos: ['SV1', 'SV2'],
			motor: ['ME', 'MD'],
			directions: ['frente', 'ré'],
			notes: ['Dó', 'Ré bemol', 'Ré', 'Mi bemol', 'Mi', 'Fá', 'Sol bemol', 'Sol', 'Lá bemol', 'Lá', 'Sí bemol', 'Si'],
			corFaixa: ['clara', 'escura'],
			comportamentoLuz: ['Siga', 'Fuja']
		}
	};

	var blocks = {
		en: [
			['h', 'Event %b', 'event', 0],
			[' ', 'Connect  %m.sensors sensor on  %m.ports port', 'connectSensor', ' ', 'S1'],
			//	  [' ', '%m.on_off cabo de luz na porta %m.ports', 'setActuator', menus['on_off'][0], menus['ports'][0]],
			['r', 'Read port %m.ports', 'readPort', 'S1'],
			['r', 'Color %m.colors', 'getColor', 'Blue'],
			['-'],
			//	  [' ', 'Configurar A%n como entrada analógica', 'setModeAnalog', 0],
			//	  ['r', 'Ler A%n', 'analogRead', 0],
			//	  [' ', 'Configurar P%n como %m.pinModes digital', 'setModePorts', 0, menus['pinModes'][0]],
			//	  [' ', '%m.enable_disable pull-up na porta P%n', 'setPullUp', menus['enable_disable'][0], 0],
			//	  ['r', 'Ler P%n', 'digitalRead', 0],
			//	  [' ', '%m.on_off P%n', 'digitalWrite', menus['on_off'][0], 0],
			['-'],
			[' ', 'Servo %m.servos %n °', 'setServo', 'SV1', 0],
			[' ', 'Motor %m.motor %m.directions %n %', 'setMotor', 'ME', 'Forward', 0],
			[' ', 'Stop motor %m.motor', 'stopMotor', 'ME'],
			['-'],
			['w', 'Play musical note %m.notes for %n seconds', 'playNoteTime', 'c', 1],
			[' ', 'Play musical note %m.notes', 'playNote', 'C'],
			[' ', 'Mute', 'mute'],
			[' ', '%m.comportamentoLuz  the light', 'sigaFujaFaixa', 'Follow'],
			[' ', 'Follow %m.corFaixa line ', 'sigaFaixa', 'light'],
			[' ', 'Stop', 'paraMotores']
		],

		es: [
			['h', 'Evento %b', 'event', 0],
			[' ', 'Conexión de sensor de %m.sensors en lo puerto %m.ports', 'connectSensor', ' ', 'S1'],

			['r', 'Leer puerto %m.ports', 'readPort', 'S1'],
			['r', 'Color %m.colors', 'getColor', 'Azul'],
			['-'],

			['-'],
			[' ', 'Servo %m.servos %n °', 'setServo', 'SV1', 0],
			[' ', 'Motor %m.motor %m.directions %n %', 'setMotor', 'ME', 'avanza', 0],
			[' ', 'Pare motor %m.motor', 'stopMotor', 'ME'],
			['-'],
			['w', 'Tocar la nota %m.notes durante %n segundos', 'playNoteTime', 'Do', 1],
			[' ', 'Tocar la nota %m.notes', 'playNote', 'Do'],
			[' ', 'Mudo', 'mute'],
			[' ', '%m.comportamentoLuz Luz', 'sigaFujaFaixa', 'Sigue'],
			[' ', 'Sigue a Linea %m.corFaixa', 'sigaFaixa', 'clara'],
			[' ', 'Pare', 'paraMotores']
		],

		pt: [
			['h', 'Evento %b', 'event', 0],
			[' ', 'Conectar sensor de %m.sensors na porta %m.ports', 'connectSensor', ' ', 'S1'],
			//	  [' ', '%m.on_off cabo de luz na porta %m.ports', 'setActuator', menus['on_off'][0], menus['ports'][0]],
			['r', 'Ler porta %m.ports', 'readPort', 'S1'],
			['r', 'Cor %m.colors', 'getColor', 'Azul'],
			['-'],
			//	  [' ', 'Configurar A%n como entrada analógica', 'setModeAnalog', 0],
			//	  ['r', 'Ler A%n', 'analogRead', 0],
			//	  [' ', 'Configurar P%n como %m.pinModes digital', 'setModePorts', 0, menus['pinModes'][0]],
			//	  [' ', '%m.enable_disable pull-up na porta P%n', 'setPullUp', menus['enable_disable'][0], 0],
			//	  ['r', 'Ler P%n', 'digitalRead', 0],
			//	  [' ', '%m.on_off P%n', 'digitalWrite', menus['on_off'][0], 0],
			['-'],
			[' ', 'Servo %m.servos %n °', 'setServo', 'SV1', 0],
			[' ', 'Motor %m.motor %m.directions %n %', 'setMotor', 'ME', 'frente', 0],
			[' ', 'Pare motor %m.motor', 'stopMotor', 'ME'],
			['-'],
			['w', 'Tocar a nota %m.notes por %n segundos', 'playNoteTime', 'Dó', 1],
			[' ', 'Tocar a nota %m.notes', 'playNote', 'Dó'],
			[' ', 'Mudo', 'mute'],
			[' ', '%m.comportamentoLuz Luz', 'sigaFujaFaixa', 'Siga'],
			[' ', 'Siga a Faixa %m.corFaixa', 'sigaFaixa', 'clara'],
			[' ', 'Pare', 'paraMotores']
		]
	};


	var descriptor = {
		blocks: blocks[lang],
		menus: menus[lang],
		url: 'http://PeteEducacao.github.io/ScratchForAlphaMaker'
	};

	// Descricao do hardware

	ScratchExtensions.register('ALPHA Maker', descriptor, ext, {type: 'serial'});
})({});