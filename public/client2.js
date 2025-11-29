const socket = io('http://localhost:3000')
const messageContainer = document.getElementById('message-container')
const messageForm = document.getElementById('send-container')
const messageInput = document.getElementById('message-input')

let x0 = 0
let y0 = 0
let x1 = 0
let y1 = 0
let currentColor = '#000000'
let brushSize = 0
let erasing = false

const name = prompt('What is your name?')
appendMessage('You joined')
socket.emit('new-user', roomName, name) // send room too

socket.on('chat-message', data => {
  appendMessage(`${data.name}: ${data.message}`)
})

// When drawing:
socket.emit('drawing', roomName, {
  x0, y0, x1, y1,
  color: currentColor,
  size: brushSize,
  erasing
});

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

socket.on('user-connected', name => {
  appendMessage(`${name} connected`)
})

socket.on('user-disconnected', name => {
  appendMessage(`${name} disconnected`)
})

messageForm.addEventListener('submit', e => {
  e.preventDefault()
  const message = messageInput.value
  appendMessage(`You: ${message}`)
  socket.emit('send-chat-message', message)
  messageInput.value = ''
})

function appendMessage(message) {
  const messageElement = document.createElement('div')
  messageElement.innerText = message
  messageContainer.append(messageElement)
}