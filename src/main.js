const canvas = document.getElementById('draw');
const ctx = canvas.getContext('2d');

let drawing = false;
let lastX = 0;
let lastY = 0;
let currentColor = '#000';
let brushSize = 3;
let erasing = false;

function startDrawing(e) {
  drawing = true;
  [lastX, lastY] = [e.offsetX, e.offsetY];
}

function stopDrawing() {
  drawing = false;
}

function draw(e) {
  if (!drawing) return;

  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.strokeStyle = erasing ? '#ffffff' : currentColor;
  ctx.lineWidth = brushSize;
  ctx.lineCap = 'round';
  ctx.stroke();

  [lastX, lastY] = [e.offsetX, e.offsetY];
}

document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentColor = btn.dataset.color;
    erasing = false;
  });
});

document.getElementById('brush-size').addEventListener('input', e => {
  brushSize = e.target.value;
});

document.getElementById('eraser').addEventListener('click', () => {
  erasing = true;
});

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);
canvas.addEventListener('mousemove', draw);