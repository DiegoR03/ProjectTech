// SECURITY ////////////////////////////////////////////////////////////////////////////////////////

// XSS (detects and blocks scripts in forms)
var xss = require("xss");
var html = xss('<script>alert("xss");</script>');
console.log('look here' + html);

//Validator restricts and unifies user input
const validator = require('validator');

//Hides sensitive info from the browser
const helmet = require("helmet");


// APP SET UP ///////////////////////////////////////////////////////////////////////////

require("dotenv").config();

const express = require("express");

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

// Connect to MongoDB
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
    .get("/searchForm", loadSearchForm)
    .get("/results-search-form", loadResultsSearchForm)

    .post("/login", processLogin)
    .post("/passwordchange", changePassword)
    .post("/searchForm", processForm)

    .listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });






// RENDERING VIEWS ///////////////////////////////////////////////////////////

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

function loadRegistry(req, res) {
    req.session.userID = 95234;
    let userID = req.session.userID;
    res.render("register.ejs", { userID });
}

function loadPasswordChange(req, res) {
    req.session.userID = 95234;
    let userID = req.session.userID;
    res.render("passwordchange.ejs", { userID });
}


function loadSearchForm(req, res) {
    if (!req.session.userID) {
        req.session.userID = 95234;
    }
    let userID = req.session.userID;


    // Retrieves questionlist from 'search-form.js'
    const {questions, questionLabels} = require('./static/js/search-form');

    const questionNum = parseInt(req.query.stepIndex) || 0;
    const step = questions[questionNum];

    if (!req.session.answers) {
        req.session.answers = {};
    } else if (questionNum === 0) {
        req.session.answers = {};
    }
    let userAnswers = req.session.answers;

    console.log("User answers so far:", userAnswers);

    const isLastStep = (questionNum === questions.length - 1);

    res.render("searchForm.ejs", {
        userID,
        stepTitle: `Stap ${questionNum + 1}`,
        question: step.question,
        options: step.options,
        stepIndex: questionNum,
        totalSteps: questions.length,
        isLastStep,
        fieldName: step.name
    });

}

function loadResultsSearchForm(req, res) {
    req.session.userID = 95234;

    let userID = req.session.userID;
    const userAnswers = req.session.answers || {};
    const {question, questionLabels } = require('./static/js/search-form');

    const groupedAnswers = {
        "General Info": ['type', 'size', 'gender', 'isCastrated', 'coat'],
        "Living Situation": ['hasKids', 'hasCats', 'hasDogs', 'isAloneOften', 'floor', 'hasGarden'],
        "Pet Personality": ['activity', 'isHousetrained', 'isComfystrangers', 'isPlayful', 'isPaired']
    };


    res.render("results-search-form.ejs", { userID, userAnswers, groupedAnswers, questionLabels });
}






//  PROCESS FUNCTIONS //////////////////////////////////////////////////////////

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
function processForm(req, res) {
    const { option, stepIndex, } = req.body;
    const step = parseInt(stepIndex);

    if (!req.session.answers) {
        req.session.answers = {};
    }

    // Load questions
    const {questions, questionLabels} = require('./static/js/search-form');
    const currentQuestion = questions[step];

    if (currentQuestion && currentQuestion.name) {
        // Save the answer using the field name as key
        req.session.answers[currentQuestion.name] = option;
    }

    const nextStep = step + 1;
    if (nextStep >= questions.length) {
        // All steps completed, redirect to browse (or results page)
        return res.redirect("/results-search-form");
    }

    res.redirect(`/searchForm?stepIndex=${nextStep}`);
};

app.post('/results-search-form', (req, res) =>{
    const newAnswers = req.body;

  if (!req.session.answers) {
    req.session.answers = {};
  }


for (let key in newAnswers) {
  const cleanKey = xss(key);
  const cleanValue = xss(newAnswers[key]);
  req.session.answers[cleanKey] = cleanValue;
}
  res.status(200).send('Answers updated');
});


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
            userCollection.updateOne({ email: email }, { $set: { password: newpassword } })


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


// GETTING API TOKEN /////////////////////////////////////////////////////////////////////

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


// REQUEST API QUERY & FILTERING ////////////////////////////////////////////////////////
async function loadBrowse(req, res) {
    try {

        res.locals.isFetching = true; // Set flag before API call
        const token = await getPetfinderToken();
        const petsPerPage = 8;
        const page = parseInt(req.query.page) || 1;

        const allowedFilters = [
            "type", "gender", "size", "age", "coat",
            "good_with_children", "good_with_dogs",
            "good_with_cats", "house_trained"
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

        // Step 1: Build query filters string
        const appliedFilters = {};
        const apiBatch = new URLSearchParams({ limit: "100" });

        for (let key in req.query) {
            const apiKey = filterMap[key] || key;
            if (allowedFilters.includes(apiKey) && req.query[key]) {
                apiBatch.append(apiKey, req.query[key]);
                appliedFilters[apiKey] = req.query[key];
            }
        }

        // Step 2: Create a unique key for current filter combo
        const filterKey = JSON.stringify(appliedFilters);
        req.session.petsCache = req.session.petsCache || {};

        let petsWithImages = [];

        // Step 3: Check session cache first
        if (req.session.petsCache[filterKey]) {
            petsWithImages = req.session.petsCache[filterKey];
        } else {
            // Step 4: Fetch data from API
            const totalApiBatches = 4;
            const pagePromises = [];

            for (let i = 1; i <= totalApiBatches; i++) {
                const pageParams = new URLSearchParams(apiBatch.toString());
                pageParams.set("page", i);

                const url = `https://api.petfinder.com/v2/animals?${pageParams.toString()}`;

                pagePromises.push(
                    fetch(url, {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }).then(res => {
                        if (!res.ok) throw new Error(`API error: ${res.status}`);
                        return res.json();
                    })
                );
            }

            const allApiResults = await Promise.all(pagePromises);

            for (const page of allApiResults) {
                if (page.animals) {
                    const petsWithPhotos = page.animals.filter(pet => pet.photos && pet.photos.length > 0);
                    petsWithImages.push(...petsWithPhotos);
                }
            }

            console.log("api hit");
            
            req.session.petsCache[filterKey] = petsWithImages;
        }

        // Step 5: In-memory pagination
        const totalPets = petsWithImages.length;
        const totalPages = Math.ceil(totalPets / petsPerPage);
        const startIndex = (page - 1) * petsPerPage;
        const endIndex = startIndex + petsPerPage;
        const displayedPets = petsWithImages.slice(startIndex, endIndex);

        // Step 6: Build activeFilters for UI
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

        const activeFilters = [];
        for (const key in req.query) {
            if (req.query[key] && filterLabels[key]) {
                activeFilters.push({
                    key,
                    label: filterLabels[key],
                    value: req.query[key]
                });
            }
        }

        res.render("browse.ejs", {
            pets: displayedPets,
            pagination: {
                current_page: page,
                total_pages: totalPages,
                total_count: totalPets
            },
            error: null,
            request: req,
            activeFilters,
            isFetching: false
        });

    } catch (error) {
        console.error("Browse error:", error);
        res.status(500).render("browse.ejs", {
            pets: [],
            pagination: null,
            error: "Could not fetch pet data.",
            request: req,
            activeFilters: [],
            isFetching: false

        });
    }
}
