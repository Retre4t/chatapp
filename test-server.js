const express = require('express');
const https = require('https');
const fs = require('fs');
const Cryptr = require('cryptr');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();
const sharedSession = require('express-socket.io-session');
const cluster = require('cluster');
const os = require('os');
const bcrypt = require('bcrypt');
const path = require('path');
const bodyParser = require('body-parser');
const socketIO = require('socket.io');
const sticky = require('sticky-session');

const cryptr = new Cryptr('a2e092a744265fd214d7c2ef079e2f01b6d06319b7b2', 'aes-256-ctr', 'hex', 16);

const app = express();

app.use(express.static(path.join(__dirname, 'public')));


const server = https.createServer(
  {
    key: fs.readFileSync('private-key.pem'),
    cert: fs.readFileSync('certificate.pem'),
  },
  app
);


//cluster load balancer implementation
if (!sticky.listen(server, 3030)) {
  // Find the number of CPU cores
  const cpuCount = os.cpus().length;

  // Create a worker for each CPU core
  for (let i = 0; i < cpuCount; i += 1) {
    require('cluster').fork();
  }
  // Replace dead workers
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.id} died`);
    require('cluster').fork();
  });
} else {

  const io = socketIO(server);

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  
  //enkrypterings modul
  const bcrypt = require('bcrypt');
  const saltRounds = 10;

  //session cookies
  app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
    }));

  io.on('connection', (socket) => {
    console.log('new user connected');

    let name;

    // Give a chat message with the user's chosen username when they join the chat room
    socket.on('joining msg', (username) => {
      name = username;
      io.emit('chat message', `---${name} joined the chat---`);
    });

    // Give a chat message when a user leaves the chat room
    socket.on('disconnect', () => {
      console.log('user disconnected');
      io.emit('chat message', `---${name} left the chat---`);
    });

    socket.on('chat message', (msg) => {
      // Send the message to everyone in the chat window, except the sender
      console.log('incoming message:', msg);
      socket.broadcast.emit('incoming chat', msg);
    });
  });

  //endpoint med loggedin status som bruges i scripts til HTML siderne til at bestemme om brugeren er logged in
  app.get("/loggedStatus", async (req, res) => {
    if (req.session.loggedIn) {   
      res.send(true);
    } else {
      res.send(false);
    }
  });
  
  app.get("/username", async (req, res) => {
    let data1 = req.session.username
    const json = ({username: data1});
    res.json(json);
  });

  app.post('/decrypt', (req, res) => {
    const encryptedMessage = req.body.encryptedMessage;
    // Check if the encrypted message is null or undefined
    if (encryptedMessage.encryptedMessage == null) {
      return res.status(400).json({ error: 'Encrypted message cannot be null or undefined' });
    }

    try {
      console.log('decrypting:', encryptedMessage)
      console.log('Decrypting message');
      const decrypted = cryptr.decrypt(encryptedMessage.encryptedMessage);
      console.log('Decrypted message:', decrypted);
      res.json({ decryptedMessage: decrypted });
    } catch (error) {
      console.error('Decryption error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/encrypt', (req, res) => {
    const message = req.body.message;
    // Check if the message is null or undefined
    if (message == null) {
      return res.status(400).json({ error: 'Message cannot be null or undefined' });
    }
    const encrypted = cryptr.encrypt(message);
    console.log('Encrypted message length: ' + encrypted.length);
    res.json({ encryptedMessage: encrypted });
  });

  app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/forside.html');
  });
  
  app.get('/style.css', (req, res) => {
    res.sendFile(__dirname + '/public/style.css');
  });
  
  app.get('/index', (req, res) => {
    res.sendFile(__dirname + '/public/Index.html');
  });
  
  //tjekker efter korrekte login oplysninger
  app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
  });

  app.post('/login', async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
  
      // Connect to the existing database
      const db = new sqlite3.Database('users.db');
  
      // SELECT statement to check if the email already exists
      db.get(`SELECT password, username FROM users WHERE email = '${email}'`, (err, row) => {
          if (err) {
              throw err;
          }
          if (!row) {
              res.send("Incorrect email or password");
              return;
          } else {
              // Compare the password with the hashed password in the database
              bcrypt.compare(password, row.password)
              .then ((result) => {
              if (result) {
                //sætter session cookie op 
                req.session.id = req.body.email;
                req.session.loggedIn = true;
                req.session.username = row.username
                console.dir(row.username)
  
              //sender klienten videre
              res.redirect('/index')
              
              }if (err) {
                    throw err;
              }else {
                    //afviser klienten grundet forkert kodeord eller email
                    res.send("Incorrect username or password");
                    return;
                  }
              });
          }
      // Close the database connection
      db.close();
    });
  });

  app.get('/opretbruger', (req, res) => {
    res.sendFile(__dirname + '/public/opretbruger.html');
  });

  //opretter en ny bruger i databasen og tjekker heri også om brugeren allerede eksisterer  
  app.post('/opretbruger', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    const username = req.body.username;
  
    // Hash the password
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) {
            throw err;
        }
        // Connect to the existing database
        const db = new sqlite3.Database('users.db');
  
        // SELECT statement to check if the email already exists
        db.get(`SELECT COUNT(*) as count FROM users WHERE email = '${email}'`, (err, row) => {
            if (err) {
                throw err;
            }
            //Tjekker om querien returnerer noget data på baggrund af den indtastede email
            if (row.count > 0) {
                res.send(`The email ${email} already exists`);
            } else {
                // INSERT statement to add new user
                db.run(`INSERT INTO users (email, password, username) VALUES ('${email}', '${hash}', '${username}')`, (err) => {
                    if (err) {
                        throw err;
                    }
  
                    req.session.username = req.body.username;
                    req.session.email = req.body.email;
                    req.session.loggedIn = true;
      
                    res.sendFile(__dirname + '/public/index.html');
                    console.dir(`The user ${username} has been added`);
                });
            }
        });
        // Close the database connection
        db.close();
    });
  });



//endpoint med loggedin status som bruges i scripts til HTML siderne til at bestemme om brugeren er logged in
app.get("/loggedStatus", async (req, res) => {
    if (req.session.loggedIn) {   
      res.send(true);
    } else {
      res.send(false);
    }
  });
  
  app.get("/username", async (req, res) => {
    let data1 = req.session.username
    const json = ({username: data1});
    res.json(json);
  });


  server.listen(0, 'localhost', () => {
    // Output the actual port that was assigned
    console.log(`Server running on PORT: ${server.address().port}, Worker ${cluster.worker.id}`);
  });
}
