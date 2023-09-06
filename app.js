// This will use the demo backend if you open index.html locally via file://, otherwise your server will be used
let backendUrl = location.protocol === 'file:' ? "https://tiktok-chat-reader.zerody.one/" : undefined;
let connection = new TikTokIOConnection(backendUrl);
const chatContainer = document.getElementById('chatContainer');
const playButton = document.getElementById('playButton');
// Counter
let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;

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
    readMessageInVoice(text);
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

    if (window.settings.showLikes === "0") return;

    if (typeof msg.likeCount === 'number') {

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
        addChatItem('#21b2c2', msg, 'joined', true);
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
let messageList = []; // Lista de mensajes
let isReading = false; // Flag to track if a message is currently being read
let messageCount = 0; // Counter to keep track of messages
let repeatedMessageCount = 0; // Counter to keep track of repeated messages
const forbiddenWords = ['joined','followed the LIVE creator', 'shared the live']; // Palabras que no se deben leer en voz alta

function changeVoice() {
  const voice = document.querySelector("select").value;
  const rate = document.querySelector("input[type=range]").value;
  const volume = 1;
  responsiveVoice.setDefaultVoice(voice);

  // Check if a message is currently being read
  if (!isReading) {
    readNextMessage(rate, volume);
  }
}

function readNextMessage(rate, volume) {
  if (messageList.length > 0) {
    isReading = true;
    const nextMessage = messageList.shift(); // Get and remove the next message from the queue
    responsiveVoice.speak(nextMessage, null, {
      rate: rate,
      volume: volume,
      onend: function() {
        isReading = false;
        readNextMessage(rate, volume); // Continue with the next message
      }
    });

    messageCount++;
    
    // Check if this is the 50th message
    if (messageCount % 50 === 0) {
      // If any of the last 50 messages were repeated, adjust the rate to 2
      if (repeatedMessageCount > 0) {
        const doubleSpeedRate = 2;
        changeVoice(doubleSpeedRate);
      } else {
        changeVoice(rate);
      }
      
      // Reset the repeated message count
      repeatedMessageCount = 0;
    } else {
      changeVoice(rate);
    }
  }
}

function readMessageInVoice(message, voice) {
  if (!message || message.length < 2) {
    // El mensaje es nulo o tiene menos de 2 caracteres, no se leerá en voz alta
    return;
  }

  const cleanMessage = cleanMessageWithForbiddenWords(message);

  if (cleanMessage.trim() === '') {
    // El mensaje no contiene caracteres legibles, no se leerá en voz alta
    return;
  }

  addMessage(cleanMessage); // Agregar el mensaje a la lista de mensajes
}

function cleanMessageWithForbiddenWords(message) {
  let cleanMessage = message;

  // Remover acentuación y símbolos, pero mantener otros caracteres de idiomas diferentes
  const specialCharsRegex = /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF]/g;
  const specialCharsCount = (cleanMessage.match(specialCharsRegex) || []).length;

  if (specialCharsCount > 10) {
    // Se repiten más de 10 veces los caracteres especiales, se elimina el mensaje
    cleanMessage = '';
  } else {
    // Remover palabras prohibidas
    for (const forbiddenWord of forbiddenWords) {
      cleanMessage = cleanMessage.replace(new RegExp(forbiddenWord, 'gi'), '');
    }

    // Remover caracteres especiales
    cleanMessage = cleanMessage.replace(specialCharsRegex, '');
  }

  return cleanMessage;
}

function addMessage(message) {
  messageList.push(message);
  // Check if the message is a repeat
  if (messageList.slice(-50, -1).includes(message)) {
    repeatedMessageCount++;
  }
  // Automatically start reading messages when added to the queue
  if (!isReading) {
    const rate = calculateSpeechRate(message);
    changeVoice(rate);
  }
}

function calculateSpeechRate(message) {
  // Calculate the desired duration based on the message length
  const messageLength = message.length;
  let desiredDuration = 4; // Default duration for shorter messages
  if (messageLength > 15) {
    desiredDuration = 12; // Adjusted duration for longer messages
  }

  // Calculate the speech rate to achieve the desired duration
  const rate = messageLength / desiredDuration;
  return rate;
}

window.onload = function() {
  const voices = responsiveVoice.getVoices();
  const select = document.querySelector("select");

  for (const voice of voices) {
    if (voice.lang === "es-ES") {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = voice.name;
      select.appendChild(option);
    }
  }
}
