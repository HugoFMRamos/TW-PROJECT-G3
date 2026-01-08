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
    if (!rooms[room]) return
    socket.join(room);
    const users = Object.values(rooms[room].users);
    if (users.includes(name)) {
      callback({ error: 'Name already in use' });
      return;
    }
    rooms[room].users[socket.id] = name;
    console.log(Object.values(rooms[room].users));
    callback({ success: true });

    // Notify others in the room
    socket.to(room).emit('user-connected', name)

    // Assigns first artist
    if (!rooms[room].artist) rooms[room].artist = socket.id
    Object.keys(rooms[room].users).forEach(id => {
      io.to(id).emit('artist-swap', id === rooms[room].artist)
    })

    // Displays the current word to the artist
    socket.emit('current-word', rooms[room].currentWord)

    // Send existing drawing history to new user
    if (rooms[room].history.length > 0) {
      socket.emit('drawing-history', rooms[room].history)
    }
  })

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
        name: rooms[room].users[socket.id]
      })
    })
  })

  // User disconnects
  socket.on('disconnect', () => {
    const userRooms = getUserRooms(socket)
    userRooms.forEach(room => {
      const roomData = rooms[room]
      const name = roomData.users[socket.id]
      if (name) {
        if (roomData.artist === socket.id) swapArtist(room)
        socket.to(room).emit('user-disconnected', name)
        delete roomData.users[socket.id]
        if (roomData.users.length == 0) delete rooms[room]
      }

      // Logs all users in the room when a user disconnects
      console.log(Object.values(roomData.users))
    })
  })

  // User guesses word correctly
  socket.on('correct-guess', (name) => {
    const userRooms = getUserRooms(socket)
    userRooms.forEach(room => {
      const newWord = words[Math.floor(Math.random() * words.length)]
      rooms[room].currentWord = newWord
      io.to(room).emit('correct-message', name)
      io.to(room).emit('current-word', newWord)
      swapArtist(room)
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