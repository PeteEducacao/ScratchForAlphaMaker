(function (ext) {
	console.log("V 2");

	var potentialDevices = [];

	var device = null;
	var rawData = null;
	var lang = 'en';

	var active = true;
	var watchdog = null;
	var poller = null;

	var portsValue = new Array(4);
	var portsID = new Array(4);
	var portsSelectedSensor = new Array(4);
	var pinsValues = new Uint16Array(22);

	// Variavel para controlar o envio de menssagens de debug.
	var debugLevel = 2;

	//Event block, can be used with any condition
	ext.event = function (condition) {
		if (condition)
			return true;
		return false;
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

		watchdog = setTimeout(function () {
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