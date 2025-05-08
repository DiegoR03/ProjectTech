require("dotenv").config();

const express = require("express");
const app = express();
const session = require("express-session");
const port = 3000;

const { MongoClient, ObjectId } = require("mongodb");
const uri = process.env.URI;
const client = new MongoClient(uri);
const db = client.db(process.env.DB_NAME);
const userCollection = db.collection(process.env.USER_COLLECTION)

async function connectDB() {
    try {
        await client.connect();
        console.log("Client is connected to database");

    } catch (error) {
        console.log(error);
    }

}

connectDB();

app
    .use("/static", express.static("static"))
    .use(express.urlencoded({ extended: true }))
    .use(
        session({
            resave: false,

            saveUninitialized: true,

            secret: process.env.SESSION_SECRET,
        }),
    )

    .set("view engine", "ejs")
    .set("views", "view")

    .get("/", loadHome)
    .get("/register", loadRegistry)

    .post("/register", processRegistery)

    .listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });

function loadHome(req, res) {
    req.session.userID = 95234;
    let userID = req.session.userID;
    res.render("index.ejs", { userID });
}

function loadRegistry(req, res) {
    req.session.userID = 95234;
    let userID = req.session.userID;
    res.render("register.ejs", { userID });
}
function processRegistery(req, res){
    console.log(req.body); 
    userCollection.insertOne(req.body);
    let message = "Registration successful"
    res.render("register" , {data: message});
}

console.log("MongoDB URI: ", process.env.URI);
console.log("Database Name: ", process.env.DB_NAME);
console.log("User Collection: ", process.env.USER_COLLECTION);

