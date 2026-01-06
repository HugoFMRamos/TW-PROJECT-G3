const socket = io('http://localhost:3000');

// --- CANVAS SETUP ---
const canvas = document.getElementById('draw');
const ctx = canvas.getContext('2d');
const eraser = document.getElementById('eraser');
const wordCont = document.getElementById("wordCont");
const artHeader = document.getElementById("artHeader");
const notartHeader = document.getElementById("notartHeader");
const controls = document.getElementById("controls");


let drawing = false;
let lastX = 0;
let lastY = 0;
let currentColor = '#000';
let brushSize = 3;
let erasing = false;
let canvasStates = [];
let currentWord = "";
let isArtist = false;
let canDraw = true;

// --- CHAT SETUP ---
const messageContainer = document.getElementById('message-container');
const messageForm = document.getElementById('send-container');
const messageInput = document.getElementById('message-input');

// Name function
function getName() {
  // Store's user's input name in tab
  let name = sessionStorage.getItem("userName");
  while (!name) {
    name = prompt('What is your name?');

    // Returns to previous page on cancel
    if (name === null) {
      history.back();
    }
  }
  sessionStorage.setItem("userName", name);
  return name;
}

const name = getName();
appendMessage('You joined', "status");
socket.emit('new-user', roomName, name);

// Asks user to confirm before leaving game page
window.addEventListener("beforeunload", (event) => {
  event.preventDefault();
});

// --- CHAT EVENTS ---
socket.on('chat-message', data => appendMessage(`${data.name}: ${data.message}`, "regular"));
socket.on('user-connected', name => appendMessage(`${name} connected`, "status"));
socket.on('user-disconnected', name => appendMessage(`${name} disconnected`, "status"));

messageForm.addEventListener('submit', e => {
  e.preventDefault();
  const message = messageInput.value;
  if (message == "") return;
  appendMessage(`You: ${message}`, "regular");
  socket.emit('send-chat-message', message);
  messageInput.value = '';
  checkMessage(message);
});

function appendMessage(message, type) {
  const messageElement = document.createElement('div');
  messageElement.classList.add("message");
  messageElement.classList.add(type);
  messageElement.innerText = message;
  messageContainer.append(messageElement);
}

// --- DRAWING EVENTS ---
function startDrawing(e) {
  if (!canDraw) return;
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
    eraser.classList.remove("tool-btn-active");
  });
});
document.getElementById('brush-size').addEventListener('input', e => brushSize = e.target.value);
eraser.addEventListener('click', () => {
  erasing = !erasing;
  if (erasing) {
    eraser.classList.add("tool-btn-active");
  } else {
    eraser.classList.remove("tool-btn-active");
  }
});
document.getElementById('undo').addEventListener('click', () => {
  if (canvasStates.length === 0) return;
  const prevCanvas = canvasStates.pop();
  ctx.putImageData(prevCanvas, 0, 0);
});
document.getElementById('clear').addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// --- CANVAS EVENTS ---
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mouseup', () => {
  stopDrawing();
  canvasStates.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
});
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
socket.on("current-word", (word) => {
  currentWord = word;
  wordCont.innerHTML = word;
});

// Check if user is the current artist
socket.on("you-are-artist", (artist) => {
  if (!artist) {
    controls.style.display = "none";
    artHeader.style.display = "none";
    notartHeader.style.display = "block";
    canDraw = false;
  } else {
    controls.style.display = "block";
    artHeader.style.display = "block";
    notartHeader.style.display = "none";
    canDraw = true;
  }
})

function checkMessage(msg) {
  if (msg == currentWord) {
    appendMessage("You got it! Next word...", "correct");
    socket.emit("word-guessed-correctly")
  }
};