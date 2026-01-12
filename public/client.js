const socket = io('http://localhost:3000');

// --- CANVAS SETUP ---
const canvas = document.getElementById('draw');
const ctx = canvas.getContext('2d');
const eraser = document.getElementById('eraser');
const wordCont = document.getElementById('wordCont');
const artHeader = document.getElementById('artHeader');
const notartHeader = document.getElementById('notartHeader');
const controls = document.getElementById('controls');
const disconnectBtn = document.getElementById('disconnect');
const startBtn = document.getElementById('start-game');
const timerDisplay = document.getElementById('timer');
const scoreCont = document.querySelector(".score-panel")
const roundDisplay = document.getElementById('round')

let drawing = false;
let lastX = 0;
let lastY = 0;
let currentColor = '#000';
let brushSize = 3;
let erasing = false;
let currentWord = '';
let isHost = false;
let isArtist = false;

// --- CHAT SETUP ---
const messageContainer = document.getElementById('message-container');
const messageForm = document.getElementById('send-container');
const messageInput = document.getElementById('message-input');

// Name function
function getName() {
  // Store's user's input name in tab
  let name = sessionStorage.getItem('userName');

  while (!name) {
    name = prompt('What is your name?');
    if (name === null) history.back();
  }
  
  socket.emit('new-user', roomName, name, (response) => {
    if (response.error) {
      alert(response.error);
      history.back();
    } else {
      sessionStorage.setItem('userName', name);
      appendMessage('You joined', 'status');
      isHost = response.isHost;

      if (isHost) {
        startBtn.style.display = 'none'; // initially hidden
        appendMessage('You are the host! You can start the game when 2+ players join.', 'status');
      }
      artHeader.style.display = 'none';
      notartHeader.style.display = 'none';
    }
  });

  return name;
}
const name = getName();

socket.on('new-host', (hostName) => {
  appendMessage(`${hostName} is now the host!`, 'status')
  
  // If the new host is this user, show start button
  if (sessionStorage.getItem('userName') === hostName) {
    isHost = true
    startBtn.style.display = Object.keys(roomData.users).length >= 2 ? 'block' : 'none'
  }
})

socket.on('timer-update', (time) => {
  if (timerDisplay) timerDisplay.innerText = `Time left: ${time}s`;
});

startBtn.addEventListener('click', () => {
  socket.emit('start-game', roomName);
});

socket.on('round-update', (data) => {
  if (roundDisplay) {
    roundDisplay.innerText = `Round: ${data.currentRound} / ${data.maxRounds}`;
  }
});

socket.on('game-started', (data) => {
  if (roundDisplay) {
    roundDisplay.innerText = `Round: ${data.currentRound} / ${data.maxRounds}`;
  }
});

socket.on('game-over', (data) => {
  const winnerNames = data.winners.map(w => w.name).join(', ');
  appendMessage(`🏆 Winner${data.winners.length > 1 ? 's' : ''}: ${winnerNames}\nScore: ${data.score}`, 'correct');
});

// Host feedback if not enough players
socket.on('not-enough-players', () => {
  appendMessage('At least 2 players are required to start the game.', 'status');
});

socket.on('game-started', () => {
  appendMessage('The game has started!', 'status');
  startBtn.style.display = 'none';
  artHeader.style.display = 'block';
  notartHeader.style.display = 'block';
});

// Update room status
socket.on('room-status', (status) => {
  // Show start button only to host
  if (isHost) {
    startBtn.style.display = status.players >= 2 ? 'block' : 'none';
  }
});

// Asks user to confirm before leaving game page
window.addEventListener('beforeunload', (event) => {
  event.preventDefault();
});

// --- CHAT EVENTS ---
socket.on('chat-message', data => appendMessage(`${data.name}: ${data.message}`, 'regular'));
socket.on('user-connected', (name) => {
  appendMessage(`${name} connected`, 'status');
  //userScore(name);
});
socket.on('user-disconnected', name => appendMessage(`${name} disconnected`, 'status'));
socket.on('correct-message', (name, word) => appendMessage(`${name} guessed <b>${word}</b> correctly! Next word...`, 'correct'));

