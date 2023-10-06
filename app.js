// This will use the demo backend if you open index.html locally via file://, otherwise your server will be used
let backendUrl = location.protocol === 'file:' ? "https://tiktok-chat-reader.zerody.one/" : undefined;
let connection = new TikTokIOConnection(backendUrl);
const chatContainer = document.getElementById('chatContainer');
const playButton = document.getElementById('playButton');
// Counter
let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;
let previousLikeCount = 0;

// These settings are defined by obs.html
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

        $('#stateText').text('Connecting...');

        connection.connect(uniqueId, {
            enableExtendedGiftInfo: true
        }).then(state => {
            $('#stateText').text(`Connected to roomId ${state.roomId}`);

            // reset stats
            viewerCount = 0;
            likeCount = 0;
            diamondsCount = 0;
            updateRoomStats();

        }).catch(errorMessage => {
            $('#stateText').text(errorMessage);

            // schedule next try if obs username set
            if (window.settings.username) {
                setTimeout(() => {
                    connect(window.settings.username);
                }, 30000);
            }
        })

    } else {
        alert('no username entered');
    }
}

// Prevent Cross site scripting (XSS)
function sanitize(text) {
    return text.replace(/</g, '&lt;')
}

function updateRoomStats() {
    $('#roomStats').html(`Viewers: <b>${viewerCount.toLocaleString()}</b> Likes: <b>${likeCount.toLocaleString()}</b> Earned Diamonds: <b>${diamondsCount.toLocaleString()}</b>`)
}

function generateUsernameLink(data) {
    return `<a class="usernamelink" href="https://www.tiktok.com/@${data.uniqueId}" target="_blank">${data.uniqueId}</a>`;
}

function isPendingStreak(data) {
    return data.giftType === 1 && !data.repeatEnd;
}

