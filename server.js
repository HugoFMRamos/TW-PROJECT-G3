const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)

app.set('views', './views')
app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))

// Store rooms: { roomName: { users: {socketId: name}, history: [] } }
const rooms = {}
const words = ['monkey', 'elephant', 'zebra', 'lion', 'dolphin']
const MAX_PLAYERS_PER_ROOM = 4;

app.get('/', (req, res) => {
  res.render('index', { rooms: rooms })
})

app.post('/room', (req, res) => {
  const room = req.body.room
  if (rooms[room] != null) {
    return res.redirect('/')
  }
  rooms[room] = { 
    users: {}, 
    history: [], 
    currentWord: words[Math.floor(Math.random() * words.length)],
    timer: null,
    timeLeft: 60,
    artist: null }
  res.redirect(room)
  io.emit('room-created', room)
})

app.get('/:room', (req, res) => {
  if (rooms[req.params.room] == null) {
    return res.redirect('/')
  }
  res.render('room', { roomName: req.params.room })
})

server.listen(3000, () => console.log('Server running on port 3000'))

// --- SOCKET.IO ---
io.on('connection', socket => {
  // New user joins a room
  socket.on('new-user', (room, name, callback) => {
    const roomData = rooms[room];
    if (!rooms[room]) return

    // Game already started
    if (roomData.started) {
      callback({ error: 'Game already started' });
      return;
    }

    const users = Object.values(rooms[room].users);

    // Room full
    if(users.length >= MAX_PLAYERS_PER_ROOM) {
      callback({ error: 'Room is full (2 players max)'})
    }

    // Duplicate name
    if (users.includes(name)) {
      callback({ error: 'Name already in use' });
      return;
    }

    // Join the room
    socket.join(room);
    rooms[room].users[socket.id] = { name: name, score: 0 };

    // Broadcast the updated user list to everyone in the room
    io.in(room).emit('update-scoreboard', Object.values(rooms[room].users));

    // Assign host if none
    if (!roomData.host) roomData.host = socket.id;

    console.log(Object.values(rooms[room].users));
    callback({ success: true, isHost: socket.id === roomData.host});

    // Notify others in the room
    socket.to(room).emit('user-connected', name)

    // Send current state
    socket.emit('current-word', roomData.currentWord);
    if (roomData.history.length > 0) {
      socket.emit('drawing-history', roomData.history);
    }

    // Update all users about room start status
    io.to(room).emit('room-status', {
      players: Object.keys(roomData.users).length,
      started: roomData.started,
      maxPlayers: MAX_PLAYERS_PER_ROOM
    });
  })

    // Host starts the game
  socket.on('start-game', (room) => {
    const roomData = rooms[room];
    if (!roomData) return;

    // Only host can start
    if (socket.id !== roomData.host) return;

    // Minimum 2 players to start
    if (Object.keys(roomData.users).length < 2) {
      socket.emit('not-enough-players');
      return;
    }

    roomData.started = true;
    io.to(room).emit('game-started');

    // Assign first artist if none
    if (!roomData.artist) roomData.artist = Object.keys(roomData.users)[0];

    Object.keys(roomData.users).forEach(id => {
      io.to(id).emit('artist-swap', id === roomData.artist);
    });

    // Send first word to artist
    io.to(roomData.artist).emit('current-word', roomData.currentWord);

    // Start timer
    startRoomTimer(room);
  });

  // Drawing event
  socket.on('drawing', (room, data) => {
    if (!rooms[room]) return

    // Save drawing to room history
    rooms[room].history.push(data)

    // Broadcast to others in the room
    socket.to(room).emit('drawing', data)
  })

  // Chat message
  socket.on('send-chat-message', (message) => {
    const userRooms = getUserRooms(socket)
    userRooms.forEach(room => {
      socket.to(room).emit('chat-message', {
        message,
        name: rooms[room].users[socket.id].name
      })
    })
  })

  // User disconnects
  socket.on('disconnect', () => {
    const userRooms = getUserRooms(socket)

    userRooms.forEach(room => {
      const roomData = rooms[room]
      if (!roomData) return

      const name = roomData.users[socket.id]

      if (name) {
        // Remove user from room
        delete roomData.users[socket.id]

        // Notify others
        socket.to(room).emit('user-disconnected', name)

        // Swap artist if needed
        if (roomData.artist === socket.id) swapArtist(room)

        // Assign a new host if the leaving user was the host
        if (roomData.host === socket.id) {
          const remainingUsers = Object.keys(roomData.users)
          if (remainingUsers.length > 0) {
            roomData.host = remainingUsers[0] // pick the first remaining user
            io.to(room).emit('new-host', roomData.users[roomData.host])
          } else {
            roomData.host = null
          }
        }

        // Delete room if empty
        if (Object.keys(roomData.users).length === 0) {
          delete rooms[room]
          console.log(`Room "${room}" deleted`)
        }
      }

      console.log(`Room ${room} users:`, Object.values(roomData?.users || {}))
    })
  })


  // User guesses word correctly
  socket.on('correct-guess', (name) => {
    const userRooms = getUserRooms(socket)
    userRooms.forEach(room => {
      const roomData = rooms[room];
      if (!roomData) return;

      // Update scores
      if (roomData.users[socket.id]) {
        roomData.users[socket.id].score += roomData.timeLeft;
      }
      io.to(room).emit('correct-message', name, roomData.currentWord)
      io.in(room).emit('update-scoreboard', Object.values(roomData.users));

      // Change word and artist
      const newWord = words[Math.floor(Math.random() * words.length)]
      roomData.currentWord = newWord
      io.to(room).emit('current-word', newWord)
      swapArtist(room)
      startRoomTimer(room)
    })
  })
})

// --- Helper functions ---
function getUserRooms(socket) {
  return Object.entries(rooms).reduce((userRooms, [name, room]) => {
    if (room.users[socket.id] != null) userRooms.push(name)
    return userRooms
  }, [])
}

function swapArtist(room) {
  const roomData = rooms[room]
  if (!roomData) return

  const userIds = Object.keys(roomData.users)

  const currentIndex = userIds.indexOf(roomData.artist)
  const nextArtist = roomData.artist = userIds[(currentIndex + 1) % userIds.length]

  userIds.forEach(id => {
    io.to(id).emit('artist-swap', id === nextArtist)
  })
  console.log('artist:', roomData.users[nextArtist])
}

function startRoomTimer(room) {
  const roomData = rooms[room];
  if (!roomData) return;

  // Clear previous timer if exists
  if (roomData.timer) clearInterval(roomData.timer);
  roomData.timeLeft = 60;

  io.to(room).emit('timer-update', roomData.timeLeft);

  roomData.timer = setInterval(() => {
    roomData.timeLeft -= 1;
    io.to(room).emit('timer-update', roomData.timeLeft);

    if (roomData.timeLeft <= 0) {
      clearInterval(roomData.timer);
      roomData.timer = null;

      // Time ran out → swap artist
      io.to(room).emit('no-guess', roomData.currentWord);
      swapArtist(room);

      // Pick a new word
      const newWord = words[Math.floor(Math.random() * words.length)];
      roomData.currentWord = newWord;
      io.to(room).emit('current-word', newWord);

      // Restart timer for next round
      startRoomTimer(room);
    }
  }, 1000);
}