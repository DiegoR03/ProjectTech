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
    .get("/login", loadLogin)
    .get("/register", loadRegistry)
    .get("/browse", loadBrowse)

    .post("/login", processLogin)

    .listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });

function loadHome(req, res) {
    req.session.userID = 95234;
    let userID = req.session.userID;
    res.render("index.ejs", { userID });
}

function loadLogin(req, res) {
    req.session.userID = 95234;
    let userID = req.session.userID;
    res.render("login.ejs", { userID });
}

async function getPetfinderToken() {
    const response = await fetch("https://api.petfinder.com/v2/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: process.env.PET_FINDER_API_KEY,
            client_secret: process.env.API_SECRET
        })
    });

    const data = await response.json();
    return data.access_token;
}

async function loadBrowse(req, res) {
    try {
        const token = await getPetfinderToken();

        const petResponse = await fetch("https://api.petfinder.com/v2/animals", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await petResponse.json(); // ✅ This is fine
        const pets = data.animals;

        //debug output
        console.log("Petfinder API response:", data);
        console.log("Animals found:", data.animals?.length);
        console.log("Token:", token);
        console.log("Client ID:", process.env.PET_FINDER_API_KEY);
        console.log("Client Secret:", process.env.API_SECRET);


        res.render("browse.ejs", { pets, error: null });
    } catch (error) {
        res.status(500).render("browse.ejs", { pets: [], error: "Could not fetch pet data." });
    }
}



function loadRegistry(req, res) {
    req.session.userID = 95234;
    let userID = req.session.userID;
    res.render("register.ejs", { userID });
}
async function processLogin(req, res) {
    const email = req.body.email;

    try {
        const existingUser = await userCollection.findOne({ email });
        if (existingUser) {
            console.log("This email is already in use.");
            res.render("login", { data: "Email is already registered" });
        } else {
            userCollection.insertOne(req.body);
            let message = "Registration successful"
            res.render("login", { data: message });
        }

    } catch (error) {
        console.error("Error during registration:", error);
        res.status(500).render("login", { data: "An error occurred during registration." });
    }

}




