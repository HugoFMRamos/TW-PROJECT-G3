const socket = io('http://localhost:3000');

// --- CANVAS SETUP ---
const canvas = document.getElementById('draw');
const ctx = canvas.getContext('2d');

let drawing = false;
let lastX = 0;
let lastY = 0;
let currentColor = '#000';
let brushSize = 3;
let erasing = false;

// --- CHAT SETUP ---
const messageContainer = document.getElementById('message-container');
const messageForm = document.getElementById('send-container');
const messageInput = document.getElementById('message-input');

const name = prompt('What is your name?');
appendMessage('You joined');
socket.emit('new-user', roomName, name);

// --- CHAT EVENTS ---
socket.on('chat-message', data => appendMessage(`${data.name}: ${data.message}`));
socket.on('user-connected', name => appendMessage(`${name} connected`));
socket.on('user-disconnected', name => appendMessage(`${name} disconnected`));

messageForm.addEventListener('submit', e => {
  e.preventDefault();
  const message = messageInput.value;
  appendMessage(`You: ${message}`);
  socket.emit('send-chat-message', message);
  checkMessage(message);
  messageInput.value = '';
});

function appendMessage(message) {
  const messageElement = document.createElement('div');
  messageElement.classList.add("message");
  messageElement.innerText = message;
  messageContainer.append(messageElement);
}

// --- DRAWING EVENTS ---
function startDrawing(e) {
  drawing = true;
  [lastX, lastY] = [e.offsetX, e.offsetY];
}

function stopDrawing() { drawing = false; }

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

// --- COLOR AND BRUSH CONTROLS ---
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => { currentColor = btn.dataset.color; erasing = false; });
});

document.getElementById('brush-size').addEventListener('input', e => brushSize = e.target.value);
document.getElementById('eraser').addEventListener('click', () => erasing = true);

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

const wordCont = document.getElementById("wordCont");
const words = ["monkey", "elephant", "zebra", "lion", "dolphin"];
let currentWord = words[Math.floor(Math.random() * words.length)];
wordCont.innerHTML = currentWord;

function checkMessage(msg) {
  if (msg == currentWord) {
    appendMessage("You got it!")
  }
};