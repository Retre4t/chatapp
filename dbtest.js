//Sqllite database implementering

const sqlite3 = require('sqlite3').verbose();

// Connect to or create a new database
const db = new sqlite3.Database('users.db');

// Create a table called 'users' with email, password, and username fields
//db.run("CREATE TABLE users (email TEXT, password TEXT, username TEXT)");

// Insert some sample data into the table
//db.run("INSERT INTO users VALUES ('user1@example.com', 'password1', 'user1')");
//db.run("INSERT INTO users VALUES ('user2@example.com', 'password2', 'user2')");

// Close the database connection

let users = db.all("SELECT email, username FROM users", function(err, rows) {
    rows.forEach(function (row) {
        if(row.email == "el@el.dk"){
            console.log(row.username)
        }
        //console.log(row.email, row.username);

    })
});	

console.log(users)

db.close();
