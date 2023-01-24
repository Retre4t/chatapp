var express = require('express');
var http = require('http');

var app = express();
var server = http.createServer(app);

//benytter session cookies 
const session = require("express-session")

//database moduler
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));

//socket moduler
var io = require('socket.io')(server);
var path = require('path');

//enkrypterings modul
const bcrypt = require('bcrypt');
const saltRounds = 10;


//session coockie                                  
app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));



//app.use(express.static(path.join(__dirname,'./public')));

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


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/forside.html');
});

app.get('/index', (req, res) => {
  res.sendFile(__dirname + '/public/Index.html');
});

//tjekker efter korrekte login oplysninger
app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

app.post('/login', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    // Connect to the existing database
    const db = new sqlite3.Database('users.db');

    // SELECT statement to check if a user exists
    db.get(`SELECT COUNT(*) as count FROM users WHERE email = '${email}' AND password = '${password}'`, (err, row) => {
        if (err) {
            throw err;
        }
        if (row.count > 0) {

            //sætter session cookie op 
            req.session.id = req.body.email;
            req.session.loggedIn = true;

            //finder brugernavnet på brugeren som logger ind. Dette bruges i chatten
            let users = db.all("SELECT email, username FROM users", function(err, rows) {
              rows.forEach(function (row) {
                  if(row.email == email){
                    //Tilføjer brugernavnet til session cookien
                      req.session.username = row.username
                      console.log(req.session.username)
                  }
                  //console.log(row.email, row.username);
          
              })
          });	
            //sender klienten videre
            res.redirect('/index')
            
        } else {
            //afviser klienten grundet forkert kodeord eller email
            res.send("Incorrect email or password");
        }
    });
    // Close the database connection
    db.close();
});

//opretter en ny bruger i databasen og tjekker heri også om brugeren allerede eksisterer
app.get('/opretbruger', (req, res) => {
  res.sendFile(__dirname + '/public/opretbruger.html');
});

app.post('/opretbruger', (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  const username = req.body.username;

  // Connect to the existing database
  const db = new sqlite3.Database('users.db');

  // SELECT statement to check if the email already exists
  db.get(`SELECT COUNT(*) as count FROM users WHERE email = '${email}'`, (err, row) => {
      if (err) {
          throw err;
      }
      if (row.count > 0) {
          res.send(`The email ${email} already exists`);
      } else {
          // INSERT statement to add new user
          db.run(`INSERT INTO users (email, password, username) VALUES ('${email}', '${password}', '${username}')`, (err) => {
              if (err) {
                  throw err;
              }

              req.session.username = req.body.username;
              req.session.email = req.body.email;
              req.session.loggedIn = true;

              res.sendFile(__dirname + '/public/index.html');
            });
      }
  });

  // Close the database connection
  db.close();
});



//Finder brugerens brugernavn

var name = "Anton"

io.on('connection', (socket) => {
  console.log('new user connected');

  //Giver besked i chatten med brugerens valgte brugernavn når personen kommer in i chatrummet
  socket.on('joining msg', (name) => {
  	io.emit('chat message', `---${name} joined the chat---`);
  });

  //Giver besked i chatten når en bruger forlader chat rummet
  socket.on('disconnect', () => {
    console.log('user disconnected');
    io.emit('chat message', `---${name} left the chat---`);
    
  });
  socket.on('chat message', (msg) => {
    //Sender beskeden til alle som er aktive i chatvinduet, udover afsenderen
    socket.broadcast.emit('chat message', msg);         
  });
});



server.listen(3000, () => {
  console.log('Server listening on PORT: 3000');
});