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
const words = ["monkey", "elephant", "zebra", "lion", "dolphin"]

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
  socket.on('new-user', (room, name) => {
    if (!rooms[room]) return

    socket.join(room)
    rooms[room].users[socket.id] = name

    // Logs all users in the room when a new user joins
    console.log(Object.values(rooms[room].users))

    // Displays the current word to the user
    socket.emit('current-word', rooms[room].currentWord)

    // Defaults room's creator as artist
    if (!rooms[room].artist) {
      rooms[room].artist = socket.id
      socket.emit("you-are-artist", true)
    } else {
      socket.emit("you-are-artist", false)
    }

    // Notify others in the room
    socket.to(room).emit('user-connected', name)

    // Send existing drawing history to new user
    if (rooms[room].history.length > 0) {
      socket.emit('drawing-history', rooms[room].history)
    }
  })

  // Drawing event
  socket.on('drawing', (room, data) => {
    if (!rooms[room]) return

    // Prevents user from drawing if they are not the artist
    if (rooms[room].artist !== socket.id) return

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
      const name = rooms[room].users[socket.id]
      if (name) {
        socket.to(room).emit('user-disconnected', name)
        delete rooms[room].users[socket.id]
      }

      // Logs all users in the room when a user disconnects
      console.log(Object.values(rooms[room].users))
    })
  })

  // User guesses word correctly
  socket.on("word-guessed-correctly", () => {
    const userRooms = getUserRooms(socket)
    userRooms.forEach(room => {
      const newWord = words[Math.floor(Math.random() * words.length)]
      rooms[room].currentWord = newWord
      io.to(room).emit("current-word", newWord)
    })
  })
})

// --- Helper function ---
function getUserRooms(socket) {
  return Object.entries(rooms).reduce((userRooms, [name, room]) => {
    if (room.users[socket.id] != null) userRooms.push(name)
    return userRooms
  }, [])
}