messageForm.addEventListener('submit', e => {
  e.preventDefault();
  const message = messageInput.value;
  if (message == '') return;
  if (message == currentWord) {
    if (isArtist) {
      appendMessage(`Don't send the answer!`, 'status');
      messageInput.value = '';
      return;
    } else {
      appendMessage(`You: ${message}`, 'regular');
      socket.emit('send-chat-message', message);
      messageInput.value = '';
      socket.emit('correct-guess', name);
      return;
    }
  };
  appendMessage(`You: ${message}`, 'regular');
  socket.emit('send-chat-message', message);
  messageInput.value = '';
});

function appendMessage(message, type) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  messageElement.classList.add(type);
  messageElement.innerHTML = message;
  messageContainer.append(messageElement);
}

// --- DRAWING EVENTS ---
function startDrawing(e) {
  if (!isArtist) return;
  drawing = true;
  [lastX, lastY] = [e.offsetX, e.offsetY];
}

function stopDrawing() {
  drawing = false;
}

function draw(e) {
  if (!drawing) return;

  const x0 = lastX;
  const y0 = lastY;
  const x1 = e.offsetX;
  const y1 = e.offsetY;

  // draw locally
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = erasing ? '#ffffff' : currentColor;
  ctx.lineWidth = brushSize;
  ctx.lineCap = 'round';
  ctx.stroke();

  // emit to server
  socket.emit('drawing', roomName, { x0, y0, x1, y1, color: currentColor, size: brushSize, erasing });

  [lastX, lastY] = [x1, y1];
}

// --- CONTROLS EVENTS ---
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => { 
    currentColor = btn.dataset.color;
    erasing = false;
    eraser.classList.remove('tool-btn-active');
  });
});
document.getElementById('brush-size').addEventListener('input', e => brushSize = e.target.value);
eraser.addEventListener('click', () => {
  erasing = !erasing;
  if (erasing) {
    eraser.classList.add('tool-btn-active');
  } else {
    eraser.classList.remove('tool-btn-active');
  }
});
document.getElementById('clear').addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// --- DISCONNECT EVENT ---
disconnectBtn.addEventListener('click', () => {
  socket.disconnect()
  window.location.href = '/'
})

// --- CANVAS EVENTS ---
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);
canvas.addEventListener('mousemove', draw);

// --- SOCKET DRAWING HANDLERS ---
socket.on('drawing', (data) => {
  ctx.beginPath();
  ctx.moveTo(data.x0, data.y0);
  ctx.lineTo(data.x1, data.y1);
  ctx.strokeStyle = data.erasing ? '#ffffff' : data.color;
  ctx.lineWidth = data.size;
  ctx.lineCap = 'round';
  ctx.stroke();
});

// replay drawing history for new users
socket.on('drawing-history', (history) => {
  history.forEach(data => {
    ctx.beginPath();
    ctx.moveTo(data.x0, data.y0);
    ctx.lineTo(data.x1, data.y1);
    ctx.strokeStyle = data.erasing ? '#ffffff' : data.color;
    ctx.lineWidth = data.size;
    ctx.lineCap = 'round';
    ctx.stroke();
  });
});

// --- GAME LOGIC ---
socket.on('current-word', (word) => {
  currentWord = word;
  wordCont.innerHTML = word;
});

// Check if user is the current artist
socket.on('artist-swap', (value) => {
  isArtist = value;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (isArtist) {
    controls.style.display = 'block';
    artHeader.style.display = 'block';
    notartHeader.style.display = 'none';
  } else {
    controls.style.display = 'none';
    artHeader.style.display = 'none';
    notartHeader.style.display = 'block';
  }
})

// --- SCOREBOARD ---
socket.on('update-scoreboard', (users) => {
  scoreCont.innerHTML = '';
  users.forEach(user => {
    const userDiv = document.createElement('div');
    userDiv.classList.add('user-score');
    userDiv.innerText = `${user.name}: ${user.score}`;
    scoreCont.append(userDiv);
  });
});

socket.on('no-guess', (word) => appendMessage(`No one guessed correctly!... The word was: <b>${word}</b>. Next word...`, 'status'))