const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

// Objeto para almacenar las conexiones de los usuarios
let clients = {};

wss.on('connection', (ws) => {
    console.log('Nuevo cliente conectado.');

    let userId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // Registro del usuario
            if (data.tipo === 'registrar') {
                userId = data.usuarioID;

                // Evitar sobreescribir conexiones existentes
                if (clients[userId]) {
                    ws.send(JSON.stringify({
                        tipo: 'error',
                        mensaje: `El usuario ${userId} ya está registrado en otra sesión.`,
                    }));
                    return;
                }

                clients[userId] = { socket: ws, emparejado: false };
                console.log(`Usuario ${userId} registrado.`);

                ws.send(JSON.stringify({
                    tipo: 'registro',
                    mensaje: `Usuario ${userId} registrado correctamente.`,
                }));
            }

            // Solicitar emparejamiento
            else if (data.tipo === 'emparejar') {
                const targetId = data.targetID;

                if (clients[targetId] && !clients[targetId].emparejado) {
                    // Notificar al usuario objetivo
                    clients[targetId].socket.send(JSON.stringify({
                        tipo: 'solicitud_emparejamiento',
                        usuarioID: userId,
                        mensaje: `El usuario ${userId} quiere emparejarse contigo.`,
                    }));

                    // Notificar al solicitante
                    ws.send(JSON.stringify({
                        tipo: 'estado',
                        mensaje: `Solicitud enviada. Esperando respuesta de ${targetId}.`,
                    }));

                    console.log(`Usuario ${userId} solicitó emparejamiento con ${targetId}.`);
                } else {
                    ws.send(JSON.stringify({
                        tipo: 'estado',
                        mensaje: `El usuario ${targetId} no está disponible para emparejar.`,
                    }));
                    console.log(`Emparejamiento fallido: Usuario ${targetId} no disponible.`);
                }
            }

            // Responder a emparejamiento
            else if (data.tipo === 'respuesta_emparejamiento') {
                const targetId = data.targetID;
                const aceptar = data.aceptar;

                if (clients[userId] && clients[targetId]) {
                    const userSocket = clients[userId].socket;
                    const targetSocket = clients[targetId].socket;

                    if (aceptar) {
                        clients[userId].emparejado = true;
                        clients[targetId].emparejado = true;

                        userSocket.send(JSON.stringify({
                            tipo: 'emparejamiento',
                            mensaje: `Emparejado con ${targetId}.`,
                        }));

                        targetSocket.send(JSON.stringify({
                            tipo: 'emparejamiento',
                            mensaje: `Emparejado con ${userId}.`,
                        }));

                        console.log(`Emparejamiento exitoso: ${userId} con ${targetId}.`);
                    } else {
                        userSocket.send(JSON.stringify({
                            tipo: 'estado',
                            mensaje: `El usuario ${targetId} rechazó el emparejamiento.`,
                        }));

                        targetSocket.send(JSON.stringify({
                            tipo: 'estado',
                            mensaje: `Rechazaste la solicitud de emparejamiento de ${userId}.`,
                        }));

                        console.log(`Emparejamiento rechazado: ${targetId} rechazó a ${userId}.`);
                    }
                } else {
                    console.log(`Error: Uno de los usuarios no está disponible para responder.`);
                }
            }

            /*
            Autor : Diego Monroy
            Fecha : 04/12/2024
            Descripcion : Manejo de traducción entre usuarios emparejados
            */

            else if (data.tipo === 'traduccion') {
                const pairId = data.pairID;
                const translatedText = data.textoTraducido;

                if (clients[userId] && clients[pairId]) {
                    const userSocket = clients[userId].socket;
                    const pairSocket = clients[pairId].socket;

                    // Enviar la traducción al usuario emparejado
                    pairSocket.send(JSON.stringify({
                        tipo: 'traduccion',
                        usuarioID: userId,
                        textoTraducido: translatedText
                    }));

                    // También enviar la traducción de vuelta al usuario original (si es necesario)
                    userSocket.send(JSON.stringify({
                        tipo: 'traduccion',
                        usuarioID: pairId,
                        textoTraducido: translatedText
                    }));

                    console.log(`Traducción enviada de ${userId} a ${pairId}: ${translatedText}`);
                } else {
                    console.log(`Error: Uno de los usuarios no está disponible para recibir la traducción.`);
                }
            }

            // Agregar manejo para el tipo 'registro' que podría haber estado causando problemas
            else if (data.tipo === 'registro') {
                console.warn("Recibido tipo de mensaje desconocido: 'registro'. Asegúrate de que este tipo se use correctamente.");
            }
            
            // Manejo de mensajes desconocidos
            else {
                ws.send(JSON.stringify({
                    tipo: 'error',
                    mensaje: 'Tipo de mensaje desconocido recibido.',
                }));
                console.error('Mensaje desconocido:', data);
            }
        } catch (error) {
            console.error('Error procesando mensaje:', error);

            ws.send(JSON.stringify({
                tipo: 'error',
                mensaje: 'Hubo un error al procesar tu solicitud. Por favor intenta nuevamente.',
            }));
        }
    });

    ws.on('close', () => {
        if (userId && clients[userId]) {
            delete clients[userId];
            console.log(`Usuario ${userId} desconectado.`);
        }
    });
});
