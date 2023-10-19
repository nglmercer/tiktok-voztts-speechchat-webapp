// Este código utilizará el backend de demostración si abres index.html localmente a través de file://, de lo contrario se utilizará tu servidor
let backendUrl = location.protocol === 'file:' ? "https://tiktok-chat-reader.zerody.one/" : undefined;
let connection = new TikTokIOConnection(backendUrl);
const chatContainer = document.getElementById('chatContainer');
const playButton = document.getElementById('playButton');
// Contador
let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;
let previousLikeCount = 0;

// Estas configuraciones están definidas por obs.html
if (!window.settings) window.settings = {};

$(document).ready(() => {
    $('#connectButton').click(connect);
    $('#uniqueIdInput').on('keyup', function (e) {
        if (e.key === 'Enter') {
            connect();
        }
    });

    if (window.settings.username) connect();
})

function connect() {
    let uniqueId = window.settings.username || $('#uniqueIdInput').val();
    if (uniqueId !== '') {

        $('#stateText').text('Conectando...');

        connection.connect(uniqueId, {
            enableExtendedGiftInfo: true
        }).then(state => {
            $('#stateText').text(`Conectado a la sala ${state.roomId}`);

            // resetear estadísticas
            viewerCount = 0;
            likeCount = 0;
            diamondsCount = 0;
            updateRoomStats();

        }).catch(errorMessage => {
            $('#stateText').text(errorMessage);

            // programar próximo intento si se establece el nombre de usuario obs
            if (window.settings.username) {
                setTimeout(() => {
                    connect(window.settings.username);
                }, 30000);
            }
        })

    } else {
        alert('no se ingresó nombre de usuario');
    }
}

// Prevenir Cross site scripting (XSS)
function sanitize(text) {
    return text.replace(/</g, '&lt;')
}

function updateRoomStats() {
    $('#roomStats').html(`Espectadores: <b>${viewerCount.toLocaleString()}</b> Likes: <b>${likeCount.toLocaleString()}</b> Diamantes: <b>${diamondsCount.toLocaleString()}</b>`)
}

function generateUsernameLink(data) {
    return `<a class="usernamelink" href="https://www.tiktok.com/@${data.uniqueId}" target="_blank">${data.uniqueId}</a>`;
}

function isPendingStreak(data) {
    return data.giftType === 1 && !data.repeatEnd;
}

/**
 * Agregar un nuevo mensaje al contenedor de chat
 */
function addChatItem(color, data, text, summarize) {
    let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.chatcontainer');

    if (container.find('div').length > 500) {
        container.find('div').slice(0, 200).remove();
    }

    container.find('.temporary').remove();;

    container.append(`
        <div class=${summarize ? 'temporary' : 'static'}>
            <img class="miniprofilepicture" src="${data.profilePictureUrl}">
            <span>
                <b>${generateUsernameLink(data)}:</b> 
                <span style="color:${color}">${sanitize(text)}</span>
            </span>
        </div>
    `);

    container.stop();
    container.animate({
        scrollTop: container[0].scrollHeight
    }, 400);
    hablarMensaje(text);
    cacheMessage(text);
}

/**
 * Agregar un nuevo regalo al contenedor de regalos
 */
function addGiftItem(data) {
    let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.giftcontainer');

    if (container.find('div').length > 200) {
        container.find('div').slice(0, 100).remove();
    }

    let streakId = data.userId.toString() + '_' + data.giftId;

    let html = `
        <div data-streakid=${isPendingStreak(data) ? streakId : ''}>
            <img class="miniprofilepicture" src="${data.profilePictureUrl}">
            <span>
                <b>${generateUsernameLink(data)}:</b> <span>${data.describe}</span><br>
                <div>
                    <table>
                        <tr>
                            <td><img class="gifticon" src="${data.giftPictureUrl}"></td>
                            <td>
                                <span>Nombre: <b>${data.giftName}</b> (ID:${data.giftId})<span><br>
                                <span>Repetir: <b style="${isPendingStreak(data) ? 'color:red' : ''}">x${data.repeatCount.toLocaleString()}</b><span><br>
                                <span>Costo: <b>${(data.diamondCount * data.repeatCount).toLocaleString()} Diamantes</b><span>
                            </td>
                        </tr>
                    </tabl>
                </div>
            </span>
        </div>
    `;

    let existingStreakItem = container.find(`[data-streakid='${streakId}']`);

    if (existingStreakItem.length) {
        existingStreakItem.replaceWith(html);
    } else {
        container.append(html);
    }
    
    container.stop();
    container.animate({
        scrollTop: container[0].scrollHeight
    }, 800);
}

// Cambiar la posición de los contenedores en función de la relación de aspecto
$(window).on('resize', function() {
  let aspectRatio = $(window).width() / $(window).height();
  if (aspectRatio <= 1) {
      $('.splitchattable').css('flex-direction', 'column');
      $('.chatcontainer, .giftcontainer').css('float', 'left');
      $('.chatcontainer, .giftcontainer').css('width', '100%');
      $('#roomStats').css('text-align', 'left');
      $('.chatcontainer').css('padding-right', '0px');
      $('.giftcontainer').css('padding-left', '0px');
  } else {
      $('.splitchattable').css('flex-direction', 'row');
      $('.chatcontainer, .giftcontainer').css('float', 'none');
      $('.chatcontainer, .giftcontainer').css('width', 'auto');
      $('#roomStats').css('text-align', 'center');
      $('.chatcontainer').css('padding-right', '10px');
      $('.giftcontainer').css('padding-left', '10px');
  }
}).resize();

