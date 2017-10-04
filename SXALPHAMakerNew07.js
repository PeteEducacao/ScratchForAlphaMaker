(function (ext) {
	console.log("V 101");

	var potentialDevices = [];

	var device = null;
	var rawData = null;
	var lang = 'en';
	var messageBuffer = "";

	var watchdog = null;
	var comWatchdog = null;
	var poller = null;

	var dataLost = 0;
	var canRequest = 0;

	var connected = false;
	var found = false;
	
	var portsValue = new Array(4);
	var portsID = new Array(4);
	var toWrite = new Array();
	var portsSelectedSensor = new Array(4);
	var pinValues = new Uint16Array(22);

	// Variavel para controlar o envio de mensagens de debug.
	var debugLevel = 2; 

	// Verifica o parametro para escolha do idioma
	var paramString = window.location.search.replace(/^\?|\/$/g, '');
	var vars = paramString.split("&");
	for (var i = 0; i < vars.length; i++) {
		var pair = vars[i].split('=');
		if (pair.length > 1 && pair[0] == 'lang')
			lang = pair[1];
	}

	//Event block, can be used with any condition
	ext.event = function (condition) {
		if (condition)
			return true;
		return false;
	}

	//Connect a sensor to a port
	ext.connectSensor = function (sensor, port) {
		switch (port) {
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
	ext.setActuator = function (option, port) {
		var setMessage = "M__2";

		switch (option) {
			//On
			case menus[lang]['on_off'][0]:
				setMessage = setMessage.replaceAt(1,"W");
				break;
			//Off
			case menus[lang]['on_off'][1]:
				setMessage = setMessage.replaceAt(1,"w");
				break;
		}

		switch (port) {
			case menus[lang]['ports'][0]:
				setMessage = setMessage.replaceAt(2,"1");
				break;
			case menus[lang]['ports'][1]:
				setMessage = setMessage.replaceAt(2,"2");
				break;
			case menus[lang]['ports'][2]:
				setMessage = setMessage.replaceAt(2,"3");
				break;
			case menus[lang]['ports'][3]:
				setMessage = setMessage.replaceAt(2,"4");
				break;
		}

		addStringToWrite(setMessage);
	}

	//Read the port, automatically convert the value using the selected sensor
	ext.readPort = function (port) {
		switch (port) {
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
		//'Resistência (Ohm)', 'Tensão (V)', 'Distância (cm)', 'Genérico'
		
		switch (portsSelectedSensor[port]) {
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
				//Genérico
			case menus[lang]['sensors'][10]:
			default:
				return portsValue[port];
		}
	}
	
	//Returns a color to use when comparing
	ext.getColor = function (color) {
		return color;
	}

	//Set pin mode to analog input. Enables the analog readings report
	ext.setModeAnalog = function (pin) {
		pin = Math.round(pin);

		if (pin > 5)
			return;

		var setMessage = "MX_a";

		pin += 97;
		setMessage = setMessage.replaceAt(2,String.fromCharCode(pin));

		addStringToWrite(setMessage);
	}

	//Read analog pin
	ext.analogRead = function (pin) {
		pin = Math.round(pin);

		if (pin > 5)
			return -1;
		return pinValues[pin];
	}

	//Set pin mode as input or output
	ext.setModePorts = function (pin, mode) {
		pin = Math.round(pin);

		if (pin > 15)
			return;

		var setMessage = "MX__";

		pin += 103;
		setMessage = setMessage.replaceAt(2,String.fromCharCode(pin));

		switch (mode) {
			//Input. Enable reading report
			case menus[lang]['pinModes'][0]:
				setMessage = setMessage.replaceAt(3,"d");
				break;
				//Output. Disable reading report
			case menus[lang]['pinModes'][1]:
				setMessage = setMessage.replaceAt(3,"n");
				break;
		}

		addStringToWrite(setMessage);
	}

	//Enable or disable pin pull-up
	ext.setPullUp = function (mode, pin) {
		pin = Math.round(pin);

		if (pin > 15)
			return;

		var setMessage = "MYy__";

		//Enable
		if (mode == menus[lang]['enable_disable'][0]) {
			pin = pin + 100;
		} else {
			pin = pin + 200;
		}

		setMessage = setMessage.replaceAt(3,String.fromCharCode(convertToHex((pin & 0xF0) >> 4)));
		setMessage = setMessage.replaceAt(4,String.fromCharCode(convertToHex(convertToHex((pin & 0x0F)))));

		addStringToWrite(setMessage);
		printLog(setMessage);
	}

	//Read digital pin
	ext.digitalRead = function (pin) {
		pin = Math.round(pin);

		if (pin > 15)
			return -1;
		return pinValues[pin + 6];
	}

	//Set or reset a pin
	ext.digitalWrite = function (status, pin) {
		pin = Math.round(pin);

		if (pin > 15)
			return;

		var setMessage = "MY___";

		pin += 100;
		setMessage = setMessage.replaceAt(3,String.fromCharCode(convertToHex(convertToHex((pin & 0xF0) >> 4))));
		setMessage = setMessage.replaceAt(4,String.fromCharCode(convertToHex((pin & 0x0F))));

		switch (status) {
			//On
			case menus[lang]['on_off'][0]:
				setMessage = setMessage.replaceAt(2,String.fromCharCode(203));
				break;
				//Off
			case menus[lang]['on_off'][1]:
				setMessage = setMessage.replaceAt(2,String.fromCharCode(202));
				break;
		}

		addStringToWrite(setMessage);
	}

	//Control the servos angle
	ext.setServo = function (servo, angle) {
		angle = Math.round(angle);

		var sendServo = "M_\r___";

		if (angle < 0)
			angle = 0;
		if (angle > 180)
			angle = 180;
		
		sendServo = sendServo.replaceAt(3,String.fromCharCode(angle / 100 + 48));
		sendServo = sendServo.replaceAt(4,String.fromCharCode((angle % 100) / 10 + 48));
		sendServo = sendServo.replaceAt(5,String.fromCharCode(angle % 10 + 48));
		
		if (servo == menus[lang]['servos'][0])
			sendServo = sendServo.replaceAt(1,"o");
		if (servo == menus[lang]['servos'][1])
			sendServo = sendServo.replaceAt(1,"p");

		addStringToWrite(sendServo);
	}

	//Control the motors direction and power
	ext.setMotor = function (motor, direction, power) {
		power = Math.round(power);
		var sendMotor = "M_\r___";
		
		if (power < 0)
			power = 0;
		if (power > 100)
			power = 100;
		if (direction == menus[lang]['directions'][1])
			power = power + 128;
		
		
		sendMotor = sendMotor.replaceAt(3,String.fromCharCode(power / 100 + 48));
		sendMotor = sendMotor.replaceAt(4,String.fromCharCode((power % 100) / 10 + 48));
		sendMotor = sendMotor.replaceAt(5,String.fromCharCode(power % 10 + 48));
		
		if (motor == menus[lang]['motor'][0])
			sendMotor = sendMotor.replaceAt(1,"e");
		if (motor == menus[lang]['motor'][1])
			sendMotor = sendMotor.replaceAt(1,"d");
		
		addStringToWrite(sendMotor);
	}

	//Stop the motor
	ext.stopMotor = function (motor) {
		var sendMotor = "M_\r000";

		if (motor == menus[lang]['motor'][0])
			sendMotor = sendMotor.replaceAt(1,"e");
		if (motor == menus[lang]['motor'][1])
			sendMotor = sendMotor.replaceAt(1,"d");

		addStringToWrite(sendMotor);
	}

	//Play a note for certain amount of time
	ext.playNoteTime = function (note, time, callback) {
		ext.playNote(note);
		window.setTimeout(function () {
			ext.mute();
			callback();
		}, time * 1000);
	}

	//Play a note
	ext.playNote = function (note) {
		var sendSound = "MM\r___";

		var value;

		switch (note) {
			case menus[lang]['notes'][0]:
				value = 118;
				break;
			case menus[lang]['notes'][1]:
				value = 112;
				break;
			case menus[lang]['notes'][2]:
				value = 105;
				break;
			case menus[lang]['notes'][3]:
				value = 99;
				break;
			case menus[lang]['notes'][4]:
				value = 94;
				break;
			case menus[lang]['notes'][5]:
				value = 88;
				break;
			case menus[lang]['notes'][6]:
				value = 83;
				break;
			case menus[lang]['notes'][7]:
				value = 79;
				break;
			case menus[lang]['notes'][8]:
				value = 74;
				break;
			case menus[lang]['notes'][9]:
				value = 70;
				break;
			case menus[lang]['notes'][10]:
				value = 66;
				break;
			case menus[lang]['notes'][11]:
				value = 62;
				break;
			default:
				value = 118
		}

		sendSound = sendSound.replaceAt(3,String.fromCharCode(value / 100 + 48));
		sendSound = sendSound.replaceAt(4,String.fromCharCode((value % 100) / 10 + 48));
		sendSound = sendSound.replaceAt(5,String.fromCharCode(value % 10 + 48));
		
		addStringToWrite(sendSound);
	}

	//Mute the device
	ext.mute = function () {
		var sendMute = "Mm";
		
		addStringToWrite(sendMute);
	}

	ext.sigaFujaFaixa = function (comportamento) {
		var sendSLuz = "MG_";

		if (comportamento == menus[lang]['comportamentoLuz'][0])  // Siga Luz
			sendSLuz = sendSLuz.replaceAt(2,"L");
		if (comportamento == menus[lang]['comportamentoLuz'][1])  // Fuja Luz
			sendSLuz = sendSLuz.replaceAt(2,"l");

		addStringToWrite(sendSLuz);
	}

	//Siga Faixa
	ext.sigaFaixa = function (tipoFaixa) {
		var sendSLuz = "MG_";

		if (tipoFaixa == menus[lang]['corFaixa'][0])  // clara
			sendSLuz = sendSLuz.replaceAt(2,"F");
		if (tipoFaixa == menus[lang]['corFaixa'][1])  // escura
			sendSLuz = sendSLuz.replaceAt(2,"f");

		addStringToWrite(sendSLuz);
	}

	//Para os motores e sai dos comandos siga.
	ext.paraMotores = function () {
		var sendSLuz = "MGp";
		addStringToWrite(sendSLuz);
	}

	function addStringToWrite(value) {
		if (toWrite.length == 0) {
			toWrite.push(value);
		}
	}

	//Convertion functions

	//Convert a number from 0 to 15 to hex
	convertToHex = function (v) {
		if (v < 10)
			return v + 48;
		return v + 65;
	}

	//Convert the value to a color
	function convertToColor(val) {
		//'Blue', 'Red', 'Yellow', 'Green', 'White', 'Black', 'Undefined'
		if (val <= 160)
			return menus[lang]['colors'][0];
		if (val > 160 && val <= 328)
			return menus[lang]['colors'][1];
		if (val > 328 && val <= 460)
			return menus[lang]['colors'][2];
		if (val > 460 && val <= 608)
			return menus[lang]['colors'][3];
		if (val > 608 && val <= 788)
			return menus[lang]['colors'][4];
		if (val > 788 && val <= 908)
			return menus[lang]['colors'][5];
		if (val > 908)
			return menus[lang]['colors'][6];
	}

	//Convert the value to Ohms
	function convertToOhm(val) {
		if (val < 10)
			val = 0;
		if (val > 1012)
			val = 1023;
		return Math.round(100000 * (1023 - val) / val);
	}

	//Convert the value to degrees Celcius
	function convertToCelsius(val) {
		return Math.round((3970 / (Math.log(-(110 / 111 * (val - 1023)) / val) + 3970 / 298.15)) - 273.15);
	}

	//Convert the value to Volts
	function convertToVolts(val) {
		return Math.round((6.47959 - (val * 5 / 294)) * 10) / 10;
	}

	//Convert the value to Lux
	function convertToLux(val) {
		return Math.round(5.0 * val / 16.31096775);
	}

	//Convert the value to dB
	function convertToDb(val) {
		return Math.round(10 * ((0.0491 * val) + 40)) / 10;
	}

	//Convert the value to cm
	function convertToCentimeters(val) {
		return Math.round(val * 0.2);
	}

	//************************************************************* 

	//Decode the received message
	function decodeMessage(data) {
		if (data.charAt(0) >= "A" && data.charAt(0) <= "D") {
			var portIndex = data.charCodeAt(0) - "A".charCodeAt(0);
			portsID[portIndex] = parseInt(data.substring(1));
			//consog("Recebido("+data+") - Port(+"+portIndex+"): "+portsID[portIndex]);

			return; 
		}
		
		if (data.charAt(0) >= "a" && data.charAt(0) <= "d") {
			var portIndex = data.charCodeAt(0) - "a".charCodeAt(0);
			portsValue[portIndex] = parseInt(data.substring(1));
			//console.log("Recebido("+data+") - Port(+"+portIndex+"): "+portsValue[portIndex]);
			return;
		}
		
		if (data.charAt(0) == "P") {
			var portIndex = data.charCodeAt(1) - "a".charCodeAt(0);
			pinValues[portIndex] = parseInt(data.substring(2));
			//console.log("Recebido("+data+") - Port(+"+portIndex+"): "+pinValues[portIndex]);
			return;
		}
	}

	function printLog(msg) {
		console.log(String.fromCharCode.apply(null, msg));
	}

	function appendBuffer(buffer1, buffer2) {
		var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
		tmp.set(new Uint8Array(buffer1), 0);
		tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
		return tmp.buffer;
	}

	function checkMaker(bytes) {
		var data = String.fromCharCode.apply(null, bytes);

		if (debugLevel >= 2)
			console.log('Dados: ' + data);

		var t_index = data.indexOf('t');
		var l_index = data.indexOf('l');
		if (t_index >= 0 && l_index >= 0) {
			t_index++;
			l_index++;
			var kernelVersion = data.substring(t_index, t_index + 4);
			var legalVersion = data.substring(l_index, l_index + 4);

			console.log('Kernel: ' + kernelVersion);
			console.log('Legal: ' + legalVersion);

			if (kernelVersion >= 106 && legalVersion >= 108) {
				return true;
			}
		}
		return false;
	}

	function myTrim(x) {
		return x.replace(/^\s+|\s+$/gm, '');
	}

	//Trata os dados recebidos
	function TrataDados(message) {
		dataLost = 0;
		if (debugLevel >= 2) {
			console.log('Dado Recebido: ' + message);
		}

		if (message == "MC" && connected) {
			closeConnection();
		}
		if (message == "pMK2.0" && !connected) {
			found = true;
		} else if (!connected && found && message == "Mnf") {
			sendDevice("Ms10");
			found = false;
		} else if (message == "Msk" && !connected) {
			connected = true;

			//Stop the timers
			clearTimeout(watchdog);
			watchdog = null;
			clearInterval(poller);
			poller = null;

			if (debugLevel >= 1)
				console.log('Inicia Aquisicao!');

			//Set a timer to check if the connection is still active and re-request data if data is lost
			comWatchdog = setInterval(function () {
				if (connected) {
					if (dataLost > 5) {
						closeConnection();
					} else if (dataLost > 2) {
						canRequest++;
						dataLost++;
					} else {
						dataLost++;
					}
				}
				else {
					dataLost = 0;
				}
			}, 1000);
			
			setTimeout(function () { requesterFunction(); }, 2000);
			
			canRequest = 1;
		} else if (connected) {
			if (message == "K") {
				canRequest++;
			}
			else {
				decodeMessage(message);
			}
		}
	}
	
	function closeConnection() {
		clearInterval(comWatchdog);
		comWatchdog = null;

		console.log('Conexão Perdida');
		device.set_receive_handler(null);
		device.close();
		device = null;
		found = false;
		connected = false;
		tryNextDevice();
	}
	
	function requesterFunction() {
		if (connected) {
			var nextDelay = 0;
			if (canRequest == 1) {
				if (toWrite.length > 0) {
					var auxToWrite = toWrite.shift();
					canRequest = 0;
					sendDevice(auxToWrite);
				} else {
					canRequest = 0;
					sendDevice("MV");
				}
			}
			else if (canRequest > 1) {
				canRequest--;
				nextDelay = 50;
			}
			setTimeout(function () { requesterFunction(); }, 2000+nextDelay);
		}
	}
	
	function sendDevice(s) {
		if (debugLevel >= 2)
			console.log('Dado Enviado: ' + s);
		device.send(stringToArrayBuffer(s+"\r"));
	}

	function stringToArrayBuffer(str) {
		if (/[\u0080-\uffff]/.test(str)) {
			throw new Error("this needs encoding, like UTF-8");
		}
		var arr = new Uint8Array(str.length);
		for (var i = str.length; i--; )
			arr[i] = str.charCodeAt(i);
		return arr.buffer;
	}

	function arrayBufferToString(buffer) {
		var arr = new Uint8Array(buffer);
		var str = String.fromCharCode.apply(String, arr);

		return str;
	}

	function tryNextDevice() {
		if (debugLevel >= 2)
			console.log("Executando: tryNextDevice");

		device = potentialDevices.shift();

		if (!device)
			return;

		device.open({stopBits: 0, bitRate: 9600, ctsFlowControl: 0}, function () {
			device.set_receive_handler(function (data) {

				var dataString = arrayBufferToString(data);
				var message = "";
				
				messageBuffer += dataString;
				
				while (messageBuffer.indexOf("\n") >= 0) {
					message = messageBuffer.substr(0, messageBuffer.indexOf("\n"));
					messageBuffer = messageBuffer.substr(messageBuffer.indexOf("\n") + 1);
					
					TrataDados(myTrim(message));
				}
			});
		});

		sendDevice("Mn");

		if (debugLevel >= 1)
			console.log('Tentando conectar com dispositivo ' + device.id);

		watchdog = setTimeout(function () {
			if (debugLevel >= 2)
				console.log('Executando: Watchdog');
			//This device didn't get good data in time, so give up on it. Clean up and then move on.
			//If we get good data then we'll terminate this watchdog.
			clearInterval(poller);
			poller = null;
			device.set_receive_handler(null);
			device.close();
			device = null;
			found = false;
			connected = false;

			tryNextDevice();
		}, 5000);

	}

	//************************************************************* 
	// FUNÇÕES DO SISTEMA QUE MONITORAM OS DISPOSITIVOS SERIAIS CONECTADOS

	ext._deviceConnected = function (dev) {
		if (debugLevel >= 2)
			console.log('Executando: _deviceConnected');

		potentialDevices.push(dev);
		if (!device) {
			found = false;
			connected = false;

			tryNextDevice();
		}
	}

	ext._deviceRemoved = function (dev) {
		if (debugLevel >= 2)
			console.log('Executando: _deviceRemoved');

		if (device != dev)
			return;
		if (poller)
			poller = clearInterval(poller);
		if (comPoller)
			comPoller = clearInterval(comPoller);
		if (comWatchdog)
			comWatchdog = clearInterval(comWatchdog);
		device = null;
	}

	ext._shutdown = function () {
		if (debugLevel >= 2)
			console.log('Executando: _shutdown');

		if (device) {
			var sendFinish = "Mf";
			addStringToWrite(sendFinish);
			addStringToWrite(sendFinish);

			device.close();
		}
		if (poller)
			poller = clearInterval(poller);
		if (comPoller)
			comPoller = clearInterval(comPoller);
		if (comWatchdog)
			comWatchdog = clearInterval(comWatchdog);
		device = null;
	}

	ext.whenIMUEvent = function (imuEvent) {
		return imuEventData[IMU_EVENT_SHAKE];
	};

	ext._getStatus = function () {
		if (debugLevel >= 2) {
			console.log('Executando: _getStatus');
		}

		if (!device) {
			return {status: 1, msg: 'Sem dispositivo.'};
		}

		if (watchdog) {
			return {status: 1, msg: 'Procurando uma ALPHA Maker.'};
		}

		if (debugLevel >= 1) {
			console.log('Conectado com dispositivo na porta: ' + device.id);
			if (!connected) {
				
			}
		}

		return {status: 2, msg: 'ALPHA Maker conectada!'};
	};

	//************************************************************

	//Definicao do conjunto de Blocos
	var menus = {
		en: {
			ports: ['S1', 'S2', 'S3', 'S4'],
			sensors: ['Touch', 'Infrared', 'Line', 'Color', 'Light (Lux)', 'Sound (dB)', 'Temperature (°C)',
				'Electrical Resistance (Ohm)', 'Electrical Voltage (V)', 'Ultrasonic (cm)', 'Generic'],
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
				'Resistencia eléctrica (Ohm)', 'Voltaje(V)', 'Ultrasonido (cm)', 'Genérico'],
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
				'Resistência elétrica (Ohm)', 'Tensão elétrica(V)', 'Distância (cm)', 'Genérico'],
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

	String.prototype.replaceAt=function(index, replacement) {
		return this.substr(0, index) + replacement+ this.substr(index + replacement.length);
	}

	// Descricao do hardware

	ScratchExtensions.register('ALPHA Maker', descriptor, ext, {type: 'serial'});
})({});