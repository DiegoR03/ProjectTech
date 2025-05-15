require("dotenv").config();

const express = require("express");
const validator = require('validator');
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

// Getting API Token /////////////////////////////////////////////////////////////////////
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
        const page = parseInt(req.query.page) || 1;

        const params = new URLSearchParams({
            page,
            limit: 8
        });

        const allowedFilters = [
            "type",       
            "gender",      
            "size",
            "age",
            "coat",
            "good_with_children",
            "good_with_dogs",
            "good_with_cats",
            "house_trained"
        ];

        const filterMap = {
            species: "type",
            gender: "gender",
            size: "size",
            age: "age",
            coat: "coat",
            good_with_children: "good_with_children",
            good_with_dogs: "good_with_dogs",
            good_with_cats: "good_with_cats",
            house_trained: "house_trained"

        };

        // Loop through each filter provided in the URL query string
        for (let queryFilter in req.query) {
            // Convert the query filter to the correct API filter name (if needed)
            let apiFilterReq;

            if (filterMap[queryFilter]) {
                apiFilterReq = filterMap[queryFilter]; // e.g., 'species' → 'type'
            } else {
                apiFilterReq = queryFilter;
            }

            // Check if this is an allowed filter and has a value
            if (allowedFilters.includes(apiFilterReq) && req.query[queryFilter]) {
                // Add the valid filter and its value to the API request parameters
                params.append(apiFilterReq, req.query[queryFilter]);
            }
        }

        const activeFilters = [];
        const filterLabels = {
            species: "Species",
            gender: "Gender",
            size: "Size",
            age: "Age",
            coat: "Coat",
            good_with_children: "Good with children",
            good_with_dogs: "Good with dogs",
            good_with_cats: "Good with cats",
            house_trained: "House trained"
        };

        for (const activeFilter in req.query) {
            if (req.query[activeFilter] && filterLabels[activeFilter]) {
                activeFilters.push({
                    key: activeFilter,
                    label: filterLabels[activeFilter],
                    value: req.query[activeFilter]
                });
            }
        }

        const url = `https://api.petfinder.com/v2/animals?${params.toString()}`;
        const petResponse = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await petResponse.json(); 
        const pets = data.animals;
        const pagination = data.pagination || {};

        //debug output
        console.log("Petfinder API response:", data);
        console.log("Animals found:", data.animals?.length);
        console.log("Pagination info:", pagination);

        console.log(JSON.stringify(pets[0].attributes, null, 2)); // Log the first pet's attributes
        console.log(JSON.stringify(pets[0].environment, null, 2)); // Log the first pet's environment
        console.log(JSON.stringify(pets[0].breeds, null, 2)); // Log the first pet's breeds


        res.render("browse.ejs", { pets, pagination, error: null, request: req, activeFilters });
    } catch (error) {
        res.status(500).render("browse.ejs", { pets: [], pagination: null, error: "Could not fetch pet data.", request: req, activeFilters: [] });
    }
}



function loadRegistry(req, res) {
    req.session.userID = 95234;
    let userID = req.session.userID;
    res.render("register.ejs", { userID });
}
async function processLogin(req, res) {
    const email = xss(req.body.email);

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
// SECURITY ////////////////////////////////////////////////////////////////////////////////////////

// XSS (detects and blocks scripts in forms)
var xss = require("xss");
var html = xss('<script>alert("xss");</script>');
console.log('look here' + html);