// estadísticas de espectadores
connection.on('roomUser', (msg) => {
    if (typeof msg.viewerCount === 'number') {
        viewerCount = msg.viewerCount;
        updateRoomStats();
    }
})

// estadísticas de likes
connection.on('like', (msg) => {
  if (typeof msg.totalLikeCount === 'number') {
    likeCount = msg.totalLikeCount;
    updateRoomStats();

    }
})

// Miembro se une
let joinMsgDelay = 0;
connection.on('member', (msg) => {
    if (window.settings.showJoins === "0") return;

    let addDelay = 250;
    if (joinMsgDelay > 500) addDelay = 100;
    if (joinMsgDelay > 1000) addDelay = 0;

    joinMsgDelay += addDelay;

    setTimeout(() => {
        joinMsgDelay -= addDelay;
        addChatItem('#21b2c2', msg, 'welcome', true);
    }, joinMsgDelay);
})

// Nuevo comentario de chat recibido
connection.on('chat', (msg) => {
    if (window.settings.showChats === "0") return;

    addChatItem('', msg, msg.comment);
})

// Nuevo regalo recibido
connection.on('gift', (data) => {
    if (!isPendingStreak(data) && data.diamondCount > 0) {
        diamondsCount += (data.diamondCount * data.repeatCount);
        updateRoomStats();
    }

    if (window.settings.showGifts === "0") return;

    addGiftItem(data);
})

// compartir, seguir
connection.on('social', (data) => {
    if (window.settings.showFollows === "0") return;

    let color = data.displayType.includes('follow') ? '#ff005e' : '#2fb816';
    addChatItem(color, data, data.label.replace('{0:user}', ''));
})

connection.on('streamEnd', () => {
    $('#stateText').text('Transmisión terminada.');

    // programar próximo intento si se establece el nombre de usuario obs
    if (window.settings.username) {
        setTimeout(() => {
            connect(window.settings.username);
        }, 30000);
    }
})
const palabrasSpam = ['join', 'joined', 'shared', 'LIVE', 'welcome'];
const soundQueue = []; // Lista para almacenar los sonidos pendientes
let isReading = false; // Variable para controlar si se está leyendo un mensaje o no
let cache = []; // Lista en caché para almacenar los mensajes

function cacheMessage(text) {
  cache.push(text);
  if (cache.length > 15) {
    cache.shift();
  }
} 

function filtros(text) {
  if (cache.includes(text)) {
    return false;
  }
  if (palabrasSpam.some(text => text.includes(palabrasSpam))) {
    return false;
  }
  cache.push(text);
  if (cache.length > 15) {
    cache.shift();
  }
  return true;
}

let lastSoundTime = 0;
let lastDataTime = 0;

function leerMensajes() {
  if (cache.length > 0 && !isReading) {
    const text = cache.shift();
    hablarMensaje(text);
  }
}

let ultimoMensaje = ""; // Variable para almacenar el último mensaje leído

function hablarMensaje(text) {
  const voiceSelect = document.querySelector("select");
  const selectedVoice = voiceSelect.value;
  const palabrasIgnorar = ["rose", "Heart", "GG", "@", "followed", "shared", "welcome"];

  if (palabrasIgnorar.some(palabra => palabra.includes(text))) {
    return;
  }
  if (text <= 3 || text > 300) {
    return;
  }
  if (text === ultimoMensaje) { // Si el mensaje a leer es igual al último leído, no lo lea
    return;
  }
  if (text) {
    const messageLength = text.split(' ').length;
    if (filtros(text)) {
      const currentTime = Date.now();
      const delay = messageLength > 5 ? 1000 : 2000;
      let rate = 1.0;
      if (messageLength > 20) {
        const extraRate = Math.floor((messageLength - 20) / 20) * 0.1;
        rate = Math.min(1.5, rate + extraRate);
      }
      if (responsiveVoice.isPlaying()) {
        setTimeout(hablarMensaje, 100);
        return;
      }
      try {
        if (currentTime - lastSoundTime > delay && currentTime - lastDataTime > delay) {
          lastSoundTime = currentTime;
          ultimoMensaje = text; // Almacenar el último mensaje leído
          responsiveVoice.speak(text, selectedVoice, {
            rate: rate,
            onend: function() {
              setTimeout(() => {
                leerMensajes();
              }, 100);
            }
          });
        } else {
          setTimeout(() => {
            hablarMensaje(text);
          }, 100);
        }
      } catch (error) {
        console.error('Error al hablar mensaje:', error);
      }
    }
  }
}
setInterval(leerMensajes, 100); // Añadir intervalo para leer mensajes cada segundo
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden') {
    responsiveVoice.cancel();
  } else {
    leerMensajes();
  }
});