require('dotenv').config()

const express = require('express')
const app = express()
const session = require('express-session')
const port = 3000

app
    
    .use('/static', express.static('static'))
    .use(express.urlencoded({ extended: true }))
    .use(session({
        resave: false,

        saveUninitialized: true,

        secret: process.env.SESSION_SECRET
    }))

    .set('view engine', 'ejs')
    .set('views', 'view')

    .get('/', onHome)




    .listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });

function onHome(req, res) {
    req.session.userID = 15234;
    let userID = req.session.userID; 
    res.render('home.ejs', {userID});
}
