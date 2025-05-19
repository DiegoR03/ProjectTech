require("dotenv").config();

const helmet = require("helmet");
const express = require("express");
const validator = require('validator');
const bcrypt = require("bcryptjs")
const app = express();
const session = require("express-session");
const port = 3000;
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { MongoClient, ObjectId } = require("mongodb");
const uri = process.env.URI;
const client = new MongoClient(uri);
const db = client.db(process.env.DB_NAME);
const userCollection = db.collection(process.env.USER_COLLECTION)

let loggedIn = false;

// XSS (detects and blocks scripts in forms)
var xss = require("xss");
var html = xss('<script>alert("xss");</script>');
console.log('look here' + html);

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
    .use(express.json())
    .use(
        session({
            resave: false,

            saveUninitialized: true,

            secret: process.env.SESSION_SECRET,
        }),
    )

    .use(helmet({
        contentSecurityPolicy: false,
        xDownloadOptions: false,
        xXssProtection: false,
    }))

    .disable('x-powered-by')

    .set("view engine", "ejs")
    .set("views", "view")

    .get("/", loadHome)
    .get("/login", loadLogin)
    .get("/register", loadRegistry)
    .get("/passwordchange", loadPasswordChange)
    .get("/browse", loadBrowse)

    .post("/login", processLogin)
    .post("/passwordchange", changePassword)

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


function loadPasswordChange(req, res) {
    req.session.userID = 95234;
    let userID = req.session.userID;
    res.render("passwordchange.ejs", { userID });
}

// login ////////////////////////////////////////////////////////////////////////////////////////

async function processLogin(req, res) {
    const email = req.body.email;
    const password = req.body.password;

    const hashedPassword = await bcrypt.hash(password, 8)

    try {
        const existingemail = await userCollection.findOne({ email });

        const matchingexisitingpassword = bcrypt.compare(password, hashedPassword);


        if (existingemail && matchingexisitingpassword) {
            console.log("Log in successfull");
            loggedIn = true;
            res.render("browse.ejs");
        } else {
            console.log("Log in invalid");
            loggedIn = false;
            res.render("login.ejs");
        }

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).render("login", { data: "An error occurred during login." });
    }
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

// REGISTRATION ////////////////////////////////////////////////////////////////////////////////////////

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./uploads"); // Make sure this is a relative path
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix);
    }
});

// Initialize Multer
const uploads = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed!"), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Registration route with image upload
app.post("/register", uploads.single('profileImage'), processRegistration);

async function processRegistration(req, res) {
    const firstname = req.body.firstName;
    const lastname = req.body.lastName;
    const email = req.body.email;
    const password = req.body.password;
    const hashedPassword = await bcrypt.hash(password, 8);

    try {
        const existingUser = await userCollection.findOne({ email });
        if (existingUser) {
            console.log("This email is already in use.");
            res.render("register", { data: "Email is already registered" });
            return;
        }
        else {
            // Save image file path if uploaded
            let profileImagePath = null;
            if (req.file) {
                profileImagePath = req.file.path; // Path of uploaded image
            }

            // Register user with image (if uploaded)
            const newUser = {
                firstName: firstname,
                lastName: lastname,
                email: email.trim(),
                password: hashedPassword,
                profileImage: profileImagePath // Store image path in database
            };

            await userCollection.insertOne(newUser);
            console.log("Registration successful:", newUser);
            res.render("login.ejs", { data: "Registration successful" });
        }

    } catch (error) {
        console.error("Error during registration:", error);
        res.status(500).render("login", { data: "An error occurred during registration." });
    }
}

// CHANGE PASSWORD ////////////////////////////////////////////////////////////////////////////////////////

async function changePassword(req, res) {
    const email = req.body.email;
    const password = req.body.password;
    const newpassword = req.body.password_new;

    const hashedPassword = await bcrypt.hash(password, 8)
    const hashedNewPassword = await bcrypt.hash(newpassword, 8)

    try {
        const existingemail = await userCollection.findOne({ email });
        const matchingexisitingpassword = bcrypt.compare(password, hashedPassword);

        if (existingemail && matchingexisitingpassword) {
            console.log("Password is changed");

            userCollection.updateOne({ email: email }, { $set: { password: hashedNewPassword } })
            console.log(existingemail);
            res.render("login.ejs");
        } else {
            console.log("Change failed");
            res.render("passwordchange.ejs");
        }

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).render("login", { data: "An error occurred during change." });
    }
}