/**
 * Add a new message to the chat container
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
 * Add a new gift to the gift container
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
                                <span>Name: <b>${data.giftName}</b> (ID:${data.giftId})<span><br>
                                <span>Repeat: <b style="${isPendingStreak(data) ? 'color:red' : ''}">x${data.repeatCount.toLocaleString()}</b><span><br>
                                <span>Cost: <b>${(data.diamondCount * data.repeatCount).toLocaleString()} Diamonds</b><span>
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

    soundAlert(data);
    
    container.stop();
    container.animate({
        scrollTop: container[0].scrollHeight
    }, 800);
}


// viewer stats
connection.on('roomUser', (msg) => {
    if (typeof msg.viewerCount === 'number') {
        viewerCount = msg.viewerCount;
        updateRoomStats();
    }
})

// like stats
connection.on('like', (msg) => {
  if (typeof msg.totalLikeCount === 'number') {
    likeCount = msg.totalLikeCount;
    updateRoomStats();

    }
})

// Member join
let joinMsgDelay = 0;
connection.on('member', (msg) => {
    if (window.settings.showJoins === "0") return;

    let addDelay = 250;
    if (joinMsgDelay > 500) addDelay = 100;
    if (joinMsgDelay > 1000) addDelay = 0;

    joinMsgDelay += addDelay;

    setTimeout(() => {
        joinMsgDelay -= addDelay;
        addChatItem('#21b2c2', msg, 'join', true);
    }, joinMsgDelay);
})

// New chat comment received
connection.on('chat', (msg) => {
    if (window.settings.showChats === "0") return;

    addChatItem('', msg, msg.comment);
})

// New gift received
connection.on('gift', (data) => {
    if (!isPendingStreak(data) && data.diamondCount > 0) {
        diamondsCount += (data.diamondCount * data.repeatCount);
        updateRoomStats();
    }

    if (window.settings.showGifts === "0") return;

    addGiftItem(data);
})

// share, follow
connection.on('social', (data) => {
    if (window.settings.showFollows === "0") return;

    let color = data.displayType.includes('follow') ? '#ff005e' : '#2fb816';
    addChatItem(color, data, data.label.replace('{0:user}', ''));
})

connection.on('streamEnd', () => {
    $('#stateText').text('Stream ended.');

    // schedule next try if obs username set
    if (window.settings.username) {
        setTimeout(() => {
            connect(window.settings.username);
        }, 30000);
    }
})
const palabrasSpam = ['join', 'joined', 'shared', 'LIVE'];

const soundQueue = []; // Lista para almacenar los sonidos pendientes
let isPlaying = false; // Variable para controlar si se está reproduciendo un sonido o no

let cache = []; // Lista en caché para almacenar los mensajes

function soundAlert(data) {
    console.log(data.giftName); // Imprimir en la consola
    const soundFiles = {
      Rose: 'sounds/kururin.mp3',
      Doughnut: 'sounds/elded.mp3',
      Money: 'sounds/elded.mp3',
      Watermelon: 'sounds/donation.mp3',
      Hat: 'sounds/gigachad.mp3',
      Finger: 'sounds/Gatobeso.mp3',
      DJ: 'sounds/Gatobeso.mp3',
      Confetti: 'sounds/Gatobeso.mp3',
      Paper: 'sounds/kururin.mp3',
      Hello: 'sounds/kururin.mp3',
      Birthday: 'sounds/kururin.mp3',
    // Agrega más palabras y nombres de archivos de sonido según tus necesidades
  };
  const soundFile = soundFiles[data.giftName];
  if (soundFile && !isPlaying) {
    const audio = new Audio(soundFile);
    audio.isPlaying = true; // Marcar el audio como en reproducción
    isPlaying = true; // Marcar que se está reproduciendo un sonido
    audio.addEventListener('ended', function() {
      audio.isPlaying = false; // Marcar el audio como no en reproducción al finalizar
      isPlaying = false; // Marcar que no se está reproduciendo un sonido
      playNextSound(); // Reproducir el siguiente sonido en la lista
    });
    soundQueue.push(audio); // Agregar el audio a la lista de sonidos pendientes
    if (soundQueue.length === 1) { // Si es el primer sonido en la lista, reproducirlo inmediatamente
      audio.play();
    }
  }
}

function playNextSound() {
  if (soundQueue.length > 0 && !isPlaying) {
    soundQueue.shift(); // Eliminar el primer sonido de la lista
    if (soundQueue.length > 0) {
      soundQueue[0].play(); // Reproducir el siguiente sonido en la lista
    }
  }
}
function playNextSound() {
    if (soundQueue.length > 0) {
      soundQueue.shift(); // Eliminar el primer sonido de la lista
      if (soundQueue.length > 0) {
        soundQueue[0].play(); // Reproducir el siguiente sonido en la lista
      }
    }
  }
  function cacheMessage(text) {
      cache.push(text);
      console.log('Mensaje guardado en la caché:', text); // Imprimir el mensaje en la consola
      if (cache.length > 100) {
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
    // Filtrar emojis y repetición de emojis
    cache.push(text);
    if (cache.length > 100) {
      cache.shift();
    }
    return true;
  }
  
  let lastSoundTime = 0;
  let lastDataTime = 0;
  
  function hablarMensaje(text) {
    const voiceSelect = document.querySelector("select");
    const selectedVoice = voiceSelect.value;
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
          console.log("reproduciendo texto....");
          setTimeout(hablarMensaje, 100); // Esperar 1 segundo y verificar nuevamente
          return;
        }
        try {
          if (currentTime - lastSoundTime > delay && currentTime - lastDataTime > delay) {
            lastSoundTime = currentTime;
            responsiveVoice.speak(text, selectedVoice, {rate: rate, onend: function() {
              console.log('Mensaje leído:', text); // Imprimir el mensaje en la consola después de leerlo
            }});
          } else {
            setTimeout(() => {
              hablarMensaje(text);
            }, 100);
          }
        } catch (error) {
          console.error('Error al hablar mensaje:', error);
        }
      }
    } else {
      console.error('Error: no se proporcionó texto para hablar');
    }
  }
